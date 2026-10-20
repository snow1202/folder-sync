// Folder Sync — hằng số dùng chung (engine, panel, manager, test).

// 16 label màu của Premiere, đúng thứ tự chỉ số setColorLabel(0..15).
const LABELS = [
  'Violet', 'Iris', 'Caribbean', 'Lavender', 'Cerulean', 'Forest', 'Rose', 'Mango',
  'Purple', 'Blue', 'Teal', 'Magenta', 'Tan', 'Green', 'Brown', 'Yellow',
];

// Màu hiển thị gần đúng của từng label (cho dropdown trong UI).
const LABEL_COLORS = [
  '#a990dd', '#7f9be8', '#29d698', '#e384e3', '#1ab4d7', '#4aa44a', '#f4659a', '#f29e3d',
  '#9c27b0', '#2f6ff5', '#19998f', '#e649a4', '#d6b98c', '#1f8b4c', '#8e5b3a', '#e3d23e',
];

// Đuôi file Premiere import được. Cố ý KHÔNG có prproj/aep: theo dõi cả thư mục
// chứa project sẽ import chính project (và các bản auto-save) vào project.
const DEFAULT_ALLOWED_EXT = [
  // video
  '264', '3g2', '3gp', '3gpp', 'avc', 'avi', 'braw', 'crm', 'dv', 'dvi', 'flv', 'gif', 'h264',
  'm1v', 'm2t', 'm2ts', 'm2v', 'm4v', 'mkv', 'mod', 'mov', 'mp4', 'mpe', 'mpeg', 'mpg', 'mpg4',
  'mpv', 'mts', 'mxf', 'r3d', 'tod', 'ts', 'vob', 'webm', 'wmv', 'hevc', 'ari', 'arx',
  // audio
  'aac', 'ac3', 'aif', 'aifc', 'aiff', 'bwf', 'caf', 'flac', 'm4a', 'mp2', 'mp3', 'mpa', 'ogg',
  'wav', 'wma',
  // ảnh / đồ hoạ
  'ai', 'bmp', 'dib', 'dng', 'dpx', 'eps', 'exr', 'heic', 'heif', 'ico', 'jpe', 'jpeg', 'jpg',
  'png', 'psd', 'svg', 'tga', 'tif', 'tiff', 'webp', 'cin', 'dcr',
  // phụ đề / khác
  'srt', 'scc', 'stl', 'xml', 'mogrt', 'aaf', 'edl',
];

// Thư mục bỏ qua mặc định. Dạng /…/ là regex (không phân biệt hoa/thường).
const DEFAULT_IGNORED = [
  'untitled folder',
  'New folder',
  '/\\.download$/',
  '/\\.downiepart$/',
  'Adobe Premiere Pro Auto-Save',
  'Adobe Premiere Pro Video Previews',
  'Adobe Premiere Pro Audio Previews',
  '/_AME$/',
  '.Trashes',
];

const EVENTS = {
  CONFIG_CHANGED: 'com.foldersync.config-changed',
  STATUS: 'com.foldersync.status',
  COMMAND: 'com.foldersync.command',
  PROGRESS: 'com.foldersync.progress',
  REPLY: 'com.foldersync.reply',
  PANEL_CLOSED: 'com.foldersync.panel-closed',
  PANEL_ALIVE: 'com.foldersync.panel-alive',
  HISTORY: 'com.foldersync.history',
};

module.exports = {
  LABELS,
  LABEL_COLORS,
  DEFAULT_ALLOWED_EXT,
  DEFAULT_IGNORED,
  BATCH_SIZE: 50,
  POLL_REMOTE_MS: 5000,
  POLL_LOCAL_MS: 30000,
  DEBOUNCE_MS: 1500,
  STABLE_GAP_MS: 2000,
  ONLINE_TIMEOUT_MS: 3000,
  MAX_ERRORS: 3,
  ALIVE_EVERY_MS: 1500,   // panel chính phát "còn mở"
  CHILD_TIMEOUT_MS: 6000, // panel con không nghe thấy quá lâu → tự đóng
  EVENTS,
  EXT_IDS: {
    MAIN: 'com.foldersync.panel.main',
    MANAGER: 'com.foldersync.panel.manager',
    ENGINE: 'com.foldersync.panel.engine',
  },
  VERSION: '1.0.1',
};
