#!/usr/bin/env bash
# Phát hành Folder Sync: đặt version, đóng dấu vào mọi nơi, chạy test, commit, push và tạo
# GitHub Release (kèm Folder-Sync-Installer.zip). Panel của đồng nghiệp tự thấy nút "↑ Cập nhật".
#
#   ./publish.sh                    # tăng patch (1.0.0 -> 1.0.1)
#   ./publish.sh 1.1.0              # đặt version cụ thể
#   ./publish.sh 1.1.0 "ghi chú"    # version + lời nhắn commit/release
#   PUBLISH_YES=1 ./publish.sh ...  # bỏ bước xác nhận
# Chỉ chạy trên macOS (sed BSD), từ nhánh main.
set -euo pipefail
cd "$(dirname "$0")"

VJSON="version.json"
MANIFEST="com.foldersync.panel/CSXS/manifest.xml"
CONSTS="com.foldersync.panel/js/core/constants.js"
PANEL="com.foldersync.panel/panel.html"
CHANGELOG="com.foldersync.panel/js/panel/changelog.js"

branch=$(git symbolic-ref --short -q HEAD) || { echo "❌ Đang ở detached HEAD — chuyển về main trước."; exit 1; }
[ "$branch" = "main" ] || { echo "❌ Đang ở nhánh '$branch'. Chỉ phát hành từ main (nút Cập nhật kéo origin/main)."; exit 1; }
git fetch --quiet origin
if git rev-parse --verify --quiet origin/main >/dev/null && ! git merge-base --is-ancestor "$(git rev-parse origin/main)" HEAD; then
  echo "❌ main trên máy đang thiếu commit của origin/main — chạy 'git pull' trước."; exit 1
fi

cur=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([0-9.]*\)".*/\1/p' "$VJSON")
[ -n "$cur" ] || { echo "❌ Không đọc được version trong $VJSON"; exit 1; }
new=""
if [ $# -ge 1 ] && printf '%s' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then new="$1"; shift; fi
if [ -z "$new" ]; then IFS=. read -r a b c <<<"$cur"; new="$a.$b.$((c + 1))"; fi
msg="${*:-Folder Sync v$new}"

if git ls-remote --exit-code --tags origin "refs/tags/v$new" >/dev/null 2>&1; then
  echo "❌ Tag v$new đã có trên GitHub — chọn version khác."; exit 1
fi
grep -q "v: \"$new\"" "$CHANGELOG" || { echo "❌ Chưa có mục cho v$new trong $CHANGELOG — thêm (mới nhất ở trên) rồi phát hành."; exit 1; }

echo "→ Chạy test…"
npm test >/dev/null 2>&1 || { echo "❌ Test lỗi — chạy 'npm test' để xem, sửa xong rồi phát hành."; exit 1; }

echo "Phát hành v$cur -> v$new …"
if [ -n "$(git status --porcelain)" ]; then
  echo "Các file sẽ nằm trong bản phát hành:"; git status --short
  if [ "${PUBLISH_YES:-}" != "1" ]; then
    printf "Commit TẤT CẢ các file trên thành v%s? [y/N] " "$new"; read -r ok
    [ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "Đã huỷ — chưa commit gì."; exit 1; }
  fi
fi

sed -i '' "s/\"version\"[[:space:]]*:[[:space:]]*\"[0-9.]*\"/\"version\": \"$new\"/" "$VJSON"
sed -i '' "s/ExtensionBundleVersion=\"[0-9.]*\"/ExtensionBundleVersion=\"$new\"/" "$MANIFEST"
sed -i '' "s/\(<Extension Id=\"com.foldersync.panel.[a-z]*\" Version=\)\"[0-9.]*\"/\1\"$new\"/g" "$MANIFEST"
sed -i '' "s/VERSION: '[0-9.]*'/VERSION: '$new'/" "$CONSTS"
sed -i '' "s#<b id=\"ver\">V[0-9.]*</b>#<b id=\"ver\">V$new</b>#" "$PANEL"

fail() { echo "❌ Đóng dấu version thất bại ở $1 — hoàn tác, dừng."; git checkout -- "$VJSON" "$MANIFEST" "$CONSTS" "$PANEL"; exit 1; }
grep -q "\"version\": \"$new\"" "$VJSON" || fail "$VJSON"
grep -q "ExtensionBundleVersion=\"$new\"" "$MANIFEST" || fail "$MANIFEST (bundle)"
[ "$(grep -c "Version=\"$new\" />" "$MANIFEST")" -ge 3 ] || fail "$MANIFEST (extensions)"
grep -q "VERSION: '$new'" "$CONSTS" || fail "$CONSTS"
grep -q "<b id=\"ver\">V$new</b>" "$PANEL" || fail "$PANEL"

git add -A
git diff --cached --quiet || git commit -q -m "$msg (v$new)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin main
echo "✅ Đã push v$new lên GitHub."

REPO_SLUG=$(git remote get-url origin | sed -e 's#.*github.com[:/]##' -e 's#\.git$##')
if command -v gh >/dev/null 2>&1; then
  notes=$(node -e "global.window={};require('./$CHANGELOG');const r=window.FS_CHANGELOG.find(x=>x.v==='$new');console.log(r.items.map(i=>'- '+i).join('\n'))")
  notes="$notes

**Cài đặt (macOS):** mở Terminal và chạy
\`\`\`
curl -fsSL https://raw.githubusercontent.com/$REPO_SLUG/main/web-install.sh | bash
\`\`\`
hoặc tải \`Folder-Sync-Installer.zip\` bên dưới. Đã cài rồi thì bấm **↑ Cập nhật** trong panel."
  if ./build-installer.sh >/dev/null \
     && gh release create "v$new" "dist/Folder-Sync-Installer.zip" --repo "$REPO_SLUG" --target main \
          --title "Folder Sync v$new" --notes "$notes" --latest; then
    echo "✅ Đã tạo GitHub Release v$new."
  else
    echo "⚠️  Code ĐÃ push nhưng chưa tạo được Release. Chạy tay:"
    echo "    ./build-installer.sh && gh release create v$new dist/Folder-Sync-Installer.zip --repo $REPO_SLUG --title \"Folder Sync v$new\" --latest"
  fi
else
  echo "⚠️  Không có gh CLI — code đã push nhưng chưa tạo Release."
fi
