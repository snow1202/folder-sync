# Folder Sync — Checklist thử tay trong Premiere

Chạy trước mỗi bản phát hành. Ghi ✅/❌ + ghi chú. Log engine: `~/Library/Application Support/FolderSync/logs/engine.log`.

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | `./install.sh`, Cmd+Q Premiere rồi mở lại, mở một project | Window › Extensions › **Folder Sync** có mặt. Mở panel: dòng trạng thái không báo "Engine chưa chạy". |
| 2 | Chọn bin `Asset` trong Project panel, kéo một folder trên ổ cục bộ (có thư mục con, thư mục rỗng) vào panel | Bin cùng tên được tạo **trong `Asset`**, cây bin giống cây thư mục (kể cả thư mục rỗng), file đủ. Toast "N file, M thư mục con đã thêm vào: …". |
| 3 | Bật WATCH, copy một file mới vào folder đó | File vào đúng bin trong khoảng ≤ 3–5 giây, không trùng. |
| 4 | Import tay (Cmd+I) một file trong folder, rồi bấm SYNC | Không import trùng; toast "Không có file mới". |
| 5 | Folder trên **Google Drive**: thêm folder, nhờ đồng nghiệp (hoặc máy khác) up file lên | File vào project trong khoảng ≤ 10 giây, kể cả khi file chưa tải về máy. |
| 6 | Copy dần một file lớn (~2 GB) vào folder | Chỉ import khi copy xong (không import file dở). |
| 7 | Thả vào folder: một file `.xyz`, thư mục `untitled folder`, một `.psd`, một `.prproj` | `.xyz`/`.prproj` và `untitled folder` bị bỏ qua; `.psd` import **không** hiện hộp thoại. |
| 8 | Đóng panel, thêm file mới | Vẫn được import (engine ẩn chạy nền). |
| 9 | Đổi tên bin gốc + kéo một bin con ra chỗ khác; thêm file vào thư mục tương ứng | File vào đúng bin đã đổi tên / đã di chuyển. Xoá hẳn bin → lượt sau bin được tạo lại. |
| 10 | Rút ổ ngoài (hoặc tắt mạng) đang được theo dõi | Chấm đỏ trong 📁, dòng trạng thái "1 folder offline". Cắm lại → tự chạy tiếp. |
| 11 | Mở 2 project cùng lúc, mỗi project theo dõi folder khác nhau; thêm file vào cả hai folder | Mỗi project nhận đúng file của mình (kiểm chứng import vào project **không active**). |
| 12 | Folder/file tên tiếng Việt có dấu (`Âm thanh/Tiếng động.wav`) | Không trùng, không lỗi; chạy SYNC lần 2 → "Không có file mới". |
| 13 | 📁 › bấm vào đường dẫn đỏ của một folder đã đổi chỗ trên ổ › chọn folder mới › OK | Folder con đổi theo; clip offline cũ được **nối lại** (không import trùng). |
| 14 | Sửa tay `config.json`: đổi tiền tố một folder Drive thành `/Users/khac/Library/CloudStorage/GoogleDrive-x@y.com/…` (giữ phần `Shared drives/…`), rồi SYNC | Folder tự relink về Drive của máy này, toast "đã tự relink…", clip offline được nối lại. |
| 15 | Project kiểu SAMX đã có sẵn cây bin + vài file: chọn bin `Sources` › 📁 › **Liên kết bin đang chọn** | Folder được suy ra đúng, các bin con được liên kết; chỉ import file còn thiếu, **không** tạo bin trùng. |
| 16 | Folder ~4.000 file: thêm vào, bấm **Huỷ** khi đang import | Thanh tiến trình chạy; Huỷ dừng sau đợt hiện tại; SYNC lại → import nốt phần còn lại, không trùng. |
| 17 | Xoá một clip trong Premiere (file vẫn còn trên ổ), bấm SYNC | Clip quay lại (giống Watchtower) — đây là hành vi đúng. |

## Kết quả lần chạy 2026-10-19 (v1.0.0, nhánh `v1`)

Máy: macOS, Premiere Pro 2026 (26.5.2), Google Drive for desktop. Project: Veracomfort CC 2026, SoftyGrace CC 2026.

| # | Kết quả | Ghi chú |
|---|---|---|
| 1 | ✅ | Engine ẩn tự chạy. Một lần engine mất kết nối ngay khi mở Premiere → đã thêm tự mở lại + engine dự phòng trong panel. |
| 2 | ⚠️ Một phần | Cây bin + import đủ (folder Drive `v23.x`, `FolderSync-Test`), thư mục rỗng/bin con đúng. **Chưa kiểm** việc tạo bin *bên trong bin đang chọn* — các lần thả đều vào gốc project. |
| 3 | ✅ | Folder trên Drive: file mới vào trong ~5–10 s (quét 5 s + chờ file đứng yên); ngưỡng "≤ 3–5 s" là cho ổ cục bộ. |
| 4 | ✅ | 3 file đã import tay từ trước không bị import lại. |
| 5 | ⏳ Chưa thử | Cần đồng nghiệp up file từ máy khác. |
| 6 | ✅ | File WAV 500 MB ghi dần 40 s (ổ cục bộ): không import khi đang ghi, import đúng 1 lần ~15 s sau khi ghi xong. |
| 7 | ✅ | `.xyz`, `.prproj`, `untitled folder`, `.DS_Store`, `~$tam.docx` bị bỏ qua; PSD nhiều layer import không hiện hộp thoại. |
| 8 | ✅ | Panel đóng (cổng debug panel không phản hồi), engine vẫn import. |
| 9 | ✅ | Đổi tên + kéo bin con ra gốc → file mới vào đúng bin đã đổi; xoá bin gốc + SYNC → bin được tạo lại, bin đã di chuyển không bị trùng. |
| 10 | ⚠️ Một phần | Kiểm bằng cách **đổi tên folder** → chấm đỏ + "1 folder offline". Chưa thử rút ổ ngoài / tắt mạng rồi cắm lại. |
| 11 | ✅ | 2 project cùng mở, file vào đúng project, **kể cả project không active** (spike đã xác nhận). Một lần dòng đích hiện sai project, không tái hiện được khi đo lại. |
| 12 | ✅ | Tên tiếng Việt dạng NFC và NFD (trên My Drive) đều import đúng 1 lần; SYNC lần 2 không trùng. |
| 13 | ✅ | Relink `v20.x` → `v20.x Backup`: 7 clip offline được nối lại, không trùng. |
| 14 | ⚠️ Một phần | Giả lập bằng cách đổi tiền tố Drive trong config → tự relink về Drive máy này (lần đo mất ~30 s; đã sửa xuống ~5 s nhưng **chưa đo lại trong Premiere**). Chưa kiểm phần nối lại clip offline khi tự relink (cần project mở từ máy khác). |
| 15 | ✅ | Liên kết bin `New 6` có sẵn: suy đúng folder, không tạo bin trùng, chỉ import file thiếu. |
| 16 | ✅ | 4.000 PNG: thanh tiến trình `x / 4.000`, Huỷ dừng giữa chừng, SYNC import nốt; cuối cùng đúng 4.000 item, không trùng. |
| 17 | ✅ | Xoá `ok.wav` trong Premiere + SYNC → clip quay lại. |

**Tổng:** 13 ✅ · 3 ⚠️ một phần (2, 10, 14) · 1 ⏳ chưa thử (5).

**Lỗi tìm thấy trong lúc test và đã sửa:** cửa sổ Watch folders hiện thừa trong menu Extensions · folder bị gán nhầm project khi mở nhiều project (`app.project` không tin được) · engine ẩn mất kết nối lúc mở Premiere · lưu ở cửa sổ quản lý làm mất folder vừa thả từ panel · hộp chọn folder khi relink mở sai chỗ · đường dẫn Drive của máy khác bị coi là ổ cục bộ (tự relink chậm, spam log) · đóng panel không đóng cửa sổ Watch folders.
