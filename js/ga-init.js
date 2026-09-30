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
// Google Analytics — Consent Mode v2: default denied until user consents
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
});

// GA script loaded only after consent check
window.addEventListener('load', function() {
    setTimeout(function() {
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=G-HR9HLBQFCR';
        s.addEventListener('load', function() {
            gtag('js', new Date());
            gtag('config', 'G-HR9HLBQFCR');
        });
        document.head.appendChild(s);
    }, 2000);
});
