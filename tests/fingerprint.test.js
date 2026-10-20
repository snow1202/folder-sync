const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { engineFingerprint, ENGINE_PATHS, needsRestart } = require('../com.foldersync.panel/js/core/fingerprint.js');

function bundle() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-fp-'));
  const w = (rel, txt) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt); };
  w('CSXS/manifest.xml', '<m/>');
  w('engine.html', '<html/>');
  w('jsx/host.jsx', 'host');
  w('js/core/a.js', 'a');
  w('js/engine/engine.js', 'e');
  w('js/panel/common.js', 'c');
  w('js/panel/main.js', 'ui');
  w('panel.html', '<p/>');
  w('css/style.css', 'x');
  return { root, w };
}

test('dấu vân tay ổn định khi không đổi gì', () => {
  const { root } = bundle();
  assert.equal(engineFingerprint(root), engineFingerprint(root));
  assert.match(engineFingerprint(root), /^[0-9a-f]{16}$/);
});

test('đổi file của engine (core / engine / jsx / manifest / common.js) → dấu vân tay đổi', () => {
  for (const rel of ['js/core/a.js', 'js/engine/engine.js', 'jsx/host.jsx', 'CSXS/manifest.xml', 'js/panel/common.js', 'engine.html']) {
    const { root, w } = bundle();
    const before = engineFingerprint(root);
    w(rel, 'đã sửa');
    assert.notEqual(engineFingerprint(root), before, rel);
  }
});

test('chỉ đổi giao diện panel (panel.html, css, main.js) → dấu vân tay giữ nguyên', () => {
  const { root, w } = bundle();
  const before = engineFingerprint(root);
  w('panel.html', '<p>mới</p>');
  w('css/style.css', 'y');
  w('js/panel/main.js', 'ui mới');
  assert.equal(engineFingerprint(root), before);
});

test('thêm file mới trong js/core → dấu vân tay đổi', () => {
  const { root, w } = bundle();
  const before = engineFingerprint(root);
  w('js/core/new.js', 'n');
  assert.notEqual(engineFingerprint(root), before);
});

test('needsRestart: chỉ true khi engine báo dấu vân tay và nó khác bản trên ổ', () => {
  assert.equal(needsRestart('abc', 'abc'), false);
  assert.equal(needsRestart('abc', 'def'), true);
  assert.equal(needsRestart(undefined, 'def'), false, 'engine cũ chưa báo dấu vân tay → không kết luận');
  assert.ok(ENGINE_PATHS.includes('jsx'));
});
