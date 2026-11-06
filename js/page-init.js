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
// Force cache refresh for old SW cache versions
if ('caches' in window) {
    caches.keys().then(function(cacheNames) {
        cacheNames.forEach(function(cacheName) {
            if (cacheName.includes('v1.0.2') || cacheName.includes('v1.0.3') ||
                cacheName.includes('v1.0.4') || cacheName.includes('v1.0.5') ||
                cacheName.includes('v1.1.0') || cacheName.includes('v1.1.1') ||
                cacheName.includes('v1.1.2') || cacheName.includes('v1.1.3')) {
                caches.delete(cacheName);
            }
        });
    });
}

// Remove styles-loading and show page on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    if (document.body) {
        document.body.classList.remove('styles-loading');
        document.body.classList.add('styles-loaded');
    }
});

// Load non-critical CSS asynchronously (replaces onload= event handlers on <link> tags)
(function() {
    var sheets = [
        '/css/img.css?v=2024.2',
        '/localnoteseditor/bootstrap-icons/font/bootstrap-icons.min.css',
        '/css/highlight.css?v=2024.2',
        '/localnoteseditor/styles.css?v=2024.2',
        '/css/editor-modal.css?v=2024.2',
        '/css/apple.css?v=2024.2',
        '/css/tags-calendar.css?v=2024.2',
        '/css/workspaces.css?v=2024.2',
        '/css/task-board.css?v=2024.2',
        '/css/action-bar.css?v=2024.2',
        '/css/onboarding-tour.css?v=2024.2',
        '/css/sidebar.css?v=2024.2',
        '/css/modal-system.css?v=2024.2',
        '/css/editor-fullpage.css?v=2024.2'
    ];
    sheets.forEach(function(href) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        // Insert BEFORE the static office2024.css link so that sheet always stays last (wins the cascade)
        var anchor = document.querySelector('link[href*="office2024.css"]');
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(link, anchor);
        else document.head.appendChild(link);
    });
})();
