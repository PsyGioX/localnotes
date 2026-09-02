// Система управления темами
if (typeof ThemeManager === 'undefined') {
class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
        this.init();
    }

    // Инициализация системы тем
    init() {
        this.applyTheme(this.currentTheme);
        // this.createThemeToggle(); // Убираем фиксированную кнопку смены темы
        this.createThemeModal();
        this.setupEventListeners();
    }

    // Получение сохраненной темы
    getStoredTheme() {
        return localStorage.getItem('theme');
    }

    // Получение системной темы
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    // Применение темы
    applyTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        
        // Для автоматической темы определяем актуальную тему
        let actualTheme = theme;
        if (theme === 'auto') {
            actualTheme = this.getSystemTheme();
        }
        
        document.documentElement.setAttribute('data-theme', actualTheme);
        
        // Обновление иконки переключателя
        this.updateThemeIcon();
        
        // Обновление активной опции в модальном окне
        this.updateActiveThemeOption();
        
        // Обновление стилей TinyMCE
        setTimeout(() => {
            if (typeof applyThemeToTinyMCE === 'function') {
                applyThemeToTinyMCE();
            }
        if (typeof forceUpdateSplitButtonStyles === 'function') {
            forceUpdateSplitButtonStyles(theme);
        }
        
        // Добавляем обработчики кликов для split button
        if (typeof addSplitButtonClickHandlers === 'function') {
            addSplitButtonClickHandlers();
        }
            if (typeof adjustEditorHeight === 'function') {
                adjustEditorHeight();
            }
        }, 100);
        
        // Обновление темы TinyMCE редактора
        if (typeof updateTinyMCETheme === 'function') {
            setTimeout(() => {
                updateTinyMCETheme();
            }, 100);
        }
    }

    // Создание кнопки переключения тем
    createThemeToggle() {
        // Проверяем, не существует ли уже кнопка
        if (document.getElementById('themeToggle')) {
            return;
        }
        
        const toggle = document.createElement('button');
        toggle.className = 'theme-toggle';
        toggle.id = 'themeToggle';
        toggle.innerHTML = '<span class="theme-icon">🌙</span>';
        const _t = (key, fb) => (window.t ? window.t(key) : fb);
        toggle.title = _t('cpToggleTheme', 'Toggle theme');
        
        document.body.appendChild(toggle);
    }

    // Создание модального окна выбора темы
    createThemeModal() {
        const modal = document.createElement('div');
        modal.className = 'theme-modal';
        modal.id = 'themeModal';
        
        modal.innerHTML = `
            <div class="theme-modal-content">
                <h3 style="margin-bottom: 20px; color: var(--text-color);">Выберите тему</h3>
                <div class="theme-option" data-theme="light">
                    <div>
                        <div class="theme-name">Светлая</div>
                        <div class="theme-description">Классическая светлая тема</div>
                    </div>
                    <span class="theme-icon">☀️</span>
                </div>
                <div class="theme-option" data-theme="dark">
                    <div>
                        <div class="theme-name">Темная</div>
                        <div class="theme-description">Современная темная тема</div>
                    </div>
                    <span class="theme-icon">🌙</span>
                </div>
                <div class="theme-option" data-theme="auto">
                    <div>
                        <div class="theme-name">Авто</div>
                        <div class="theme-description">Следует системным настройкам</div>
                    </div>
                    <span class="theme-icon">🔄</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Клик по кнопке переключения (если она существует)
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.showThemeModal();
            });
        }

        // Клик по опциям темы
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                this.applyTheme(theme);
                this.hideThemeModal();
            });
        });

        // Клик вне модального окна для закрытия с поддержкой Pointer Events
        document.getElementById('themeModal').addEventListener('pointerdown', (e) => {
            if (e.target.id === 'themeModal') {
                this.hideThemeModal();
            }
        });
        
        // Fallback для старых браузеров
        document.getElementById('themeModal').addEventListener('click', (e) => {
            if (e.target.id === 'themeModal') {
                this.hideThemeModal();
            }
        });

        // Отслеживание изменений системной темы
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            mediaQuery.addEventListener('change', (e) => {
                if (this.currentTheme === 'auto') {
                    // Принудительно обновляем тему при изменении системных настроек
                    const actualTheme = this.getSystemTheme();
                    document.documentElement.setAttribute('data-theme', actualTheme);
                }
            });
        }

        // Обработка клавиши Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideThemeModal();
            }
        });
    }

    // Показать модальное окно выбора темы
    showThemeModal() {
        const modal = document.getElementById('themeModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    // Скрыть модальное окно выбора темы
    hideThemeModal() {
        const modal = document.getElementById('themeModal');
        if (modal) {
            modal.style.display = 'none';
            // Clear the inline override rather than hardcoding 'auto' —
            // hardcoding it here made body.style.overflow a permanent
            // inline 'auto' on both axes after the first open/close,
            // which desyncs position:sticky elements from real scrolling
            // for the rest of the session. Clearing it restores whatever
            // the stylesheet actually specifies.
            document.body.style.overflow = '';
        }
    }

    // Обновление иконки переключателя
    updateThemeIcon() {
        const icon = document.querySelector('#themeToggle .theme-icon');
        if (!icon) return;

        switch (this.currentTheme) {
            case 'light':
                icon.textContent = '☀️';
                break;
            case 'dark':
                icon.textContent = '🌙';
                break;
            case 'auto':
                icon.textContent = '🔄';
                break;
        }
    }

    // Обновление активной опции в модальном окне
    updateActiveThemeOption() {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === this.currentTheme) {
                option.classList.add('active');
            }
        });
    }

    // Переключение на следующую тему
    toggleTheme() {
        const themes = ['light', 'dark', 'auto'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.applyTheme(themes[nextIndex]);
    }

    // Получение текущей темы
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Проверка, является ли тема темной
    isDarkTheme() {
        if (this.currentTheme === 'dark') return true;
        if (this.currentTheme === 'light') return false;
        if (this.currentTheme === 'auto') {
            return !window.matchMedia('(prefers-color-scheme: light)').matches;
        }
        return true; // по умолчанию темная
    }

    // Проверка, является ли тема светлой
    isLightTheme() {
        if (this.currentTheme === 'light') return true;
        if (this.currentTheme === 'dark') return false;
        if (this.currentTheme === 'auto') {
            return window.matchMedia('(prefers-color-scheme: light)').matches;
        }
        return false; // по умолчанию не светлая
    }
}

// Инициализация системы тем при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    if (!window.themeManager) {
        window.themeManager = new ThemeManager();
    }
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
} // Закрываем блок if (typeof ThemeManager === 'undefined')
