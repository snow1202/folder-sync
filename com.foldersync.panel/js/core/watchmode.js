// Folder Sync — chọn cơ chế theo dõi cho từng folder.
//
// fs.watch (FSEvents) nhanh và rẻ nhưng hay trễ/mất sự kiện trên Google Drive,
// ổ mạng và ổ ExFAT → các folder đó được quét định kỳ thay vì chờ sự kiện.
const path = require('path');
const { pathkey, isUnder } = require('./pathkey.js');

const REMOTE_FS = new Set(['smbfs', 'afpfs', 'nfs', 'webdav', 'exfat', 'msdos', 'osxfuse', 'macfuse', 'dfsfuse_dfs', 'fuse']);

// Dòng mẫu: "/dev/disk4s1 on /Volumes/SSD Team (exfat, local, nodev)"
function parseMount(stdout) {
  const out = [];
  for (const line of String(stdout || '').split('\n')) {
    const m = line.match(/^.+? on (.+) \(([^,)]+)/);
    if (m) out.push({ mountPoint: m[1], fstype: m[2].trim().toLowerCase() });
  }
  return out;
}

function modeFor(absPath, mounts, home) {
  const remotePrefixes = [
    path.join(home, 'Library', 'CloudStorage'),
    path.join(home, 'Google Drive'),
    '/Volumes/GoogleDrive',
  ];
  for (const p of remotePrefixes) {
    if (isUnder(absPath, p) || pathkey(absPath) === pathkey(p)) return 'poll';
  }
  let best = null;
  for (const m of mounts || []) {
    if (m.mountPoint === '/') continue;
    if (isUnder(absPath, m.mountPoint) || pathkey(absPath) === pathkey(m.mountPoint)) {
      if (!best || m.mountPoint.length > best.mountPoint.length) best = m;
    }
  }
  if (best && (REMOTE_FS.has(best.fstype) || best.fstype.includes('fuse'))) return 'poll';
  return 'watch';
}

module.exports = { parseMount, modeFor };
