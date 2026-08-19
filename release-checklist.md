# Release Checklist — Local Notes v1.9.9

## ✅ Security / CSP
- [x] `unsafe-inline` removed from `script-src` and `script-src-elem`
- [x] Inline GA scripts moved to `js/ga-init.js`
- [x] Inline `loadScriptsSequentially` moved to `js/script-loader.js`
- [x] Inline lang-redirect script moved to `js/lang-redirect.js`
- [x] Inline styles-loading + cache cleanup moved to `js/page-init.js`
- [x] `onload=` event handlers on `<link>` tags replaced with JS loader
- [x] `ga-init.js` uses `addEventListener('load')` instead of `s.onload =`
- [x] `onclick=` in JS template strings replaced with `addEventListener`
- [x] `ga-init.js` placed after CSP meta tag in all HTML files
- [x] DOMPurify hard-fail guard added to `index.js`
- [x] All `typeof DOMPurify !== 'undefined' ? ... : content` fallbacks removed
- [x] Applied to all 11 language index.html files

## ✅ Checklist — New Design
- [x] Flat `div.cl-item` with `input.cl-text` + `input[type=checkbox].cl-cb`
- [x] `contenteditable=false` on item — no nested contenteditable issues
- [x] Enter creates new item, Backspace on empty removes item
- [x] Customization panel: color (7 swatches), priority (none/low/mid/high), label tag
- [x] Color accent applied to border-left + background tint + checkbox border
- [x] Priority: high=red, mid=yellow, low=blue border
- [x] Tag badge rendered via `::after` with accent color
- [x] `cl-opts-btn` always visible on touch devices (`@media (hover: none)`)
- [x] Panel positions within viewport (flips up if no space below)
- [x] `_snapEncode` syncs `input.value` → `setAttribute('value')`
- [x] `getContent()` calls `_cleanForSave()` — strips `data-cl-bound` and `cl-opts-btn`
- [x] `_snapDecode` clears `data-cl-bound` for re-init on undo/redo
- [x] `_initChecklists` adds missing `cl-opts-btn` and restores `inp.value`
- [x] Legacy `.checklist-item-wrapper` migrated to `.cl-item` on load
- [x] `cl-opts-btn` removed from note cards in `loadNotes`
- [x] `syncClInputs()` called before every `innerHTML` read for saving
- [x] `blur` handler on `cl-text` in note cards saves to DB

## ✅ Editor Templates
- [x] 11 templates: meeting, project, report, brainstorm, lecture, flashcard, research, daily, weekly, goals, habit
- [x] Template row in toolbar: horizontal scroll, no wrap
- [x] Mobile: icon-only buttons (text hidden), larger tap targets
- [x] All template content strings use `this._('key', 'fallback')`
- [x] All 12 languages have full template content translations
- [x] Date formatted in current app locale

## ✅ i18n
- [x] Checklist customization: color, priority, label, delete — all 12 languages
- [x] Template button labels — all 12 languages
- [x] Template content strings — all 12 languages
- [x] PWA update toast text — all 12 languages

## ✅ Note Priority Styles
- [x] `note[data-color]` — gradient background tint + top accent bar (`::before`)
- [x] Hover glow in accent color
- [x] Overdue/today/soon use `!important` to override user color
- [x] `::before` top bar overridden for priority states
- [x] `note-due-badge` — larger font, bolder weight, glow on overdue/today
- [x] Color swatches in Note Settings — 30px, active state with inner dot

## ✅ PWA Update Notification
- [x] `registration.waiting` check — shows toast if SW already waiting
- [x] `controllerchange` listener — auto-reload after SW activation
- [x] Toast text via `t()` with fallback
- [x] SW registered without version query string (`/sw.js`)

## ✅ Bug Fixes
- [x] Infinite redirect loop on language pages fixed (lang-redirect removed from lang pages)
- [x] English version infinite reload fixed (localStorage cleared on English)
- [x] Checklist cursor visible on empty input (`min-height`, `caret-color`)
- [x] `script-loader.js` uses `readyState` check — no DOMContentLoaded race
- [x] `page-init.js` removes `styles-loading` via DOMContentLoaded

## 🔄 Pre-Release
- [ ] Test on Chrome, Firefox, Safari, Edge
- [ ] Test on iOS Safari and Android Chrome
- [ ] Test PWA install and update flow
- [ ] Test import/export encrypted notes
- [ ] Test all 12 language versions
- [ ] Test checklist: create, customize, save, reopen, edit
- [ ] Test templates in all languages
- [ ] Verify note color + priority display
- [ ] Check offline mode after SW install
- [ ] Update version in `manifest.json` and `sw.js`

## 📊 Performance Targets
- LCP < 2.5s
- FID < 100ms
- CLS < 0.1

## 🔒 Security
- [x] CSP: no `unsafe-inline` in script-src
- [x] DOMPurify hard-fail (throws if not loaded)
- [x] AES-256-GCM + HMAC-SHA-512 + PBKDF2-SHA-512 (600k iter)
- [x] Domain binding via HKDF
- [x] CSPRNG for all IDs

## 🌐 Languages
- [x] EN, RU, UA, PL, CS, SK, BG, HR, SR, BS, MK, SL
- [x] All new UI strings translated in all 12 languages

---

**Status**: Ready for testing ✅
