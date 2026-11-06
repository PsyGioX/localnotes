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
// Определение языка и редирект переехали в js/lang-core.js (LNLang) — он
// выполняется синхронно в <head>, ещё до первой отрисовки, поэтому вспышки
// английской версии при редиректе больше нет. Здесь остался только
// консольный баннер для английской (корневой) страницы и совместимость
// со старыми глобальными именами.
var languageMap = {};
if (window.LNLang) {
    window.LNLang.SUPPORTED.forEach(function (c) {
        if (c !== 'en') languageMap[window.LNLang.META[c].html] = '/' + c + '/';
    });
}

function getUserLanguage() {
    return window.LNLang ? window.LNLang.current() : 'en';
}

(function () {
    if (window.__lnRedirecting) return;
    var path = window.location.pathname;
    var isRootPage = (path === '/' || path === '/index.html');
    if (!isRootPage) return;
    function run() {
        // Мы на корне и редирект не потребовался → это английская версия.
        window.currentLang = 'en';
        showMainPage();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();

function showMainPage() {
    console.clear();

    var originalLog = console.log;
    var originalWarn = console.warn;
    var originalError = console.error;

    var filterPatterns = [
        /ISOLATED@/, /got message/, /Worlds\.js/, /mbEGGjir\.js/,
        /Service Worker/, /violates the following Content Security Policy/,
        /preload/, /crossorigin attribute/, /deprecated features/, /TinyMCE/,
        /Google Analytics/, /searchAnalyzer/, /Search engine null/, /\[GET_CSS\]/,
        /content-scripts\.js/, /Loading the (font|script)/, /Live reload/,
        /Google Analytics script failed/, /Initializing language/,
        /The resource.*was preloaded/
    ];

    var shouldFilter = function(args) {
        var message = args.join(' ');
        return filterPatterns.some(function(p) { return p.test(message); });
    };

    console.log = function() { if (!shouldFilter([].slice.call(arguments))) originalLog.apply(console, arguments); };
    console.warn = function() { if (!shouldFilter([].slice.call(arguments))) originalWarn.apply(console, arguments); };
    console.error = function() { if (!shouldFilter([].slice.call(arguments))) originalError.apply(console, arguments); };

    originalLog('%c' +
        '╔═══════════════════════════════════════════════════════════╗\n' +
        '║                                                           ║\n' +
        '║                  LOCAL NOTES - SECURE NOTES                ║\n' +
        '║                                                           ║\n' +
        '╚═══════════════════════════════════════════════════════════╝',
        'color: #4CAF50; font-weight: bold; font-size: 12px; font-family: monospace;');

    originalLog('%c\n🔐 SECURITY', 'color: #FF5722; font-size: 16px; font-weight: bold;');
    originalLog('%c   ✓ AES-256 industry-standard encryption', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ All data stored locally', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ No data sent to servers', 'color: #666; font-size: 12px;');

    originalLog('%c\n🌍 FEATURES', 'color: #1bb94b; font-size: 16px; font-weight: bold;');
    originalLog('%c   ✓ 12 interface languages', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ PWA - works as an app', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ Offline mode', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ LocalNotesEditor - rich text editing', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ Search with transliteration', 'color: #666; font-size: 12px;');

    originalLog('%c\n📊 INFORMATION', 'color: #9C27B0; font-size: 16px; font-weight: bold;');
    originalLog('%c   Version:  1.15.0', 'color: #666; font-size: 12px;');
    originalLog('%c   Author:   PsyGioX', 'color: #666; font-size: 12px;');
    originalLog('%c   Website:  https://localnotes-three.vercel.app/', 'color: #666; font-size: 12px;');
    originalLog('%c   GitHub:   https://github.com/PsyGioX/localnotes', 'color: #666; font-size: 12px;');

    originalLog('%c\n💡 TIP', 'color: #FF9800; font-size: 16px; font-weight: bold;');
    originalLog('%c   Use search with transliteration for convenient searching!', 'color: #666; font-size: 12px;');
    originalLog('%c   Cyrillic ↔ Latin automatically', 'color: #666; font-size: 12px;');
    originalLog('%c\n' + '='.repeat(63) + '\n', 'color: #4CAF50; font-weight: bold;');

    if (typeof updateButtonTexts === 'function') {
        setTimeout(updateButtonTexts, 200);
    }
}
