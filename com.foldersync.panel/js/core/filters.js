// Folder Sync — bộ lọc: Allowed Files, Ignored Folders, file tạm.

function norm(s) {
  return String(s || '').normalize('NFC').toLowerCase().trim();
}

// list: tên folder (so bằng, không phân biệt hoa/thường) hoặc "/regex/" (cờ i).
// Regex viết sai thì bỏ qua mục đó thay vì làm hỏng cả bộ lọc.
function compileIgnored(list) {
  const names = new Set();
  const regs = [];
  for (const raw of list || []) {
    const item = String(raw || '').trim();
    if (!item) continue;
    if (item.length > 2 && item.startsWith('/') && item.endsWith('/')) {
      try { regs.push(new RegExp(item.slice(1, -1), 'i')); } catch (e) { /* regex hỏng */ }
    } else {
      names.add(norm(item));
    }
  }
  return function isIgnored(name) {
    const n = String(name || '').normalize('NFC');
    if (names.has(norm(n))) return true;
    for (const r of regs) if (r.test(n)) return true;
    return false;
  };
}

function extOf(name) {
  const s = String(name || '');
  const i = s.lastIndexOf('.');
  return i > 0 ? s.slice(i + 1).toLowerCase() : '';
}

function isAllowedFile(name, allowedExt) {
  const e = extOf(name);
  if (!e) return false;
  return (allowedExt || []).some((x) => String(x).replace(/^\./, '').toLowerCase() === e);
}

const TEMP_SUFFIX = /\.(tmp|part|crdownload|download|partial|downiepart)$/i;

// File tạm / file hệ thống của macOS, Google Drive, trình duyệt, Office.
function isTempFile(name) {
  const n = String(name || '');
  if (n === 'Icon\r' || n === 'Thumbs.db' || n === 'desktop.ini') return true;
  if (n.startsWith('.')) return true; // .DS_Store, ._x, .~lock…
  if (n.startsWith('~$')) return true;
  return TEMP_SUFFIX.test(n);
}

module.exports = { compileIgnored, isAllowedFile, isTempFile, extOf };
