// Folder Sync — chuẩn hoá đường dẫn để so trùng.
//
// macOS/APFS không phân biệt hoa/thường, còn Google Drive hay trả tên tiếng Việt
// ở dạng NFD trong khi Premiere lưu NFC. Vì vậy mọi phép so đường dẫn đều đi qua
// pathkey(): normalize + bỏ "/" cuối + NFC + lowercase.
const path = require('path');

function clean(p) {
  let s = path.normalize(String(p || ''));
  if (s.length > 1 && s.endsWith(path.sep)) s = s.slice(0, -1);
  return s;
}

function pathkey(p) {
  return clean(p).normalize('NFC').toLowerCase();
}

// child nằm BÊN TRONG parent (không tính bằng nhau).
function isUnder(child, parent) {
  const c = pathkey(child);
  const p = pathkey(parent);
  return c.length > p.length && c.startsWith(p === path.sep ? p : p + path.sep);
}

// Đường dẫn tương đối của child so với parent, giữ nguyên chữ của child.
function relativeTo(child, parent) {
  const c = clean(child);
  if (pathkey(c) === pathkey(parent)) return '';
  if (!isUnder(c, parent)) return null;
  return c.slice(clean(parent).length + 1);
}

module.exports = { pathkey, isUnder, relativeTo, clean };
