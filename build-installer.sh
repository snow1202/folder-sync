#!/usr/bin/env bash
# Build "Folder-Sync-Installer.zip" — app cài bấm đúp cho macOS, nhúng sẵn bản clone git của
# panel. Bản clone đó tự cập nhật qua nút "↑ Cập nhật" trong panel nên ít khi phải build lại.
# Chỉ người phát hành chạy. Kết quả: dist/Folder-Sync-Installer.zip
set -euo pipefail
cd "$(dirname "$0")"

REPO_URL="https://github.com/snow1202/folder-sync.git"
APP_NAME="Cài đặt Folder Sync"
OUT_DIR="dist"
PKG_DIR="$OUT_DIR/Folder Sync Installer"
APP="$PKG_DIR/$APP_NAME.app"

rm -rf "$OUT_DIR"
mkdir -p "$PKG_DIR"

echo "→ Tạo bản clone sạch…"
git clone --quiet --local --no-hardlinks . "$OUT_DIR/stage"
git -C "$OUT_DIR/stage" remote set-url origin "$REPO_URL"
git -C "$OUT_DIR/stage" gc --quiet --aggressive --prune=now

echo "→ Biên dịch app cài đặt…"
cat > "$OUT_DIR/applet.applescript" <<'APPLESCRIPT'
set appPath to POSIX path of (path to me)
try
	do shell script "/bin/bash " & quoted form of (appPath & "Contents/Resources/installer.sh")
	display dialog "✅ Cài đặt Folder Sync thành công!

1. Thoát hẳn Premiere (Cmd+Q) rồi mở lại.
2. Mở panel: Window → Extensions → Folder Sync

Từ nay có bản mới, panel sẽ tự hiện nút '↑ Cập nhật'." buttons {"OK"} default button "OK" with icon note with title "Folder Sync"
on error errMsg
	display dialog "❌ Cài đặt gặp lỗi:

" & errMsg buttons {"OK"} default button "OK" with icon stop with title "Folder Sync"
end try
APPLESCRIPT
osacompile -o "$APP" "$OUT_DIR/applet.applescript"

echo "→ Nhúng panel + script cài…"
cp -R "$OUT_DIR/stage" "$APP/Contents/Resources/folder-sync"
cat > "$APP/Contents/Resources/installer.sh" <<'INSTALLER'
#!/usr/bin/env bash
set -euo pipefail
SRC="$(cd "$(dirname "$0")/folder-sync" && pwd)"
DEST="$HOME/Library/Application Support/Folder Sync/app"
EXT_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
for v in 9 10 11 12; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
# Lần đầu: chép bản clone ra chỗ cố định. Chạy lại: giữ bản đang có (nút Cập nhật lo phần còn lại).
if [ ! -d "$DEST/.git" ]; then
  rm -rf "$DEST"
  mkdir -p "$(dirname "$DEST")"
  cp -R "$SRC" "$DEST"
  xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
fi
mkdir -p "$EXT_DIR"
ln -sfn "$DEST/com.foldersync.panel" "$EXT_DIR/com.foldersync.panel"
INSTALLER
chmod +x "$APP/Contents/Resources/installer.sh"

cat > "$PKG_DIR/ĐỌC TRƯỚC KHI CÀI.txt" <<'TXT'
FOLDER SYNC — HƯỚNG DẪN CÀI (macOS)

CÁCH NHANH NHẤT (khuyên dùng) — không bị macOS chặn:
Mở Terminal, dán lệnh sau rồi Enter:

  curl -fsSL https://raw.githubusercontent.com/snow1202/folder-sync/main/web-install.sh | bash

Rồi thoát hẳn Premiere (Cmd+Q) → mở lại → Window → Extensions → Folder Sync.

------------------------------------------------------------

HOẶC cài bằng app này:

1. CHUỘT PHẢI vào "Cài đặt Folder Sync" → chọn "Open"
2. NẾU chỉ thấy nút "Move to Trash" (macOS 15 trở lên):
   → System Settings → Privacy & Security → kéo xuống → bấm "Open Anyway" → mở lại app.
   (Hoặc dùng lệnh Terminal ở trên cho nhanh.)
3. Đợi hộp thoại "✅ Cài đặt thành công"
4. Thoát hẳn Premiere (Cmd+Q) → mở lại
5. Mở panel: Window → Extensions → Folder Sync

Từ nay KHÔNG cần cài lại: có bản mới, panel tự hiện nút "↑ Cập nhật".
Nếu bản cập nhật cần khởi động lại Premiere, panel sẽ báo rõ.
TXT

echo "→ Nén zip…"
rm -rf "$OUT_DIR/stage" "$OUT_DIR/applet.applescript"
(cd "$OUT_DIR" && ditto -c -k --sequesterRsrc --keepParent "Folder Sync Installer" "Folder-Sync-Installer.zip")
echo "✅ Đã build: $OUT_DIR/Folder-Sync-Installer.zip"
