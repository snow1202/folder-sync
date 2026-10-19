// Folder Sync — chỉ nhả file đã "đứng yên" (ghi/tải xong).
//
// Một file ổn định khi: đã thấy ≥ 2 lần với cùng size + mtime, lần đầu thấy
// giá trị đó cách hiện tại ≥ gapMs, và size > 0. Mỗi file chỉ được nhả 1 lần
// cho tới khi size/mtime đổi hoặc gọi forget().
const { pathkey } = require('./pathkey.js');

function createStabilityTracker(opts) {
  const gapMs = (opts && opts.gapMs) || 0;
  const seen = new Map(); // key -> { size, mtimeMs, since, count, released }

  function observe(files, now) {
    const out = [];
    for (const f of files) {
      const k = pathkey(f.path);
      const s = seen.get(k);
      if (!s || s.size !== f.size || s.mtimeMs !== f.mtimeMs) {
        seen.set(k, { size: f.size, mtimeMs: f.mtimeMs, since: now, count: 1, released: false });
        continue;
      }
      s.count += 1;
      if (!s.released && f.size > 0 && s.count >= 2 && now - s.since >= gapMs) {
        s.released = true;
        out.push(f);
      }
    }
    return out;
  }

  function forget(p) {
    seen.delete(pathkey(p));
  }

  return { observe, forget };
}

module.exports = { createStabilityTracker };
