const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, defaultConfig, findProject, ensureProject } = require('../com.foldersync.panel/js/core/config.js');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'fs-cfg-')); }

test('chưa có file → config mặc định', () => {
  const s = createStore(tmp());
  const c = s.load();
  assert.equal(c.autoSync, true);
  assert.equal(c.settings.notifications, true);
  assert.ok(c.settings.allowedExt.includes('mov'));
  assert.deepEqual(c.projects, {});
});

test('save → load giữ nguyên, không còn file .tmp', () => {
  const dir = tmp();
  const s = createStore(dir);
  const c = defaultConfig();
  c.autoSync = false;
  s.save(c);
  assert.equal(s.load().autoSync, false);
  assert.ok(!fs.readdirSync(dir).some((f) => f.endsWith('.tmp')));
});

test('file hỏng → đổi tên config.broken-*, trả mặc định có cờ _recovered', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), '{hỏng');
  const c = createStore(dir).load();
  assert.equal(c._recovered, true);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('config.broken-')));
});

test('_recovered không bị ghi xuống đĩa', () => {
  const dir = tmp();
  const s = createStore(dir);
  const c = s.load();
  c._recovered = true;
  s.save(c);
  assert.ok(!('_recovered' in JSON.parse(fs.readFileSync(s.file, 'utf8'))));
});

test('update đọc lại bản mới nhất nên 2 lần update không đè nhau', () => {
  const dir = tmp();
  const a = createStore(dir);
  const b = createStore(dir);
  a.update((c) => { c.autoSync = false; });
  b.update((c) => { c.settings.notifications = false; });
  const c = a.load();
  assert.equal(c.autoSync, false);
  assert.equal(c.settings.notifications, false);
});

test('findProject: theo documentID, rồi theo path (đổi key sang ID mới)', () => {
  const c = defaultConfig();
  ensureProject(c, { documentID: 'old', path: '/p/A.prproj', name: 'A.prproj' });
  assert.equal(findProject(c, { documentID: 'old' }).key, 'old');
  const r = findProject(c, { documentID: 'new', path: '/P/a.prproj' });
  assert.equal(r.key, 'new');
  assert.ok(!c.projects.old);
  assert.ok(c.projects.new);
  assert.equal(findProject(c, { documentID: 'x', path: '/other.prproj' }), null);
});

test('ensureProject tạo mới với entries rỗng và cập nhật path/name', () => {
  const c = defaultConfig();
  const p = ensureProject(c, { documentID: 'd1', path: '/p/A.prproj', name: 'A.prproj' });
  assert.deepEqual(p.entries, []);
  ensureProject(c, { documentID: 'd1', path: '/q/A.prproj', name: 'A.prproj' });
  assert.equal(c.projects.d1.path, '/q/A.prproj');
});
