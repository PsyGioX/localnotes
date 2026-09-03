// Общие утилиты для приложения

// DOMPurify's config for note content adds <iframe> to the allow-list (for
// the built-in YouTube/Vimeo/etc. embed feature and the "custom iframe"
// paste box) with a free-form src/allow — sanitization alone doesn't limit
// *which* site an iframe can point to. Without this, a note imported from a
// file or received via share-to-app could carry an iframe pointed at any
// https URL, rendered live the moment the note opens (phishing/clickjacking,
// or delegated permissions via `allow`). Call this on the container right
// after DOMPurify.sanitize() wherever note HTML with iframes is rendered.
window.restrictIframeEmbeds = function restrictIframeEmbeds(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return;
    var ALLOWED_HOSTS = [
        'www.youtube.com', 'youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com',
        'rutube.ru', 'www.rutube.ru',
        'vk.com', 'www.vk.com', 'vk.ru', 'www.vk.ru', 'vkvideo.ru', 'www.vkvideo.ru', 'live.vkvideo.ru',
        'ok.ru', 'www.ok.ru',
        'www.tiktok.com', 'tiktok.com',
        'player.vimeo.com',
        'www.dailymotion.com', 'dailymotion.com',
        'player.twitch.tv', 'clips.twitch.tv'
    ];
    // Only permission tokens the app's own embed generator ever emits —
    // deliberately excludes camera/microphone/geolocation/clipboard-read/
    // midi/usb/serial/bluetooth/payment/display-capture etc.
    var ALLOWED_PERMISSIONS = ['autoplay', 'encrypted-media', 'fullscreen', 'picture-in-picture', 'accelerometer', 'clipboard-write', 'gyroscope'];

    container.querySelectorAll('iframe').forEach(function (f) {
        var raw = f.getAttribute('src') || f.getAttribute('data-src') || '';
        var ok = false;
        if (raw) {
            try {
                var u = new URL(raw, window.location.href);
                ok = u.protocol === 'https:' && ALLOWED_HOSTS.indexOf(u.hostname.toLowerCase()) !== -1;
            } catch (e) { ok = false; }
        }
        if (!ok) { f.remove(); return; }
        var allow = f.getAttribute('allow');
        if (allow) {
            var kept = allow.split(';').map(function (s) { return s.trim().split(' ')[0]; })
                .filter(function (tok) { return ALLOWED_PERMISSIONS.indexOf(tok) !== -1; });
            if (kept.length) f.setAttribute('allow', kept.join('; ')); else f.removeAttribute('allow');
        }
    });
};

class AppUtils {
    constructor() {
        this.currentLang = this.getCurrentLanguage();
    }
    
    // Получение текущего языка
    getCurrentLanguage() {
        if (window.currentLang) {
            return window.currentLang;
        }
        
        const path = window.location.pathname;
        const langMatch = path.match(/\/([a-z]{2})\//);
        return langMatch ? langMatch[1] : 'en';
    }
    
    // Установка года в футере
    setCurrentYear() {
        const yearSpan = document.getElementById("currentYear");
        if (yearSpan) {
            const currentYear = new Date().getFullYear();
            yearSpan.textContent = currentYear;
        }
    }
    
    // Обновление текста кнопки переключения вида
    updateToggleViewButton() {
        const btn = document.getElementById("toggleViewButton");
        if (!btn) return;
        
        const notesContainer = document.getElementById("notesContainer");
        const isFullWidth = notesContainer && notesContainer.classList.contains("full-width-view");
        
        // Получаем переводы из глобального объекта translations
        const currentLang = this.getCurrentLanguage();
        let langTranslations = null;
        
        // Пытаемся получить переводы из разных источников
        try {
            if (typeof window.translations !== 'undefined' && window.translations && window.translations[currentLang]) {
                langTranslations = window.translations[currentLang];
            }
        } catch (error) {
            langTranslations = null;
        }
        
        // Пробуем использовать функцию t() напрямую
        if (typeof window.t === 'function') {
            try {
                if (isFullWidth) {
                    btn.innerHTML = `<i class="bi bi-grid"></i> ${window.t('viewModeGrid')}`;
                } else {
                    btn.innerHTML = `<i class="bi bi-list-ul"></i> ${window.t('viewModeList')}`;
                }
            } catch (error) {
                this.useFallbackText(btn, isFullWidth, currentLang);
            }
        } else if (langTranslations && langTranslations.viewModeGrid && langTranslations.viewModeList) {
            if (isFullWidth) {
                btn.innerHTML = `<i class="bi bi-grid"></i> ${langTranslations.viewModeGrid}`;
            } else {
                btn.innerHTML = `<i class="bi bi-list-ul"></i> ${langTranslations.viewModeList}`;
            }
        } else {
            this.useFallbackText(btn, isFullWidth, currentLang);
        }
        
    }
    
    // Fallback метод для установки текста кнопки
    useFallbackText(btn, isFullWidth, currentLang) {
        const _t = (key, fb) => (window.t ? window.t(key) : fb);
        if (isFullWidth) {
            btn.innerHTML = `<i class="bi bi-grid"></i> ${_t('viewModeGrid', 'Grid')}`;
        } else {
            btn.innerHTML = `<i class="bi bi-list-ul"></i> ${_t('viewModeList', 'List')}`;
        }
    }
    
    // Переключение вида заметок
    toggleNotesView() {
        const notesContainer = document.getElementById("notesContainer");
        if (!notesContainer) return;
        
        const isFullWidth = notesContainer.classList.contains("full-width-view");
        
        // Мгновенное переключение классов
        if (isFullWidth) {
            // Переключаемся с полной ширины на сетку
            notesContainer.classList.remove("full-width-view");
            notesContainer.classList.add("default-view");
        } else {
            // Переключаемся с сетки на полную ширину
            notesContainer.classList.remove("default-view");
            notesContainer.classList.add("full-width-view");
        }
        
        // Обновляем текст кнопки сразу после переключения
        this.updateToggleViewButton();
    }
    
    // Инициализация обработчиков событий
    initEventListeners() {
        // Обработчик для кнопки переключения вида
        const toggleBtn = document.getElementById("toggleViewButton");
        if (toggleBtn) {
            toggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleNotesView();
            });
        }
    }
    
    // Принудительное обновление кнопки (для вызова после загрузки переводов)
    forceUpdateToggleButton() {
        this.updateToggleViewButton();
    }
    
    // Инициализация при загрузке страницы
    init() {
        this.setCurrentYear();
        this.updateToggleViewButton();
        this.initEventListeners();
        
        // Обновляем кнопку через небольшую задержку, чтобы переводы успели загрузиться
        setTimeout(() => {
            this.updateToggleViewButton();
        }, 100);
        
        // Дополнительное обновление через больший интервал для надежности
        setTimeout(() => {
            this.updateToggleViewButton();
        }, 500);
        
    }
}

// Инициализация при загрузке DOM
document.addEventListener("DOMContentLoaded", function() {
    window.appUtils = new AppUtils();
    window.appUtils.init();
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppUtils;
}


