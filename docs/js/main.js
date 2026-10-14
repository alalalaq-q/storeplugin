/* ============================================================
   图提取 ImageGrab · 官网交互脚本
   功能：移动端菜单、导航吸顶、滚动高亮（Scroll Spy）、
        进入视口淡入动画（IntersectionObserver）
   ============================================================ */
(function () {
  'use strict';

  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));

  /* ---------- 1. 移动端汉堡菜单 ---------- */
  function toggleMenu(open) {
    const willOpen = open !== undefined ? open : !nav.classList.contains('open');
    nav.classList.toggle('open', willOpen);
    hamburger.classList.toggle('open', willOpen);
    hamburger.setAttribute('aria-expanded', String(willOpen));
    hamburger.setAttribute('aria-label', willOpen ? '关闭菜单' : '打开菜单');
  }

  hamburger.addEventListener('click', () => toggleMenu());

  // 点击导航链接后自动收起菜单（移动端）
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) toggleMenu(false);
    });
  });

  /* ---------- 2. 导航吸顶阴影 ---------- */
  function onScrollNav() {
    navbar.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  /* ---------- 3. 滚动高亮（Scroll Spy） ---------- */
  // 收集所有带 id 的区块
  const sections = Array.from(document.querySelectorAll('main section[id], main[id]'))
    .filter((el) => el.id && el.id !== 'top');

  function onScrollSpy() {
    // 用当前滚动位置 + 顶部偏移，找出“当前所在”的区块
    const probe = window.scrollY + navbar.offsetHeight + 80;
    let currentId = null;

    sections.forEach((sec) => {
      if (sec.offsetTop <= probe) currentId = sec.id;
    });

    // 页面滚到底部时，高亮最后一个区块
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      const last = sections[sections.length - 1];
      if (last) currentId = last.id;
    }

    navLinks.forEach((link) => {
      const href = link.getAttribute('href') || '';
      const id = href.replace('#', '');
      link.classList.toggle('active', id === currentId);
    });
  }

  window.addEventListener('scroll', onScrollSpy, { passive: true });
  window.addEventListener('resize', onScrollSpy);
  onScrollSpy();

  /* ---------- 4. 进入视口淡入动画 ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target); // 触发一次后停止观察
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    // 不支持 IntersectionObserver 时，直接全部显示
    revealEls.forEach((el) => el.classList.add('in-view'));
  }
})();
