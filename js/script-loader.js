// Load scripts sequentially to ensure proper order
function loadScriptsSequentially(scripts, index) {
    index = index || 0;
    if (index >= scripts.length) return;

    var script = document.createElement('script');
    script.src = scripts[index];
    script.async = false;
    script.onload = function() {
        loadScriptsSequentially(scripts, index + 1);
    };
    script.onerror = function() {
        console.error('Failed to load: ' + scripts[index]);
        loadScriptsSequentially(scripts, index + 1);
    };
    document.head.appendChild(script);
}

// Load scripts after DOM is ready
var scripts = [
    '/js/magicurl.js?v=1.9.8',
    '/js/highlight.min.js?v=1.9.8',
    '/js/translations.js?v=1.9.8',
    '/js/img.js?v=1.9.8',
    '/js/date-utils.js?v=1.9.8',
    '/js/editor-integration.js?v=1.9.8',
    '/js/markdown.js?v=1.9.8',
    '/js/tags-calendar.js?v=1.9.8',
    '/js/task-board.js?v=1.9.8',
    '/js/index.js?v=1.9.8',
    '/js/command-palette.js?v=1.9.8',
    '/js/share-target.js?v=1.9.8'
];

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { loadScriptsSequentially(scripts); });
} else {
    loadScriptsSequentially(scripts);
}
