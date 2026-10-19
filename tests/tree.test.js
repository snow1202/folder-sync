const test = require('node:test');
const assert = require('node:assert');
const T = require('../com.foldersync.panel/js/core/tree.js');

function build() {
  const e = [];
  const root = T.addRoot(e, { path: '/d/Assets' });
  const video = T.addChild(e, root, '/d/Assets/01_Video');
  const day = T.addChild(e, video, '/d/Assets/01_Video/Day 01');
  const audio = T.addChild(e, root, '/d/Assets/04_Audio');
  return { e, root, video, day, audio };
}

test('addRoot mặc định sub=true, label=-1; trùng đường dẫn (khác hoa/thường) trả entry cũ', () => {
  const e = [];
  const a = T.addRoot(e, { path: '/d/Assets' });
  assert.equal(a.sub, true);
  assert.equal(a.label, -1);
  assert.equal(a.parentId, null);
  const b = T.addRoot(e, { path: '/D/assets/' });
  assert.equal(a, b);
  assert.equal(e.length, 1);
});

test('addChild thừa hưởng sub + label của cha', () => {
  const e = [];
  const r = T.addRoot(e, { path: '/d/A', label: 5, sub: true });
  const c = T.addChild(e, r, '/d/A/B');
  assert.equal(c.parentId, r.id);
  assert.equal(c.label, 5);
});

test('setSetting ở cha lan xuống mọi con cháu; sau đó con vẫn sửa riêng được', () => {
  const { e, root, video, day, audio } = build();
  T.setSetting(e, root.id, 'label', 6);
  assert.deepEqual([root, video, day, audio].map((x) => x.label), [6, 6, 6, 6]);
  T.setSetting(e, video.id, 'label', 2);
  assert.deepEqual([root.label, video.label, day.label, audio.label], [6, 2, 2, 6]);
});

test('children / descendants / rootOf', () => {
  const { e, root, video, day, audio } = build();
  assert.deepEqual(T.children(e, root.id).map((x) => x.id), [video.id, audio.id]);
  assert.equal(T.descendants(e, root.id).length, 3);
  assert.equal(T.rootOf(e, day), root);
});

test('remove con → bỏ cả nhánh và ghi excluded ở gốc', () => {
  const { e, root, video } = build();
  const out = T.remove(e, video.id);
  assert.equal(out.length, 2);
  assert.deepEqual(root.excluded, ['01_Video']);
  assert.ok(T.isExcluded(root, '/d/Assets/01_Video/Day 01'));
  assert.ok(!T.isExcluded(root, '/d/Assets/04_Audio'));
});

test('remove gốc → bỏ toàn bộ, không còn gì', () => {
  const { e, root } = build();
  assert.equal(T.remove(e, root.id).length, 0);
});

test('relink gốc kéo theo mọi con cháu', () => {
  const { e, root, day } = build();
  const r = T.relink(e, root.id, '/new/Assets');
  assert.deepEqual(r, { oldRoot: '/d/Assets', newRoot: '/new/Assets' });
  assert.equal(day.path, '/new/Assets/01_Video/Day 01');
});

test('entryForPath chọn entry sâu nhất', () => {
  const { e, root, day, audio } = build();
  assert.equal(T.entryForPath(e, '/d/Assets/01_Video/Day 01/a.mov'), day);
  assert.equal(T.entryForPath(e, '/d/assets/04_audio/x.wav'), audio);
  assert.equal(T.entryForPath(e, '/d/Assets/x.mov'), root);
  assert.equal(T.entryForPath(e, '/other/x.mov'), null);
});
