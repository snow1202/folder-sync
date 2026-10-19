const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scan } = require('../com.foldersync.panel/js/core/scanner.js');
const { createStabilityTracker } = require('../com.foldersync.panel/js/core/stability.js');
const { compileIgnored, isAllowedFile } = require('../com.foldersync.panel/js/core/filters.js');

function mk(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (content !== undefined) fs.writeFileSync(p, content);
  return p;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-scan-'));
  mk(root, 'a.mov', 'x');
  mk(root, 'b.tmp', 'x');
  mk(root, 'p.prproj', 'x');
  mk(root, '.DS_Store', 'x');
  mk(root, 'Day 01/c.mov', 'xx');
  fs.mkdirSync(path.join(root, 'Empty'));
  mk(root, 'untitled folder/d.mov', 'x');
  mk(root, 'Skip/e.mov', 'x');
  return root;
}

const opts = (root, extra) => Object.assign({
  sub: true,
  isIgnoredFolder: compileIgnored(['untitled folder']),
  isAllowed: (n) => isAllowedFile(n, ['mov']),
  isExcludedDir: (abs) => abs === path.join(root, 'Skip'),
}, extra);

test('scan: lọc file tạm/đuôi lạ/folder bỏ qua, giữ thư mục rỗng', async () => {
  const root = fixture();
  const r = await scan(root, opts(root));
  const files = r.files.map((f) => path.relative(root, f.path)).sort();
  assert.deepEqual(files, ['Day 01/c.mov', 'a.mov']);
  const dirs = r.dirs.map((d) => path.relative(root, d)).sort();
  assert.deepEqual(dirs, ['', 'Day 01', 'Empty']);
  const c = r.files.find((f) => f.path.endsWith('c.mov'));
  assert.equal(c.size, 2);
  assert.ok(c.mtimeMs > 0);
});

test('scan: sub=false chỉ lấy cấp 1', async () => {
  const root = fixture();
  const r = await scan(root, opts(root, { sub: false }));
  assert.deepEqual(r.files.map((f) => path.basename(f.path)), ['a.mov']);
  assert.deepEqual(r.dirs, [root]);
});

test('scan: thư mục không tồn tại → ném lỗi (để engine đánh dấu offline)', async () => {
  await assert.rejects(scan('/khong/ton/tai/xyz', opts('/x')));
});

test('stability: cần 2 lần thấy giống nhau cách ≥ gap, size > 0, nhả đúng 1 lần', () => {
  const t = createStabilityTracker({ gapMs: 2000 });
  const f = { path: '/a/x.mov', size: 10, mtimeMs: 1 };
  assert.deepEqual(t.observe([f], 0), []);
  assert.deepEqual(t.observe([f], 1000), []);
  assert.deepEqual(t.observe([f], 2500).map((x) => x.path), ['/a/x.mov']);
  assert.deepEqual(t.observe([f], 5000), []);
});

test('stability: size đổi → đếm lại từ đầu; size 0 không bao giờ nhả', () => {
  const t = createStabilityTracker({ gapMs: 2000 });
  t.observe([{ path: '/a/y', size: 5, mtimeMs: 1 }], 0);
  assert.deepEqual(t.observe([{ path: '/a/y', size: 9, mtimeMs: 2 }], 3000), []);
  assert.equal(t.observe([{ path: '/a/y', size: 9, mtimeMs: 2 }], 6000).length, 1);
  const z = { path: '/a/z', size: 0, mtimeMs: 1 };
  t.observe([z], 0);
  assert.deepEqual(t.observe([z], 9000), []);
});

test('stability: forget cho phép nhả lại (vd. sau khi import bị huỷ)', () => {
  const t = createStabilityTracker({ gapMs: 0 });
  const f = { path: '/a/x', size: 1, mtimeMs: 1 };
  t.observe([f], 0);
  assert.equal(t.observe([f], 1).length, 1);
  t.forget('/a/x');
  t.observe([f], 2);
  assert.equal(t.observe([f], 3).length, 1);
});
