// Folder Sync — tự relink đường dẫn Google Drive.
//
// Mỗi máy/tài khoản có gốc Drive khác nhau:
//   /Users/<u>/Library/CloudStorage/GoogleDrive-<account>/…   (Drive for desktop hiện tại)
//   /Users/<u>/Google Drive/…                                  (mount cũ — có thể treo khi stat!)
//   /Volumes/GoogleDrive/…                                     (bản rất cũ)
// Phần phía sau (My Drive/…, Shared drives/…) thì giống nhau giữa các máy.
// Khi một folder offline, ghép phần sau vào các gốc Drive của máy hiện tại; đúng 1 chỗ
// tồn tại → relink. Mọi kiểm tra tồn tại do caller cung cấp (async, có timeout).
const fs = require('fs');
const path = require('path');
const { pathkey } = require('./pathkey.js');

const SECTIONS = ['My Drive', 'Shared drives', 'Other computers', 'Drive của tôi', 'Bộ nhớ dùng chung', 'Máy tính khác'];

function splitDrivePath(absPath) {
  const p = String(absPath || '').normalize('NFC');
  const patterns = [
    /^(\/Users\/[^/]+\/Library\/CloudStorage\/GoogleDrive-[^/]+)\/(.+)$/,
    /^(\/Users\/[^/]+\/Google Drive)\/(.+)$/,
    /^(\/Volumes\/GoogleDrive[^/]*)\/(.+)$/,
  ];
  for (const re of patterns) {
    const m = p.match(re);
    if (!m) continue;
    const rest = m[2];
    if (SECTIONS.some((s) => rest === s || rest.startsWith(s + '/'))) return { prefix: m[1], rest };
  }
  return null;
}

async function defaultListDriveRoots(home) {
  const base = path.join(home, 'Library', 'CloudStorage');
  try {
    const names = await fs.promises.readdir(base);
    return names.filter((n) => n.startsWith('GoogleDrive-')).map((n) => path.join(base, n));
  } catch (e) {
    return [];
  }
}

// deps: { home, listDriveRoots?: async () => [abs], exists: async (p) => bool }
async function autoRelink(absPath, deps) {
  const split = splitDrivePath(absPath);
  if (!split) return { status: 'not-drive' };
  const roots = deps.listDriveRoots ? await deps.listDriveRoots() : await defaultListDriveRoots(deps.home);
  const found = [];
  for (const r of roots) {
    const cand = path.join(r, split.rest);
    if (pathkey(cand) === pathkey(absPath)) continue; // chính nó — đã offline
    if (await deps.exists(cand)) found.push(cand);
  }
  if (found.length === 1) return { status: 'ok', newPath: found[0] };
  return { status: found.length ? 'ambiguous' : 'none' };
}

module.exports = { splitDrivePath, autoRelink, defaultListDriveRoots };
