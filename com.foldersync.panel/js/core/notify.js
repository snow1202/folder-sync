// Folder Sync — câu thông báo sau mỗi lượt sync (mẫu theo Watchtower).
const MAX_NAMES = 5;

function summary({ files, folders, binNames }) {
  if (!files && !folders) return 'Không có file mới';
  const parts = [];
  if (files) parts.push(files + ' file');
  if (folders) parts.push(folders + ' thư mục con');
  const names = Array.from(new Set(binNames || []));
  let list = names.slice(0, MAX_NAMES).join(', ');
  if (names.length > MAX_NAMES) list += ' … và ' + (names.length - MAX_NAMES) + ' bin khác';
  return parts.join(', ') + ' đã thêm vào: ' + list;
}

module.exports = { summary };
