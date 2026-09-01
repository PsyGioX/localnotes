// Scripts download in parallel but still execute in this exact order —
// async=false on a dynamically created <script> guarantees ordered
// execution without forcing ordered *downloads*. The previous version
// chained each script's creation off the previous one's onload, which
// meant 13 full network round-trips happening one at a time instead of
// concurrently; this keeps the same execution guarantee at a fraction
// of the load time.
function loadScriptsInOrder(scripts) {
    scripts.forEach(function (src) {
        var script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onerror = function() { console.error('Failed to load: ' + src); };
        document.head.appendChild(script);
    });
}

// Load scripts after DOM is ready
var scripts = [
    '/js/highlight.min.js?v=1.9.13',
    '/js/translations.js?v=1.9.13',
    '/js/img.js?v=1.9.13',
    '/js/date-utils.js?v=1.9.13',
    '/js/editor-integration.js?v=1.9.13',
    '/js/markdown.js?v=1.9.13',
    '/js/import-formats.js?v=1.9.13',
    '/js/tags-calendar.js?v=1.9.13',
    '/js/task-board.js?v=1.9.13',
    '/js/index.js?v=1.9.13',
    '/js/command-palette.js?v=1.9.13',
    '/js/share-target.js?v=1.9.13',
    '/js/onboarding-tour.js?v=1.9.13',
    '/js/action-bar.js?v=1.9.13',
    '/js/sidebar.js?v=1.9.13'
];

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { loadScriptsInOrder(scripts); });
} else {
    loadScriptsInOrder(scripts);
}
