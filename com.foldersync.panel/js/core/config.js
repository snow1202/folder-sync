// Folder Sync — config dùng chung cho engine, panel, manager.
// Một file JSON trên máy, phân theo project (documentID của Premiere).
const fs = require('fs');
const path = require('path');
const os = require('os');
const C = require('./constants.js');
const { pathkey } = require('./pathkey.js');

function defaultDir() {
  return path.join(os.homedir(), 'Library', 'Application Support', 'FolderSync');
}

function defaultConfig() {
  return {
    version: 1,
    autoSync: true,
    settings: {
      notifications: true,
      allowedExt: C.DEFAULT_ALLOWED_EXT.slice(),
      ignoredFolders: C.DEFAULT_IGNORED.slice(),
    },
    projects: {},
  };
}

// Bổ sung khoá còn thiếu (config cũ / config ghi tay).
function normalize(c) {
  const d = defaultConfig();
  const out = Object.assign({}, d, c || {});
  out.settings = Object.assign({}, d.settings, (c && c.settings) || {});
  out.projects = (c && c.projects) || {};
  for (const k of Object.keys(out.projects)) {
    const p = out.projects[k];
    if (!Array.isArray(p.entries)) p.entries = [];
  }
  return out;
}

function createStore(dir) {
  const base = dir || defaultDir();
  const file = path.join(base, 'config.json');

  function load() {
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return defaultConfig(); }
    try {
      return normalize(JSON.parse(raw));
    } catch (e) {
      try { fs.renameSync(file, path.join(base, 'config.broken-' + Date.now() + '.json')); } catch (e2) { /* bỏ qua */ }
      const c = defaultConfig();
      c._recovered = true;
      return c;
    }
  }

  function save(cfg) {
    fs.mkdirSync(base, { recursive: true });
    const clean = JSON.parse(JSON.stringify(cfg, (k, v) => (k.startsWith('_') ? undefined : v)));
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(clean, null, 2));
    fs.renameSync(tmp, file);
  }

  // Đọc bản mới nhất trên đĩa → sửa → ghi. Giảm đè nhau giữa panel/engine/2 phiên Premiere.
  function update(fn) {
    const c = load();
    delete c._recovered;
    fn(c);
    save(c);
    return c;
  }

  return { load, save, update, file, dir: base };
}

function findProject(cfg, info) {
  if (info.documentID && cfg.projects[info.documentID]) {
    return { key: info.documentID, project: cfg.projects[info.documentID] };
  }
  if (info.path) {
    const want = pathkey(info.path);
    for (const k of Object.keys(cfg.projects)) {
      const p = cfg.projects[k];
      if (p.path && pathkey(p.path) === want) {
        if (info.documentID && info.documentID !== k) {
          cfg.projects[info.documentID] = p;
          delete cfg.projects[k];
          return { key: info.documentID, project: p };
        }
        return { key: k, project: p };
      }
    }
  }
  return null;
}

function ensureProject(cfg, info) {
  const found = findProject(cfg, info);
  if (found) {
    if (info.path) found.project.path = info.path;
    if (info.name) found.project.name = info.name;
    return found.project;
  }
  const p = { path: info.path || '', name: info.name || '', entries: [] };
  cfg.projects[info.documentID] = p;
  return p;
}

module.exports = { createStore, defaultConfig, findProject, ensureProject, defaultDir, normalize };
