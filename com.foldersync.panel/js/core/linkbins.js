// Folder Sync — Link existing bins: suy đường dẫn folder từ cây bin có sẵn.
//
// binTree: { nodeId, name, children: [binTree], sample: mediaPath|null }
// Ý tưởng: bin X (dưới gốc B theo chuỗi tên b1..bk) chứa file F. Nếu thư mục của F
// kết thúc bằng các thư mục tên b1..bk thì folder của B là phần đứng trước.
// Chỉ cần 1 file ở bất kỳ đâu trong cây là liên kết được cả cây.
const path = require('path');

function nameKey(s) {
  return String(s || '').normalize('NFC').toLowerCase();
}

function* walk(node, chain) {
  yield { node, chain };
  for (const c of node.children || []) yield* walk(c, chain.concat([c.name]));
}

function inferRoot(binTree) {
  for (const { node, chain } of walk(binTree, [])) {
    if (!node.sample) continue;
    const parts = path.dirname(node.sample).split(path.sep);
    if (parts.length - 1 < chain.length) continue;
    const tail = parts.slice(parts.length - chain.length);
    const ok = chain.every((b, i) => nameKey(b) === nameKey(tail[i]));
    if (!ok) continue;
    const head = parts.slice(0, parts.length - chain.length).join(path.sep);
    if (head) return head;
  }
  return null;
}

function mapBins(binTree, rootFolder) {
  const out = [];
  (function rec(node, rel, parentNodeId) {
    out.push({ nodeId: node.nodeId, folder: rel ? path.join(rootFolder, rel) : rootFolder, relPath: rel, parentNodeId });
    for (const c of node.children || []) rec(c, rel ? rel + '/' + c.name : c.name, node.nodeId);
  })(binTree, '', null);
  return out;
}

module.exports = { inferRoot, mapBins };
