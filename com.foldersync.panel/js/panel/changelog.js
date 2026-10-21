// Folder Sync — lịch sử phiên bản (mới nhất ở trên). publish.sh chặn phát hành nếu thiếu mục cho version mới.
window.FS_CHANGELOG = [
  {
    v: "1.0.2",
    date: "2026-10-21",
    items: [
      "Kéo folder từ Finder vào panel: hỏi có import cả sub-folder không. Watch Folders có ô tick \"Kèm sub-folder\" cạnh nút Thêm folder.",
      "Watch Folders: dòng vàng \"⚠ Chưa lưu…\" đếm các thay đổi + nút ↺ Bỏ hết; folder bị xoá hiện mờ với nút ↺ để lấy lại; bấm Huỷ khi còn thay đổi thì liệt kê và hỏi Quay lại / Thoát.",
      "Kéo folder vào panel chính khi Watch Folders còn thay đổi chưa lưu → cảnh báo bấm OK/Huỷ trước.",
      "Ghi rõ: dòng \"Folder mới sẽ vào →\" chỉ áp dụng lúc thêm folder; SYNC luôn đổ vào bin đã gán cho folder, không dùng bin đang chọn.",
    ],
  },
  {
    v: "1.0.1",
    date: "2026-10-20",
    items: [
      "Cài đặt › Chung: thêm \"Màu giao diện\" (giống 1-Click Resizer) — chọn màu nhấn bằng bảng màu, mã HEX hoặc 6 màu có sẵn; xem trước ngay, bấm OK để lưu, áp cho cả panel Watch folders.",
    ],
  },
  {
    v: "1.0.0",
    date: "2026-10-20",
    items: [
      "Bản phát hành đầu tiên: tự đồng bộ một chiều folder (kể cả Google Drive) vào cây bin Premiere, chạy ngầm kể cả khi đóng panel.",
      "Không import trùng (so đường dẫn với toàn project), chờ file ghi/tải xong mới import, import theo đợt có thanh tiến trình + Huỷ.",
      "Panel Watch folders: SUB, Label, relink folder offline, Liên kết bin có sẵn, tự relink Google Drive khi mở trên máy/tài khoản khác.",
      "Cài đặt 3 tab (Chung / Loại file / Folder bỏ qua) ngay trong panel; danh sách file đã import của project đang làm việc.",
      "Nút ↑ Cập nhật trong panel; tự báo khi cần khởi động lại Premiere sau cập nhật.",
    ],
  },
];
