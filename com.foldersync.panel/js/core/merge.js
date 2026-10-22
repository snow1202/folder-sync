// Folder Sync — gộp bản nháp của cửa sổ quản lý vào config mới nhất khi bấm OK.
//
// Trong lúc cửa sổ mở, engine vẫn chạy và có thể đã ghi binNodeId hoặc tự thêm
// entry cho thư mục con mới. Quy tắc:
//   - Setting/đường dẫn/cấu trúc: bản nháp thắng.
//   - Folder gốc thêm từ nơi khác (panel, Liên kết bin) trong lúc cửa sổ mở → giữ.
//   - binNodeId bản nháp còn trống → lấy của engine.
//   - Entry engine tự thêm (không có trong bản nháp, user chưa ✕) → giữ, nếu cha còn;
//     cha đã đổi đường dẫn trong bản nháp → đổi đường dẫn entry theo.
const path = require('path');
const { relativeTo, pathkey } = require('./pathkey.js');

function mergeDraft(freshEntries, draftEntries, removedIds) {
  const fresh = new Map(freshEntries.map((e) => [e.id, e]));
  const out = draftEntries.map((d) => {
    const f = fresh.get(d.id);
    const e = Object.assign({}, d);
    // _rebound: user vừa nối lại bin cho entry này trong bản nháp → không lấy bin cũ của engine.
    if (f && !d._rebound) {
      if (!e.binNodeId && f.binNodeId) e.binNodeId = f.binNodeId;
      if (!e.parentBinNodeId && f.parentBinNodeId) e.parentBinNodeId = f.parentBinNodeId;
    }
    return e;
  });
  const have = new Map(out.map((e) => [e.id, e]));
  // Folder gốc được thêm từ nơi khác (thả vào panel, Liên kết bin…) trong lúc cửa sổ mở.
  const rootKeys = new Set(out.filter((e) => !e.parentId).map((e) => pathkey(e.path)));
  for (const f of freshEntries) {
    if (f.parentId || have.has(f.id) || removedIds.has(f.id) || rootKeys.has(pathkey(f.path))) continue;
    const e = Object.assign({}, f);
    out.push(e);
    have.set(e.id, e);
    rootKeys.add(pathkey(e.path));
  }
  let added = true;
  while (added) {
    added = false;
    for (const f of freshEntries) {
      if (have.has(f.id) || removedIds.has(f.id) || !f.parentId) continue;
      const parentNow = have.get(f.parentId);
      if (!parentNow) continue;
      const parentFresh = fresh.get(f.parentId);
      const e = Object.assign({}, f);
      if (parentFresh && parentFresh.path !== parentNow.path) {
        const rel = relativeTo(f.path, parentFresh.path);
        if (rel !== null) e.path = path.join(parentNow.path, rel);
      }
      out.push(e);
      have.set(e.id, e);
      added = true;
    }
  }
  return out;
}

module.exports = { mergeDraft };
