// Folder Sync — tiện ích dùng chung cho panel, manager, engine (chạy trong CEP).
/* global CSInterface, CSEvent, SystemPath */
(function () {
  var cs = new CSInterface();

  function extRoot() {
    var p = cs.getSystemPath(SystemPath.EXTENSION);
    p = decodeURI(String(p).replace(/^file:\/\//, ''));
    return p;
  }

  // Nạp module CommonJS của extension (mixed-context có require của Node).
  function load(rel) {
    return require(extRoot() + '/' + rel);
  }

  function send(type, data) {
    var ev = new CSEvent(type, 'APPLICATION');
    ev.data = JSON.stringify(data === undefined ? {} : data);
    cs.dispatchEvent(ev);
  }

  function on(type, fn) {
    cs.addEventListener(type, function (ev) {
      var d = ev && ev.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* để nguyên */ } }
      fn(d || {});
    });
  }

  window.FS = { cs: cs, extRoot: extRoot, load: load, send: send, on: on };
})();
