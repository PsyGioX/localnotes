// Floating "back to top" button.
// Lightweight by design: one passive scroll listener (rAF-throttled, reads only
// scrollY), no layout work while scrolling, and a runtime overlap guard that
// keeps it clear of the other floating buttons (Add-note FAB, sidebar tab).
(function () {
    'use strict';
    if (window.__lnScrollTopInit) return;
    window.__lnScrollTopInit = true;

    var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
    var GAP = 12;
    // Other floating controls the button must never cover
    var OBSTACLES = ['#mobileAddNoteFab', '#sidebarToggleTab', '.theme-toggle', '.btn_view_div'];

    function label() {
        var s = typeof window.t === 'function' ? window.t('scrollToTop') : '';
        return (s && s !== 'scrollToTop') ? s : 'Back to top';
    }

    function init() {
        if (!document.getElementById('notesContainer') || document.getElementById('lnScrollTop')) return;

        var btn = document.createElement('button');
        btn.id = 'lnScrollTop';
        btn.type = 'button';
        btn.className = 'ln-scroll-top';
        btn.innerHTML = ARROW;
        btn.setAttribute('aria-label', label());
        btn.title = label();
        btn.tabIndex = -1; // reachable only while visible (toggled below)
        document.body.appendChild(btn);

        var visible = false, ticking = false;
        // Which element actually scrolls: the page itself (default) or, if some layout
        // makes <body>/a wrapper the scroller, that element — learned from real scroll
        // events (they don't bubble, so they are caught in the capture phase).
        var scroller = null;

        function pageY() { return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0; }
        function pos() { return scroller ? scroller.scrollTop : pageY(); }
        function onScroll(e) {
            var t = e.target;
            if (t === document || t === document.documentElement) scroller = null;
            else if (t.nodeType === 1 && t.scrollHeight > t.clientHeight + 10 && t.clientHeight >= window.innerHeight * 0.5) scroller = t;
            else return; // small inner scrollers (code blocks, lists, editor...) are irrelevant
            request();
        }

        function blocked() {
            var b = document.body;
            if (b.classList.contains('modal-open') || b.classList.contains('task-board-active')) return true;
            if (document.querySelector('.ln-lock-overlay')) return true;
            // Sidebar open? Use its state class — geometry is unreliable (a desktop
            // scrollbar makes innerWidth larger than the viewport the sidebar hides at).
            var sb = document.getElementById('notesSidebar');
            if (sb && sb.classList.contains('ln-sidebar-open')) return true;
            return false;
        }

        function hits(a, b) {
            return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        }

        // If any other visible fixed control overlaps the button, lift it above that control.
        function avoidOverlap() {
            btn.style.removeProperty('bottom');
            for (var pass = 0; pass < 5; pass++) {
                var me = btn.getBoundingClientRect(), moved = false;
                for (var i = 0; i < OBSTACLES.length; i++) {
                    var el = document.querySelector(OBSTACLES[i]);
                    if (!el) continue;
                    var cs = getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position !== 'fixed') continue;
                    var r = el.getBoundingClientRect();
                    if (r.width < 8 || r.height < 8 || !hits(me, r)) continue;
                    btn.style.bottom = (window.innerHeight - r.top + GAP) + 'px';
                    me = btn.getBoundingClientRect(); moved = true;
                }
                if (!moved) break;
            }
        }

        function syncFooter() {
            var f = document.querySelector('.btn_view_div');
            if (f) document.documentElement.style.setProperty('--ln-footer-h', Math.round(f.getBoundingClientRect().height) + 'px');
        }

        function update() {
            ticking = false;
            var show = !blocked() && pos() > 300;
            if (show === visible) return;
            visible = show;
            if (show) { syncFooter(); avoidOverlap(); }
            btn.classList.toggle('is-visible', show);
            btn.tabIndex = show ? 0 : -1;
        }
        function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

        function relayout() { syncFooter(); if (visible) avoidOverlap(); request(); }

        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        window.addEventListener('resize', relayout, { passive: true });
        window.addEventListener('orientationchange', function () { setTimeout(relayout, 150); });
        // Modals / task board / lock screen toggle classes on <body>
        new MutationObserver(request).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        // The sidebar (and other panels) flip their own classes without touching <body>:
        // re-evaluate shortly after any click / key press, once their transition has started.
        function later() { setTimeout(request, 320); }
        document.addEventListener('click', later, true);
        document.addEventListener('keyup', later, true);
        var f = document.querySelector('.btn_view_div');
        if (f && window.ResizeObserver) new ResizeObserver(relayout).observe(f);

        btn.addEventListener('click', function () {
            var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            var opts = { top: 0, behavior: reduce ? 'auto' : 'smooth' };
            if (scroller && scroller.scrollTo) scroller.scrollTo(opts);
            if (pageY() > 0 || !scroller) window.scrollTo(opts);
            btn.blur();
        });

        syncFooter();
        request();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
