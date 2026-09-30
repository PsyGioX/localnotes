# Universal Cookies Banner for Local Notes

🍪 A modern, GDPR-compliant cookies banner with full support for all 12 Local Notes languages.

## Features

- ✅ **12 Languages Support** - Full translations for all Local Notes languages
- 📱 **Responsive Design** - Perfect display on all devices
- ⚡ **Lightweight** - Single file solution with minimal impact
- 🔒 **GDPR Compliant** - Meets international privacy standards
- 🍪 **Detailed Cookie Info** - Shows exactly which cookies are used and for what purpose
- 📊 **Analytics Control** - Automatically manages Google Analytics based on user consent
- 🎨 **Customizable** - Matches Local Notes design system
- 🛠️ **Easy Integration** - Automatic initialization and language detection
- 🌐 **Universal** - Works with any Local Notes language version
- 🔧 **Local Notes Specific** - Tailored for Local Notes cookies and functionality

## Supported Languages

- English (en)
- Русский (ru)
- Українська (ua)
- Polski (pl)
- Čeština (cs)
- Slovenčina (sk)
- Български (bg)
- Hrvatski (hr)
- Српски (sr)
- Bosanski (bs)
- Македонски (mk)
- Slovenščina (sl)

## Quick Start

### 1. Include the Script

Add the cookies banner script to your HTML pages:

```html
<script src="cookies_banner_universal/cookies-banner.js"></script>
```

### 2. Automatic Initialization

The banner will automatically:
- Detect the current language from URL, localStorage, or browser settings
- Show only if user hasn't given consent yet
- Handle all user interactions and save preferences

### 3. Manual Control (Optional)

Use the public API for advanced control:

```javascript
// Initialize banner manually
CookiesBanner.init();

// Check if user has given consent
if (CookiesBanner.hasConsent()) {
    // User has consented, load analytics, etc.
}

// Get consent details (null if nothing has been saved yet)
const consent = CookiesBanner.getConsent();
console.log(consent.analytics); // true/false
console.log(consent.marketing); // true/false (always false in Local Notes)

// Show/hide banner manually
CookiesBanner.show();
CookiesBanner.hide();
```

Full public API (`window.CookiesBanner`):

| Method | Description |
|--------|-------------|
| `init()` | Build and (if no consent yet) show the banner; called automatically on DOM ready |
| `hasConsent()` | `true` if a consent record exists |
| `getConsent()` | The stored record `{ necessary, analytics, marketing, timestamp, version }` or `null` |
| `saveConsent({ analytics, marketing })` | Store a choice and update Google Analytics consent |
| `show()` / `hide()` | Show or hide the banner |
| `manageAnalytics(bool)` | Send `gtag('consent', 'update', { analytics_storage: 'granted' \| 'denied' })` |
| `getCookiesInfo()` | The cookie lists shown in the "View cookies" panel |
| `updateLanguage(lang)` | Re-render the banner in another language |

## Language Detection

The banner picks the language in this order (first match wins):

1. **`window.currentLang`** — already set by the main app (`lang-redirect.js` / `translate.js`)
2. **URL path** — `/ru/`, `/ua/`, etc.
3. **URL parameter** — `?lang=ru`
4. **localStorage** — `preferredLanguage` key
5. **Browser language** — `navigator.language` (plus special cases: `*-UA` → `ua`; `*-BY`, `*-KZ`, `*-MD` → `ru`)
6. **Default** — English (`en`)

## Cookie Types

The banner's "View cookies" panel lists three groups of cookies. The lists live in `config.cookiesInfo` inside `cookies-banner.js` (readable through `CookiesBanner.getCookiesInfo()`).

### Necessary Cookies
- **Always enabled** — the user cannot switch them off
- Names shown in the panel: `localnotes_notes_data`, `localnotes_encryption_key`, `localnotes_theme`, `preferredLanguage`, `localnotes_view_mode`, `localnotes_pwa_install`, `localnotes_session`, `localnotes_cookie_consent`

> **What the app really stores.** Most of the names above are descriptive labels only — Local Notes itself does not write cookies with those names. Notes live in **IndexedDB** (encrypted at rest), and preferences live in **localStorage** (for example `theme`, `preferredLanguage`, `ln_network_mode`, `ln_workspaces`, `ln_lock_*`). The only cookie the banner itself sets is `localnotes_cookie_consent` (a copy of the choice is also kept in localStorage under the same name). If you change how the app stores data, update `config.cookiesInfo`, the per-language descriptions and `cookie_policy.html` together so the panel stays truthful.

### Analytics Cookies
- **Optional** — off until the user accepts
- `_ga`, `_ga_*`, `_gid`, `_gat` — Google Analytics
- `G-HR9HLBQFCR` — Local Notes GA4 measurement ID (shown for transparency; it is an ID, not a cookie)
- Consent Mode v2: `js/ga-init.js` sets `analytics_storage: 'denied'` by default; the banner sends `gtag('consent', 'update', …)` with `granted` or `denied` when the user chooses

### Marketing Cookies
- **Currently not used** — the list is empty and `marketing` is always `false`
- Reserved for possible future features

### Stored consent record

```json
{ "necessary": true, "analytics": false, "marketing": false,
  "timestamp": "2026-01-01T12:00:00.000Z", "version": "1.0.0" }
```

Kept in `localStorage['localnotes_cookie_consent']` and in a cookie of the same name (365 days, `path=/`, `SameSite=Lax`).

## GDPR Compliance

This banner meets GDPR requirements by:

- ✅ **Clear Information** - Explains what cookies are used for
- ✅ **Granular Control** - Users can choose specific cookie types
- ⚠️ **Withdrawal** - there is no built-in settings link yet: a choice can be changed by calling `CookiesBanner.show()` (e.g. from a "Cookie settings" link you add) or by clearing site data
- ✅ **No Pre-ticked Boxes** - All optional cookies are opt-in
- ✅ **Consent Storage** - Remembers user choices securely
- ✅ **Transparent Purpose** - Clear explanation of each cookie type

## Customization

The banner is a single self-contained file. Its settings are plain constants inside an IIFE, so they are **not** changeable at runtime — edit `cookies-banner.js` (the `config` object near the top) and redeploy.

### Configuration constants

```javascript
const config = {
    cookieName: 'localnotes_cookie_consent',
    cookieExpiry: 365,        // days
    showDelay: 1000,          // milliseconds
    animationDuration: 300,   // milliseconds
    zIndex: 10000,            // CSS z-index
    cookiesInfo: { necessary: [...], analytics: [...], marketing: [] },
    theme: { ... }            // colours, radius, font — see below
};
```

### Theme

```javascript
theme: {
    primary: '#4CAF50',      // Green buttons
    secondary: '#2196F3',    // Blue links
    background: '#ffffff',   // White background
    text: '#333333',         // Dark text
    border: '#e0e0e0',       // Light borders
    shadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    borderRadius: '12px',
    fontFamily: '"Golos Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
}
```

Translations for the 12 languages (title, message, buttons and the three group descriptions) are in the `translations` object in the same file.

## Browser Support

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## File Structure

```
cookies_banner_universal/
├── cookies-banner.js    # Main banner script
├── demo.html           # Demo page for testing
└── README.md           # This documentation
```

## Demo

Open `demo.html` in your browser to test the banner with different languages and settings.

## Integration Examples

### Basic Integration

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Local Notes</title>
</head>
<body>
    <!-- Your content -->
    
    <!-- Include cookies banner -->
    <script src="cookies_banner_universal/cookies-banner.js"></script>
</body>
</html>
```

### With Analytics

```html
<script src="cookies_banner_universal/cookies-banner.js"></script>
<script>
// Analytics are automatically managed by the banner
// No additional code needed - Google Analytics will be enabled/disabled
// based on user consent automatically

// Optional: Check consent status
if (CookiesBanner.hasConsent()) {
    const consent = CookiesBanner.getConsent();
    console.log('Analytics enabled:', consent.analytics);
    console.log('Marketing enabled:', consent.marketing);
}

// Optional: Get detailed cookies information
const cookiesInfo = CookiesBanner.getCookiesInfo();
console.log('Necessary cookies:', cookiesInfo.necessary);
console.log('Analytics cookies:', cookiesInfo.analytics);
</script>
```

### Language-Specific Pages

For language-specific pages (like `/ru/`, `/ua/`), the banner detects the language from `window.currentLang` or the URL path (see *Language Detection*).

### How it is wired into Local Notes

- `index.html` loads `cookies_banner_universal/cookies-banner.js` with `defer`; the `[lang]/index.html` pages load it with a relative path (`../cookies_banner_universal/…`).  The policy pages (`privacy_policy.html`, `cookie_policy.html`, `usage_policy.html`) do not include it.
- `js/ga-init.js` runs first and declares Consent Mode v2 defaults (`analytics_storage: 'denied'`), so nothing is collected before the user answers.
- The banner only appears when no consent record exists.

## Privacy Policy Integration

The banner includes links to your privacy policy. Make sure you have these pages:

- `/privacy_policy.html` - Main privacy policy
- `/cookie_policy.html` - Detailed cookie information
- `/usage_policy.html` - Terms of use

## Troubleshooting

### Banner Not Showing

1. Check if consent already exists: `CookiesBanner.hasConsent()`
2. Clear consent: `localStorage.removeItem('localnotes_cookie_consent')` **and** delete the `localnotes_cookie_consent` cookie (DevTools → Application → Cookies)
3. Refresh the page (the banner appears after ~1 s)

### Wrong Language

1. Check `window.currentLang` (set by the app — it wins over everything else)
2. Check the URL path (`/ru/`) and the `?lang=ru` parameter
3. Check localStorage: `localStorage.getItem('preferredLanguage')`
4. Check browser language settings
5. Force a language: `CookiesBanner.updateLanguage('ru')`

### Styling Issues

1. Ensure no CSS conflicts with banner styles
2. Check z-index conflicts (default: 10000)
3. Verify font loading (Golos Text)

## License

This cookies banner is part of the Local Notes project and follows the same license terms.

## Support

For issues or questions:
- Check the demo page for examples
- Review browser console for errors
- Ensure all files are properly loaded

---

**Author:** PsyGioX  
**Version:** 1.0.0  
**Compatible with:** Local Notes v1.0.3+
