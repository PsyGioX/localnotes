/*
 * Local Notes — a local-first, privacy-focused notes app (PWA): rich-text/Markdown editor,
 * AES-256-GCM encrypted storage in the browser, offline mode, 12 languages. No server-side data.
 * Local Notes — локальное приватное приложение для заметок (PWA): редактор rich-text/Markdown,
 * шифрование AES-256-GCM в браузере, офлайн-режим, 12 языков. Данные не уходят на сервер.
 *
 * Copyright (c) 2026 PsyGioX. Licensed under the MIT License.
 * Source: https://github.com/PsyGioX/localnotes — Site: https://localnotes-three.vercel.app
 */
/**
 * LNLang — единственный источник правды об языке интерфейса.
 *
 * Раньше определение языка было размазано по 6 файлам (lang-redirect.js,
 * translate.js, selectors.js, preloader.js, cookies-banner.js, landing.js) и
 * каждый делал это по-своему. Из-за этого были реальные ошибки:
 *   • браузерный код "uk" сохранялся как preferredLanguage, но файла
 *     locales/uk.json нет (приложение называет язык "ua") → у украинцев
 *     интерфейс молча откатывался на английский;
 *   • явный выбор English стирался при следующем заходе на "/";
 *   • на странице /ru/ сохранённый в localStorage язык перебивал путь URL;
 *   • часовой пояс "Europe/Kyiv" не распознавался (только устаревший "Kiev");
 *   • порядок navigator.languages не учитывался (en-US, ru → всегда ru);
 *   • редирект происходил после DOMContentLoaded — мелькала английская страница.
 *
 * Порядок определения (первое совпадение выигрывает):
 *   1. префикс в URL  /ru/…           (только на языковых страницах)
 *   2. параметр ?lang=xx              (одноразовый, не сохраняется)
 *   3. явный выбор пользователя       (localStorage: preferredLanguage + languageChosen=1)
 *   4. navigator.languages по порядку (с алиасами uk→ua, be/kk→ru, sh→hr …)
 *   5. Intl locale / часовой пояс     (только если браузер не дал ни одного языка)
 *   6. en
 *
 * Автоопределённый язык больше НЕ записывается в localStorage — иначе смена
 * языка системы/браузера никогда бы не подхватывалась.
 */
(function (w) {
    'use strict';
    if (w.LNLang) return;

    // code — это код приложения (имя файла в /locales и папки сайта).
    // html — BCP-47 для <html lang> и hreflang (у украинского это "uk", а не "ua").
    var META = {
        en: { name: 'English',    flag: '🇺🇸', html: 'en', dir: 'ltr' },
        ru: { name: 'Русский',    flag: '🇷🇺', html: 'ru', dir: 'ltr' },
        ua: { name: 'Українська', flag: '🇺🇦', html: 'uk', dir: 'ltr' },
        pl: { name: 'Polski',     flag: '🇵🇱', html: 'pl', dir: 'ltr' },
        cs: { name: 'Čeština',    flag: '🇨🇿', html: 'cs', dir: 'ltr' },
        sk: { name: 'Slovenčina', flag: '🇸🇰', html: 'sk', dir: 'ltr' },
        bg: { name: 'Български',  flag: '🇧🇬', html: 'bg', dir: 'ltr' },
        hr: { name: 'Hrvatski',   flag: '🇭🇷', html: 'hr', dir: 'ltr' },
        sr: { name: 'Српски',     flag: '🇷🇸', html: 'sr', dir: 'ltr' },
        bs: { name: 'Bosanski',   flag: '🇧🇦', html: 'bs', dir: 'ltr' },
        mk: { name: 'Македонски', flag: '🇲🇰', html: 'mk', dir: 'ltr' },
        sl: { name: 'Slovenščina', flag: '🇸🇮', html: 'sl', dir: 'ltr' }
    };
    var SUPPORTED = Object.keys(META);

    // Основной подтег языка → код приложения.
    var LANG_ALIAS = {
        uk: 'ua', ua: 'ua',
        be: 'ru', kk: 'ru', ky: 'ru', tt: 'ru', ba: 'ru', cv: 'ru',   // близкие/региональные языки РФ и СНГ
        sh: 'hr', 'sr-latn': 'sr', cnr: 'sr',                           // сербохорватский, черногорский
        cz: 'cs', gr: 'en'                                              // частые ошибочные коды
    };
    // Регион → язык, только когда язык браузера не поддерживается и не английский (напр. "tt-RU").
    var REGION_FALLBACK = { ua: 'ua', ru: 'ru', by: 'ru', kz: 'ru', kg: 'ru', md: 'ru' };

    var TZ_FALLBACK = [
        [/Kyiv|Kiev|Uzhgorod|Zaporozhye/i, 'ua'],
        [/Moscow|Kaliningrad|Samara|Volgograd|Saratov|Ulyanovsk|Astrakhan|Kirov|Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Vladivostok|Magadan|Sakhalin|Kamchatka|Minsk/i, 'ru'],
        [/Warsaw/i, 'pl'], [/Prague/i, 'cs'], [/Bratislava/i, 'sk'], [/Sofia/i, 'bg'],
        [/Zagreb/i, 'hr'], [/Belgrade/i, 'sr'], [/Sarajevo/i, 'bs'], [/Skopje/i, 'mk'], [/Ljubljana/i, 'sl']
    ];

    var KEY_PREF = 'preferredLanguage';
    var KEY_CHOSEN = 'languageChosen';

    function store(op, k, v) {
        try {
            if (op === 'get') return w.localStorage.getItem(k);
            if (op === 'set') w.localStorage.setItem(k, v);
            if (op === 'del') w.localStorage.removeItem(k);
        } catch (e) { /* private mode / blocked storage */ }
        return null;
    }

    /** "uk-UA" | "uk" | "UA" | "sr_Latn_RS" → код приложения или null. */
    function normalize(tag) {
        if (!tag || typeof tag !== 'string') return null;
        var s = tag.trim().toLowerCase().replace(/_/g, '-');
        if (!s) return null;
        if (META[s]) return s;
        if (LANG_ALIAS[s]) return LANG_ALIAS[s];
        var parts = s.split('-');
        if (parts.length > 1 && LANG_ALIAS[parts[0] + '-' + parts[1]]) return LANG_ALIAS[parts[0] + '-' + parts[1]];
        var primary = parts[0];
        if (META[primary]) return primary;
        if (LANG_ALIAS[primary]) return LANG_ALIAS[primary];
        return null;
    }

    /** Язык из пути: /ru/…, /landing/ua/… → 'ru' / 'ua'. Только поддерживаемые коды. */
    function fromPath(pathname) {
        var m = (pathname || w.location.pathname).match(/^\/(?:landing\/)?([a-z]{2})(?:\/|$)/i);
        if (!m) return null;
        var c = m[1].toLowerCase();
        return META[c] ? c : null;
    }

    function fromQuery() {
        try {
            var v = new URLSearchParams(w.location.search).get('lang');
            return normalize(v);
        } catch (e) { return null; }
    }

    /** Явный выбор пользователя (а не автоопределённый). */
    function getChosen() {
        var saved = normalize(store('get', KEY_PREF));
        if (!saved) return null;
        // Миграция: старые версии писали сюда автоопределённый язык без флага.
        // Если флага нет — считаем значение устаревшим автосохранением и игнорируем.
        return store('get', KEY_CHOSEN) === '1' ? saved : null;
    }

    function detect() {
        var langs = [];
        try { langs = (w.navigator.languages && w.navigator.languages.length) ? Array.prototype.slice.call(w.navigator.languages) : [w.navigator.language || w.navigator.userLanguage]; } catch (e) {}
        var sawEnglish = false;
        for (var i = 0; i < langs.length; i++) {
            var tag = langs[i];
            if (!tag) continue;
            var n = normalize(tag);
            if (n) return n;
            var parts = String(tag).toLowerCase().replace(/_/g, '-').split('-');
            if (parts[0] === 'en') { sawEnglish = true; continue; }
            // язык не поддерживается — пробуем регион ("tt-RU" → ru)
            var region = parts.length > 1 ? parts[parts.length - 1] : null;
            if (region && REGION_FALLBACK[region]) return REGION_FALLBACK[region];
        }
        // en-* — это тоже определённый ответ: английский
        if (sawEnglish) return 'en';
        try {
            var loc = Intl.DateTimeFormat().resolvedOptions().locale;
            var ln = normalize(loc);
            if (ln) return ln;
            var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            for (var j = 0; j < TZ_FALLBACK.length; j++) if (TZ_FALLBACK[j][0].test(tz)) return TZ_FALLBACK[j][1];
        } catch (e) {}
        return 'en';
    }

    /** Язык, который нужно показать прямо сейчас на ЭТОЙ странице. */
    function current() {
        return fromPath() || fromQuery() || getChosen() || detect() || 'en';
    }

    /** Запомнить язык. explicit=true — пользователь выбрал сам (переживает смену языка браузера). */
    function setPreferred(code, explicit) {
        var c = normalize(code);
        if (!c) return null;
        if (explicit) { store('set', KEY_PREF, c); store('set', KEY_CHOSEN, '1'); }
        return c;
    }

    function forget() { store('del', KEY_PREF); store('del', KEY_CHOSEN); }

    /** URL страницы на другом языке: сохраняет файл (beta.html …), query (кроме lang) и hash. */
    function urlFor(code, loc) {
        loc = loc || w.location;
        var c = normalize(code) || 'en';
        var path = loc.pathname;
        var landing = /^\/landing(\/|$)/.test(path) ? '/landing' : '';
        var rest = path.slice(landing.length);
        var m = rest.match(/^\/([a-z]{2})(\/.*)?$/i);
        if (m && META[m[1].toLowerCase()]) rest = m[2] || '/';
        if (!rest) rest = '/';
        var base = landing + (c === 'en' ? '' : '/' + c);
        var out = (base + rest).replace(/\/{2,}/g, '/');
        if (out === '') out = '/';
        var qs = '';
        try {
            var p = new URLSearchParams(loc.search || ''); p.delete('lang');
            var s = p.toString(); qs = s ? '?' + s : '';
        } catch (e) { qs = loc.search || ''; }
        return out + qs + (loc.hash || '');
    }

    /** Пользователь выбрал язык вручную: запомнить и перейти на нужную страницу. */
    function switchTo(code) {
        var c = setPreferred(code, true);
        if (!c) return;
        if (c === fromPath() || (c === 'en' && !fromPath())) {
            if (typeof w.changeLanguage === 'function') w.changeLanguage(c);
            return;
        }
        w.location.href = urlFor(c);
    }

    function htmlLang(code) { return (META[normalize(code) || 'en'] || META.en).html; }

    function applyToDocument(code) {
        var c = normalize(code) || 'en';
        var d = w.document && w.document.documentElement;
        if (d) { d.setAttribute('lang', META[c].html); d.setAttribute('dir', META[c].dir); }
        return c;
    }

    w.LNLang = {
        SUPPORTED: SUPPORTED, META: META,
        normalize: normalize, detect: detect, current: current, fromPath: fromPath,
        getChosen: getChosen, setPreferred: setPreferred, forget: forget,
        urlFor: urlFor, switchTo: switchTo, htmlLang: htmlLang, applyToDocument: applyToDocument
    };

    // ── Стартовая инициализация (синхронно, до отрисовки страницы) ─────────
    var pathLang = fromPath();
    var lang;
    var applyDoc = true;
    if (pathLang) {
        lang = pathLang;                                   // языковая страница: URL — закон
    } else {
        var isRoot = (w.location.pathname === '/' || w.location.pathname === '/index.html');
        if (isRoot) {
            lang = fromQuery() || getChosen() || detect();
            if (lang !== 'en') {
                // Редирект ДО первой отрисовки: нет вспышки английской версии, нет двойного срабатывания.
                // Query и hash сохраняем: Web Share Target (?title=&text=) и ссылки #shared=…
                w.__lnRedirecting = true;
                w.location.replace(urlFor(lang));
                applyDoc = false;
            }
        } else {
            // Не-языковая страница не в корне (/landing/, /beta.html …): содержимое английское,
            // редиректом (если он нужен) занимается сама страница через LNLang.detect().
            lang = 'en';
            applyDoc = false;
        }
    }
    w.currentLang = lang;
    if (applyDoc) applyToDocument(lang);

    // Единый getCurrentLanguage() вместо трёх разных реализаций.
    w.getCurrentLanguage = function () { return w.currentLang || 'en'; };
})(window);
