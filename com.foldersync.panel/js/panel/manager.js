// Folder Sync — cửa sổ quản lý watch-folder (bản nháp, chỉ lưu khi OK).
/* global FS, FS_TIPS */
(function () {
  var C = FS.load('js/core/constants.js');
  var T = FS.load('js/core/tree.js');
  var M = FS.load('js/core/merge.js');
  var store = FS.load('js/core/config.js').createStore();
  var $ = function (id) { return document.getElementById(id); };

  var draft;          // { docId: {path, name, entries} }
  var removed;        // Set id đã ✕
  var relinks;        // [{docId, oldRoot, newRoot}]
  var dirty = false;
  var collapsed = {}; // id → true
  var states = {};    // id → 'ok'|'offline'|'busy'|'error'
  var openProjects = null; // [{documentID, name, active}] — null = chưa biết (hiện tất cả)

  FS_TIPS.install();

  function reload() {
    var cfg = store.load();
    draft = JSON.parse(JSON.stringify(cfg.projects));
    removed = new Set();
    relinks = [];
    dirty = false;
    render();
  }

  function msg(text, kind) {
    var m = $('msg');
    m.textContent = text || '';
    m.title = text || '';
    m.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function basename(p) { var s = String(p).replace(/\/$/, ''); return s.slice(s.lastIndexOf('/') + 1); }

  function setAllCollapsed(entries, value) {
    entries.forEach(function (e) { if (T.children(entries, e.id).length) collapsed[e.id] = value; });
  }

  function labelSelect(entries, e) {
    var s = el('select', 'lsel');
    s.setAttribute('data-tip', 'label');
    var none = el('option', '', 'None'); none.value = '-1'; s.appendChild(none);
    C.LABELS.forEach(function (name, i) {
      var op = el('option', '', '■ ' + name);
      op.value = String(i);
      op.style.color = C.LABEL_COLORS[i];
      s.appendChild(op);
    });
    s.value = String(e.label === undefined ? -1 : e.label);
    s.style.color = e.label >= 0 ? C.LABEL_COLORS[e.label] : '';
    s.addEventListener('change', function () {
      T.setSetting(entries, e.id, 'label', Number(s.value));
      dirty = true; render();
    });
    return s;
  }

  function row(docId, entries, e, depth) {
    var r = el('div', 'trow');
    var st = states[e.id] || 'unknown';

    var c0 = el('div', 'cell-c');
    var dot = el('div', 'sdot ' + st);
    dot.setAttribute('data-tip', 'state');
    c0.appendChild(dot);

    var c1 = el('div', 'name');
    c1.style.paddingLeft = (8 + depth * 16) + 'px';
    var kids = T.children(entries, e.id);
    var fold = el('button', 'fold' + (kids.length ? '' : ' none') + (collapsed[e.id] ? ' closed' : ''));
    fold.type = 'button';
    fold.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    fold.addEventListener('click', function (ev) {
      var v = !collapsed[e.id];
      if (ev.altKey) setAllCollapsed(entries, v); else collapsed[e.id] = v;
      render();
    });
    var nm = el('span', '', basename(e.path));
    nm.setAttribute('data-tip', 'name');
    c1.appendChild(fold); c1.appendChild(nm);

    var c2 = el('div');
    var p = el('div', 'path' + (st === 'offline' ? ' offline' : '') + (e._changed ? ' changed' : ''));
    var inner = el('span', 'ltr', e.path);
    p.appendChild(inner);
    p.title = e.path;
    p.setAttribute('data-tip', 'path');
    p.addEventListener('click', function () {
      var picked = FS.pickFolders(false, 'Chọn lại folder cho "' + basename(e.path) + '"', e.path.replace(/\/[^/]*$/, ''));
      if (!picked.length) { if (!FS.isCEP) msg('Xem trước: không mở được hộp chọn folder', 'err'); return; }
      var r2 = T.relink(entries, e.id, picked[0]);
      e._changed = true;
      relinks.push({ docId: docId, oldRoot: r2.oldRoot, newRoot: r2.newRoot });
      states[e.id] = 'unknown';
      T.descendants(entries, e.id).forEach(function (d) { states[d.id] = 'unknown'; });
      dirty = true;
      msg('Đã đổi đường dẫn — bấm OK để lưu và nối lại clip offline', 'ok');
      render();
    });
    c2.appendChild(p);

    var c3 = el('div', 'cell-c');
    var cb = el('input', 'cb');
    cb.type = 'checkbox';
    cb.checked = !!e.sub;
    cb.setAttribute('data-tip', 'sub');
    cb.addEventListener('change', function () { T.setSetting(entries, e.id, 'sub', cb.checked); dirty = true; render(); });
    c3.appendChild(cb);

    var c4 = el('div');
    c4.appendChild(labelSelect(entries, e));

    var c5 = el('div', 'cell-c');
    var x = el('button', 'xbtn');
    x.type = 'button';
    x.setAttribute('data-tip', 'remove');
    x.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    x.addEventListener('click', function () {
      removed.add(e.id);
      T.descendants(entries, e.id).forEach(function (d) { removed.add(d.id); });
      draft[docId].entries = T.remove(entries, e.id);
      dirty = true; render();
    });
    c5.appendChild(x);

    [c0, c1, c2, c3, c4, c5].forEach(function (c) { r.appendChild(c); });
    return r;
  }

  function render() {
    var box = $('rows');
    box.innerHTML = '';
    // Chỉ hiện project đang mở trong Premiere, project đang làm việc xếp đầu.
    var docIds;
    if (openProjects) {
      docIds = openProjects.slice().sort(function (a, c) { return (c.active ? 1 : 0) - (a.active ? 1 : 0); })
        .map(function (p) { return keyFor(p); })
        .filter(function (k) { return k && draft[k] && draft[k].entries.length; });
    } else {
      docIds = Object.keys(draft).filter(function (k) { return draft[k].entries.length; });
    }
    if (!docIds.length) {
      var em = el('div', 'empty');
      em.innerHTML = 'Chưa có folder nào được theo dõi.<br>Kéo folder từ Finder thả vào đây, hoặc bấm <b>Thêm folder</b>.<br>' +
        'Project đã có sẵn cây bin? Chọn bin ở Project panel rồi bấm <b>Liên kết bin đang chọn</b>.';
      box.appendChild(em);
      return;
    }
    docIds.forEach(function (docId) {
      var proj = draft[docId];
      var g = el('div', 'pgroup');
      g.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
      var openInfo = openProjects && openProjects.filter(function (p) { return keyFor(p) === docId; })[0];
      var b = el('b', '', (openInfo && openInfo.name) || proj.name || basename(proj.path || docId));
      g.appendChild(b);
      if (openInfo && openInfo.active && openProjects.length > 1) g.appendChild(el('span', 'mnote', '· đang làm việc'));
      box.appendChild(g);
      var entries = proj.entries;
      (function walk(parentId, depth) {
        entries.filter(function (e) { return e.parentId === parentId; })
          .sort(function (a, c) { return basename(a.path).localeCompare(basename(c.path), 'vi', { numeric: true }); })
          .forEach(function (e) {
            box.appendChild(row(docId, entries, e, depth));
            if (!collapsed[e.id]) walk(e.id, depth + 1);
          });
      })(null, 0);
    });
  }

  // ---------------------------------------------------------------- thêm folder
  function addPaths(paths) {
    if (!paths.length) return;
    FS.command('selectedBin', {}, 8000).then(function (sb) {
      if (!draft[sb.docId]) draft[sb.docId] = { path: sb.projectPath || '', name: sb.projectName || '', entries: [] };
      paths.forEach(function (p) { T.addRoot(draft[sb.docId].entries, { path: p, parentBinNodeId: sb.nodeId }); });
      dirty = true;
      msg('Đã thêm ' + paths.length + ' folder → bin "' + (sb.name || 'gốc project') + '". Bấm OK để import.', 'ok');
      render();
    }, function (e) { msg(e.message, 'err'); });
  }

  $('b-add').addEventListener('click', function () {
    var picked = FS.pickFolders(true, 'Chọn folder để theo dõi');
    if (!picked.length && !FS.isCEP) { msg('Xem trước: không mở được hộp chọn folder', 'err'); return; }
    addPaths(picked);
  });

  // ---------------------------------------------------------------- liên kết bin
  function save() {
    store.update(function (cfg) {
      Object.keys(draft).forEach(function (docId) {
        var fresh = cfg.projects[docId] ? cfg.projects[docId].entries : [];
        var merged = M.mergeDraft(fresh, draft[docId].entries, removed)
          .map(function (e) { var c = Object.assign({}, e); delete c._changed; return c; });
        if (!cfg.projects[docId]) cfg.projects[docId] = { path: draft[docId].path, name: draft[docId].name, entries: [] };
        cfg.projects[docId].entries = merged;
      });
      // project bị xoá hết entry trong bản nháp
      Object.keys(cfg.projects).forEach(function (k) {
        if (draft[k] && !draft[k].entries.length) cfg.projects[k].entries = [];
      });
    });
    dirty = false;
    removed = new Set();
  }

  function link(folder) {
    msg('Đang liên kết…');
    FS.command('link', folder ? { folder: folder } : {}).then(function (r) {
      if (r && r.status === 'need-folder') {
        msg('Bin "' + r.binName + '" chưa có file nào — hãy chọn folder tương ứng', 'err');
        var picked = FS.pickFolders(false, 'Folder tương ứng với bin "' + r.binName + '"');
        if (picked.length) link(picked[0]);
        return;
      }
      if (r && r.status === 'missing-folder') { msg('Không tìm thấy folder ' + r.folder, 'err'); return; }
      if (r && r.status === 'ok') {
        reload();
        msg('Đã liên kết ' + r.linked + ' bin với ' + r.folder + (r.unmatched ? ' (' + r.unmatched + ' bin không có folder tương ứng)' : ''), 'ok');
      }
    }, function (e) { msg(e.message, 'err'); });
  }

  $('b-link').addEventListener('click', function () {
    if (dirty) { save(); FS.send(C.EVENTS.CONFIG_CHANGED, { what: 'entries' }); }
    link(null);
  });

  // ---------------------------------------------------------------- OK / Huỷ
  $('b-ok').addEventListener('click', function () {
    if (dirty) {
      save();
      FS.send(C.EVENTS.CONFIG_CHANGED, { what: 'entries' });
      var byDoc = {};
      relinks.forEach(function (r) { (byDoc[r.docId] = byDoc[r.docId] || []).push({ oldRoot: r.oldRoot, newRoot: r.newRoot }); });
      Object.keys(byDoc).forEach(function (docId) { FS.send(C.EVENTS.COMMAND, { cmd: 'afterRelink', docId: docId, pairs: byDoc[docId] }); });
    }
    FS.closeSelf();
  });
  $('b-cancel').addEventListener('click', function () { FS.closeSelf(); });

  // Panel chính đóng → cửa sổ này đóng theo (thay đổi chưa bấm OK bị bỏ, như bấm Huỷ).
  FS.followParent(); // đóng theo panel chính

  // ---------------------------------------------------------------- trạng thái từ engine
  FS.on(C.EVENTS.STATUS, function (st) {
    var changed = false;
    Object.keys(st.projects || {}).forEach(function (k) {
      var s = st.projects[k].state || {};
      Object.keys(s).forEach(function (id) { if (states[id] !== s[id]) { states[id] = s[id]; changed = true; } });
    });
    if (changed) render();
  });

  // ---------------------------------------------------------------- kéo-thả folder
  var depthDrag = 0;
  var root = $('mgr');
  root.addEventListener('dragenter', function (e) { e.preventDefault(); depthDrag++; $('drop').classList.add('show'); });
  root.addEventListener('dragover', function (e) { e.preventDefault(); });
  root.addEventListener('dragleave', function () { depthDrag = Math.max(0, depthDrag - 1); if (!depthDrag) $('drop').classList.remove('show'); });
  root.addEventListener('drop', function (e) {
    e.preventDefault();
    depthDrag = 0;
    $('drop').classList.remove('show');
    var files = e.dataTransfer.files || [];
    var paths = [];
    for (var i = 0; i < files.length; i++) {
      var p = files[i].path;
      try { if (p && require('fs').statSync(p).isDirectory()) paths.push(p); } catch (err) { /* bỏ qua */ }
    }
    if (paths.length) addPaths(paths); else msg('Chỉ nhận folder', 'err');
  });

  // Khoá trong config của một project đang mở: theo documentID, không có thì theo đường dẫn .prproj.
  function keyFor(p) {
    if (draft[p.documentID]) return p.documentID;
    var want = String(p.path || '').toLowerCase();
    var ks = Object.keys(draft);
    for (var i = 0; i < ks.length; i++) {
      if (want && String(draft[ks[i]].path || '').toLowerCase() === want) return ks[i];
    }
    return p.documentID;
  }

  function loadOpenProjects() {
    FS.command('projects', {}, 6000).then(function (list) {
      if (Array.isArray(list)) { openProjects = list; render(); }
    }, function () { /* engine chưa sẵn sàng → hiện tất cả */ });
  }

  reload();
  loadOpenProjects();
  // Cửa sổ có thể được giữ lại giữa các lần mở → mỗi lần quay lại thì nạp dữ liệu mới
  // (folder vừa thả vào panel, bin engine vừa tạo), trừ khi đang có thay đổi chưa lưu.
  function refreshIfClean() { if (!dirty) reload(); loadOpenProjects(); }
  window.addEventListener('focus', refreshIfClean);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshIfClean(); });
  FS.send(C.EVENTS.COMMAND, { cmd: 'status' });
})();
