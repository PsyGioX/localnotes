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
// Утилиты для форматирования дат в зависимости от языка
// Система локализации дат для Local Notes

// Форматы дат для разных языков
const dateFormats = {
    en: {
        long: 'MMMM d, yyyy \'at\' HH:mm',
        medium: 'MMM d, yyyy HH:mm',
        short: 'MM/dd/yyyy HH:mm',
        dateOnly: 'MMMM d, yyyy',
        timeOnly: 'HH:mm'
    },
    ru: {
        long: 'd MMMM yyyy \'г. в\' HH:mm',
        medium: 'd MMM yyyy HH:mm',
        short: 'dd.MM.yyyy HH:mm',
        dateOnly: 'd MMMM yyyy г.',
        timeOnly: 'HH:mm'
    },
    ua: {
        long: 'd MMMM yyyy \'р. о\' HH:mm',
        medium: 'd MMM yyyy HH:mm',
        short: 'dd.MM.yyyy HH:mm',
        dateOnly: 'd MMMM yyyy р.',
        timeOnly: 'HH:mm'
    },
    pl: {
        long: 'd MMMM yyyy \'o\' HH:mm',
        medium: 'd MMM yyyy HH:mm',
        short: 'dd.MM.yyyy HH:mm',
        dateOnly: 'd MMMM yyyy',
        timeOnly: 'HH:mm'
    },
    cs: {
        long: 'd. MMMM yyyy \'v\' HH:mm',
        medium: 'd. MMM yyyy HH:mm',
        short: 'dd.MM.yyyy HH:mm',
        dateOnly: 'd. MMMM yyyy',
        timeOnly: 'HH:mm'
    },
    sk: {
        long: 'd. MMMM yyyy \'o\' HH:mm',
        medium: 'd. MMM yyyy HH:mm',
        short: 'dd.MM.yyyy HH:mm',
        dateOnly: 'd. MMMM yyyy',
        timeOnly: 'HH:mm'
    },
    bg: {
        long: 'd MMMM yyyy \'г. в\' HH:mm',
        medium: 'd MMM yyyy HH:mm',
        short: 'dd.MM.yyyy HH:mm',
        dateOnly: 'd MMMM yyyy г.',
        timeOnly: 'HH:mm'
    },
    hr: {
        long: 'd. MMMM yyyy. \'u\' HH:mm',
        medium: 'd. MMM yyyy. HH:mm',
        short: 'dd.MM.yyyy. HH:mm',
        dateOnly: 'd. MMMM yyyy.',
        timeOnly: 'HH:mm'
    },
    sr: {
        long: 'd. MMMM yyyy. \'у\' HH:mm',
        medium: 'd. MMM yyyy. HH:mm',
        short: 'dd.MM.yyyy. HH:mm',
        dateOnly: 'd. MMMM yyyy.',
        timeOnly: 'HH:mm'
    },
    bs: {
        long: 'd. MMMM yyyy. \'u\' HH:mm',
        medium: 'd. MMM yyyy. HH:mm',
        short: 'dd.MM.yyyy. HH:mm',
        dateOnly: 'd. MMMM yyyy.',
        timeOnly: 'HH:mm'
    },
    mk: {
        long: 'd MMMM yyyy \'г. во\' HH:mm',
        medium: 'd MMM yyyy HH:mm',
        short: 'dd.MM.yyyy HH:mm',
        dateOnly: 'd MMMM yyyy г.',
        timeOnly: 'HH:mm'
    },
    sl: {
        long: 'd. MMMM yyyy \'ob\' HH:mm',
        medium: 'd. MMM yyyy HH:mm',
        short: 'dd.MM.yyyy HH:mm',
        dateOnly: 'd. MMMM yyyy',
        timeOnly: 'HH:mm'
    }
};

// Функция для получения текущего языка
function getCurrentLanguage() {
    const currentLang = window.currentLang || 'en';
    // Извлекаем короткий код языка (например, 'ru' из 'ru-RU' или 'en-US')
    return currentLang.split('-')[0];
}

// Функция для получения переводов дат
function getDateTranslations(lang = null) {
    const currentLang = lang || getCurrentLanguage();
    
    // Загружаем переводы из lang.json
    if (window.langData && window.langData[currentLang]) {
        return {
            months: window.langData[currentLang].months || [],
            monthsShort: window.langData[currentLang].monthsShort || [],
            weekdays: window.langData[currentLang].weekdays || [],
            weekdaysShort: window.langData[currentLang].weekdaysShort || []
        };
    }
    
    // Fallback на английский
    return {
        months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    };
}

// Функция для форматирования даты
function formatDate(date, format = 'long', lang = null) {
    if (!date) return '';
    
    const currentLang = lang || getCurrentLanguage();
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) return '';
    
    const translations = getDateTranslations(currentLang);
    const formatTemplate = dateFormats[currentLang]?.[format] || dateFormats['en'][format];
    
    
    if (!formatTemplate) return dateObj.toLocaleString();
    
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const day = dateObj.getDate();
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    
    let formattedDate = formatTemplate
        .replace('yyyy', year)
        .replace('HH:mm', `${hours}:${minutes}`)
        .replace('HH', hours)
        .replace('mm', minutes);
    
    // Заменяем месяцы
    if (formatTemplate.includes('MMMM')) {
        formattedDate = formattedDate.replace('MMMM', translations.months[month] || translations.monthsShort[month]);
    } else if (formatTemplate.includes('MMM')) {
        formattedDate = formattedDate.replace('MMM', translations.monthsShort[month] || translations.months[month]);
    } else if (formatTemplate.includes('MM')) {
        formattedDate = formattedDate.replace('MM', (month + 1).toString().padStart(2, '0'));
    }
    
    // Заменяем дни
    if (formatTemplate.includes('dd')) {
        formattedDate = formattedDate.replace('dd', day.toString().padStart(2, '0'));
    } else if (formatTemplate.includes('d')) {
        formattedDate = formattedDate.replace('d', day);
    }
    
    return formattedDate;
}

// Функция для создания полного перевода даты с временем
function formatFullDate(date, lang = null) {
    const currentLang = lang || getCurrentLanguage();
    const createdText = window.langData?.[currentLang]?.created || 'Created';
    const modifiedText = window.langData?.[currentLang]?.modified || 'Modified';
    
    const formattedDate = formatDate(date, 'long', currentLang);
    
    return {
        created: `${createdText}: ${formattedDate}`,
        modified: `${modifiedText}: ${formattedDate}`
    };
}

// Функция для создания относительного времени (например, "2 часа назад")
function formatRelativeTime(date, lang = null) {
    if (!date) return '';
    
    const currentLang = lang || getCurrentLanguage();
    const now = new Date();
    const dateObj = new Date(date);
    const diffMs = now - dateObj;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    // Переводы для относительного времени
    const relativeTranslations = {
        en: {
            justNow: 'just now',
            minutesAgo: 'minutes ago',
            hoursAgo: 'hours ago',
            daysAgo: 'days ago',
            minuteAgo: 'minute ago',
            hourAgo: 'hour ago',
            dayAgo: 'day ago'
        },
        ru: {
            justNow: 'только что',
            minutesAgo: 'минут назад',
            hoursAgo: 'часов назад',
            daysAgo: 'дней назад',
            minuteAgo: 'минуту назад',
            hourAgo: 'час назад',
            dayAgo: 'день назад'
        },
        ua: {
            justNow: 'щойно',
            minutesAgo: 'хвилин тому',
            hoursAgo: 'годин тому',
            daysAgo: 'днів тому',
            minuteAgo: 'хвилину тому',
            hourAgo: 'годину тому',
            dayAgo: 'день тому'
        },
        pl: {
            justNow: 'właśnie teraz',
            minutesAgo: 'minut temu',
            hoursAgo: 'godzin temu',
            daysAgo: 'dni temu',
            minuteAgo: 'minutę temu',
            hourAgo: 'godzinę temu',
            dayAgo: 'dzień temu'
        },
        cs: {
            justNow: 'právě teď',
            minutesAgo: 'minut zpět',
            hoursAgo: 'hodin zpět',
            daysAgo: 'dní zpět',
            minuteAgo: 'minutu zpět',
            hourAgo: 'hodinu zpět',
            dayAgo: 'den zpět'
        },
        sk: {
            justNow: 'práve teraz',
            minutesAgo: 'minút dozadu',
            hoursAgo: 'hodín dozadu',
            daysAgo: 'dní dozadu',
            minuteAgo: 'minútu dozadu',
            hourAgo: 'hodinu dozadu',
            dayAgo: 'deň dozadu'
        },
        bg: {
            justNow: 'току-що',
            minutesAgo: 'минути преди',
            hoursAgo: 'часа преди',
            daysAgo: 'дни преди',
            minuteAgo: 'минута преди',
            hourAgo: 'час преди',
            dayAgo: 'ден преди'
        },
        hr: {
            justNow: 'upravo sada',
            minutesAgo: 'minuta prije',
            hoursAgo: 'sati prije',
            daysAgo: 'dana prije',
            minuteAgo: 'minutu prije',
            hourAgo: 'sat prije',
            dayAgo: 'dan prije'
        },
        sr: {
            justNow: 'управо сада',
            minutesAgo: 'минута пре',
            hoursAgo: 'сати пре',
            daysAgo: 'дана пре',
            minuteAgo: 'минут пре',
            hourAgo: 'сат пре',
            dayAgo: 'дан пре'
        },
        bs: {
            justNow: 'upravo sada',
            minutesAgo: 'minuta prije',
            hoursAgo: 'sati prije',
            daysAgo: 'dana prije',
            minuteAgo: 'minutu prije',
            hourAgo: 'sat prije',
            dayAgo: 'dan prije'
        },
        mk: {
            justNow: 'само сега',
            minutesAgo: 'минути пред',
            hoursAgo: 'часа пред',
            daysAgo: 'дена пред',
            minuteAgo: 'минута пред',
            hourAgo: 'час пред',
            dayAgo: 'ден пред'
        },
        sl: {
            justNow: 'ravnokar',
            minutesAgo: 'minut nazaj',
            hoursAgo: 'ur nazaj',
            daysAgo: 'dni nazaj',
            minuteAgo: 'minuto nazaj',
            hourAgo: 'uro nazaj',
            dayAgo: 'dan nazaj'
        }
    };
    
    const translations = relativeTranslations[currentLang] || relativeTranslations['en'];
    
    if (diffSeconds < 60) {
        return translations.justNow;
    } else if (diffMinutes < 60) {
        return diffMinutes === 1 ? translations.minuteAgo : `${diffMinutes} ${translations.minutesAgo}`;
    } else if (diffHours < 24) {
        return diffHours === 1 ? translations.hourAgo : `${diffHours} ${translations.hoursAgo}`;
    } else {
        return diffDays === 1 ? translations.dayAgo : `${diffDays} ${translations.daysAgo}`;
    }
}

// Функция для парсинга даты из строки
function parseDate(dateString) {
    if (!dateString) return null;
    
    // Пытаемся распарсить различные форматы
    const formats = [
        /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/, // dd.MM.yyyy HH:mm
        /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/, // MM/dd/yyyy HH:mm
        /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/, // yyyy-MM-dd HH:mm
    ];
    
    for (const format of formats) {
        const match = dateString.match(format);
        if (match) {
            const [, dayOrMonth, monthOrDay, year, hours, minutes] = match;
            // Определяем формат по позиции года
            if (year.length === 4) {
                if (parseInt(dayOrMonth) > 12) {
                    // dd.MM.yyyy формат
                    return new Date(year, monthOrDay - 1, dayOrMonth, hours, minutes);
                } else {
                    // MM/dd/yyyy формат
                    return new Date(year, dayOrMonth - 1, monthOrDay, hours, minutes);
                }
            }
        }
    }
    
    // Fallback на стандартный парсинг
    return new Date(dateString);
}

// Функция для обновления отображения дат в интерфейсе
function updateDateDisplay() {
    const currentLang = getCurrentLanguage();
    
    // Обновляем все элементы с классом 'date-display'
    document.querySelectorAll('.date-display').forEach(element => {
        const dateString = element.getAttribute('data-date');
        const format = element.getAttribute('data-format') || 'long';
        
        if (dateString) {
            const formattedDate = formatDate(dateString, format, currentLang);
            element.textContent = formattedDate;
        }
    });
    
    // Обновляем все элементы с классом 'relative-time'
    document.querySelectorAll('.relative-time').forEach(element => {
        const dateString = element.getAttribute('data-date');
        
        if (dateString) {
            const relativeTime = formatRelativeTime(dateString, currentLang);
            element.textContent = relativeTime;
        }
    });
}

// Функция для принудительного обновления всех дат в интерфейсе
function refreshAllDates() {
    // Обновляем отображение дат
    updateDateDisplay();
    
    // Перезагружаем заметки для обновления дат в футерах заметок
    if (typeof loadNotes === 'function' && typeof notesDatabase !== 'undefined' && notesDatabase) {
        loadNotes().catch(error => {
            console.warn('⚠️ Could not refresh notes:', error);
        });
    }
}

// Функция для тестирования форматирования дат
function testDateFormatting() {
    const testDate = new Date();
    const languages = ['en', 'ru', 'ua', 'pl', 'cs', 'sk', 'bg', 'hr', 'sr', 'bs', 'mk', 'sl'];
    
    languages.forEach(lang => {
        if (window.langData && window.langData[lang]) {
        }
        
        const formatted = formatDate(testDate, 'medium', lang);
    });
}

// Экспортируем функции в глобальную область
window.formatDate = formatDate;
window.formatFullDate = formatFullDate;
window.formatRelativeTime = formatRelativeTime;
window.parseDate = parseDate;
window.getDateTranslations = getDateTranslations;
window.dateFormats = dateFormats;
window.updateDateDisplay = updateDateDisplay;
window.refreshAllDates = refreshAllDates;
window.testDateFormatting = testDateFormatting;
