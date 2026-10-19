// Folder Sync — panel chính: WATCH / SYNC / 📁 / ⚙, dòng trạng thái, kéo-thả.
/* global FS, FS_TIPS */
(function () {
  var C = FS.load('js/core/constants.js');
  var store = FS.load('js/core/config.js').createStore();
  var $ = function (id) { return document.getElementById(id); };
  var lastBeat = 0;
  var lastStatus = null;

  FS_TIPS.install();
  // Đóng panel chính → báo cửa sổ Watch folders đóng theo.
  window.addEventListener('beforeunload', function () { FS.send(C.EVENTS.PANEL_CLOSED, {}); });
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
  $('b-folders').addEventListener('click', function () { openManager(); });
  function openSettings() {
    if (FS.isCEP) FS.openExtension(C.EXT_IDS.SETTINGS);
    else window.open('settings.html', 'set', 'width=480,height=580');
  }
  function openManager() {
    if (FS.isCEP) FS.openExtension(C.EXT_IDS.MANAGER);
    else window.open('manager.html', 'mgr', 'width=880,height=560');
  }
  $('b-gear').addEventListener('click', openSettings);

  // Menu ☰ của panel (giống Watchtower): Settings…, Watch folders…, phiên bản.
  if (FS.isCEP) {
    try {
      FS.cs.setPanelFlyoutMenu('<Menu>' +
        '<MenuItem Id="fs-settings" Label="Cài đặt…" Enabled="true" Checked="false"/>' +
        '<MenuItem Id="fs-folders" Label="Danh sách folder…" Enabled="true" Checked="false"/>' +
        '<MenuItem Label="---" />' +
        '<MenuItem Id="fs-ver" Label="Folder Sync ' + C.VERSION + '" Enabled="false" Checked="false"/>' +
        '</Menu>');
      FS.cs.addEventListener('com.adobe.csxs.events.flyoutMenuClicked', function (ev) {
        var id = ev && ev.data && (ev.data.menuId || ev.data);
        if (typeof id === 'string' && id.indexOf('menuId') >= 0) { try { id = JSON.parse(id).menuId; } catch (e) { /* giữ nguyên */ } }
        if (id === 'fs-settings') openSettings();
        if (id === 'fs-folders') openManager();
      });
    } catch (e) { /* host không hỗ trợ flyout menu */ }
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

  // ---------------------------------------------------------------- canh engine
  // Engine ẩn có thể không lên (vd. mất kết nối khi vừa mở Premiere). Panel thử mở
  // lại nó; quá lâu vẫn không có thì tự chạy engine dự phòng ngay trong panel.
  var openedAt = Date.now();
  var hiddenBeat = 0;
  var relaunches = 0;
  var lastRelaunch = 0;
  var embedded = null;

  FS.on(C.EVENTS.STATUS, function (st) {
    lastBeat = Date.now();
    if (st.engine === 'hidden') {
      hiddenBeat = Date.now();
      if (embedded) { embedded.stop(); embedded = null; }
    }
    renderProgress(st.busy);
    render(st);
    if (embedded && st.engine === 'embedded' && !st.busy) {
      setStatus('busy', 'Engine dự phòng · giữ panel mở',
        'Phần đồng bộ ngầm chưa khởi động được nên đang chạy tạm trong panel này — đóng panel thì ngừng đồng bộ. Thoát hẳn Premiere (Cmd+Q), chờ vài giây rồi mở lại để engine ngầm chạy bình thường.');
    }
  });
  FS.on(C.EVENTS.PROGRESS, function (p) { lastBeat = Date.now(); renderProgress(p); });

  FS.send(C.EVENTS.COMMAND, { cmd: 'status' });
  setInterval(function () {
    var now = Date.now();
    if (now - hiddenBeat < 8000) return; // engine ẩn khoẻ
    if (FS.isCEP && relaunches < 6 && now - lastRelaunch > 10000 && now - openedAt > 3000) {
      relaunches++; lastRelaunch = now;
      FS.openExtension(C.EXT_IDS.ENGINE);
    }
    if (FS.isCEP && !embedded && now - openedAt > 15000 && window.FS_startEngine) {
      try { embedded = window.FS_startEngine('embedded'); } catch (e) { setStatus('err', 'Engine lỗi: ' + e.message); }
    }
    if (!embedded && now - lastBeat > 10000) {
      setStatus('err', 'Engine chưa chạy', 'Phần đồng bộ ngầm chưa khởi động. Đang thử khởi động lại…');
    }
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
