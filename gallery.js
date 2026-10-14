// ============================================================
// 电商图片提取下载插件 - 结果展示页逻辑（gallery.js）
// 职责：读取后台存储的图片列表，网格展示、勾选、发起下载。
// ============================================================
(function () {
  'use strict';

  let images = [];
  let pageTitle = '';

  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const countEl = document.getElementById('count');
  const progressEl = document.getElementById('progress');
  const downloadBtn = document.getElementById('download');

  // 读取后台存储的图片列表与页面标题
  chrome.storage.local.get(['extractedImages', 'pageTitle'], (data) => {
    images = data.extractedImages || [];
    pageTitle = data.pageTitle || '';
    if (pageTitle) {
      document.getElementById('title').textContent = pageTitle;
    }
    render();
  });

  function render() {
    grid.innerHTML = '';
    if (!images.length) {
      empty.hidden = false;
      updateCount();
      return;
    }
    empty.hidden = true;

    images.forEach((it, idx) => {
      const url = it.url;
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.index = idx;

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'check';
      check.checked = true;

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '图片 ' + (idx + 1);
      img.src = url;
      img.addEventListener('error', () => {
        card.classList.add('broken');
        img.remove();
        const ph = document.createElement('div');
        ph.className = 'placeholder';
        ph.textContent = '加载失败';
        const meta = card.querySelector('.meta');
        if (meta) meta.before(ph);
      });

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = (it.width || '?') + ' × ' + (it.height || '?');
      img.addEventListener('load', () => {
        meta.textContent = img.naturalWidth + ' × ' + img.naturalHeight;
      });

      // 点击卡片切换勾选
      card.addEventListener('click', (e) => {
        if (e.target === check) return; // 让原生 checkbox 自己处理
        check.checked = !check.checked;
        check.dispatchEvent(new Event('change'));
      });
      check.addEventListener('change', updateCount);

      card.appendChild(check);
      card.appendChild(img);
      card.appendChild(meta);
      grid.appendChild(card);
    });

    updateCount();
  }

  function updateCount() {
    const checked = grid.querySelectorAll('.check:checked').length;
    countEl.textContent = '共 ' + images.length + ' 张，已选 ' + checked + ' 张';
    downloadBtn.disabled = checked === 0;
  }

  function setAll(checked) {
    grid.querySelectorAll('.check').forEach((c) => { c.checked = checked; });
    updateCount();
  }

  document.getElementById('select-all').addEventListener('click', () => setAll(true));
  document.getElementById('select-none').addEventListener('click', () => setAll(false));
  document.getElementById('invert').addEventListener('click', () => {
    grid.querySelectorAll('.check').forEach((c) => { c.checked = !c.checked; });
    updateCount();
  });

  // 下载选中
  downloadBtn.addEventListener('click', async () => {
    const selected = [];
    grid.querySelectorAll('.check:checked').forEach((c) => {
      const idx = Number(c.closest('.card').dataset.index);
      selected.push(images[idx]);
    });
    if (!selected.length) return;

    downloadBtn.disabled = true;
    progressEl.textContent = '准备下载…';

    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD',
        images: selected,
        pageTitle: pageTitle
      });
      progressEl.textContent = resp && resp.ok
        ? '完成：成功 ' + resp.okCount + ' 张，失败 ' + resp.failCount + ' 张'
        : '下载失败：' + (resp && resp.error ? resp.error : '未知错误');
    } catch (e) {
      progressEl.textContent = '下载失败：' + e.message;
    }
    updateCount();
  });

  // 接收后台进度广播
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'DOWNLOAD_PROGRESS') {
      progressEl.textContent =
        '下载中 ' + msg.done + '/' + msg.total +
        '（成功 ' + msg.okCount + '，失败 ' + msg.failCount + '）';
    }
  });
})();
