// Folder Sync — view Cài đặt trong panel chính (tự lưu khi đổi).
/* global FS */
(function () {
  var C = FS.load('js/core/constants.js');
  var store = FS.load('js/core/config.js').createStore();
  var $ = function (id) { return document.getElementById(id); };

  function flash(text) {
    var h = $('s-hint');
    h.textContent = text;
    h.classList.add('saved');
    clearTimeout(flash.t);
    flash.t = setTimeout(function () { h.classList.remove('saved'); h.textContent = 'Cài đặt tự lưu — dùng chung cho mọi project.'; }, 1600);
  }

  function parseExt(s) {
    return s.split(/[\s,;]+/).map(function (x) { return x.replace(/^\./, '').toLowerCase(); }).filter(Boolean);
  }
  function parseLines(s) {
    return s.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function fill() {
    var s = store.load().settings;
    $('s-notify').checked = !!s.notifications;
    $('s-ext').value = s.allowedExt.join(', ');
    $('s-ign').value = s.ignoredFolders.join('\n');
  }

  function save(mut) {
    store.update(function (c) { mut(c.settings); });
    FS.send(C.EVENTS.CONFIG_CHANGED, { what: 'settings' });
    flash('✓ Đã lưu');
  }

  $('s-notify').addEventListener('change', function () { var v = this.checked; save(function (s) { s.notifications = v; }); });
  $('s-ext').addEventListener('change', function () { var v = parseExt(this.value); save(function (s) { s.allowedExt = v; }); fill(); });
  $('s-ign').addEventListener('change', function () { var v = parseLines(this.value); save(function (s) { s.ignoredFolders = v; }); fill(); });
  $('s-ext-reset').addEventListener('click', function () { save(function (s) { s.allowedExt = C.DEFAULT_ALLOWED_EXT.slice(); }); fill(); });
  $('s-ign-reset').addEventListener('click', function () { save(function (s) { s.ignoredFolders = C.DEFAULT_IGNORED.slice(); }); fill(); });

  window.FS_SETTINGS = { fill: fill };
})();
