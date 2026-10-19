const test = require('node:test');
const assert = require('node:assert');
const { inferRoot, mapBins } = require('../com.foldersync.panel/js/core/linkbins.js');

const bin = (nodeId, name, children, sample) => ({ nodeId, name, children: children || [], sample: sample || null });

test('suy ra gốc từ file nằm sâu trong cây bin', () => {
  const t = bin('1', 'Assets', [bin('2', '01_Video', [bin('3', 'Day 01', [], '/x/Assets/01_Video/Day 01/a.mov')])]);
  assert.equal(inferRoot(t), '/x/Assets');
});

test('bin gốc tên khác folder vẫn suy ra đúng', () => {
  const t = bin('1', 'Footage', [bin('2', '01_Video', [], '/x/Assets/01_Video/a.mov')]);
  assert.equal(inferRoot(t), '/x/Assets');
});

test('file ngay trong bin gốc → thư mục chứa file', () => {
  assert.equal(inferRoot(bin('1', 'SFX', [], '/x/SFX/boom.wav')), '/x/SFX');
});

test('file mẫu lệch cấu trúc bị bỏ, dùng bin khác', () => {
  const t = bin('1', 'Assets', [
    bin('2', 'Day 01', [], '/y/z/a.mov'),
    bin('3', 'Day 02', [], '/x/Assets/Day 02/b.mov'),
  ]);
  assert.equal(inferRoot(t), '/x/Assets');
});

test('không bin nào có file → null', () => {
  assert.equal(inferRoot(bin('1', 'A', [bin('2', 'B')])), null);
});

test('so tên bin/thư mục không phân biệt hoa/thường + NFC', () => {
  const t = bin('1', 'A', [bin('2', 'Âm thanh', [], '/x/A/âm thanh/a.wav')]);
  assert.equal(inferRoot(t), '/x/A');
});

test('mapBins: mỗi bin → thư mục tương ứng', () => {
  const t = bin('1', 'Footage', [bin('2', '01_Video', [bin('3', 'Day 01')]), bin('4', 'Audio')]);
  assert.deepEqual(mapBins(t, '/x/Assets'), [
    { nodeId: '1', folder: '/x/Assets', relPath: '', parentNodeId: null },
    { nodeId: '2', folder: '/x/Assets/01_Video', relPath: '01_Video', parentNodeId: '1' },
    { nodeId: '3', folder: '/x/Assets/01_Video/Day 01', relPath: '01_Video/Day 01', parentNodeId: '2' },
    { nodeId: '4', folder: '/x/Assets/Audio', relPath: 'Audio', parentNodeId: '1' },
  ]);
});
