const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHistory, MAX_PER_PROJECT } = require('../com.foldersync.panel/js/core/history.js');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'fs-hist-')); }
const item = (docId, i) => ({ at: 1000 + i, docId, path: '/x/f' + i + '.mov', name: 'f' + i + '.mov', nodeId: 'n' + i, bin: 'SFX' });

test('chưa có file → rỗng; thêm rồi đọc lại theo project, mới nhất trước', () => {
  const h = createHistory(tmp());
  assert.deepEqual(h.list('d1'), []);
  h.add([item('d1', 1), item('d1', 2), item('d2', 3)]);
  assert.deepEqual(h.list('d1').map((x) => x.name), ['f2.mov', 'f1.mov']);
  assert.deepEqual(h.list('d2').map((x) => x.name), ['f3.mov']);
});

test('giữ tối đa 200 dòng mỗi project, bỏ dòng cũ nhất', () => {
  const h = createHistory(tmp());
  h.add(Array.from({ length: MAX_PER_PROJECT + 30 }, (_, i) => item('d1', i)));
  h.add([item('d2', 9999)]);
  const l = h.list('d1');
  assert.equal(MAX_PER_PROJECT, 200);
  assert.equal(l.length, 200);
  assert.equal(l[0].name, 'f229.mov');
  assert.equal(l[199].name, 'f30.mov');
  assert.equal(h.list('d2').length, 1);
});

test('lưu xuống đĩa (2 instance đọc được của nhau), file hỏng → rỗng, xoá theo project', () => {
  const dir = tmp();
  createHistory(dir).add([item('d1', 1)]);
  assert.equal(createHistory(dir).list('d1').length, 1);
  createHistory(dir).clear('d1');
  assert.equal(createHistory(dir).list('d1').length, 0);
  fs.writeFileSync(path.join(dir, 'history.json'), '{hỏng');
  assert.deepEqual(createHistory(dir).list('d1'), []);
});

test('đổi khoá project (documentID mới) → chuyển lịch sử sang khoá mới', () => {
  const h = createHistory(tmp());
  h.add([item('old', 1)]);
  h.rekey('old', 'new');
  assert.equal(h.list('new').length, 1);
  assert.equal(h.list('old').length, 0);
});
