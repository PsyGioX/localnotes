// Collapse/expand toggle for the action bar (.btn_view_div: List/Grid,
// Task Board, Lock). Adds a small chevron button at the end of the bar
// that shrinks it down to a slim strip — useful once you know where
// those actions are and don't want them taking up space on every screen.
(function () {
    'use strict';

    var STORAGE_KEY = 'ln_actionbar_collapsed';

    function gt(key, fallback) {
        try {
            if (typeof t === 'function') {
                var v = t(key);
                return (v && v !== key) ? v : fallback;
            }
        } catch (_) { /* ignore */ }
        return fallback;
    }

    function init() {
        var bar = document.querySelector('.btn_view_div');
        if (!bar || bar.querySelector('.ln-actionbar-collapse')) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ln-actionbar-collapse';
        btn.setAttribute('aria-label', gt('actionBarToggle', 'Toggle actions bar'));
        btn.innerHTML = '<i class="bi bi-chevron-up" aria-hidden="true"></i>';
        bar.appendChild(btn);

        var collapsed = false;
        try { collapsed = localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { /* ignore */ }
        if (collapsed) bar.classList.add('ln-collapsed');

        btn.addEventListener('click', function () {
            var isCollapsed = bar.classList.toggle('ln-collapsed');
            try { localStorage.setItem(STORAGE_KEY, isCollapsed ? '1' : '0'); } catch (_) { /* ignore */ }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
