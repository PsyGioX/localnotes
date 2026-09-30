# LocalNotesEditor

A feature-rich rich text editor built for the Local Notes application. One JavaScript class, no external dependencies, no build step.

## Features

**Text**
- **Rich formatting** — bold, italic, underline, strikethrough, superscript, subscript, clear formatting
- **Paragraph styles** — Normal, Heading 1–6, Preformatted, Blockquote, Div
- **Font family & size** — dropdown selects, fully translated
- **Text & highlight colour** — colour picker with live toolbar sync on cursor move; the caret follows the text colour
- **Alignment**, indent / outdent
- **Lists** — ordered, unordered, interactive checklists (colour, priority and label per item)

**Insert**
- **Links** and **wiki-links** — type `[[` to link to another note (the host app supplies the search via `onWikiLinkSearch`)
- **Media** — images (file picker, drag & drop), videos (YouTube, Vimeo, direct URL and other embeds)
- **Tables** — insert, resize, add/delete rows and columns via a context toolbar
- **Blocks** — blockquotes, code blocks with syntax highlighting, callout boxes (Note / Tip / Warning / Important)
- **Formulas** — maths through native MathML (own tiny text-syntax parser, no MathJax/KaTeX): example gallery + builder, editable in place
- **Drawing pad** — vector sketches with brushes, 30+ shapes, fill, line styles, arrow heads, opacity and resize handles; re-editable later ([details](#drawing-pad))
- **Templates** — 11 built-in (Business, Study, Planning) plus your own, with `{{date}}` / `{{time}}` / `{{weekday}}` / `{{datetime}}` variables and JSON export/import
- **Quick Insert** slash menu (`/` or `Ctrl+Space`), emoji and special-character pickers, date/time, horizontal rule, non-breaking space

**Workflow**
- **Find & Replace** with a case-sensitive option
- **Undo / Redo** — up to 300 snapshots, reset on `setContent()`
- **Show blocks**, **HTML source view** (pretty-printed, hand-editable), **word / character statistics**
- **Focus mode** (F12) and **fullscreen** (F11)
- **Floating context toolbar** on text selection; **tooltips** that show each button's shortcut; **shortcuts reference** (Ctrl+/)
- **Paste handling** — smart clean-up of external styles
- **Responsive** — desktop, tablet, mobile (including virtual-keyboard handling in the app)
- **Dark / light** — through CSS custom properties
- **i18n** — all labels via `window.t(key)` with English fallbacks

## Installation

Already integrated into Local Notes. To use it on its own:

```html
<link rel="stylesheet" href="/localnoteseditor/styles.css">
<script src="/localnoteseditor/core.js"></script>
```

Inside Local Notes the extra app glue is `css/editor-modal.css` and `js/editor-integration.js`.

## Usage

```html
<div id="editorContainer"></div>
```

```javascript
const editor = new LocalNotesEditor('editorContainer', {
    height: '500px',
    placeholder: 'Start typing...',
    toolbar: true,
    statusbar: true,
    onWikiLinkSearch: async (query) => [{ id: 'note_1', title: 'Some note' }], // optional
    onWikiLinkOpen:   (id) => { /* open the note */ }                          // optional
});
```

## API

```javascript
editor.getContent()            // → HTML string
editor.setContent('<p>…</p>')  // resets history
editor.getText()               // → plain text
editor.clear()
editor.focus()

editor.undo();  editor.redo();

editor.insertImage();          // opens the dialog
editor.insertVideo();
editor.insertChecklistItem();

editor.destroy();              // editor.isDestroyed === true afterwards
```

Useful fields: `editor.ed` (the `contenteditable` element), `editor.toolbar`, `editor.statusbar`, `editor.wrapper`.

In the Local Notes app use the wrapper created by `js/editor-integration.js`:
`localNotesEditorAPI.getContent() / setContent() / getText() / clear() / focus() / undo() / redo() / isInitialized() / getInstance()`.

## Drawing pad

Toolbar button **Insert drawing** (brush icon). Double-click an inserted drawing to edit it again.

**Tools**
- **Brush** with six types — pen, marker, pencil, calligraphy, spray, dotted
- **Eraser**
- **Move** — select an object, drag it, nudge with the arrow keys (Shift = 10 px), delete with Delete / Backspace
- **Shapes** — rectangle, ellipse, triangle, line, arrow, plus heart, star, diamond, pentagon, hexagon, octagon, right triangle, trapezoid, parallelogram, rounded rectangle, 4- and 6-point stars, plus, X, check mark, four block arrows and a double arrow, cloud, moon, lightning bolt, speech bubble, semicircle, ring, chevron, house

**Parameters**

| Parameter | What it does |
|-----------|--------------|
| Colour | 8 swatches + custom colour |
| Size | Brush / line width, 1–48 |
| Fill shapes with colour | Fills closed shapes |
| Fill colour | Fill colour separate from the line colour ("same as line colour" button resets it); picking one turns fill on |
| Line style | Solid, dashed, dotted (shapes, lines, arrows) |
| Arrow heads | At the end, or at both ends |
| Opacity | 10–100 %; a translucent object is composited as a whole, so overlapping parts do not get darker |
| Keep proportions | Squares / circles while drawing; aspect ratio preserved while resizing; lines and arrows snap to 45° steps. Holding **Shift** does the same |
| Canvas size | 16:9, 4:3, 3:2, 1:1, 3:4 |

**Editing a finished object.** Choose **Move**, click an object: the option panel now shows *that object's* colour, size, fill, fill colour, line style, arrow heads and opacity, and changing any of them edits it (a run of slider / colour changes is one undo step). Handles on the selection resize it — corners and edge midpoints for shapes and brush strokes, the two end points for lines and arrows.

**Shortcuts in the pad:** Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, Delete, arrow keys (with Move).

**Storage.** The inserted `<img class="lne-drawing">` carries the rendered picture (PNG, or lossless WebP when smaller) in `src` on a white background and the vector data in `data-lne-draw`. Limits: 4,000 objects, 400,000 characters of vector data (above that only the picture is kept and is edited later as a base layer), 80 undo steps, canvas 200–2400 px. The last-used tool and parameters are remembered while the page is open, and an unfinished sketch is restored if the pad is closed without inserting. See `PROJECT_STRUCTURE.md` for the data format.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+B / Ctrl+I / Ctrl+U | Bold / Italic / Underline |
| Tab / Shift+Tab | Indent / Outdent |
| Ctrl+K | Insert link |
| `[[` | Link to another note |
| `/` or Ctrl+Space | Quick Insert menu |
| Ctrl+H | Find & Replace |
| Ctrl+Shift+Space | Non-breaking space |
| F11 | Fullscreen |
| F12 | Focus mode |
| Ctrl+/ | Keyboard shortcuts reference |

## CSS Variables

```css
:root {
    --primary-color: #28a745;
    --border-color: #272727;
    --modal-bg: #1a1a1a;
    --bg-secondary: #111;
    --text-color: #e0e0e0;
    --text-secondary: #888;
    --button-hover: #2a2a2a;
}
```

## Size

| Metric | Value |
|--------|-------|
| `core.js` | ~340 KB (un-minified) |
| `styles.css` | ~120 KB |
| Dependencies | None (Bootstrap Icons font is bundled) |

It is cached by the Service Worker after the first load. (Early versions of this document quoted ~15 KB; the editor has grown a lot since.)

## Browser Support

- Chrome / Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari, Chrome Mobile

## License

MIT — see LICENSE file.
