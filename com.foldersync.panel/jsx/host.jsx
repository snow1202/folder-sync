// Folder Sync — ExtendScript (ES3). Lớp DUY NHẤT chạm vào project Premiere.
//
// Quy ước gọi: mỗi hàm FS_* nhận 1 chuỗi JSON là MẢNG tham số (do bridge.js tạo)
// và trả về 1 chuỗi JSON. Lỗi → {"error": "..."}.
// Lưu ý ES3: không dùng từ khoá dành riêng làm tên biến (short, class, int, long,
// char, byte, float, double, const, enum, goto, package, private, public, static…).

var FS_BIN = 2;
var FS_ROOT = 3;

// ---------------------------------------------------------------- JSON tối giản

function FS_parse(s) {
  // Chuỗi do chính bridge.js tạo bằng JSON.stringify → an toàn để eval.
  return eval('(' + s + ')');
}

function FS_quote(s) {
  var out = '"';
  var str = String(s);
  for (var i = 0; i < str.length; i++) {
    var ch = str.charAt(i);
    var code = str.charCodeAt(i);
    if (ch === '"') { out += '\\"'; }
    else if (ch === '\\') { out += '\\\\'; }
    else if (ch === '\n') { out += '\\n'; }
    else if (ch === '\r') { out += '\\r'; }
    else if (ch === '\t') { out += '\\t'; }
    else if (code < 32) { out += '\\u' + ('0000' + code.toString(16)).slice(-4); }
    else { out += ch; }
  }
  return out + '"';
}

function FS_stringify(v) {
  if (v === null || v === undefined) { return 'null'; }
  var t = typeof v;
  if (t === 'string') { return FS_quote(v); }
  if (t === 'number') { return isFinite(v) ? String(v) : 'null'; }
  if (t === 'boolean') { return v ? 'true' : 'false'; }
  var parts = [];
  if (v instanceof Array) {
    for (var i = 0; i < v.length; i++) { parts.push(FS_stringify(v[i])); }
    return '[' + parts.join(',') + ']';
  }
  for (var k in v) {
    if (v.hasOwnProperty(k)) { parts.push(FS_quote(k) + ':' + FS_stringify(v[k])); }
  }
  return '{' + parts.join(',') + '}';
}

function FS_wrap(fn, argsJson) {
  try {
    return FS_stringify(fn(FS_parse(argsJson || '[]')));
  } catch (e) {
    return FS_stringify({ error: String(e && e.message ? e.message : e) });
  }
}

// ---------------------------------------------------------------- tiện ích DOM

function FS_projectById(docId) {
  var list = app.projects;
  for (var i = 0; i < list.numProjects; i++) {
    var p = list[i];
    if (p && String(p.documentID) === String(docId)) { return p; }
  }
  throw new Error('Không tìm thấy project ' + docId);
}

function FS_isBin(item) {
  try { return item.type === FS_BIN || item.type === FS_ROOT; } catch (e) { return false; }
}

function FS_mediaPath(item) {
  try {
    if (FS_isBin(item)) { return ''; }
    var mp = item.getMediaPath();
    return mp ? String(mp) : '';
  } catch (e) { return ''; }
}

// Duyệt cây; fn(item, parent) trả true để dừng.
function FS_walk(item, fn, parent) {
  if (fn(item, parent)) { return true; }
  if (!FS_isBin(item)) { return false; }
  var kids = item.children;
  if (!kids) { return false; }
  for (var i = 0; i < kids.numItems; i++) {
    if (FS_walk(kids[i], fn, item)) { return true; }
  }
  return false;
}

function FS_findNode(project, nodeId) {
  if (!nodeId) { return null; }
  var found = null;
  FS_walk(project.rootItem, function (it) {
    try { if (String(it.nodeId) === String(nodeId)) { found = it; return true; } } catch (e) {}
    return false;
  });
  return found;
}

function FS_childBinByName(parent, name) {
  var kids = parent.children;
  var want = String(name).toLowerCase();
  for (var i = 0; i < kids.numItems; i++) {
    var k = kids[i];
    if (FS_isBin(k) && String(k.name).toLowerCase() === want) { return k; }
  }
  return null;
}

function FS_label(item, label) {
  if (label === null || label === undefined || label < 0) { return; }
  try { item.setColorLabel(label); } catch (e) {}
}

// ---------------------------------------------------------------- hàm công khai

// → [{documentID, path, name, active}]
function FS_listProjects(argsJson) {
  return FS_wrap(function () {
    var out = [];
    var activeId = '';
    try { activeId = String(app.project.documentID); } catch (e) {}
    var list = app.projects;
    for (var i = 0; i < list.numProjects; i++) {
      var p = list[i];
      out.push({ documentID: String(p.documentID), path: String(p.path), name: String(p.name),
        active: String(p.documentID) === activeId });
    }
    return out;
  }, argsJson);
}

// [docId] → [mediaPath] mọi media trong project (kể cả offline).
function FS_listMediaPaths(argsJson) {
  return FS_wrap(function (a) {
    var project = FS_projectById(a[0]);
    var out = [];
    FS_walk(project.rootItem, function (it) {
      var mp = FS_mediaPath(it);
      if (mp) { out.push(mp); }
      return false;
    });
    return out;
  }, argsJson);
}

// [docId] → {nodeId, name} bin đang chọn ở Project panel (chọn clip → gốc; không chọn → gốc).
function FS_getSelectedBin(argsJson) {
  return FS_wrap(function (a) {
    var project = FS_projectById(a[0]);
    var root = project.rootItem;
    var sel = null;
    try {
      if (typeof app.getCurrentProjectViewSelection === 'function') { sel = app.getCurrentProjectViewSelection(); }
    } catch (e) { sel = null; }
    if (sel && sel.length) {
      for (var i = 0; i < sel.length; i++) {
        if (FS_isBin(sel[i])) { return { nodeId: String(sel[i].nodeId), name: String(sel[i].name) }; }
      }
    }
    return { nodeId: String(root.nodeId), name: '' };
  }, argsJson);
}

// [docId, items] items theo thứ tự cha trước con:
//   {key, parentKey|null, parentNodeId|null, name, nodeId|null, label}
// → {key: nodeId}. Tìm theo nodeId; mất → tìm bin cùng tên trong cha → tạo mới.
function FS_ensureBins(argsJson) {
  return FS_wrap(function (a) {
    var project = FS_projectById(a[0]);
    var items = a[1];
    var result = {};
    var made = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var bin = it.nodeId ? FS_findNode(project, it.nodeId) : null;
      if (bin && !FS_isBin(bin)) { bin = null; }
      if (!bin) {
        var parent = null;
        if (it.parentKey && made[it.parentKey]) { parent = made[it.parentKey]; }
        if (!parent && it.parentNodeId) { parent = FS_findNode(project, it.parentNodeId); }
        if (!parent || !FS_isBin(parent)) { parent = project.rootItem; }
        bin = FS_childBinByName(parent, it.name);
        if (!bin) {
          bin = parent.createBin(it.name);
          if (!bin) { bin = FS_childBinByName(parent, it.name); }
          if (!bin) { throw new Error('Không tạo được bin ' + it.name); }
          FS_label(bin, it.label);
        }
      }
      made[it.key] = bin;
      result[it.key] = String(bin.nodeId);
    }
    return result;
  }, argsJson);
}

// [docId, binNodeId, paths, label] → {items: [{nodeId, path}]} item MỚI trong bin sau import.
// JS so đường dẫn (chuẩn hoá NFC) để biết file nào đã vào, file nào bị từ chối.
function FS_importBatch(argsJson) {
  return FS_wrap(function (a) {
    var project = FS_projectById(a[0]);
    var bin = FS_findNode(project, a[1]);
    if (!bin || !FS_isBin(bin)) { throw new Error('Mất bin đích ' + a[1]); }
    var before = {};
    var kids = bin.children;
    for (var i = 0; i < kids.numItems; i++) { before[String(kids[i].nodeId)] = true; }
    project.importFiles(a[2], true, bin, false);
    var out = [];
    kids = bin.children;
    for (var j = 0; j < kids.numItems; j++) {
      var k = kids[j];
      if (before[String(k.nodeId)]) { continue; }
      FS_label(k, a[3]);
      out.push({ nodeId: String(k.nodeId), path: FS_mediaPath(k) });
    }
    if (a[3] !== null && a[3] !== undefined && a[3] >= 0) { FS_label(bin, a[3]); }
    return { items: out };
  }, argsJson);
}

// [docId, nodeId] → {exists, name}
function FS_findItem(argsJson) {
  return FS_wrap(function (a) {
    var it = FS_findNode(FS_projectById(a[0]), a[1]);
    return it ? { exists: true, name: String(it.name), isBin: FS_isBin(it) } : { exists: false };
  }, argsJson);
}

// [docId, nodeId] → cây bin {nodeId, name, children, sample} (sample = 1 media path trong bin).
function FS_describeBins(argsJson) {
  return FS_wrap(function (a) {
    var project = FS_projectById(a[0]);
    var start = a[1] ? FS_findNode(project, a[1]) : project.rootItem;
    if (!start || !FS_isBin(start)) { throw new Error('Không phải bin'); }
    function desc(bin) {
      var node = { nodeId: String(bin.nodeId), name: String(bin.name), children: [], sample: null };
      var kids = bin.children;
      for (var i = 0; i < kids.numItems; i++) {
        var k = kids[i];
        if (FS_isBin(k)) { node.children.push(desc(k)); }
        else if (!node.sample) {
          var mp = FS_mediaPath(k);
          if (mp) { node.sample = mp; }
        }
      }
      return node;
    }
    return desc(start);
  }, argsJson);
}

// [docId, oldRoot, newRoot] → {relinked, skipped}
// Chỉ nối lại item ĐANG OFFLINE có file tương ứng dưới newRoot (sau khi relink folder).
function FS_relinkMedia(argsJson) {
  return FS_wrap(function (a) {
    var project = FS_projectById(a[0]);
    var oldRoot = String(a[1]);
    var newRoot = String(a[2]);
    var oldLow = oldRoot.toLowerCase() + '/';
    var relinked = 0;
    var skipped = 0;
    FS_walk(project.rootItem, function (it) {
      var mp = FS_mediaPath(it);
      if (!mp || mp.toLowerCase().indexOf(oldLow) !== 0) { return false; }
      var offline = false;
      try { offline = it.isOffline(); } catch (e) { offline = false; }
      if (!offline) { skipped++; return false; }
      var cand = newRoot + mp.substring(oldRoot.length);
      var ok = false;
      try {
        if (new File(cand).exists && it.canChangeMediaPath()) { ok = it.changeMediaPath(cand, true); }
      } catch (e2) { ok = false; }
      if (ok) { relinked++; } else { skipped++; }
      return false;
    });
    return { relinked: relinked, skipped: skipped };
  }, argsJson);
}

// [message] → thông báo trong Events panel của Premiere.
function FS_notify(argsJson) {
  return FS_wrap(function (a) {
    try { app.setSDKEventMessage(String(a[0]), 'info'); } catch (e) {}
    return true;
  }, argsJson);
}

function FS_ping(argsJson) {
  return FS_wrap(function () { return 'pong'; }, argsJson);
}
