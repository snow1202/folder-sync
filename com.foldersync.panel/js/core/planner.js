// Folder Sync — lập kế hoạch cho một lượt sync (thuần dữ liệu, không chạm Premiere).
const path = require('path');
const T = require('./tree.js');
const { pathkey } = require('./pathkey.js');

// Thêm entry con cho thư mục mới phát hiện trong scan.
// Chỉ thêm khi entry cha có sub=true và thư mục không nằm trong excluded của gốc.
// Trả các entry vừa thêm (theo thứ tự cha trước con).
function applyNewDirs(entries, dirs) {
  const known = new Set(entries.map((e) => pathkey(e.path)));
  const sorted = dirs.slice().sort((a, b) => a.split(path.sep).length - b.split(path.sep).length || a.localeCompare(b));
  const added = [];
  for (const d of sorted) {
    if (known.has(pathkey(d))) continue;
    const parent = T.entryForPath(entries, d);
    if (!parent) continue;
    // Thư mục mới phải là con TRỰC TIẾP của parent (thư mục trung gian thiếu entry → bỏ).
    if (pathkey(path.dirname(d)) !== pathkey(parent.path)) continue;
    if (!parent.sub) continue;
    const root = T.rootOf(entries, parent);
    if (T.isExcluded(root, d)) continue;
    const e = T.addChild(entries, parent, d);
    known.add(pathkey(d));
    added.push(e);
  }
  return added;
}

// files: [{path, size, mtimeMs}] đã qua stability. index: Set<pathkey> media trong project.
// rejected: Map<pathkey, mtimeMs> file Premiere từng từ chối (thử lại khi mtime đổi).
function planImports(entries, files, index, rejected) {
  const out = [];
  for (const f of files) {
    const k = pathkey(f.path);
    if (index.has(k)) continue;
    if (rejected && rejected.has(k) && rejected.get(k) === f.mtimeMs) continue;
    const e = T.entryForPath(entries, f.path);
    if (!e) continue;
    out.push({ entryId: e.id, path: f.path, mtimeMs: f.mtimeMs });
  }
  return out;
}

function groupByEntry(imports) {
  const m = new Map();
  for (const it of imports) {
    if (!m.has(it.entryId)) m.set(it.entryId, []);
    m.get(it.entryId).push(it.path);
  }
  return m;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

module.exports = { applyNewDirs, planImports, groupByEntry, chunk };
