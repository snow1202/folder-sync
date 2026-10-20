// Folder Sync — panel chính: WATCH / SYNC / 📁 / ⚙, dòng trạng thái, kéo-thả.
/* global FS, FS_TIPS */
(function () {
  var C = FS.load('js/core/constants.js');
  var store = FS.load('js/core/config.js').createStore();
  var $ = function (id) { return document.getElementById(id); };
  var lastBeat = 0;
  var lastStatus = null;

  FS_TIPS.install();
  // Panel chính là "cha": phát nhịp "còn mở"; panel con (Watch folders, Settings) không
  // nghe thấy nhịp này quá CHILD_TIMEOUT_MS thì tự đóng. Khi đóng, Premiere huỷ trang quá
  // nhanh nên tín hiệu PANEL_CLOSED dưới đây không phải lúc nào cũng kịp gửi.
  // Dùng timer của Node (nếu có): không bị Chromium làm chậm khi panel nằm ẩn sau tab khác.
  var aliveTimer = (FS.isCEP && typeof require === 'function') ? require('timers').setInterval : setInterval;
  FS.send(C.EVENTS.PANEL_ALIVE, {});
  aliveTimer(function () { FS.send(C.EVENTS.PANEL_ALIVE, {}); }, C.ALIVE_EVERY_MS);
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
    if (show) {
      var pct = Math.round(100 * p.done / p.total);
      $('bar').style.width = pct + '%';
      $('ptxt').textContent = 'Đang import ' + p.done.toLocaleString('vi-VN') + ' / ' + p.total.toLocaleString('vi-VN') + ' file · ' + pct + '%';
      setStatus('busy', 'Đang import…');
    }
  }

  // ---------------------------------------------------------------- file đã import (project đang làm việc)
  var hist = FS.load('js/core/history.js').createHistory(store.dir);
  var host = FS.isCEP ? FS.load('js/engine/bridge.js').createBridge(FS.cs) : null;
  var currentDoc = null;
  var VIDEO = /\.(mp4|mov|mxf|avi|mkv|m4v|mpg|mpeg|mts|m2ts|r3d|braw|webm|wmv|dv|3gp|hevc|264|h264|ts|vob|flv)$/i;
  var AUDIO = /\.(wav|mp3|aif|aiff|aac|m4a|flac|ogg|wma|bwf|caf|ac3)$/i;
  var IMAGE = /\.(png|jpe?g|psd|ai|tiff?|gif|bmp|exr|dpx|tga|heic|webp|svg|eps|dng)$/i;

  function hhmmss(ms) {
    var d = new Date(ms);
    var today = new Date();
    var t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return d.toDateString() === today.toDateString() ? t : ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + t;
  }

  function renderHistory(fresh) {
    var box = $('h-list');
    var list = currentDoc ? hist.list(currentDoc) : [];
    $('h-count').textContent = list.length;
    box.innerHTML = '';
    if (!list.length) {
      var em = document.createElement('div');
      em.className = 'aempty';
      em.textContent = currentDoc ? 'Chưa có file nào được import vào project này. File mới sẽ hiện ở đây.' : 'Đang xác định project…';
      box.appendChild(em);
      return;
    }
    var freshKeys = {};
    (fresh || []).forEach(function (it) { freshKeys[it.path + '|' + it.at] = true; });
    list.forEach(function (it) {
      var r = document.createElement('div');
      r.className = 'arow' + (freshKeys[it.path + '|' + it.at] ? ' new' : '');
      r.setAttribute('data-tip-text', it.path + '\n\nBấm để chọn trong Project panel.');
      r.setAttribute('data-tip', 'row');
      var kind = VIDEO.test(it.name) ? 'v' : AUDIO.test(it.name) ? 'a' : IMAGE.test(it.name) ? 'i' : 'o';
      var ico = document.createElement('span');
      ico.className = 'aico ' + kind;
      ico.textContent = { v: 'VID', a: 'AUD', i: 'IMG', o: 'FILE' }[kind];
      var info = document.createElement('div');
      info.className = 'ainfo';
      var b = document.createElement('b'); b.textContent = it.name;
      var sp = document.createElement('span'); sp.textContent = '→ ' + (it.bin || '');
      info.appendChild(b); info.appendChild(sp);
      var tm = document.createElement('span'); tm.className = 'atime'; tm.textContent = hhmmss(it.at);
      r.appendChild(ico); r.appendChild(info); r.appendChild(tm);
      r.addEventListener('click', function () {
        if (!host) return;
        host.revealItem(it.docId, it.nodeId).then(function (res) {
          if (res === 'missing') setStatus('err', 'Không còn trong project', it.name + ' đã bị xoá khỏi project (file vẫn còn trên ổ).');
          else if (res === 'bin') setStatus('ok', 'Đã chọn bin ' + (it.bin || ''));
          else setStatus('ok', 'Đã chọn ' + it.name);
        }, function (e) { setStatus('err', e.message); });
      });
      box.appendChild(r);
    });
  }

  FS.on(C.EVENTS.HISTORY, function (d) { if (d.docId === currentDoc) renderHistory(d.items); });

  // "Xoá danh sách" — hỏi xác nhận ngay tại chỗ.
  function buildClear() {
    var boxc = $('h-clear-box');
    boxc.innerHTML = '';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'linkbtn'; btn.textContent = 'Xoá danh sách';
    btn.setAttribute('data-tip', 'clearHistory');
    btn.addEventListener('click', function () {
      if (!currentDoc) return;
      boxc.innerHTML = '';
      var q = document.createElement('span'); q.className = 'confirm'; q.textContent = 'Xoá danh sách? ';
      var yes = document.createElement('button'); yes.type = 'button'; yes.className = 'linkbtn'; yes.textContent = 'Đồng ý';
      var no = document.createElement('button'); no.type = 'button'; no.className = 'linkbtn'; no.textContent = 'Thôi';
      yes.addEventListener('click', function () { hist.clear(currentDoc); renderHistory(); buildClear(); });
      no.addEventListener('click', buildClear);
      q.appendChild(yes); q.appendChild(no); boxc.appendChild(q);
    });
    boxc.appendChild(btn);
  }
  buildClear();

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
      if (b.docId && b.docId !== currentDoc) { currentDoc = b.docId; renderHistory(); }
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
