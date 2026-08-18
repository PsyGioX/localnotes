// Language mapping for automatic redirection
var languageMap = {
    'ru': '/ru/',
    'uk': '/ua/',
    'pl': '/pl/',
    'cs': '/cs/',
    'sk': '/sk/',
    'bg': '/bg/',
    'hr': '/hr/',
    'sr': '/sr/',
    'bs': '/bs/',
    'mk': '/mk/',
    'sl': '/sl/'
};

// Only run on the root page — language pages don't need redirection
var currentPath = window.location.pathname;
var isRootPage = (currentPath === '/' || currentPath === '/index.html');
if (!isRootPage) {
    // Not on root — do nothing, just set currentLang from path
    var pathMatch = currentPath.match(/^\/([a-z]{2})\//);
    if (pathMatch) window.currentLang = pathMatch[1];
} else {
    // On root page — detect language and redirect if needed
    // Флаг предотвращает двойной редирект (DOMContentLoaded + readyState fallback)
    var _langRedirectDone = false;

    function _doLangRedirect() {
        if (_langRedirectDone) return;
        _langRedirectDone = true;
        var userLang = getUserLanguage();
        if (userLang !== 'en' && languageMap[userLang]) {
            localStorage.setItem('preferredLanguage', userLang);
            // Preserve query string + hash across the redirect — otherwise
            // incoming Web Share Target data (?title=&text=&url=) or a
            // shared-note link (#shared=...) gets silently dropped here,
            // before js/share-target.js on the localized page ever sees it.
            var target = languageMap[userLang] + window.location.search + window.location.hash;
            window.location.replace(target);
        } else {
            // English or unknown — stay on root, clear any stale redirect pref
            localStorage.removeItem('preferredLanguage');
            showMainPage();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _doLangRedirect);
    } else {
        _doLangRedirect();
    }
}

function getUserLanguage() {
    // ?lang= param always wins and clears saved pref
    var urlParams = new URLSearchParams(window.location.search);
    var langParam = urlParams.get('lang');
    if (langParam === 'en') return 'en';
    if (langParam && languageMap[langParam]) return langParam;

    var savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang === 'en') return 'en';
    if (savedLang && languageMap[savedLang]) return savedLang;

    var browserLanguages = navigator.languages || [navigator.language || navigator.userLanguage];
    for (var i = 0; i < browserLanguages.length; i++) {
        var browserLang = browserLanguages[i];
        var langCode = browserLang.split('-')[0].toLowerCase();
        if (languageMap[langCode]) return langCode;
        var parts = browserLang.split('-');
        var countryCode = parts[1] ? parts[1].toLowerCase() : null;
        if (countryCode) {
            if (countryCode === 'ua') return 'uk';
            if (countryCode === 'by' || countryCode === 'kz' || countryCode === 'md' || countryCode === 'ru') return 'ru';
        }
    }

    try {
        var systemLang = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0].toLowerCase();
        if (languageMap[systemLang]) return systemLang;
    } catch (e) {}

    try {
        var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone.includes('Moscow') || timezone.includes('Yekaterinburg') ||
            timezone.includes('Novosibirsk') || timezone.includes('Krasnoyarsk') ||
            timezone.includes('Irkutsk') || timezone.includes('Yakutsk') ||
            timezone.includes('Vladivostok')) return 'ru';
        if (timezone.includes('Kiev')) return 'uk';
    } catch (e) {}

    try {
        var ua = navigator.userAgent;
        if (ua.includes('ru-RU') || ua.includes('ru_ru')) return 'ru';
        if (ua.includes('uk-UA') || ua.includes('uk_ua')) return 'uk';
    } catch (e) {}

    return 'en';
}

function showMainPage() {
    window.currentLang = 'en';
    console.clear();

    var originalLog = console.log;
    var originalWarn = console.warn;
    var originalError = console.error;

    var filterPatterns = [
        /ISOLATED@/, /got message/, /Worlds\.js/, /mbEGGjir\.js/,
        /Service Worker/, /violates the following Content Security Policy/,
        /preload/, /crossorigin attribute/, /deprecated features/, /TinyMCE/,
        /Google Analytics/, /searchAnalyzer/, /Search engine null/, /\[GET_CSS\]/,
        /content-scripts\.js/, /Loading the (font|script)/, /Live reload/,
        /Google Analytics script failed/, /Initializing language/,
        /The resource.*was preloaded/
    ];

    var shouldFilter = function(args) {
        var message = args.join(' ');
        return filterPatterns.some(function(p) { return p.test(message); });
    };

    console.log = function() { if (!shouldFilter([].slice.call(arguments))) originalLog.apply(console, arguments); };
    console.warn = function() { if (!shouldFilter([].slice.call(arguments))) originalWarn.apply(console, arguments); };
    console.error = function() { if (!shouldFilter([].slice.call(arguments))) originalError.apply(console, arguments); };

    originalLog('%c' +
        '╔═══════════════════════════════════════════════════════════╗\n' +
        '║                                                           ║\n' +
        '║              📝  LOCAL NOTES - SECURE NOTES  📝            ║\n' +
        '║                                                           ║\n' +
        '╚═══════════════════════════════════════════════════════════╝',
        'color: #4CAF50; font-weight: bold; font-size: 12px; font-family: monospace;');

    originalLog('%c\n🔐 SECURITY', 'color: #FF5722; font-size: 16px; font-weight: bold;');
    originalLog('%c   ✓ AES-256 industry-standard encryption', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ All data stored locally', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ No data sent to servers', 'color: #666; font-size: 12px;');

    originalLog('%c\n🌍 FEATURES', 'color: #2196F3; font-size: 16px; font-weight: bold;');
    originalLog('%c   ✓ 12 interface languages', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ PWA - works as an app', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ Offline mode', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ LocalNotesEditor - rich text editing', 'color: #666; font-size: 12px;');
    originalLog('%c   ✓ Search with transliteration', 'color: #666; font-size: 12px;');

    originalLog('%c\n📊 INFORMATION', 'color: #9C27B0; font-size: 16px; font-weight: bold;');
    originalLog('%c   Version:  1.9.8', 'color: #666; font-size: 12px;');
    originalLog('%c   Author:   PsyGioX', 'color: #666; font-size: 12px;');
    originalLog('%c   Website:  https://localnotes-three.vercel.app/', 'color: #666; font-size: 12px;');
    originalLog('%c   GitHub:   https://github.com/PsyGioX/localnotes', 'color: #666; font-size: 12px;');

    originalLog('%c\n💡 TIP', 'color: #FF9800; font-size: 16px; font-weight: bold;');
    originalLog('%c   Use search with transliteration for convenient searching!', 'color: #666; font-size: 12px;');
    originalLog('%c   Cyrillic ↔ Latin automatically', 'color: #666; font-size: 12px;');
    originalLog('%c\n' + '='.repeat(63) + '\n', 'color: #4CAF50; font-weight: bold;');

    if (typeof updateButtonTexts === 'function') {
        setTimeout(updateButtonTexts, 200);
    }
}
