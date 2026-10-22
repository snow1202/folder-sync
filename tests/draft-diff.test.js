const test = require('node:test');
const assert = require('node:assert');
const { changes, summary, line } = require('../com.foldersync.panel/js/panel/draft-diff.js');

const E = (id, parentId, p, extra) => Object.assign({ id, parentId, path: '/d/' + p, sub: true, label: -1 }, extra);
function base() {
  return { d1: { entries: [E('r', null, 'AI'), E('c', 'r', 'AI/v1'), E('g', 'c', 'AI/v1/x'), E('o', null, 'Music', { sub: false })] } };
}
const clone = (o) => JSON.parse(JSON.stringify(o));

test('không đổi gì → rỗng', () => {
  assert.deepEqual(changes(base(), clone(base()), new Set(), []), []);
});

test('✕ một dòng có con → chỉ báo dòng đó', () => {
  const r = changes(base(), clone(base()), new Set(['r']), []);
  assert.deepEqual(r, [{ kind: 'remove', name: 'AI' }]);
  assert.equal(summary(r), 'xoá 1');
});

test('thêm folder mới (kèm con) → 1 dòng thêm; thêm rồi ✕ ngay → không còn gì', () => {
  const d = clone(base());
  d.d1.entries.push(E('n', null, 'B-roll'), E('n1', 'n', 'B-roll/a'));
  assert.deepEqual(changes(base(), d, new Set(), []), [{ kind: 'add', name: 'B-roll' }]);
  assert.deepEqual(changes(base(), d, new Set(['n']), []), []);
});

test('đổi SUB / label ở cha lan xuống con → chỉ báo ở cha; đổi riêng con thì báo con', () => {
  const d = clone(base());
  d.d1.entries.forEach((e) => { if (['r', 'c', 'g'].includes(e.id)) { e.sub = false; } });
  d.d1.entries.find((e) => e.id === 'g').label = 3;
  const r = changes(base(), d, new Set(), []);
  assert.deepEqual(r, [{ kind: 'sub', name: 'AI', on: false }, { kind: 'label', name: 'x', label: 3 }]);
  assert.equal(line(r[1], ['Violet', 'Iris', 'Caribbean', 'Lavender']), 'Label Lavender: x');
  assert.equal(summary(r), 'SUB 1 · label 1');
});

test('đổi đường dẫn → 1 dòng', () => {
  const r = changes(base(), clone(base()), new Set(), [{ docId: 'd1', oldRoot: '/a/Old', newRoot: '/b/New' }]);
  assert.deepEqual(r.map((c) => line(c)), ['Đổi đường dẫn: Old → New']);
});

test('nối lại bin cho một dòng → 1 dòng "Liên kết"', () => {
  const d = clone(base());
  Object.assign(d.d1.entries.find((e) => e.id === 'r'), { binNodeId: 'n9', _rebound: true, _binName: 'v2' });
  const r = changes(base(), d, new Set(), []);
  assert.deepEqual(r.map((c) => line(c)), ['Liên kết: AI → bin "v2"']);
  assert.equal(summary(r), 'liên kết bin 1');
});
