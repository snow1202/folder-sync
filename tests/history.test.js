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

test('mỗi file chỉ 1 dòng: import lại cùng đường dẫn → giữ lần mới nhất, bỏ dòng cũ', () => {
  const h = createHistory(tmp());
  h.add([{ at: 1, docId: 'd1', path: '/x/A.mov', name: 'A.mov', nodeId: 'n1', bin: 'S' }]);
  h.add([{ at: 2, docId: 'd1', path: '/x/B.mov', name: 'B.mov', nodeId: 'n2', bin: 'S' }]);
  h.add([{ at: 3, docId: 'd1', path: '/X/a.mov', name: 'a.mov', nodeId: 'n9', bin: 'S2' }]); // cùng file (khác hoa/thường)
  assert.deepEqual(h.list('d1').map((x) => [x.name, x.at, x.nodeId]), [['a.mov', 3, 'n9'], ['B.mov', 2, 'n2']]);
});

test('lịch sử cũ đã có dòng trùng → list() tự gộp, giữ lần mới nhất', () => {
  const dir = tmp();
  const it = (at) => ({ at, docId: 'd1', path: '/x/1.1.mp4', name: '1.1.mp4', nodeId: 'n' + at, bin: 'B' });
  require('fs').writeFileSync(require('path').join(dir, 'history.json'), JSON.stringify({ d1: [it(30), it(20), it(10)] }));
  const h = createHistory(dir);
  assert.deepEqual(h.list('d1').map((x) => x.at), [30]);
  h.add([{ at: 40, docId: 'd1', path: '/x/2.mp4', name: '2.mp4', nodeId: 'z', bin: 'B' }]);
  assert.deepEqual(h.list('d1').map((x) => x.at), [40, 30]);
});
