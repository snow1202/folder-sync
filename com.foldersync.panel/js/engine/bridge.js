// Folder Sync — cầu nối JS (CEP) ↔ ExtendScript (host.jsx).
//
// Mỗi hàm FS_* nhận 1 chuỗi JSON là mảng tham số. Ta JSON hoá 2 lần: lần 1 ra
// chuỗi JSON, lần 2 biến nó thành literal chuỗi JS an toàn để nhúng vào evalScript.

function createBridge(csInterface) {
  function call(fn, ...args) {
    const script = fn + '(' + JSON.stringify(JSON.stringify(args)) + ')';
    return new Promise((resolve, reject) => {
      csInterface.evalScript(script, (out) => {
        if (out === 'EvalScript error.' || out === undefined || out === null) {
          reject(new Error('EvalScript lỗi khi gọi ' + fn));
          return;
        }
        let r;
        try { r = JSON.parse(out); } catch (e) { reject(new Error('Kết quả không phải JSON từ ' + fn + ': ' + String(out).slice(0, 200))); return; }
        if (r && typeof r === 'object' && !Array.isArray(r) && r.error) { reject(new Error(r.error)); return; }
        resolve(r);
      });
    });
  }

  return {
    call,
    ping: () => call('FS_ping'),
    listProjects: () => call('FS_listProjects'),
    listMediaPaths: (docId) => call('FS_listMediaPaths', docId),
    getSelectedBin: (docId) => call('FS_getSelectedBin', docId),
    ensureBins: (docId, items) => call('FS_ensureBins', docId, items),
    importBatch: (docId, binNodeId, paths, label) => call('FS_importBatch', docId, binNodeId, paths, label),
    findItem: (docId, nodeId) => call('FS_findItem', docId, nodeId),
    describeBins: (docId, nodeId) => call('FS_describeBins', docId, nodeId),
    relinkMedia: (docId, oldRoot, newRoot) => call('FS_relinkMedia', docId, oldRoot, newRoot),
    notify: (msg) => call('FS_notify', msg),
  };
}

module.exports = { createBridge };
