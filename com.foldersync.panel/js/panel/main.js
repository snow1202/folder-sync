// Folder Sync — panel chính: WATCH / SYNC / 📁 / ⚙, dòng trạng thái, kéo-thả.
/* global FS, FS_TIPS, FS_SETTINGS */
(function () {
  var C = FS.load('js/core/constants.js');
  var store = FS.load('js/core/config.js').createStore();
  var $ = function (id) { return document.getElementById(id); };
  var lastBeat = 0;
  var lastStatus = null;
  var engineLaunched = false;

  FS_TIPS.install();
  $('ver').textContent = 'V' + C.VERSION;

  // ---------------------------------------------------------------- WATCH
  function renderWatch(on) {
    $('b-watch').classList.toggle('on', on);
    $('i-eye-off').style.display = on ? 'none' : '';
    $('l-watch').textContent = on ? 'Watching' : 'Watch';
  }
  renderWatch(store.load().autoSync);
  $('b-watch').addEventListener('click', function () {
    var c = store.update(function (cfg) { cfg.autoSync = !cfg.autoSync; });
    renderWatch(c.autoSync);
    FS.send(C.EVENTS.CONFIG_CHANGED, { what: 'autoSync' });
    setStatus(c.autoSync ? 'ok' : 'idle', c.autoSync ? 'Đang tự đồng bộ' : 'Đã tắt tự đồng bộ');
  });

  // ---------------------------------------------------------------- SYNC
  $('b-sync').addEventListener('click', function () {
    $('b-sync').classList.add('spin');
    setStatus('busy', 'Đang quét…');
    FS.command('sync').then(function (r) {
      if (r === null) setStatus('err', 'Chưa mở project nào');
    }, function (e) { setStatus('err', e.message); })
      .then(function () { $('b-sync').classList.remove('spin'); });
  });

  $('b-cancel').addEventListener('click', function () { FS.send(C.EVENTS.COMMAND, { cmd: 'abort' }); });

  // ---------------------------------------------------------------- 📁 và ⚙
  $('b-folders').addEventListener('click', function () {
    if (FS.isCEP) FS.openExtension(C.EXT_IDS.MANAGER);
    else window.open('manager.html', 'mgr', 'width=880,height=560');
  });
  $('b-gear').addEventListener('click', function () { FS_SETTINGS.fill(); show('v-settings'); });
  $('s-back').addEventListener('click', function () { show('v-main'); });
  function show(id) {
    ['v-main', 'v-settings'].forEach(function (v) { $(v).classList.toggle('show', v === id); });
  }

  // ---------------------------------------------------------------- trạng thái
  function setStatus(kind, text, detail) {
    var el = $('status');
    el.className = 'status ' + kind;
    $('status-txt').textContent = text;
    if (detail) el.setAttribute('data-tip-text', detail); else el.removeAttribute('data-tip-text');
  }

  function hhmm(ms) {
    var d = new Date(ms);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function countEntries() {
    var cfg = store.load();
    var n = 0;
    Object.keys(cfg.projects).forEach(function (k) { n += cfg.projects[k].entries.length; });
    return n;
  }

  function render(st) {
    lastStatus = st;
    renderWatch(!!st.autoSync);
    var errs = 0;
    var offline = 0;
    Object.keys(st.projects || {}).forEach(function (k) {
      var s = st.projects[k].state || {};
      Object.keys(s).forEach(function (id) { if (s[id] === 'offline') offline++; if (s[id] === 'error') errs++; });
    });
    var hasEntries = countEntries() > 0;
    $('dl-normal').style.display = hasEntries ? '' : 'none';
    $('dl-steps').style.display = hasEntries ? 'none' : '';
    if (st.busy) return; // thanh tiến trình đang hiển thị
    if (errs) setStatus('err', errs + ' folder lỗi', 'Có folder không sync được nhiều lần liên tiếp. Mở 📁 để kiểm tra, hoặc bấm SYNC để thử lại.');
    else if (offline) setStatus('err', offline + ' folder offline', 'Không tìm thấy folder (ổ chưa cắm, Google Drive chưa đăng nhập, folder bị đổi tên). Mở 📁 và bấm vào đường dẫn màu đỏ để chọn lại.');
    else if (st.lastSync) {
      var ls = st.lastSync;
      var txt = 'Đã sync ' + hhmm(ls.at) + (ls.files ? ' · +' + ls.files : '');
      if (ls.aborted) txt = 'Đã huỷ ' + hhmm(ls.at) + ' · +' + ls.files;
      setStatus(st.autoSync ? 'ok' : 'idle', txt, ls.message);
    } else setStatus(st.autoSync ? 'ok' : 'idle', st.autoSync ? 'Đang tự đồng bộ' : 'Tự đồng bộ đang tắt');
  }

  function renderProgress(p) {
    var show = p && p.total > 0 && p.done < p.total;
    $('progress').classList.toggle('show', !!show);
    $('status').style.display = show ? 'none' : '';
    if (show) {
      $('bar').style.width = Math.round(100 * p.done / p.total) + '%';
      $('ptxt').textContent = p.done.toLocaleString('vi-VN') + ' / ' + p.total.toLocaleString('vi-VN');
    }
  }

  FS.on(C.EVENTS.STATUS, function (st) { lastBeat = Date.now(); renderProgress(st.busy); render(st); });
  FS.on(C.EVENTS.PROGRESS, function (p) { lastBeat = Date.now(); renderProgress(p); });

  // Engine chưa chạy? → thử mở; quá 10 s không có nhịp → báo đỏ.
  FS.send(C.EVENTS.COMMAND, { cmd: 'status' });
  setInterval(function () {
    var gap = Date.now() - lastBeat;
    if (gap > 4000 && !engineLaunched) { engineLaunched = true; FS.openExtension(C.EXT_IDS.ENGINE); }
    if (gap > 10000) setStatus('err', 'Engine chưa chạy', 'Phần đồng bộ ngầm chưa khởi động. Hãy thoát hẳn Premiere (Cmd+Q) rồi mở lại.');
  }, 2000);

  // Bin đích khi thả folder = bin đang chọn ở Project panel.
  function refreshTarget() {
    if (document.hidden) return;
    FS.command('selectedBin', {}, 4000).then(function (b) {
      if (!b) return;
      var proj = String(b.projectName || '').replace(/\.prproj$/i, '');
      $('target-bin').textContent = (proj ? proj + ' › ' : '') + (b.name || 'gốc project');
      $('target-bin').title = 'Folder thả vào sẽ được thêm cho project ' + (proj || '?') + ', trong bin ' + (b.name || 'gốc');
    }, function () { /* engine chưa sẵn sàng */ });
  }
  refreshTarget();
  setInterval(refreshTarget, 2500);

  // ---------------------------------------------------------------- kéo-thả
  var depth = 0;
  var panel = $('panel');
  function isFolderDrag(e) {
    var t = e.dataTransfer && e.dataTransfer.types;
    return t && Array.prototype.indexOf.call(t, 'Files') >= 0;
  }
  panel.addEventListener('dragenter', function (e) {
    e.preventDefault();
    depth++;
    $('drop-txt').textContent = isFolderDrag(e) ? 'Thả folder để theo dõi' : 'Thả bin để liên kết với folder';
    $('drop').classList.add('show');
  });
  panel.addEventListener('dragover', function (e) { e.preventDefault(); });
  panel.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) $('drop').classList.remove('show'); });
  panel.addEventListener('drop', function (e) {
    e.preventDefault();
    depth = 0;
    $('drop').classList.remove('show');
    var files = e.dataTransfer.files || [];
    var paths = [];
    for (var i = 0; i < files.length; i++) {
      var p = files[i].path;
      if (!p) continue;
      try { if (require('fs').statSync(p).isDirectory()) paths.push(p); } catch (err) { /* bỏ qua */ }
    }
    if (paths.length) {
      setStatus('busy', 'Đang thêm ' + paths.length + ' folder…');
      FS.command('add', { paths: paths }).then(function (r) {
        if (r) setStatus('ok', '+' + r.files + ' file · ' + paths.length + ' folder mới');
      }, function (err) { setStatus('err', err.message); });
      return;
    }
    if (files.length) { setStatus('err', 'Chỉ nhận folder, không nhận file lẻ'); return; }
    // Kéo bin từ Project panel: Premiere có thể không gửi dữ liệu → hướng dẫn cách khác.
    var types = e.dataTransfer.types ? Array.prototype.join.call(e.dataTransfer.types, ',') : '';
    if (FS.isCEP) {
      FS.command('link', {}).then(function (r) {
        if (r && r.status === 'ok') setStatus('ok', 'Đã liên kết ' + r.linked + ' bin');
        else if (r && r.status === 'need-folder') setStatus('err', 'Bin trống — mở 📁 › Liên kết bin để chọn folder');
        else setStatus('err', 'Không liên kết được — xem 📁', types);
      }, function (err) { setStatus('err', err.message); });
    }
  });
})();
