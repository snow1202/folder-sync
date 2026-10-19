const test = require('node:test');
const assert = require('node:assert');
const { parseMount, modeFor } = require('../com.foldersync.panel/js/core/watchmode.js');
const D = require('../com.foldersync.panel/js/core/drive.js');

const MOUNT = [
  '/dev/disk3s1s1 on / (apfs, sealed, local, read-only, journaled)',
  '/dev/disk4s1 on /Volumes/SSD Team (exfat, local, nodev, nosuid, noowners)',
  '//u@nas/share on /Volumes/share (smbfs, nodev, nosuid, mounted by u)',
  '/dev/disk5s1 on /Volumes/Fast (apfs, local, journaled)',
].join('\n');

test('parseMount đọc đúng mount point có dấu cách và fstype', () => {
  const m = parseMount(MOUNT);
  assert.deepEqual(m.find((x) => x.mountPoint === '/Volumes/SSD Team'), { mountPoint: '/Volumes/SSD Team', fstype: 'exfat' });
  assert.equal(m.find((x) => x.mountPoint === '/Volumes/share').fstype, 'smbfs');
});

test('modeFor: Drive/mạng/ExFAT → poll, ổ thường → watch', () => {
  const m = parseMount(MOUNT);
  const home = '/Users/u';
  assert.equal(modeFor('/Users/u/Library/CloudStorage/GoogleDrive-a@b.com/My Drive/X', m, home), 'poll');
  assert.equal(modeFor('/Users/u/Google Drive/My Drive/X', m, home), 'poll');
  assert.equal(modeFor('/Volumes/GoogleDrive/Shared drives/X', m, home), 'poll');
  assert.equal(modeFor('/Volumes/SSD Team/Footage', m, home), 'poll');
  assert.equal(modeFor('/Volumes/share/x', m, home), 'poll');
  assert.equal(modeFor('/Volumes/Fast/x', m, home), 'watch');
  assert.equal(modeFor('/Users/u/Movies/x', m, home), 'watch');
  // đường dẫn Drive của máy/tài khoản KHÁC (project mở từ máy đồng nghiệp) vẫn là Drive
  assert.equal(modeFor('/Users/dongnghiep/Library/CloudStorage/GoogleDrive-x@y.com/Shared drives/A', m, home), 'poll');
  assert.equal(modeFor('/Users/khac/Google Drive/My Drive/A', m, home), 'poll');
});

test('splitDrivePath nhận 3 kiểu tiền tố + bản Việt hoá', () => {
  assert.deepEqual(D.splitDrivePath('/Users/a/Library/CloudStorage/GoogleDrive-x@y.com/Shared drives/SAMX/Sources'),
    { prefix: '/Users/a/Library/CloudStorage/GoogleDrive-x@y.com', rest: 'Shared drives/SAMX/Sources' });
  assert.equal(D.splitDrivePath('/Users/a/Google Drive/My Drive/A').rest, 'My Drive/A');
  assert.equal(D.splitDrivePath('/Volumes/GoogleDrive/Shared drives/B').rest, 'Shared drives/B');
  assert.equal(D.splitDrivePath('/Users/a/Library/CloudStorage/GoogleDrive-x@y.com/Drive của tôi/C').rest, 'Drive của tôi/C');
  assert.equal(D.splitDrivePath('/Users/a/Movies/X'), null);
});

function deps(existing, accounts) {
  return {
    home: '/Users/me',
    listDriveRoots: async () => accounts.map((a) => '/Users/me/Library/CloudStorage/GoogleDrive-' + a),
    exists: async (p) => existing.includes(p),
  };
}

test('autoRelink: đúng 1 ứng viên → ok', async () => {
  const want = '/Users/me/Library/CloudStorage/GoogleDrive-me@c.com/Shared drives/SAMX';
  const r = await D.autoRelink('/Users/other/Library/CloudStorage/GoogleDrive-other@c.com/Shared drives/SAMX',
    deps([want], ['me@c.com', 'me2@c.com']));
  assert.deepEqual(r, { status: 'ok', newPath: want });
});

test('autoRelink: nhiều ứng viên → ambiguous, không có → none, không phải Drive → not-drive', async () => {
  const a = '/Users/me/Library/CloudStorage/GoogleDrive-a/My Drive/X';
  const b = '/Users/me/Library/CloudStorage/GoogleDrive-b/My Drive/X';
  assert.equal((await D.autoRelink('/Users/o/Google Drive/My Drive/X', deps([a, b], ['a', 'b']))).status, 'ambiguous');
  assert.equal((await D.autoRelink('/Users/o/Google Drive/My Drive/Y', deps([a], ['a']))).status, 'none');
  assert.equal((await D.autoRelink('/Users/o/Movies/X', deps([], ['a']))).status, 'not-drive');
});

test('autoRelink: đường dẫn gốc đã đúng máy này thì không coi là ứng viên mới', async () => {
  const p = '/Users/me/Library/CloudStorage/GoogleDrive-a/My Drive/X';
  assert.equal((await D.autoRelink(p, deps([], ['a']))).status, 'none');
});
