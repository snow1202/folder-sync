// Folder Sync — tiện ích dùng chung cho panel, manager, engine (chạy trong CEP).
// Mở file HTML bằng trình duyệt thường (không có CEP) thì chạy ở chế độ xem trước:
// không có Node/Premiere, dữ liệu giả — chỉ để kiểm tra giao diện.
/* global CSInterface, CSEvent, SystemPath */
(function () {
  var isCEP = !!(window.__adobe_cep__) && typeof require === 'function';
  var cs = isCEP ? new CSInterface() : null;
  var listeners = {};

  function extRoot() {
    var p = cs.getSystemPath(SystemPath.EXTENSION);
    return decodeURI(String(p).replace(/^file:\/\//, ''));
  }

  function load(rel) {
    if (isCEP) return require(extRoot() + '/' + rel);
    return (window.FS_PREVIEW && window.FS_PREVIEW[rel]) || {};
  }

  // Mỗi sự kiện mang _eid. Gửi qua CEP (tới extension khác) VÀ giao luôn cho
  // listener trong chính trang này (engine dự phòng chạy trong panel cần nhận
  // lệnh của panel). Nếu CEP cũng giao lại cho chính mình thì _eid chặn trùng.
  var eidSeq = 0;
  function seenSet() {
    var seen = {};
    var order = [];
    return function first(eid) {
      if (seen[eid]) return false;
      seen[eid] = true;
      order.push(eid);
      if (order.length > 500) delete seen[order.shift()];
      return true;
    };
  }

  function send(type, data) {
    var payload = Object.assign({}, data === undefined ? {} : data);
    payload._eid = 'v' + Math.random().toString(36).slice(2, 8) + (++eidSeq);
    var local = listeners[type] || [];
    setTimeout(function () { local.forEach(function (fn) { fn(payload); }); }, 0);
    if (!isCEP) return;
    var ev = new CSEvent(type, 'APPLICATION');
    ev.data = JSON.stringify(payload);
    cs.dispatchEvent(ev);
  }

  function on(type, fn) {
    var first = seenSet(); // mỗi listener tự chặn trùng của riêng nó
    var guarded = function (d) { if (d && d._eid && !first(d._eid)) return; fn(d || {}); };
    (listeners[type] = listeners[type] || []).push(guarded);
    if (!isCEP) return;
    cs.addEventListener(type, function (ev) {
      var d = ev && ev.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* giữ nguyên */ } }
      guarded(d || {});
    });
  }

  // Gửi lệnh tới engine và chờ trả lời (REPLY có cùng id).
  var seq = 0;
  var waiting = {};
  function command(cmd, payload, timeoutMs) {
    var C = load('js/core/constants.js');
    var id = 'q' + Date.now().toString(36) + (++seq);
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { delete waiting[id]; reject(new Error('Engine không phản hồi')); }, timeoutMs || 120000);
      waiting[id] = function (d) { clearTimeout(t); delete waiting[id]; if (d.ok) resolve(d.result); else reject(new Error(d.error)); };
      send(C.EVENTS.COMMAND, Object.assign({ cmd: cmd, id: id }, payload || {}));
    });
  }
  var replyHooked = false;
  function hookReply() {
    if (replyHooked) return;
    replyHooked = true;
    var C = load('js/core/constants.js');
    on(C.EVENTS.REPLY, function (d) { if (d && waiting[d.id]) waiting[d.id](d); });
  }

  // Chọn folder (một hoặc nhiều) bằng hộp thoại hệ thống của CEP.
  // initialPath: hộp thoại mở tại đây (lùi dần lên thư mục cha gần nhất còn tồn tại).
  function pickFolders(multi, title, initialPath) {
    if (!isCEP || !window.cep || !window.cep.fs) return [];
    var start = '';
    if (initialPath) {
      var fs = require('fs');
      var path = require('path');
      var cur = String(initialPath);
      for (var i = 0; i < 12 && cur && cur !== '/'; i++) {
        try { if (fs.statSync(cur).isDirectory()) { start = cur; break; } } catch (e) { /* chưa có */ }
        cur = path.dirname(cur);
      }
    }
    var r = window.cep.fs.showOpenDialogEx(!!multi, true, title || 'Chọn folder', start);
    return (r && r.data) ? r.data.map(function (p) { return decodeURI(String(p).replace(/^file:\/\//, '')); }) : [];
  }

  // ------------------------------------------------ quan hệ cha (panel chính) – con
  // File đánh dấu trạng thái panel chính: ~/Library/Application Support/FolderSync/parent-panel.json
  // Tính sẵn khi nạp trang: lúc trang đang bị huỷ, mọi lời gọi sang host (vd. getSystemPath
  // trong load()) có thể bị chặn, nên markParent('closed') chỉ được dùng fs thuần.
  var parentFileCached = null;
  function parentFile() {
    if (!parentFileCached) {
      parentFileCached = require('path').join(require('os').homedir(), 'Library', 'Application Support', 'FolderSync', 'parent-panel.json');
    }
    return parentFileCached;
  }
  if (isCEP) { try { parentFile(); } catch (e) { /* bỏ qua */ } }

  // Panel chính gọi: 'open' khi mở, 'closed' khi đóng (ghi đồng bộ — chạy được cả lúc trang bị huỷ).
  function markParent(state) {
    if (!isCEP) return;
    try {
      var fs = require('fs');
      var f = parentFile();
      if (state === 'open') fs.mkdirSync(require('path').dirname(f), { recursive: true });
      fs.writeFileSync(f, JSON.stringify({ state: state, at: Date.now() }));
    } catch (e) { /* không ghi được thì còn nhịp PANEL_ALIVE làm dự phòng */ }
  }

  // Panel con gọi: đóng ngay khi panel chính ghi 'closed' (fs.watch), dự phòng bằng nhịp PANEL_ALIVE
  // (panel chính crash, không kịp ghi file).
  function followParent() {
    if (!isCEP) return;
    var fs = require('fs');
    var path = require('path');
    var C = load('js/core/constants.js');
    var f = parentFile();
    var openedAt = Date.now();
    function check() {
      try {
        var d = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (d.state === 'closed' && d.at >= openedAt - 1000) closeSelf();
      } catch (e) { /* file đang ghi dở / chưa có */ }
    }
    try {
      fs.watch(path.dirname(f), function (ev, name) { if (!name || name === path.basename(f)) check(); });
    } catch (e) { /* fs.watch lỗi → còn nhịp dự phòng */ }
    var last = Date.now();
    on(C.EVENTS.PANEL_ALIVE, function () { last = Date.now(); });
    on(C.EVENTS.PANEL_CLOSED, function () { closeSelf(); });
    // fs.watch trên macOS có lúc báo trễ / không báo → đọc file (vài byte) mỗi 150 ms cho chắc.
    setInterval(check, 150);
    // Hộp chọn folder (showOpenDialogEx) chặn JS của panel này trong lúc người dùng chọn → nhịp từ panel
    // chính không đến được. Thấy đồng hồ của chính mình bị "đứng" quá 2,5 s thì tính lại từ đầu, không đóng.
    var tick = Date.now();
    setInterval(function () {
      var now = Date.now();
      if (now - tick > 2500) last = now;
      tick = now;
      if (now - last > C.CHILD_TIMEOUT_MS) closeSelf();
    }, 1000);
  }

  function openExtension(id) { if (isCEP) cs.requestOpenExtension(id, ''); }
  function closeSelf() { if (isCEP) cs.closeExtension(); else window.close(); }

  window.FS = {
    isCEP: isCEP, cs: cs, extRoot: extRoot, load: load, send: send, on: on,
    command: function (c, p, t) { hookReply(); return command(c, p, t); },
    pickFolders: pickFolders, openExtension: openExtension, closeSelf: closeSelf, followParent: followParent, markParent: markParent,
  };
})();
