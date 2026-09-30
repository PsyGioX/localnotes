# LocalNotesEditor - Usage Examples

## Basic Initialization

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="localnoteseditor/styles.css">
</head>
<body>
    <div id="editor"></div>
    
    <script src="localnoteseditor/core.js"></script>
    <script>
        const editor = new LocalNotesEditor('editor', {
            height: '500px',
            placeholder: 'Start typing...'
        });
    </script>
</body>
</html>
```

## Getting and Setting Content

```javascript
// Initialize editor
const editor = new LocalNotesEditor('editor');

// Get HTML content
const html = editor.getContent();
console.log(html);

// Get plain text
const text = editor.getText();
console.log(text);

// Set content
editor.setContent('<p>Hello <strong>World</strong></p>');

// Clear editor
editor.clear();
```

## Working with Formatting

```javascript
// The editor automatically handles formatting through the toolbar
// Users can click buttons or use keyboard shortcuts:
// Ctrl+B - Bold
// Ctrl+I - Italic
// Ctrl+U - Underline
// Ctrl+Z - Undo
// Ctrl+Y - Redo

// Programmatically apply formatting to the current selection
// (the editor is built on document.execCommand)
editor.focus();
document.execCommand('bold');
document.execCommand('italic');
document.execCommand('underline');
```

## Inserting Media

```javascript
// Insert image
editor.insertImage();
// Opens file picker for image selection

// Insert video
editor.insertVideo();
// Prompts for video URL (YouTube, Vimeo, or direct URL)

// Insert checklist item
editor.insertChecklistItem();
// Adds interactive checklist item with checkbox
```

## Drawings

```javascript
// Drawings are ordinary <img class="lne-drawing"> elements in the content.
// The rendered picture is in `src`; the vector data (used for re-editing) is in `data-lne-draw`.
const drawings = editor.ed.querySelectorAll('img.lne-drawing');
drawings.forEach(img => console.log(img.alt, img.width + '×' + img.height));

// Open the drawing pad programmatically (same as the toolbar button)
editor._modalDrawing();            // new drawing
editor._modalDrawing(drawings[0]); // edit an existing one (double-click does this too)
```

`_modalDrawing` is an internal method; it is stable enough for the app but is not part of the public API.

## Undo/Redo Operations

```javascript
// Undo last action
editor.undo();

// Redo last undone action
editor.redo();

// Check undo/redo stack
console.log(editor.undoStack.length);
console.log(editor.redoStack.length);

// Configure max undo levels
editor.maxUndo = 100; // Default is 300
```

## Working with Selections

```javascript
// Get current selection
const selection = window.getSelection();

// Get selected text
const selectedText = selection.toString();

// Get selected HTML
const range = selection.getRangeAt(0);
const selectedHTML = range.extractContents();
```

## Custom Toolbar Buttons

```javascript
// Add custom button to toolbar
const customBtn = document.createElement('button');
customBtn.className = 'lne-btn';
customBtn.title = 'Custom Action';
customBtn.innerHTML = '⭐';
customBtn.addEventListener('click', () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.color = 'gold';
        span.textContent = '⭐ ';
        range.insertNode(span);
    }
    editor.ed.focus();
});

editor.toolbar.appendChild(customBtn);
```

## Event Handling

```javascript
// Listen for input changes
editor.ed.addEventListener('input', () => {
    console.log('Content changed');
    console.log(editor.getContent());
});

// Listen for paste events
editor.ed.addEventListener('paste', (e) => {
    console.log('Content pasted');
});

// Listen for key events
editor.ed.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        console.log('Save shortcut pressed');
    }
});
```

## Styling Content

```javascript
// Format the current selection through the browser's command API
editor.focus();
document.execCommand('fontName', false, 'Georgia, serif');
document.execCommand('formatBlock', false, 'blockquote');
document.execCommand('foreColor', false, '#e74c3c');

// Insert raw HTML at the caret
document.execCommand('insertHTML', false, '<strong>Hello</strong>');
```

Direct `execCommand` calls bypass the editor's own undo snapshot. For user-facing actions prefer the toolbar, or call `editor.setContent()` / the `insert*()` helpers.

## Cleanup and Destruction

```javascript
// Focus editor
editor.ed.focus();

// Check if editor is destroyed
if (editor.isDestroyed) {
    console.log('Editor has been destroyed');
}

// Destroy editor and clean up
editor.destroy();
```

## Integration with Forms

```html
<form id="noteForm">
    <div id="editor"></div>
    <button type="submit">Save Note</button>
</form>

<script>
    const editor = new LocalNotesEditor('editor');
    
    document.getElementById('noteForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const content = editor.getContent();
        const text = editor.getText();
        
        // Send to server
        fetch('/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                html: content,
                text: text
            })
        });
    });
</script>
```

## Responsive Editor

```javascript
// Editor automatically adapts to container size
// Adjust height based on viewport
const editor = new LocalNotesEditor('editor', {
    height: window.innerWidth < 768 ? '300px' : '500px'
});

// Update on resize
window.addEventListener('resize', () => {
    const newHeight = window.innerWidth < 768 ? '300px' : '500px';
    editor.ed.style.minHeight = newHeight;
});
```

## Dark Mode Support

```css
/* Automatically applies dark mode based on system preference */
@media (prefers-color-scheme: dark) {
    .lne-wrapper {
        background: #1e1e1e;
        color: #e0e0e0;
    }
}

/* Or force dark mode */
.lne-wrapper.dark-mode {
    background: #1e1e1e;
    color: #e0e0e0;
}
```

## Paste Handling

```javascript
// Editor automatically cleans up pasted content
// Removes excessive styles and formatting

// Custom paste handler
editor.ed.addEventListener('paste', (e) => {
    e.preventDefault();
    
    const text = e.clipboardData.getData('text/plain');
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
    }
});
```

## Drag and Drop

```javascript
// Editor supports drag and drop for images
editor.ed.addEventListener('drop', (e) => {
    e.preventDefault();
    
    const files = e.dataTransfer.files;
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.maxWidth = '100%';
                
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.insertNode(img);
                }
            };
            reader.readAsDataURL(file);
        }
    }
});
```

## Status Bar Information

```javascript
// Editor automatically updates status bar with:
// - Word count
// - Character count

// Access status bar
const statusbar = editor.statusbar;

// The status bar refreshes automatically on every input event
```

## Advanced: Extending the Editor

```javascript
class CustomNotesEditor extends LocalNotesEditor {
    constructor(containerId, options) {
        super(containerId, options);
        this.setupCustomFeatures();
    }

    setupCustomFeatures() {
        this.addCustomButton('bi-brightness-high', 'Highlight', () => {
            this.focus();
            document.execCommand('hiliteColor', false, 'yellow');
        });
    }

    addCustomButton(icon, title, callback) {
        const btn = document.createElement('button');
        btn.className = 'lne-btn';
        btn.title = title;
        btn.innerHTML = '<i class="bi ' + icon + '"></i>';
        btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection
        btn.addEventListener('click', callback);
        this.toolbar.querySelector('.lne-toolbar-row').appendChild(btn);
    }
}

const customEditor = new CustomNotesEditor('editor');
```

## Performance Tips

1. **Limit undo levels** for large documents:
   ```javascript
   editor.maxUndo = 50;
   ```

2. **Debounce save operations**:
   ```javascript
   let saveTimeout;
   editor.ed.addEventListener('input', () => {
       clearTimeout(saveTimeout);
       saveTimeout = setTimeout(() => {
           saveContent(editor.getContent());
       }, 1000);
   });
   ```

3. **Use text content for search**:
   ```javascript
   const searchText = editor.getText().toLowerCase();
   ```

4. **Lazy load images**:
   ```javascript
   const images = editor.ed.querySelectorAll('img');
   images.forEach(img => {
       img.loading = 'lazy';
   });
   ```
