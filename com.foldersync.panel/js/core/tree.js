// Folder Sync — mô hình cây watch-entry.
//
// Mỗi thư mục được theo dõi là một entry (một dòng trong cửa sổ quản lý).
// Entry gốc có parentId = null; entry con thừa hưởng sub/label của cha khi tạo,
// và bị ghi đè khi user đổi setting ở cha (giống Watchtower 1.6).
const path = require('path');
const { pathkey, isUnder, relativeTo } = require('./pathkey.js');

let counter = 0;
function newId() {
  counter += 1;
  return 'e' + Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 6);
}

function byId(entries, id) {
  return entries.find((x) => x.id === id) || null;
}

function addRoot(entries, opts) {
  const key = pathkey(opts.path);
  const existing = entries.find((x) => x.parentId === null && pathkey(x.path) === key);
  if (existing) return existing;
  const e = {
    id: newId(),
    parentId: null,
    path: opts.path,
    sub: opts.sub !== undefined ? !!opts.sub : true,
    label: opts.label !== undefined ? opts.label : -1,
    binNodeId: opts.binNodeId || null,
    parentBinNodeId: opts.parentBinNodeId || null,
    excluded: [],
  };
  entries.push(e);
  return e;
}

function addChild(entries, parent, absPath, extra) {
  const key = pathkey(absPath);
  const existing = entries.find((x) => pathkey(x.path) === key);
  if (existing) return existing;
  const e = Object.assign({
    id: newId(),
    parentId: parent.id,
    path: absPath,
    sub: parent.sub,
    label: parent.label,
    binNodeId: null,
    parentBinNodeId: null,
  }, extra || {});
  entries.push(e);
  return e;
}

function children(entries, id) {
  return entries.filter((x) => x.parentId === id);
}

function descendants(entries, id) {
  const out = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    for (const c of children(entries, cur)) {
      out.push(c);
      stack.push(c.id);
    }
  }
  return out;
}

function rootOf(entries, entry) {
  let cur = entry;
  while (cur && cur.parentId) cur = byId(entries, cur.parentId);
  return cur;
}

function setSetting(entries, id, key, value) {
  const e = byId(entries, id);
  if (!e) return;
  e[key] = value;
  for (const d of descendants(entries, id)) d[key] = value;
}

function remove(entries, id) {
  const e = byId(entries, id);
  if (!e) return entries;
  const gone = new Set([id].concat(descendants(entries, id).map((x) => x.id)));
  if (e.parentId) {
    const root = rootOf(entries, e);
    const rel = relativeTo(e.path, root.path);
    if (rel && !root.excluded.some((x) => pathkey(x) === pathkey(rel))) root.excluded.push(rel);
  }
  return entries.filter((x) => !gone.has(x.id));
}

function isExcluded(root, absPath) {
  for (const rel of root.excluded || []) {
    const abs = path.join(root.path, rel);
    if (pathkey(abs) === pathkey(absPath) || isUnder(absPath, abs)) return true;
  }
  return false;
}

function relink(entries, id, newPath) {
  const e = byId(entries, id);
  const oldRoot = e.path;
  for (const d of descendants(entries, id)) {
    d.path = path.join(newPath, relativeTo(d.path, oldRoot));
  }
  e.path = newPath;
  return { oldRoot, newRoot: newPath };
}

function entryForPath(entries, absPath) {
  let best = null;
  for (const e of entries) {
    if (isUnder(absPath, e.path) || pathkey(absPath) === pathkey(e.path)) {
      if (!best || e.path.length > best.path.length) best = e;
    }
  }
  return best;
}

// Tên folder trùng tên bin đang chọn (không phân biệt hoa thường, chuẩn hoá Unicode).
function sameBinName(a, b) {
  const n = (s) => String(s || '').normalize('NFC').trim().toLowerCase();
  return !!n(a) && n(a) === n(b);
}

// Bin cho folder gốc mới thêm. sel = bin đang chọn {nodeId, name}.
// Folder trùng tên bin đang chọn → dùng luôn bin đó (đồng bộ vào bin có sẵn, không tạo bin con cùng tên);
// ngược lại → tạo bin mới bên trong bin đang chọn.
function rootTarget(absPath, sel) {
  const name = path.basename(String(absPath).replace(/\/+$/, ''));
  if (sel && sel.nodeId && sameBinName(name, sel.name)) return { binNodeId: String(sel.nodeId), parentBinNodeId: null, linked: true };
  return { binNodeId: null, parentBinNodeId: (sel && sel.nodeId) ? String(sel.nodeId) : null, linked: false };
}

module.exports = {
  newId, byId, addRoot, addChild, children, descendants, rootOf,
  setSetting, remove, isExcluded, relink, entryForPath, sameBinName, rootTarget,
};
