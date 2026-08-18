# 📝 Local Notes

![Local Notes Screenshot](https://github.com/PsyGioX/localnotes/blob/main/sccc.png?raw=true)

[![Version](https://img.shields.io/badge/Version-1.9.8-brightgreen.svg)](https://github.com/PsyGioX/localnotes/releases)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM%20%2B%20HMAC--SHA--512-blue.svg)](https://github.com/PsyGioX/localnotes)
[![DOMPurify](https://img.shields.io/badge/XSS-DOMPurify-red.svg)](https://github.com/cure53/DOMPurify)
[![PWA](https://img.shields.io/badge/PWA-Enabled-purple.svg)](https://github.com/PsyGioX/localnotes)
[![Offline](https://img.shields.io/badge/Offline-Supported-orange.svg)](https://github.com/PsyGioX/localnotes)
[![Languages](https://img.shields.io/badge/Languages-12-yellow.svg)](https://github.com/PsyGioX/localnotes)
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
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black)](https://github.com/PsyGioX/localnotes)

---

## 🎯 About

**Local Notes** is a modern, secure web application for creating and organizing notes directly in your browser. All data stays on your device — no server, no tracking, no accounts.

### Mission

Give everyone a **private, fast, multilingual notebook** that works like a native app in the browser: write rich notes, organize them with tags and workspaces, export encrypted backups, and stay productive offline — without signing up or sending data anywhere.

### Project Goals

| Goal | What it means in practice |
|------|---------------------------|
| **Privacy by default** | Notes live in IndexedDB on your device. No backend, no analytics until consent, no cloud sync unless you export files yourself. |
| **Security you can verify** | Open-source client-side encryption (AES-256-GCM v4/v5), DOMPurify sanitization, strict CSP, domain-bound `.note` files. |
| **Works everywhere** | PWA install, offline Service Worker cache, 12 UI languages, mobile keyboard handling, iOS safe-area support. |
| **Lightweight & fast** | Custom editor (~15 KB) instead of heavy WYSIWYG bundles; crypto runs in a Web Worker so the UI stays responsive. |
| **Organize your way** | Tags, colors, due dates, calendar, pinned notes, workspaces (tabs), grid/list views, instant search with transliteration. |
| **Portable data** | Export/import HTML, Markdown, encrypted `.note` — your notes are never locked to one browser tab. |
| **Accessible & extensible** | Stable `window.*` APIs for integrations, scripts, and future plugins without a build step. |

### Design Principles

1. **Local-first** — the network is optional; offline mode is a first-class feature.
2. **Explicit user control** — encryption passwords, app lock, cookie consent, and network mode are always user-driven.
3. **Minimal dependencies** — vanilla JS, no React/Vue, DOMPurify and icons bundled locally.
4. **Progressive enhancement** — works in a tab; better as an installed PWA.

### Key Features

- **🔒 Max-2026 encryption** — AES-256-GCM + HMAC-SHA-512 + PBKDF2-SHA-512 (600k iterations) + domain binding
- **🔐 App Lock** — optional PIN and/or access file; idle timeout (10 min); lock screen on new session
- **🛡️ DOMPurify XSS protection** — all note content sanitized before rendering
- **🌍 12 languages** — full UI localization including all modals, buttons and error messages
- **📱 PWA** — install as a native app on any device; safe update flow without reload loops
- **⚡ LocalNotesEditor** — custom lightweight editor (~15KB), no external dependencies
- **🗂️ Workspaces** — separate note collections in tabs (see [WORKSPACES_README.md](WORKSPACES_README.md))
- **🏷️ Tags & colors** — organize notes by topic with color labels
- **📅 Built-in calendar** — view notes by date (month / week / agenda)
- **🔄 Offline** — Service Worker caching + manual offline network mode toggle
- **📸 Note screenshots** — export a note card as PNG for sharing
- **✅ Smart checklists** — flat checkbox + input design, per-item customization (color, priority, label)
- **📋 11 editor templates** — meeting, project, report, brainstorm, lecture, flashcard, research, daily planner, weekly review, OKR goals, habit tracker

---

## 🔌 JavaScript API

Local Notes exposes a **browser-global API** (`window.*`) for scripting, automation, and integrations. All APIs are available after scripts load on the main app page (`index.html` or `/[lang]/index.html`). There is no REST server — everything runs client-side.

> **Tip:** Open DevTools on [localnotes-three.vercel.app](https://localnotes-three.vercel.app/) and call APIs from the console.

### Core — notes & UI (`js/index.js`)

| API | Type | Description |
|-----|------|-------------|
| `window.notesDB` | `NotesDatabase` | IndexedDB access layer |
| `window.loadNotes()` | `async function` | Reload and render all notes from DB |
| `window.openModal(id, content, creationTime)` | `function` | Open editor modal for new/existing note |
| `window.closeModal()` | `function` | Close editor modal |
| `window.filterNotes(query)` | `function` | Filter visible notes by search string |
| `window.exportNote(content, password)` | `async function` | Export single note as encrypted `.note` |
| `window.importNotesWithFormat(files, format)` | `async function` | Import HTML / Markdown / `.note` files |
| `window.showCustomAlert(title, msg, type)` | `function` | Toast-style alert (`success` / `error` / `warning`) |
| `window.showCustomPrompt(title, defaultVal)` | `Promise<string>` | Text prompt dialog |
| `window.showExportOptions(noteContent)` | `function` | Open export format picker |
| `window.toggleQuickEditMode()` | `function` | Toggle inline quick-edit in note list |
| `window.updateButtonTexts()` | `function` | Refresh all UI strings after language change |

#### `NotesDatabase` methods

```javascript
await notesDB.init();
await notesDB.saveNote(note);      // { id, content, creationTime, lastModified, title, tags?, dueDate?, color?, pinned?, workspaceId? }
await notesDB.getAllNotes();
await notesDB.getNote(id);
await notesDB.deleteNote(id);
await notesDB.saveSetting(key, value);
await notesDB.getSetting(key);
await notesDB.migrateFromLocalStorage();
```

**IndexedDB schema:** database `LocalNotesDB` v1 — object stores `notes` (keyPath: `id`) and `settings`.

### Encryption (`window.encryption`)

Instance of `AdvancedEncryption` — Max-2026 pipeline with Web Worker fallback.

```javascript
// Encrypt / decrypt text (returns base64 payload or plaintext)
const encrypted = await encryption.encrypt(plainText, password);
const decrypted = await encryption.decrypt(encrypted, password);
```

- **Formats:** v5 (current), v4, v3, v2 (legacy decrypt supported)
- **Domain binding:** decryption only works on `localnotes-three.vercel.app` (HKDF `info` includes origin)
- **Worker:** heavy KDF/AES runs in `js/crypto-worker.js`; main thread fallback if worker fails

### Editor (`window.localNotesEditorAPI`)

Wrapper around `LocalNotesEditor` (`localnoteseditor/core.js`).

```javascript
localNotesEditorAPI.getContent();     // HTML string
localNotesEditorAPI.setContent(html);
localNotesEditorAPI.getText();        // plain text
localNotesEditorAPI.clear();
localNotesEditorAPI.focus();
localNotesEditorAPI.undo();
localNotesEditorAPI.redo();
localNotesEditorAPI.isInitialized();
localNotesEditorAPI.getInstance();    // raw LocalNotesEditor instance
```

### App Lock (`window.AppLock`)

Optional PIN and/or access-file lock (`js/app-lock.js`). Settings stored in `localStorage`; session unlock in `sessionStorage`.

```javascript
AppLock.isEnabled();      // true if PIN or file lock configured
AppLock.isUnlocked();     // true if current tab session passed unlock
AppLock.lockNow();        // lock immediately (shows lock screen)
AppLock.openSettings();   // open lock settings modal
AppLock.init();           // called automatically on load
```

| Storage key | Purpose |
|-------------|---------|
| `ln_lock_pin_hash` | SHA-256 hash of PIN |
| `ln_lock_file_hash` | SHA-256 hash of access file bytes |
| `ln_lock_enabled` | Mode: `pin`, `file`, or `both` |
| `ln_lock_session` | Session unlock flag (`sessionStorage`) |
| `ln_lock_last_activity` | Idle timer anchor |

### Tags & Calendar (`window.TagsCalendar`)

```javascript
TagsCalendar.getTags();
TagsCalendar.saveTags(tags);
TagsCalendar.createTag(name, color);
TagsCalendar.deleteTag(id);
TagsCalendar.addTagToNote(noteId, tagId);
TagsCalendar.removeTagFromNote(noteId, tagId);
TagsCalendar.applyTagFilter(tagId);
TagsCalendar.openCalendar();
TagsCalendar.getNoteMetaFromModal();  // { tags, dueDate, color, pinned }
TagsCalendar.TAG_COLORS;              // preset palette
window.showTagsPanel();               // open tag manager sidebar
```

### i18n (`window.t`, `window.translations`)

```javascript
window.t('addNoteButton');           // translated string for current language
window.t('decryptOriginError', { allowed, current });  // with placeholders
window.translations['ru']['lockTitle'];
window.changeLanguage('ru');         // switch UI language
window.currentLang;                  // active language code
```

Sources: `js/translations.js` (runtime) + `json/lang.json` (static fetch).

### Themes (`window.themeManager`)

```javascript
themeManager.applyTheme('dark' | 'light' | 'auto');
themeManager.getStoredTheme();
themeManager.getSystemTheme();
```

Persists to `localStorage` key `theme`; sets `data-theme` on `<html>`.

### Screenshots (`window.takeNoteScreenshot`)

```javascript
await takeNoteScreenshot(noteObject);  // renders note card → PNG preview modal
```

Requires a note object with `content`, `title`, etc. (same shape as IndexedDB record).

### Sharing (`window.shareNoteContent`, Web Share Target)

```javascript
await shareNoteContent(noteObject);  // navigator.share() with clipboard fallback
```

Two-way: the note-card Share button sends a note's title + text out via the OS share sheet (`navigator.share`, falls back to clipboard copy where unsupported); `manifest.json`'s `share_target` + `js/share-target.js` receive shares (or shortcut actions) coming in from other apps and pre-fill a new note.

### Security (`window.SecurityManager`)

```javascript
const sm = new SecurityManager();
sm.getSecurityReport();  // { https, csp, frameBusting, userAgent, timestamp }
```

Also includes **SecureStorage** (encrypted localStorage wrapper) — used internally for sensitive prefs.

### Performance (`window.PerformanceMonitor`)

Core Web Vitals monitoring and lazy-loading helpers (`js/performance.js`):

```javascript
PerformanceMonitor.getMetrics();
LazyLoader.observe(element, callback);
```

### Markdown import

```javascript
await importNotesMarkdownAdvanced(files);  // extended MD import with images
```

### Network mode

Footer toggle (`js/network-mode.js`) — forces Service Worker into cache-only mode:

```javascript
localStorage.getItem('ln_network_mode');  // 'online' | 'offline'
window.lnNetworkModeRefreshLabels();      // refresh toggle labels after language change
```

SW message: `{ type: 'SET_NETWORK_MODE', mode: 'online' | 'offline' }`.

### Service Worker messages (`sw.js`)

Send via `navigator.serviceWorker.controller.postMessage(...)`:

| Message | Description |
|---------|-------------|
| `{ type: 'SKIP_WAITING' }` | Activate waiting SW (PWA update) |
| `{ type: 'GET_VERSION' }` | Returns `{ version: 'static-vX.Y.Z' }` via MessagePort |
| `{ type: 'SET_NETWORK_MODE', mode }` | Switch online/offline fetch strategy |
| `{ type: 'PRECACHE_ALL' }` | Re-cache all static assets; responds with `{ type: 'PRECACHE_DONE' }` to clients |

### Note object schema

```javascript
{
  id: 'note_<timestamp>_<random>',  // string, IndexedDB key
  content: '<p>HTML from editor</p>',
  title: 'Extracted title',
  creationTime: 1710000000000,       // ms epoch
  lastModified: 1710000000000,
  tags: ['tagId1'],                  // optional
  dueDate: '2026-05-20',             // optional ISO date string
  color: '#aefc6e',                  // optional accent
  pinned: false,
  workspaceId: 'ws_...'              // optional, see WORKSPACES_README.md
}
```

### Temporary editor state

```javascript
window._noteMeta;  // { tags, dueDate, color, pinned } while Note Settings modal is open
```

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
- **Custom templates** — save any note as a reusable template with icon/category, `{{date}}`/`{{time}}`/`{{weekday}}` variables, JSON export/import

### ⌨️ Command Palette
- `Ctrl+K` / `⌘K` — new note, calendar, task board, view toggle, theme, lock now
- Instant search across note titles and content
- Respects App Lock — disabled while the app is locked

### 🔗 Wiki-links & Backlinks
- Type `[[` in the editor to link to another note, autocomplete included
- Backlinks panel in Note Settings — see what links to the note you're editing

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
- Advanced operators: `#tag`, `is:pinned|overdue|today|soon`, `has:image|video|table|checklist|link`, `before:`/`after:YYYY-MM-DD` — combinable in one query
- Transliteration support (Cyrillic ↔ Latin)
- Grid and list view modes

### 📜 Version History
- Every save of an existing note snapshots its previous content (only when it actually changed)
- Browse, restore, or delete past versions from Note Settings — last 20 kept per note

### 📤 Sharing
- Share button on each note card — `navigator.share()` to the OS share sheet, clipboard-copy fallback
- Web Share Target — share text/links into Local Notes from other apps, pre-fills a new note
- Home Screen shortcuts (`New Note` / `Search` / `Import`) are wired up too

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
│   ├── app-lock.css              # App lock screen & settings modal
│   ├── editor-modal.css          # Editor modal styles
│   ├── tags-calendar.css         # Tags, calendar, decrypt modal
│   ├── workspaces.css            # Workspaces tabs UI
│   └── img.css / highlight.css / print.css / page.css / apple.css
│
├── js/
│   ├── index.js                  # App logic, encryption v4/v5, import/export
│   ├── app-lock.js               # App Lock (PIN / file / idle timeout)
│   ├── purify.min.js             # DOMPurify — XSS sanitization (local, no CDN)
│   ├── translations.js           # 12 languages, 400+ keys
│   ├── translate.js              # Language detection & switching
│   ├── tags-calendar.js          # Tags system + calendar
│   ├── screenshot.js             # Note card → PNG screenshot
│   ├── workspaces.js             # Workspaces manager
│   ├── workspaces-integration.js # Workspaces hooks into index.js
│   ├── workspaces-translations.js
│   ├── security.js               # SecurityManager (clickjacking) + SecureStorage
│   ├── network-mode.js           # Online/offline toggle → Service Worker
│   ├── themes.js / utils.js / selectors.js
│   ├── performance.js / editor-integration.js
│   └── date-utils.js / img.js / preloader.js / magicurl.js / pwa.js / crypto-worker.js
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
git clone https://github.com/PsyGioX/localnotes.git
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

### v1.9.8 (current)
- **✨ Advanced search operators** — `is:pinned|overdue|today|soon`, `has:image|video|table|checklist|link`, `before:YYYY-MM-DD`, `after:YYYY-MM-DD`, combinable with `#tag` and free text
- **✨ Version history** — every save of an existing note snapshots its previous content (only when it actually changed); browse, restore, or delete past versions from Note Settings — last 20 kept per note
- **✨ Web Share Target wired up** — manifest already declared `share_target` and shortcut actions, but nothing read them; sharing text/links to Local Notes from other apps (or using the Home Screen shortcuts) now actually opens a pre-filled new note / focuses search / opens import, instead of silently doing nothing
- **✨ Share button** — the note-card toolbar (Edit/Delete/Export/Screenshot) now has a Share button too, using `navigator.share()` to hand the note's title + text off to the OS share sheet, with a clipboard-copy fallback where the Web Share API isn't available. The natural counterpart to Share Target above — the app can now send as well as receive
- **🐛 Fixed missing/inconsistent delete confirmation** — the main notes list deleted a note immediately with no confirmation at all; the task board fell back to the browser's unstyled native `confirm()` because `showConfirmModal` was never exported to `window`. Both now use the same styled confirmation modal as the rest of the app
- **➖ Reminders removed** — the Notification-API due-date reminders shipped earlier in this cycle were removed after reconsideration; the app doesn't have a server, so they could only ever be foreground-only reminders (checked while the tab was open), and that scope didn't earn its complexity. May return in a different shape later

### v1.9.8
- **🐛 Fixed calendar month/weekday names** — translation lookup for array values (`months`, `weekdaysShort`, `weekdays`) was returning the translation *key* instead of the array itself, corrupting calendar labels; core `t()` bug, fixed at the source
- **🐛 Fixed note duplication on reload** — `loadNotes()` could run concurrently from multiple init paths (main app + `workspaces-integration.js` patch), racing on the same DOM clear/append cycle; now serialized through a promise queue
- **🐛 Fixed checklists not rendering after template insert** — `_insertHTML()` only re-initialized checklist/code-block/context-toolbar behaviour on the iframe/video insertion path; plain `execCommand` inserts (e.g. any checklist template) stayed inert until the note was reopened. Now always re-initialized after insert
- **✨ Custom templates** — save any note as a reusable template via the editor's modal system; insert with one click, delete with confirm-to-undo safety
  - **Template variables** — `{{date}}`, `{{time}}`, `{{weekday}}`, `{{datetime}}` auto-expand at insertion time via `Intl`, respecting the app's current language
  - **Categories & icons** — Business / Study / Planning / Personal / Other, with a whitelisted icon picker (10 Bootstrap Icons)
  - **Export/Import as JSON** — back up or share a template set; imports are sanitized through the app's standard DOMPurify profile, size-capped (2 MB file / 300 templates / 300k chars per template), and never trust incoming `id`s
- **✨ Command Palette (Ctrl+K / ⌘K)** — quick actions (new note, calendar, task board, view toggle, theme, lock now) plus instant note search by title/content, all client-side, no new dependencies
- **✨ Wiki-links between notes** — type `[[` in the editor for an autocomplete popup over existing notes; selecting inserts an atomic link chip that jumps straight to that note on click
  - **Backlinks panel** — Note Settings now shows which other notes link to the one you're editing, computed on demand (no separate index/migration)
  - Ctrl+K conflict avoided — the palette yields to the editor's existing "Insert link" shortcut while focus is inside the editor

### v1.9.8
- **🔐 App Lock** — PIN and/or access file, idle lock (10 min), lock screen with mobile-friendly layout
- **🔌 API documentation** — full `window.*` API reference in README (notesDB, encryption, AppLock, TagsCalendar, SW messages)
- **🔔 PWA update flow fixed** — no infinite “Update available” toast; `SKIP_WAITING` before reload
- **🎨 Lock screen UI** — green top accent clipped to panel border-radius; removed redundant “App locked” toast

### v1.9.8
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

**How does App Lock work?**
Optional PIN (4–8 digits) and/or access file. Lock triggers on new browser session or after 10 minutes idle. Unlock methods are configured separately — only one active method is shown unless both were saved historically.

**Is there a public API?**
Yes — see [JavaScript API](#-javascript-api). All major features expose `window.*` globals for scripting and integrations.

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

**PsyGioX** — [GitHub](https://github.com/PsyGioX) | [Website](https://psygiox-dev.vercel.app/)

---
