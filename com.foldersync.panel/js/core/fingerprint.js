// Folder Sync — "dấu vân tay" code của engine, để biết khi nào phải khởi động lại Premiere.
//
// Engine (extension ẩn) chỉ nạp code một lần khi Premiere mở. Sau khi cập nhật, nếu file
// mà engine dùng đã đổi trên ổ thì engine vẫn chạy code cũ cho tới khi khởi động lại
// Premiere. Engine tính dấu vân tay lúc khởi động và báo kèm trạng thái; panel tính lại
// từ ổ và so — lệch nhau thì hiện thông báo khởi động lại. Chỉ đổi giao diện panel thì
// không lệch (panel tự tải lại được).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Đường dẫn (tương đối trong bundle) mà engine dùng. Thư mục → mọi file bên trong.
const ENGINE_PATHS = ['CSXS/manifest.xml', 'engine.html', 'jsx', 'js/core', 'js/engine', 'js/panel/common.js', 'js/lib'];

function listFiles(root, rel) {
  const abs = path.join(root, rel);
  let st;
  try { st = fs.statSync(abs); } catch (e) { return []; }
  if (st.isFile()) return [rel];
  if (!st.isDirectory()) return [];
  const out = [];
  for (const name of fs.readdirSync(abs).sort()) {
    if (name.startsWith('.')) continue;
    out.push(...listFiles(root, rel + '/' + name));
  }
  return out;
}

function engineFingerprint(root) {
  const h = crypto.createHash('sha256');
  for (const p of ENGINE_PATHS) {
    for (const rel of listFiles(root, p)) {
      h.update(rel + '\0');
      try { h.update(fs.readFileSync(path.join(root, rel))); } catch (e) { h.update('missing'); }
      h.update('\0');
    }
  }
  return h.digest('hex').slice(0, 16);
}

// running: dấu vân tay engine báo lúc khởi động; onDisk: tính lại từ ổ bây giờ.
function needsRestart(running, onDisk) {
  return !!running && !!onDisk && running !== onDisk;
}

module.exports = { engineFingerprint, needsRestart, ENGINE_PATHS };
