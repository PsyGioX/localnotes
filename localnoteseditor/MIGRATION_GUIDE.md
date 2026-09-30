# Migration from TinyMCE to LocalNotesEditor

LocalNotesEditor replaced TinyMCE in Local Notes v1.1.0. Migration is complete — this document is kept for reference.

## What Changed

### Files

| Old (TinyMCE) | New (LocalNotesEditor) |
|---------------|----------------------|
| `/editor_news/tinymce.min.js` | `/localnoteseditor/core.js` |
| `/css/tinymce-custom.css` | `/localnoteseditor/styles.css` |
| `/js/tinymce-translations.js` | `/locales/<lang>.json` (loaded by `js/i18n.js`, read through `window.t()`) |

> Earlier revisions of this guide pointed to `js/translations.js`. That file, `js/workspaces-translations.js` and `json/lang.json` no longer exist — all strings live in `/locales`. See `locales/README.md`.

### HTML

```html
<!-- Old -->
<textarea id="editorContainer" class="tinymce"></textarea>

<!-- New -->
<div id="editorContainer" class="lne-editor-wrapper"></div>
```

### JavaScript API

```javascript
// Old
tinymce.get('editorContainer').getContent()
tinymce.get('editorContainer').setContent(html)

// New
localNotesEditorAPI.getContent()
localNotesEditorAPI.setContent(html)
// or on the raw instance:
localNotesEditorAPI.getInstance().getContent()
```

### Compatibility layer

`js/editor-integration.js` creates the editor on page load, wires the wiki-link callbacks (`onWikiLinkSearch` / `onWikiLinkOpen`) and exposes:

```javascript
window.localNotesEditorAPI = {
  getContent, setContent, getText, clear, destroy,
  isInitialized, focus, undo, redo, getInstance
};
```

## Feature Comparison

| Feature | TinyMCE | LocalNotesEditor |
|---------|---------|-----------------|
| Rich formatting | ✓ | ✓ |
| Lists & checklists | ✓ | ✓ (custom checklist with colour / priority / label) |
| Images & videos | ✓ | ✓ |
| Tables | ✓ | ✓ |
| Links | ✓ | ✓ (plus `[[wiki-links]]` between notes) |
| Code blocks | ✓ | ✓ (syntax highlighting) |
| Find & Replace | ✓ | ✓ |
| Undo/Redo | ✓ | ✓ |
| Dark mode | ✓ | ✓ |
| i18n | External files | Built-in via `window.t()`, 12 languages |
| Formulas | plugin | ✓ native MathML, no MathJax/KaTeX |
| Vector drawing pad | ✗ | ✓ re-editable sketches |
| Callouts, templates, slash menu | plugins | ✓ built in |
| Size | ~500 KB+ | ~340 KB `core.js` + ~120 KB `styles.css`, un-minified |
| Dependencies | Multiple | None |
