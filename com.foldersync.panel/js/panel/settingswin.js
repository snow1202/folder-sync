// Folder Sync — cửa sổ Settings: 3 tab, danh sách từng dòng, Search, Thêm, ✕, Huỷ/OK.
// Mọi thay đổi chỉ lưu khi bấm OK (giống Watchtower).
/* global FS, FS_TIPS */
(function () {
  var C = FS.load('js/core/constants.js');
  var S = FS.load('js/core/settings-edit.js');
  var store = FS.load('js/core/config.js').createStore();
  var $ = function (id) { return document.getElementById(id); };

  var draft;   // { notifications, allowedExt, ignoredFolders }
  var dirty = false;

  FS_TIPS.install();

  function load() {
    var s = store.load().settings;
    draft = {
      notifications: !!s.notifications,
      allowedExt: s.allowedExt.slice().sort(),
      ignoredFolders: s.ignoredFolders.slice(),
    };
    setDirty(false);
    $('g-notify').checked = draft.notifications;
    renderAll();
  }

  function setDirty(v) {
    dirty = v;
    $('dirty-note').textContent = v ? 'Có thay đổi chưa lưu — bấm OK để lưu' : '';
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---------------------------------------------------------------- tab
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.toggle('active', x === t); });
      ['general', 'ext', 'ign'].forEach(function (k) { $('p-' + k).classList.toggle('show', k === t.getAttribute('data-tab')); });
    });
  });

  $('g-notify').addEventListener('change', function () { draft.notifications = this.checked; setDirty(true); });

  // ---------------------------------------------------------------- danh sách
  // kind: 'ext' | 'ign'
  var LISTS = {
    ext: { key: 'allowedExt', add: S.addExt, show: function (v) { return '.' + v; }, defaults: C.DEFAULT_ALLOWED_EXT, placeholder: 'đuôi file, vd. mov — Enter để thêm, Esc để huỷ' },
    ign: { key: 'ignoredFolders', add: S.addIgnored, show: function (v) { return v; }, defaults: C.DEFAULT_IGNORED, placeholder: 'tên folder hoặc /regex/ — Enter để thêm, Esc để huỷ' },
  };
  var adding = { ext: false, ign: false };

  function msg(kind, text, cls) {
    var m = $(kind + '-msg');
    m.textContent = text || '';
    m.title = text || '';
    m.className = 'msg' + (cls ? ' ' + cls : '');
  }

  function render(kind) {
    var L = LISTS[kind];
    var list = draft[L.key];
    var box = $(kind + '-list');
    box.innerHTML = '';
    $(kind + '-n').textContent = list.length;

    if (adding[kind]) {
      var ar = el('div', 'lrow adding');
      var inp = el('input');
      inp.type = 'text';
      inp.placeholder = L.placeholder;
      inp.spellcheck = false;
      ar.appendChild(inp);
      box.appendChild(ar);
      setTimeout(function () { inp.focus(); }, 0);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { adding[kind] = false; msg(kind, ''); render(kind); return; }
        if (e.key !== 'Enter') return;
        var r = L.add(draft[L.key], inp.value);
        if (!r.ok) { msg(kind, r.error, 'err'); return; }
        draft[L.key] = r.list;
        adding[kind] = false;
        setDirty(true);
        msg(kind, 'Đã thêm ' + L.show(r.value), 'ok');
        render(kind);
      });
    }

    var shown = S.filter(list, $(kind + '-q').value);
    if (!shown.length && !adding[kind]) {
      box.appendChild(el('div', 'lempty', list.length ? 'Không có mục nào khớp ô tìm' : 'Danh sách trống'));
      return;
    }
    shown.forEach(function (v) {
      var r = el('div', 'lrow');
      var nm = el('span', 'nm', L.show(v));
      if (kind === 'ign' && S.isRegex(v)) {
        var tag = el('span', 'tag', 'regex');
        tag.setAttribute('data-tip', 'regexTag');
        nm.appendChild(tag);
      }
      var x = el('button', 'rx');
      x.type = 'button';
      x.setAttribute('data-tip', 'removeItem');
      x.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      x.addEventListener('click', function () {
        draft[L.key] = S.remove(draft[L.key], v);
        setDirty(true);
        msg(kind, 'Đã bỏ ' + L.show(v) + ' — bấm Huỷ nếu xoá nhầm', '');
        render(kind);
      });
      r.appendChild(nm);
      r.appendChild(x);
      box.appendChild(r);
    });
  }

  function renderAll() { render('ext'); render('ign'); }

  ['ext', 'ign'].forEach(function (kind) {
    var L = LISTS[kind];
    $(kind + '-q').addEventListener('input', function () { render(kind); });
    $(kind + '-add').addEventListener('click', function () { adding[kind] = true; msg(kind, ''); render(kind); });
    // Khôi phục mặc định: hỏi xác nhận ngay tại chỗ trước khi thay cả danh sách.
    $(kind + '-reset').addEventListener('click', function () {
      var m = $(kind + '-msg');
      m.className = 'msg';
      m.innerHTML = '';
      var c = el('span', 'confirm', 'Thay toàn bộ danh sách bằng mặc định? ');
      var yes = el('button', 'linkbtn', 'Đồng ý');
      var no = el('button', 'linkbtn', 'Thôi');
      yes.type = 'button'; no.type = 'button';
      yes.addEventListener('click', function () {
        draft[L.key] = kind === 'ext' ? L.defaults.slice().sort() : L.defaults.slice();
        setDirty(true);
        msg(kind, 'Đã khôi phục mặc định — bấm OK để lưu', 'ok');
        render(kind);
      });
      no.addEventListener('click', function () { msg(kind, ''); });
      c.appendChild(yes); c.appendChild(no);
      m.appendChild(c);
    });
  });

  // ---------------------------------------------------------------- Huỷ / OK
  $('s-cancel').addEventListener('click', function () { FS.closeSelf(); });
  $('s-ok').addEventListener('click', function () {
    if (dirty) {
      store.update(function (c) {
        c.settings.notifications = draft.notifications;
        c.settings.allowedExt = draft.allowedExt.slice();
        c.settings.ignoredFolders = draft.ignoredFolders.slice();
      });
      FS.send(C.EVENTS.CONFIG_CHANGED, { what: 'settings' });
    }
    FS.closeSelf();
  });

  // Mở lại cửa sổ (CEP có thể giữ trang) → nạp dữ liệu mới nếu chưa sửa gì.
  window.addEventListener('focus', function () { if (!dirty) load(); });
  FS.on(C.EVENTS.PANEL_CLOSED, function () { FS.closeSelf(); });

  load();
})();
