// Folder Sync — khởi động engine trong extension ẩn (CEP). Phần keo mỏng giữa
// engine.js (logic, có test) và môi trường Premiere: bridge, nhịp quét, fs.watch,
// lệnh từ panel/manager, heartbeat trạng thái, log xoay vòng.
/* global FS */
(function () {
  var fs = require('fs');
  var path = require('path');
  var os = require('os');
  var cp = require('child_process');

  var C = FS.load('js/core/constants.js');
  var cfgMod = FS.load('js/core/config.js');
  var watchmode = FS.load('js/core/watchmode.js');
  var bridgeMod = FS.load('js/engine/bridge.js');
  var engineMod = FS.load('js/engine/engine.js');

  var store = cfgMod.createStore();
  var logDir = path.join(store.dir, 'logs');
  var logFile = path.join(logDir, 'engine.log');

  function log(msg) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      try {
        if (fs.statSync(logFile).size > 1024 * 1024) fs.renameSync(logFile, logFile + '.1');
      } catch (e) { /* chưa có file */ }
      fs.appendFileSync(logFile, new Date().toISOString() + ' ' + msg + '\n');
    } catch (e) { /* không ghi được log thì thôi */ }
  }

  var mounts = [];
  function refreshMounts() {
    try { mounts = watchmode.parseMount(cp.execSync('/sbin/mount', { timeout: 3000 }).toString()); } catch (e) { mounts = []; }
  }
  refreshMounts();
  setInterval(refreshMounts, 60000);

  function modeFor(p) { return watchmode.modeFor(p, mounts, os.homedir()); }

  var host = bridgeMod.createBridge(FS.cs);
  var engine = engineMod.createEngine({
    store: store,
    host: host,
    log: log,
    modeFor: modeFor,
    emit: function (type, data) { FS.send(type, data); },
  });

  // ---------------------------------------------------------------- fs.watch cho ổ cục bộ
  var watchers = {}; // pathkey → { w, path }
  var debounce = {};
  function refreshWatchers() {
    var want = {};
    var cfg = store.load();
    Object.keys(cfg.projects).forEach(function (k) {
      cfg.projects[k].entries.forEach(function (e) {
        if (e.parentId === null && modeFor(e.path) === 'watch') want[e.path.toLowerCase()] = e.path;
      });
    });
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
            engine.markDirty(p);
            if (store.load().autoSync) engine.tick();
          }, C.DEBOUNCE_MS);
        });
        w.on('error', function () { try { w.close(); } catch (e) {} delete watchers[k]; });
        watchers[k] = { w: w, path: p };
      } catch (e) { log('fs.watch lỗi ' + want[k] + ': ' + e.message); }
    });
  }

  // ---------------------------------------------------------------- nhịp quét + heartbeat
  setInterval(function () {
    refreshWatchers();
    if (store.load().autoSync) engine.tick();
  }, C.POLL_REMOTE_MS);
  setInterval(function () { engine.emitStatus(); }, 3000);

  // ---------------------------------------------------------------- lệnh từ panel / manager
  async function activeDocId() {
    var list = await host.listProjects();
    var a = list.filter(function (p) { return p.active; })[0] || list[0];
    if (!a) throw new Error('Chưa mở project nào');
    return a.documentID;
  }

  function reply(id, ok, payload) {
    FS.send(C.EVENTS.REPLY, { id: id, ok: ok, result: ok ? payload : undefined, error: ok ? undefined : String(payload) });
  }

  FS.on(C.EVENTS.COMMAND, function (d) {
    (async function () {
      switch (d.cmd) {
        case 'sync': return engine.syncAll({ manual: true });
        case 'abort': engine.abort(); return true;
        case 'status': engine.emitStatus(); return true;
        case 'add': {
          var docId = d.docId || await activeDocId();
          var bin = d.parentBinNodeId || (await host.getSelectedBin(docId)).nodeId;
          return engine.addFolders(docId, d.paths || [], bin);
        }
        case 'link': {
          var doc = d.docId || await activeDocId();
          var binId = d.binNodeId || (await host.getSelectedBin(doc)).nodeId;
          return engine.linkBin(doc, binId, d.folder || null);
        }
        case 'afterRelink': return engine.afterRelink(d.docId, d.pairs || []);
        case 'selectedBin': {
          var list = await host.listProjects();
          var act = list.filter(function (p) { return p.active; })[0] || list[0];
          if (!act) throw new Error('Chưa mở project nào');
          var b = await host.getSelectedBin(act.documentID);
          return { docId: act.documentID, projectPath: act.path, projectName: act.name, nodeId: b.nodeId, name: b.name };
        }
        default: throw new Error('Lệnh lạ: ' + d.cmd);
      }
    })().then(function (r) { if (d.id) reply(d.id, true, r); engine.emitStatus(); },
      function (e) { log('lệnh ' + d.cmd + ' lỗi: ' + e.message); if (d.id) reply(d.id, false, e.message); engine.emitStatus(); });
  });

  FS.on(C.EVENTS.CONFIG_CHANGED, function () {
    engine.invalidate();
    refreshWatchers();
    engine.emitStatus();
    if (store.load().autoSync) engine.syncAll({ manual: false, force: true });
  });

  log('engine khởi động v' + C.VERSION);
  refreshWatchers();
  engine.emitStatus();
  if (store.load().autoSync) engine.tick();
})();
