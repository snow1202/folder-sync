const test = require('node:test');
const assert = require('node:assert');
const T = require('../com.foldersync.panel/js/core/tree.js');
const P = require('../com.foldersync.panel/js/core/planner.js');
const { summary } = require('../com.foldersync.panel/js/core/notify.js');
const { pathkey } = require('../com.foldersync.panel/js/core/pathkey.js');

test('applyNewDirs: thêm entry cho thư mục mới, theo tầng, chỉ dưới cha sub=true, bỏ excluded', () => {
  const e = [];
  const root = T.addRoot(e, { path: '/d/A' });
  const off = T.addChild(e, root, '/d/A/Off');
  off.sub = false;
  root.excluded.push('Gone');
  const added = P.applyNewDirs(e, ['/d/A', '/d/A/New/Deep', '/d/A/New', '/d/A/Off/X', '/d/A/Gone']);
  assert.deepEqual(added.map((x) => x.path), ['/d/A/New', '/d/A/New/Deep']);
  const deep = e.find((x) => x.path === '/d/A/New/Deep');
  assert.equal(T.byId(e, deep.parentId).path, '/d/A/New');
});

test('planImports: bỏ file đã có trong project (khác hoa/thường + NFC) và file bị từ chối cùng mtime', () => {
  const e = [];
  const root = T.addRoot(e, { path: '/d/A' });
  const day = T.addChild(e, root, '/d/A/Day 01');
  const files = [
    { path: '/d/A/x.mov', size: 1, mtimeMs: 1 },
    { path: '/d/A/Day 01/Bé.mov', size: 1, mtimeMs: 1 },
    { path: '/d/A/Day 01/bad.mov', size: 1, mtimeMs: 5 },
    { path: '/d/A/Day 01/bad2.mov', size: 1, mtimeMs: 7 },
  ];
  const index = new Set([pathkey('/D/a/day 01/bé.MOV')]);
  const rejected = new Map([[pathkey('/d/A/Day 01/bad.mov'), 5], [pathkey('/d/A/Day 01/bad2.mov'), 6]]);
  const r = P.planImports(e, files, index, rejected);
  assert.deepEqual(r.map((x) => [x.entryId, x.path]), [
    [root.id, '/d/A/x.mov'],
    [day.id, '/d/A/Day 01/bad2.mov'],
  ]);
});

test('groupByEntry + chunk', () => {
  const g = P.groupByEntry([{ entryId: 'a', path: '1' }, { entryId: 'b', path: '2' }, { entryId: 'a', path: '3' }]);
  assert.deepEqual([...g.entries()], [['a', ['1', '3']], ['b', ['2']]]);
  const arr = Array.from({ length: 120 }, (_, i) => i);
  assert.deepEqual(P.chunk(arr, 50).map((c) => c.length), [50, 50, 20]);
});

test('notify.summary', () => {
  assert.equal(summary({ files: 3, folders: 1, binNames: ['SFX', 'Footage'] }), '3 file, 1 thư mục con đã thêm vào: SFX, Footage');
  assert.equal(summary({ files: 2, folders: 0, binNames: ['SFX'] }), '2 file đã thêm vào: SFX');
  assert.equal(summary({ files: 0, folders: 2, binNames: ['A'] }), '2 thư mục con đã thêm vào: A');
  assert.equal(summary({ files: 0, folders: 0, binNames: [] }), 'Không có file mới');
  const many = summary({ files: 9, folders: 0, binNames: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  assert.equal(many, '9 file đã thêm vào: a, b, c, d, e … và 2 bin khác');
});
