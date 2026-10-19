# Folder Sync — Thiết kế v1

> Clone tính năng lõi của **Watchtower** (Knights of the Editing Table) cho **Premiere Pro**, tối ưu cho team làm việc trên **Google Drive**.
> Ngày: 2026-10-19 · Trạng thái: đã duyệt qua brainstorming · Repo: `snow1202/folder-sync` (public)

## 1. Mục tiêu

Tự đồng bộ **một chiều, chỉ thêm** từ thư mục trên ổ đĩa vào Project panel của Premiere:
dựng lại cây thư mục thành cây bin, import file mới ngay khi xuất hiện, không bao giờ import trùng,
chạy ngầm kể cả khi đóng panel.

Nguyên tắc UI: **đơn giản, dễ hiểu, dễ dùng, hiệu quả cao** — chỉ giữ chức năng lõi, nhưng mọi control đều có tooltip tiếng Việt.

### Trong phạm vi v1
1. Thêm watch-folder: kéo-thả folder từ Finder vào panel / cửa sổ quản lý, hoặc nút "Thêm folder" (chọn nhiều).
2. Cây thư mục → cây bin (kể cả thư mục rỗng); import file mới; chống trùng toàn project.
3. Nút **WATCH** (bật/tắt tự đồng bộ), **SYNC** (đồng bộ tay), **📁** (cửa sổ quản lý).
4. Cài đặt mỗi folder: **SUB**, **Label** (16 màu Premiere), thừa hưởng cha → con.
5. Settings: Show notifications, Allowed Files, Ignored Folders (tên hoặc `/regex/`, không phân biệt hoa/thường).
6. Chạy ngầm (extension ẩn), hỗ trợ nhiều project mở cùng lúc.
7. Import theo đợt có thanh tiến trình + nút Huỷ.
8. **Relink offline folders**: đổi đường dẫn folder cha → folder con tự relink.
9. **Link existing bins**: gắn bin có sẵn trong project với folder trên ổ (suy ra đường dẫn từ file bên trong).
10. **Tự relink Google Drive** (bổ sung, bản gốc không có).

### Ngoài phạm vi v1 (đợt sau)
SEQ (image sequence), FLT (gộp thư mục con), nhận diện folder camera, REL (đường dẫn tương đối),
Import Date metadata, Jumper, After Effects, Windows (code viết trung lập nhưng không test),
installer/auto-update/changelog (sẽ copy khuôn từ 1-Click Resizer).

## 2. Hành vi (đã chốt với user)

| Chủ đề | Quyết định |
|---|---|
| Chiều đồng bộ | Một chiều, chỉ thêm. Không bao giờ xoá/di chuyển/đổi tên item trong project. File mất trên ổ → item thành offline như bình thường. |
| Ngoại lệ duy nhất | Khi relink folder (tay hoặc tự relink Drive), item **đang offline** có file tương ứng ở đường dẫn mới được nối lại (`changeMediaPath`) để không import trùng — §6.1. |
| Chống trùng | So **đường dẫn file** (chuẩn hoá NFC, không phân biệt hoa/thường) với **mọi** media trong project, bất kể item nằm ở bin nào. |
| Xoá item trong Premiere | Nếu file còn trên ổ, lượt sync sau sẽ import lại (giống bản gốc). Muốn bỏ hẳn: xoá/di chuyển file trên ổ, hoặc thêm vào Ignored Folders. Ghi rõ trong tooltip ✕/README. |
| Di chuyển / đổi tên bin | Tự do. Mỗi cặp folder↔bin nhớ bằng `nodeId`, file mới vẫn vào đúng bin. Bin bị xoá → tạo lại trong bin cha cũ (mất cả cha → gốc project). |
| Vị trí bin khi thêm folder | Trong bin **đang chọn** ở Project panel (không chọn → gốc). Nếu đã có bin con cùng tên → **dùng lại**. |
| Thư mục rỗng | Vẫn tạo bin (cây bin luôn giống cây thư mục, trừ folder bị Ignore). |
| File Drive "ảo" (chưa tải) | Import ngay; Premiere tự tải khi dùng. |
| File đang ghi/tải | Chỉ import khi size + mtime không đổi qua 2 lần quan sát cách ≥ 2 giây và size > 0. |
| `.prproj` / `.aep` | Không nằm trong Allowed Files mặc định. |
| Hộp thoại import PSD/AI | Luôn bỏ qua (`suppressUI = true`). |
| Thông báo | Tự đồng bộ: chỉ báo khi có import. SYNC tay: luôn báo (kể cả "Không có file mới"). Mẫu: `3 file, 1 thư mục con đã thêm vào: SFX, Footage`. |

## 3. Kiến trúc

CEP extension (Node bật), 3 extension trong một bundle `com.foldersync.panel`:

| Extension | Loại | Vai trò |
|---|---|---|
| `com.foldersync.panel.main` | Panel (~360×300) | Window › Extensions › Folder Sync. Nút WATCH/SYNC/📁/⚙, dòng trạng thái, vùng thả. |
| `com.foldersync.panel.manager` | Modeless (~860×540, kéo giãn được) | Cửa sổ quản lý watch-folder. |
| `com.foldersync.panel.engine` | Custom, ẩn, `StartOn` = `com.adobe.csxs.events.ApplicationActivate` | Theo dõi folder + điều phối import, sống suốt phiên Premiere. |

Panel và manager **không** gọi import trực tiếp — chỉ sửa config và gửi lệnh qua CSEvent; engine là nơi duy nhất ghi vào project.
Dự phòng: nếu engine không tự khởi động, panel gọi `requestOpenExtension('com.foldersync.panel.engine')` khi mở.

### 3.1 Cấu trúc file

```
com.foldersync.panel/
  CSXS/manifest.xml
  panel.html  manager.html  engine.html
  css/style.css                     (phong cách 1-Click Resizer, copy)
  js/lib/CSInterface.js, theme.js   (copy từ Resizer)
  js/core/                          (thuần Node, test bằng `node --test`)
    config.js     đọc/ghi JSON atomic, mặc định, migrate, khớp project
    filters.js    Allowed Files, Ignored Folders (+/regex/), file tạm
    pathkey.js    chuẩn hoá đường dẫn để so trùng
    scanner.js    duyệt folder → file + thư mục con (tôn trọng SUB/ignore)
    stability.js  theo dõi size/mtime, nhả file đã "đứng yên"
    planner.js    so với chỉ mục → kế hoạch (bin cần tạo, file → bin, label)
    tree.js       mô hình cây watch-entry: thêm/xoá/thừa hưởng/relink
    drive.js      nhận diện + tự relink đường dẫn Google Drive
    linkbins.js   suy đường dẫn folder từ cây bin có file
    notify.js     dựng câu thông báo
  js/engine/  watcher.js  bridge.js  engine.js
  js/panel/   main.js  manager.js  settings.js  tips.js
  jsx/host.jsx                      (ExtendScript ES3 — chỉ thao tác project)
tests/        *.test.js (node:test) + fake Premiere DOM
install.sh    copy vào ~/Library/Application Support/Adobe/CEP/extensions + bật PlayerDebugMode
```

### 3.2 Config — `~/Library/Application Support/FolderSync/config.json`

```json
{
  "version": 1,
  "autoSync": true,
  "settings": {
    "notifications": true,
    "allowedExt": ["mp4", "mov", "..."],
    "ignoredFolders": ["untitled folder", "New folder", "/\\.download$/", "..."]
  },
  "projects": {
    "<documentID>": {
      "path": "/…/MyProject.prproj",
      "name": "MyProject.prproj",
      "entries": [
        {
          "id": "e1", "parentId": null,
          "path": "/Users/…/GoogleDrive-a@b.com/Shared drives/SAMX/Sources/SFX",
          "sub": true, "label": -1,
          "binNodeId": "000f4241", "parentBinNodeId": "000f4240",
          "excluded": []
        }
      ]
    }
  }
}
```

- Ghi atomic: ghi `config.json.tmp` rồi `rename`. Đọc lỗi JSON → đổi tên `config.broken-<timestamp>.json`, tạo mới, báo một lần.
- Khớp project: theo `documentID`; không khớp nhưng trùng `path` → cập nhật ID.
- `label`: -1 = None, 0..15 = chỉ số label Premiere (Violet, Iris, Caribbean, Lavender, Cerulean, Forest, Rose, Mango, Purple, Blue, Teal, Magenta, Tan, Green, Brown, Yellow).
- `excluded`: đường dẫn tương đối các thư mục con user đã ✕ — không tự thêm lại.
- Log xoay vòng: `~/Library/Application Support/FolderSync/logs/engine.log` (≤ 1 MB × 2).

### 3.3 Mô hình cây watch-entry (`tree.js`)

- Mỗi thư mục được theo dõi là **một entry** (một dòng trong manager). Entry gốc có `parentId = null`.
- **SUB bật** → thư mục con mới phát hiện được thêm thành entry con, thừa hưởng `sub` + `label` của cha. **SUB tắt** → không thêm thư mục con mới (entry con đã có vẫn giữ, có thể ✕).
- **Thừa hưởng khi sửa:** đổi SUB/Label ở entry cha → ghi đè cho mọi entry con cháu. Sau đó entry con vẫn sửa riêng được.
- **✕** một entry → bỏ entry và toàn bộ con cháu khỏi config; nếu entry có cha → thêm vào `excluded` của entry gốc. Bin và item đã import giữ nguyên.
- **Relink:** đổi `path` của entry E → mọi entry con cháu = `newPath + (path cũ tương đối so với E)`.

## 4. Luồng sync

### 4.1 Kích hoạt
- `fs.watch` (recursive) báo thay đổi → debounce 1,5 s.
- Nhịp quét: 5 s cho folder trên Drive/mạng/ExFAT; 30 s (lưới an toàn) cho ổ cục bộ.
- SYNC tay; project vừa mở/chuyển active (engine hỏi danh sách project mỗi 5 s, rẻ); config đổi (CSEvent `com.foldersync.config-changed`).
- **Một hàng đợi toàn cục**: không bao giờ có 2 lượt gọi ExtendScript chồng nhau.

### 4.2 Chọn cơ chế theo dõi (`watcher.js`)
Quét định kỳ nếu đường dẫn nằm trong `~/Library/CloudStorage/`, `/Volumes/GoogleDrive*`, `~/Google Drive/`, hoặc ổ `/Volumes/*` có fstype `smbfs|afpfs|nfs|webdav|exfat|msdos` (đọc từ `mount`). Còn lại: `fs.watch` + quét 30 s.

### 4.3 Một lượt cho project P
1. Lấy entries của P. Kiểm tra từng entry online (async `fs.stat`, timeout 3 s — tránh treo mount Drive cũ). Offline → thử **tự relink Drive** (§6.3); thất bại → đánh dấu offline, bỏ qua entry.
2. Quét entry (SUB → thêm entry con mới theo §3.3), lọc Ignored Folders, file tạm, Allowed Files.
3. Lọc nhanh với **chỉ mục trong bộ nhớ** (Set các pathkey). Không có ứng viên → dừng, không gọi Premiere.
4. Ứng viên qua `stability`. Chưa ổn định → chờ lượt sau.
5. Có ứng viên ổn định → **làm mới chỉ mục** (`FS_listMediaPaths`) rồi lọc lại (bắt file user vừa import tay).
6. `planner` lập kế hoạch: entry → bin (tạo nếu thiếu, theo §2), file → bin của entry chứa trực tiếp, label của entry đó.
7. `FS_ensureBins` → nhận `nodeId` → lưu vào config.
8. `FS_importBatch` theo **đợt 50 file**; sau mỗi đợt phát tiến trình; kiểm tra cờ Huỷ giữa các đợt. File Premiere từ chối → ghi `rejected[pathkey] = mtime`, chỉ thử lại khi mtime đổi.
9. Cập nhật chỉ mục, phát trạng thái, thông báo (`app.setSDKEventMessage`) theo §2.

### 4.4 Nhiều project
Engine lặp mọi project đang mở. Mỗi lệnh ExtendScript nhận `documentID` và tìm project tương ứng trong `app.projects`.
**Cần kiểm chứng (spike đầu tiên):** `Project.importFiles` có import vào project không active không. Nếu không → chỉ sync project active; project khác được đánh dấu "chờ" và sync khi được kích hoạt.

### 4.5 `host.jsx` (ES3, không dùng từ khoá cấm như `short`, `class`, `int`…)
| Hàm | Trả về |
|---|---|
| `FS_listProjects()` | `[{documentID, path, name, active}]` |
| `FS_listMediaPaths(docId)` | mọi `getMediaPath()` khác rỗng trong project |
| `FS_getSelectedBin(docId)` | `{nodeId, treePath}` của bin đang chọn (hoặc gốc) |
| `FS_ensureBins(docId, planJSON)` | `{relPath: nodeId}` — tìm theo nodeId, rồi theo tên trong bin cha, rồi tạo |
| `FS_importBatch(docId, batchJSON)` | `{imported:[path], rejected:[path]}`; `importFiles(paths, true, bin, false)` + `setColorLabel` |
| `FS_describeBins(docId, nodeIds)` | cây bin con + một đường dẫn media mẫu mỗi bin (cho Link existing bins) |
| `FS_findItem(docId, nodeId)` | có tồn tại không, tên, nodeId cha |
| `FS_relinkMedia(docId, oldRoot, newRoot)` | `{relinked: n, skipped: n}` — §6.1 |

Mọi hàm trả JSON string, bọc `try/catch`, lỗi → `{error: "..."}`.

## 5. Giao diện

### 5.1 Panel chính
```
┌ FOLDER SYNC ─────────────── v1.0.0 ┐
│  [👁 WATCH]   [⟳ SYNC]   [📁]       │
│  Kéo folder vào đây · → bin: Asset  │
├─────────────────────────────────────┤
│ ⚙                ● ĐÃ SYNC 14:02 +3 │
└─────────────────────────────────────┘
```
- WATCH sáng accent khi bật; con mắt gạch chéo khi tắt.
- Kéo folder (hoặc bin từ Project panel) vào → **cả panel** phủ xanh viền nét đứt: "Thả folder để theo dõi" / "Thả bin để liên kết".
- Đang import: dòng trạng thái thành thanh tiến trình `Đang import 1.250 / 4.000` + nút **Huỷ**.
- Chưa có folder nào: hiện 3 bước hướng dẫn nhanh (chọn bin → kéo folder vào → bật WATCH).
- Engine không phản hồi > 10 s: dòng trạng thái đỏ "Engine chưa chạy — khởi động lại Premiere".
- ⚙ → view Settings trượt vào (như Resizer): Show notifications, Allowed Files (ô chữ, phân tách dấu phẩy, nút "Mặc định"), Ignored Folders (ô chữ, mỗi dòng một mục, nút "Mặc định").

### 5.2 Cửa sổ quản lý
Cột: ● trạng thái · Tên (cây, ▸ gập/mở, ⌥+click gập/mở tất cả) · Path (rút gọn giữa, hover xem đủ, **click để đổi = relink**) · SUB · Label · ✕.
Nhóm theo project (`MyProject.prproj`). Dưới: **+ Thêm folder** (chọn nhiều) · **Liên kết bin đang chọn** · **Huỷ** · **OK** (thay đổi chỉ lưu khi OK). Nhận kéo-thả folder.
Chấm: xanh = bình thường, đỏ = offline (Path viền đỏ), vàng = đang quét/import.

### 5.3 Tooltip
Mọi nút/cột/ô đều có `data-tip` tiếng Việt, trả lời "làm gì" + "khi nào dùng" (nội dung chuẩn trong `js/panel/tips.js`, xem danh sách đã duyệt trong brainstorming: WATCH, SYNC, 📁, vùng thả, dòng trạng thái, SUB, Label, ✕, ●, Path, Allowed Files, Ignored Folders, Show notifications, Liên kết bin).

## 6. Ba tính năng bổ sung

### 6.1 Relink offline folders
Click Path của entry (thường là entry đỏ) → hộp chọn folder → `tree.relink(entry, newPath)` → mọi con cháu đổi theo đường dẫn tương đối → kiểm tra online lại → OK lưu. Bin mapping (`nodeId`) giữ nguyên.

Vấn đề: sau khi đổi gốc, mọi file có pathkey mới nên sẽ bị coi là file mới và import trùng. Cách xử lý: trước lượt sync đầu tiên sau relink, engine gọi `FS_relinkMedia(docId, oldRoot, newRoot)` — với mỗi item trong project có media path nằm dưới `oldRoot`, **đang offline**, và file tương ứng dưới `newRoot` tồn tại → `changeMediaPath` sang đường dẫn mới. Item đang online hoặc không có file tương ứng thì không đụng tới. Đây là ngoại lệ duy nhất của nguyên tắc "không sửa item": chỉ nối lại item đã offline về đúng file của nó, không xoá, không di chuyển.

### 6.2 Link existing bins
Vào: kéo bin từ Project panel thả vào panel/manager (nếu Premiere cung cấp dữ liệu kéo — **spike**), hoặc chọn bin rồi bấm **Liên kết bin đang chọn** (luôn có).
Thuật toán (`linkbins.js`) cho bin gốc B:
1. `FS_describeBins` → cây bin con của B, mỗi bin kèm một media path mẫu (nếu có).
2. Lấy bin X bất kỳ có file mẫu `F`; chuỗi tên bin từ B xuống X là `[b1..bk]`. Nếu `dirname(F)` kết thúc bằng các thư mục trùng tên (không phân biệt hoa/thường, NFC) `b1..bk` → folder của B = phần còn lại phía trước. Thử lần lượt các bin có file cho tới khi tìm được ứng viên nhất quán.
3. Mỗi bin con được map tới `folder(B)/b1/…` nếu thư mục đó tồn tại; không tồn tại → không theo dõi bin đó (báo trong manager).
4. Không bin nào có file → mở hộp chọn folder cho B, bin con map theo tên.
5. Tạo entries với `binNodeId` = bin có sẵn → lượt sync sau chỉ import file còn thiếu (file đã có không bị trùng nhờ chống trùng toàn project).

### 6.3 Tự relink Google Drive (`drive.js`)
- Nhận diện tiền tố Drive: `…/Library/CloudStorage/GoogleDrive-<account>/`, `/Users/<u>/Google Drive/` (mount cũ), `/Volumes/GoogleDrive/`. Phần sau là `My Drive/…`, `Shared drives/…` hoặc `Other computers/…`.
- Ứng viên trên máy hiện tại: mọi `~/Library/CloudStorage/GoogleDrive-*` + phần sau. **Không** stat đường dẫn mount cũ một cách đồng bộ (đã biết là có thể treo); mọi kiểm tra là async có timeout.
- Đúng 1 ứng viên tồn tại → relink như §6.1 (cả entry lẫn media offline), log + báo một dòng "Đã tự relink theo Google Drive của máy này". 0 hoặc > 1 → giữ offline, tooltip gợi ý relink tay.

## 7. Xử lý lỗi

| Tình huống | Xử lý |
|---|---|
| Folder offline | ● đỏ, bỏ qua; có lại thì tự chạy tiếp. Thử tự relink Drive trước. |
| Premiere từ chối file | Ghi trạng thái; chỉ thử lại khi mtime đổi. |
| Bin bị xoá/di chuyển | Tìm theo `nodeId`; mất → tạo lại (§2). |
| ExtendScript lỗi | Log; thử lại lượt sau; 3 lần liên tiếp → tạm dừng entry đó + báo đỏ. |
| Config hỏng | §3.2. |
| Hai phiên Premiere | Mỗi phiên chỉ sync project của nó; ghi config atomic + đọc lại trước khi ghi (merge theo project). |
| Huỷ import | Dừng sau đợt hiện tại; file đã vào giữ nguyên; phần còn lại vào lượt sau. |

## 8. Kiểm thử

**Tự động (`npm test`, node:test, không cần Premiere):** filters, pathkey (NFC/NFD tiếng Việt), scanner (thư mục tạm), stability, planner, tree (thừa hưởng, ✕/excluded, relink), config (atomic, hỏng, khớp project), watcher (chọn cơ chế với output `mount` giả), drive (các dạng tiền tố, 0/1/nhiều ứng viên), linkbins (suy đường dẫn, bin không có file), notify (câu thông báo), engine với **fake Premiere DOM** (hàng đợi, làm mới chỉ mục trước import, chia đợt + huỷ, bin bị xoá, lỗi 3 lần). Thêm test quét từ khoá cấm ES3 trong `host.jsx`.

**Checklist tay** (`docs/TEST-CHECKLIST.md`): 12 bước đã duyệt + 3 bước mới (relink tay; tự relink Drive bằng cách đổi tên tiền tố trong config; liên kết bin có sẵn kiểu SAMX).

**Hoàn thành v1:** `npm test` xanh, checklist đạt trên máy user, code đã push lên `snow1202/folder-sync`.

## 9. Thứ tự triển khai
1. Khung repo + manifest 3 extension + `install.sh`; spike: engine tự khởi động, `importFiles` vào project không active, dữ liệu kéo bin.
2. `js/core/*` + test.
3. `host.jsx` + bridge + engine + fake DOM test.
4. Panel chính + Settings + tooltip.
5. Cửa sổ quản lý.
6. Relink (§6.1) → Tự relink Drive (§6.3) → Link existing bins (§6.2).
7. README (VI/EN), TEST-CHECKLIST, push.
