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
// Preloader controller — manages the inline #app-preloader element

(function () {
    const el = document.getElementById('app-preloader');
    if (!el) return;

    const lang = (() => {
        // 1. From URL path: /ru/, /ua/, etc.
        const m = window.location.pathname.match(/^\/([a-z]{2})\//);
        if (m) return m[1];
        // 2. From localStorage (saved preference)
        const saved = localStorage.getItem('preferredLanguage');
        if (saved) return saved;
        // 3. From browser language
        return (navigator.language || 'en').split('-')[0];
    })();
    const loadingTexts = {
        en: ['Initializing...', 'Loading modules...', 'Security check...', 'Preparing interface...', 'Almost ready...'],
        ru: ['Инициализация...', 'Загрузка модулей...', 'Проверка безопасности...', 'Подготовка интерфейса...', 'Почти готово...'],
        ua: ['Ініціалізація...', 'Завантаження модулів...', 'Перевірка безпеки...', 'Підготовка інтерфейсу...', 'Майже готово...'],
        pl: ['Inicjalizacja...', 'Ładowanie modułów...', 'Sprawdzanie...', 'Przygotowanie...', 'Prawie gotowe...'],
        cs: ['Inicializace...', 'Načítání modulů...', 'Kontrola...', 'Příprava...', 'Téměř hotovo...'],
        sk: ['Inicializácia...', 'Načítavanie...', 'Kontrola...', 'Príprava...', 'Takmer hotovo...'],
        bg: ['Инициализация...', 'Зареждане...', 'Проверка...', 'Подготовка...', 'Почти готово...'],
        hr: ['Inicijalizacija...', 'Učitavanje...', 'Provjera...', 'Priprema...', 'Gotovo...'],
        sr: ['Иницијализација...', 'Учитавање...', 'Провера...', 'Припрема...', 'Скоро готово...'],
        bs: ['Inicijalizacija...', 'Učitavanje...', 'Provjera...', 'Priprema...', 'Gotovo...'],
        mk: ['Иницијализација...', 'Вчитување...', 'Проверка...', 'Подготовка...', 'Речиси готово...'],
        sl: ['Inicializacija...', 'Nalaganje...', 'Preverjanje...', 'Priprava...', 'Skoraj pripravljeno...'],
    };
    const texts = loadingTexts[lang] || loadingTexts.en;

    el.innerHTML = `
        <div class="app-preloader-inner">
            <div id="app-preloader-spinner"></div>
            <div id="app-preloader-text">Local Notes</div>
            <div class="app-preloader-progress">
                <div id="app-preloader-bar"></div>
            </div>
            <div id="app-preloader-status">${texts[0]}</div>
        </div>
    `;

    const bar = document.getElementById('app-preloader-bar');
    const status = document.getElementById('app-preloader-status');
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    let hidden = false;

    // Rotate status texts
    let textIndex = 0;
    const textInterval = setInterval(() => {
        textIndex = Math.min(textIndex + 1, texts.length - 1);
        if (status) status.textContent = texts[textIndex];
    }, 600);

    // Progress reaches the end independently; the overlay still waits for
    // the real appReady signal before fading out.
    const startTime = Date.now();
    const tick = () => {
        if (hidden) return;
        const t = Math.min((Date.now() - startTime) / 3000, 1);
        if (bar) bar.style.width = (easeOut(t) * 100) + '%';

        // App Lock deliberately waits for user input before the main init
        // promise resolves. Let the lock screen become interactive instead
        // of keeping it trapped behind the preloader.
        const lockIsVisible = document.querySelector('.ln-lock-overlay');
        if (window.appReady || lockIsVisible) {
            hidePreloader();
        } else {
            requestAnimationFrame(tick);
        }
    };
    requestAnimationFrame(tick);

    function hidePreloader() {
        if (hidden) return;
        hidden = true;
        clearInterval(textInterval);
        if (bar) bar.style.width = '100%';
        if (status) status.textContent = texts[texts.length - 1];
        setTimeout(() => {
            el.style.transition = 'opacity 0.35s ease';
            el.style.opacity = '0';
            setTimeout(() => {
                el.remove();
                if (window.onPreloaderDone) window.onPreloaderDone();
            }, 350);
        }, 200);
    }

    // Safety fallback — a slow optional module must never leave the app
    // permanently covered by the startup screen.
    setTimeout(() => { window.appReady = true; }, 6000);

    window.resetPreloader = function () { sessionStorage.removeItem('preloaderLastShown'); };
})();
