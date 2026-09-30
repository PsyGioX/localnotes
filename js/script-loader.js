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
// Scripts download in parallel but still execute in this exact order —
// async=false on a dynamically created <script> guarantees ordered
// execution without forcing ordered *downloads*. The previous version
// chained each script's creation off the previous one's onload, which
// meant 13 full network round-trips happening one at a time instead of
// concurrently; this keeps the same execution guarantee at a fraction
// of the load time.
function loadScriptsInOrder(scripts) {
    scripts.forEach(function (src) {
        var script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onerror = function() { console.error('Failed to load: ' + src); };
        document.head.appendChild(script);
    });
}

// Load scripts after DOM is ready
var scripts = [
    '/js/highlight.min.js?v=1.9.19',
    '/js/i18n.js?v=1.9.19',
    '/js/img.js?v=1.9.19',
    '/js/date-utils.js?v=1.9.19',
    '/js/editor-integration.js?v=1.9.19',
    '/js/markdown.js?v=1.9.19',
    '/js/import-formats.js?v=1.9.19',
    '/js/tags-calendar.js?v=1.9.19',
    '/js/task-board.js?v=1.9.19',
    '/js/index.js?v=1.9.19',
    '/js/graph-view.js?v=1.9.19',
    '/js/site-export.js?v=1.9.19',
    '/js/command-palette.js?v=1.9.19',
    '/js/share-target.js?v=1.9.19',
    '/js/onboarding-tour.js?v=1.9.19',
    '/js/action-bar.js?v=1.9.19',
    '/js/sidebar.js?v=1.9.19'
];

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { loadScriptsInOrder(scripts); });
} else {
    loadScriptsInOrder(scripts);
}
