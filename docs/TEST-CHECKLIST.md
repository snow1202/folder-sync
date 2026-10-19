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
