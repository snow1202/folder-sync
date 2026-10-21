// Folder Sync — chế độ XEM TRƯỚC giao diện ngoài Premiere (trình duyệt thường).
// Không làm gì khi chạy trong CEP. Nạp module core bằng XHR đồng bộ + shim `path`,
// dựng config giả và giả lập engine để bấm thử các nút.
(function () {
  if (window.__adobe_cep__) return;

  var pathShim = {
    sep: '/',
    normalize: function (p) {
      var abs = p.charAt(0) === '/';
      var out = [];
      p.split('/').forEach(function (s) { if (!s || s === '.') return; if (s === '..') out.pop(); else out.push(s); });
      return (abs ? '/' : '') + out.join('/') + (p.length > 1 && p.slice(-1) === '/' ? '/' : '');
    },
    join: function () { return pathShim.normalize([].slice.call(arguments).join('/')); },
    dirname: function (p) { var i = p.replace(/\/$/, '').lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); },
    basename: function (p) { var s = p.replace(/\/$/, ''); return s.slice(s.lastIndexOf('/') + 1); },
  };

  var cache = {};
  function loadModule(rel) {
    if (rel === 'path') return pathShim;
    if (cache[rel]) return cache[rel].exports;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', rel, false);
    xhr.send(null);
    var module = { exports: {} };
    cache[rel] = module;
    var dir = rel.slice(0, rel.lastIndexOf('/') + 1);
    var req = function (r) { return r.indexOf('./') === 0 ? loadModule(dir + r.slice(2)) : loadModule(r); };
    new Function('module', 'exports', 'require', xhr.responseText)(module, module.exports, req);
    return module.exports;
  }

  var C = loadModule('js/core/constants.js');
  var cfg = {
    version: 1, autoSync: true,
    settings: { notifications: true, allowedExt: C.DEFAULT_ALLOWED_EXT.slice(), ignoredFolders: C.DEFAULT_IGNORED.slice() },
    projects: {
      d1: { path: '/Users/me/SAMX/Asset/project/Ads_FormaLift.prproj', name: 'Ads_FormaLift.prproj', entries: [
        { id: 'r1', parentId: null, path: '/Users/me/Library/CloudStorage/GoogleDrive-me@crossian.com/Shared drives/SAMX/Sources', sub: true, label: -1, excluded: [] },
        { id: 'c1', parentId: 'r1', path: '/Users/me/Library/CloudStorage/GoogleDrive-me@crossian.com/Shared drives/SAMX/Sources/Footage', sub: true, label: 6 },
        { id: 'c2', parentId: 'c1', path: '/Users/me/Library/CloudStorage/GoogleDrive-me@crossian.com/Shared drives/SAMX/Sources/Footage/Day 01', sub: true, label: 6 },
        { id: 'c3', parentId: 'r1', path: '/Users/me/Library/CloudStorage/GoogleDrive-me@crossian.com/Shared drives/SAMX/Sources/SFX', sub: true, label: 5 },
        { id: 'r2', parentId: null, path: '/Volumes/SSD Team/Old Music', sub: false, label: -1, excluded: [] },
      ] },
    },
  };
  var store = {
    load: function () { return JSON.parse(JSON.stringify(cfg)); },
    save: function (c) { cfg = JSON.parse(JSON.stringify(c)); },
    update: function (fn) { var c = store.load(); fn(c); store.save(c); return c; },
    file: '(xem trước)', dir: '(xem trước)',
  };

  window.FS_PREVIEW = {
    'js/core/constants.js': C,
    'js/core/tree.js': loadModule('js/core/tree.js'),
    'js/core/merge.js': loadModule('js/core/merge.js'),
    'js/panel/draft-diff.js': loadModule('js/panel/draft-diff.js'),
    'js/core/settings-edit.js': loadModule('js/core/settings-edit.js'),
    'js/core/history.js': { createHistory: function () {
      var now = Date.now();
      var demo = ['v23.2 copy.mp4', 'Tiếng mưa.wav', 'Bundle.psd', 'counter_0001.png', 'BG music final.mp3', 'Drone shot 04.mov', 'Logo.ai', 'notes.srt'].map(function (n, i) {
        return { at: now - i * 95000, docId: 'd1', path: '/Users/me/Drive/SAMX/Sources/' + n, name: n, nodeId: 'n' + i, bin: ['Kling AI', 'Audio VN', 'Graphics', 'Sequences'][i % 4] };
      });
      return { list: function () { return demo.slice(); }, add: function (items) { demo = items.concat(demo); }, clear: function () { demo = []; } };
    } },
    'js/core/config.js': { createStore: function () { return store; } },
  };

  // Giả lập engine: trả lời lệnh + phát trạng thái.
  setTimeout(function () {
    var state = { r1: 'ok', c1: 'ok', c2: 'ok', c3: 'ok', r2: 'offline' };
    function status(extra) {
      window.FS.send(C.EVENTS.STATUS, Object.assign({ busy: null, autoSync: cfg.autoSync, version: C.VERSION, at: Date.now(),
        lastSync: { at: Date.now() - 60000, files: 3, folders: 1, message: '3 file, 1 thư mục con đã thêm vào: Footage, SFX' },
        projects: { d1: { name: 'Ads_FormaLift.prproj', state: state } } }, extra || {}));
    }
    window.FS.on(C.EVENTS.COMMAND, function (d) {
      var reply = function (r) { window.FS.send(C.EVENTS.REPLY, { id: d.id, ok: true, result: r }); };
      if (d.cmd === 'selectedBin') return reply({ docId: 'd1', projectName: 'Ads_FormaLift.prproj', nodeId: 'n1', name: 'Asset' });
      if (d.cmd === 'projects') return reply([{ documentID: 'd1', name: 'Ads_FormaLift.prproj', active: true }]);
      if (d.cmd === 'sync') {
        var done = 0;
        var t = setInterval(function () {
          done += 50;
          window.FS.send(C.EVENTS.PROGRESS, { done: Math.min(done, 240), total: 240 });
          if (done >= 240) { clearInterval(t); status(); reply({ files: 240 }); }
        }, 400);
        return;
      }
      reply(true); status();
    });
    status();
    setInterval(status, 3000);
  }, 50);
})();
