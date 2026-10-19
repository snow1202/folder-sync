const test = require('node:test');
const assert = require('node:assert');
const { pathkey, isUnder, relativeTo } = require('../com.foldersync.panel/js/core/pathkey.js');
const { compileIgnored, isAllowedFile, isTempFile } = require('../com.foldersync.panel/js/core/filters.js');

test('pathkey: NFD/NFC, hoa/thường, slash cuối đều ra cùng key', () => {
  assert.equal(pathkey('/A/Bé/'), pathkey('/a/bé'));
  assert.equal(pathkey('/a//b/./c'), pathkey('/a/b/c'));
});

test('isUnder theo ranh giới thư mục', () => {
  assert.ok(isUnder('/a/b/c.mov', '/a/b'));
  assert.ok(isUnder('/A/B/c.mov', '/a/b/'));
  assert.ok(!isUnder('/a/bc/x', '/a/b'));
  assert.ok(!isUnder('/a/b', '/a/b'));
});

test('relativeTo giữ nguyên hoa/thường của đường dẫn con', () => {
  assert.equal(relativeTo('/a/b/Day 01/x.mov', '/a/b'), 'Day 01/x.mov');
  assert.equal(relativeTo('/a/b', '/a/b'), '');
});

test('Ignored Folders: tên thường + regex, regex hỏng bị bỏ qua', () => {
  const ig = compileIgnored(['untitled folder', '/_AME$/', '/[/']);
  assert.ok(ig('Untitled Folder'));
  assert.ok(ig('Project_1_ame'));
  assert.ok(!ig('_amethyst'));
  assert.ok(!ig('Footage'));
});

test('Allowed Files', () => {
  assert.ok(isAllowedFile('A.MOV', ['mov']));
  assert.ok(!isAllowedFile('p.prproj', ['mov']));
  assert.ok(!isAllowedFile('noext', ['mov']));
});

test('file tạm', () => {
  for (const n of ['.DS_Store', 'Icon\r', '~$doc.docx', 'x.mov.part', 'a.crdownload', '._x.mov', 'b.tmp']) {
    assert.ok(isTempFile(n), JSON.stringify(n));
  }
  assert.ok(!isTempFile('clip.mov'));
});
