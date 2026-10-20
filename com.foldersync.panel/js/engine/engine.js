// Folder Sync — engine: điều phối toàn bộ việc sync. Không phụ thuộc CEP
// (host, store, fs được tiêm vào) nên chạy được trong test với fake Premiere.
const fs = require('fs');
const path = require('path');
const C = require('../core/constants.js');
const T = require('../core/tree.js');
const P = require('../core/planner.js');
const { scan: realScan } = require('../core/scanner.js');
const { createStabilityTracker } = require('../core/stability.js');
const { compileIgnored, isAllowedFile } = require('../core/filters.js');
const { pathkey } = require('../core/pathkey.js');
const { findProject, ensureProject } = require('../core/config.js');
const { autoRelink } = require('../core/drive.js');
const { inferRoot, mapBins } = require('../core/linkbins.js');
const { summary } = require('../core/notify.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}

async function defaultExists(p) {
  try { await fs.promises.stat(p); return true; } catch (e) { return false; }
}

async function defaultStatFile(p) {
  try { const s = await fs.promises.stat(p); return { path: p, size: s.size, mtimeMs: s.mtimeMs }; } catch (e) { return null; }
}

// opts: { store, host, emit(event, data), log(msg), now(), modeFor(path) → 'poll'|'watch',
//         exists(p), statFile(p), scan, listDriveRoots, home, quickGapMs, stableGapMs }
function createEngine(opts) {
  const o = Object.assign({
    emit: () => {},
    log: () => {},
    onImported: () => {},  // (items: [{at, docId, path, name, nodeId, bin}]) — ghi lịch sử
    onRekey: () => {},     // (oldDocId, newDocId)
    now: () => Date.now(),
    modeFor: () => 'poll',
    exists: defaultExists,
    statFile: defaultStatFile,
    scan: realScan,
    home: require('os').homedir(),
    quickGapMs: 1000,
    stableGapMs: C.STABLE_GAP_MS,
  }, opts);
  const { store, host } = o;

  let queue = Promise.resolve();
  let abortFlag = false;
  let busy = null; // { done, total } khi đang import
  const rt = {};   // runtime theo documentID
  const lastScan = {}; // rootId → ms
  const dirty = new Set(); // pathkey root bị fs.watch báo
  let lastSync = null;

  function proj(docId) {
    if (!rt[docId]) {
      rt[docId] = { index: null, rejected: new Map(), tracker: createStabilityTracker({ gapMs: o.stableGapMs }),
        pending: new Set(), errors: {}, state: {}, name: '' };
    }
    return rt[docId];
  }

  function enqueue(fn) {
    const run = queue.then(fn, fn);
    queue = run.catch((e) => o.log('lỗi hàng đợi: ' + (e && e.stack || e)));
    return run;
  }

  function emitStatus() { o.emit(C.EVENTS.STATUS, status()); }

  function status() {
    const projects = {};
    for (const k of Object.keys(rt)) projects[k] = { name: rt[k].name, state: Object.assign({}, rt[k].state) };
    return { busy, lastSync, projects, autoSync: store.load().autoSync, version: C.VERSION, at: o.now() };
  }

  async function refreshIndex(docId) {
    const list = await host.listMediaPaths(docId);
    proj(docId).index = new Set(list.map(pathkey));
  }

  // Ghi thay đổi của engine vào config MỚI NHẤT (manager có thể vừa sửa).
  function persist(info, mutate) {
    store.update((cfg) => {
      const found = findProject(cfg, info);
      if (!found) return;
      mutate(found.project.entries, found.project);
    });
  }

  function settingsFilters() {
    const s = store.load().settings;
    return { isIgnoredFolder: compileIgnored(s.ignoredFolders), isAllowed: (n) => isAllowedFile(n, s.allowedExt) };
  }

  // Một entry gốc offline → thử tự relink Drive. Trả true nếu đã relink.
  async function tryDriveRelink(info, root) {
    const r = await autoRelink(root.path, {
      home: o.home,
      listDriveRoots: o.listDriveRoots,
      exists: (p) => withTimeout(o.exists(p), C.ONLINE_TIMEOUT_MS, false),
    });
    if (r.status !== 'ok') return false;
    const oldRoot = root.path;
    persist(info, (entries) => { if (T.byId(entries, root.id)) T.relink(entries, root.id, r.newPath); });
    try { await host.relinkMedia(info.documentID, oldRoot, r.newPath); } catch (e) { o.log('relinkMedia: ' + e.message); }
    proj(info.documentID).index = null;
    o.log('tự relink Drive: ' + oldRoot + ' → ' + r.newPath);
    try { await host.notify('Folder Sync: đã tự relink "' + path.basename(r.newPath) + '" theo Google Drive của máy này'); } catch (e) { /* bỏ qua */ }
    return true;
  }

  // Ổn định nhanh cho SYNC tay / folder mới thêm: đo lại sau quickGapMs.
  async function quickStable(files) {
    if (!files.length) return [];
    await sleep(o.quickGapMs);
    const again = await Promise.all(files.map((f) => o.statFile(f.path)));
    return files.filter((f, i) => again[i] && again[i].size === f.size && again[i].mtimeMs === f.mtimeMs && f.size > 0);
  }

  // Bin cần đảm bảo: entries được truyền vào + toàn bộ tổ tiên (cha trước con).
  function binItems(entries, need) {
    const want = new Set();
    for (const e of need) {
      let cur = e;
      while (cur) { want.add(cur.id); cur = cur.parentId ? T.byId(entries, cur.parentId) : null; }
    }
    const ordered = entries.filter((e) => want.has(e.id))
      .sort((a, b) => a.path.split(path.sep).length - b.path.split(path.sep).length);
    return ordered.map((e) => ({
      key: e.id,
      parentKey: e.parentId && want.has(e.parentId) ? e.parentId : null,
      parentNodeId: e.parentId ? ((T.byId(entries, e.parentId) || {}).binNodeId || null) : (e.parentBinNodeId || null),
      name: path.basename(e.path),
      nodeId: e.binNodeId || null,
      label: e.label,
    }));
  }

  async function syncProjectInner(info, flags) {
    const docId = info.documentID;
    const R = proj(docId);
    R.name = info.name;
    const cfg = store.load();
    const found = findProject(cfg, info);
    if (!found || !found.project.entries.length) return { files: 0, folders: 0, binNames: [] };
    // documentID đổi (mở lại project) → ghi lại khoá mới để panel/manager khớp đúng.
    if (found.key !== info.documentID) {
      store.update((c) => { findProject(c, info); });
      try { o.onRekey(found.key, info.documentID); } catch (e) { /* bỏ qua */ }
    }
    let entries = found.project.entries;
    const filters = settingsFilters();
    const result = { files: 0, folders: 0, binNames: [] };
    const roots = entries.filter((e) => e.parentId === null);

    for (const root0 of roots) {
      if (abortFlag) break;
      let root = root0;
      const now = o.now();
      if (!flags.manual && !flags.force) {
        const mode = o.modeFor(root.path);
        const fast = mode === 'poll' || R.pending.has(root.id) || R.state[root.id] === 'offline';
        const gap = fast ? C.POLL_REMOTE_MS : C.POLL_LOCAL_MS;
        const due = dirty.has(pathkey(root.path)) || !lastScan[root.id] || now - lastScan[root.id] >= gap;
        if (!due) continue;
      }
      if (R.errors[root.id] >= C.MAX_ERRORS && !flags.manual) continue;
      lastScan[root.id] = now;
      dirty.delete(pathkey(root.path));
      const branch = [root].concat(T.descendants(entries, root.id));

      try {
        // 1. online?
        const online = await withTimeout(o.exists(root.path), C.ONLINE_TIMEOUT_MS, false);
        if (!online) {
          if (await tryDriveRelink(info, root)) {
            entries = findProject(store.load(), info).project.entries;
            root = T.byId(entries, root.id);
          } else {
            for (const e of branch) R.state[e.id] = 'offline';
            continue;
          }
        }

        // 2. quét
        const sc = await o.scan(root.path, {
          sub: true,
          isIgnoredFolder: filters.isIgnoredFolder,
          isAllowed: filters.isAllowed,
          isExcludedDir: (abs) => T.isExcluded(root, abs),
        });

        // 3. thư mục mới → entry mới (chỉ dưới entry có SUB)
        const added = P.applyNewDirs(entries, sc.dirs);
        const branchNow = [root].concat(T.descendants(entries, root.id));
        const entryKeys = new Set(branchNow.map((e) => pathkey(e.path)));
        // chỉ lấy file nằm TRỰC TIẾP trong thư mục có entry
        const candidates = sc.files.filter((f) => entryKeys.has(pathkey(path.dirname(f.path))));

        if (!R.index) await refreshIndex(docId);
        const fresh = P.planImports(entries, candidates, R.index, R.rejected);
        const freshFiles = candidates.filter((f) => fresh.some((x) => x.path === f.path));

        // 4. ổn định
        let stable;
        if (flags.manual || flags.quick) stable = await quickStable(freshFiles);
        else stable = R.tracker.observe(freshFiles, o.now());
        if (freshFiles.length > stable.length) R.pending.add(root.id); else R.pending.delete(root.id);

        const missingBins = branchNow.filter((e) => !e.binNodeId);
        if (!stable.length && !added.length && !missingBins.length) {
          for (const e of branchNow) R.state[e.id] = 'ok';
          R.errors[root.id] = 0;
          continue;
        }

        // 5. làm mới chỉ mục (bắt file user vừa import tay) rồi lập lại kế hoạch
        await refreshIndex(docId);
        const plan = P.planImports(entries, stable, R.index, R.rejected);
        const groups = P.groupByEntry(plan);

        // 6. bin: entry nhận file + entry mới + entry chưa có bin
        const needIds = new Set([...groups.keys(), ...added.map((e) => e.id), ...missingBins.map((e) => e.id)]);
        const need = branchNow.filter((e) => needIds.has(e.id));
        if (need.length) {
          const ids = await host.ensureBins(docId, binItems(entries, need));
          for (const e of entries) if (ids[e.id]) e.binNodeId = ids[e.id];
          persist(info, (fe) => {
            for (const a of added) if (!T.byId(fe, a.id) && T.byId(fe, a.parentId)) fe.push(Object.assign({}, a));
            for (const e of fe) if (ids[e.id]) e.binNodeId = ids[e.id];
          });
        }
        result.folders += added.length;
        for (const a of added) result.binNames.push(path.basename(a.path));

        // 7. import theo đợt
        const total = plan.length;
        let done = 0;
        for (const [entryId, files] of groups) {
          const e = T.byId(entries, entryId);
          for (const part of P.chunk(files, C.BATCH_SIZE)) {
            if (abortFlag) { for (const f of part) R.tracker.forget(f); continue; }
            busy = { done, total };
            o.emit(C.EVENTS.PROGRESS, busy);
            for (const x of [e].concat(branchNow)) R.state[x.id] = R.state[x.id] || 'ok';
            R.state[e.id] = 'busy';
            const res = await host.importBatch(docId, e.binNodeId, part, e.label);
            const got = new Set((res.items || []).map((it) => pathkey(it.path)));
            try {
              o.onImported((res.items || []).filter((it) => it.path).map((it) => ({
                at: o.now(), docId, path: it.path, name: path.basename(it.path), nodeId: it.nodeId, bin: res.binName || path.basename(e.path),
              })));
            } catch (err) { o.log('ghi lịch sử lỗi: ' + err.message); }
            for (const f of part) {
              const k = pathkey(f);
              if (got.has(k)) { R.index.add(k); result.files += 1; }
              else {
                const st = stable.find((s) => s.path === f);
                R.rejected.set(k, st ? st.mtimeMs : 0);
                o.log('Premiere từ chối: ' + f);
              }
            }
            if (got.size) result.binNames.push(path.basename(e.path));
            done += part.length;
            busy = { done, total };
            o.emit(C.EVENTS.PROGRESS, busy);
            R.state[e.id] = 'ok';
          }
        }
        for (const e of branchNow) R.state[e.id] = 'ok';
        R.errors[root.id] = 0;
      } catch (err) {
        R.errors[root.id] = (R.errors[root.id] || 0) + 1;
        o.log('lỗi sync ' + root.path + ': ' + (err && err.message));
        const st = R.errors[root.id] >= C.MAX_ERRORS ? 'error' : 'ok';
        for (const e of branch) R.state[e.id] = st;
      }
    }
    return result;
  }

  async function doSync(flags, onlyDocId) {
    abortFlag = false;
    // SYNC tay luôn đọc lại project: item user vừa xoá trong Premiere (file còn trên ổ)
    // sẽ được import lại, giống Watchtower.
    if (flags.manual) for (const k of Object.keys(rt)) rt[k].index = null;
    let projects;
    try { projects = await host.listProjects(); } catch (e) { o.log('listProjects: ' + e.message); return null; }
    const total = { files: 0, folders: 0, binNames: [] };
    for (const info of projects) {
      if (onlyDocId && info.documentID !== onlyDocId) continue;
      const r = await syncProjectInner(info, flags);
      total.files += r.files; total.folders += r.folders; total.binNames.push(...r.binNames);
      const notifyOn = store.load().settings.notifications;
      if (notifyOn && (r.files || r.folders)) {
        try { await host.notify('Folder Sync: ' + summary(r)); } catch (e) { /* bỏ qua */ }
      }
    }
    if (flags.manual && !total.files && !total.folders && store.load().settings.notifications) {
      try { await host.notify('Folder Sync: ' + summary(total)); } catch (e) { /* bỏ qua */ }
    }
    busy = null;
    lastSync = { at: o.now(), files: total.files, folders: total.folders, aborted: abortFlag, message: summary(total) };
    abortFlag = false;
    emitStatus();
    return total;
  }

  // ---------------------------------------------------------------- API công khai

  const api = {
    status,
    emitStatus,
    // Lượt tự động (gọi định kỳ bởi boot) — chỉ quét root đến hạn.
    tick: () => enqueue(() => doSync({ manual: false })),
    syncAll: (flags) => enqueue(() => doSync(Object.assign({ manual: true }, flags))),
    syncProject: (docId, flags) => enqueue(() => doSync(Object.assign({ manual: true }, flags), docId)),
    abort: () => { abortFlag = true; },
    markDirty: (rootPath) => dirty.add(pathkey(rootPath)),
    invalidate: (docId) => { if (docId) proj(docId).index = null; else for (const k of Object.keys(rt)) rt[k].index = null; },

    // Thêm folder (kéo-thả / nút Thêm). parentBinNodeId: bin đang chọn.
    addFolders: (docId, paths, parentBinNodeId) => enqueue(async () => {
      const info = (await host.listProjects()).find((p) => p.documentID === docId);
      if (!info) throw new Error('Không tìm thấy project');
      store.update((cfg) => {
        const p = ensureProject(cfg, info);
        for (const abs of paths) T.addRoot(p.entries, { path: abs, parentBinNodeId: parentBinNodeId || null });
      });
      return doSync({ manual: true, force: true }, docId);
    }),

    // Link existing bins. folder: bắt buộc khi trong cây bin không có file nào.
    linkBin: (docId, binNodeId, folder) => enqueue(async () => {
      const info = (await host.listProjects()).find((p) => p.documentID === docId);
      if (!info) throw new Error('Không tìm thấy project');
      const tree = await host.describeBins(docId, binNodeId);
      const rootFolder = folder || inferRoot(tree);
      if (!rootFolder) return { status: 'need-folder', binName: tree.name };
      const maps = mapBins(tree, rootFolder);
      const ok = [];
      for (const m of maps) if (await withTimeout(o.exists(m.folder), C.ONLINE_TIMEOUT_MS, false)) ok.push(m);
      if (!ok.length || ok[0].relPath !== '') return { status: 'missing-folder', folder: rootFolder };
      store.update((cfg) => {
        const p = ensureProject(cfg, info);
        const root = T.addRoot(p.entries, { path: rootFolder, binNodeId: ok[0].nodeId });
        root.binNodeId = ok[0].nodeId;
        const byNode = { [ok[0].nodeId]: root };
        for (const m of ok.slice(1)) {
          const parent = byNode[m.parentNodeId];
          if (!parent) continue; // cha không có folder tương ứng → bỏ cả nhánh
          const c = T.addChild(p.entries, parent, m.folder);
          c.binNodeId = m.nodeId;
          byNode[m.nodeId] = c;
        }
      });
      const unmatched = maps.length - ok.length;
      const r = await doSync({ manual: true, force: true }, docId);
      return { status: 'ok', folder: rootFolder, linked: ok.length, unmatched, result: r };
    }),

    // Sau khi manager relink (tay): nối lại media offline rồi sync.
    afterRelink: (docId, pairs) => enqueue(async () => {
      for (const pr of pairs || []) {
        try { await host.relinkMedia(docId, pr.oldRoot, pr.newRoot); } catch (e) { o.log('relinkMedia: ' + e.message); }
      }
      proj(docId).index = null;
      return doSync({ manual: true, force: true }, docId);
    }),

    selectedBin: (docId) => host.getSelectedBin(docId),
    idle: () => queue,
  };
  return api;
}

module.exports = { createEngine, withTimeout };
