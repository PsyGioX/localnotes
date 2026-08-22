// Service Worker для Local Notes
const CACHE_VERSION = 'v1.9.10';
const STATIC_CACHE  = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const CACHE_LIMIT   = 60;

// ─── Файлы, которые ОБЯЗАТЕЛЬНО должны быть в кэше ───────────────────────────
const STATIC_FILES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/robots.txt',

    // CSS
    '/css/index.css',
    '/css/img.css',
    '/css/highlight.css',
    '/css/editor-modal.css',
    '/css/tags-calendar.css',
    '/css/page.css',
    '/css/print.css',
    '/css/apple.css',

    // Шрифты — CSS
    '/fonts/local-fonts.css',
    '/fonts/golos_web/golostext.css',
    '/fonts/intro/intro.css',
    '/fonts/lekton-nerd-font-mono/lekton-nerd-font-mono.css',
    '/fonts/Roboto/roboto.css',
    '/fonts/Open_Sans/open_sans.css',
    '/fonts/Lato/lato.css',
    '/fonts/Montserrat/montserrat.css',

    // Шрифты — файлы
    '/fonts/golos_web/golostextvf-regular.woff2',
    '/fonts/golos_web/golostextvf-regular.woff',
    '/fonts/intro/intro.woff2',
    '/fonts/intro/intro.woff',
    '/fonts/lekton-nerd-font-mono/lekton-nerd-font-mono.woff2',

    // Bootstrap Icons (редактор)
    '/localnoteseditor/bootstrap-icons/font/bootstrap-icons.css',
    '/localnoteseditor/bootstrap-icons/font/bootstrap-icons.min.css',
    '/localnoteseditor/bootstrap-icons/font/fonts/bootstrap-icons.woff2',
    '/localnoteseditor/bootstrap-icons/font/fonts/bootstrap-icons.woff',

    // Редактор
    '/localnoteseditor/core.js',
    '/localnoteseditor/styles.css',

    // JavaScript
    '/js/utils.js',
    '/js/selectors.js',
    '/js/translate.js',
    '/js/themes.js',
    '/js/performance.js',
    '/js/security.js',
    '/js/crypto-worker.js',
    '/js/preloader.js',
    '/js/index.js',
    '/js/magicurl.js',
    '/js/pwa.js',
    '/js/network-mode.js',
    '/js/highlight.min.js',
    '/js/img.js',
    '/js/translations.js',
    '/js/tags-calendar.js',
    '/js/date-utils.js',
    '/js/editor-integration.js',
    '/js/markdown.js',
    '/js/import-formats.js',
    '/js/command-palette.js',
    '/js/share-target.js',

    // Данные
    '/json/lang.json',

    // Иконки
    '/favicon/favicon-16x16.png',
    '/favicon/favicon-32x32.png',
    '/favicon/android-chrome-192x192.png',
    '/favicon/android-chrome-512x512.png',
    '/favicon/apple-touch-icon.png',
    '/favicon/favicon.ico',
    '/favicon/browserconfig.xml',
    '/favicon/site.webmanifest',

    // Cookies banner
    '/cookies_banner_universal/cookies-banner.js'
];

// Языковые версии
const LANGUAGE_PAGES = [
    '/ru/', '/ua/', '/pl/', '/cs/', '/sk/',
    '/bg/', '/hr/', '/sr/', '/bs/', '/mk/', '/sl/'
];

// Добавляем языковые страницы в статический кэш
const ALL_STATIC_FILES = STATIC_FILES.concat(LANGUAGE_PAGES);

// ─── Расширения, которые всегда берём из кэша (Cache First) ──────────────────
const CACHE_FIRST_EXTS = ['.woff', '.woff2', '.ttf', '.otf', '.png', '.jpg',
                           '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif'];

// ─── Текущий режим сети (персистируется через IndexedDB / fallback переменная) ─
let networkMode = 'online'; // 'online' | 'offline' | 'auto'

// Читаем сохранённый режим из IndexedDB при старте SW
async function loadNetworkMode() {
    try {
        const db = await openModeDB();
        const tx = db.transaction('settings', 'readonly');
        const val = await idbGet(tx, 'networkMode');
        if (val === 'offline' || val === 'online' || val === 'auto') networkMode = val;
    } catch (_) { /* ignore */ }
}

// Простой IDB helper
function openModeDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('ln-sw-settings', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('settings');
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    });
}
function idbGet(tx, key) {
    return new Promise((resolve, reject) => {
        const req = tx.objectStore('settings').get(key);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    });
}
async function saveNetworkMode(mode) {
    try {
        const db = await openModeDB();
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(mode, 'networkMode');
    } catch (_) { /* ignore */ }
}

// Загружаем режим сразу при старте SW
loadNetworkMode();

// ─── Ограничение размера динамического кэша ──────────────────────────────────
async function limitCacheSize(cacheName, limit) {
    const cache = await caches.open(cacheName);
    const keys  = await cache.keys();
    if (keys.length > limit) {
        await cache.delete(keys[0]);
        await limitCacheSize(cacheName, limit);
    }
}

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => {
            return Promise.allSettled(
                ALL_STATIC_FILES.map(url =>
                    fetch(url, { cache: 'reload' })
                        .then(res => { if (res.ok) return cache.put(url, res); })
                        .catch(() => {})
                )
            );
        })
        // НЕ вызываем self.skipWaiting() здесь — SW должен ждать явного сигнала
        // от пользователя через тост, иначе каждое обновление вызывает reload страницы
    );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(
                names.map(name => {
                    if (name !== STATIC_CACHE && name !== DYNAMIC_CACHE) {
                        return caches.delete(name);
                    }
                })
            )
        ).then(() => {
            loadNetworkMode();
            return self.clients.claim();
        })
    );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Только GET, только свой origin
    if (request.method !== 'GET' || url.origin !== location.origin) return;

    // Убираем query-параметры для поиска в кэше (cache-busting ?v=...)
    const cleanRequest = new Request(url.origin + url.pathname, {
        method: request.method,
        headers: request.headers,
        mode: request.mode === 'navigate' ? 'same-origin' : request.mode,
        credentials: request.credentials,
        redirect: request.redirect
    });

    const ext = url.pathname.substring(url.pathname.lastIndexOf('.'));

    // ── Принудительный офлайн-режим: только кэш ──────────────────────────────
    // 'offline' — всегда; 'auto' — только когда реально нет соединения
    // (navigator.onLine доступен и внутри service worker'а)
    const forcedOffline = networkMode === 'offline' ||
        (networkMode === 'auto' && typeof navigator !== 'undefined' && navigator.onLine === false);
    if (forcedOffline) {
        event.respondWith(cacheOnly(cleanRequest, request));
        return;
    }

    // ── Шрифты и изображения: Cache First (никогда не меняются) ──────────────
    if (CACHE_FIRST_EXTS.includes(ext)) {
        event.respondWith(cacheFirst(cleanRequest, request));
        return;
    }

    // ── Навигация (HTML) и языковые страницы: Network First → Cache fallback ──
    if (request.mode === 'navigate' ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/' ||
        LANGUAGE_PAGES.some(p => url.pathname === p || url.pathname.startsWith(p))) {
        event.respondWith(networkFirst(cleanRequest, request));
        return;
    }

    // ── CSS, JS, JSON: Stale-While-Revalidate ────────────────────────────────
    // Отдаём из кэша мгновенно, фоном обновляем
    if (ext === '.css' || ext === '.js' || ext === '.json') {
        event.respondWith(staleWhileRevalidate(cleanRequest, request));
        return;
    }

    // ── Всё остальное: Network First ─────────────────────────────────────────
    event.respondWith(networkFirst(cleanRequest, request));
});

// ─── Стратегии ───────────────────────────────────────────────────────────────

/** Cache Only — для принудительного офлайн-режима */
async function cacheOnly(cleanReq, origReq) {
    const cached = await caches.match(cleanReq, { ignoreSearch: true })
                || await caches.match(origReq,  { ignoreSearch: true });
    if (cached) return cached;
    if (origReq.mode === 'navigate') return await caches.match('/index.html');
    return new Response('', { status: 503, statusText: 'Offline' });
}

/** Cache First — шрифты, картинки */
async function cacheFirst(cleanReq, origReq) {
    const cached = await caches.match(cleanReq, { ignoreSearch: true })
                || await caches.match(origReq,  { ignoreSearch: true });
    if (cached) return cached;
    try {
        const res = await fetch(origReq);
        if (res.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(cleanReq, res.clone());
        }
        return res;
    } catch (_) {
        return new Response('', { status: 503, statusText: 'Offline' });
    }
}

/** Stale-While-Revalidate — CSS, JS, JSON */
async function staleWhileRevalidate(cleanReq, origReq) {
    const cached = await caches.match(cleanReq, { ignoreSearch: true })
                || await caches.match(origReq,  { ignoreSearch: true });

    const fetchPromise = fetch(origReq, { cache: 'no-cache' }).then(async res => {
        if (res.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(cleanReq, res.clone());
        }
        return res;
    }).catch(() => null);

    if (cached) return cached;

    const netRes = await fetchPromise;
    if (netRes) return netRes;

    return new Response('', { status: 503, statusText: 'Offline' });
}

/** Network First — HTML, навигация */
async function networkFirst(cleanReq, origReq) {
    try {
        const res = await fetch(origReq, { cache: 'no-cache' });
        if (res.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(cleanReq, res.clone());
            limitCacheSize(DYNAMIC_CACHE, CACHE_LIMIT);
        }
        return res;
    } catch (_) {
        const cached = await caches.match(cleanReq, { ignoreSearch: true })
                    || await caches.match(origReq,  { ignoreSearch: true });
        if (cached) return cached;
        if (origReq.mode === 'navigate') {
            // Для языковых страниц (/ru/, /ua/ и т.д.) пробуем их кэш, не корневой index.html
            const url = new URL(origReq.url);
            const langMatch = url.pathname.match(/^\/([a-z]{2})\//);
            if (langMatch) {
                const langCached = await caches.match(url.pathname)
                                || await caches.match(url.pathname + 'index.html');
                if (langCached) return langCached;
            }
            return await caches.match('/index.html');
        }
        return new Response('', { status: 503, statusText: 'Offline' });
    }
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
    const data = event.data;
    if (!data) return;

    // Validate message origin — only accept from our own clients
    if (event.source && event.source.url) {
        try {
            const sourceOrigin = new URL(event.source.url).origin;
            const allowedOrigins = ['https://localnotes-three.vercel.app', 'http://localhost'];
            if (!allowedOrigins.some(o => sourceOrigin === o || sourceOrigin.startsWith('http://localhost'))) return;
        } catch (e) { return; }
    }

    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (data.type === 'GET_VERSION') {
        event.ports[0] && event.ports[0].postMessage({ version: STATIC_CACHE });
    }

    if (data.type === 'SET_NETWORK_MODE') {
        if (data.mode === 'offline' || data.mode === 'online' || data.mode === 'auto') {
            networkMode = data.mode;
            saveNetworkMode(data.mode);
        }
    }

    // Принудительно перекэшировать все статические файлы
    if (data.type === 'PRECACHE_ALL') {
        event.waitUntil(
            caches.open(STATIC_CACHE).then(cache =>
                Promise.allSettled(
                    ALL_STATIC_FILES.map(url =>
                        fetch(url, { cache: 'reload' })
                            .then(res => { if (res.ok) return cache.put(url, res); })
                            .catch(() => {})
                    )
                )
            ).then(() => {
                self.clients.matchAll().then(clients =>
                    clients.forEach(c => c.postMessage({ type: 'PRECACHE_DONE' }))
                );
            })
        );
    }
});

// ─── Периодическая очистка кэша ──────────────────────────────────────────────
self.addEventListener('periodicsync', event => {
    if (event.tag === 'cache-cleanup') {
        event.waitUntil(cleanupOldCache());
    }
});

async function cleanupOldCache() {
    try {
        const cache   = await caches.open(DYNAMIC_CACHE);
        const keys    = await cache.keys();
        const now     = Date.now();
        const maxAge  = 7 * 24 * 60 * 60 * 1000;
        for (const req of keys) {
            const res  = await cache.match(req);
            const date = res && res.headers.get('date');
            if (date && now - new Date(date).getTime() > maxAge) {
                await cache.delete(req);
            }
        }
    } catch (_) {}
}

// ─── Push уведомления ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/favicon/android-chrome-192x192.png',
            badge: '/favicon/favicon-32x32.png',
            vibrate: [100, 50, 100],
            data: { dateOfArrival: Date.now(), primaryKey: data.primaryKey },
            actions: [
                { action: 'explore', title: 'Open App', icon: '/favicon/favicon-32x32.png' },
                { action: 'close',   title: 'Close',    icon: '/favicon/favicon-32x32.png' }
            ]
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action === 'explore') {
        event.waitUntil(clients.openWindow('/'));
    }
});
