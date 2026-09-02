// Система переводов для динамического текста
//
// Заменяет старый js/translations.js (объект на 12 языков, ~420 КБ,
// зашитый прямо в JS). Теперь переводы лежат в /locales/<lang>.json
// (см. locales/README.md) и подгружаются только для двух языков:
// текущего (window.currentLang, уже определён в lang-redirect.js) и
// английского как запасного. Это обычно 2 файла по 25-40 КБ вместо
// одного файла на 420 КБ на каждой странице.
//
// Загрузка синхронная (XMLHttpRequest, а не fetch): скрипты в
// script-loader.js выполняются строго по порядку, и весь остальной код
// (index.js и т.д.) обращается к translations/t() сразу после загрузки
// этого файла, без ожидания промиса. Синхронный XHR — единственный
// способ сохранить эту гарантию без переписывания index.js.
if (typeof translations === 'undefined') {

function loadLocaleSync(lang) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/locales/${lang}.json`, false); // false = синхронно
        xhr.send(null);
        if (xhr.status >= 200 && xhr.status < 300) {
            return JSON.parse(xhr.responseText);
        }
    } catch (e) {
        console.error(`Failed to load /locales/${lang}.json`, e);
    }
    return null;
}

const currentLang = window.currentLang || 'en';

const translations = {};
translations['en'] = loadLocaleSync('en') || {};
if (currentLang !== 'en') {
    const data = loadLocaleSync(currentLang);
    if (data) {
        translations[currentLang] = data;
    } else {
        console.warn(`Locale '${currentLang}' failed to load, falling back to 'en'`);
    }
}

// Функция для получения перевода
function t(key, params = {}) {
    const lang = window.currentLang || 'en';
    let translation = translations[lang]?.[key];
    if (translation == null) translation = translations['en']?.[key];
    if (translation == null && window.langData) {
        translation = window.langData[lang]?.[key];
        if (translation == null) translation = window.langData['en']?.[key];
    }

    if (translation == null) return key;

    // Если значение — массив или объект (например months, weekdays), возвращаем как есть
    if (typeof translation !== 'string') return translation;

    // Заменяем параметры в тексте
    return translation.replace(/\{(\w+)\}/g, (match, param) => params[param] || match);
}

// Экспортируем функцию и объект переводов в глобальную область
window.t = t;
window.translations = translations;

// Функция для получения текущего языка
function getCurrentLanguage() {
    return window.currentLang || 'en';
}

// Функция для обновления текста кнопок в HTML
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
    
    if (addNoteButton) {
        addNoteButton.innerHTML = `<i class="bi bi-plus-lg"></i> ${t("addNote")}`;
    }
    if (importButton) {
        importButton.innerHTML = `<i class="bi bi-box-arrow-in-down"></i> ${t("importNotes")}`;
    }
    if (clearAllButton) {
        clearAllButton.innerHTML = `<i class="bi bi-trash3"></i> ${t("clearAllNotes")}`;
    }
    const quickEditToggle = document.getElementById("quickEditToggle");
    if (quickEditToggle && !quickEditToggle.classList.contains('active')) {
        quickEditToggle.innerHTML = `<i class="bi bi-lightning-charge"></i> ${t("quickEditOn") || 'Quick Edit'}`;
    }
    if (window.taskBoard && typeof window.taskBoard.updateToggleButton === "function") {
        window.taskBoard.updateToggleButton();
    }
    if (toggleViewButton) {
        // Обновляем кнопку переключения вида с правильными переводами
        const notesContainer = document.getElementById("notesContainer");
        const isFullWidth = notesContainer && notesContainer.classList.contains("full-width-view");
        
        if (isFullWidth) {
            toggleViewButton.innerHTML = `<i class="bi bi-grid"></i> ${t("viewModeGrid")}`;
        } else {
            toggleViewButton.innerHTML = `<i class="bi bi-list-ul"></i> ${t("viewModeList")}`;
        }
        
        // Принудительно обновляем кнопку через AppUtils, если он доступен
        if (window.appUtils && typeof window.appUtils.forceUpdateToggleButton === 'function') {
            // Добавляем небольшую задержку, чтобы избежать ошибок
            setTimeout(() => {
                try {
                    window.appUtils.forceUpdateToggleButton();
                } catch (error) {
                }
            }, 50);
        }
    }
    if (saveNoteButton) {
        saveNoteButton.innerHTML = `<i class="bi bi-floppy"></i> ${t("saveNote")}`;
    }
    if (cancelNoteButton) {
        cancelNoteButton.innerHTML = `<i class="bi bi-x-lg"></i> ${t("cancel")}`;
    }
    if (confirmYesButton) {
        confirmYesButton.innerHTML = `<i class="bi bi-check-lg"></i> ${t("confirmYes")}`;
    }
    if (confirmNoButton) {
        confirmNoButton.innerHTML = `<i class="bi bi-x-lg"></i> ${t("confirmNo")}`;
    }
    if (okButton) {
        okButton.innerHTML = `<i class="bi bi-check-lg"></i> ${t("ok")}`;
    }

    // Calendar button
    const calendarBtn = document.getElementById("calendarBtn");
    if (calendarBtn) {
        calendarBtn.innerHTML = `<i class="bi bi-calendar3"></i> ${t("calendar")}`;
    }
}
} // Закрываем блок if (typeof translations === 'undefined')
