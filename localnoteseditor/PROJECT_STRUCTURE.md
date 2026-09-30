# LocalNotesEditor — Project Structure

## Directory

```
localnoteseditor/
├── core.js                  # Main editor engine (single class, ~6,200 lines)
├── styles.css               # Editor styles
├── bootstrap-icons/         # Bundled icon font
├── README.md
├── CHANGELOG.md
├── QUICK_START.md
├── EXAMPLES.md
├── PROJECT_STRUCTURE.md     # This file
├── MIGRATION_GUIDE.md
├── IMPLEMENTATION_SUMMARY.md
├── INDEX.md
├── package.json
└── LICENSE
```

## core.js — Public API

| Method | Description |
|--------|-------------|
| `new LocalNotesEditor(id, opts)` | Init editor in container (`height`, `placeholder`, `toolbar`, `statusbar`, `onWikiLinkSearch`, `onWikiLinkOpen`) |
| `getContent()` | Get HTML (internal editor state is stripped) |
| `setContent(html)` | Set content, reset undo stack |
| `getText()` | Plain text (`innerText`) |
| `clear()` | Clear editor |
| `focus()` | Focus the editor and place the caret |
| `undo()` / `redo()` | History navigation |
| `insertImage()` | Open image dialog |
| `insertVideo()` | Open video dialog |
| `insertChecklistItem()` | Insert checklist item |
| `destroy()` | Clean up (`isDestroyed` becomes `true`) |

Instance fields: `ed` (contenteditable), `toolbar`, `statusbar`, `wrapper`, `undoStack`, `redoStack`, `maxUndo` (300).

## core.js — Main Internal Areas

Methods prefixed with `_` are internal and may change.

| Area | Methods / notes |
|------|-----------------|
| Toolbar | `_buildDOM()`, `_buildToolbar()`, `_wireToolbar()`, `_exec(cmd, btn)` command dispatcher, `_initTooltips()` |
| State sync | `_syncState()` (formats, selects, colours), `_colorBars()` (colour bars + caret colour), `_updateStatusbar()` |
| History | `_saveSnap()`, `undo()`, `redo()` |
| Insertion | `_insertHTML(html)` (re-initialises checklists, code blocks, drawings after insert), `_initAll()` |
| Dialogs | `_modal(title, icon, html, onOk, …)` plus `_modalLink`, `_modalImage`, `_modalImageEdit`, `_modalVideo`, `_modalVideoEdit`, `_modalTable`, `_modalTableEdit`, `_modalColor`, `_modalEmoji`, `_modalSpecialChars`, `_modalFormula`, `_modalDrawing`, `_modalSourceView`, `_modalWordCount`, `_modalShortcuts`, `_modalCustomTemplates` |
| Drawing pad | `_modalDrawing(existingImg)` — shape library, brush engine, hit-testing, selection + resize handles, history, export (see below) |
| i18n | `_(key, fallback)` → `window.t()` with English fallback |

## Drawing pad internals (`_modalDrawing`)

- **Objects** — the sketch is a list of compact objects, rendered in order onto an offscreen canvas and composited on the visible one:
  - freehand: `{ k:'b', c, s, t, r, p:[x,y,…], op? }` (brush) and `{ k:'e', c, s, p }` (eraser)
  - shapes: `{ k, c, s, f, a:[x1,y1,x2,y2], fc?, ds?, ah?, op? }`
- **Field reference**

  | Field | Meaning |
  |-------|---------|
  | `k` | kind: `b` brush, `e` eraser, `r` rectangle, `o` ellipse, `t` triangle, `l` line, `a` arrow, or a library shape id (`hr` heart, `st` star, `hx` hexagon, …) |
  | `c` | line colour (`#rgb` … `#rrggbbaa`) |
  | `s` | stroke width (1–96) |
  | `f` | 1 = fill the shape |
  | `fc` | fill colour; omitted = same as `c` |
  | `ds` | line style: omitted = solid, `1` dashed, `2` dotted |
  | `ah` | arrow heads: omitted = end only, `2` = both ends |
  | `op` | opacity 0.05–1; omitted = opaque (drawn on a scratch layer first so overlaps don't darken) |
  | `t`, `r` | brush type and PRNG seed (textured brushes render identically on every re-render) |
  | `a` / `p` | box corners / point list |

- **Persistence** — the `<img class="lne-drawing">` holds the exported PNG (or lossless WebP when smaller) in `src` and the JSON `{ v:1, w, h, o:[…] }` in `data-lne-draw`. Everything read back is validated (`parse()`); unknown or malformed fields are dropped.
- **Limits** — 4,000 objects, 400,000 characters of JSON (otherwise only the picture is kept), 80 history steps, canvas 200–2400 px.
- **Selection / editing** — the Move tool selects an object; the option panel then edits that object instead of the defaults (`editSel()`); live sliders merge into one undo step. `resized()` implements handle dragging, with optional aspect-ratio lock.
- **Remembered settings** — `editor._drawPrefs` (tool, brush, colour, size, fill, keep-proportions, fill colour, opacity, line style, arrow heads) and an unfinished sketch `editor._drawDraft` live for the page session.

## styles.css — Key Sections

| Selector | Purpose |
|----------|---------|
| `.lne-wrapper` | Outer container |
| `.lne-toolbar` / `.lne-toolbar-row` | Toolbar and its flex rows |
| `.lne-btn` | Toolbar button |
| `.lne-sel`, `.lne-sel-heading`, `.lne-sel-font`, `.lne-sel-size` | Dropdown selects |
| `.lne-color-btn`, `.lne-cbar` | Colour button and indicator bar |
| `.lne-body`, `.lne-editor` | Scrollable area and contenteditable element |
| `.lne-statusbar` | Word/char count bar |
| `.lne-tpl-*` | Templates row / menu |
| `.lne-draw*` | Drawing pad: `.lne-draw-panel` (tools), `.lne-draw-stage`, `.lne-draw-row` (fill colour / line style / arrow heads), `.lne-draw-oprow` (opacity) |
| `@media (max-width: 768px)`, `480px`, `720px` (drawing) | Tablet / mobile layouts |

## Integration Files

**`js/editor-integration.js`** — creates the `LocalNotesEditor` on page load, connects wiki-link search/open to `notesDB`, handles the mobile virtual-keyboard layout, and exposes `window.localNotesEditorAPI`.

**`css/editor-modal.css`** — makes `.modal-content` a flex column so the editor fills the available height; handles mobile (100dvh) and tablet breakpoints.

## CSS Custom Properties Used

```css
--primary-color      /* accent / active colour */
--border-color       /* borders */
--modal-bg           /* editor background */
--bg-secondary       /* toolbar background */
--text-color         /* text */
--text-secondary     /* muted text */
--button-hover       /* button hover bg */
```

## Size

| Metric | Value |
|--------|-------|
| `core.js` | ~340 KB (un-minified source) |
| `styles.css` | ~120 KB |
| Dependencies | none |
| Max undo levels | 300 |
