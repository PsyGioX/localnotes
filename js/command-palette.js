/**
 * Command Palette (Ctrl+K / Cmd+K)
 * Quick actions + instant note search, self-contained (own DOM + styles),
 * loaded last in the sequential script list so all app globals it needs
 * (notesDB, openModal, TagsCalendar, taskBoard, themeManager, AppLock)
 * are guaranteed to already exist.
 */
(function () {
    'use strict';

    var MAX_RESULTS = 8;
    var overlay = null, input = null, list = null;
    var activeIndex = -1;
    var currentItems = [];
    var notesCache = null; // populated lazily on open, cleared on close

    function t(key, fallback) {
        if (typeof window.t === 'function') {
            var v = window.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // Strip tags via regex only — never innerHTML untrusted content into a
    // live/detached DOM node just to read text back out (detached elements
    // can still fire onerror/onload for images/media before you unmount them).
    function toPlainSnippet(html, maxLen) {
        var text = String(html || '')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    }

    function injectStyles() {
        if (document.getElementById('lnp-style')) return;
        var css =
            '.lnp-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-start;justify-content:center;' +
                'padding-top:12vh;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);opacity:0;transition:opacity .12s;}' +
            '.lnp-ov.lnp-open{opacity:1;}' +
            '.lnp-box{width:min(560px,92vw);max-height:70vh;display:flex;flex-direction:column;' +
                'background:var(--modal-bg,#1a1a1a);border:1px solid var(--modal-border,#272727);border-radius:14px;' +
                'box-shadow:0 16px 64px rgba(0,0,0,.45);overflow:hidden;transform:translateY(-8px);transition:transform .12s;}' +
            '.lnp-ov.lnp-open .lnp-box{transform:translateY(0);}' +
            '.lnp-inputrow{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border-color,#272727);flex-shrink:0;}' +
            '.lnp-inputrow i{color:var(--text-secondary,#999);font-size:16px;}' +
            '.lnp-input{flex:1;background:transparent;border:0;outline:0;color:var(--text-color,#e0e0e0);font-size:15px;font-family:inherit;}' +
            '.lnp-input::placeholder{color:var(--text-secondary,#999);}' +
            '.lnp-esc{font-size:10.5px;color:var(--text-secondary,#999);border:1px solid var(--border-color,#333);border-radius:5px;padding:2px 6px;flex-shrink:0;}' +
            '.lnp-list{overflow-y:auto;padding:6px;}' +
            '.lnp-empty{padding:22px 16px;text-align:center;color:var(--text-secondary,#999);font-size:13px;}' +
            '.lnp-grouphd{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-secondary,#999);padding:8px 10px 4px;}' +
            '.lnp-item{display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:8px;cursor:pointer;color:var(--text-color,#e0e0e0);}' +
            '.lnp-item i{width:18px;text-align:center;color:var(--text-secondary,#999);font-size:15px;flex-shrink:0;}' +
            '.lnp-item .lnp-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px;}' +
            '.lnp-item .lnp-snippet{display:block;font-size:11.5px;color:var(--text-secondary,#999);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
            '.lnp-item.lnp-active,.lnp-item:hover{background:rgba(174,252,110,.12);}' +
            '.lnp-item.lnp-active i,.lnp-item:hover i{color:#aefc6e;}' +
            '[data-theme="light"] .lnp-item.lnp-active,[data-theme="light"] .lnp-item:hover{background:rgba(40,167,69,.1);}' +
            '[data-theme="light"] .lnp-item.lnp-active i,[data-theme="light"] .lnp-item:hover i{color:#28a745;}' +
            '@media (max-width:640px){.lnp-ov{padding-top:0;align-items:stretch;}.lnp-box{width:100%;max-height:100dvh;border-radius:0;margin-top:0;}}';
        var style = document.createElement('style');
        style.id = 'lnp-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function buildDOM() {
        if (overlay) return;
        injectStyles();
        overlay = document.createElement('div');
        overlay.className = 'lnp-ov';
        overlay.innerHTML =
            '<div class="lnp-box" role="dialog" aria-modal="true">' +
                '<div class="lnp-inputrow">' +
                    '<i class="bi bi-search"></i>' +
                    '<input type="text" class="lnp-input" autocomplete="off" spellcheck="false">' +
                    '<span class="lnp-esc">Esc</span>' +
                '</div>' +
                '<div class="lnp-list"></div>' +
            '</div>';
        document.body.appendChild(overlay);
        input = overlay.querySelector('.lnp-input');
        list = overlay.querySelector('.lnp-list');

        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        input.addEventListener('input', function () { renderResults(input.value); });
        input.addEventListener('keydown', onInputKeydown);
    }

    function staticCommands() {
        var cmds = [];
        cmds.push({
            type: 'cmd', icon: 'bi-file-earmark-plus', label: t('cpNewNote', 'New note'),
            run: function () { if (typeof window.openModal === 'function') window.openModal(); }
        });
        if (window.TagsCalendar && typeof window.TagsCalendar.openCalendar === 'function') {
            cmds.push({
                type: 'cmd', icon: 'bi-calendar3', label: t('cpOpenCalendar', 'Open calendar'),
                run: function () { window.TagsCalendar.openCalendar(); }
            });
        }
        if (window.taskBoard && typeof window.taskBoard.toggle === 'function') {
            cmds.push({
                type: 'cmd', icon: 'bi-kanban', label: t('cpToggleTaskBoard', 'Toggle task board'),
                run: function () { window.taskBoard.toggle(); }
            });
        }
        var viewBtn = document.getElementById('toggleViewButton');
        if (viewBtn) {
            cmds.push({
                type: 'cmd', icon: 'bi-grid-3x3-gap', label: t('cpToggleView', 'Toggle grid/list view'),
                run: function () { viewBtn.click(); }
            });
        }
        if (window.themeManager && typeof window.themeManager.toggleTheme === 'function') {
            cmds.push({
                type: 'cmd', icon: 'bi-circle-half', label: t('cpToggleTheme', 'Toggle theme'),
                run: function () { window.themeManager.toggleTheme(); }
            });
        }
        if (window.AppLock && typeof window.AppLock.isEnabled === 'function' && window.AppLock.isEnabled()) {
            cmds.push({
                type: 'cmd', icon: 'bi-lock', label: t('cpLockNow', 'Lock now'),
                run: function () { window.AppLock.lockNow(); }
            });
        }
        return cmds;
    }

    function fetchNotesCached() {
        if (notesCache) return Promise.resolve(notesCache);
        if (!window.notesDB || typeof window.notesDB.getAllNotes !== 'function') return Promise.resolve([]);
        return window.notesDB.getAllNotes().then(function (notes) {
            notesCache = Array.isArray(notes) ? notes : [];
            return notesCache;
        }).catch(function () { return []; });
    }

    function renderResults(query) {
        query = (query || '').trim().toLowerCase();
        var cmds = staticCommands();

        if (!query) {
            currentItems = cmds;
            paint(cmds, []);
            return;
        }

        var matchedCmds = cmds.filter(function (c) { return c.label.toLowerCase().indexOf(query) !== -1; });

        fetchNotesCached().then(function (notes) {
            var matchedNotes = notes.filter(function (n) {
                var title = (n.title || '').toLowerCase();
                if (title.indexOf(query) !== -1) return true;
                var plain = toPlainSnippet(n.content, 4000).toLowerCase();
                return plain.indexOf(query) !== -1;
            }).slice(0, MAX_RESULTS).map(function (n) {
                return {
                    type: 'note', icon: n.pinned ? 'bi-pin-angle-fill' : 'bi-file-earmark-text',
                    label: n.title || t('cpUntitled', 'Untitled note'),
                    snippet: toPlainSnippet(n.content, 90),
                    run: function () {
                        if (typeof window.openModal === 'function') window.openModal(n.id, n.content, n.creationTime);
                    }
                };
            });

            currentItems = matchedCmds.concat(matchedNotes);
            paint(matchedCmds, matchedNotes);
        });
    }

    function paint(cmds, notes) {
        activeIndex = currentItems.length ? 0 : -1;
        if (!currentItems.length) {
            list.innerHTML = '<div class="lnp-empty">' + escapeHtml(t('cpNoResults', 'Nothing found')) + '</div>';
            return;
        }
        var html = '';
        if (cmds.length) {
            html += '<div class="lnp-grouphd">' + escapeHtml(t('cpActions', 'Actions')) + '</div>';
            cmds.forEach(function (c, i) { html += itemHtml(c, i); });
        }
        if (notes.length) {
            html += '<div class="lnp-grouphd">' + escapeHtml(t('cpNotes', 'Notes')) + '</div>';
            notes.forEach(function (n, i) { html += itemHtml(n, cmds.length + i); });
        }
        list.innerHTML = html;
        list.querySelectorAll('.lnp-item').forEach(function (el) {
            el.addEventListener('mouseenter', function () { setActive(parseInt(el.dataset.idx, 10)); });
            el.addEventListener('click', function () { activate(parseInt(el.dataset.idx, 10)); });
        });
        highlightActive();
    }

    function itemHtml(item, idx) {
        return '<div class="lnp-item" data-idx="' + idx + '">' +
            '<i class="bi ' + item.icon + '"></i>' +
            '<span class="lnp-title">' + escapeHtml(item.label) +
                (item.snippet ? '<span class="lnp-snippet">' + escapeHtml(item.snippet) + '</span>' : '') +
            '</span>' +
        '</div>';
    }

    function setActive(idx) { activeIndex = idx; highlightActive(); }

    function highlightActive() {
        var els = list.querySelectorAll('.lnp-item');
        els.forEach(function (el, i) {
            var on = i === activeIndex;
            el.classList.toggle('lnp-active', on);
            if (on) el.scrollIntoView({ block: 'nearest' });
        });
    }

    function activate(idx) {
        var item = currentItems[idx];
        if (!item) return;
        close();
        try { item.run(); } catch (e) { /* never let a broken action crash the palette */ }
    }

    function onInputKeydown(e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (currentItems.length) setActive((activeIndex + 1) % currentItems.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (currentItems.length) setActive((activeIndex - 1 + currentItems.length) % currentItems.length); }
        else if (e.key === 'Enter') { e.preventDefault(); activate(activeIndex); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
    }

    function isOpen() { return !!(overlay && overlay.classList.contains('lnp-open')); }

    function open() {
        // Never expose note titles/search over a locked app
        if (window.AppLock && typeof window.AppLock.isEnabled === 'function' &&
            window.AppLock.isEnabled() && !window.AppLock.isUnlocked()) return;
        buildDOM();
        notesCache = null;
        input.value = '';
        overlay.classList.add('lnp-open');
        renderResults('');
        setTimeout(function () { input.focus(); }, 0);
    }

    function close() {
        if (!overlay) return;
        overlay.classList.remove('lnp-open');
        notesCache = null;
    }

    function toggle() { if (isOpen()) close(); else open(); }

    document.addEventListener('keydown', function (e) {
        var k = (e.key || '').toLowerCase();
        if ((e.ctrlKey || e.metaKey) && k === 'k') {
            // The rich-text editor already binds Ctrl+K to "Insert link" —
            // don't steal the shortcut while the user is typing inside it,
            // or both the link modal and the palette would open at once.
            var active = document.activeElement;
            if (active && active.closest && active.closest('.lne-editor')) return;
            e.preventDefault();
            toggle();
        }
    });
})();
