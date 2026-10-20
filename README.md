<h1 align="center">Folder Sync</h1>

<p align="center"><b>Premiere Pro panel — tự đồng bộ thư mục trên ổ đĩa (kể cả Google Drive) vào Project panel.</b><br/>
<i>Auto-sync disk folders (Google Drive included) into Premiere Pro bins.</i></p>

<p align="center">
  <a href="#-tiếng-việt">🇻🇳 Tiếng Việt</a> · <a href="#-english">🇬🇧 English</a>
</p>

---

## 🇻🇳 Tiếng Việt

Cây thư mục trên ổ thường giống hệt cây bin trong project. Mỗi lần có file mới (đồng nghiệp up lên Drive, render xong, tải nhạc/SFX…) bạn phải import tay rồi kéo vào đúng bin. **Folder Sync làm việc đó tự động**:

- **Dựng lại cây thư mục thành cây bin** (kể cả thư mục rỗng) và import mọi file.
- **Phát hiện file mới và import ngay** — kể cả khi bạn đóng panel (phần đồng bộ chạy ngầm cùng Premiere).
- **Không bao giờ import trùng** — so theo đường dẫn file với *toàn bộ* project, kể cả file bạn đã import tay hoặc đã kéo sang bin khác.
- **Chỉ thêm, không bao giờ xoá/di chuyển** gì trong project. Bin có thể đổi tên/di chuyển thoải mái — file mới vẫn vào đúng bin.
- **Chờ file ghi/tải xong** mới import. Folder trên Google Drive/ổ mạng/ExFAT được quét định kỳ (5 giây) vì các ổ này hay "quên" báo thay đổi.
- **Label màu** cho từng folder (Whoosh xanh, Drone xanh dương…), folder con tự theo cha.
- **Relink folder offline**: chọn lại folder cha, folder con tự đổi theo, clip offline được nối lại.
- **Tự relink Google Drive** khi mở project trên máy khác/tài khoản khác (`…/GoogleDrive-<email>/Shared drives/…`).
- **Liên kết bin có sẵn**: chỉ cần một file trong cây bin là tự tìm ra folder cho cả cây — không tạo bin trùng.
- Bỏ qua hộp thoại import PSD/AI; import theo đợt có thanh tiến trình + nút Huỷ.

### Cài đặt (macOS)

**Cách nhanh nhất** — mở Terminal, dán lệnh sau rồi Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/snow1202/folder-sync/main/web-install.sh | bash
```

Hoặc tải **[Folder-Sync-Installer.zip](https://github.com/snow1202/folder-sync/releases/latest/download/Folder-Sync-Installer.zip)**, giải nén, chuột phải vào app → Open.

Xong thì thoát hẳn Premiere (Cmd+Q) rồi mở lại → **Window › Extensions › Folder Sync**.

### Cập nhật

Có bản mới, panel tự hiện thanh **"Có bản mới — ↑ Cập nhật"**. Bấm là xong:
- Bản mới chỉ đổi giao diện → panel tự tải lại.
- Bản mới đổi phần đồng bộ ngầm → panel báo **"thoát hẳn Premiere (Cmd+Q) rồi mở lại"**; cho tới khi khởi động lại, phần đồng bộ ngầm vẫn chạy bản cũ.

Xem các thay đổi: nút **Changelog** cạnh số phiên bản.

### Dùng thế nào

| Nút | Làm gì |
|---|---|
| 👁 **WATCH** | Bật/tắt tự đồng bộ. Bật một lần là xong — đóng panel vẫn chạy. |
| ⟳ **SYNC** | Quét ngay và import file còn thiếu. |
| 📁 | Danh sách folder: SUB (lấy thư mục con), Label, ✕ bỏ theo dõi, bấm đường dẫn để relink, Thêm folder, Liên kết bin đang chọn. |
| ⚙ | Cài đặt (3 tab: Chung / Loại file / Folder bỏ qua, hỗ trợ `/regex/`). |

**Thêm folder:** chọn bin đích trong Project panel → kéo folder từ Finder thả vào panel. Mọi nút đều có tooltip — đưa chuột vào để xem.

> Lưu ý: xoá một clip trong Premiere mà file vẫn còn trên ổ → lần SYNC sau clip quay lại (giống Watchtower). Muốn bỏ hẳn: xoá/di chuyển file trên ổ, hoặc thêm thư mục vào "Folder bỏ qua".

Cấu hình lưu ở `~/Library/Application Support/FolderSync/config.json` (theo từng project), log ở `…/FolderSync/logs/`.

### Chưa có trong v1
Image sequence, gộp thư mục con (FLT), nhận diện thẻ camera, đường dẫn tương đối cho template, Import Date, After Effects, Windows.

---

## 🇬🇧 English

Folder Sync mirrors folders on disk into Premiere Pro bins and keeps them in sync: new files are imported as soon as they finish writing, duplicates are never imported (path-based, whole-project check), nothing in your project is ever removed or moved, and it keeps working in the background with the panel closed. Built for teams on Google Drive: remote folders are polled, offline Drive folders are auto-relinked to the current machine's Drive, and existing bin trees can be linked from a single file inside them.

Install: `curl -fsSL https://raw.githubusercontent.com/snow1202/folder-sync/main/web-install.sh | bash` (or the installer zip from Releases), restart Premiere, open **Window › Extensions › Folder Sync**. Drag folders from Finder onto the panel (bins are created inside the bin selected in the Project panel), then turn on **WATCH**.

---

Phát triển: `npm test` (Node ≥ 18, không dependency) · cài bản phát triển bằng symlink: `./install.sh` · phát hành: `./publish.sh <version>`. Thiết kế: [docs/specs](docs/specs/2026-10-19-folder-sync-design.md) · Checklist thử tay: [docs/TEST-CHECKLIST.md](docs/TEST-CHECKLIST.md).
