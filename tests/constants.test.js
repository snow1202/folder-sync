const test = require('node:test');
const assert = require('node:assert');
const C = require('../com.foldersync.panel/js/core/constants.js');

test('16 label Premiere đúng thứ tự', () => {
  assert.equal(C.LABELS.length, 16);
  assert.equal(C.LABELS[0], 'Violet');
  assert.equal(C.LABELS[6], 'Rose');
  assert.equal(C.LABELS[15], 'Yellow');
});

test('Allowed Files mặc định có media phổ biến, không có file project', () => {
  for (const e of ['mp4', 'mov', 'wav', 'mp3', 'png', 'jpg', 'psd', 'ai', 'mxf', 'r3d', 'braw']) {
    assert.ok(C.DEFAULT_ALLOWED_EXT.includes(e), e);
  }
  assert.ok(!C.DEFAULT_ALLOWED_EXT.includes('prproj'));
  assert.ok(!C.DEFAULT_ALLOWED_EXT.includes('aep'));
});

test('Ignored Folders mặc định', () => {
  for (const n of ['untitled folder', 'New folder', '/\\.download$/', '/\\.downiepart$/',
    'Adobe Premiere Pro Auto-Save', '/_AME$/', '.Trashes']) {
    assert.ok(C.DEFAULT_IGNORED.includes(n), n);
  }
});

test('hằng số thời gian và tên event', () => {
  assert.equal(C.BATCH_SIZE, 50);
  assert.equal(C.POLL_REMOTE_MS, 5000);
  assert.equal(C.POLL_LOCAL_MS, 30000);
  assert.equal(C.DEBOUNCE_MS, 1500);
  assert.equal(C.STABLE_GAP_MS, 2000);
  assert.match(C.EVENTS.STATUS, /^com\.foldersync\./);
});
