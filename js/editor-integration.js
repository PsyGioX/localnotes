/**
 * LocalNotesEditor Integration
 * Integrates LocalNotesEditor with the Local Notes application
 */

let localNotesEditorInstance = null;

function initializeLocalNotesEditor() {
    const container = document.getElementById('editorContainer');
    if (!container) { console.error('Editor container not found'); return false; }
    try {
        if (typeof LocalNotesEditor === 'undefined') {
            setTimeout(initializeLocalNotesEditor, 100);
            return false;
        }
        const isTablet = window.innerWidth <= 1024 && window.innerWidth > 480;
        const placeholder = (typeof t === 'function' ? t('editorPlaceholder') : null) || 'Start typing...';
        localNotesEditorInstance = new LocalNotesEditor('editorContainer', {
            height: isTablet ? 'calc(var(--vh, 1vh) * 100 - 200px)' : '500px',
            placeholder,
            toolbar: true,
            statusbar: true,
            onWikiLinkSearch: searchNotesForWikiLink,
            onWikiLinkOpen: openNoteFromWikiLink
        });
        return true;
    } catch (e) { console.error('Error initializing LocalNotesEditor:', e); return false; }
}

// Wiki-link autocomplete — search notesDB for the editor's [[ popup.
// Called on every keystroke inside "[[...", so it must stay fast and never throw.
async function searchNotesForWikiLink(query) {
    if (!window.notesDB || typeof window.notesDB.getAllNotes !== 'function') return [];
    try {
        const all = await window.notesDB.getAllNotes();
        const q = (query || '').trim().toLowerCase();
        const excludeId = (typeof window.getCurrentNoteId === 'function') ? window.getCurrentNoteId() : null;
        let matches = all.filter(n => n.id !== excludeId && (!q || (n.title || '').toLowerCase().includes(q)));
        matches.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        const untitled = (typeof t === 'function' ? t('cpUntitled') : null) || 'Untitled note';
        return matches.slice(0, 8).map(n => ({ id: n.id, title: n.title || untitled }));
    } catch (e) { return []; }
}

// Wiki-link click — resolve the id to a note and open it in the edit modal.
// Explicitly closes the currently-open note first (rather than swapping
// content into the already-open modal in place) so switching notes via a
// wiki-link is a clean, visible "close this note → open that note" action —
// same modal element, but a real open/close cycle rather than a silent
// content swap underneath the user.
function openNoteFromWikiLink(noteId) {
    if (!window.notesDB || typeof window.notesDB.getNote !== 'function' || !noteId) return;
    window.notesDB.getNote(noteId).then(note => {
        if (!note) return;
        if (typeof window.closeModal === 'function') window.closeModal();
        // One frame so the modal actually registers as closed before we
        // reopen it — avoids any state left over from the note we just left.
        requestAnimationFrame(() => {
            if (typeof window.openModal === 'function') window.openModal(note.id, note.content, note.creationTime);
        });
    }).catch(() => {});
}

function getEditorContent()  { return localNotesEditorInstance ? localNotesEditorInstance.getContent() : ''; }
function setEditorContent(h) { if (localNotesEditorInstance) localNotesEditorInstance.setContent(h); }
function getEditorText()     { return localNotesEditorInstance ? localNotesEditorInstance.getText() : ''; }
function clearEditor()       { if (localNotesEditorInstance) localNotesEditorInstance.clear(); }
function destroyEditor()     { if (localNotesEditorInstance) { localNotesEditorInstance.destroy(); localNotesEditorInstance = null; } }
function isEditorInitialized() { return localNotesEditorInstance !== null && !localNotesEditorInstance.isDestroyed; }
function focusEditor()       { if (localNotesEditorInstance && localNotesEditorInstance.editorElement) localNotesEditorInstance.editorElement.focus(); }
function editorUndo()        { if (localNotesEditorInstance) localNotesEditorInstance.undo(); }
function editorRedo()        { if (localNotesEditorInstance) localNotesEditorInstance.redo(); }

function waitForEditorClass() {
    if (typeof LocalNotesEditor === 'undefined') { setTimeout(waitForEditorClass, 50); return; }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initializeLocalNotesEditor, 100));
    } else {
        setTimeout(initializeLocalNotesEditor, 100);
    }
}
waitForEditorClass();

window.localNotesEditorAPI = {
    getContent: getEditorContent, setContent: setEditorContent,
    getText: getEditorText, clear: clearEditor, destroy: destroyEditor,
    isInitialized: isEditorInitialized, focus: focusEditor,
    undo: editorUndo, redo: editorRedo,
    getInstance: () => localNotesEditorInstance
};

/* =============================================================================
   MOBILE KEYBOARD HANDLER
   Keeps the editor modal correctly sized when the virtual keyboard opens/closes.

   Strategy per platform:
   - iOS Safari / Yandex iOS:
       dvh does NOT shrink when keyboard opens.
       visualViewport.height gives the true visible height.
       visualViewport.offsetTop > 0 when the layout viewport scrolled up.
       We set modal height = vv.height and marginTop = vv.offsetTop + safeTop.

   - Android Chrome / Yandex Android / Samsung Internet >= 14:
       dvh DOES shrink, but JS override is harmless and ensures consistency.
       visualViewport.offsetTop is always 0.

   - Samsung Internet < 14:
       No dvh support — JS height override is the only reliable fix.

   - Firefox Android:
       dvh works since v110. visualViewport supported since v63.
       Same JS path works fine.

   - Opera Mobile / UC Browser:
       visualViewport may be absent — guarded with feature check.
   ============================================================================= */
(function () {
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    if (!window.visualViewport) return;  // Opera Mini, very old browsers

    var modal  = null;
    var rafId  = null;

    function getModal() {
        if (!modal) modal = document.getElementById('editModal');
        return modal;
    }

    function isOpen(m) {
        return m && m.style.display !== 'none' && m.style.display !== '';
    }

    /** Read safe-area-inset-top from CSS custom property --sat (set in :root) */
    function getSafeTop() {
        try {
            var v = getComputedStyle(document.documentElement).getPropertyValue('--sat');
            return v ? parseFloat(v) || 0 : 0;
        } catch (e) { return 0; }
    }

    function apply() {
        var m = getModal();
        if (!isOpen(m)) return;
        if (window.innerWidth > 768) return;

        var vv      = window.visualViewport;
        var content = m.querySelector('.modal-content');
        if (!content) return;

        var h = vv.height;

        // Set the visible height — keyboard shrinks vv.height on Android,
        // on iOS dvh doesn't shrink so JS must do it.
        content.style.height    = h + 'px';
        content.style.maxHeight = h + 'px';

        // iOS: vv.offsetTop > 0 means the layout viewport scrolled up when
        // keyboard opened. We compensate with marginTop so the modal stays
        // anchored below the notch/status-bar — but ONLY when offsetTop is
        // meaningful (> safe-area), otherwise we get the "fly up" glitch.
        var offsetTop = vv.offsetTop || 0;
        var safeTop   = getSafeTop();
        // Only apply marginTop for the notch offset, not for keyboard scroll
        content.style.marginTop = (offsetTop > safeTop ? offsetTop : safeTop) + 'px';
    }

    function reset() {
        var m = getModal();
        if (!m) return;
        var content = m.querySelector('.modal-content');
        if (!content) return;
        content.style.height    = '';
        content.style.maxHeight = '';
        content.style.marginTop = '';
    }

    function onVpChange() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(apply);
    }

    window.visualViewport.addEventListener('resize', onVpChange);
    window.visualViewport.addEventListener('scroll', onVpChange);

    document.addEventListener('DOMContentLoaded', function () {
        modal = document.getElementById('editModal');
        if (!modal) return;
        new MutationObserver(function () {
            if (isOpen(modal)) {
                apply();
                // Re-apply after layout settles (iOS keyboard animation ~300ms)
                setTimeout(apply, 150);
                setTimeout(apply, 350);
            } else {
                reset();
            }
        }).observe(modal, { attributes: true, attributeFilter: ['style'] });
    });
})();

/* =============================================================================
   CARET SCROLL — keeps the cursor visible above the keyboard on mobile.
   Works on iOS Safari, Android Chrome, Yandex Browser, Firefox Android.
   ============================================================================= */
(function () {
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    var PADDING        = 24;
    var rafId          = null;
    var timers         = [];
    var userScrolling  = false;
    var scrollEndTimer = null;
    var userTapped     = false;
    var tapResetTimer  = null;

    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function getCaretRect() {
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        var range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        var rects = range.getClientRects();
        if (rects.length > 0) return rects[0];
        var node = range.startContainer;
        if (node.nodeType === 3) node = node.parentElement;
        return node ? node.getBoundingClientRect() : null;
    }

    function scrollCaretIntoView() {
        if (userScrolling) return;
        var modal = document.getElementById('editModal');
        if (!modal || !isModalOpen(modal)) return;

        var body = modal.querySelector('.lne-body');
        if (!body) return;

        var caretRect = getCaretRect();
        if (!caretRect) return;

        var vv       = window.visualViewport;
        var vvBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;

        var toolbar       = modal.querySelector('.lne-toolbar');
        var toolbarBottom = toolbar ? toolbar.getBoundingClientRect().bottom : 0;

        if (caretRect.bottom + PADDING > vvBottom) {
            body.scrollTop += (caretRect.bottom + PADDING - vvBottom);
        } else if (caretRect.top < toolbarBottom + PADDING) {
            body.scrollTop -= (toolbarBottom + PADDING - caretRect.top);
        }
    }

    function isModalOpen(m) {
        return m && m.style.display !== 'none' && m.style.display !== '';
    }

    function scheduleScroll() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(scrollCaretIntoView);
    }

    function scheduleScrollDelayed() {
        if (!userTapped) return;
        clearTimers();
        [80, 200, 400].forEach(function (ms) {
            timers.push(setTimeout(scrollCaretIntoView, ms));
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var modal = document.getElementById('editModal');
        if (!modal) return;
        var body = modal.querySelector('.lne-body');
        var ed   = modal.querySelector('.lne-editor');
        if (!body) return;

        if (ed) {
            ed.addEventListener('touchstart', function () {
                userTapped = true;
                clearTimeout(tapResetTimer);
                tapResetTimer = setTimeout(function () { userTapped = false; }, 1500);
            }, { passive: true });
        }

        body.addEventListener('touchstart', function () {
            userScrolling = true;
            clearTimeout(scrollEndTimer);
        }, { passive: true });

        body.addEventListener('touchend', function () {
            clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(function () { userScrolling = false; }, 300);
        }, { passive: true });

        new MutationObserver(function () {
            if (!isModalOpen(modal)) { userTapped = false; clearTimers(); }
        }).observe(modal, { attributes: true, attributeFilter: ['style'] });
    });

    document.addEventListener('input', function () {
        userScrolling = false;
        userTapped    = true;
        scheduleScroll();
    }, true);

    document.addEventListener('selectionchange', scheduleScroll);

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleScrollDelayed);
    }
})();

/* =============================================================================
   --vh CUSTOM PROPERTY
   Some browsers (Samsung Internet < 14, old Yandex) don't support dvh.
   We set --vh = 1% of the visual viewport height so CSS can use it.
   ============================================================================= */
(function () {
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    function setVh() {
        var vv = window.visualViewport;
        var h  = vv ? vv.height : window.innerHeight;
        document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');
    }

    setVh();
    window.addEventListener('resize', setVh);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setVh);
    }
})();
