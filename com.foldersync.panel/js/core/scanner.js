// Folder Sync — duyệt một watch-folder thành danh sách thư mục + file hợp lệ.
const fs = require('fs');
const path = require('path');
const { isTempFile } = require('./filters.js');

// opts: { sub, isIgnoredFolder(name), isAllowed(name), isExcludedDir(abs) }
// Trả { dirs: [abs] (gồm root), files: [{path, size, mtimeMs}], errors: [{path, message}] }.
// Root không đọc được → ném lỗi (engine coi là offline). Thư mục con lỗi → ghi errors, bỏ qua.
async function scan(root, opts) {
  const o = Object.assign({ sub: true, isIgnoredFolder: () => false, isAllowed: () => true, isExcludedDir: () => false }, opts);
  const dirs = [];
  const files = [];
  const errors = [];
  const seen = new Set();

  async function walk(dir, depth) {
    let real;
    try { real = await fs.promises.realpath(dir); } catch (e) { real = dir; }
    if (seen.has(real)) return; // symlink vòng
    seen.add(real);

    let list;
    try {
      list = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      if (depth === 0) throw e;
      errors.push({ path: dir, message: e.message });
      return;
    }
    dirs.push(dir);

    for (const d of list) {
      const name = d.name;
      const abs = path.join(dir, name);
      let isDir = d.isDirectory();
      let isFile = d.isFile();
      if (d.isSymbolicLink()) {
        try {
          const st = await fs.promises.stat(abs);
          isDir = st.isDirectory();
          isFile = st.isFile();
        } catch (e) { continue; }
      }
      if (isDir) {
        if (!o.sub) continue;
        if (name.startsWith('.') || o.isIgnoredFolder(name) || o.isExcludedDir(abs)) continue;
        await walk(abs, depth + 1);
      } else if (isFile) {
        if (isTempFile(name) || !o.isAllowed(name)) continue;
        try {
          const st = await fs.promises.stat(abs);
          files.push({ path: abs, size: st.size, mtimeMs: st.mtimeMs });
        } catch (e) { /* file vừa biến mất */ }
      }
    }
  }

  await walk(root, 0);
  return { dirs, files, errors };
}

module.exports = { scan };
