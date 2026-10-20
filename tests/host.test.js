const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createPremiere, TYPE } = require('./fake-premiere.js');

test('FS_listProjects + FS_ping', () => {
  const pp = createPremiere();
  pp.addProject('d1', '/p/A.prproj');
  pp.addProject('d2', '/p/B.prproj');
  assert.equal(pp.host('FS_ping'), 'pong');
  const list = pp.host('FS_listProjects');
  assert.deepEqual(list.map((x) => [x.documentID, x.name, x.active]), [['d1', 'A.prproj', true], ['d2', 'B.prproj', false]]);
});

test('FS_ensureBins: tạo cây, dùng lại bin trùng tên, tạo lại khi nodeId mất', () => {
  const pp = createPremiere();
  const pr = pp.addProject('d1', '/p/A.prproj');
  const existing = pr.rootItem.createBin('Assets');
  const r = pp.host('FS_ensureBins', 'd1', [
    { key: 'a', parentKey: null, parentNodeId: null, name: 'assets', nodeId: null, label: -1 },
    { key: 'b', parentKey: 'a', parentNodeId: null, name: 'Day 01', nodeId: null, label: 6 },
  ]);
  assert.equal(r.a, existing.nodeId);
  const day = existing._kids[0];
  assert.equal(day.name, 'Day 01');
  assert.equal(day._label, 6);
  assert.equal(r.b, day.nodeId);
  // nodeId không còn → tìm theo tên trong cha (parentNodeId)
  const r2 = pp.host('FS_ensureBins', 'd1', [{ key: 'x', parentKey: null, parentNodeId: existing.nodeId, name: 'Day 01', nodeId: '999999', label: -1 }]);
  assert.equal(r2.x, day.nodeId);
  // tìm theo nodeId dù bin đã bị di chuyển/đổi tên
  day.name = 'Đổi tên';
  const r3 = pp.host('FS_ensureBins', 'd1', [{ key: 'y', parentKey: null, parentNodeId: null, name: 'Day 01', nodeId: day.nodeId, label: -1 }]);
  assert.equal(r3.y, day.nodeId);
});

test('FS_importBatch: trả item mới + gán label cho item và bin; file bị từ chối không có trong kết quả', () => {
  const pp = createPremiere();
  const pr = pp.addProject('d1', '/p/A.prproj');
  const bin = pr.rootItem.createBin('SFX');
  const r = pp.host('FS_importBatch', 'd1', bin.nodeId, ['/x/a.wav', '/x/b.xyz'], 5);
  assert.deepEqual(r.items.map((x) => x.path), ['/x/a.wav']);
  assert.equal(bin._kids[0]._label, 5);
  assert.equal(bin._label, 5);
});

test('FS_listMediaPaths duyệt cả bin con', () => {
  const pp = createPremiere();
  const pr = pp.addProject('d1', '/p/A.prproj');
  const b = pr.rootItem.createBin('A');
  pr.importFiles(['/x/1.mov'], true, b);
  pr.importFiles(['/x/2.mov'], true, pr.rootItem);
  assert.deepEqual(pp.host('FS_listMediaPaths', 'd1').sort(), ['/x/1.mov', '/x/2.mov']);
});

test('FS_getSelectedBin: bin được chọn, hoặc gốc', () => {
  const pp = createPremiere();
  const pr = pp.addProject('d1', '/p/A.prproj');
  const b = pr.rootItem.createBin('Asset');
  assert.equal(pp.host('FS_getSelectedBin', 'd1').nodeId, pr.rootItem.nodeId);
  pp.select([b]);
  assert.deepEqual(pp.host('FS_getSelectedBin', 'd1'), { nodeId: b.nodeId, name: 'Asset' });
});

test('FS_describeBins: cây bin + 1 file mẫu mỗi bin', () => {
  const pp = createPremiere();
  const pr = pp.addProject('d1', '/p/A.prproj');
  const a = pr.rootItem.createBin('Footage');
  const d = a.createBin('Day 01');
  pr.importFiles(['/x/Assets/Day 01/a.mov'], true, d);
  const t = pp.host('FS_describeBins', 'd1', a.nodeId);
  assert.equal(t.name, 'Footage');
  assert.equal(t.sample, null);
  assert.equal(t.children[0].sample, '/x/Assets/Day 01/a.mov');
});

test('FS_relinkMedia chỉ nối item offline có file mới tồn tại', () => {
  const pp = createPremiere({ existing: new Set(['/new/A/x.mov']) });
  const pr = pp.addProject('d1', '/p/A.prproj');
  pr.importFiles(['/old/A/x.mov', '/old/A/y.mov', '/old/A/z.mov'], true, pr.rootItem);
  const [x, y, z] = pr.rootItem._kids;
  x._offline = true; y._offline = true; z._offline = false;
  const r = pp.host('FS_relinkMedia', 'd1', '/old/A', '/new/A');
  assert.deepEqual(r, { relinked: 1, skipped: 2 });
  assert.equal(x._media, '/new/A/x.mov');
  assert.equal(y._media, '/old/A/y.mov');
});

test('FS_notify ghi vào Events; lỗi trả {error}', () => {
  const pp = createPremiere();
  pp.addProject('d1', '/p/A.prproj');
  pp.host('FS_notify', 'Xin chào "Folder Sync"\nOK');
  assert.equal(pp.events[0].msg, 'Xin chào "Folder Sync"\nOK');
  assert.throws(() => pp.host('FS_listMediaPaths', 'nope'), /Không tìm thấy project/);
});

test('host.jsx không dùng từ khoá cấm ES3 làm định danh', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'com.foldersync.panel', 'jsx', 'host.jsx'), 'utf8')
    .replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\]|\\.)*'/g, "''");
  const banned = ['short', 'class', 'int', 'long', 'char', 'byte', 'float', 'double', 'const', 'let',
    'enum', 'goto', 'package', 'private', 'public', 'static', 'boolean', 'native', 'final', 'abstract',
    'synchronized', 'transient', 'volatile', 'implements', 'interface', 'protected', 'throws', 'import', 'export', 'super', 'extends'];
  for (const w of banned) {
    assert.ok(!new RegExp('(var|function|,|\\()\\s*' + w + '\\b|\\.' + w + '\\b|\\b' + w + '\\s*[:=](?!=)').test(src), w);
  }
});

test('mở 2 project: project active = project chứa bin đang chọn, không phải app.project', () => {
  const pp = createPremiere();
  pp.addProject('soft', '/p/SoftyGrace.prproj');           // app.project = project mở trước
  const vera = pp.addProject('vera', '/p/Veracomfort.prproj');
  const bin = vera.rootItem.createBin('Kling AI');
  pp.select([bin]);
  const list = pp.host('FS_listProjects');
  assert.deepEqual(list.filter((p) => p.active).map((p) => p.documentID), ['vera']);
  assert.deepEqual(pp.host('FS_getSelectedBin', 'vera'), { nodeId: bin.nodeId, name: 'Kling AI' });
  // bin đang chọn thuộc project khác → về gốc, không lấy nhầm
  assert.equal(pp.host('FS_getSelectedBin', 'soft').name, '');
});

test('FS_revealItem: chọn clip; clip không chọn được thì chọn bin chứa nó; không thấy → missing', () => {
  const pp = createPremiere();
  const pr = pp.addProject('d1', '/p/A.prproj');
  const bin = pr.rootItem.createBin('SFX');
  pr.importFiles(['/x/a.wav', '/x/b.wav'], true, bin);
  const [a, b] = bin._kids;
  assert.equal(pp.host('FS_revealItem', 'd1', a.nodeId), 'item');
  assert.equal(pp.selected.at(-1), a.nodeId);
  b._noSelect = true;
  assert.equal(pp.host('FS_revealItem', 'd1', b.nodeId), 'bin');
  assert.equal(pp.selected.at(-1), bin.nodeId);
  assert.equal(pp.host('FS_revealItem', 'd1', '424242'), 'missing');
});
