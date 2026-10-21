// Folder Sync — hộp hỏi "có lấy cả sub-folder không" khi kéo folder từ Finder vào panel.
// FS_ASK.sub(paths, đích) → Promise: true (kèm sub-folder) | false (chỉ file trong folder) | null (huỷ).
// FS_ASK.notice(tiêu đề, nội dung) → hộp báo 1 nút. FS_ASK.setManagerDraft / managerUnsaved: Watch Folders
// ghi ra file "đang có thay đổi chưa bấm OK" để panel chính cảnh báo khi kéo folder vào.
/* global FS */
(function () {
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function base(p) { return String(p).replace(/\/+$/, '').split('/').pop(); }

  function sub(paths, target) {
    return new Promise(function (resolve) {
      var ov = el('div', 'ask');
      var box = el('div', 'ask-box');
      box.appendChild(el('div', 'ask-title', 'Import cả sub-folder?'));
      var names = paths.map(base);
      box.appendChild(el('div', 'ask-what', names.length > 3 ? names.slice(0, 3).join(', ') + ' và ' + (names.length - 3) + ' folder khác' : names.join(', ')));
      if (target) box.appendChild(el('div', 'ask-to', '→ ' + target));
      var yes = el('button', 'btn primary', 'Có — kèm sub-folder');
      yes.title = 'Mỗi thư mục con thành một bin con; thư mục con tạo sau này cũng tự được thêm.';
      var no = el('button', 'btn', 'Không — chỉ file trong folder');
      no.title = 'Chỉ import file nằm trực tiếp trong folder, bỏ qua mọi thư mục con.';
      var cancel = el('button', 'linkbtn', 'Huỷ');
      [yes, no, cancel].forEach(function (b) { b.type = 'button'; });
      var row = el('div', 'ask-btns');
      row.appendChild(yes); row.appendChild(no);
      box.appendChild(row);
      box.appendChild(el('div', 'ask-note', 'Đổi sau được bằng cột SUB trong Watch folders.'));
      var foot = el('div', 'ask-foot'); foot.appendChild(cancel); box.appendChild(foot);
      ov.appendChild(box);
      document.body.appendChild(ov);

      function done(v) {
        document.removeEventListener('keydown', onKey, true);
        ov.remove();
        resolve(v);
      }
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); done(null); } }
      document.addEventListener('keydown', onKey, true);
      yes.addEventListener('click', function () { done(true); });
      no.addEventListener('click', function () { done(false); });
      cancel.addEventListener('click', function () { done(null); });
      ov.addEventListener('click', function (e) { if (e.target === ov) done(null); });
      setTimeout(function () { yes.focus(); }, 0);
    });
  }

  function notice(title, text) {
    return new Promise(function (resolve) {
      var ov = el('div', 'ask');
      var box = el('div', 'ask-box warn');
      box.appendChild(el('div', 'ask-title', title));
      box.appendChild(el('div', 'ask-what', text));
      var ok = el('button', 'btn primary', 'Đã hiểu');
      ok.type = 'button';
      var row = el('div', 'ask-btns'); row.appendChild(ok); box.appendChild(row);
      ov.appendChild(box);
      document.body.appendChild(ov);
      function done() { document.removeEventListener('keydown', onKey, true); ov.remove(); resolve(); }
      function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); done(); } }
      document.addEventListener('keydown', onKey, true);
      ok.addEventListener('click', done);
      ov.addEventListener('click', function (e) { if (e.target === ov) done(); });
      setTimeout(function () { ok.focus(); }, 0);
    });
  }

  // Huỷ khi còn thay đổi chưa lưu. lines: mỗi thay đổi một dòng ngắn. → Promise: true = Thoát, false = Quay lại.
  var MAX_LINES = 6;
  function discard(lines) {
    return new Promise(function (resolve) {
      var ov = el('div', 'ask');
      var box = el('div', 'ask-box warn');
      box.appendChild(el('div', 'ask-title', lines.length + ' thay đổi chưa được lưu'));
      var ul = el('ul', 'ask-list');
      lines.slice(0, MAX_LINES).forEach(function (t) { var li = el('li', '', t); li.title = t; ul.appendChild(li); });
      if (lines.length > MAX_LINES) ul.appendChild(el('li', 'more', '… và ' + (lines.length - MAX_LINES) + ' thay đổi khác'));
      box.appendChild(ul);
      box.appendChild(el('div', 'ask-note', 'Quay lại để bấm OK lưu. Thoát thì mọi thay đổi trên bị bỏ, danh sách giữ như lần lưu trước.'));
      var back = el('button', 'btn primary', 'Quay lại');
      var exit = el('button', 'btn', 'Thoát, không lưu');
      back.type = 'button'; exit.type = 'button';
      var row = el('div', 'ask-btns'); row.appendChild(back); row.appendChild(exit); box.appendChild(row);
      ov.appendChild(box);
      document.body.appendChild(ov);
      function done(v) { document.removeEventListener('keydown', onKey, true); ov.remove(); resolve(v); }
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); done(false); } }
      document.addEventListener('keydown', onKey, true);
      back.addEventListener('click', function () { done(false); });
      exit.addEventListener('click', function () { done(true); });
      ov.addEventListener('click', function (e) { if (e.target === ov) done(false); });
      setTimeout(function () { back.focus(); }, 0);
    });
  }

  // ---------------------------------------------------------------- bản nháp Watch Folders
  // Đường dẫn tính sẵn (lúc đóng panel getSystemPath không dùng được, Node fs thì vẫn chạy).
  var DRAFT_FILE = null;
  if (FS.isCEP) {
    try { DRAFT_FILE = require('path').join(require('os').homedir(), 'Library', 'Application Support', 'FolderSync', 'manager-draft.json'); } catch (e) { /* bỏ qua */ }
  }
  var DRAFT_STALE_MS = 10000; // Watch Folders ghi lại mỗi 3 s khi còn thay đổi; cũ hơn thì coi như panel đã tắt

  function setManagerDraft(unsaved) {
    if (!DRAFT_FILE) return;
    try {
      require('fs').mkdirSync(require('path').dirname(DRAFT_FILE), { recursive: true });
      require('fs').writeFileSync(DRAFT_FILE, JSON.stringify({ dirty: !!unsaved, at: Date.now() }));
    } catch (e) { /* bỏ qua */ }
  }
  function managerUnsaved() {
    if (!DRAFT_FILE) return !!window.FS_PREVIEW_MANAGER_DIRTY;
    try {
      var s = JSON.parse(require('fs').readFileSync(DRAFT_FILE, 'utf8'));
      return !!s.dirty && Date.now() - s.at < DRAFT_STALE_MS;
    } catch (e) { return false; }
  }

  window.FS_ASK = { sub: sub, notice: notice, discard: discard, setManagerDraft: setManagerDraft, managerUnsaved: managerUnsaved };
})();
