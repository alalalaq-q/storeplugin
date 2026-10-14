// ============================================================
// 电商图片提取下载插件 - 内容脚本（content.js）
// 职责：在页面右下角注入「获取图片」悬浮按钮；
//       点击后扫描页面内所有商品相关图片并发送给后台。
// ============================================================
(function () {
  'use strict';

  // 最小尺寸阈值：小于该尺寸的图片视为图标 / 占位图而被过滤
  const MIN_SIZE = 100;

  // 注入悬浮按钮
  function injectButton() {
    if (document.getElementById('img-extract-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'img-extract-btn';
    btn.type = 'button';
    btn.textContent = '获取图片';
    btn.title = '提取本页所有商品图片';
    document.body.appendChild(btn);

    btn.addEventListener('click', onExtract);
  }

  // 归一化为绝对 URL
  function toAbsolute(u) {
    if (!u) return null;
    u = String(u).trim();
    // 跳过 data:/blob:/about: 等非 http 资源
    if (/^(data:|blob:|about:|javascript:)/i.test(u)) return null;
    try {
      return new URL(u, location.href).href;
    } catch (e) {
      return null;
    }
  }

  // 是否明显无关（图标 / logo / 占位图等）
  function isIrrelevant(url) {
    const lower = url.toLowerCase();
    const filename = lower.split('/').pop() || '';
    const keywords = [
      'logo', 'icon', 'avatar', 'favicon', 'loading', 'placeholder',
      'blank', 'spacer', 'transparent', '1x1', 'pixel', 'sprite',
      'qrcode', 'arrow', 'button', 'share', 'collect', 'cart', 'star',
      'rating', 'badge', 'seal', 'empty'
    ];
    for (let i = 0; i < keywords.length; i++) {
      if (filename.indexOf(keywords[i]) !== -1) return true;
    }
    return false;
  }

  // 从 srcset 中挑选分辨率最高的候选
  function pickBestSrcset(srcset) {
    if (!srcset) return null;
    const parts = srcset.split(',').map((s) => s.trim()).filter(Boolean);
    let best = null, bestW = -1, bestD = -1;
    for (const p of parts) {
      const seg = p.split(/\s+/);
      const url = seg[0];
      let w = 0, d = 0;
      for (let i = 1; i < seg.length; i++) {
        if (seg[i].endsWith('w')) w = parseInt(seg[i], 10) || 0;
        else if (seg[i].endsWith('x')) d = parseFloat(seg[i]) || 0;
      }
      if (w > bestW || (w === bestW && d > bestD)) {
        bestW = w; bestD = d; best = url;
      }
    }
    return best;
  }

  // 从 CSS 字符串中提取 url(...)
  function extractBgUrls(bgStr) {
    const out = [];
    if (!bgStr || bgStr === 'none') return out;
    const re = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    let m;
    while ((m = re.exec(bgStr)) !== null) {
      if (m[2] && !/^data:/i.test(m[2])) out.push(m[2]);
    }
    return out;
  }

  // 收集图片
  function collectImages() {
    const result = [];
    const seen = {};

    function addUrl(raw, w, h) {
      const abs = toAbsolute(raw);
      if (!abs || seen[abs]) return;
      if (isIrrelevant(abs)) return;
      // 已知尺寸且过小则过滤
      if (w > 0 && h > 0 && (w < MIN_SIZE || h < MIN_SIZE)) return;
      seen[abs] = true;
      result.push({ url: abs, width: w || 0, height: h || 0 });
    }

    // 1) <img> 标签
    document.querySelectorAll('img').forEach((img) => {
      const w = img.naturalWidth || parseInt(img.getAttribute('width'), 10) || 0;
      const h = img.naturalHeight || parseInt(img.getAttribute('height'), 10) || 0;

      const srcList = [
        img.getAttribute('data-src'),
        img.getAttribute('data-lazy-src'),
        img.getAttribute('data-lazy'),
        img.getAttribute('data-original'),
        img.getAttribute('data-ks-lazyload'),
        img.getAttribute('data-hi-res'),
        img.getAttribute('data-big'),
        img.currentSrc,
        img.src
      ];
      for (const s of srcList) addUrl(s, w, h);

      addUrl(pickBestSrcset(img.getAttribute('srcset')), w, h);
    });

    // 2) 内联样式中的背景图（快速、全量）
    document.querySelectorAll('[style*="background"]').forEach((el) => {
      const urls = extractBgUrls(el.getAttribute('style'));
      for (const u of urls) addUrl(u, 0, 0);
    });

    // 3) 计算样式中的背景图（有限扫描，避免页面过大卡顿）
    const els = document.querySelectorAll('div, li, a, span, section, td, img');
    const MAX_SCAN = 3000;
    const n = Math.min(els.length, MAX_SCAN);
    for (let k = 0; k < n; k++) {
      const urls = extractBgUrls(getComputedStyle(els[k]).backgroundImage);
      for (const u of urls) addUrl(u, 0, 0);
    }

    // 限制数量上限，防止异常页面产生过多数据
    return result.slice(0, 500);
  }

  // 点击「获取图片」
  function onExtract() {
    const btn = document.getElementById('img-extract-btn');
    if (!btn) return;
    btn.textContent = '提取中…';
    btn.disabled = true;

    let images = [];
    try {
      images = collectImages();
    } catch (e) {
      console.error('提取图片出错：', e);
    }

    chrome.runtime.sendMessage(
      { type: 'OPEN_GALLERY', images, pageTitle: document.title || '' },
      () => {
        btn.textContent = '获取图片';
        btn.disabled = false;
        if (chrome.runtime.lastError) {
          console.error('发送消息失败：', chrome.runtime.lastError.message);
        }
      }
    );
  }

  // 入口：在所有匹配域名（淘宝/京东/拼多多商家版）的页面上都注入按钮
  if (document.body) {
    injectButton();
  }
})();
