const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPremiere } = require('./fake-premiere.js');
const { createEngine } = require('../com.foldersync.panel/js/engine/engine.js');
const { createStore } = require('../com.foldersync.panel/js/core/config.js');

function asyncHost(pp) {
  const h = (fn) => (...a) => Promise.resolve().then(() => pp.host(fn, ...a));
  return {
    listProjects: h('FS_listProjects'), listMediaPaths: h('FS_listMediaPaths'), getSelectedBin: h('FS_getSelectedBin'),
    ensureBins: h('FS_ensureBins'), importBatch: h('FS_importBatch'), findItem: h('FS_findItem'),
    describeBins: h('FS_describeBins'), relinkMedia: h('FS_relinkMedia'), notify: h('FS_notify'),
  };
}

function mk(root, rel, content = 'x') {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

function setup(extra) {
  const disk = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fs-eng-')));
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'fs-cfgd-')));
  const pp = createPremiere(extra && extra.pp);
  const pr = pp.addProject('d1', path.join(disk, 'Proj.prproj'));
  const engine = createEngine(Object.assign({ store, host: asyncHost(pp), quickGapMs: 5, stableGapMs: 0 }, extra && extra.engine));
  return { disk, store, pp, pr, engine };
}

function names(item) { return item._kids.map((k) => k.name).sort(); }
function find(item, name) { return item._kids.find((k) => k.name === name); }

test('thêm folder → tạo cây bin trong bin đang chọn + import đủ + thông báo', async () => {
  const { disk, pp, pr, engine } = setup();
  mk(disk, 'Assets/a.mov');
  mk(disk, 'Assets/Day 01/b.mov');
  mk(disk, 'Assets/Day 01/skip.prproj');
  fs.mkdirSync(path.join(disk, 'Assets/Empty'));
  const parent = pr.rootItem.createBin('Asset');
  const r = await engine.addFolders('d1', [path.join(disk, 'Assets')], parent.nodeId);
  assert.equal(r.files, 2);
  const assets = find(parent, 'Assets');
  assert.ok(assets, 'bin Assets nằm trong bin đang chọn');
  assert.deepEqual(names(assets), ['Day 01', 'Empty', 'a.mov']);
  assert.deepEqual(names(find(assets, 'Day 01')), ['b.mov']);
  assert.match(pp.events.at(-1).msg, /2 file, 2 thư mục con đã thêm vào/);
});

test('chạy lại không import trùng; file import tay cũng không bị trùng', async () => {
  const { disk, pp, pr, engine } = setup();
  mk(disk, 'A/a.mov');
  await engine.addFolders('d1', [path.join(disk, 'A')], null);
  const manual = mk(disk, 'A/manual.mov');
  pr.importFiles([manual], true, pr.rootItem); // user tự import, để ở gốc
  const r = await engine.syncAll();
  assert.equal(r.files, 0);
  assert.equal(pp.events.at(-1).msg, 'Folder Sync: Không có file mới');
});

test('tự động: file mới cần 2 lần quan sát; không có gì thì không thông báo', async () => {
  const { disk, pp, pr, engine, store } = setup();
  mk(disk, 'A/a.mov');
  await engine.addFolders('d1', [path.join(disk, 'A')], null);
  const before = pp.events.length;
  await engine.tick();
  assert.equal(pp.events.length, before);
  mk(disk, 'A/new.mov');
  engine.markDirty(path.join(disk, 'A'));
  await engine.tick();
  assert.equal(names(find(pr.rootItem, 'A')).includes('new.mov'), false);
  engine.markDirty(path.join(disk, 'A'));
  await engine.tick();
  assert.ok(names(find(pr.rootItem, 'A')).includes('new.mov'));
});

test('thư mục con mới khi SUB bật → bin mới; SUB tắt → không', async () => {
  const { disk, pr, engine, store } = setup();
  mk(disk, 'A/a.mov');
  await engine.addFolders('d1', [path.join(disk, 'A')], null);
  mk(disk, 'A/other_clips/v.mov');
  const r = await engine.syncAll();
  assert.equal(r.files, 1);
  assert.equal(r.folders, 1);
  assert.ok(find(find(pr.rootItem, 'A'), 'other_clips'));
  store.update((c) => { for (const e of Object.values(c.projects)[0].entries) e.sub = false; });
  mk(disk, 'A/third/x.mov');
  const r2 = await engine.syncAll();
  assert.equal(r2.folders, 0);
  assert.ok(!find(find(pr.rootItem, 'A'), 'third'));
});

test('120 file → chia đợt 50; huỷ sau đợt đầu → phần còn lại vào lượt sau', async () => {
  const { disk, pp, pr, engine } = setup();
  fs.mkdirSync(path.join(disk, 'Big'));
  await engine.addFolders('d1', [path.join(disk, 'Big')], null);
  for (let i = 0; i < 120; i++) mk(disk, 'Big/f' + String(i).padStart(3, '0') + '.png');
  const origImport = pr.importFiles;
  let calls = 0;
  pr.importFiles = function (...a) { calls += 1; if (calls === 1) engine.abort(); return origImport.apply(this, a); };
  const r = await engine.syncAll();
  assert.equal(r.files, 50);
  const r2 = await engine.syncAll();
  assert.equal(r2.files, 70);
  assert.equal(find(pr.rootItem, 'Big')._kids.length, 120);
  assert.equal(calls, 3);
});

test('bin bị xoá → lượt sau tạo lại; bin đổi tên/di chuyển → vẫn vào đúng bin', async () => {
  const { disk, pr, engine } = setup();
  mk(disk, 'A/Day 01/a.mov');
  await engine.addFolders('d1', [path.join(disk, 'A')], null);
  const a = find(pr.rootItem, 'A');
  const day = find(a, 'Day 01');
  // di chuyển Day 01 ra gốc + đổi tên
  a._kids.splice(a._kids.indexOf(day), 1);
  pr.rootItem._kids.push(day);
  day.name = 'Ngày 1';
  mk(disk, 'A/Day 01/b.mov');
  await engine.syncAll();
  assert.deepEqual(names(day), ['a.mov', 'b.mov']);
  // xoá bin A hoàn toàn (Day 01 đã ở ngoài) → thêm file ở A → A được tạo lại
  pr.rootItem._kids.splice(pr.rootItem._kids.indexOf(a), 1);
  mk(disk, 'A/c.mov');
  await engine.syncAll();
  assert.ok(find(find(pr.rootItem, 'A'), 'c.mov'));
});

test('file Premiere từ chối → không thử lại cho tới khi file đổi', async () => {
  const { disk, pr, engine } = setup();
  mk(disk, 'A/x.mov');
  await engine.addFolders('d1', [path.join(disk, 'A')], null);
  const origImport = pr.importFiles;
  let seen = 0;
  pr.importFiles = function (paths, ...rest) { seen += paths.length; return origImport.call(this, paths.filter((p) => !p.endsWith('bad.mov')), ...rest); };
  mk(disk, 'A/bad.mov');
  await engine.syncAll();
  await engine.syncAll();
  assert.equal(seen, 1);
  const p = path.join(disk, 'A/bad.mov');
  fs.writeFileSync(p, 'đã sửa');
  fs.utimesSync(p, new Date(), new Date(Date.now() + 5000));
  await engine.syncAll();
  assert.equal(seen, 2);
});

test('folder offline có đúng 1 ứng viên Google Drive → tự relink + nối media offline', async () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fs-home-')));
  const driveRoot = path.join(home, 'Library/CloudStorage/GoogleDrive-me@c.com');
  const newPath = path.join(driveRoot, 'Shared drives/SAMX/SFX');
  mk(newPath, 'boom.wav');
  const { pr, engine, store, pp } = setup({ engine: { home } });
  const oldPath = '/Users/other/Library/CloudStorage/GoogleDrive-o@c.com/Shared drives/SAMX/SFX';
  store.update((c) => {
    c.projects.d1 = { path: pr.path, name: 'Proj.prproj', entries: [{ id: 'r', parentId: null, path: oldPath, sub: true, label: -1, binNodeId: null, parentBinNodeId: null, excluded: [] }] };
  });
  pr.importFiles([oldPath + '/boom.wav'], true, pr.rootItem);
  pr.rootItem._kids[0]._offline = true;
  const r = await engine.syncAll();
  assert.equal(store.load().projects.d1.entries[0].path, newPath);
  assert.equal(pr.rootItem._kids[0]._media, newPath + '/boom.wav', 'item offline được nối lại');
  assert.equal(r.files, 0, 'không import trùng sau relink');
  assert.ok(pp.events.some((e) => /tự relink/.test(e.msg)));
});

test('folder offline không có ứng viên → trạng thái offline, không lỗi', async () => {
  const { engine, store, pr } = setup();
  store.update((c) => {
    c.projects.d1 = { path: pr.path, name: 'P', entries: [{ id: 'r', parentId: null, path: '/khong/co/X', sub: true, label: -1, binNodeId: null, parentBinNodeId: null, excluded: [] }] };
  });
  await engine.syncAll();
  assert.equal(engine.status().projects.d1.state.r, 'offline');
});

test('Link existing bins: suy folder từ 1 file, map bin con, import file còn thiếu', async () => {
  const { disk, pr, engine, store } = setup();
  mk(disk, 'Assets/01_Video/Day 01/a.mov');
  mk(disk, 'Assets/01_Video/Day 01/b.mov');
  mk(disk, 'Assets/04_Audio/c.wav');
  const footage = pr.rootItem.createBin('Footage');
  const video = footage.createBin('01_Video');
  const day = video.createBin('Day 01');
  footage.createBin('04_Audio');
  pr.importFiles([path.join(disk, 'Assets/01_Video/Day 01/a.mov')], true, day);
  const r = await engine.linkBin('d1', footage.nodeId);
  assert.equal(r.status, 'ok');
  assert.equal(r.folder, path.join(disk, 'Assets'));
  assert.deepEqual(names(day), ['a.mov', 'b.mov']);
  assert.deepEqual(names(find(footage, '04_Audio')), ['c.wav']);
  assert.equal(find(footage, 'Assets'), undefined, 'không tạo bin trùng');
  assert.equal(store.load().projects.d1.entries.length, 4);
});

test('Link bin không có file nào → cần chọn folder', async () => {
  const { pr, engine } = setup();
  const b = pr.rootItem.createBin('Trống');
  const r = await engine.linkBin('d1', b.nodeId);
  assert.deepEqual(r, { status: 'need-folder', binName: 'Trống' });
});

test('afterRelink (relink tay) nối media offline rồi sync', async () => {
  const { disk, pr, engine, store } = setup();
  mk(disk, 'New/A/x.mov');
  store.update((c) => {
    c.projects.d1 = { path: pr.path, name: 'P', entries: [{ id: 'r', parentId: null, path: path.join(disk, 'New/A'), sub: true, label: -1, binNodeId: null, parentBinNodeId: null, excluded: [] }] };
  });
  pr.importFiles([path.join(disk, 'Old/A/x.mov')], true, pr.rootItem);
  pr.rootItem._kids[0]._offline = true;
  const r = await engine.afterRelink('d1', [{ oldRoot: path.join(disk, 'Old/A'), newRoot: path.join(disk, 'New/A') }]);
  assert.equal(r.files, 0);
  assert.equal(pr.rootItem._kids[0]._media, path.join(disk, 'New/A/x.mov'));
});

test('label của folder gán cho bin và file mới', async () => {
  const { disk, pr, engine, store } = setup();
  mk(disk, 'A/x.mov');
  fs.mkdirSync(path.join(disk, 'B'));
  await engine.addFolders('d1', [path.join(disk, 'B')], null);
  store.update((c) => { c.projects.d1.entries[0].label = 6; });
  mk(disk, 'B/y.mov');
  await engine.syncAll();
  const b = find(pr.rootItem, 'B');
  assert.equal(b._label, 6);
  assert.equal(find(b, 'y.mov')._label, 6);
});
