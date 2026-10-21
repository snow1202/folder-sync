// Folder Sync — liệt kê thay đổi chưa lưu của Watch Folders (bản nháp so với bản đã lưu).
// Dùng cho dòng cảnh báo vàng cạnh nút Huỷ và hộp hỏi khi bấm Huỷ.
//
// base:    { docId: {entries} } — bản đã lưu lúc mở / lần nạp gần nhất
// draft:   { docId: {entries} } — bản đang sửa
// marked:  Set id đã bấm ✕ (chưa xoá thật; dòng vẫn hiện mờ để ↺ lấy lại được)
// relinks: [{docId, oldRoot, newRoot}]
// Trả về [{kind: 'remove'|'add'|'sub'|'label'|'relink', name, on?, label?}].
function basename(p) { const s = String(p).replace(/\/+$/, ''); return s.slice(s.lastIndexOf('/') + 1); }

function changes(base, draft, marked, relinks) {
  const out = [];
  const isMarked = (byId, e) => {
    for (let x = e; x; x = x.parentId ? byId.get(x.parentId) : null) if (marked.has(x.id)) return true;
    return false;
  };
  for (const docId of Object.keys(draft)) {
    const d = draft[docId].entries;
    const dById = new Map(d.map((e) => [e.id, e]));
    const bById = new Map(((base[docId] && base[docId].entries) || []).map((e) => [e.id, e]));
    for (const e of d) {
      const parent = e.parentId ? dById.get(e.parentId) : null;
      if (marked.has(e.id)) {
        // chỉ báo dòng trên cùng được ✕; dòng mới thêm rồi ✕ ngay thì coi như chưa có gì
        if (!(parent && isMarked(dById, parent)) && bById.has(e.id)) out.push({ kind: 'remove', name: basename(e.path) });
        continue;
      }
      if (isMarked(dById, e)) continue;
      const old = bById.get(e.id);
      if (!old) {
        if (!parent || bById.has(parent.id)) out.push({ kind: 'add', name: basename(e.path) });
        continue;
      }
      // SUB / label đổi ở cha thì lan xuống con → chỉ báo ở dòng cha
      const pOld = parent && bById.get(parent.id);
      const sameAsParent = (k) => parent && pOld && parent[k] !== pOld[k] && parent[k] === e[k];
      if (!!e.sub !== !!old.sub && !sameAsParent('sub')) out.push({ kind: 'sub', name: basename(e.path), on: !!e.sub });
      if ((e.label === undefined ? -1 : e.label) !== (old.label === undefined ? -1 : old.label) && !sameAsParent('label')) {
        out.push({ kind: 'label', name: basename(e.path), label: e.label });
      }
    }
  }
  for (const r of relinks || []) out.push({ kind: 'relink', name: basename(r.newRoot), from: basename(r.oldRoot) });
  return out;
}

const KIND_SHORT = { remove: 'xoá', add: 'thêm', sub: 'SUB', label: 'label', relink: 'đường dẫn' };

// "xoá 1 · thêm 2"
function summary(list) {
  const n = {};
  for (const c of list) n[c.kind] = (n[c.kind] || 0) + 1;
  return ['remove', 'add', 'sub', 'label', 'relink'].filter((k) => n[k]).map((k) => KIND_SHORT[k] + ' ' + n[k]).join(' · ');
}

// Một dòng gọn cho hộp hỏi. labelNames: tên label theo số (C.LABELS).
function line(c, labelNames) {
  switch (c.kind) {
    case 'remove': return 'Xoá: ' + c.name;
    case 'add': return 'Thêm: ' + c.name;
    case 'sub': return (c.on ? 'Bật' : 'Tắt') + ' SUB: ' + c.name;
    case 'label': return 'Label ' + (c.label >= 0 && labelNames ? labelNames[c.label] : 'None') + ': ' + c.name;
    case 'relink': return 'Đổi đường dẫn: ' + c.from + ' → ' + c.name;
    default: return c.name;
  }
}

module.exports = { changes, summary, line };
