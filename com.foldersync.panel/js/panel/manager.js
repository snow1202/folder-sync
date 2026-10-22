// Folder Sync — cửa sổ quản lý watch-folder (bản nháp, chỉ lưu khi OK).
/* global FS, FS_TIPS, FS_ASK */
(function () {
  var C = FS.load('js/core/constants.js');
  var T = FS.load('js/core/tree.js');
  var M = FS.load('js/core/merge.js');
  var DD = FS.load('js/panel/draft-diff.js');
  var store = FS.load('js/core/config.js').createStore();
  var $ = function (id) { return document.getElementById(id); };

  var draft;          // { docId: {path, name, entries} }
  var removed;        // Set id bị xoá thật (lúc lưu) — cho mergeDraft
  var marked;         // Set id đã bấm ✕: dòng còn hiện mờ, ↺ để lấy lại; chỉ xoá thật khi OK
  var base;           // bản đã lưu lúc nạp — để liệt kê thay đổi chưa lưu
  var relinks;        // [{docId, oldRoot, newRoot}]
  var dirty = false;  // = còn thay đổi chưa lưu (tính lại mỗi lần render)
  var pending = [];   // danh sách thay đổi chưa lưu (draft-diff)
  var picked = null;  // dòng đang chọn {docId, id} — dùng cho "Liên kết bin đang chọn"
  var collapsed = {}; // id → true
  var states = {};    // id → 'ok'|'offline'|'busy'|'error'
  var openProjects = null; // [{documentID, name, active}] — null = chưa biết (hiện tất cả)

  FS_TIPS.install();

  function reload() {
    var cfg = store.load();
    draft = JSON.parse(JSON.stringify(cfg.projects));
    base = JSON.parse(JSON.stringify(cfg.projects));
    removed = new Set();
    marked = new Set();
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

  function isGone(entries, e) {
    for (var x = e; x; x = x.parentId ? T.byId(entries, x.parentId) : null) if (marked.has(x.id)) return true;
    return false;
  }

  function row(docId, entries, e, depth) {
    var gone = isGone(entries, e);
    var isPicked = !!(picked && picked.docId === docId && picked.id === e.id);
    var r = el('div', 'trow' + (gone ? ' gone' : '') + (isPicked ? ' picked' : ''));
    var st = states[e.id] || 'unknown';
    // Bấm vào dòng (ngoài các nút / ô chọn / đường dẫn) để chọn dòng đó — rồi bấm "Liên kết bin đang chọn".
    if (!gone) {
      r.addEventListener('click', function (ev) {
        if (ev.target.closest && ev.target.closest('button,input,select,.path')) return;
        picked = isPicked ? null : { docId: docId, id: e.id };
        msg(picked ? 'Đã chọn "' + basename(e.path) + '" — chọn bin ở Project panel rồi bấm Liên kết bin đang chọn' : '');
        render();
      });
    }

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
    if (e._binName) { var lk = el('span', 'lkbin', '→ bin "' + e._binName + '"'); lk.setAttribute('data-tip', 'linkedBin'); nm.appendChild(lk); }
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
    if (marked.has(e.id)) {
      // đã ✕ (chưa lưu) → nút ↺ lấy lại
      x.className = 'xbtn undo';
      x.setAttribute('data-tip', 'undoRemove');
      x.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
      x.addEventListener('click', function () { marked.delete(e.id); render(); });
      c5.appendChild(x);
    } else if (!gone) {
      x.setAttribute('data-tip', 'remove');
      x.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      x.addEventListener('click', function () {
        // con đã ✕ riêng trước đó → gộp vào lần ✕ cha
        T.descendants(entries, e.id).forEach(function (d) { marked.delete(d.id); });
        marked.add(e.id);
        render();
      });
      c5.appendChild(x);
    }
    if (gone) { cb.disabled = true; c4.firstChild.disabled = true; }

    [c0, c1, c2, c3, c4, c5].forEach(function (c) { r.appendChild(c); });
    return r;
  }

  function render() {
    renderUnsaved();
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
  // sub: true/false theo ô tick (nút Thêm folder); undefined → hỏi bằng hộp thoại (kéo-thả).
  function addPaths(paths, sub) {
    if (!paths.length) return;
    FS.command('selectedBin', {}, 8000).then(function (sb) {
      var proj = String(sb.projectName || '').replace(/\.prproj$/i, '');
      var linked = paths.filter(function (p) { return T.rootTarget(p, sb).linked; }).length;
      var where = (proj ? proj + ' › ' : '') + (sb.name || 'gốc project') + (linked ? ' (bin có sẵn cùng tên — đồng bộ thẳng vào bin này)' : '');
      var ask = sub === undefined ? FS_ASK.sub(paths, where) : Promise.resolve(sub);
      return ask.then(function (withSub) {
        if (withSub === null) return;
        if (!draft[sb.docId]) draft[sb.docId] = { path: sb.projectPath || '', name: sb.projectName || '', entries: [] };
        paths.forEach(function (p) { T.addRoot(draft[sb.docId].entries, Object.assign({ path: p, sub: withSub }, T.rootTarget(p, sb))); });
        dirty = true;
        msg('Đã thêm ' + paths.length + ' folder' + (withSub ? ' (kèm sub-folder)' : ' (không kèm sub-folder)') +
          (linked ? ' → đồng bộ thẳng vào bin "' + sb.name + '" có sẵn' : ' → bin "' + (sb.name || 'gốc project') + '"') + '. Bấm OK để import.', 'ok');
        render();
      });
    }).catch(function (e) { msg(e.message, 'err'); });
  }

  // Ô "Kèm sub-folder" cạnh nút Thêm folder — nhớ lựa chọn lần trước trên máy này.
  try { var rem = localStorage.getItem('fs.addSub'); if (rem !== null) $('add-sub').checked = rem === '1'; } catch (e) { /* bỏ qua */ }
  $('add-sub').addEventListener('change', function () {
    try { localStorage.setItem('fs.addSub', this.checked ? '1' : '0'); } catch (e) { /* bỏ qua */ }
  });

  $('b-add').addEventListener('click', function () {
    var picked = FS.pickFolders(true, 'Chọn folder để theo dõi');
    if (!picked.length && !FS.isCEP) { msg('Xem trước: không mở được hộp chọn folder', 'err'); return; }
    addPaths(picked, $('add-sub').checked);
  });

  // ---------------------------------------------------------------- liên kết bin
  // ---------------------------------------------------------------- thay đổi chưa lưu
  function renderUnsaved() {
    pending = DD.changes(base, draft, marked, relinks);
    dirty = pending.length > 0;
    $('unsaved').style.display = dirty ? '' : 'none';
    var t = '⚠ Chưa lưu: ' + DD.summary(pending);
    $('unsaved-txt').textContent = t;
    $('unsaved').title = pending.map(function (c) { return DD.line(c, C.LABELS); }).join('\n') + '\n— bấm OK để lưu';
  }

  $('b-revert').addEventListener('click', function () {
    reload();
    msg('Đã bỏ mọi thay đổi chưa lưu', 'ok');
  });

  // Dòng đã ✕ → xoá thật khỏi bản nháp (ngay trước khi lưu).
  function applyMarks() {
    Object.keys(draft).forEach(function (docId) {
      var entries = draft[docId].entries;
      marked.forEach(function (id) {
        var e = T.byId(entries, id);
        if (!e) return;
        removed.add(id);
        T.descendants(entries, id).forEach(function (d) { removed.add(d.id); });
        entries = T.remove(entries, id);
      });
      draft[docId].entries = entries;
    });
    marked = new Set();
  }

  function save() {
    applyMarks();
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
    base = JSON.parse(JSON.stringify(store.load().projects));
    relinks = [];
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

  // Có dòng đang chọn → nối folder của dòng đó với bin đang chọn ở Project panel (chỉ trong bản nháp, lưu khi OK).
  function linkPicked() {
    FS.command('selectedBin', {}, 8000).then(function (sb) {
      if (!picked) return;
      if (keyFor({ documentID: sb.docId, path: sb.projectPath }) !== picked.docId) { msg('Bin đang chọn thuộc project khác — chọn bin trong đúng project của dòng này', 'err'); return; }
      if (!sb.name) { msg('Hãy chọn một bin ở Project panel (không phải gốc project)', 'err'); return; }
      var entries = draft[picked.docId].entries, e = T.byId(entries, picked.id);
      if (!e) { picked = null; render(); return; }
      e.binNodeId = String(sb.nodeId); e._rebound = true; e._binName = sb.name;
      if (!e.parentId) e.parentBinNodeId = null;
      // Folder con: bỏ bin cũ, engine tìm / tạo bin cùng tên bên trong bin mới.
      T.descendants(entries, e.id).forEach(function (d) { d.binNodeId = null; d.parentBinNodeId = null; d._rebound = true; delete d._binName; });
      msg('"' + basename(e.path) + '" sẽ đồng bộ thẳng vào bin "' + sb.name + '" — bấm OK để lưu', 'ok');
      picked = null;
      render();
    }).catch(function (err) { msg(err.message, 'err'); });
  }

  $('b-link').addEventListener('click', function () {
    if (picked) { linkPicked(); return; }
    if (dirty) { save(); FS.send(C.EVENTS.CONFIG_CHANGED, { what: 'entries' }); }
    link(null);
  });

  // ---------------------------------------------------------------- OK / Huỷ
  $('b-ok').addEventListener('click', function () {
    if (dirty) {
      var done = relinks.slice();
      save();
      FS.send(C.EVENTS.CONFIG_CHANGED, { what: 'entries' });
      var byDoc = {};
      done.forEach(function (r) { (byDoc[r.docId] = byDoc[r.docId] || []).push({ oldRoot: r.oldRoot, newRoot: r.newRoot }); });
      Object.keys(byDoc).forEach(function (docId) { FS.send(C.EVENTS.COMMAND, { cmd: 'afterRelink', docId: docId, pairs: byDoc[docId] }); });
    }
    FS.closeSelf();
  });
  // Huỷ: còn thay đổi chưa lưu thì liệt kê ra và hỏi Quay lại / Thoát.
  $('b-cancel').addEventListener('click', function () {
    renderUnsaved();
    if (!dirty) { FS.closeSelf(); return; }
    FS_ASK.discard(pending.map(function (c) { return DD.line(c, C.LABELS); })).then(function (exit) {
      if (exit) { reload(); FS.closeSelf(); }
    });
  });

  // Báo cho panel chính biết còn thay đổi chưa bấm OK (để cảnh báo khi kéo folder vào panel chính).
  var pubDirty = null, pubAt = 0;
  setInterval(function () {
    if (dirty === pubDirty && !(dirty && Date.now() - pubAt > 3000)) return;
    pubDirty = dirty; pubAt = Date.now();
    FS_ASK.setManagerDraft(dirty);
  }, 400);
  window.addEventListener('beforeunload', function () { FS_ASK.setManagerDraft(false); });
  window.addEventListener('pagehide', function () { FS_ASK.setManagerDraft(false); });

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
