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
// Управление селекторами языка и темы в футере
class FooterSelectors {
    constructor() {
        // Список языков — из LNLang (единый источник правды), без копии здесь.
        this.languages = (window.LNLang && window.LNLang.META) || { en: { name: 'English', flag: '🇺🇸' } };

        this.themes = {
            'light': { name: 'Light', icon: '☀️' },
            'dark': { name: 'Dark', icon: '🌙' },
            'auto': { name: 'Auto', icon: '🔄' }
        };
        
        this.init();
    }
    
    init() {
        this.createLanguageSelector();
        this.createThemeSelector();
        this.setupEventListeners();
    }
    
    // Создание селектора языка
    createLanguageSelector() {
        const currentLang = this.getCurrentLanguage();
        const selector = document.createElement('div');
        selector.className = 'footer-selector language-selector';
        selector.innerHTML = `
            <select id="languageSelect" title="Select Language" aria-label="Select Language">
                ${Object.entries(this.languages).map(([code, lang]) => 
                    `<option value="${code}" ${code === currentLang ? 'selected' : ''}>
                        ${lang.flag} ${lang.name}
                    </option>`
                ).join('')}
            </select>
        `;
        
        // Добавляем в футер
        const footerContent = document.querySelector('.footer-content');
        if (footerContent) {
            footerContent.appendChild(selector);
        }
    }
    
    // Создание селектора темы
    createThemeSelector() {
        const currentTheme = this.getCurrentTheme();
        const selector = document.createElement('div');
        selector.className = 'footer-selector theme-selector';
        selector.innerHTML = `
            <select id="themeSelect" title="Select Theme">
                ${Object.entries(this.themes).map(([code, theme]) => 
                    `<option value="${code}" ${code === currentTheme ? 'selected' : ''}>
                        ${theme.icon} ${theme.name}
                    </option>`
                ).join('')}
            </select>
        `;
        
        // Добавляем в футер
        const footerContent = document.querySelector('.footer-content');
        if (footerContent) {
            footerContent.appendChild(selector);
        }
    }
    
    // Настройка обработчиков событий
    setupEventListeners() {
        // Селектор языка
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                const selectedLang = e.target.value;
                this.changeLanguage(selectedLang);
            });
        }
        
        // Селектор темы
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.changeTheme(e.target.value);
            });
        }
    }
    
    // Получение текущего языка (путь /ua/ → код приложения 'ua'; корень → 'en')
    getCurrentLanguage() {
        return (window.LNLang && window.LNLang.fromPath()) || 'en';
    }

    // Получение текущей темы
    getCurrentTheme() {
        return localStorage.getItem('theme') || 'auto';
    }
    
    // Смена языка: явный выбор запоминается; страница меняется на /xx/<та же страница>
    // с сохранением query/hash (раньше всегда вело на главную языка и теряло #shared=…).
    changeLanguage(langCode) {
        if (window.LNLang) window.LNLang.switchTo(langCode);
        else window.location.href = langCode === 'en' ? '/' : `/${langCode}/`;
    }

    // Смена темы
    changeTheme(themeCode) {
        if (window.themeManager) {
            window.themeManager.applyTheme(themeCode);
        } else {
            // Fallback если themeManager не доступен
            localStorage.setItem('theme', themeCode);
            document.documentElement.setAttribute('data-theme', themeCode);
        }
    }
    
    // Обновление селекторов (для динамического обновления)
    updateSelectors() {
        const currentLang = this.getCurrentLanguage();
        const currentTheme = this.getCurrentTheme();
        
        const languageSelect = document.getElementById('languageSelect');
        const themeSelect = document.getElementById('themeSelect');
        
        if (languageSelect) {
            languageSelect.value = currentLang;
        }
        
        if (themeSelect) {
            themeSelect.value = currentTheme;
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    window.footerSelectors = new FooterSelectors();
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FooterSelectors;
}
