# Release Checklist — Local Notes v1.11.1

Copy this file's unchecked items into the release PR. Items under **Baseline** describe guarantees that earlier releases established and every release must keep.

## 1. Version bump (do all of these together)

- [ ] `sw.js` → `CACHE_VERSION` (new value invalidates the static cache, including `/locales/*.json`)
- [ ] `?v=x.y.z` on every changed asset in `index.html`, `beta.html` and every `[lang]/index.html` (`../localnoteseditor/core.js`, `styles.css`, `css/*.css`, …)
- [ ] `?v=x.y.z` entries in `js/script-loader.js` for changed scripts
- [ ] `README.md` version badge + changelog entry (`README_RU.md` mirrors it)
- [ ] `localnoteseditor/package.json` version + `localnoteseditor/CHANGELOG.md` if the editor changed
- [ ] `name` in `manifest.json`, `ua/manifest.json`, `pl/manifest.json` (optional, see note)
- [ ] `sitemap*.xml` / `indexnow.txt` if pages were added

> The manifests carry the version only inside their `name` string (currently "… v1.9.19"); update it if you want the installed-app name to show the release.

## 2. Automated / scripted checks

- [ ] `node scripts/verify-locales.js` — 12 languages, 864 in-app keys and 223 site keys each, no gaps, no empty values
- [ ] `core.js` parses without errors (`node -e "new Function(require('fs').readFileSync('localnoteseditor/core.js','utf8'))"`)
- [ ] No references to deleted files: `js/translations.js`, `js/workspaces-translations.js`, `json/lang.json`, `js/magicurl.js`, `js/lan-sync.js`, `js/qrcode.js`
- [ ] Documentation matches the code (README, `localnoteseditor/*.md`, `locales/README.md`, `WORKSPACES_README.md`, `cookies_banner_universal/README.md`)

## 3. Manual testing

**Browsers / devices**
- [ ] Chrome, Firefox, Safari, Edge
- [ ] iOS Safari and Android Chrome (virtual keyboard, safe areas)
- [ ] PWA install, update toast, auto-reload after `SKIP_WAITING`
- [ ] Offline after the Service Worker installed; Online / Auto / Offline network modes

**Vault / App Lock**
- [ ] First run: master password setup is non-dismissable, ≥ 8 characters, acknowledgement checkbox required
- [ ] Unlock with password, with access file, with recovery phrase; regenerating the phrase invalidates the old one
- [ ] 5 wrong attempts → 60 s lock that survives a reload
- [ ] Idle lock after 10 minutes; last remaining credential cannot be removed
- [ ] Existing pre-vault (plaintext) notes are migrated after the first credential is created

**Notes / editor**
- [ ] Create / edit / delete, version history restore, tags, due dates, pinning, workspaces
- [ ] Checklist: create, customise (colour, priority, label), save, reopen, edit
- [ ] Templates (built-in and custom) in several languages
- [ ] Formulas, callouts, code blocks, tables, videos, `[[wiki-links]]` and backlinks
- [ ] Markdown mode round trip (formulas, callouts, drawings pass through unchanged)

**Drawing pad**
- [ ] Draw every tool: brush types, eraser, rectangle/ellipse/triangle/line/arrow and a few library shapes
- [ ] Fill on/off, separate fill colour, "same as line colour" button
- [ ] Line style solid / dashed / dotted; arrow heads end / both ends
- [ ] Opacity < 100 %: strokes that cross do not get darker; eraser unaffected
- [ ] Move tool: select an object → panel shows its values; changing colour / size / fill / style / opacity edits that object; a slider drag is one undo step
- [ ] Resize handles (corners, edges, line end points); Keep proportions and Shift preserve the aspect ratio
- [ ] Insert, save the note, reopen, double-click the drawing → objects and parameters are restored
- [ ] Old drawings (made before these parameters existed) open unchanged
- [ ] Touch: draw, select, resize with a finger; narrow layout panel scrolls

**Import / export**
- [ ] Encrypted `.note` export → import (same browser and another browser), wrong password and wrong-domain messages
- [ ] HTML / Markdown export and import; Notion, Evernote, Google Keep imports
- [ ] Publish as static site: the `.zip` opens and search works
- [ ] Share button and Web Share Target / Home Screen shortcuts

**Languages**
- [ ] All 12 language versions load and switch (UI, policy pages, calendar names)

## 4. Baseline (must stay true)

**Security / CSP**
- [x] `script-src` / `script-src-elem` allow only `'self'` and Google Analytics hosts (no `unsafe-inline`, no `unsafe-eval`); inline scripts live in `ga-init.js`, `script-loader.js`, `lang-redirect.js`, `page-init.js`
- [x] DOMPurify (local copy) hard-fails if missing; no unsanitised fallbacks; all imported HTML is sanitised
- [x] No inline event handlers (`onclick=` etc.) in HTML or JS templates
- [x] Notes encrypted at rest (AES-256-GCM data key wrapped per unlock credential); `.note` format v5: PBKDF2-SHA-512 (600k) → HKDF-SHA-512 → AES-256-GCM + HMAC-SHA-512, domain-bound
- [x] CSPRNG for all IDs; Service Worker validates message origins
- [x] Analytics stay disabled (Consent Mode v2 `denied`) until consent

**i18n**
- [x] Every new UI string exists in all 12 languages (`locales/*.json`)

**PWA**
- [x] SW registered as `/sw.js` (no query string); waiting-worker toast; `controllerchange` reload

## 5. Performance targets

- LCP < 2.5 s
- INP < 200 ms (FID < 100 ms)
- CLS < 0.1

## 6. Languages

EN, RU, UA, PL, CS, SK, BG, HR, SR, BS, MK, SL
