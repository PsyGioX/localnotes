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

// Get consent details
const consent = CookiesBanner.getConsent();
console.log(consent.analytics); // true/false
console.log(consent.marketing); // true/false

// Show/hide banner manually
CookiesBanner.show();
CookiesBanner.hide();
```

## Language Detection

The banner automatically detects the current language using this priority:

1. **URL Parameter** - `?lang=ru`
2. **localStorage** - `preferredLanguage` key
3. **Browser Language** - `navigator.language`
4. **URL Path** - `/ru/`, `/ua/`, etc.
5. **Default** - English (en)

## Cookie Types

The banner manages three types of cookies specific to Local Notes:

### Necessary Cookies
- **Always enabled** - Required for Local Notes functionality
- `localnotes_notes_data` - Encrypted notes storage
- `localnotes_encryption_key` - AES-256 encryption keys
- `localnotes_theme` - Dark/light theme preference
- `preferredLanguage` - User language preference
- `localnotes_view_mode` - Grid/list view preference
- `localnotes_pwa_install` - PWA installation status
- `localnotes_session` - Session management

### Analytics Cookies
- **Optional** - Help understand Local Notes usage
- `_ga` - Google Analytics user identification
- `_ga_*` - Google Analytics 4 measurement
- `_gid` - Google Analytics session data
- `_gat` - Google Analytics throttling
- `G-HR9HLBQFCR` - Local Notes tracking ID
- Used for improving user experience and app performance

### Marketing Cookies
- **Currently not used** - Reserved for future features
- Will include social sharing, promotional content
- Currently disabled in Local Notes

## GDPR Compliance

This banner meets GDPR requirements by:

- ✅ **Clear Information** - Explains what cookies are used for
- ✅ **Granular Control** - Users can choose specific cookie types
- ✅ **Easy Withdrawal** - Users can change preferences anytime
- ✅ **No Pre-ticked Boxes** - All optional cookies are opt-in
- ✅ **Consent Storage** - Remembers user choices securely
- ✅ **Transparent Purpose** - Clear explanation of each cookie type

## Customization

### Theme Colors

The banner uses Local Notes color scheme:

```javascript
// Default theme (matches Local Notes)
const theme = {
    primary: '#4CAF50',      // Green buttons
    secondary: '#2196F3',    // Blue links
    background: '#ffffff',   // White background
    text: '#333333',         // Dark text
    border: '#e0e0e0',       // Light borders
    shadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    borderRadius: '12px',
    fontFamily: '"Golos Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
};
```

### Configuration Options

```javascript
const config = {
    cookieName: 'localnotes_cookie_consent',
    cookieExpiry: 365,        // days
    showDelay: 1000,          // milliseconds
    animationDuration: 300,   // milliseconds
    zIndex: 10000            // CSS z-index
};
```

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

For language-specific pages (like `/ru/`, `/ua/`), the banner will automatically detect the language from the URL path.

## Privacy Policy Integration

The banner includes links to your privacy policy. Make sure you have these pages:

- `/privacy_policy.html` - Main privacy policy
- `/cookie_policy.html` - Detailed cookie information
- `/usage_policy.html` - Terms of use

## Troubleshooting

### Banner Not Showing

1. Check if consent already exists: `CookiesBanner.hasConsent()`
2. Clear consent: `localStorage.removeItem('localnotes_cookie_consent')`
3. Refresh the page

### Wrong Language

1. Check URL parameter: `?lang=ru`
2. Check localStorage: `localStorage.getItem('preferredLanguage')`
3. Check browser language settings

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
