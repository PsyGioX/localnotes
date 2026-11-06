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
// Текущий язык определяет js/lang-core.js (LNLang) — единый источник правды.
// Здесь его НЕЛЬЗЯ обнулять или перезаписывать значением из localStorage:
// раньше именно это ломало языковые страницы (/ru/ показывалась на английском,
// если когда-то был выбран English) и давало несуществующий код "uk".
window.currentLang = window.currentLang || (window.LNLang ? window.LNLang.current() : 'en');

// Кеш склеенных словарей для офлайна. Версионирован и хранит максимум 2 языка
// (текущий + en): раньше туда по очереди попадали все 12 языков по ~100 КБ и
// кеш рос до квоты localStorage. Основной офлайн-кеш — Service Worker.
const LANG_CACHE_KEY = 'langDataCache2';
const LANG_CACHE_VERSION = 3;

function readLangCache() {
    try {
        const raw = localStorage.getItem(LANG_CACHE_KEY);
        const obj = raw ? JSON.parse(raw) : null;
        return (obj && obj.v === LANG_CACHE_VERSION && obj.data) ? obj.data : {};
    } catch (e) { return {}; }
}
function writeLangCache(language, langData) {
    try {
        const cache = readLangCache();
        cache[language] = langData;
        // оставляем только текущий и английский
        Object.keys(cache).forEach(k => { if (k !== language && k !== 'en') delete cache[k]; });
        localStorage.setItem(LANG_CACHE_KEY, JSON.stringify({ v: LANG_CACHE_VERSION, data: cache }));
        localStorage.removeItem('langDataCache'); // старый формат — освобождаем место
    } catch (e) { /* quota */ }
}

// Синхронное восстановление langData из кеша при старте (для офлайн-режима)
(function restoreLangCacheSync() {
    try {
        const data = readLangCache();
        window.langData = window.langData || {};
        Object.keys(data).forEach(lang => { if (!window.langData[lang]) window.langData[lang] = data[lang]; });
        localStorage.removeItem('langDataCache');
    } catch (e) { /* ignore */ }
})();

// Функция для инициализации языка при загрузке страницы
function initializeLanguage() {
    // Если язык уже установлен (например, на языковых страницах)
    if (window.currentLang) {
        changeLanguage(window.currentLang);
    }
}

// Функция для загрузки текста из /locales и обновления интерфейса
let _langRequestSeq = 0;
function changeLanguage(language) {
    // Две небольшие языковые выборки вместо одного большого json/lang.json:
    //  - /locales/site/<lang>.json  — тексты статических элементов страницы
    //  - /locales/<lang>.json       — полный набор строк приложения для t()
    // appData — база, siteData — поверх.
    language = (window.LNLang && window.LNLang.normalize(language)) || 'en';
    const seq = ++_langRequestSeq; // быстрые переключения: применяем только последний ответ
    // Абсолютные пути работают и на /, и на /ru/, и на /ru/beta.html
    const siteUrl = `/locales/site/${language}.json`;
    const appUrl = `/locales/${language}.json`;
    const getJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.json(); });

    Promise.all([getJson(siteUrl), getJson(appUrl)])
        .then(([siteData, appData]) => {
            if (seq !== _langRequestSeq) return;
            const langData = Object.assign({}, appData, siteData);
            writeLangCache(language, langData);
            document.body.setAttribute('data-lang', language);
            updateInterface(langData, language);
        })
        .catch(err => {
            if (seq !== _langRequestSeq) return;
            console.error('Error loading language files:', err, siteUrl, appUrl);
            // Офлайн-режим: восстанавливаем данные из кеша (язык → en)
            const cache = readLangCache();
            const langData = cache[language] || cache['en'];
            if (langData) {
                console.warn('Offline mode: using cached language data for', language);
                document.body.setAttribute('data-lang', language);
                updateInterface(langData, cache[language] ? language : 'en');
            }
        });
}

// Подписи кнопок идут в innerHTML вместе с иконкой — экранируем, чтобы строка
// перевода никогда не могла внести разметку.
function escapeLabel(v) {
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Функция для обновления интерфейса
function updateInterface(langData, language) {
    // Сохраняем данные языка в глобальной переменной
    window.langData = window.langData || {};
    window.langData[language] = langData;
    // Синхронизируем с translations, чтобы t() из js/i18n.js сразу видел
    // строки только что выбранного языка, а не только тот, что был
    // загружен при старте страницы.
    window.translations = window.translations || {};
    window.translations[language] = langData;
    const changed = window.currentLang !== language;
    window.currentLang = language;
    // Язык в localStorage НЕ пишем: это делает только явный выбор пользователя
    // (LNLang.switchTo). Раньше сюда попадал и автоопределённый язык, и смена
    // языка браузера потом игнорировалась.
    if (window.LNLang) window.LNLang.applyToDocument(language);

    // Обновляем язык куки баннера, если он доступен
    if (window.CookiesBanner && typeof window.CookiesBanner.updateLanguage === 'function') {
        window.CookiesBanner.updateLanguage(language);
    }
    
    
    // Мета-теги теперь статические в HTML - не обновляем динамически

    // Не затираем DOM строкой "undefined", если ключа нет в словаре
    const has = v => typeof v === 'string' && v !== '';

    // Обновление текста в preloader (если элемент существует)
    const preloaderText = document.getElementById('preloaderText');
    if (preloaderText && has(langData.preloaderText)) {
        preloaderText.textContent = langData.preloaderText;
    }
    // Примечание: прелойдер сам управляет своим текстом через updatePreloaderText()

    // Обновление других элементов интерфейса
    const nameApp = document.querySelector('.name-app');
    if (nameApp && has(langData.appName)) {
        nameApp.textContent = langData.appName;
    }

    const addNoteButton = document.getElementById('addNoteButton');
    if (addNoteButton && has(langData.addNoteButton)) {
        addNoteButton.innerHTML = `<i class="bi bi-plus-lg"></i> ${escapeLabel(langData.addNoteButton)}`;
    }

    const importButton = document.getElementById('importButton');
    if (importButton && has(langData.importButton)) {
        importButton.innerHTML = `<i class="bi bi-box-arrow-in-down"></i> ${escapeLabel(langData.importButton)}`;
    }

    const clearAllButton = document.getElementById('clearAllButton');
    if (clearAllButton && has(langData.clearAllButton)) {
        clearAllButton.innerHTML = `<i class="bi bi-trash3"></i> ${escapeLabel(langData.clearAllButton)}`;
    }

    const toggleViewButton = document.getElementById('toggleViewButton');
    if (toggleViewButton && langData.viewModeGrid && langData.viewModeList) {
        const notesContainer = document.getElementById('notesContainer');
        const isFullWidth = notesContainer && notesContainer.classList.contains('full-width-view');
        toggleViewButton.innerHTML = isFullWidth
            ? `<i class="bi bi-grid"></i> ${langData.viewModeGrid}`
            : `<i class="bi bi-list-ul"></i> ${langData.viewModeList}`;
    }

    const toggleTaskBoardButton = document.getElementById('toggleTaskBoardButton');
    if (toggleTaskBoardButton && langData.taskBoardOn) {
        const tbOn = window.taskBoard && window.taskBoard.isActive();
        toggleTaskBoardButton.classList.toggle('active', !!tbOn);
        if (tbOn) {
            toggleTaskBoardButton.innerHTML = `<i class="bi bi-kanban-fill"></i> ${langData.taskBoardOff || langData.taskBoardOn}`;
            toggleTaskBoardButton.title = langData.taskBoardOffTitle || '';
        } else {
            toggleTaskBoardButton.innerHTML = `<i class="bi bi-kanban"></i> ${langData.taskBoardOn}`;
            toggleTaskBoardButton.title = langData.taskBoardOnTitle || '';
        }
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput && has(langData.searchPlaceholder)) {
        searchInput.placeholder = langData.searchPlaceholder;
    }

    const modalH2 = document.querySelector('.modal_h2');
    if (modalH2 && has(langData.editModalTitle)) {
        modalH2.textContent = langData.editModalTitle;
    }

    const saveNoteButton = document.getElementById('saveNoteButton');
    if (saveNoteButton && has(langData.saveNoteButton)) {
        saveNoteButton.innerHTML = `<i class="bi bi-floppy"></i> ${escapeLabel(langData.saveNoteButton)}`;
    }

    const cancelNoteButton = document.getElementById('cancelNoteButton');
    if (cancelNoteButton && has(langData.cancelNoteButton)) {
        cancelNoteButton.innerHTML = `<i class="bi bi-x-lg"></i> ${escapeLabel(langData.cancelNoteButton)}`;
    }

    const footerText = document.querySelector('.info-about-project p');
    if (footerText && has(langData.footerText)) {
        footerText.textContent = langData.footerText;
    }

    const footerCopyRight = document.querySelector('.footerCopyRight');
    if (footerCopyRight && has(langData.footerCopyRight)) {
        footerCopyRight.textContent = langData.footerCopyRight;
    }

    const usagePolicy = document.querySelector('.Usage_Policy');
    if (usagePolicy && has(langData.Usage_Policy)) {
        usagePolicy.textContent = langData.Usage_Policy;
    }

    const privacyPolicy = document.querySelector('.Privacy_Policy');
    if (privacyPolicy && has(langData.Privacy_Policy)) {
        privacyPolicy.textContent = langData.Privacy_Policy;
    }

    const cookiePolicy = document.querySelector('.Cookie_Policy');
    if (cookiePolicy && has(langData.Cookie_Policy)) {
        cookiePolicy.textContent = langData.Cookie_Policy;
    }

    const cookie = document.getElementById('cookie');
    if (cookie && has(langData.cookie)) {
        cookie.textContent = langData.cookie;
    }

    const author = document.querySelector('.author');
    if (author && has(langData.author)) {
        author.textContent = langData.author;
    }

    // Обновляем текст кнопок с иконками (версия из index.js перекрывает запасную ниже)
    (typeof window.updateButtonTexts === 'function' ? window.updateButtonTexts : updateButtonTextsFallback)();
    if (typeof window.applyI18n === 'function') window.applyI18n();

    if (typeof window._updateLockBtn === 'function') {
        window._updateLockBtn();
    }

    // Обновляем метки переключателя сети
    if (typeof window.lnNetworkModeRefreshLabels === 'function') {
        window.lnNetworkModeRefreshLabels();
    }
    
    // Обновляем отображение дат при смене языка
    if (typeof refreshAllDates === 'function' && typeof notesDB !== 'undefined' && notesDB) {
        // Добавляем задержку, чтобы убедиться, что все скрипты загружены и langData обновлен
        setTimeout(() => {
            // Проверяем, что langData обновлен для текущего языка
            if (window.langData && window.langData[language]) {
                refreshAllDates();
            } else {
                // Если langData еще не готов, ждем еще немного
                setTimeout(() => {
                    refreshAllDates();
                }, 200);
            }
        }, 150);
    }

    if (changed) {
        try { window.dispatchEvent(new CustomEvent('ln:languagechange', { detail: { lang: language } })); } catch (e) { /* old browsers */ }
    }
}

// Запасная версия: работает, пока index.js (где живёт основная window.updateButtonTexts) ещё не загружен.
function updateButtonTextsFallback() {
    const addNoteButton = document.getElementById("addNoteButton");
    const importButton = document.getElementById("importButton");
    const clearAllButton = document.getElementById("clearAllButton");
    const toggleViewButton = document.getElementById("toggleViewButton");
    const saveNoteButton = document.getElementById("saveNoteButton");
    const cancelNoteButton = document.getElementById("cancelNoteButton");
    const confirmYesButton = document.getElementById("confirmYes");
    const confirmNoButton = document.getElementById("confirmNo");
    const okButton = document.getElementById("ok");

    // Helper: get text without icon (strip existing <i> tags)
    const txt = el => el.textContent.trim();

    if (addNoteButton) {
        addNoteButton.innerHTML = `<i class="bi bi-plus-lg"></i> ${txt(addNoteButton)}`;
    }
    if (importButton) {
        importButton.innerHTML = `<i class="bi bi-box-arrow-in-down"></i> ${txt(importButton)}`;
    }
    if (clearAllButton) {
        clearAllButton.innerHTML = `<i class="bi bi-trash3"></i> ${txt(clearAllButton)}`;
    }
    const quickEditToggle = document.getElementById("quickEditToggle");
    if (quickEditToggle && !quickEditToggle.classList.contains('active')) {
        quickEditToggle.innerHTML = `<i class="bi bi-lightning-charge"></i> ${txt(quickEditToggle)}`;
    }

    // App Lock button label
    const appLockBtn = document.getElementById("appLockBtn");
    if (appLockBtn) {
        const lang = window.currentLang || 'en';
        const deviceMode = !!(window.AppLock && window.AppLock.mode && window.AppLock.mode() === 'device');
        const lockLabel = deviceMode
            ? (window.langData?.[lang]?.lockProtect || (typeof window.t === 'function' ? window.t('lockProtect') : null) || 'Protect')
            : (window.langData?.[lang]?.appLockBtn
                || (typeof window.t === 'function' ? window.t('appLockBtn') : null)
                || 'Lock');
        const isActive = window.AppLock && window.AppLock.isEnabled();
        appLockBtn.innerHTML = isActive
            ? `<i class="bi bi-shield-lock-fill"></i> ${lockLabel}<i class="bi bi-gear-fill ln-lock-gear-badge" aria-hidden="true"></i>`
            : `<i class="bi ${deviceMode ? 'bi-shield-plus' : 'bi-shield-lock'}"></i> ${lockLabel}`;
        const titleHint = langData.lockNowTitle
            || (typeof window.t === 'function' ? window.t('lockNowTitle') : null);
        const settingsTitle = langData.lockSettingsTitle
            || (typeof window.t === 'function' ? window.t('lockSettingsTitle') : null)
            || 'App Lock';
        appLockBtn.title = isActive ? (titleHint || settingsTitle) : settingsTitle;
    }
    if (toggleViewButton) {
        const lang = window.currentLang || 'en';
        const ld = window.langData?.[lang];
        const notesContainer = document.getElementById("notesContainer");
        const isFullWidth = notesContainer && notesContainer.classList.contains("full-width-view");
        if (ld && ld.viewModeGrid && ld.viewModeList) {
            toggleViewButton.innerHTML = isFullWidth
                ? `<i class="bi bi-grid"></i> ${ld.viewModeGrid}`
                : `<i class="bi bi-list-ul"></i> ${ld.viewModeList}`;
        } else {
            const label = txt(toggleViewButton);
            toggleViewButton.innerHTML = isFullWidth
                ? `<i class="bi bi-grid"></i> ${label}`
                : `<i class="bi bi-list-ul"></i> ${label}`;
        }

        if (window.appUtils && typeof window.appUtils.forceUpdateToggleButton === 'function') {
            setTimeout(() => {
                try { window.appUtils.forceUpdateToggleButton(); } catch (e) {}
            }, 50);
        }
    }

    if (window.taskBoard && typeof window.taskBoard.updateToggleButton === 'function') {
        window.taskBoard.updateToggleButton();
    }

    if (saveNoteButton) {
        saveNoteButton.innerHTML = `<i class="bi bi-floppy"></i> ${txt(saveNoteButton)}`;
    }
    if (cancelNoteButton) {
        cancelNoteButton.innerHTML = `<i class="bi bi-x-lg"></i> ${txt(cancelNoteButton)}`;
    }
    if (confirmYesButton) {
        confirmYesButton.innerHTML = `<i class="bi bi-check-lg"></i> ${txt(confirmYesButton)}`;
    }
    if (confirmNoButton) {
        confirmNoButton.innerHTML = `<i class="bi bi-x-lg"></i> ${txt(confirmNoButton)}`;
    }
    if (okButton) {
        okButton.innerHTML = `<i class="bi bi-check-lg"></i> ${txt(okButton)}`;
    }
}

// Смена языка на месте (без перезагрузки). Выбор пользователя запоминается явно.
window.setAppLanguage = function (code) {
    if (window.LNLang) window.LNLang.setPreferred(code, true);
    changeLanguage(code);
};

// Экспортируем функцию changeLanguage в глобальную область
window.changeLanguage = changeLanguage;

// Инициализация интерфейса после загрузки DOM. Язык уже определён в lang-core.js
// (путь URL → ?lang → явный выбор → браузер), здесь только применяем его.
document.addEventListener('DOMContentLoaded', () => {
    try {
        const lang = window.currentLang || 'en';
        if (window.LNLang) window.LNLang.applyToDocument(lang);
        changeLanguage(lang);
    } catch (error) {
        console.error('Error initializing language:', error);
        window.currentLang = 'en';
        if (window.LNLang) window.LNLang.applyToDocument('en');
    }
});
