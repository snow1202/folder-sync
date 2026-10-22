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

test('folder gốc thêm từ panel trong lúc cửa sổ quản lý đang mở → không bị mất khi lưu', () => {
  const fresh = [E('old', null, '/a'), E('v23', null, '/Drive/v23.x', { binNodeId: '9' })];
  const draft = [E('old', null, '/a', { label: 3 }), E('new6', null, '/Drive/New 6')];
  const out = mergeDraft(fresh, draft, new Set());
  assert.deepEqual(out.map((e) => e.id).sort(), ['new6', 'old', 'v23']);
});

test('folder gốc đã ✕ trong cửa sổ quản lý thì vẫn bị bỏ', () => {
  const fresh = [E('a', null, '/a'), E('b', null, '/b')];
  const out = mergeDraft(fresh, [E('a', null, '/a')], new Set(['b']));
  assert.deepEqual(out.map((e) => e.id), ['a']);
});

test('entry vừa nối lại bin trong bản nháp (_rebound) → không lấy lại bin cũ engine đã ghi', () => {
  const { mergeDraft } = require('../com.foldersync.panel/js/core/merge.js');
  const fresh = [{ id: 'r', parentId: null, path: '/d/v2', binNodeId: 'old', parentBinNodeId: 'p' }, { id: 'c', parentId: 'r', path: '/d/v2/A', binNodeId: 'oldA' }];
  const draft = [{ id: 'r', parentId: null, path: '/d/v2', binNodeId: 'new', parentBinNodeId: null, _rebound: true }, { id: 'c', parentId: 'r', path: '/d/v2/A', binNodeId: null, _rebound: true }];
  const out = mergeDraft(fresh, draft, new Set());
  assert.equal(out.find((e) => e.id === 'r').binNodeId, 'new');
  assert.equal(out.find((e) => e.id === 'r').parentBinNodeId, null);
  assert.equal(out.find((e) => e.id === 'c').binNodeId, null, 'bin con để engine tìm / tạo lại trong bin mới');
});
