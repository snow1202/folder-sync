const test = require('node:test');
const assert = require('node:assert');
const S = require('../com.foldersync.panel/js/core/settings-edit.js');

test('thêm đuôi file: chuẩn hoá ".MOV " → "mov", chặn trùng và ký tự lạ', () => {
  assert.deepEqual(S.addExt(['mp4'], ' .MOV '), { ok: true, list: ['mov', 'mp4'], value: 'mov' });
  assert.equal(S.addExt(['mp4'], 'MP4').ok, false);
  assert.match(S.addExt(['mp4'], 'MP4').error, /đã có/);
  assert.equal(S.addExt([], 'a b').ok, false);
  assert.equal(S.addExt([], '').ok, false);
  assert.equal(S.addExt([], 'prproj').ok, false, 'không cho thêm file project');
});

test('thêm folder bỏ qua: tên thường + regex, chặn trùng (không phân biệt hoa/thường), regex sai báo lỗi', () => {
  assert.deepEqual(S.addIgnored(['New folder'], '  Proxies '), { ok: true, list: ['New folder', 'Proxies'], value: 'Proxies' });
  assert.equal(S.addIgnored(['New folder'], 'new FOLDER').ok, false);
  assert.equal(S.addIgnored([], '/_AME$/').ok, true);
  const bad = S.addIgnored([], '/[abc/');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /regex/i);
});

test('xoá + lọc theo ô tìm', () => {
  assert.deepEqual(S.remove(['a', 'b', 'c'], 'b'), ['a', 'c']);
  assert.deepEqual(S.filter(['mov', 'mp4', 'wav'], 'M'), ['mov', 'mp4']);
  assert.deepEqual(S.filter(['mov'], ''), ['mov']);
});

test('isRegex nhận dạng mục /…/', () => {
  assert.ok(S.isRegex('/_AME$/'));
  assert.ok(!S.isRegex('untitled folder'));
});
