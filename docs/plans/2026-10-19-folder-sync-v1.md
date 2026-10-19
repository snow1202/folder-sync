# Folder Sync v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, this session) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Ghi chú: mỗi task core đi theo TDD — test trong plan là **hợp đồng hành vi**; code triển khai nằm trong repo (không chép đôi vào plan). Thuật toán khó được mô tả đủ để viết lại.

**Goal:** Panel CEP "Folder Sync" cho Premiere Pro, tự đồng bộ một chiều thư mục (kể cả Google Drive) vào cây bin, chạy ngầm — theo `docs/specs/2026-10-19-folder-sync-design.md`.

**Architecture:** Bundle CEP `com.foldersync.panel` gồm 3 extension (panel, manager, engine ẩn). Toàn bộ logic nằm ở `js/core/*` (CommonJS thuần Node, test bằng `node --test`); engine điều phối; `jsx/host.jsx` (ES3) là lớp duy nhất chạm vào project Premiere. Panel/manager chỉ sửa config + gửi CSEvent.

**Tech Stack:** CEP 9+ (CSXS 9.0, `--enable-nodejs`, `--mixed-context`), ExtendScript ES3, Node ≥ 16 trong CEP / Node 24 để test, `node:test` + `node:assert`, không dependency npm.

## Global Constraints

- Host: `PPRO` `[14.0,99.9]`; macOS-first; Windows không test.
- Bundle ID `com.foldersync.panel`; extension IDs `com.foldersync.panel.main`, `.manager`, `.engine`; Menu "Folder Sync".
- Config: `~/Library/Application Support/FolderSync/config.json`, ghi atomic (tmp + rename).
- Chống trùng theo pathkey = `path.normalize` + NFC + lowercase.
- Allowed Files mặc định KHÔNG có `prproj`, `aep`.
- Import theo đợt 50 file; `importFiles(paths, true, bin, false)`.
- Quét định kỳ 5 s (Drive/mạng/ExFAT), 30 s lưới an toàn cho ổ cục bộ; debounce fs.watch 1,5 s; ổn định = 2 quan sát cách ≥ 2 s, size > 0.
- Label: -1 None, 0..15 theo thứ tự Violet, Iris, Caribbean, Lavender, Cerulean, Forest, Rose, Mango, Purple, Blue, Teal, Magenta, Tan, Green, Brown, Yellow.
- `host.jsx` không dùng từ khoá cấm ES3 (`short`, `class`, `int`, `long`, `char`, `byte`, `float`, `double`, `const`, `let`, `enum`, `goto`, `package`, `private`, `public`, `static`, …).
- UI tiếng Việt, mọi control có `data-tip`. Commit message tiếng Việt, kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

```
package.json                         scripts.test = node --test tests/
install.sh                           symlink bundle vào CEP extensions + PlayerDebugMode
com.foldersync.panel/CSXS/manifest.xml
com.foldersync.panel/{panel,manager,engine}.html
com.foldersync.panel/css/style.css
com.foldersync.panel/js/lib/CSInterface.js
com.foldersync.panel/js/core/{constants,pathkey,filters,config,tree,scanner,stability,planner,drive,linkbins,notify,watchmode}.js
com.foldersync.panel/js/engine/{bridge,engine,boot}.js
com.foldersync.panel/js/panel/{tips,common,main,settings,manager}.js
com.foldersync.panel/jsx/host.jsx
tests/*.test.js, tests/fake-premiere.js
docs/TEST-CHECKLIST.md
```

Core modules dùng `module.exports`; trong CEP mixed-context, HTML nạp bằng `require(__dirname + '/js/core/x.js')` qua helper `common.js` (đường dẫn tuyệt đối từ `csInterface.getSystemPath(SystemPath.EXTENSION)`).

---

### Task 1: Khung repo, manifest, install, constants

**Files:** Create `package.json`, `install.sh`, `com.foldersync.panel/CSXS/manifest.xml`, `js/lib/CSInterface.js` (copy từ Resizer), `js/core/constants.js`, `tests/constants.test.js`

**Interfaces — Produces:** `constants.js` exports `{ LABELS: string[16], DEFAULT_ALLOWED_EXT: string[], DEFAULT_IGNORED: string[], BATCH_SIZE: 50, POLL_REMOTE_MS: 5000, POLL_LOCAL_MS: 30000, DEBOUNCE_MS: 1500, STABLE_GAP_MS: 2000, EVENTS: {CONFIG_CHANGED, STATUS, COMMAND, PROGRESS} }` với tên event dạng `com.foldersync.*`.

- [ ] Test: `LABELS.length === 16`, `LABELS[6] === 'Rose'`; `DEFAULT_ALLOWED_EXT` chứa `mp4, mov, wav, mp3, png, jpg, psd, ai, mxf, r3d, braw` và **không** chứa `prproj`, `aep`; `DEFAULT_IGNORED` chứa `untitled folder`, `New folder`, `/\.download$/`, `/\.downiepart$/`, `Adobe Premiere Pro Auto-Save`, `/_AME$/`, `.Trashes`.
- [ ] Chạy fail → viết constants → pass.
- [ ] Manifest 3 extension (engine: `<Type>Custom</Type>`, `<AutoVisible>false</AutoVisible>`, `<StartOn><Event>com.adobe.csxs.events.ApplicationActivate</Event><Event>applicationActivate</Event></StartOn>`; manager: `<Type>Modeless</Type>` 860×540, min 640×360); tất cả `--enable-nodejs --mixed-context`.
- [ ] `install.sh` theo khuôn Resizer (symlink, PlayerDebugMode 9–12).
- [ ] Commit `khung repo: manifest 3 extension, install.sh, constants`.

### Task 2: pathkey + filters

**Files:** `js/core/pathkey.js`, `js/core/filters.js`, `tests/pathkey.test.js`, `tests/filters.test.js`

**Produces:**
- `pathkey(p: string): string` — `path.normalize`, bỏ `/` cuối, `.normalize('NFC')`, `toLowerCase()`.
- `isUnder(child, parent): boolean` (theo pathkey, ranh giới `/`).
- `relativeTo(child, parent): string` (giữ nguyên hoa/thường của child).
- `compileIgnored(list: string[]): (name) => boolean` — mục dạng `/…/` là regex `i`; regex lỗi → bỏ qua mục đó; còn lại so bằng (NFC, không phân biệt hoa/thường).
- `isAllowedFile(name, allowedExt: string[]): boolean` — đuôi (không dấu chấm) so lowercase.
- `isTempFile(name): boolean` — `.DS_Store`, `Icon\r`, bắt đầu `._` hoặc `~$` hoặc `.~`, đuôi `.tmp|.part|.crdownload|.download|.partial`, file ẩn bắt đầu `.`.

Tests (bắt buộc):
```js
assert.equal(pathkey('/A/Bé/'), pathkey('/a/bé'));          // NFD vs NFC + hoa/thường + slash
assert.ok(isUnder('/a/b/c.mov', '/a/b')); assert.ok(!isUnder('/a/bc/x', '/a/b'));
assert.equal(relativeTo('/a/b/Day 01/x.mov', '/a/b'), 'Day 01/x.mov');
const ig = compileIgnored(['untitled folder', '/_AME$/', '/[/']);
assert.ok(ig('Untitled Folder')); assert.ok(ig('Project_1_ame')); assert.ok(!ig('_amethyst'));
assert.ok(isAllowedFile('A.MOV', ['mov'])); assert.ok(!isAllowedFile('p.prproj', ['mov']));
for (const n of ['.DS_Store','Icon\r','~$doc.docx','x.mov.part','a.crdownload','._x.mov']) assert.ok(isTempFile(n));
assert.ok(!isTempFile('clip.mov'));
```
- [ ] fail → implement → pass → commit `core: pathkey + filters`.

### Task 3: config (đọc/ghi atomic, project matching)

**Files:** `js/core/config.js`, `tests/config.test.js`

**Produces:** `createStore(dir: string)` → `{ load(): Config, save(cfg): void, update(fn: (cfg)=>void): Config, file: string }`; `defaultConfig(): Config`; `findProject(cfg, {documentID, path}): {key, project} | null` (khớp ID, rồi path → đổi key sang ID mới); `ensureProject(cfg, {documentID, path, name}): project`.
- `load()`: không có file → default; JSON hỏng → rename `config.broken-<Date.now()>.json`, trả default với cờ `cfg._recovered = true` (không lưu cờ).
- `update(fn)`: đọc lại file mới nhất, áp `fn`, ghi atomic → giảm đè giữa 2 phiên Premiere.
- default `settings.allowedExt/ignoredFolders` lấy từ constants; `autoSync: true`; `notifications: true`.

Tests: thư mục tạm `fs.mkdtempSync`; save→load round-trip; file hỏng → recovered + có file `config.broken-*`; `.tmp` không còn sau save; `findProject` theo path đổi key; `update` merge hai lần liên tiếp giữ cả hai thay đổi.
- [ ] fail → implement → pass → commit `core: config store atomic`.

### Task 4: tree (watch-entry model)

**Files:** `js/core/tree.js`, `tests/tree.test.js`

**Entry:** `{ id, parentId, path, sub, label, binNodeId, parentBinNodeId, excluded: [] }` (excluded chỉ dùng ở entry gốc).

**Produces:**
- `newId(): string`
- `addRoot(entries, {path, sub=true, label=-1, parentBinNodeId=null}): entry` (trùng pathkey với entry có sẵn → trả entry cũ, không thêm)
- `addChild(entries, parent, path): entry` (thừa hưởng `sub`, `label`)
- `children(entries, id)`, `descendants(entries, id)`, `rootOf(entries, entry)`
- `setSetting(entries, id, key: 'sub'|'label', value)` → ghi cho entry và mọi con cháu
- `remove(entries, id)` → trả mảng mới; nếu entry không phải gốc → thêm `relativeTo(entry.path, root.path)` vào `root.excluded`
- `isExcluded(root, absPath): boolean`
- `relink(entries, id, newPath)` → đổi path entry + con cháu theo đường dẫn tương đối; trả `{oldRoot, newRoot}`
- `entryForPath(entries, absPath)` → entry sâu nhất chứa absPath

Tests: thêm gốc + 2 cấp con; setSetting label ở gốc lan xuống; đổi riêng con sau đó giữ; remove con → excluded có `Day 01`; relink gốc `/old/A` → `/new/A` làm con `/new/A/Day 01`; entryForPath chọn sâu nhất; addRoot trùng (khác hoa/thường) trả entry cũ.
- [ ] fail → implement → pass → commit `core: tree watch-entries (thừa hưởng, excluded, relink)`.

### Task 5: scanner + stability

**Files:** `js/core/scanner.js`, `js/core/stability.js`, tests tương ứng

**Produces:**
- `async scan(rootAbs, {sub, isIgnoredFolder, isAllowed, isExcluded}) → { dirs: string[] (abs, gồm root), files: [{path, size, mtimeMs}] }` — dùng `fs.promises.readdir(withFileTypes)` + `stat`; lỗi đọc thư mục con → bỏ qua thư mục đó (ghi `errors[]`); `sub=false` → chỉ cấp 1, không thư mục con; bỏ symlink vòng (theo dõi realpath đã thăm).
- `createStabilityTracker({gapMs})` → `{ observe(files, now): stableFiles[], forget(pathkey) }` — file "ổn định" khi đã thấy ≥ 2 lần, size/mtime không đổi, lần đầu cách ≥ gapMs, size > 0. Trả mỗi file ổn định **một lần** cho tới khi `forget` hoặc size/mtime đổi.

Tests: cây tạm với thư mục rỗng, `untitled folder`, file `.tmp`, `.prproj`; `sub:false`; stability: lần 1 → []; lần 2 sau 2 s cùng size → [f]; lần 3 → [] (đã nhả); size đổi → reset.
- [ ] fail → implement → pass → commit `core: scanner + stability`.

### Task 6: planner + notify

**Files:** `js/core/planner.js`, `js/core/notify.js`, tests

**Produces:**
- `plan({entries, rootEntry, scan, index: Set<pathkey>, rejected: Map<pathkey, mtimeMs>}) → { newDirs: string[] (abs, chưa có entry), imports: [{entryId, path}], skipped: number }`
  - `newDirs`: thư mục con trong scan chưa có entry, không excluded, và cha của nó có `sub=true`.
  - `imports`: file trong scan, pathkey ∉ index, không (rejected cùng mtime); gán entry = `entryForPath`.
- `groupByEntry(imports) → Map<entryId, path[]>`; `chunk(arr, n)`.
- `notify.summary({files, folders, binNames}) → string`: `"3 file, 1 thư mục con đã thêm vào: SFX, Footage"`; folders=0 bỏ vế; files=0 & folders>0 → `"2 thư mục con đã thêm vào: …"`; cả hai 0 → `"Không có file mới"`. Tối đa 5 tên bin rồi `"… và N bin khác"`.

Tests: file có trong index (khác hoa/thường/NFC) bị loại; rejected cùng mtime loại, khác mtime giữ; thư mục con dưới entry `sub=false` không vào newDirs; chunk(120,50) → [50,50,20]; các câu notify.
- [ ] fail → implement → pass → commit `core: planner + notify`.

### Task 7: watchmode + drive

**Files:** `js/core/watchmode.js`, `js/core/drive.js`, tests

**Produces:**
- `parseMount(stdout) → [{mountPoint, fstype}]` (dòng `/dev/x on /Volumes/X (exfat, local, …)`).
- `modeFor(absPath, mounts, home) → 'poll' | 'watch'` — poll nếu dưới `${home}/Library/CloudStorage/`, `${home}/Google Drive/`, `/Volumes/GoogleDrive`, hoặc mount sâu nhất chứa path có fstype ∈ {smbfs, afpfs, nfs, webdav, exfat, msdos}.
- `splitDrivePath(absPath) → {prefix, rest} | null` — rest bắt đầu `My Drive/`, `Shared drives/`, `Other computers/` (cũng chấp nhận bản Việt hoá `Drive của tôi/`, `Bộ nhớ dùng chung/`).
- `async candidates(rest, {home, readdir, exists}) → string[]` — với mỗi `GoogleDrive-*` trong `${home}/Library/CloudStorage` ghép rest; giữ cái `exists` (async, có timeout do caller truyền).
- `async autoRelink(absPath, deps) → {status: 'ok', newPath} | {status: 'none'|'ambiguous'|'not-drive'}`.

Tests: mount output mẫu có exfat + smbfs; CloudStorage → poll; `/Users/u/Movies` → watch; `/Volumes/SSD` exfat → poll; split cho 3 dạng tiền tố; autoRelink với deps giả: 1 ứng viên → ok, 2 → ambiguous, 0 → none, đường dẫn thường → not-drive.
- [ ] fail → implement → pass → commit `core: watchmode + tự relink Google Drive`.

### Task 8: linkbins

**Files:** `js/core/linkbins.js`, test

**Input** (từ `FS_describeBins`): `{ nodeId, name, children: [BinNode], sample: string|null }`.
**Produces:** `inferRoot(binTree) → string | null` — duyệt mọi bin có `sample`, chuỗi tên từ gốc (không gồm tên gốc) xuống bin đó `[b1..bk]`; `dir = dirname(sample)`; nếu k thư mục cuối của dir khớp `b1..bk` (pathkey basename) → ứng viên = phần đầu; trả ứng viên đầu tiên; không có → null. `mapBins(binTree, rootFolder) → [{nodeId, folder, relPath}]` (gồm gốc, relPath '' cho gốc).

Tests: cây `Assets > 01_Video > Day 01 (sample /x/Assets/01_Video/Day 01/a.mov)` → `/x/Assets`; bin gốc tên khác folder (`Footage` ↔ `/x/Assets`) vẫn ra `/x/Assets`; file mẫu lệch cấu trúc (bin `Day 01` chứa file ở `/y/z/a.mov`) bị bỏ, dùng bin khác; không sample → null.
- [ ] fail → implement → pass → commit `core: linkbins suy đường dẫn từ cây bin`.

### Task 9: host.jsx + fake Premiere + bridge

**Files:** `jsx/host.jsx`, `tests/fake-premiere.js`, `tests/host.test.js`, `js/engine/bridge.js`, `tests/es3-keywords.test.js`

host.jsx: JSON polyfill (ES3 không có JSON — dùng bản json2 tối giản), các hàm §4.5 của spec + `FS_relinkMedia`. Duyệt cây bằng `ProjectItemType.BIN` (=2), `CLIP` (=1), `FILE` (=4). `FS_ensureBins(docId, json)` với json `{rootParentNodeId, items:[{key, parentKey|null, parentNodeId|null, name, nodeId|null}]}` theo thứ tự cha trước con → trả `{key: nodeId}`. `FS_importBatch(docId, json)` với `{binNodeId, paths:[], label}` → so số con của bin trước/sau để lấy item mới, `setColorLabel(label)` nếu ≥ 0, trả `{imported, rejected}` (rejected = path không xuất hiện trong media path của bin sau import).

tests/host.test.js chạy host.jsx trong `vm` với fake `app` (fake-premiere.js mô phỏng `app.projects`, `rootItem.children`, `createBin`, `importFiles`, `getMediaPath`, `setColorLabel`, `changeMediaPath`, `canChangeMediaPath`, `nodeId`, `getProjectViewSelection`): ensureBins dùng lại bin trùng tên; tạo lại khi nodeId mất; importBatch gán label; relinkMedia chỉ đổi item offline có file mới tồn tại (fake `File(path).exists`).
bridge.js: `call(fnName, ...args) → Promise<any>` qua `csInterface.evalScript`, escape JSON an toàn, parse kết quả, `{error}` → reject.
es3-keywords test: regex các từ cấm làm identifier trong host.jsx → không có.
- [ ] fail → implement → pass → commit `host.jsx + fake Premiere DOM + bridge`.

### Task 10: engine

**Files:** `js/engine/engine.js`, `js/engine/boot.js`, `engine.html`, `tests/engine.test.js`

**Produces:** `createEngine({store, host, fsDeps, clock, emit, log}) → { start(), stop(), syncAll({manual}), syncProject(docId, {manual}), abort(), addFolders(docId, paths, parentBinNodeId), linkBin(docId, binNodeId, folder?), relinkEntry(docId, entryId, newPath), status() }`
- `host` = đối tượng có các hàm async ứng với host.jsx (bridge thật hoặc fake).
- Hàng đợi: `queue = promise chain`; mọi tác vụ đi qua `enqueue(fn)`.
- syncProject: theo spec §4.3 (online check async timeout 3 s → autoRelink → scan → plan → stability → refresh index → ensureBins (gồm newDirs, entries thiếu binNodeId hoặc nodeId mất) → importBatch theo chunk 50, emit PROGRESS, kiểm tra cờ abort → lưu nodeId/entry mới qua `store.update` → summary → emit STATUS + thông báo (`host.notify(msg)`) khi (manual) hoặc (imported > 0)).
- 3 lỗi liên tiếp/entry → `entry._paused` (runtime) + status lỗi.
- boot.js: dựng engine thật (bridge, fs, setInterval poll mỗi 5 s gọi syncAll khi autoSync, fs.watch recursive cho entry mode 'watch' + debounce), lắng CSEvent COMMAND (`{cmd:'sync'|'abort'|'add'|'link'|'relink'|'toggle'}`), phát STATUS định kỳ (heartbeat 3 s).

tests/engine.test.js với fake host + thư mục tạm: thêm folder → tạo bin cây + import đủ; chạy lại → 0 import; file "import tay" (thêm vào fake project) → không trùng; 120 file → 3 đợt, abort sau đợt 1 → 50 import, lượt sau đủ; bin bị xoá → tạo lại; folder offline có Drive ứng viên → relink + relinkMedia được gọi; manual sync không có gì → notify "Không có file mới"; auto không có gì → không notify.
- [ ] fail → implement → pass → commit `engine: hàng đợi, sync, chia đợt + huỷ, relink`.

### Task 11: Panel chính + Settings + tooltip

**Files:** `panel.html`, `css/style.css`, `js/panel/{tips,common,main,settings}.js`

- Layout spec §5.1, CSS biến màu từ Resizer (`--bg … --accent:#35E07E`). Tooltip `[data-tip]` hover (CSS + JS định vị trong khung panel).
- main.js: nút WATCH (toggle `autoSync` qua `store.update` + CSEvent CONFIG_CHANGED), SYNC (COMMAND sync manual), 📁 (`requestOpenExtension('com.foldersync.panel.manager')`), ⚙; nghe STATUS/PROGRESS cập nhật dòng trạng thái + nút Huỷ; heartbeat > 10 s → báo đỏ; nếu không thấy heartbeat 4 s sau khi mở → `requestOpenExtension(engine)`.
- Kéo-thả: `dragenter` → overlay; `drop` lấy `e.dataTransfer.files[i].path` (thư mục: `fs.statSync().isDirectory()`); gửi COMMAND add với `parentBinNodeId` từ `FS_getSelectedBin`. Nếu drop không có file nhưng có dữ liệu text (bin từ Project panel) → log dữ liệu + thử parse nodeId (spike); không parse được → hint "Chọn bin rồi bấm Liên kết bin trong cửa sổ quản lý".
- settings.js: 3 control theo spec §5.1, lưu ngay khi đổi (blur/change), nút "Mặc định".
- Kiểm tra thủ công trong Premiere (không có test tự động UI).
- [ ] implement → `npm test` vẫn xanh → commit `panel chính + settings + tooltip`.

### Task 12: Cửa sổ quản lý

**Files:** `manager.html`, `js/panel/manager.js`

- Bảng cây theo spec §5.2, trạng thái đọc từ STATUS (`entries[id].state`). Bản nháp trong bộ nhớ, chỉ `store.update` khi OK. SUB/Label dùng `tree.setSetting`; ✕ dùng `tree.remove`; click Path → `cep.fs.showOpenDialogEx(false, true, …)` → `tree.relink` (lưu `pendingRelinks` để engine gọi relinkMedia khi OK); "+ Thêm folder" → `showOpenDialogEx(true, true)`; "Liên kết bin đang chọn" → COMMAND link; ⌥+click mũi tên → gập/mở tất cả; kéo-thả folder.
- [ ] implement → commit `cửa sổ quản lý watch-folder`.

### Task 13: Tài liệu + push

**Files:** `README.md`, `docs/TEST-CHECKLIST.md`

- README VI/EN: cài đặt (`git clone` + `./install.sh`), cách dùng 3 nút, bảng tooltip, hành vi chống trùng (gồm "xoá trong Premiere sẽ quay lại"), giới hạn v1.
- TEST-CHECKLIST: 15 bước (12 đã duyệt + relink tay, tự relink Drive, liên kết bin SAMX).
- [ ] `npm test` xanh → commit → `git push`.

---

## Self-review
- Spec §1 mục 1–10 → Task 11/12 (UI), 3–6/10 (lõi), 9 (host), 7 (Drive), 8+10+12 (link bins), 4+10+12 (relink). §7 lỗi → Task 3, 10. §8 test → mọi task + Task 13.
- Tên thống nhất: `pathkey`, `entryForPath`, `setSetting`, `relink`, `autoRelink`, `inferRoot`, `mapBins`, `FS_*`.
- Spike (engine tự khởi động, importFiles vào project không active, dữ liệu kéo bin) kiểm chứng ở Task 11 khi chạy trong Premiere; mỗi spike đã có đường dự phòng trong spec.
