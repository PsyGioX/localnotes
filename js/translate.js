// Глобальная переменная для хранения текущего языка
// Инициализируем сразу из localStorage чтобы быть готовыми до рендера нот
window.currentLang = null;

// Синхронное восстановление langData из кеша при старте (для офлайн-режима)
// Это выполняется немедленно, до любого рендера нот
(function restoreLangCacheSync() {
    try {
        // Восстанавливаем currentLang синхронно из localStorage
        const savedLang = localStorage.getItem('preferredLanguage');
        if (savedLang && !window.currentLang) {
            window.currentLang = savedLang;
        }

        const cached = localStorage.getItem('langDataCache');
        if (cached) {
            const data = JSON.parse(cached);
            window.langData = window.langData || {};
            // Заполняем все языки из кеша
            Object.keys(data).forEach(lang => {
                if (!window.langData[lang]) {
                    window.langData[lang] = data[lang];
                }
            });
        }
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
function changeLanguage(language) {
    // Две небольшие языковые выборки вместо одного большого json/lang.json:
    //  - /locales/site/<lang>.json  — тексты статических элементов страницы
    //    (name-app, addNoteButton, footer и т.д.), которые ниже читает
    //    updateInterface()
    //  - /locales/<lang>.json       — полный набор строк приложения,
    //    используемый функцией t() из js/i18n.js
    // Обе — plain flat json, поэтому объединяем их в единый объект и
    // используем его и как langData (для updateInterface), и как
    // window.translations[language] (чтобы t() сразу видел все строки
    // выбранного языка, а не только те 223, что раньше лежали в lang.json).
    const isLanguagePage = window.location.pathname.match(/^\/([a-z]{2})\//);
    const prefix = isLanguagePage ? '..' : '';
    const siteUrl = `${prefix}/locales/site/${language}.json`;
    const appUrl = `${prefix}/locales/${language}.json`;

    Promise.all([
        fetch(siteUrl).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${siteUrl}`); return r.json(); }),
        fetch(appUrl).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${appUrl}`); return r.json(); })
    ])
        .then(([siteData, appData]) => {
            // appData как база, siteData поверх — это те же ключи,
            // которые исторически жили только в lang.json.
            const langData = Object.assign({}, appData, siteData);

            // Кешируем загруженные языки в localStorage для офлайн-режима
            try {
                const cacheRaw = localStorage.getItem('langDataCache');
                const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
                cache[language] = langData;
                localStorage.setItem('langDataCache', JSON.stringify(cache));
            } catch (e) { /* ignore quota errors */ }

            document.body.setAttribute('data-lang', language);
            updateInterface(langData, language);
        })
        .catch(err => {
            console.error("Error loading language files:", err);
            console.error("Attempted to load from:", siteUrl, appUrl);
            // Офлайн-режим: восстанавливаем данные из кеша
            try {
                const cacheRaw = localStorage.getItem('langDataCache');
                const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
                const langData = cache[language] || cache['en'];
                if (langData) {
                    console.warn('Offline mode: using cached language data for', language);
                    document.body.setAttribute('data-lang', language);
                    updateInterface(langData, language);
                }
            } catch (cacheErr) {
                console.error('Failed to restore language from cache:', cacheErr);
            }
        });
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
    window.currentLang = language;

    // Сохраняем язык в localStorage для офлайн-режима
    try { localStorage.setItem('preferredLanguage', language); } catch (e) { /* ignore */ }
    
    // Обновляем язык куки баннера, если он доступен
    if (window.CookiesBanner && typeof window.CookiesBanner.updateLanguage === 'function') {
        window.CookiesBanner.updateLanguage(language);
    }
    
    
    // Мета-теги теперь статические в HTML - не обновляем динамически

    // Обновление текста в preloader (если элемент существует)
    const preloaderText = document.getElementById('preloaderText');
    if (preloaderText) {
        preloaderText.innerHTML = langData.preloaderText;
    }
    // Примечание: прелойдер сам управляет своим текстом через updatePreloaderText()

    // Обновление других элементов интерфейса
    const nameApp = document.querySelector('.name-app');
    if (nameApp) {
        nameApp.textContent = langData.appName;
    }

    const addNoteButton = document.getElementById('addNoteButton');
    if (addNoteButton) {
        addNoteButton.innerHTML = `<i class="bi bi-plus-lg"></i> ${langData.addNoteButton}`;
    }

    const importButton = document.getElementById('importButton');
    if (importButton) {
        importButton.innerHTML = `<i class="bi bi-box-arrow-in-down"></i> ${langData.importButton}`;
    }

    const clearAllButton = document.getElementById('clearAllButton');
    if (clearAllButton) {
        clearAllButton.innerHTML = `<i class="bi bi-trash3"></i> ${langData.clearAllButton}`;
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
    if (searchInput) {
        searchInput.placeholder = langData.searchPlaceholder;
    }

    const modalH2 = document.querySelector('.modal_h2');
    if (modalH2) {
        modalH2.textContent = langData.editModalTitle;
    }

    const saveNoteButton = document.getElementById('saveNoteButton');
    if (saveNoteButton) {
        saveNoteButton.innerHTML = `<i class="bi bi-floppy"></i> ${langData.saveNoteButton}`;
    }

    const cancelNoteButton = document.getElementById('cancelNoteButton');
    if (cancelNoteButton) {
        cancelNoteButton.innerHTML = `<i class="bi bi-x-lg"></i> ${langData.cancelNoteButton}`;
    }

    const footerText = document.querySelector('.info-about-project p');
    if (footerText) {
        footerText.textContent = langData.footerText;
    }

    const footerCopyRight = document.querySelector('.footerCopyRight');
    if (footerCopyRight) {
        footerCopyRight.textContent = langData.footerCopyRight;
    }

    const usagePolicy = document.querySelector('.Usage_Policy');
    if (usagePolicy) {
        usagePolicy.textContent = langData.Usage_Policy;
    }

    const privacyPolicy = document.querySelector('.Privacy_Policy');
    if (privacyPolicy) {
        privacyPolicy.textContent = langData.Privacy_Policy;
    }

    const cookiePolicy = document.querySelector('.Cookie_Policy');
    if (cookiePolicy) {
        cookiePolicy.textContent = langData.Cookie_Policy;
    }

    const cookie = document.getElementById('cookie');
    if (cookie) {
        cookie.textContent = langData.cookie;
    }

    const author = document.querySelector('.author');
    if (author) {
        author.textContent = langData.author;
    }

    // Обновляем текст кнопок с иконками
    updateButtonTexts();

    if (typeof window._updateLockBtn === 'function') {
        window._updateLockBtn();
    }

    // Обновляем метки переключателя сети
    if (typeof window.lnNetworkModeRefreshLabels === 'function') {
        window.lnNetworkModeRefreshLabels();
    }
    
    // Обновляем отображение дат при смене языка
    if (typeof refreshAllDates === 'function' && typeof notesDatabase !== 'undefined' && notesDatabase) {
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
}

// Функция для обновления текста кнопок с иконками
function updateButtonTexts() {
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
        const lockLabel = window.langData?.[lang]?.appLockBtn
            || (typeof window.t === 'function' ? window.t('appLockBtn') : null)
            || 'Lock';
        const isActive = window.AppLock && window.AppLock.isEnabled();
        appLockBtn.innerHTML = isActive
            ? `<i class="bi bi-shield-lock-fill"></i> ${lockLabel}<i class="bi bi-gear-fill ln-lock-gear-badge" aria-hidden="true"></i>`
            : `<i class="bi bi-shield-lock"></i> ${lockLabel}`;
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

// Функция для определения языка браузера пользователя
function getCurrentLanguage() {
    // Проверяем, установлен ли язык в window.currentLang (для языковых версий)
    if (window.currentLang) {
        return window.currentLang;
    }
    
    // Проверяем URL параметр
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    if (langParam) {
        window.currentLang = langParam;
        return langParam;
    }
    
    // Проверяем localStorage
    const savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang) {
        window.currentLang = savedLang;
        return savedLang;
    }
    
    // Определяем язык по браузеру
    const userLang = navigator.language || navigator.userLanguage;
    const langCode = userLang.split('-')[0].toLowerCase();
    
    // Поддерживаемые языки
    const supportedLanguages = ['en', 'ru', 'ua', 'pl', 'cs', 'sk', 'bg', 'hr', 'sr', 'bs', 'mk', 'sl'];
    
    if (supportedLanguages.includes(langCode)) {
        window.currentLang = langCode;
        return langCode;
    }
    
    // Проверяем для специальных случаев
    const countryCode = userLang.split('-')[1]?.toLowerCase();
    if (countryCode) {
        if (countryCode === 'ua') {
            window.currentLang = 'ua';
            return 'ua';
        }
        if (['by', 'kz', 'md'].includes(countryCode)) {
            window.currentLang = 'ru';
            return 'ru';
        }
    }
    
    // По умолчанию английский
    window.currentLang = 'en';
    return 'en';
}

// Функция для периодической проверки языка
function checkAndUpdateLanguage() {
    const currentLang = getCurrentLanguage();
    changeLanguage(currentLang);
}

// Функция для установки атрибута lang в <html>
function setPageLanguage(lang) {
    document.documentElement.setAttribute('lang', lang);
}

// Экспортируем функцию changeLanguage в глобальную область
window.changeLanguage = changeLanguage;

// Запуск проверки языка при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем небольшую задержку для полной загрузки DOM
    setTimeout(() => {
        try {
            // Проверяем, не находимся ли мы на языковой версии страницы
            const currentPath = window.location.pathname;
            const isLanguagePage = currentPath.match(/^\/([a-z]{2})\//);
            
            if (isLanguagePage) {
                // Если мы на языковой странице, устанавливаем язык из URL
                const langFromPath = isLanguagePage[1];
                
                // Проверяем, не установлен ли уже язык в HTML
                if (!window.currentLang) {
                    window.currentLang = langFromPath;
                }
                
                setPageLanguage(window.currentLang);
                // Обновляем интерфейс для языковой версии
                changeLanguage(window.currentLang);
            } else {
                // Если мы на главной странице, используем стандартную логику
                checkAndUpdateLanguage();
                const currentLang = getCurrentLanguage();
                setPageLanguage(currentLang);
            }
        } catch (error) {
            console.error('Error initializing language:', error);
            // Fallback на английский
            window.currentLang = 'en';
            setPageLanguage('en');
        }
    }, 100);
});
