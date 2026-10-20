// Folder Sync — nội dung tooltip (tiếng Việt) + hiển thị tooltip cho mọi [data-tip].
(function () {
  var TIPS = {
    watch: 'Bật/tắt tự đồng bộ. Khi bật, file mới trong các folder đang theo dõi tự vào project — kể cả khi bạn đóng panel này.',
    sync: 'Quét ngay mọi folder và import file còn thiếu. Dùng khi tự đồng bộ đang tắt, hoặc muốn chắc chắn đã đủ file.',
    folders: 'Mở danh sách folder đang theo dõi: thêm, bỏ, chỉnh SUB/Label, đổi đường dẫn khi folder bị offline.',
    drop: 'Kéo folder từ Finder thả vào panel. Bin cùng tên sẽ được tạo trong bin bạn đang chọn ở Project panel (không chọn gì → gốc project).',
    status: 'Lần đồng bộ gần nhất và số file vừa thêm. Đỏ = có lỗi — đưa chuột vào để xem chi tiết.',
    settings: 'Cài đặt: thông báo, loại file được import, folder bỏ qua.',
    cancel: 'Dừng import sau đợt đang chạy. File đã vào project được giữ nguyên, phần còn lại sẽ vào ở lượt sau.',
    notifications: 'Hiện thông báo trong Events panel của Premiere sau mỗi lần có file mới (và khi bấm SYNC).',
    allowed: 'Chỉ import file có đuôi trong danh sách này (cách nhau bằng dấu phẩy). Đuôi mà Premiere không hỗ trợ vẫn bị bỏ qua.',
    ignored: 'Bỏ qua folder có tên trong danh sách, mỗi dòng một tên, không phân biệt hoa/thường. Viết /_AME$/ để dùng regex. Nên giữ "untitled folder" để folder mới tạo không bị import trước khi kịp đổi tên.',
    reset: 'Thay toàn bộ danh sách bằng danh sách mặc định (có hỏi xác nhận). Chỉ lưu khi bấm OK.',
    history: 'Các file Folder Sync đã import vào project đang làm việc (200 file gần nhất). Bấm một dòng để chọn file đó trong Project panel.',
    clearHistory: 'Xoá danh sách này (không ảnh hưởng gì tới project hay file trên ổ).',
    row: 'Bấm để chọn trong Project panel.',
    tabGeneral: 'Cài đặt chung của Folder Sync.',
    addExt: 'Thêm một đuôi file được phép import (vd. mov, r3d). Gõ rồi nhấn Enter.',
    addIgn: 'Thêm tên folder cần bỏ qua, hoặc /regex/ (vd. /_AME$/). Gõ rồi nhấn Enter.',
    removeItem: 'Bỏ mục này khỏi danh sách. Chỉ lưu khi bấm OK — bấm Huỷ nếu xoá nhầm.',
    regexTag: 'Mục này là regex (viết giữa hai dấu /), không phân biệt hoa/thường.',
    backSettings: 'Quay lại màn chính. Còn thay đổi chưa lưu thì sẽ hỏi trước.',
    cancelSettings: 'Đóng, bỏ mọi thay đổi chưa lưu.',
    okSettings: 'Lưu cài đặt — áp dụng ngay cho mọi project.',
    state: 'Xanh: đang theo dõi bình thường. Vàng: đang import. Đỏ: không tìm thấy folder (ổ chưa cắm, Google Drive chưa đăng nhập, folder bị đổi tên) — bấm vào đường dẫn để chọn lại.',
    name: 'Tên folder = tên bin trong project. Bấm mũi tên để gập/mở; giữ ⌥ (Option) khi bấm để gập/mở tất cả.',
    path: 'Đường dẫn folder trên ổ. Bấm để chọn lại (relink) — các folder con tự đổi theo, clip đang offline được nối lại.',
    sub: 'Bật: lấy cả thư mục con, mỗi thư mục con thành một bin con (thư mục con mới cũng tự thêm). Tắt: chỉ lấy file nằm trực tiếp trong folder.',
    label: 'Màu gán cho bin và mọi file mới import vào bin đó. Đổi ở folder cha → folder con đổi theo.',
    remove: 'Ngừng theo dõi folder này (và các folder con). Bin và file đã import vẫn giữ nguyên trong project.',
    add: 'Chọn một hoặc nhiều folder để theo dõi. Bin được tạo trong bin đang chọn ở Project panel.',
    link: 'Liên kết bin đang chọn ở Project panel với folder trên ổ. Chỉ cần một file trong bin (hoặc bin con) là tự tìm ra folder cho cả cây bin — không tạo bin trùng.',
    ok: 'Lưu thay đổi và đồng bộ ngay.',
    cancelMgr: 'Đóng, bỏ mọi thay đổi chưa lưu.',
  };

  function install(root) {
    var tip = document.createElement('div');
    tip.className = 'tip';
    document.body.appendChild(tip);
    var timer = null;
    function hide() { clearTimeout(timer); tip.classList.remove('show'); }
    (root || document).addEventListener('mouseover', function (e) {
      var el = e.target.closest && e.target.closest('[data-tip]');
      if (!el) { hide(); return; }
      var key = el.getAttribute('data-tip');
      var text = el.getAttribute('data-tip-text') || TIPS[key] || key;
      clearTimeout(timer);
      timer = setTimeout(function () {
        tip.textContent = text;
        var r = el.getBoundingClientRect();
        tip.style.left = '0px'; tip.style.top = '0px';
        tip.classList.add('show');
        var w = tip.offsetWidth, h = tip.offsetHeight;
        var x = Math.min(Math.max(6, r.left + r.width / 2 - w / 2), window.innerWidth - w - 6);
        var y = r.bottom + 6;
        if (y + h > window.innerHeight - 4) y = Math.max(4, r.top - h - 6);
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      }, 350);
    });
    (root || document).addEventListener('mouseout', function (e) {
      if (!e.relatedTarget || !(e.relatedTarget.closest && e.relatedTarget.closest('[data-tip]'))) hide();
    });
    document.addEventListener('mousedown', hide);
  }

  window.FS_TIPS = { TIPS: TIPS, install: install };
})();
