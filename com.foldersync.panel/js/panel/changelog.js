// Folder Sync — lịch sử phiên bản (mới nhất ở trên). publish.sh chặn phát hành nếu thiếu mục cho version mới.
window.FS_CHANGELOG = [
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
