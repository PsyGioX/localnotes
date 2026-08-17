/**
 * Web Share Target / app-shortcut entry points.
 *
 * manifest.json already declares:
 *   - share_target: GET / with params title/text/url
 *   - shortcuts: ?action=new | ?action=search | ?action=import
 * ...but nothing in the app ever read those query params — sharing to
 * Local Notes from another app (or using a Home Screen shortcut) opened the
 * app and silently dropped whatever was shared. This file is the missing
 * receiving end, loaded last so notesDB/openModal/the editor are ready.
 */
(function () {
    'use strict';

    function escapeHtmlLocal(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Poll for the editor instance rather than assume timing — same
    // defensive pattern already used elsewhere in this app (e.g.
    // workspaces-integration.js) since editor init is itself async.
    function waitForEditorReady(maxWaitMs) {
        return new Promise((resolve) => {
            const start = Date.now();
            (function poll() {
                if (typeof localNotesEditorInstance !== 'undefined' && localNotesEditorInstance &&
                    typeof localNotesEditorInstance.setContent === 'function') {
                    resolve(localNotesEditorInstance);
                } else if (Date.now() - start > maxWaitMs) {
                    resolve(null);
                } else {
                    setTimeout(poll, 100);
                }
            })();
        });
    }

    // Opens a new, blank note and pre-fills it with the shared content.
    // Never auto-saves on the user's behalf — they review it in the editor
    // like any other note and hit Save themselves.
    async function createNoteFromShare(title, text, url) {
        if (typeof window.openModal !== 'function') return;
        const parts = [];
        if (title && title.trim() && !(text && text.trim())) parts.push('<h2>' + escapeHtmlLocal(title.trim()) + '</h2>');
        if (text && text.trim()) parts.push('<p>' + escapeHtmlLocal(text.trim()).replace(/\n/g, '<br>') + '</p>');
        if (url && url.trim()) parts.push('<p><a href="' + escapeHtmlLocal(url.trim()) + '" target="_blank" rel="noopener">' + escapeHtmlLocal(url.trim()) + '</a></p>');
        const content = parts.join('') || '<p><br></p>';

        window.openModal(); // opens the editor with a fresh, unsaved note
        const ed = await waitForEditorReady(4000);
        if (ed) ed.setContent(content);
    }

    function cleanUrl(paramsToStrip) {
        try {
            const url = new URL(window.location.href);
            paramsToStrip.forEach(p => url.searchParams.delete(p));
            const clean = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash;
            window.history.replaceState({}, document.title, clean);
        } catch (e) { /* not fatal — worst case the params linger in the address bar */ }
    }

    function run() {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        const sharedTitle = params.get('title');
        const sharedText = params.get('text');
        const sharedUrl = params.get('url');
        const hasShareData = !!((sharedTitle && sharedTitle.trim()) || (sharedText && sharedText.trim()) || (sharedUrl && sharedUrl.trim()));

        if (hasShareData) {
            createNoteFromShare(sharedTitle, sharedText, sharedUrl);
            cleanUrl(['title', 'text', 'url']);
            return;
        }

        if (action === 'new') {
            if (typeof window.openModal === 'function') window.openModal();
            cleanUrl(['action']);
        } else if (action === 'search') {
            const input = document.getElementById('searchInput');
            if (input) { input.focus(); input.select(); }
            cleanUrl(['action']);
        } else if (action === 'import') {
            const importBtn = document.getElementById('importButton');
            if (importBtn) importBtn.click();
            cleanUrl(['action']);
        }
    }

    // Wait for the rest of the app (notesDB, openModal, editor) to finish
    // its own startup before acting — this script loads last in
    // script-loader.js specifically so that's normally already true, but a
    // short delay avoids any race on first paint.
    setTimeout(run, 150);
})();
