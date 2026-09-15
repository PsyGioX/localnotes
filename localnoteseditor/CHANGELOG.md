# LocalNotesEditor — Changelog

## v1.2.2

### Fixes
- Markdown mode (`js/markdown.js`) reset callout boxes and formulas to plain unstyled text — it had no rule for these custom elements and silently unwrapped them to their bare text content. They're now passed through as raw HTML verbatim in both directions (HTML→Markdown and back), so switching a note into Markdown mode and back no longer loses them. Also fixes the same silent loss for video embeds and code-block chrome.
- HTML source view now pretty-prints with indentation instead of one unreadable line (own small DOM-walking formatter, `<pre>`/`<code>` content left byte-for-byte untouched); the added indentation is stripped back out on Apply so it never leaks a stray space into the saved note

## v1.2.1

### Fixes
- `Ctrl+Shift+Space` (non-breaking space) was being swallowed by the existing `Ctrl+Space` "Quick Insert" slash-menu shortcut, which didn't check for the Shift modifier — pressing Ctrl+Shift+Space opened the quick-insert menu instead of inserting a non-breaking space
- Formulas rendered too small in the editor (sub/superscripts especially) — bumped the base MathML font-size

## v1.2.0 (current)

### Fixes
- **Cursor trapped in blocks** — reopening a note whose last block was a video embed, code block, table, callout or blockquote (or inserting a video mid-session) left no line to click/arrow into below it, because these are `contenteditable="false"` atoms or nested contenteditable "islands" that a plain Enter/click can't escape. `_ensureBlockSpacing()` now guarantees a trailing empty paragraph after any such block, run on every content load/insert (`_initAll()`), so existing notes are healed the moment they're reopened.

### New Features (inspired by a TinyMCE Free feature review — see project README)
- **Formula insertion** — a small hand-written parser (no MathJax/KaTeX) converts a readable text syntax (`a/b`, `x^2`, `sqrt(x)`, `sum_(i=1)^n`, `pi`, `<=`, `->`, …) into native MathML, rendered by the browser with zero added weight. Ships with 10 ready-made examples (quadratic formula, Pythagorean theorem, Euler's identity, etc.) plus a custom builder with live preview; double-click any inserted formula to edit it
- **Callout blocks** — Note / Tip / Warning / Important boxes with a one-click type switcher, going beyond what TinyMCE Free itself offers
- **Show blocks** — CSS-only outline of paragraph/heading/list/div boundaries (port of TinyMCE's `visualblocks`)
- **HTML source view** — read/hand-edit a note's raw HTML (port of TinyMCE's `code` plugin)
- **Insert date/time** — locale-aware current date/time at the caret (port of TinyMCE's `insertdatetime`)
- **Non-breaking space** — `Ctrl+Shift+Space` (port of TinyMCE's `nonbreaking`)

### Style polish
- Consistent margin-collapse fix (no stray blank strip at top/bottom of a note)
- Brand-matched text selection color
- Nested blockquote styling
- Softer strikethrough so it doesn't visually compete with checklist "done" text

## v1.1.0

### New Features
- **Text color sync** — toolbar color bar updates when cursor moves into colored text
- **Highlight color sync** — same for background color
- **Caret color sync** — `caret-color` updates to match current text color
- **Paragraph styles i18n** — Paragraph, Heading 1–6, Preformatted, Blockquote translated via `window.t()`
- **Font/size placeholder i18n** — Font and Size selects use translated placeholders
- **Select auto-width** — selects use `min-width`/`max-width` instead of fixed width, fits translated labels

### Fixes
- **History on new note** — `setContent()` now resets undo/redo stack; statusbar shows 0 on open
- **History removed from statusbar** — only Words and Characters shown
- **Editor modal full height** — flex layout fills modal, no empty space at bottom
- **Green border position** — `position: relative` on `.modal-content` fixes `::before` floating to page top
- **`t()` array crash** — translation function returns arrays as-is (months, weekdays)

### Improvements
- Toolbar color bars have smooth CSS transition
- Highlight bar shows dashed border when no color set
- `_colorBars()` correctly manages border on highlight bar

---

## v1.0.0 (initial release)

### Features
- Rich text formatting (bold, italic, underline, strikethrough)
- Font size and font family selection
- Ordered and unordered lists
- Interactive checklists with checkboxes
- Image insertion and drag-drop
- Video embedding (YouTube, Vimeo, direct URLs)
- Hyperlink creation
- Blockquotes and code blocks
- Text alignment
- Undo/redo with keyboard shortcuts
- Smart paste handling
- Word and character count statusbar
- Responsive design
- Dark mode support
- Find & Replace
- Emoji and special characters pickers
- Tables with context toolbar
- Floating selection toolbar
- Fullscreen mode
- i18n via `window.t(key)` with fallback

### Architecture
- Single class `LocalNotesEditor`
- No external dependencies
- Bootstrap Icons (bundled)
- CSS custom properties for theming
- Modular methods, easy to extend
