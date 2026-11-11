/* Enhancements only. The page is complete without this file. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Mobile menu (links are a plain row when JS is off) */
  var btn = doc.querySelector('.menu-btn'), nav = doc.getElementById('nav');
  if (btn && nav) {
    btn.hidden = false;
    var setOpen = function (open) {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  if (!('IntersectionObserver' in window)) {
    root.classList.remove('js'); /* nothing stays hidden */
    return;
  }

  /* 2. Scroll reveals */
  var reveals = doc.querySelectorAll('.reveal');
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach(function (el) { revealIO.observe(el); });

  /* 3. Highlight the current section in the nav */
  var links = {};
  nav.querySelectorAll('a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  var navIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var a = links[en.target.id];
      if (!a || !en.isIntersecting) return;
      Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
      a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  doc.querySelectorAll('main section[id]').forEach(function (s) { navIO.observe(s); });

  /* 3a. Looping decorations only animate while their section is on screen */
  var visIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { en.target.classList.toggle('vis', en.isIntersecting); });
  });
  doc.querySelectorAll('.sec').forEach(function (s) { visIO.observe(s); });

  /* 3b. Spotlight that follows the pointer across project cards (mouse only) */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var cards = doc.querySelector('.cards'), pending = null;
    if (cards) cards.addEventListener('pointermove', function (e) {
      if (pending) { pending = e; return; }
      pending = e;
      requestAnimationFrame(function () {
        var card = pending.target.closest('.card');
        if (card) {
          var r = card.getBoundingClientRect();
          card.style.setProperty('--mx', (pending.clientX - r.left) + 'px');
          card.style.setProperty('--my', (pending.clientY - r.top) + 'px');
        }
        pending = null;
      });
    }, { passive: true });
  }

  /* 4. Hero scan: load only when it is worth it.
        Stays a static image for reduced motion, data saver and low-end devices. */
  var scan = doc.querySelector('[data-scan]');
  var conn = navigator.connection || {};
  var lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
               (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
               conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  if (scan && !reduce && !lowEnd && !window.__SCAN_OFF) {
    var load = function () {
      var s = doc.createElement('script');
      s.src = 'assets/js/arm.js';
      s.async = true;
      doc.head.appendChild(s);
    };
    var whenIdle = function () {
      if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2500 });
      else setTimeout(load, 600);
    };
    if (doc.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
  }
})();
