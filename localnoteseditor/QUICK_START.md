# LocalNotesEditor — Quick Start

## For End Users

1. Click any note to open the editor
2. Use toolbar buttons, the `/` Quick Insert menu or keyboard shortcuts to format and insert
3. Drag images directly into the editor
4. Click the checklist button to add interactive tasks
5. Click the brush button to sketch (double-click a drawing later to edit it)
6. Click Save when done

### Keyboard Shortcuts

Press **Ctrl+/** in the editor to see the full list. The main ones:

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+B / Ctrl+I / Ctrl+U | Bold / Italic / Underline |
| Tab / Shift+Tab | Indent / Outdent |
| Ctrl+K | Insert link |
| `[[` | Link to another note (autocomplete) |
| `/` or Ctrl+Space | Quick Insert menu |
| Ctrl+H | Find & Replace |
| Ctrl+Shift+Space | Non-breaking space |
| F11 | Fullscreen |
| F12 | Focus mode |
| Ctrl+/ | Keyboard shortcuts reference |

While the drawing pad is open: Ctrl+Z / Ctrl+Y undo/redo, and with the Move tool, arrow keys nudge the selected object (Shift = 10 px), Delete removes it. Hold Shift while drawing or resizing to keep proportions.

---

## For Developers

### Initialize

```javascript
const editor = new LocalNotesEditor('containerId', {
    height: '500px',
    placeholder: 'Start typing...',
    toolbar: true,      // false hides the toolbar
    statusbar: true,    // false hides the status bar
    // optional: enables the [[ wiki-link popup and toolbar button
    onWikiLinkSearch: async (query) => [{ id: 'n1', title: 'Some note' }],
    onWikiLinkOpen:   (id) => { /* open note `id` */ }
});
```

### Get / Set Content

```javascript
const html = editor.getContent();
const text = editor.getText();
editor.setContent('<p>Hello <strong>World</strong></p>');  // resets undo history
editor.clear();
```

### Insert Elements

```javascript
editor.insertImage();          // opens the image dialog
editor.insertVideo();          // opens the video dialog
editor.insertChecklistItem();  // inserts a checklist item
```

### Listen for Changes

```javascript
editor.ed.addEventListener('input', () => {
    console.log(editor.getContent());
});
```

`editor.ed` is the `contenteditable` element; `editor.toolbar`, `editor.statusbar` and `editor.wrapper` are the other main parts.

### Add a Custom Toolbar Button

```javascript
const btn = document.createElement('button');
btn.className = 'lne-btn';
btn.title = 'My action';
btn.innerHTML = '<i class="bi bi-star"></i>';
btn.addEventListener('click', () => { /* your action */ });
editor.toolbar.querySelector('.lne-toolbar-row').appendChild(btn);
```

---

## File Structure

```
localnoteseditor/
├── core.js          # Editor engine — include this
├── styles.css       # Editor styles — include this
└── bootstrap-icons/ # Icons (bundled)

css/
└── editor-modal.css # Modal layout styles (app only)

js/
└── editor-integration.js # App integration (app only)

locales/
└── <lang>.json      # Editor labels are read with window.t(key); English fallbacks are built in
```

---

## Troubleshooting

**Editor not appearing** — check the container ID exists, CSS loaded, no console errors.

**Content not saving** — use `editor.getContent()` to retrieve HTML before saving.

**Labels show in English** — `window.t` is not defined or the key is missing from `/locales/<lang>.json`; the editor falls back to its built-in English text.

**Styling conflicts** — check that `styles.css` loads before your overrides.

**Color bar not updating** — the cursor must be inside a coloured `<span>` or `<font>` element.

**Drawing opens as a flat picture** — the drawing was made before vector data was stored, or it was too large to store (see README → "Drawing pad"); it is edited as a base layer instead.
