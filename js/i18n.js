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
// Система переводов для динамического текста
//
// Переводы лежат в /locales/<lang>.json (см. locales/README.md) и
// подгружаются только для двух языков: текущего (window.currentLang,
// определяется в js/lang-core.js) и английского как запасного.
//
// Загрузка синхронная (XMLHttpRequest, а не fetch): скрипты в
// script-loader.js выполняются строго по порядку, и весь остальной код
// (index.js и т.д.) обращается к translations/t() сразу после загрузки
// этого файла, без ожидания промиса.
//
// Что умеет (помимо t(key, params)):
//   t.has(key)                 — есть ли ключ в текущем языке или в en
//   tn(key, n, params)         — плюрализация через Intl.PluralRules:
//                                key_one / key_two / key_few / key_many / key_other
//                                ({n} подставляется автоматически)
//   applyI18n(root)            — data-i18n / data-i18n-title / -placeholder / -aria-label
//   i18n.formatNumber/Date/List/RelativeTime — Intl с правильной локалью
//   window.__missingI18n       — Set ключей, которых не нашлось ни в языке, ни в en
//                                (в консоль пишет только при ?i18n-debug)
(function () {
    'use strict';
    if (window.i18n) return; // уже инициализирован

    var DEBUG = /[?&]i18n-debug\b/.test(window.location.search);
    var norm = function (c) { return (window.LNLang && window.LNLang.normalize(c)) || c || 'en'; };

    function loadLocaleSync(lang) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', '/locales/' + lang + '.json', false); // false = синхронно
            xhr.send(null);
            if (xhr.status >= 200 && xhr.status < 300) return JSON.parse(xhr.responseText);
            console.warn('[i18n] /locales/' + lang + '.json → HTTP ' + xhr.status);
        } catch (e) {
            console.error('[i18n] Failed to load /locales/' + lang + '.json', e);
        }
        return null;
    }

    var startLang = norm(window.currentLang || 'en');
    // translate.js может успеть положить сюда уже загруженный язык — не затираем
    var translations = window.translations || {};
    if (!translations.en) translations.en = loadLocaleSync('en') || {};
    if (startLang !== 'en' && !translations[startLang]) {
        var data = loadLocaleSync(startLang);
        if (data) translations[startLang] = data;
        else console.warn("[i18n] Locale '" + startLang + "' failed to load, falling back to 'en'");
    }

    var missing = window.__missingI18n = window.__missingI18n || new Set();

    function lookup(key, lang) {
        var v = translations[lang] && translations[lang][key];
        if (v == null && lang !== 'en') v = translations.en && translations.en[key];
        if (v == null && window.langData) {
            v = window.langData[lang] && window.langData[lang][key];
            if (v == null) v = window.langData.en && window.langData.en[key];
        }
        return v;
    }

    function interpolate(str, params) {
        if (!params) return str;
        // `!= null`, а не `||`: t('x', {n: 0}) должен дать "0", а не оставить "{n}"
        return str.replace(/\{(\w+)\}/g, function (m, p) { return params[p] != null ? params[p] : m; });
    }

    // Функция для получения перевода
    function t(key, params) {
        var lang = norm(window.currentLang || 'en');
        var v = lookup(key, lang);
        if (v == null) {
            if (!missing.has(key)) {
                missing.add(key);
                if (DEBUG) console.warn('[i18n] missing key "' + key + '" (' + lang + ')');
            }
            return key;
        }
        // Массивы/объекты (months, weekdays) возвращаем как есть
        if (typeof v !== 'string') return v;
        return interpolate(v, params);
    }
    t.has = function (key) { return lookup(key, norm(window.currentLang || 'en')) != null; };

    var pluralCache = {};
    function pluralRules(lang) {
        var h = (window.LNLang ? window.LNLang.htmlLang(lang) : lang) || 'en';
        try { return pluralCache[h] || (pluralCache[h] = new Intl.PluralRules(h)); }
        catch (e) { return null; }
    }
    // tn('rvComments', 3) → "3 комментария" (ключи rvComments_one/_few/_many/_other)
    function tn(key, n, params) {
        var lang = norm(window.currentLang || 'en');
        var pr = pluralRules(lang);
        var cat = pr ? pr.select(Number(n)) : (Number(n) === 1 ? 'one' : 'other');
        var p = Object.assign({ n: n }, params || {});
        var k = key + '_' + cat;
        if (lookup(k, lang) == null) k = key + '_other';
        if (lookup(k, lang) == null) k = key;
        return t(k, p);
    }

    function htmlLang() { return window.LNLang ? window.LNLang.htmlLang(window.currentLang) : (window.currentLang || 'en'); }
    var i18n = {
        t: t, tn: tn,
        lang: function () { return norm(window.currentLang || 'en'); },
        formatNumber: function (n, o) { try { return new Intl.NumberFormat(htmlLang(), o).format(n); } catch (e) { return String(n); } },
        formatDate: function (d, o) { try { return new Intl.DateTimeFormat(htmlLang(), o || { dateStyle: 'medium' }).format(d instanceof Date ? d : new Date(d)); } catch (e) { return String(d); } },
        formatList: function (a, o) { try { return new Intl.ListFormat(htmlLang(), o || { style: 'long', type: 'conjunction' }).format(a); } catch (e) { return a.join(', '); } },
        formatRelative: function (v, unit, o) { try { return new Intl.RelativeTimeFormat(htmlLang(), o || { numeric: 'auto' }).format(v, unit); } catch (e) { return v + ' ' + unit; } }
    };

    // Декларативные переводы: <span data-i18n="key">, data-i18n-title / -placeholder / -aria-label
    var ATTRS = [['data-i18n-title', 'title'], ['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria-label', 'aria-label']];
    function applyI18n(root) {
        root = root || document;
        if (!root.querySelectorAll) return;
        root.querySelectorAll('[data-i18n]').forEach(function (el) {
            var v = t(el.getAttribute('data-i18n')); if (typeof v === 'string' && v !== el.getAttribute('data-i18n')) el.textContent = v;
        });
        ATTRS.forEach(function (pair) {
            root.querySelectorAll('[' + pair[0] + ']').forEach(function (el) {
                var k = el.getAttribute(pair[0]), v = t(k);
                if (typeof v === 'string' && v !== k) el.setAttribute(pair[1], v);
            });
        });
    }

    // Экспортируем в глобальную область (обратная совместимость: window.t, window.translations)
    window.t = t;
    window.tn = tn;
    window.i18n = i18n;
    window.applyI18n = applyI18n;
    window.translations = translations;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { applyI18n(); });
    else applyI18n();
})();
