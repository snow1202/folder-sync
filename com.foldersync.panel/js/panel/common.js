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

  function send(type, data) {
    if (!isCEP) { (listeners[type] || []).forEach(function (fn) { fn(data || {}); }); return; }
    var ev = new CSEvent(type, 'APPLICATION');
    ev.data = JSON.stringify(data === undefined ? {} : data);
    cs.dispatchEvent(ev);
  }

  function on(type, fn) {
    if (!isCEP) { (listeners[type] = listeners[type] || []).push(fn); return; }
    cs.addEventListener(type, function (ev) {
      var d = ev && ev.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* giữ nguyên */ } }
      fn(d || {});
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
  function pickFolders(multi, title) {
    if (!isCEP || !window.cep || !window.cep.fs) return [];
    var r = window.cep.fs.showOpenDialogEx(!!multi, true, title || 'Chọn folder', '');
    return (r && r.data) ? r.data.map(function (p) { return decodeURI(String(p).replace(/^file:\/\//, '')); }) : [];
  }

  function openExtension(id) { if (isCEP) cs.requestOpenExtension(id, ''); }
  function closeSelf() { if (isCEP) cs.closeExtension(); else window.close(); }

  window.FS = {
    isCEP: isCEP, cs: cs, extRoot: extRoot, load: load, send: send, on: on,
    command: function (c, p, t) { hookReply(); return command(c, p, t); },
    pickFolders: pickFolders, openExtension: openExtension, closeSelf: closeSelf,
  };
})();
