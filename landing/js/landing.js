/*
 * Local Notes — a local-first, privacy-focused notes app (PWA): rich-text/Markdown editor,
 * AES-256-GCM encrypted storage in the browser, offline mode, 12 languages. No server-side data.
 * Local Notes — локальное приватное приложение для заметок (PWA): редактор rich-text/Markdown,
 * шифрование AES-256-GCM в браузере, офлайн-режим, 12 языков. Данные не уходят на сервер.
 *
 * Copyright (c) 2026 PsyGioX. Licensed under the MIT License.
 * Source: https://github.com/PsyGioX/localnotes — Site: https://localnotes-three.vercel.app
 *
 * Copyright (c) 2026 PsyGioX. Лицензия MIT.
 * Исходники: https://github.com/PsyGioX/localnotes — Сайт: https://localnotes-three.vercel.app
 */
/* ============================================================
   Local Notes — Landing Page JS
   ============================================================ */

(function () {
  'use strict';

  /* ── Scroll animations ──────────────────────────────────── */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.animate-in').forEach((el) => observer.observe(el));

  /* ── Sticky nav ─────────────────────────────────────────── */
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Mobile nav toggle ──────────────────────────────────── */
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileNav = document.querySelector('.nav-mobile');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileNav.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── Smooth scroll for anchor links ────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 64;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ── Mock notes proximity blur (mouse tracking) ─────────── */
  const mockNotes = document.getElementById('mockNotes');
  if (mockNotes) {
    const notes = Array.from(mockNotes.querySelectorAll('.mock-note'));
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isTouch) {
      document.addEventListener('mousemove', (e) => {
        notes.forEach((note) => {
          const rect = note.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
          const t = Math.max(0, Math.min(1, (dist - 30) / 180));
          note.style.filter = 'blur(' + (t * 5).toFixed(1) + 'px)';
          note.style.opacity = (0.45 + (1 - t) * 0.55).toFixed(2);
          note.style.transition = 'filter 0.18s ease, opacity 0.18s ease';
        });
      });
      const heroVisual = document.querySelector('.hero-visual');
      if (heroVisual) {
        heroVisual.addEventListener('mouseleave', () => {
          notes.forEach((n) => { n.style.filter = 'blur(4px)'; n.style.opacity = '0.55'; });
        });
      }
    }
  }

  /* ── Blur reveal (click to toggle on touch) ─────────────── */
  document.querySelectorAll('.blur-reveal').forEach((el) => {
    el.addEventListener('click', () => el.classList.toggle('revealed'));
  });

  /* ── Cookie banner ──────────────────────────────────────── */
  // Banner is visible by default via CSS animation.
  // The inline script right after the banner already hid it if consent exists.
  // Here we just wire up the buttons.
  // Use DOMContentLoaded because this script loads before the banner element in HTML.
  document.addEventListener('DOMContentLoaded', function() {
    var banner = document.getElementById('cookieBanner');
    if (!banner) return;

    function dismissBanner() {
      banner.style.animation = 'none';
      banner.classList.add('hiding');
      setTimeout(function() { if (banner.parentNode) banner.remove(); }, 450);
    }

    var btnAccept  = document.getElementById('cookieAccept');
    var btnDecline = document.getElementById('cookieDecline');

    if (btnAccept) {
      btnAccept.addEventListener('click', function() {
        localStorage.setItem('ln_cookie_consent', 'accepted');
        if (typeof loadGA === 'function') loadGA();
        dismissBanner();
      });
    }
    if (btnDecline) {
      btnDecline.addEventListener('click', function() {
        localStorage.setItem('ln_cookie_consent', 'declined');
        dismissBanner();
      });
    }
  });

  /* ── FAQ accordion ──────────────────────────────────────── */
  document.querySelectorAll('.faq-item').forEach((item) => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // close all
      document.querySelectorAll('.faq-item.open').forEach((el) => {
        el.classList.remove('open');
        el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ── Language redirect ──────────────────────────────────── */
  var isRoot = !window.location.pathname.match(/\/(ru|ua|pl|cs|sk|bg|hr|sr|bs|mk|sl|en)\//);
  var alreadyRedirected = sessionStorage.getItem('ln_redirected');

  if (isRoot && !alreadyRedirected) {
    var localeMap = {
      ru: 'ru', uk: 'ua', pl: 'pl', cs: 'cs', sk: 'sk',
      bg: 'bg', hr: 'hr', sr: 'sr', bs: 'bs', mk: 'mk', sl: 'sl'
    };
    var lang = (navigator.language || '').slice(0, 2).toLowerCase();
    var locale = localeMap[lang];
    if (locale) {
      sessionStorage.setItem('ln_redirected', '1');
      var base = window.location.pathname.replace(/\/?$/, '/');
      window.location.replace(base + locale + '/');
    }
  }

})();
