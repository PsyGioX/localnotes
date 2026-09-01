// ============================================================================
// NOTES SIDEBAR — collapsible right panel listing every note in the current
// workspace, kept in sync with the main search box, with click-to-jump
// (scrolls to and highlights the note in the main grid, loading it first via
// "Load more" if it hasn't been rendered yet).
// ============================================================================
(function () {
    'use strict';

    const COLLAPSE_KEY = 'ln_sidebar_collapsed';
    const MOBILE_BREAKPOINT = 900;

    function gt(key, fallback) {
        try {
            if (typeof t === 'function') {
                const v = t(key);
                return (v && v !== key) ? v : fallback;
            }
        } catch (_) { /* ignore */ }
        return fallback;
    }

    let sidebarEl, listEl, headerCountEl, emptyEl, toggleTabEl, backdropEl;
    let selectionBarEl, selectionTextEl;
    let highlightTimeout = null;
    let currentQuery = '';
    let selectedNoteId = null;

    // ── DOM scaffolding ─────────────────────────────────────────────────────
    function buildSidebar() {
        if (document.getElementById('notesSidebar')) return;

        sidebarEl = document.createElement('aside');
        sidebarEl.id = 'notesSidebar';
        sidebarEl.className = 'ln-sidebar';
        sidebarEl.innerHTML =
            '<div class="ln-sidebar-header">' +
                '<span class="ln-sidebar-title"></span>' +
                '<button type="button" class="ln-sidebar-close" aria-label="Close"><i class="bi bi-x-lg"></i></button>' +
            '</div>' +
            '<div class="ln-sidebar-selection-bar" style="display:none">' +
                '<span class="ln-sidebar-selection-text"></span>' +
                '<button type="button" class="ln-sidebar-clear-selection"></button>' +
            '</div>' +
            '<div class="ln-sidebar-list"></div>' +
            '<div class="ln-sidebar-empty" style="display:none">' +
                '<i class="bi bi-journal-text"></i>' +
                '<p class="ln-sidebar-empty-text"></p>' +
            '</div>';
        document.body.appendChild(sidebarEl);

        toggleTabEl = document.createElement('button');
        toggleTabEl.type = 'button';
        toggleTabEl.id = 'sidebarToggleTab';
        toggleTabEl.className = 'ln-sidebar-toggle-tab';
        toggleTabEl.innerHTML = '<i class="bi bi-layout-text-sidebar-reverse"></i>';
        toggleTabEl.title = gt('sidebarToggle', 'All notes');
        document.body.appendChild(toggleTabEl);

        backdropEl = document.createElement('div');
        backdropEl.className = 'ln-sidebar-backdrop';
        document.body.appendChild(backdropEl);

        listEl = sidebarEl.querySelector('.ln-sidebar-list');
        headerCountEl = sidebarEl.querySelector('.ln-sidebar-title');
        emptyEl = sidebarEl.querySelector('.ln-sidebar-empty');
        selectionBarEl = sidebarEl.querySelector('.ln-sidebar-selection-bar');
        selectionTextEl = sidebarEl.querySelector('.ln-sidebar-selection-text');

        toggleTabEl.addEventListener('click', toggleSidebar);
        sidebarEl.querySelector('.ln-sidebar-close').addEventListener('click', closeSidebar);
        backdropEl.addEventListener('click', closeSidebar);
        sidebarEl.querySelector('.ln-sidebar-clear-selection').addEventListener('click', clearSelection);
        sidebarEl.querySelector('.ln-sidebar-clear-selection').textContent = gt('sidebarClearSelection', 'Clear');


        let collapsed = true;
        try { collapsed = localStorage.getItem(COLLAPSE_KEY) !== '0'; } catch (_) { /* ignore */ }
        setCollapsed(collapsed, /*skipSave*/ true);
    }

    function isMobile() { return window.innerWidth <= MOBILE_BREAKPOINT; }

    function setCollapsed(collapsed, skipSave) {
        sidebarEl.classList.toggle('ln-sidebar-open', !collapsed);
        toggleTabEl.classList.toggle('ln-sidebar-open', !collapsed);
        backdropEl.classList.toggle('ln-sidebar-open', !collapsed && isMobile());
        if (!skipSave) {
            try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (_) { /* ignore */ }
        }
        if (!collapsed) renderList();
    }

    function toggleSidebar() {
        setCollapsed(sidebarEl.classList.contains('ln-sidebar-open'));
    }
    function closeSidebar() { setCollapsed(true); }

    // ── List rendering ──────────────────────────────────────────────────────
    function snippetFor(note) {
        // Insert a separator at block boundaries first — textContent alone
        // ignores block-level layout, so adjacent <p> tags (the note's
        // title paragraph followed by its first body paragraph) collapse
        // into one run-on word once tags are stripped, e.g. "Seed note
        // 3Body text..." instead of "Seed note 3 Body text...".
        const withBreaks = (note.content || '')
            .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr|td|th)>/gi, '</$1> ')
            .replace(/<br\s*\/?>/gi, ' ');
        const d = document.createElement('div');
        d.innerHTML = (typeof DOMPurify !== 'undefined')
            ? DOMPurify.sanitize(withBreaks, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
            : withBreaks.replace(/<[^>]*>/g, ' ');
        return (d.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function renderList() {
        if (!sidebarEl) return;
        const state = (typeof _notesRenderState !== 'undefined') ? _notesRenderState : { all: [], allTags: [] };
        const notes = state.all || [];

        headerCountEl.textContent = gt('sidebarAllNotes', 'All notes') + ' (' + notes.length + ')';

        if (notes.length === 0) {
            listEl.style.display = 'none';
            emptyEl.style.display = 'flex';
            emptyEl.querySelector('.ln-sidebar-empty-text').textContent =
                gt('sidebarEmptyNoNotes', "No notes in this workspace yet — click \u201CAdd a note\u201D to create your first one.");
            clearSelection();
            return;
        }

        listEl.style.display = '';
        emptyEl.style.display = 'none';
        listEl.innerHTML = '';

        const title = notes.map(n => notesDB.extractTitle(n.content));
        notes.forEach((note, i) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'ln-sidebar-item';
            item.dataset.noteId = note.id;

            const titleText = title[i] || gt('untitled', 'Untitled');
            const snippet = snippetFor(note);

            const titleEl = document.createElement('span');
            titleEl.className = 'ln-sidebar-item-title';
            titleEl.textContent = titleText;
            if (note.pinned) {
                const pin = document.createElement('i');
                pin.className = 'bi bi-pin-angle-fill ln-sidebar-item-pin';
                titleEl.prepend(pin);
            }

            const snippetEl = document.createElement('span');
            snippetEl.className = 'ln-sidebar-item-snippet';
            snippetEl.textContent = snippet;

            item.appendChild(titleEl);
            item.appendChild(snippetEl);
            item.addEventListener('click', function () { jumpToNote(note.id); });
            listEl.appendChild(item);
        });

        applyFilterToList(currentQuery);

        if (selectedNoteId) {
            const stillExists = notes.some(n => n.id === selectedNoteId);
            if (stillExists) {
                const item = listEl.querySelector('.ln-sidebar-item[data-note-id="' + CSS.escape(selectedNoteId) + '"]');
                if (item) item.classList.add('ln-sidebar-item-active');
            } else {
                clearSelection();
            }
        }
    }

    // ── Search integration ──────────────────────────────────────────────────
    // Mirrors filterNotes()'s query parsing/matching, but against the raw
    // note objects (so it also covers notes that haven't been rendered into
    // the main grid yet via pagination) rather than the rendered DOM.
    function noteMatchesRawQuery(note, raw, allTags) {
        if (!raw) return true;
        const q = (typeof parseSearchQuery === 'function') ? parseSearchQuery(raw) : null;
        if (!q) return true;

        if (q.tagMatches.length > 0) {
            const noteTagNames = (note.tags || [])
                .map(id => { const tag = (allTags || []).find(t => t.id === id); return tag ? tag.name.toLowerCase() : ''; })
                .filter(Boolean);
            const allMatch = q.tagMatches.every(searchTag =>
                noteTagNames.some(tagName => tagName === searchTag || tagName.startsWith(searchTag))
            );
            if (!allMatch) return false;
        }

        if (q.isFilters.length > 0) {
            const okAll = q.isFilters.every(f => {
                if (f === 'pinned') return !!note.pinned;
                if (f === 'overdue') return typeof isOverdue === 'function' && !!note.dueDate && isOverdue(note.dueDate);
                if (f === 'today') return typeof isDueToday === 'function' && !!note.dueDate && isDueToday(note.dueDate);
                if (f === 'soon') return typeof isDueSoon === 'function' && !!note.dueDate && isDueSoon(note.dueDate);
                return true;
            });
            if (!okAll) return false;
        }

        if (q.hasFilters.length > 0) {
            const d = document.createElement('div');
            d.innerHTML = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(note.content || '') : (note.content || '');
            const okAll = q.hasFilters.every(f => (typeof noteMatchesHasFilter === 'function') ? noteMatchesHasFilter(d, f) : true);
            if (!okAll) return false;
        }

        if (q.beforeDate || q.afterDate) {
            const created = note.creationTime;
            if (q.beforeDate && created >= q.beforeDate.getTime()) return false;
            if (q.afterDate && created <= q.afterDate.getTime()) return false;
        }

        if (q.textQuery) {
            const allText = snippetFor(note).toLowerCase();
            if (typeof textMatchesQuery === 'function' && !textMatchesQuery(allText, q.textQuery, q.textWords)) return false;
        }

        return true;
    }

    function applyFilterToList(raw) {
        currentQuery = raw || '';
        if (!listEl) return;
        const state = (typeof _notesRenderState !== 'undefined') ? _notesRenderState : { all: [], allTags: [] };
        const byId = {};
        state.all.forEach(n => { byId[n.id] = n; });

        let visibleCount = 0;
        listEl.querySelectorAll('.ln-sidebar-item').forEach(item => {
            const note = byId[item.dataset.noteId];
            const match = note ? noteMatchesRawQuery(note, currentQuery, state.allTags) : true;
            item.classList.toggle('ln-sidebar-item-hidden', !match);
            if (match) visibleCount++;
        });

        const noNotesAtAll = state.all.length === 0;
        const noMatches = !noNotesAtAll && currentQuery && visibleCount === 0;
        emptyEl.style.display = noNotesAtAll || noMatches ? 'flex' : 'none';
        listEl.style.display = noNotesAtAll || noMatches ? 'none' : '';
        if (noMatches) {
            emptyEl.querySelector('.ln-sidebar-empty-text').textContent =
                gt('sidebarEmptyNoMatches', 'No notes match your search.');
        }
    }

    // ── Jump-to-note (click a sidebar item) ─────────────────────────────────
    function jumpToNote(noteId) {
        const state = (typeof _notesRenderState !== 'undefined') ? _notesRenderState : null;
        if (!state) return;

        const index = state.all.findIndex(n => n.id === noteId);
        if (index === -1) return;

        if (isMobile()) closeSidebar();

        const doHighlight = function () {
            const el = document.querySelector('#notesContainer .note[data-note-id="' + CSS.escape(noteId) + '"]');
            if (!el) return;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Persistent highlight — stays until cleared or another note is
            // jumped to, not just a few seconds of fade. The pulse animation
            // still plays briefly on top, as a "look here" cue.
            document.querySelectorAll('.note.ln-note-highlighted').forEach(n => n.classList.remove('ln-note-highlighted', 'ln-note-highlight-pulse'));
            el.classList.add('ln-note-highlighted', 'ln-note-highlight-pulse');
            clearTimeout(highlightTimeout);
            highlightTimeout = setTimeout(function () { el.classList.remove('ln-note-highlight-pulse'); }, 2600);

            selectedNoteId = noteId;
            updateSelectionUI(notesDB.extractTitle(state.all[index].content));
        };

        if (index < state.rendered) {
            doHighlight();
            return;
        }

        // Not rendered yet (beyond the current pagination page) — render
        // everything up to and including this note, same as repeatedly
        // clicking "Load more", then jump to it.
        const container = document.getElementById('notesContainer');
        const btn = document.getElementById('loadMoreNotesBtn');
        if (!container || typeof buildNoteCardElement !== 'function') return;

        state.all.slice(state.rendered, index + 1).forEach(function (note) {
            const noteEl = buildNoteCardElement(note, state.allTags);
            if (btn) container.insertBefore(noteEl, btn); else container.appendChild(noteEl);
        });
        state.rendered = index + 1;
        if (typeof renderLoadMoreButton === 'function') renderLoadMoreButton();
        setTimeout(function () {
            if (typeof hljs !== 'undefined') hljs.highlightAll();
            if (typeof initCodeBlockCopyButtons === 'function') initCodeBlockCopyButtons(container);
            if (typeof fixCodeBlockStyles === 'function') fixCodeBlockStyles(container);
        }, 100);

        setTimeout(doHighlight, 60);
    }

    function updateSelectionUI(title) {
        listEl.querySelectorAll('.ln-sidebar-item-active').forEach(el => el.classList.remove('ln-sidebar-item-active'));
        const item = listEl.querySelector('.ln-sidebar-item[data-note-id="' + CSS.escape(selectedNoteId) + '"]');
        if (item) item.classList.add('ln-sidebar-item-active');

        selectionBarEl.style.display = 'flex';
        selectionTextEl.textContent = gt('sidebarSelected', 'Selected:') + ' ' + (title || gt('untitled', 'Untitled'));
    }

    function clearSelection() {
        clearTimeout(highlightTimeout);
        document.querySelectorAll('.note.ln-note-highlighted').forEach(n => n.classList.remove('ln-note-highlighted', 'ln-note-highlight-pulse'));
        if (listEl) listEl.querySelectorAll('.ln-sidebar-item-active').forEach(el => el.classList.remove('ln-sidebar-item-active'));
        if (selectionBarEl) selectionBarEl.style.display = 'none';
        selectedNoteId = null;
    }

    // Static chrome (toggle-tab tooltip, Clear button) is only set once at
    // buildSidebar() time — which runs at page load, before the user has
    // necessarily picked a language. Re-apply it whenever the language
    // actually changes, not just once.
    function refreshStaticLabels() {
        if (!sidebarEl) return;
        toggleTabEl.title = gt('sidebarToggle', 'All notes');
        sidebarEl.querySelector('.ln-sidebar-clear-selection').textContent = gt('sidebarClearSelection', 'Clear');
        renderList();
    }

    function hookLanguageChange() {
        // updateInterface() is translate.js's actual DOM-update step for a
        // language switch — plain synchronous global function, so wrapping
        // it directly (same pattern as hookLoadNotes below) is simpler and
        // more precise than watching for a side effect via MutationObserver.
        if (typeof window.updateInterface !== 'function' || window.updateInterface.__sidebarWrapped) return;
        const original = window.updateInterface;
        const wrapped = function () {
            const result = original.apply(this, arguments);
            refreshStaticLabels();
            return result;
        };
        wrapped.__sidebarWrapped = true;
        window.updateInterface = wrapped;
    }

    // ── Wire into existing app behavior ─────────────────────────────────────
    function hookLoadNotes() {
        if (typeof window.loadNotes !== 'function' || window.loadNotes.__sidebarWrapped) return;
        const original = window.loadNotes;
        const wrapped = function () {
            const result = original.apply(this, arguments);
            if (result && typeof result.then === 'function') {
                result.then(renderList).catch(function () { /* ignore */ });
            } else {
                renderList();
            }
            return result;
        };
        wrapped.__sidebarWrapped = true;
        window.loadNotes = wrapped;
    }

    function hookSearch() {
        const input = document.getElementById('searchInput');
        if (!input || input.__sidebarHooked) return;
        input.__sidebarHooked = true;
        input.addEventListener('input', function () { applyFilterToList(input.value.trim()); });
    }

    function init() {
        buildSidebar();
        hookLoadNotes();
        hookSearch();
        hookLanguageChange();
        renderList();
        window.addEventListener('resize', function () {
            backdropEl.classList.toggle('ln-sidebar-open', sidebarEl.classList.contains('ln-sidebar-open') && isMobile());
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
