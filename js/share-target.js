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

    function t(key, fallback) {
        if (typeof window.t === 'function') {
            const v = window.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    function lnBase64UrlDecode(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    // Reverses js/index.js's encodeNoteForShareLink(): 'z' prefix = gzip
    // compressed (needs DecompressionStream), 'r' prefix = raw base64.
    async function decodeNoteFromShareLink(encoded) {
        const marker = encoded.charAt(0);
        const bytes = lnBase64UrlDecode(encoded.slice(1));
        let jsonBytes = bytes;
        if (marker === 'z') {
            if (typeof DecompressionStream !== 'function') {
                throw new Error('This browser cannot decompress this link');
            }
            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            writer.write(bytes);
            writer.close();
            jsonBytes = new Uint8Array(await new Response(ds.readable).arrayBuffer());
        }
        const json = new TextDecoder().decode(jsonBytes);
        const data = JSON.parse(json);
        return { title: data.t || '', content: data.c || '' };
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

    function cleanHash() {
        try {
            const url = new URL(window.location.href);
            url.hash = '';
            window.history.replaceState({}, document.title, url.pathname + url.search);
        } catch (e) { /* not fatal */ }
    }

    // Opens a note someone shared as a #shared=... link. This is content
    // encoded straight into the URL (see js/index.js buildShareableNoteLink) —
    // never auto-saved into notesDB on open, so it can't silently overwrite
    // or clutter the recipient's own notes; they review it and hit Save
    // themselves, same as any freshly-typed note.
    async function openSharedNoteLink(encoded) {
        cleanHash(); // do this first so a reload never re-triggers the same open
        let note;
        try {
            note = await decodeNoteFromShareLink(encoded);
        } catch (e) {
            if (typeof window.showCustomAlert === 'function') {
                window.showCustomAlert(
                    t('error', 'Error'),
                    t('sharedNoteLinkBroken', 'This share link looks broken or incomplete.'),
                    'error'
                );
            }
            return;
        }
        if (typeof window.openModal !== 'function') return;
        window.openModal();
        const ed = await waitForEditorReady(4000);
        if (ed) ed.setContent(note.content);
        if (typeof window.showCustomAlert === 'function') {
            window.showCustomAlert(
                t('sharedNoteOpenedTitle', 'Shared note'),
                t('sharedNoteOpenedBody', 'Someone shared this note with you. Save it if you want to keep it.'),
                'info'
            );
        }
    }

    function run() {
        const hash = window.location.hash;
        if (hash && hash.indexOf('#shared=') === 0) {
            openSharedNoteLink(hash.slice('#shared='.length));
            return;
        }

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
