// Folder Sync — kiểm tra & sửa danh sách trong cửa sổ Settings (thuần dữ liệu).

const BLOCKED_EXT = ['prproj', 'aep', 'prin', 'prel'];

function isRegex(s) {
  const t = String(s || '').trim();
  return t.length > 2 && t.startsWith('/') && t.endsWith('/');
}

function addExt(list, input) {
  const v = String(input || '').trim().replace(/^\.+/, '').toLowerCase();
  if (!v) return { ok: false, error: 'Nhập đuôi file, ví dụ: mov' };
  if (!/^[a-z0-9]+$/.test(v)) return { ok: false, error: 'Đuôi file chỉ gồm chữ và số (vd. mov, r3d)' };
  if (BLOCKED_EXT.includes(v)) return { ok: false, error: 'Không nên import file project (.' + v + ') — sẽ tự import chính project' };
  if (list.includes(v)) return { ok: false, error: '.' + v + ' đã có trong danh sách' };
  return { ok: true, list: list.concat([v]).sort(), value: v };
}

function addIgnored(list, input) {
  const v = String(input || '').trim();
  if (!v) return { ok: false, error: 'Nhập tên folder, hoặc /regex/' };
  if (isRegex(v)) {
    try { new RegExp(v.slice(1, -1), 'i'); } catch (e) { return { ok: false, error: 'Regex không hợp lệ: ' + e.message }; }
  }
  const key = v.normalize('NFC').toLowerCase();
  if (list.some((x) => String(x).normalize('NFC').toLowerCase() === key)) return { ok: false, error: '"' + v + '" đã có trong danh sách' };
  return { ok: true, list: list.concat([v]), value: v };
}

function remove(list, value) {
  return list.filter((x) => x !== value);
}

function filter(list, q) {
  const k = String(q || '').trim().toLowerCase();
  return k ? list.filter((x) => String(x).toLowerCase().includes(k)) : list.slice();
}

module.exports = { addExt, addIgnored, remove, filter, isRegex };
