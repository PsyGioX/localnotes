// Force cache refresh for old SW cache versions
if ('caches' in window) {
    caches.keys().then(function(cacheNames) {
        cacheNames.forEach(function(cacheName) {
            if (cacheName.includes('v1.0.2') || cacheName.includes('v1.0.3') ||
                cacheName.includes('v1.0.4') || cacheName.includes('v1.0.5') ||
                cacheName.includes('v1.1.0') || cacheName.includes('v1.1.1') ||
                cacheName.includes('v1.1.2') || cacheName.includes('v1.1.3')) {
                caches.delete(cacheName);
            }
        });
    });
}

// Remove styles-loading and show page on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    if (document.body) {
        document.body.classList.remove('styles-loading');
        document.body.classList.add('styles-loaded');
    }
});

// Load non-critical CSS asynchronously (replaces onload= event handlers on <link> tags)
(function() {
    var sheets = [
        '/css/img.css?v=1.9.5',
        '/localnoteseditor/bootstrap-icons/font/bootstrap-icons.min.css',
        '/css/highlight.css?v=1.9.5',
        '/localnoteseditor/styles.css?v=1.9.5',
        '/css/editor-modal.css?v=1.9.5',
        '/css/apple.css?v=1.9.5',
        '/css/tags-calendar.css?v=1.9.5',
        '/css/workspaces.css?v=1.9.5'
    ];
    sheets.forEach(function(href) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    });
})();
