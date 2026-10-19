// Fake Premiere DOM đủ cho host.jsx: app.projects, rootItem/children, createBin,
// importFiles, getMediaPath, setColorLabel, isOffline, changeMediaPath, nodeId,
// getCurrentProjectViewSelection, setSDKEventMessage, File(path).exists.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const TYPE = { CLIP: 1, BIN: 2, ROOT: 3, FILE: 4 };

function createPremiere(opts) {
  const o = Object.assign({ existing: null, rejectExt: ['xyz'] }, opts);
  let seq = 0;
  const nid = () => String(1000 + (++seq));
  const events = [];
  let selection = [];

  function collection(list) {
    const c = { get numItems() { return list.length; } };
    return new Proxy(c, {
      get(t, k) {
        if (k === 'numItems') return list.length;
        if (typeof k === 'string' && /^\d+$/.test(k)) return list[Number(k)];
        return t[k];
      },
    });
  }

  function makeItem(type, name, mediaPath) {
    const kids = [];
    const item = {
      nodeId: nid(), type, name, _kids: kids, _label: -1, _media: mediaPath || '', _offline: false,
      children: collection(kids),
      getMediaPath() { return item._media; },
      setColorLabel(i) { item._label = i; },
      getColorLabel() { return item._label; },
      isOffline() { return item._offline; },
      canChangeMediaPath() { return type === TYPE.CLIP; },
      changeMediaPath(p) { item._media = p; item._offline = false; return true; },
      createBin(n) { const b = makeItem(TYPE.BIN, n); kids.push(b); return b; },
    };
    return item;
  }

  function makeProject(documentID, projPath) {
    const root = makeItem(TYPE.ROOT, 'root');
    const project = {
      documentID, path: projPath, name: path.basename(projPath), rootItem: root,
      importFiles(paths, suppressUI, bin) {
        const target = bin || root;
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i];
          const ext = path.extname(p).slice(1).toLowerCase();
          if (o.rejectExt.includes(ext)) continue;
          target._kids.push(makeItem(TYPE.CLIP, path.basename(p), p));
        }
        project._importCalls = (project._importCalls || 0) + 1;
        return true;
      },
    };
    return project;
  }

  const projects = [];
  const app = {
    projects: new Proxy({}, {
      get(t, k) {
        if (k === 'numProjects') return projects.length;
        if (typeof k === 'string' && /^\d+$/.test(k)) return projects[Number(k)];
        return undefined;
      },
    }),
    get project() { return projects[0]; },
    getCurrentProjectViewSelection() { return selection; },
    setSDKEventMessage(msg, kind) { events.push({ msg, kind }); },
  };

  function File(p) { this.fsName = p; }
  Object.defineProperty(File.prototype, 'exists', {
    get() { return o.existing ? o.existing.has(this.fsName) : fs.existsSync(this.fsName); },
  });

  const context = vm.createContext({ app, File, ProjectItemType: { CLIP: 1, BIN: 2, ROOT: 3, FILE: 4 }, $: { writeln() {} } });
  const src = fs.readFileSync(path.join(__dirname, '..', 'com.foldersync.panel', 'jsx', 'host.jsx'), 'utf8');
  vm.runInContext(src, context);

  // host(fnName, ...args) → giống bridge thật: args JSON hoá thành 1 chuỗi, kết quả là chuỗi JSON.
  function host(fn, ...args) {
    const call = fn + '(' + JSON.stringify(JSON.stringify(args)) + ')';
    const out = vm.runInContext(call, context);
    const r = JSON.parse(out);
    if (r && r.error) throw new Error(r.error);
    return r;
  }

  return {
    app, events, host, TYPE, makeItem,
    addProject(id, p) { const pr = makeProject(id, p); projects.push(pr); return pr; },
    select(items) { selection = items; },
    walk(item, fn) { fn(item); for (const k of item._kids) this.walk(k, fn); },
  };
}

module.exports = { createPremiere, TYPE };
