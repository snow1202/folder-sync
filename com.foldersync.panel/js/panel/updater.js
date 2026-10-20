// Folder Sync — cập nhật trong panel + nhắc khởi động lại Premiere.
//
// 1. Có bản mới: panel được cài bằng git clone (web-install.sh) → định kỳ `git fetch` và so
//    version.json trên origin/main với bản trên máy. Mới hơn → thanh "Có bản mới — Cập nhật";
//    bấm thì `git pull --ff-only` rồi tải lại panel. Không phải bản clone / không có git →
//    tính năng tự tắt (máy phát triển dùng symlink thì vẫn chạy bình thường).
// 2. Cần khởi động lại: engine báo dấu vân tay code lúc khởi động (STATUS.engineFp); panel
//    tính lại từ ổ (core/fingerprint.js). Lệch → thanh cảnh báo "thoát hẳn Premiere rồi mở lại".
/* global FS */
(function () {
  if (!FS.isCEP) return;
  var fs = require('fs');
  var path = require('path');
  var cp = require('child_process');
  var C = FS.load('js/core/constants.js');
  var FP = FS.load('js/core/fingerprint.js');
  var $ = function (id) { return document.getElementById(id); };

  var EXT = FS.extRoot();
  var REPO = (function () { try { return path.dirname(fs.realpathSync(EXT)); } catch (e) { return path.dirname(EXT); } })();
  var HAS_GIT_REPO = fs.existsSync(path.join(REPO, '.git'));

  function findGit() {
    var c = ['/usr/bin/git', '/opt/homebrew/bin/git', '/usr/local/bin/git'];
    for (var i = 0; i < c.length; i++) { try { if (fs.existsSync(c[i])) return c[i]; } catch (e) { /* bỏ qua */ } }
    return 'git';
  }
  var GIT = findGit();

  function git(args, cb) {
    var env = {};
    try { for (var k in process.env) env[k] = process.env[k]; } catch (e) { /* bỏ qua */ }
    env.GIT_TERMINAL_PROMPT = '0';
    env.GIT_SSH_COMMAND = 'ssh -oBatchMode=yes -oStrictHostKeyChecking=accept-new';
    try {
      cp.execFile(GIT, args, { cwd: REPO, timeout: 60000, env: env }, function (err, out, errOut) {
        cb(err, String(out || '').trim(), String(errOut || '').trim());
      });
    } catch (e) { cb(e, '', ''); }
  }

  function parseVersion(s) { try { return JSON.parse(s).version; } catch (e) { return null; } }
  function localVersion() { try { return parseVersion(fs.readFileSync(path.join(REPO, 'version.json'), 'utf8')); } catch (e) { return null; } }
  function cmp(a, b) {
    var pa = String(a).split('.'), pb = String(b).split('.');
    for (var i = 0; i < 3; i++) {
      var x = parseInt(pa[i] || '0', 10) || 0, y = parseInt(pb[i] || '0', 10) || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  // ---------------------------------------------------------------- thanh thông báo
  var shown = null; // 'restart' | 'update'
  function bar(kind, text, btnText, onBtn) {
    shown = kind;
    $('update-bar').style.display = '';
    $('update-bar').className = 'update-bar' + (kind === 'restart' ? ' warn' : '');
    $('ub-text').textContent = text;
    var b = $('ub-btn');
    if (btnText) {
      b.style.display = '';
      b.textContent = btnText;
      b.disabled = false;
      b.onclick = onBtn;
    } else {
      b.style.display = 'none';
      b.onclick = null;
    }
  }
  function hideBar() { shown = null; $('update-bar').style.display = 'none'; }

  var hiddenFor = {}; // khoá đã bấm ✕ trong phiên này
  $('ub-x').addEventListener('click', function () { if (shown) hiddenFor[shown + ':' + barKey] = true; hideBar(); });
  var barKey = '';

  // ---------------------------------------------------------------- 2. cần khởi động lại Premiere
  var runningFp = null;
  var diskFp = null;
  var diskFpAt = 0;
  function currentDiskFp() {
    if (!diskFp || Date.now() - diskFpAt > 10000) {
      try { diskFp = FP.engineFingerprint(EXT); } catch (e) { diskFp = null; }
      diskFpAt = Date.now();
    }
    return diskFp;
  }
  function checkRestart() {
    if (!FP.needsRestart(runningFp, currentDiskFp())) {
      if (shown === 'restart') hideBar();
      return false;
    }
    barKey = diskFp;
    if (hiddenFor['restart:' + barKey]) return true;
    if (shown === 'update') return true; // đang cập nhật dở, để thanh đó báo trước
    var v = localVersion();
    bar('restart', 'Folder Sync đã được cập nhật' + (v ? ' lên v' + v : '') +
      '. Thoát hẳn Premiere (Cmd+Q) rồi mở lại để phần đồng bộ ngầm chạy bản mới.');
    return true;
  }
  FS.on(C.EVENTS.STATUS, function (st) {
    if (st.engine === 'hidden' && st.engineFp) { runningFp = st.engineFp; checkRestart(); }
  });
  setInterval(checkRestart, 10000);

  // ---------------------------------------------------------------- 1. có bản mới trên GitHub
  function doUpdate(remoteV) {
    var b = $('ub-btn');
    b.disabled = true;
    b.textContent = 'Đang cập nhật…';
    git(['pull', '--ff-only', 'origin', 'main'], function (err, out, errOut) {
      if (err) {
        bar('update', 'Không cập nhật được: ' + (errOut || err.message).split('\n')[0] + '. Thử lại sau, hoặc chạy lại lệnh cài.', 'Thử lại', function () { doUpdate(remoteV); });
        return;
      }
      diskFp = null; // tính lại
      // Tải lại panel để dùng giao diện mới; nếu engine cũng đổi, thanh "khởi động lại" sẽ hiện sau khi tải lại.
      try { localStorage.setItem('fs.justUpdated', String(remoteV)); } catch (e) { /* bỏ qua */ }
      setTimeout(function () { location.reload(); }, 300);
    });
  }

  function checkRemote() {
    if (!HAS_GIT_REPO) return;
    git(['fetch', '--quiet', 'origin', 'main'], function (err) {
      if (err) return; // offline / không có quyền → thử lần sau
      git(['show', 'origin/main:version.json'], function (err2, out) {
        if (err2) return;
        var remoteV = parseVersion(out);
        var localV = localVersion();
        if (!remoteV || !localV || cmp(remoteV, localV) <= 0) return;
        barKey = remoteV;
        if (hiddenFor['update:' + barKey]) return;
        bar('update', 'Có bản mới Folder Sync v' + remoteV + ' (đang dùng v' + localV + ').', '↑ Cập nhật', function () { doUpdate(remoteV); });
      });
    });
  }

  // Vừa cập nhật xong (panel đã tải lại): báo ngắn nếu không cần khởi động lại.
  setTimeout(function () {
    var just = null;
    try { just = localStorage.getItem('fs.justUpdated'); localStorage.removeItem('fs.justUpdated'); } catch (e) { /* bỏ qua */ }
    if (just && !checkRestart()) {
      bar('done', 'Đã cập nhật lên v' + just + ' — không cần khởi động lại Premiere.');
      setTimeout(function () { if (shown === 'done') hideBar(); }, 8000);
    }
  }, 4000);

  setTimeout(checkRemote, 5000);
  setInterval(checkRemote, 30 * 60 * 1000);

  window.FS_UPDATER = { checkRemote: checkRemote, repo: REPO, hasGit: HAS_GIT_REPO };
})();
