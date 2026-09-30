# 📝 Local Notes

![Local Notes Screenshot](https://github.com/PsyGioX/localnotes/blob/main/sccc.png?raw=true)

[![Version](https://img.shields.io/badge/Version-1.11.1-brightgreen.svg)](https://github.com/PsyGioX/localnotes/releases)
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
| **Privacy by default** | Notes live in IndexedDB on your device, encrypted at rest under your master password. No backend, no analytics until consent, no cloud sync unless you export files yourself. |
| **Security you can verify** | Open-source client-side encryption (AES-256-GCM, `.note` format v5), DOMPurify sanitization, strict CSP, domain-bound `.note` files. |
| **Works everywhere** | PWA install, offline Service Worker cache, 12 UI languages, mobile keyboard handling, iOS safe-area support. |
| **Lightweight & fast** | A custom, dependency-free editor (one script, no build step, cached by the Service Worker) instead of a heavy WYSIWYG bundle; crypto runs in a Web Worker so the UI stays responsive. |
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
- **🔐 Encrypted vault / App Lock** — notes are encrypted at rest with a random AES-256 data key wrapped by your master password; optional access file and 12-word recovery phrase; idle lock after 10 min; 5 wrong attempts lock input for 60 s
- **🛡️ DOMPurify XSS protection** — all note content sanitized before rendering
- **🌍 12 languages** — full UI localization including all modals, buttons and error messages
- **📱 PWA** — install as a native app on any device; safe update flow without reload loops
- **⚡ LocalNotesEditor** — custom editor with no external dependencies: tables, code blocks, callouts, formulas, `[[wiki-links]]`, templates, Markdown mode
- **🎨 Drawing pad** — vector sketches inside notes: brushes, 30+ shapes, fill / fill colour, line styles, arrow heads, opacity, resize handles; drawings stay re-editable
- **🗃️ Task Board** — Kanban view of your notes
- **🧭 Onboarding tour** — step-by-step spotlight guide of the main toolbar
- **🗂️ Workspaces** — separate note collections in tabs (see [WORKSPACES_README.md](WORKSPACES_README.md))
- **🏷️ Tags & colors** — organize notes by topic with color labels
- **📅 Built-in calendar** — view notes by date (month / week / agenda)
- **🔄 Offline** — Service Worker caching + manual offline network mode toggle
- **📸 Note screenshots** — export a note card as PNG for sharing
- **✅ Smart checklists** — flat checkbox + input design, per-item customization (color, priority, label)
- **📋 11 editor templates** — meeting, project, report, brainstorm, lecture, flashcard, research, daily planner, weekly review, OKR goals, habit tracker
- **🕸️ Graph View** — interactive force-directed map of your wiki-links; drag, zoom, filter by workspace, highlight by search
- **🌐 Static site export** — package your notes into a self-contained, host-anywhere website (HTML/CSS/JS + search), zipped entirely client-side

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
await notesDB.saveNote(note);        // { id, content, creationTime, lastModified, title, tags?, dueDate?, color?, pinned?, workspaceId? }
await notesDB.saveNotePatch(patch);  // partial update on top of the stored note (keeps tags, pinned, colour, …)
await notesDB.getAllNotes();         // content with images inlined
await notesDB.getAllNotes({ light: true });  // no image bytes — use for lists, search, graph
await notesDB.getNote(id);           // also accepts { light: true }
await notesDB.deleteNote(id);

// Version history (last 20 kept per note)
await notesDB.saveVersion(noteId, content, savedAt);
await notesDB.getVersions(noteId);
await notesDB.deleteVersion(versionId);
await notesDB.pruneVersions(noteId, keep);

// Settings
await notesDB.saveSetting(key, value);
await notesDB.getSetting(key);
await notesDB.saveEncryptedSetting(key, value);
await notesDB.getEncryptedSetting(key);

// Encryption vault (see App Lock)
notesDB.vaultReady;                              // true when the data key is unlocked in memory
await notesDB.isVaultSetup();
await notesDB.setVaultCredential(slot, secret);  // slot: 'pin' | 'file' | 'recovery'
await notesDB.unlockVaultWithCredential(slot, secret);
await notesDB.removeVaultCredential(slot);       // the last remaining credential cannot be removed

await notesDB.migrateFromLocalStorage();
```

**IndexedDB schema:** database `LocalNotesDB` **v2** — object stores:

| Store | Key | Indexes | Holds |
|-------|-----|---------|-------|
| `notes` | `id` | `creationTime`, `lastModified`, `title` | Notes (content encrypted when the vault is set up) |
| `settings` | `key` | — | App settings, vault slots / wrapped keys, and image records (`img:<hash>`) |
| `noteVersions` | auto `id` | `noteId`, `savedAt` | Previous versions of a note |

Larger images are stored once, content-addressed, as `img:<hash>` records in `settings`; the note HTML keeps `<img src="cid:ln-<hash>">` (survives DOMPurify, never triggers a network request). `gcImages()` removes unreferenced records.

### Encryption (`window.encryption`)

Instance of `AdvancedEncryption` — Max-2026 pipeline with Web Worker fallback.

```javascript
// Encrypt / decrypt text (returns base64 payload or plaintext)
const encrypted = await encryption.encrypt(plainText, password);
const decrypted = await encryption.decrypt(encrypted, password);
```

- **Formats:** v5 (current, written by `encrypt`); v4, v3 and v2 are still readable (legacy)
- **Domain binding:** `.note` files only decrypt on `localnotes-three.vercel.app` (HKDF `info` includes the origin); `localhost` / `127.0.0.1` are accepted for local development
- **Worker:** heavy KDF/AES runs in `js/crypto-worker.js`; main thread fallback if the worker fails

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

The editor class itself (`insertImage()`, `insertVideo()`, `destroy()`, options such as `onWikiLinkSearch`, the drawing pad, …) is documented in [`localnoteseditor/README.md`](localnoteseditor/README.md).

### App Lock / encryption vault (`window.AppLock`)

`js/app-lock.js` is the unlock screen of the **encryption vault** — entering the right credential *is* how notes get decrypted, not a second check on top of them.

- A **master password** (min. 8 characters) is mandatory: a non-dismissable setup screen appears on first run, and `AppLock.ensureUnlocked()` is awaited by the boot sequence before notes load.
- Notes are encrypted at rest with a random AES-256 **data key**. The key is never stored as-is; it is wrapped once per unlock credential ("slot", each with its own PBKDF2-SHA-512 key, 600k iterations): `pin` (the password / PIN), `file` (optional access file) and `recovery` (optional 12-word phrase). Any enrolled slot unlocks the same notes.
- The master password **cannot be reset**. The recovery phrase is shown once when generated and never stored; generating a new one invalidates the old one.
- Idle timeout: 10 minutes. After 5 wrong attempts input is locked for 60 seconds (the counters are kept in `localStorage`, so a page reload does not reset them).

```javascript
AppLock.ensureUnlocked();  // shows setup / unlock screen if needed; resolves when the vault is open
AppLock.isUnlocked();      // true when the data key is in memory (same as notesDB.vaultReady)
AppLock.isEnabled();       // alias of isUnlocked()
AppLock.lockNow();         // lock immediately (alias: AppLock.lock())
AppLock.openSettings();    // open lock settings (add / change / remove unlock methods)
```

| Where | Key | Purpose |
|-------|-----|---------|
| IndexedDB `settings` | `vaultSlots`, `vaultSalt_<slot>`, `vaultWrapped_<slot>` | Enrolled slots, their salts and the wrapped data key |
| `localStorage` | `ln_lock_last_activity` | Idle timer anchor |
| `localStorage` | `ln_lock_failed_attempts`, `ln_lock_locked_until` | Rate limiting |

> Older versions of this document listed `ln_lock_pin_hash`, `ln_lock_file_hash`, `ln_lock_enabled` and `ln_lock_session`. The app no longer uses them.

### Graph View (`window.GraphView`)

```javascript
GraphView.open();     // open the graph
GraphView.close();    // close it
GraphView.toggle();   // open/close
```

### Static Site Export (`window.SiteExport`)

```javascript
await SiteExport.open();   // open the export dialog
```

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

Sources: `/locales/<lang>.json` (in-app strings, loaded by `js/i18n.js`) and `/locales/site/<lang>.json` (static landing-page strings) — see [`locales/README.md`](locales/README.md).

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
localStorage.getItem('ln_network_mode');  // 'online' | 'auto' | 'offline'
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

## 🔐 Encryption (v5)

Two layers use the same primitives: the **vault** (notes at rest, see App Lock) and exported **`.note` files**.

```
PASSWORD
  │
  ▼
PBKDF2-SHA-512 (600 000 iterations, 32-byte random salt) → 512 bits
  │
  ▼
HKDF-SHA-512 (info = origin binding) → 2 independent keys:
  K_aes  — AES-256-GCM  (encryption)
  K_mac  — HMAC-SHA-512 (integrity)
  │
  ▼
ENCRYPT:
  1. AES-256-GCM with a fresh 12-byte IV (K_aes)
  2. HMAC-SHA-512 over header + ciphertext (K_mac) — Encrypt-then-MAC
  3. Zeroize intermediate key material
```

**Format v5:** `magic "NV5\0"(4) | version(1) | salt(32) | iv(12) | hmac(64) | ciphertext`, base64-encoded. The HMAC covers the 49-byte header plus the ciphertext and is verified before anything is decrypted.

**Domain binding:** keys are cryptographically tied to `localnotes-three.vercel.app` via the HKDF `info` parameter, so `.note` files cannot be decrypted on another domain. `localhost` / `127.0.0.1` are treated as part of the same trust boundary so local development works.

**KDF cache key:** SHA-256(password + salt) — the password is never kept as a Map key.

**Legacy:** v4 (extra XOR-stream and block-shuffle layers, padding, canary bytes), v3 and v2 files are still readable. The v4 extra layers were dropped in v5 in favour of plain AES-256-GCM + HMAC-SHA-512.

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

### Encryption at rest
- Notes are stored encrypted (AES-256-GCM) once the vault is set up; the data key only lives in memory while the app is unlocked
- Static-site exports and HTML/Markdown exports are **plaintext** by design

### Cryptographic IDs
- Note IDs generated with `crypto.getRandomValues()` — not `Math.random()`
- Worker message IDs use CSPRNG
- Timing jitter uses CSPRNG (anti-timing attacks)

### Service Worker
- `message` event validates source origin against allowlist before processing

---

## ✨ Features

### 📝 Editor (LocalNotesEditor)
- One dependency-free script (`localnoteseditor/core.js`, no build step) — replaced TinyMCE; see [`localnoteseditor/README.md`](localnoteseditor/README.md)
- Rich formatting: headings, lists, tables, links, blockquotes, code blocks with syntax highlighting, callout boxes
- Media: images (drag & drop), videos (YouTube, Vimeo, Twitch, Rutube, VK, TikTok)
- Interactive checklists, emoji picker, special characters, date/time
- **Formulas** — native MathML, editable in place
- **Drawing pad** — brush types (pen, marker, pencil, calligraphy, spray, dotted), eraser, 30+ shapes; per-object fill and fill colour, line style (solid / dashed / dotted), arrow heads, opacity, *Keep proportions*, resize handles and a Move tool that edits the selected object; drawings are stored as vector data and reopen with a double-click
- Find & Replace, word/character statistics, show blocks, HTML source view
- Text color & highlight with live caret color sync
- Fullscreen (F11) and focus mode (F12), Undo/Redo (Ctrl+Z / Ctrl+Y), keyboard shortcuts reference (Ctrl+/), Quick Insert menu (`/`)
- Markdown mode, Markdown/HTML import and export
- Quick Edit mode directly in the notes list
- **Custom templates** — save any note as a reusable template with icon/category, `{{date}}`/`{{time}}`/`{{weekday}}` variables, JSON export/import

### ⌨️ Command Palette
- `Ctrl+K` / `⌘K` — new note, calendar, task board, view toggle, theme, lock now, graph view, publish as static site
- Instant search across note titles and content
- Respects App Lock — disabled while the app is locked

### 🕸️ Graph View
- **Toolbar button** next to Toggle View / Tasks / Lock, plus a Command Palette entry — reachable without knowing any shortcut, on the root page and every localized `/xx/` page (mounted by JS at load time, so the 12 duplicated locale HTML files didn't each need editing)
- Force-directed layout of every wiki-link (`[[...]]`) connection between notes — built from the same chip markup that already powers Backlinks, no separate index to maintain
- Drag nodes to pin them, scroll to zoom, click a node to open that note
- Filter to the current workspace or all notes; toggle unlinked ("orphan") notes on/off; type to highlight a note by title
- Zero new dependencies — the simulation is a compact vanilla-JS force layout, rendered on `<canvas>`

### 🌐 Static Site Export
- **Toolbar button** (same placement/visibility as above) plus a Command Palette entry
- Turns your notes into a portable, self-contained website — `index.html` + `style.css` + `app.js` + `notes.json`, with built-in transliteration search
- Packaged as a real `.zip`, written entirely client-side: no library added, the same zero-dependency approach as the Notion/Keep import, mirrored for writing (`CompressionStream('deflate-raw')` + a hand-rolled Local File Header / Central Directory / EOCD writer)
- Filter by workspace, exclude specific tags, or export pinned-only, before generating
- Host it anywhere static (GitHub Pages, Vercel, Netlify) or just open `index.html` locally
- The output is **plaintext** HTML, even though notes are encrypted at rest inside the app — the dialog warns about this; exclude anything sensitive before sharing

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

All 12 languages (EN, RU, UA, PL, CS, SK, BG, HR, SR, BS, MK, SL) have complete translations — 864 in-app keys and 223 static-site keys per language, checked by `node scripts/verify-locales.js`. Covered areas include:

- Main UI (buttons, titles, messages)
- Vault / App Lock screens, Decrypt Note modal and import errors
- Calendar, Note Settings, Task Board, Graph View, Command Palette
- Editor toolbar, dialogs, templates and the drawing pad
- All policy pages

Strings live in `/locales/<lang>.json` (in-app) and `/locales/site/<lang>.json` (static pages). `js/i18n.js` loads only English (fallback) plus the current language; text is read with `window.t(key)`. Full details: [`locales/README.md`](locales/README.md).

---

## 🏗️ Architecture

### File Structure

```
localnotes/
├── index.html / beta.html          # Main page (EN) and beta page
├── manifest.json                   # PWA manifest (share_target, shortcuts)
├── sw.js                           # Service Worker (precache, network modes, origin validation)
├── vercel.json / robots.txt / sitemap*.xml
├── privacy_policy.html / usage_policy.html / cookie_policy.html / cookie.html
├── README.md / README_RU.md / WORKSPACES_README.md / release-checklist.md
│
├── css/                            # index, adaptive, apple, page, print, highlight, modal-system,
│                                   # editor-modal, app-lock, action-bar, sidebar, tags-calendar,
│                                   # task-board, workspaces, onboarding-tour, screenshot, scroll-top, img
│
├── js/
│   ├── index.js                    # App logic, NotesDatabase (IndexedDB + vault), encryption v5, import/export
│   ├── app-lock.js                 # Encryption vault unlock UI, recovery phrase, idle lock
│   ├── crypto-worker.js            # PBKDF2 / AES work off the main thread
│   ├── security.js                 # SecurityManager (clickjacking) + SecureStorage
│   ├── purify.min.js               # DOMPurify — XSS sanitization (local, no CDN)
│   ├── i18n.js                     # window.t() — loads /locales/<lang>.json
│   ├── translate.js                # Language detection & switching (window.changeLanguage)
│   ├── editor-integration.js       # Creates LocalNotesEditor, wiki-link hooks, mobile keyboard layout
│   ├── markdown.js                 # Markdown <-> HTML, live Markdown mode, smart paste
│   ├── import-formats.js           # Import from Notion / Evernote / Google Keep
│   ├── tags-calendar.js            # Tags system + calendar
│   ├── task-board.js               # Kanban task board
│   ├── sidebar.js                  # Collapsible notes sidebar
│   ├── action-bar.js               # Collapsible toolbar segment (view / tasks / lock / graph / publish)
│   ├── command-palette.js          # Ctrl+K palette
│   ├── graph-view.js               # Graph View (wiki-link force-directed map)
│   ├── site-export.js              # Static site export (client-side zip writer)
│   ├── screenshot.js               # Note card → PNG
│   ├── share-target.js             # Web Share Target / shortcut entry points
│   ├── workspaces.js / workspaces-integration.js   # Workspaces manager + hooks
│   ├── onboarding-tour.js          # Step-by-step toolbar tour
│   ├── network-mode.js             # Online / Auto / Offline toggle → Service Worker
│   ├── pwa.js                      # SW registration + update toast
│   ├── themes.js / utils.js / selectors.js / date-utils.js / img.js / scroll-top.js
│   ├── performance.js / preloader.js
│   ├── script-loader.js / page-init.js / lang-redirect.js / ga-init.js   # CSP-safe bootstrap scripts
│   └── highlight.min.js            # Code highlighting
│
├── locales/                        # <lang>.json (in-app) and site/<lang>.json (static pages); README.md
├── scripts/verify-locales.js       # Checks every language has the same keys
│
├── localnoteseditor/               # Editor: core.js, styles.css, bootstrap-icons/, docs (*.md)
├── cookies_banner_universal/       # GDPR cookie banner (Consent Mode v2) + README
├── landing/                        # Static multilingual landing pages
├── fonts/ favicon/ resources/
│
└── [lang]/                         # ru, ua, pl, cs, sk, bg, hr, sr, bs, mk, sl
    ├── index.html / beta.html
    └── privacy_policy.html / usage_policy.html / cookie_policy.html
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS ES6+, HTML5, CSS3 |
| Editor | LocalNotesEditor (custom, no deps) |
| Storage | IndexedDB (`LocalNotesDB` v2), encrypted at rest |
| Encryption | Web Crypto API — AES-256-GCM + HMAC-SHA-512 + PBKDF2-SHA-512 |
| XSS Sanitization | DOMPurify (local) |
| PWA | Service Worker + Web App Manifest |
| Analytics | Google Analytics with Consent Mode v2 |
| Icons | Bootstrap Icons |

### Data Flow

1. **Init** → language detection → theme → editor init
2. **Create note** → LocalNotesEditor → IndexedDB
3. **Render note** → `DOMPurify.sanitize(content)` → `innerHTML`
4. **Export** → PBKDF2 → HKDF → AES-256-GCM + HMAC-SHA-512 (v5) → `.note` file download
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

> **Note:** encrypted `.note` files are domain-bound to `localnotes-three.vercel.app`: they cannot be decrypted on other (clone) domains. `localhost` / `127.0.0.1` are accepted for development and use the same binding, so a `.note` file from the production site opens locally and vice versa.

### Install as PWA
Click the install icon in Chrome/Edge address bar and confirm.

---

## 🆕 Changelog

### v1.11.1 (current)
- **🎨 Drawing pad — parameters for finished shapes.** With the **Move** tool, the option panel now edits the *selected* object (colour, size, fill, fill colour, line style, arrow heads, opacity); one undo step per edit
- **✨ New drawing parameters** — separate **fill colour**, **line style** (solid / dashed / dotted), **arrow heads** (end / both ends), **opacity** (10–100 %, translucent objects are composited as a whole)
- **✨ Resize handles** on the selected object; **Keep proportions** (or Shift) preserves the aspect ratio while resizing; lines and arrows snap to 45°, and *Keep proportions* now also applies to them while drawing
- **🌍 12 languages** — 10 new strings for the above (864 keys per language)
- **📚 Documentation refreshed** — encryption section now describes format v5 and the vault / App Lock (recovery phrase, slots, rate limit); IndexedDB v2 schema (`noteVersions`, image records); locales moved to `/locales`; editor docs rewritten to match the real API and current file sizes; removed references to deleted files (`js/translations.js`, `json/lang.json`, `js/workspaces-translations.js`, `js/magicurl.js`)

### v1.11.0
- **🗑️ Sync Nearby removed** — the WebRTC-based device-to-device sync feature (and its QR-code pairing path, `js/lan-sync.js` + `js/qrcode.js`) has been removed, along with its toolbar button and Command Palette entry

### v1.10.1
- **🐛 Graph View** — a single click now opens a note (matching the on-screen hint), instead of an undocumented double-click that could open the wrong note (or a blank new one) if the simulation moved nodes between the two clicks. Click-vs-drag is now disambiguated by movement/time thresholds on the exact node the pointer went down on
- **🎨 Toolbar buttons** — Graph View / Publish as static site now join the existing Toggle View / Tasks / Lock segmented control (`css/action-bar.css`) instead of keeping a separate pill-button look, and collapse along with it when the bar is minimized
- **✏️ Renamed** "Export as static site" → **"Publish as static site"**, since the app already has a per-note "Export" button — the two were easy to confuse
- **🔗 Static site export** — the generated site's footer now links "Local Notes" back to the live app
- **🎨 Checkboxes** — App Lock's acknowledgement checkboxes now use the same custom checkbox as the rest of the app (`.tbl-cb`-style), instead of the bare native control
- **⚠️ Sync Nearby** — shows a clear in-app notice (instead of only a console error) when a direct connection can't be opened, or when the app's encryption module isn't available to secure pairing

### v1.10.0
- **✨ Graph View** — new command-palette action opens an interactive force-directed graph of every wiki-link connection between notes. Reuses the existing `data-note-id` chip markup (same one `findBacklinks()` already scans), so there's nothing new to migrate. Drag to pin nodes, scroll to zoom, filter by workspace, toggle orphan notes, highlight by title — rendered on `<canvas>` with a small hand-written force layout, no charting library added
- **✨ Sync Nearby** — direct device-to-device note sync, paired via a one-time copy-paste code instead of a sync server or account. Diffs by `lastModified` and transfers only what the other side needs; every message is additionally encrypted with the app's existing AES-256-GCM pipeline, keyed on a random secret carried inside the pairing code itself
- **✨ Static site export** — package the current workspace (or all notes) into a portable static website with built-in search, download it as a real `.zip` built entirely client-side (own CRC32 + `CompressionStream('deflate-raw')` + Local File Header/Central Directory/EOCD writer — same zero-dependency approach already used for zip *reading* on Notion/Keep import, now mirrored for writing). Options to scope by workspace, exclude tags, or export pinned-only; the dialog is upfront that the output is plaintext HTML, since App Lock doesn't encrypt note content at rest

### v1.9.9
- **✨ Network mode expanded** — new **Auto** option alongside the existing Online/Offline toggle, following real connectivity (`navigator.onLine` + online/offline events) and switching the service worker to cache-only the instant the device actually loses connection, no manual flipping needed
- **🎨 Toggle redesigned** — 3-way segmented control with a sliding highlight, plus a live connectivity status dot independent of the selected mode (so "Online" mode with no actual signal is visibly distinguishable from "Online" mode that's actually connected)
- **✨ Import from Notion, Evernote, Google Keep** — new source options in the import dialog:
  - **Notion** — Markdown/HTML export `.zip` (or loose `.md`/`.html` files), strips Notion's page-id suffixes from titles
  - **Evernote** — `.enex` files, parses every note in the export with original created/modified timestamps preserved
  - **Google Keep** — Google Takeout `.zip` (or loose `Keep/*.json`), checklists convert to the app's native checklist format, pinned notes stay pinned
  - No external ZIP library added — a minimal ZIP reader (End of Central Directory + Central Directory + Local File Headers) built on the native `DecompressionStream('deflate-raw')` API keeps this in line with the app's zero-dependency approach
  

### v1.9.8
- **✨ Advanced search operators** — `is:pinned|overdue|today|soon`, `has:image|video|table|checklist|link`, `before:YYYY-MM-DD`, `after:YYYY-MM-DD`, combinable with `#tag` and free text
- **✨ Version history** — every save of an existing note snapshots its previous content (only when it actually changed); browse, restore, or delete past versions from Note Settings — last 20 kept per note
- **✨ Web Share Target wired up** — manifest already declared `share_target` and shortcut actions, but nothing read them; sharing text/links to Local Notes from other apps (or using the Home Screen shortcuts) now actually opens a pre-filled new note / focuses search / opens import, instead of silently doing nothing
- **✨ Share button** — the note-card toolbar (Edit/Delete/Export/Screenshot) now has a Share button too, using `navigator.share()` to hand the note's title + text off to the OS share sheet, with a clipboard-copy fallback where the Web Share API isn't available. The natural counterpart to Share Target above — the app can now send as well as receive
- **🐛 Fixed missing/inconsistent delete confirmation** — the main notes list deleted a note immediately with no confirmation at all; the task board fell back to the browser's unstyled native `confirm()` because `showConfirmModal` was never exported to `window`. Both now use the same styled confirmation modal as the rest of the app
- **➖ Reminders removed** — the Notification-API due-date reminders shipped earlier in this cycle were removed after reconsideration; the app doesn't have a server, so they could only ever be foreground-only reminders (checked while the tab was open), and that scope didn't earn its complexity. May return in a different shape later

### v1.9.7
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

### v1.9.6
- **🔐 App Lock** — PIN and/or access file, idle lock (10 min), lock screen with mobile-friendly layout
- **🔌 API documentation** — full `window.*` API reference in README (notesDB, encryption, AppLock, TagsCalendar, SW messages)
- **🔔 PWA update flow fixed** — no infinite “Update available” toast; `SKIP_WAITING` before reload
- **🎨 Lock screen UI** — green top accent clipped to panel border-radius; removed redundant “App locked” toast

### v1.9.4
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

**Why can't I decrypt a `.note` file on another website?**
`.note` files are cryptographically bound to `localnotes-three.vercel.app` via HKDF domain binding. This is intentional — it prevents decryption on clone domains. (`localhost` / `127.0.0.1` are allowed for local development.)

**How to move notes to another browser?**
Export to `.note` file, then import at [localnotes-three.vercel.app](https://localnotes-three.vercel.app/).

**How to add a new language?**
Add `locales/<lang>.json` and `locales/site/<lang>.json` with exactly the same keys as `en.json` (run `node scripts/verify-locales.js`), create a `[lang]/` folder with the HTML pages, and add the code to `supportedLanguages` in `js/translate.js` and to the list in `sw.js`.

**How does App Lock work?**
It is the unlock screen of the encryption vault. You create a master password (min. 8 characters) on first run; you can add an access file and a 12-word recovery phrase as extra ways in. The app locks on a new browser session and after 10 minutes idle; 5 wrong attempts block input for 60 seconds.

**I forgot my master password — can my notes be recovered?**
Only with the recovery phrase (if you generated and saved one) or another enrolled unlock method such as the access file. Otherwise they are permanently unreadable — there is no server to reset from.

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
