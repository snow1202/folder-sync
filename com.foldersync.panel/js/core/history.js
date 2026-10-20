// Folder Sync — lịch sử file đã import (hiển thị trong panel), 200 dòng mỗi project.
// File: ~/Library/Application Support/FolderSync/history.json — { docId: [item mới nhất trước] }
const fs = require('fs');
const path = require('path');

const MAX_PER_PROJECT = 200;

function createHistory(dir) {
  const file = path.join(dir, 'history.json');

  function read() {
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
    } catch (e) { return {}; }
  }

  function write(d) {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(d));
    fs.renameSync(tmp, file);
  }

  // items: [{at, docId, path, name, nodeId, bin}] — thứ tự import (cũ → mới).
  function add(items) {
    if (!items || !items.length) return;
    const d = read();
    for (const it of items) {
      const l = d[it.docId] || (d[it.docId] = []);
      l.unshift(it);
    }
    for (const k of Object.keys(d)) if (d[k].length > MAX_PER_PROJECT) d[k].length = MAX_PER_PROJECT;
    write(d);
  }

  function list(docId) { return (read()[docId] || []).slice(); }

  function clear(docId) {
    const d = read();
    delete d[docId];
    write(d);
  }

  function rekey(oldId, newId) {
    const d = read();
    if (!d[oldId]) return;
    d[newId] = (d[newId] || []).concat(d[oldId]).sort((a, b) => b.at - a.at).slice(0, MAX_PER_PROJECT);
    delete d[oldId];
    write(d);
  }

  return { add, list, clear, rekey, file };
}

module.exports = { createHistory, MAX_PER_PROJECT };
