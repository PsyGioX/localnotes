# LocalNotesEditor — Implementation Summary

## What It Is

A custom, dependency-free rich text editor (one ES6 class, `LocalNotesEditor`) built as a drop-in replacement for TinyMCE in Local Notes. It started as a ~15 KB editor; it has since grown into a full-featured one, so the file sizes below are the current ones.

## Footprint vs TinyMCE

| Metric | TinyMCE | LocalNotesEditor |
|--------|---------|-----------------|
| Script | 500 KB+ (minified, plus plugins) | ~340 KB `core.js` (un-minified, includes all features) |
| Styles | separate skins | ~120 KB `styles.css` |
| Dependencies | Multiple | None (Bootstrap Icons font is bundled) |
| Build step | Yes | None |

The editor is cached by the Service Worker after the first load, so the size matters once, not per visit.

## Features Implemented

**Text**
- Bold, italic, underline, strikethrough, super/subscript, clear formatting
- Paragraph styles (Normal, H1–H6, Preformatted, Blockquote), font family and size
- Text colour and highlight with live toolbar/caret sync
- Alignment, indent/outdent, ordered/unordered lists, interactive checklists (colour, priority, label per item)

**Insert**
- Links, `[[wiki-links]]` to other notes (autocomplete supplied by the host app)
- Images (file picker, drag & drop), videos (YouTube, Vimeo, direct URL and other embeds)
- Tables with a context toolbar, horizontal rule, date/time, emoji, special characters
- Code blocks with syntax highlighting, blockquotes, callout boxes (Note / Tip / Warning / Important)
- Formulas — native MathML with a small text-syntax parser, editable in place
- **Drawing pad** — vector sketches (brush types, 30+ shapes, fill, line styles, opacity, resize) that can be re-opened and edited later (see README → "Drawing pad")
- Templates: 11 built-in (business, study, planning) + user-created templates with `{{date}}` / `{{time}}` / `{{weekday}}` variables, JSON export/import
- Slash "Quick Insert" menu

**Workflow**
- Find & Replace, word/character statistics, status bar
- Show blocks, HTML source view, focus mode (F12), fullscreen (F11)
- Keyboard-shortcuts reference (Ctrl+/) and hover tooltips that show each button's shortcut
- Undo/Redo (up to 300 snapshots; reset on `setContent()`)
- Smart paste cleanup
- Responsive layout (desktop, tablet, mobile), dark/light themes through CSS custom properties
- i18n through `window.t(key)` with English fallbacks

## Integration

```html
<div id="editorContainer" class="lne-editor-wrapper"></div>

<link rel="stylesheet" href="/localnoteseditor/styles.css">
<link rel="stylesheet" href="/css/editor-modal.css">
<script src="/localnoteseditor/core.js" defer></script>
<script src="/js/editor-integration.js"></script>
```

In the app these scripts are loaded in a fixed order by `js/script-loader.js`.

## API (via editor-integration.js)

```javascript
window.localNotesEditorAPI.getContent();
window.localNotesEditorAPI.setContent(html);
window.localNotesEditorAPI.getInstance();   // raw LocalNotesEditor
```

## Status

✅ Production. Deployed in Local Notes. Current editor version: 1.2.3.
