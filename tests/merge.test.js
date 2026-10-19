const test = require('node:test');
const assert = require('node:assert');
const { mergeDraft } = require('../com.foldersync.panel/js/core/merge.js');

const E = (id, parentId, p, extra) => Object.assign({ id, parentId, path: p, sub: true, label: -1, binNodeId: null }, extra || {});

test('bản nháp thắng về setting/đường dẫn; nhận binNodeId engine vừa ghi', () => {
  const fresh = [E('r', null, '/a', { binNodeId: '10' }), E('c', 'r', '/a/b', { binNodeId: '11' })];
  const draft = [E('r', null, '/a', { label: 6 }), E('c', 'r', '/a/b', { label: 6 })];
  const out = mergeDraft(fresh, draft, new Set());
  assert.deepEqual(out.map((e) => [e.id, e.label, e.binNodeId]), [['r', 6, '10'], ['c', 6, '11']]);
});

test('entry engine vừa tự thêm (thư mục con mới) được giữ, entry user đã ✕ thì không', () => {
  const fresh = [E('r', null, '/a'), E('c', 'r', '/a/b'), E('n', 'r', '/a/new'), E('x', 'c', '/a/b/x')];
  const draft = [E('r', null, '/a')];
  const out = mergeDraft(fresh, draft, new Set(['c', 'x']));
  assert.deepEqual(out.map((e) => e.id), ['r', 'n']);
});

test('entry mới của engine dưới cha đã relink trong bản nháp → đổi đường dẫn theo', () => {
  const fresh = [E('r', null, '/old/A'), E('n', 'r', '/old/A/New')];
  const draft = [E('r', null, '/new/A')];
  const out = mergeDraft(fresh, draft, new Set());
  assert.equal(out.find((e) => e.id === 'n').path, '/new/A/New');
});

test('entry mới của engine mà cha không còn → bỏ', () => {
  const fresh = [E('r', null, '/a'), E('n', 'r', '/a/new')];
  const out = mergeDraft(fresh, [], new Set(['r']));
  assert.deepEqual(out, []);
});
