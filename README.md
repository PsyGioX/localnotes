# 📝 Local Notes

![Local Notes Screenshot](https://github.com/SerGioPlay01/localnotes/blob/main/sccc.png?raw=true)

[![Version](https://img.shields.io/badge/Version-1.7.0-brightgreen.svg)](https://github.com/SerGioPlay01/localnotes/releases)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM%20%2B%20HMAC--SHA--512-blue.svg)](https://github.com/SerGioPlay01/localnotes)
[![DOMPurify](https://img.shields.io/badge/XSS-DOMPurify-red.svg)](https://github.com/cure53/DOMPurify)
[![PWA](https://img.shields.io/badge/PWA-Enabled-purple.svg)](https://github.com/SerGioPlay01/localnotes)
[![Offline](https://img.shields.io/badge/Offline-Supported-orange.svg)](https://github.com/SerGioPlay01/localnotes)
[![Languages](https://img.shields.io/badge/Languages-12-yellow.svg)](https://github.com/SerGioPlay01/localnotes)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

### 📖 README in other languages
[![README RU](https://img.shields.io/badge/📖_README_Русский-red)](README_RU.md)

### 🌍 Choose App Language

[![EN](https://img.shields.io/badge/🇺🇸_English-blue)](https://localnotes-three.vercel.app/)
[![RU](https://img.shields.io/badge/🇷🇺_Русский-red)](https://localnotes-three.vercel.app/ru/)
[![UA](https://img.shields.io/badge/🇺🇦_Українська-yellow)](https://localnotes-three.vercel.app/ua/)
[![PL](https://img.shields.io/badge/🇵🇱_Polski-green)](https://localnotes-three.vercel.app/pl/)
[![CS](https://img.shields.io/badge/🇨🇿_Čeština-orange)](https://localnotes-three.vercel.app/cs/)
[![SK](https://img.shields.io/badge/🇸🇰_Slovenčina-pink)](https://localnotes-three.vercel.app/sk/)
[![BG](https://img.shields.io/badge/🇧🇬_Български-purple)](https://localnotes-three.vercel.app/bg/)
[![HR](https://img.shields.io/badge/🇭🇷_Hrvatski-lightblue)](https://localnotes-three.vercel.app/hr/)
[![SR](https://img.shields.io/badge/🇷🇸_Српски-darkred)](https://localnotes-three.vercel.app/sr/)
[![BS](https://img.shields.io/badge/🇧🇦_Bosanski-teal)](https://localnotes-three.vercel.app/bs/)
[![MK](https://img.shields.io/badge/🇲🇰_Македонски-gold)](https://localnotes-three.vercel.app/mk/)
[![SL](https://img.shields.io/badge/🇸🇮_Slovenščina-lime)](https://localnotes-three.vercel.app/sl/)

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_Site-brightgreen)](https://localnotes-three.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black)](https://github.com/SerGioPlay01/localnotes)

---

## 🎯 About

**Local Notes** is a modern, secure web application for creating and organizing notes directly in your browser. All data stays on your device — no server, no tracking, no accounts.

### Key Features

- **🔒 Max-2026 encryption** — AES-256-GCM + HMAC-SHA-512 + PBKDF2-SHA-512 (600k iterations) + domain binding
- **🛡️ DOMPurify XSS protection** — all note content sanitized before rendering
- **🌍 12 languages** — full UI localization including all modals, buttons and error messages
- **📱 PWA** — install as a native app on any device
- **⚡ LocalNotesEditor** — custom lightweight editor (~15KB), no external dependencies
- **🏷️ Tags & colors** — organize notes by topic with color labels
- **📅 Built-in calendar** — view notes by date (month / week / agenda)
- **🔄 Offline** — Service Worker caching for full offline use
- **✅ Smart checklists** — flat checkbox + input design, per-item customization (color, priority, label)
- **📋 11 editor templates** — meeting, project, report, brainstorm, lecture, flashcard, research, daily planner, weekly review, OKR goals, habit tracker

---

## 🔐 Encryption (v4 — Max-2026)

Local Notes uses a multi-layer encryption pipeline for exported `.note` files:

```
PASSWORD
  │
  ▼
PBKDF2-SHA-512 (600 000 iterations)
  │
  ▼
HKDF-SHA-512 → 5 independent keys:
  K_aes   — AES-256-GCM  (encryption)
  K_mac   — HMAC-SHA-512 (integrity)
  K_shuf  — Fisher-Yates block shuffle
  K_xor   — XOR keystream (SHA-512 PRF)
  K_cc    — reserved (ChaCha20 layer)
  │
  ▼
ENCRYPT PIPELINE:
  1. Zero-padding (hides plaintext length)
  2. XOR-stream (K_xor) — first transformation layer
  3. Block shuffle (K_shuf) — Fisher-Yates permutation
  4. AES-256-GCM (K_aes) — main encryption
  5. HMAC-SHA-512 (K_mac) — Encrypt-then-MAC
  6. Canary bytes — truncation/corruption detector
  7. Zeroize all intermediate buffers
```

**Format v4:** `magic(4) | version(1) | salt(32) | iv(12) | hmac(64) | cipher | canary(8)`

**Domain binding:** keys are cryptographically tied to `localnotes-three.vercel.app` via HKDF `info` parameter — files cannot be decrypted on any other domain.

**KDF cache key:** SHA-256(password + salt) — password never stored in plaintext as a Map key.

**Backward compatible** with v2 and v3 formats.

---

## 🛡️ Security Model

### XSS Protection
- **DOMPurify** (served locally, no CDN) sanitizes all note content before `innerHTML` assignment
- Applied at render time, import time, and all internal HTML parsing functions
- `sanitizeImportedHTML()` uses DOMPurify — strips `<script>`, event handlers (`on*`), `javascript:` URLs

### Content Security Policy
- `unsafe-eval` removed — no dynamic code execution
- Twitch `assets.twitch.tv` / `api.twitch.tv` removed from `script-src` / `connect-src`
- Twitch embeds work via `frame-src` only (player.twitch.tv, clips.twitch.tv)
- GA Consent Mode v2 — `analytics_storage: 'denied'` by default until user consents

### Clickjacking Protection
- Real frame-busting: `window.top.location = window.self.location`
- Cross-origin frame fallback: `document.documentElement.style.display = 'none'`

### Cryptographic IDs
- Note IDs generated with `crypto.getRandomValues()` — not `Math.random()`
- Worker message IDs use CSPRNG
- Timing jitter uses CSPRNG (anti-timing attacks)

### Service Worker
- `message` event validates source origin against allowlist before processing

---

## ✨ Features

### 📝 Editor (LocalNotesEditor)
- ~15KB, zero dependencies — replaced TinyMCE (was 500KB+)
- Rich formatting: headings, lists, tables, links, blockquotes, code blocks
- Media: images (drag & drop), videos (YouTube, Vimeo, Twitch, Rutube, VK, TikTok)
- Interactive checklists, emoji picker, special characters
- Find & Replace, word/character count
- Text color & highlight with live caret color sync
- Fullscreen mode, Undo/Redo (Ctrl+Z / Ctrl+Y)
- Quick Edit mode directly in the notes list

### 🏷️ Tags & Organization
- Color tags — create, edit, delete with color picker
- Filter notes by tag
- Due date with overdue / today / soon visual indicators
- Note Settings modal — tags, due date, color, pin — fully translated

### 📅 Calendar
- Three views: Month, Week, Agenda
- Navigation with Today button
- Notes linked to creation date and due date
- Full i18n: month names, weekday abbreviations, all labels

### 🔍 Search
- Instant search through note content
- Transliteration support (Cyrillic ↔ Latin)
- Grid and list view modes

### 💾 Export & Import
- Encrypted `.note` files (AES-256-GCM v4 pipeline)
- HTML and Markdown export/import
- Decrypt modal with live password validation — fully translated
- Clear error messages: wrong password vs. wrong domain

---

## 🌐 Translation System

All 12 languages (EN, RU, UA, PL, CS, SK, BG, HR, SR, BS, MK, SL) have complete translations for:

- Main UI (buttons, titles, messages)
- Decrypt Note modal (title, password label, buttons, status messages, origin error)
- Import errors (encrypted file warning, file error, partial success)
- Calendar (Month/Week/Agenda buttons, Today, month names, weekdays)
- Note Settings modal (Tags, Due date, Color, Pin, New tag, Clear, Apply)
- Editor toolbar
- All policy pages

Translations live in `js/translations.js` and `json/lang.json`, applied via `window.t(key)`.

---

## 🏗️ Architecture

### File Structure

```
localnotes/
├── index.html                    # Main page (EN)
├── manifest.json                 # PWA manifest
├── sw.js                         # Service Worker (with origin validation)
├── robots.txt / sitemap.xml
│
├── css/
│   ├── index.css                 # Main styles
│   ├── editor-modal.css          # Editor modal styles
│   ├── tags-calendar.css         # Tags, calendar, decrypt modal
│   └── img.css / highlight.css / print.css / page.css / apple.css
│
├── js/
│   ├── index.js                  # App logic, encryption v4, import/export
│   ├── purify.min.js             # DOMPurify — XSS sanitization (local, no CDN)
│   ├── translations.js           # 12 languages, 300+ keys
│   ├── translate.js              # Language detection & switching
│   ├── tags-calendar.js          # Tags system + calendar
│   ├── security.js               # SecurityManager (clickjacking) + SecureStorage
│   ├── themes.js / utils.js / selectors.js
│   ├── performance.js / editor-integration.js
│   └── date-utils.js / img.js / preloader.js / magicurl.js / pwa.js
│
├── json/lang.json                # Static UI translations (all 12 languages)
│
├── localnoteseditor/
│   ├── core.js                   # Editor engine (~15KB)
│   ├── styles.css
│   └── bootstrap-icons/
│
├── fonts/ favicon/ resources/
├── cookies_banner_universal/     # GDPR cookie banner (Consent Mode v2)
│
└── [lang]/                       # ru, ua, pl, cs, sk, bg, hr, sr, bs, mk, sl
    ├── index.html
    ├── manifest.json
    ├── privacy_policy.html
    ├── usage_policy.html
    └── cookie_policy.html
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS ES6+, HTML5, CSS3 |
| Editor | LocalNotesEditor (custom, no deps) |
| Storage | IndexedDB |
| Encryption | Web Crypto API — AES-256-GCM + HMAC-SHA-512 + PBKDF2-SHA-512 |
| XSS Sanitization | DOMPurify (local) |
| PWA | Service Worker + Web App Manifest |
| Analytics | Google Analytics with Consent Mode v2 |
| Icons | Bootstrap Icons |

### Data Flow

1. **Init** → language detection → theme → editor init
2. **Create note** → LocalNotesEditor → IndexedDB
3. **Render note** → `DOMPurify.sanitize(content)` → `innerHTML`
4. **Export** → 5-layer encryption pipeline → `.note` file download
5. **Import** → `DOMPurify.sanitize()` → Decrypt modal → validation → IndexedDB
6. **Language switch** → `updateButtonTexts()` → all UI elements updated

---

## 🚀 Quick Start

### Online
Visit [localnotes-three.vercel.app](https://localnotes-three.vercel.app/) — ready instantly, no install needed.

### Local

```bash
git clone https://github.com/SerGioPlay01/localnotes.git
cd localnotes
python -m http.server 8000
# or: npx serve .
```

Open `http://localhost:8000`.

> **Note:** encrypted `.note` files are domain-bound to `localnotes-three.vercel.app`. Decryption will not work on localhost.

### Install as PWA
Click the install icon in Chrome/Edge address bar and confirm.

---

## 🆕 Changelog

### v1.7.0 (current)
- **🛡️ CSP hardened** — `unsafe-inline` removed from `script-src`; all inline scripts extracted to external files (`ga-init.js`, `script-loader.js`, `lang-redirect.js`, `page-init.js`)
- **🔒 DOMPurify hard-fail** — `index.js` throws on startup if DOMPurify is missing; all unsafe fallbacks removed
- **✅ Checklist redesigned** — flat `checkbox + input` layout, no wrapper blocks; customization panel per item: color (7 swatches), priority (low/mid/high), text label; Enter/Backspace keyboard navigation
- **📋 11 editor templates** — Business (meeting, project, report, brainstorm), Study (lecture, flashcard, research), Planning (daily, weekly, goals, habits); all translated into 12 languages
- **🎨 Note priority styles** — color accent now shows gradient background tint + top bar; overdue/today/soon states override user color with `!important`; due date badges larger and bolder
- **🔔 PWA update toast fixed** — detects already-waiting SW; `controllerchange` auto-reload; toast text translated in all 12 languages
- **🌍 Full i18n** — checklist customization, template labels and content — all 12 languages
- **🐛 Redirect loop fixed** — `lang-redirect.js` only runs on root `/`; English version clears stale `preferredLanguage` from localStorage

### v1.2.1
- **�🔐 Encryption v4 (Max-2026)** — PBKDF2-SHA-512 (600k iter) + HKDF → 5 keys + XOR-stream + block shuffle + HMAC-SHA-512 + canary bytes + zeroize
- **🔗 Domain binding** — `.note` files cryptographically tied to `localnotes-three.vercel.app`
- **🔒 SecureStorage** — localStorage now encrypted with AES-256-GCM + HMAC (session key via HKDF)
- **🌍 Full i18n for all error modals** — import errors, origin error, integrity errors — all 12 languages
- **🛡️ Anti-timing protection** — jitter delays, constant-time comparisons, zeroize buffers

### v1.1.0
- **LocalNotesEditor** — replaced TinyMCE: 97% smaller, 50× faster init
- **Tags system** — color tags, filtering, due dates
- **Calendar** — month/week/agenda views, full i18n
- **Full i18n** — Calendar, Decrypt modal, Note Settings — all 12 languages

### v1.0.3
- Full Markdown import with images
- Performance monitoring (Core Web Vitals)
- Enhanced security (CSP, XSS)
- Added UA, BS, MK, SR languages

---

## ❓ FAQ

**Where are notes stored?**
Locally in IndexedDB. Nothing is ever sent to a server.

**How secure is the encryption?**
AES-256-GCM with PBKDF2-SHA-512 (600,000 iterations) + HMAC-SHA-512 integrity check + domain binding. Industry-leading protection as of 2026.

**Why can't I decrypt on localhost?**
`.note` files are cryptographically bound to `localnotes-three.vercel.app` via HKDF domain binding. This is intentional — it prevents decryption outside the official site.

**How to move notes to another browser?**
Export to `.note` file, then import at [localnotes-three.vercel.app](https://localnotes-three.vercel.app/).

**How to add a new language?**
Add a language block in `js/translations.js`, create a `[lang]/` folder with HTML pages, add the language to `js/translate.js`.

**Does it work offline?**
Yes — Service Worker caches all resources after first load.

**Is DOMPurify loaded from a CDN?**
No — `js/purify.min.js` is served locally. This keeps the CSP `script-src 'self'` effective and avoids third-party dependencies.

---

## 🤝 Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-feature`
3. Make changes and test
4. Open a Pull Request

Especially welcome: new language translations, accessibility improvements, tests.

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

## 👨‍💻 Author

**SerGio Play** — [GitHub](https://github.com/SerGioPlay01) | [Website](https://sergioplay-dev.vercel.app/)

---

<div align="center">

**⭐ If you like the project, give it a star! ⭐**

[![GitHub stars](https://img.shields.io/github/stars/SerGioPlay01/localnotes?style=social)](https://github.com/SerGioPlay01/localnotes)

**🌐 [Try Local Notes now!](https://localnotes-three.vercel.app/)**

</div>
