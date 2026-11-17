// Folder Sync — hộp hỏi "có lấy cả sub-folder không" khi kéo folder từ Finder vào panel.
// FS_ASK.sub(paths, đích, {binName}) → Promise {sub, direct} | null — xem ghi chú ở hàm.
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

  // FS_ASK.sub(paths, đích, {binName}) → Promise {sub, direct} | null (huỷ).
  // Hộp gồm các nhóm lựa chọn + nút OK / Huỷ; chỉ hỏi những gì cần:
  //  - "Thêm vào đâu?": khi đang chọn một bin và tên khác folder → sync thẳng vào bin đó / tạo bin cùng tên folder bên trong.
  //  - "Import cả sub-folder?": chỉ khi folder kéo vào thật sự có thư mục con (tự dò trên ổ).
  // Không còn gì để hỏi → không hiện hộp, trả kết quả ngay.
  function sameName(a, b) { return String(a || '').normalize('NFC').trim().toLowerCase() === String(b || '').normalize('NFC').trim().toLowerCase(); }
  function hasSubfolders(p) {
    if (!FS.isCEP) return true; // xem trước trên trình duyệt: không đọc được ổ
    try {
      return require('fs').readdirSync(p, { withFileTypes: true }).some(function (d) { return d.isDirectory() && d.name.charAt(0) !== '.'; });
    } catch (e) { return true; }
  }
  function sub(paths, target, opts) {
    opts = opts || {};
    var names = paths.map(base);
    var bin = opts.binName || '';
    var askWhere = !!bin && names.some(function (n) { return !sameName(n, bin); });
    var askSub = paths.some(hasSubfolders);
    if (!askWhere && !askSub) return Promise.resolve({ sub: true, direct: false });

    return new Promise(function (resolve) {
      var state = { direct: true, sub: true };
      var ov = el('div', 'ask');
      var box = el('div', 'ask-box');
      box.appendChild(el('div', 'ask-title', 'Thêm folder'));
      box.appendChild(el('div', 'ask-what', names.length > 3 ? names.slice(0, 3).join(', ') + ' và ' + (names.length - 3) + ' folder khác' : names.join(', ')));
      var to = el('div', 'ask-to');
      box.appendChild(to);
      var groups = [];

      // nhóm lựa chọn kiểu radio: items [[value, nhãn, tooltip]]
      function group(title, key, items) {
        box.appendChild(el('div', 'ask-sub', title));
        var wrap = el('div', 'ask-pick');
        var btns = items.map(function (it) {
          var b = el('button', 'ask-opt', it[1]);
          b.type = 'button'; b.title = it[2];
          b.addEventListener('click', function () { state[key] = it[0]; paint(); });
          wrap.appendChild(b);
          return { b: b, v: it[0] };
        });
        box.appendChild(wrap);
        groups.push({ key: key, btns: btns });
      }
      if (askWhere) {
        group('Thêm vào đâu?', 'direct', [
          [true, 'Sync thẳng vào bin "' + bin + '"', 'File (và bin con của thư mục con) vào thẳng bin đang chọn, không tạo bin mới.'],
          [false, names.length === 1 ? 'Tạo bin "' + names[0] + '" bên trong "' + bin + '"' : 'Tạo bin mới cho từng folder bên trong "' + bin + '"', 'Tạo bin cùng tên folder bên trong bin đang chọn rồi import vào đó.'],
        ]);
      }
      if (askSub) {
        group('Import cả sub-folder?', 'sub', [
          [true, 'Có — kèm sub-folder', 'Mỗi thư mục con thành một bin con; thư mục con tạo sau này cũng tự được thêm.'],
          [false, 'Không — chỉ file trong folder', 'Chỉ import file nằm trực tiếp trong folder, bỏ qua mọi thư mục con.'],
        ]);
        box.appendChild(el('div', 'ask-note', 'Đổi sau được bằng cột SUB trong Watch folders.'));
      }
      function paint() {
        groups.forEach(function (g) { g.btns.forEach(function (x) { x.b.classList.toggle('on', state[g.key] === x.v); }); });
        var t = target || '';
        if (askWhere && !state.direct) t += ' › ' + (names.length === 1 ? names[0] : '<tên folder>');
        to.textContent = '→ ' + t + (bin && !askWhere ? ' (bin có sẵn cùng tên — sync thẳng vào bin này)' : '');
      }
      paint();

      var cancel = el('button', 'btn', 'Huỷ');
      var ok = el('button', 'btn primary', 'OK');
      cancel.type = 'button'; ok.type = 'button';
      var foot = el('div', 'ask-foot'); foot.appendChild(cancel); foot.appendChild(ok); box.appendChild(foot);
      ov.appendChild(box);
      document.body.appendChild(ov);

      function done(v) {
        document.removeEventListener('keydown', onKey, true);
        ov.remove();
        resolve(v);
      }
      function finish() { done({ sub: askSub ? state.sub : true, direct: askWhere ? state.direct : false }); }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
        else if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); finish(); }
      }
      document.addEventListener('keydown', onKey, true);
      ok.addEventListener('click', finish);
      cancel.addEventListener('click', function () { done(null); });
      ov.addEventListener('click', function (e) { if (e.target === ov) done(null); });
      setTimeout(function () { ok.focus(); }, 0);
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
