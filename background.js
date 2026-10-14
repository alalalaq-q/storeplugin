// ============================================================
// 电商图片提取下载插件 - 后台服务（background.js，Service Worker）
// 职责：
//   1) 接收内容脚本消息，存储图片列表并打开 gallery 页面；
//   2) 接收下载请求，跨域抓取图片并转换为 PNG 后保存。
// ============================================================

// 监听消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_GALLERY') {
    // 先写入存储，再打开页面，保证 gallery 能读到最新数据
    chrome.storage.local.set(
      { extractedImages: msg.images || [], pageTitle: msg.pageTitle || '' },
      () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
        sendResponse({ ok: true });
      }
    );
    return true; // 异步响应，保持消息通道打开
  }

  if (msg.type === 'DOWNLOAD') {
    downloadImages(msg.images || [], msg.pageTitle || '商品图')
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // 异步响应
  }
});

// 清洗文件名中的非法字符，并限制长度
function sanitizeFilename(name) {
  const cleaned = String(name)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
  return cleaned || '商品图';
}

// 抓取图片并转换为 PNG Blob
async function fetchAndConvertToPng(url) {
  const resp = await fetch(url, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store'
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);

  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/png' });
}

// 触发单个 Blob 的下载
function downloadBlob(blob, filename) {
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(blob);
    chrome.downloads.download({ url: blobUrl, filename, saveAs: false }, (id) => {
      if (chrome.runtime.lastError || id === undefined) {
        URL.revokeObjectURL(blobUrl);
        reject(new Error((chrome.runtime.lastError && chrome.runtime.lastError.message) || '下载失败'));
      } else {
        // 延迟回收，确保下载任务已经建立
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        resolve(id);
      }
    });
  });
}

// 直接下载原图（用于 PNG 转换失败时的兜底，保留原始格式）
function directDownload(url, baseName, index) {
  let ext = 'jpg';
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(/\.(png|jpe?g|webp|gif|bmp|avif)(?=$|[?#])/i);
    if (m) {
      ext = m[1].toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
    }
  } catch (_) { /* 忽略，使用默认扩展名 */ }

  const filename = `${baseName}_${String(index + 1).padStart(3, '0')}.${ext}`;
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs: false }, (id) => {
      if (chrome.runtime.lastError || id === undefined) {
        reject(new Error((chrome.runtime.lastError && chrome.runtime.lastError.message) || '下载失败'));
      } else {
        resolve(id);
      }
    });
  });
}

// 批量下载：逐张转换并广播进度
async function downloadImages(images, rawTitle) {
  const baseName = sanitizeFilename(rawTitle) || '商品图';
  const total = images.length;
  let okCount = 0;
  let failCount = 0;

  for (let i = 0; i < total; i++) {
    const it = images[i];
    const url = typeof it === 'string' ? it : it.url;
    const filename = `${baseName}_${String(i + 1).padStart(3, '0')}.png`;
    try {
      const blob = await fetchAndConvertToPng(url);
      await downloadBlob(blob, filename);
      okCount++;
    } catch (e) {
      // 转 PNG 失败时，退化为直接下载原图（保留原始格式，保证图片能下下来）
      try {
        await directDownload(url, baseName, i);
        okCount++;
      } catch (e2) {
        failCount++;
        console.warn('下载失败：', url, e, e2);
      }
    }
    // 向 gallery 页面广播进度（无监听者时忽略）
    chrome.runtime
      .sendMessage({
        type: 'DOWNLOAD_PROGRESS',
        done: i + 1,
        total,
        okCount,
        failCount
      })
      .catch(() => {});
  }

  return { ok: true, okCount, failCount };
}
