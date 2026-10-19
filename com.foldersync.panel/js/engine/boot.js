// Folder Sync — khởi động engine trong CEP. Phần keo mỏng giữa engine.js (logic,
// có test) và môi trường Premiere: bridge, nhịp quét, fs.watch, lệnh từ
// panel/manager, heartbeat trạng thái, log xoay vòng.
//
// Hai chế độ:
//   'hidden'   — chạy trong extension ẩn (bình thường), sống suốt phiên Premiere.
//   'embedded' — DỰ PHÒNG: chạy ngay trong panel khi extension ẩn không lên được
//                (vd. mất kết nối lúc mở Premiere). Tự dừng khi thấy engine ẩn chạy lại.
/* global FS */
(function () {
  function startEngine(kind) {
    var fs = require('fs');
    var path = require('path');
    var os = require('os');
    var cp = require('child_process');

    var C = FS.load('js/core/constants.js');
    var cfgMod = FS.load('js/core/config.js');
    var watchmode = FS.load('js/core/watchmode.js');
    var bridgeMod = FS.load('js/engine/bridge.js');
    var engineMod = FS.load('js/engine/engine.js');

    var instance = kind + '-' + Date.now().toString(36);
    var active = true;
    var timers = [];
    var store = cfgMod.createStore();
    var logDir = path.join(store.dir, 'logs');
    var logFile = path.join(logDir, 'engine.log');

    function log(msg) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
        try {
          if (fs.statSync(logFile).size > 1024 * 1024) fs.renameSync(logFile, logFile + '.1');
        } catch (e) { /* chưa có file */ }
        fs.appendFileSync(logFile, new Date().toISOString() + ' [' + kind + '] ' + msg + '\n');
      } catch (e) { /* không ghi được log thì thôi */ }
    }
    log('engine khởi động v' + C.VERSION);

    var mounts = [];
    function refreshMounts() {
      try { mounts = watchmode.parseMount(cp.execSync('/sbin/mount', { timeout: 3000 }).toString()); } catch (e) { mounts = []; }
    }
    refreshMounts();
    timers.push(setInterval(refreshMounts, 60000));

    function modeFor(p) { return watchmode.modeFor(p, mounts, os.homedir()); }

    var host = bridgeMod.createBridge(FS.cs);
    var engine = engineMod.createEngine({
      store: store,
      host: host,
      log: log,
      modeFor: modeFor,
      emit: function (type, data) {
        if (!active) return;
        if (type === C.EVENTS.STATUS) data = Object.assign({ engine: kind, instance: instance }, data);
        FS.send(type, data);
      },
    });

    // -------------------------------------------------------------- fs.watch cho ổ cục bộ
    var watchers = {};
    var debounce = {};
    function refreshWatchers() {
      var want = {};
      if (active) {
        var cfg = store.load();
        Object.keys(cfg.projects).forEach(function (k) {
          cfg.projects[k].entries.forEach(function (e) {
            // folder offline không gắn fs.watch được (ENOENT) — engine tự kiểm lại theo nhịp quét
            if (e.parentId === null && modeFor(e.path) === 'watch' && fs.existsSync(e.path)) want[e.path.toLowerCase()] = e.path;
          });
        });
      }
      Object.keys(watchers).forEach(function (k) {
        if (!want[k]) { try { watchers[k].w.close(); } catch (e) {} delete watchers[k]; }
      });
      Object.keys(want).forEach(function (k) {
        if (watchers[k]) return;
        try {
          var p = want[k];
          var w = fs.watch(p, { recursive: true }, function () {
            clearTimeout(debounce[k]);
            debounce[k] = setTimeout(function () {
              if (!active) return;
              engine.markDirty(p);
              if (store.load().autoSync) engine.tick();
            }, C.DEBOUNCE_MS);
          });
          w.on('error', function () { try { w.close(); } catch (e) {} delete watchers[k]; });
          watchers[k] = { w: w, path: p };
        } catch (e) { log('fs.watch lỗi ' + want[k] + ': ' + e.message); }
      });
    }

    // -------------------------------------------------------------- nhịp quét + heartbeat
    timers.push(setInterval(function () {
      if (!active) return;
      refreshWatchers();
      if (store.load().autoSync) engine.tick();
    }, C.POLL_REMOTE_MS));
    timers.push(setInterval(function () { if (active) engine.emitStatus(); }, 3000));

    // -------------------------------------------------------------- lệnh từ panel / manager
    async function activeProject() {
      var list = await host.listProjects();
      var a = list.filter(function (p) { return p.active; })[0] || list[0];
      if (!a) throw new Error('Chưa mở project nào');
      return a;
    }

    function reply(id, ok, payload) {
      FS.send(C.EVENTS.REPLY, { id: id, ok: ok, result: ok ? payload : undefined, error: ok ? undefined : String(payload) });
    }

    FS.on(C.EVENTS.COMMAND, function (d) {
      if (!active) return;
      (async function () {
        switch (d.cmd) {
          case 'sync': return engine.syncAll({ manual: true });
          case 'abort': engine.abort(); return true;
          case 'status': engine.emitStatus(); return true;
          case 'add': {
            var docId = d.docId || (await activeProject()).documentID;
            var bin = d.parentBinNodeId || (await host.getSelectedBin(docId)).nodeId;
            return engine.addFolders(docId, d.paths || [], bin);
          }
          case 'link': {
            var doc = d.docId || (await activeProject()).documentID;
            var binId = d.binNodeId || (await host.getSelectedBin(doc)).nodeId;
            return engine.linkBin(doc, binId, d.folder || null);
          }
          case 'projects': return host.listProjects();
          case 'afterRelink': return engine.afterRelink(d.docId, d.pairs || []);
          case 'selectedBin': {
            var act = await activeProject();
            var b = await host.getSelectedBin(act.documentID);
            return { docId: act.documentID, projectPath: act.path, projectName: act.name, nodeId: b.nodeId, name: b.name };
          }
          default: throw new Error('Lệnh lạ: ' + d.cmd);
        }
      })().then(function (r) { if (d.id) reply(d.id, true, r); engine.emitStatus(); },
        function (e) { log('lệnh ' + d.cmd + ' lỗi: ' + e.message); if (d.id) reply(d.id, false, e.message); engine.emitStatus(); });
    });

    FS.on(C.EVENTS.CONFIG_CHANGED, function () {
      if (!active) return;
      engine.invalidate();
      refreshWatchers();
      engine.emitStatus();
      if (store.load().autoSync) engine.syncAll({ manual: false, force: true });
    });

    refreshWatchers();
    engine.emitStatus();
    if (store.load().autoSync) engine.tick();

    return {
      kind: kind,
      instance: instance,
      stop: function () {
        if (!active) return;
        active = false;
        engine.abort();
        timers.forEach(clearInterval);
        refreshWatchers(); // đóng hết watcher
        log('engine dừng (nhường cho engine ẩn)');
      },
    };
  }

  window.FS_startEngine = startEngine;
  if (document.documentElement.getAttribute('data-engine') === 'hidden') startEngine('hidden');
})();
