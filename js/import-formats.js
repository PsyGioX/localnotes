/**
 * Import from Notion / Evernote / Google Keep
 *
 * No external ZIP library — implements just enough of the ZIP format (End
 * Of Central Directory + Central Directory + Local File Headers) to read
 * entries, using the browser's native DecompressionStream('deflate-raw')
 * for the actual decompression. Keeps this app's zero-dependency approach
 * even for a feature that would normally reach for JSZip.
 */
(function () {
    'use strict';

    function t(key, fallback) {
        if (typeof window.t === 'function') {
            const v = window.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    // ── Minimal ZIP reader ──────────────────────────────────────────────

    function findEndOfCentralDirectory(view, byteLength) {
        const EOCD_SIG = 0x06054b50;
        const maxCommentLen = 65535;
        const searchStart = Math.max(0, byteLength - 22 - maxCommentLen);
        for (let i = byteLength - 22; i >= searchStart; i--) {
            if (view.getUint32(i, true) === EOCD_SIG) return i;
        }
        throw new Error('Not a valid ZIP file');
    }

    function readZipEntries(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        const bytes = new Uint8Array(arrayBuffer);
        const eocdOffset = findEndOfCentralDirectory(view, bytes.length);
        const totalEntries = view.getUint16(eocdOffset + 10, true);
        const cdOffset = view.getUint32(eocdOffset + 16, true);

        const CD_SIG = 0x02014b50;
        const entries = [];
        let ptr = cdOffset;
        for (let i = 0; i < totalEntries; i++) {
            if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== CD_SIG) {
                throw new Error('Corrupt or unsupported ZIP central directory');
            }
            const compressionMethod = view.getUint16(ptr + 10, true);
            const compressedSize = view.getUint32(ptr + 20, true);
            const fileNameLen = view.getUint16(ptr + 28, true);
            const extraLen = view.getUint16(ptr + 30, true);
            const commentLen = view.getUint16(ptr + 32, true);
            const localHeaderOffset = view.getUint32(ptr + 42, true);
            const nameBytes = bytes.slice(ptr + 46, ptr + 46 + fileNameLen);
            const fileName = new TextDecoder('utf-8').decode(nameBytes);
            entries.push({ fileName, compressionMethod, compressedSize, localHeaderOffset });
            ptr += 46 + fileNameLen + extraLen + commentLen;
        }
        return entries;
    }

    async function extractZipEntry(arrayBuffer, entry) {
        const view = new DataView(arrayBuffer);
        const bytes = new Uint8Array(arrayBuffer);
        const LFH_SIG = 0x04034b50;
        const off = entry.localHeaderOffset;
        if (view.getUint32(off, true) !== LFH_SIG) throw new Error('Bad local file header for ' + entry.fileName);
        const nameLen = view.getUint16(off + 26, true);
        const extraLen = view.getUint16(off + 28, true);
        const dataStart = off + 30 + nameLen + extraLen;
        const compressedData = bytes.slice(dataStart, dataStart + entry.compressedSize);

        if (entry.compressionMethod === 0) return compressedData; // stored, no compression
        if (entry.compressionMethod === 8) {
            if (typeof DecompressionStream !== 'function') {
                throw new Error('This browser cannot decompress ZIP files (no DecompressionStream support)');
            }
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(compressedData);
            writer.close();
            const buf = await new Response(ds.readable).arrayBuffer();
            return new Uint8Array(buf);
        }
        throw new Error('Unsupported ZIP compression method (' + entry.compressionMethod + ') for ' + entry.fileName);
    }

    async function readZipTextFiles(file, extensions) {
        const arrayBuffer = await file.arrayBuffer();
        const entries = readZipEntries(arrayBuffer);
        const matches = entries.filter(e => {
            const lower = e.fileName.toLowerCase();
            return !e.fileName.endsWith('/') && extensions.some(ext => lower.endsWith(ext));
        });
        const results = [];
        for (const entry of matches) {
            try {
                const bytes = await extractZipEntry(arrayBuffer, entry);
                results.push({ fileName: entry.fileName, text: new TextDecoder('utf-8').decode(bytes) });
            } catch (e) { /* skip unreadable entries, keep going with the rest */ }
        }
        return results;
    }

    // ── Shared save helper ──────────────────────────────────────────────

    async function saveImportedNote(html) {
        const id = typeof secureNoteId === 'function' ? secureNoteId() : ('note_' + Date.now() + '_' + Math.random().toString(36).slice(2));
        const now = Date.now();
        await window.notesDB.saveNote({
            id, content: html, creationTime: now, lastModified: now,
            title: window.notesDB.extractTitle(html)
        });
    }

    function reportResult(imported, errors) {
        if (imported > 0) {
            const msg = errors > 0
                ? (t('importCompletedWithErrors', null) || `Imported ${imported}, errors: ${errors}`).replace('{count}', imported).replace('{errors}', errors)
                : (t('importCompleted', null) || `Imported ${imported} notes`).replace('{count}', imported);
            if (typeof window.showCustomAlert === 'function') window.showCustomAlert(t('success', 'Success'), msg, 'success');
            if (typeof window.loadNotes === 'function') window.loadNotes();
        } else {
            if (typeof window.showCustomAlert === 'function') {
                window.showCustomAlert(t('error', 'Error'), t('errorNoFilesImported', 'No files imported'), 'error');
            }
        }
    }

    function markdownToHtml(text) {
        if (typeof LNMarkdown !== 'undefined' && LNMarkdown.parse) return LNMarkdown.parse(text);
        // Same basic fallback regex chain used elsewhere in this app when
        // the advanced parser isn't loaded
        return text
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/\n\n+/g, '</p><p>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    function escapeHtmlLocal(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ── Notion (Markdown & CSV export .zip, or loose .md/.html files) ───

    // Notion appends a 32-char hex page id to exported filenames/titles —
    // strip it so imported notes have clean, readable titles.
    function cleanNotionTitle(name) {
        const base = name.split('/').pop().replace(/\.(md|html)$/i, '');
        return base.replace(/\s+[0-9a-f]{32}$/i, '').trim();
    }

    // Notion's markdown export repeats the page title as an H1 on the first
    // line — drop it since extractTitle() already derives the note title
    // from the (cleaned) filename, avoiding a duplicate heading.
    function stripLeadingTitleHeading(md, title) {
        const lines = md.split('\n');
        if (lines[0] && lines[0].replace(/^#\s+/, '').trim() === title) {
            return lines.slice(1).join('\n').replace(/^\s+/, '');
        }
        return md;
    }

    async function importNotionSource(files) {
        let imported = 0, errors = 0;
        for (const file of files) {
            try {
                const lower = file.name.toLowerCase();
                if (lower.endsWith('.zip')) {
                    const entries = await readZipTextFiles(file, ['.md', '.html', '.htm']);
                    for (const entry of entries) {
                        const title = cleanNotionTitle(entry.fileName);
                        const isHtml = entry.fileName.toLowerCase().match(/\.html?$/);
                        let html = isHtml
                            ? DOMPurify.sanitize(entry.text)
                            : markdownToHtml(stripLeadingTitleHeading(entry.text, title));
                        if (!html.trim()) continue;
                        // Prepend the cleaned title as a heading since we just stripped Notion's own
                        html = '<h2>' + escapeHtmlLocal(title) + '</h2>' + html;
                        await saveImportedNote(html);
                        imported++;
                    }
                } else if (lower.endsWith('.md') || lower.endsWith('.html') || lower.endsWith('.htm')) {
                    const text = await file.text();
                    const title = cleanNotionTitle(file.name);
                    let html = lower.endsWith('.md')
                        ? markdownToHtml(stripLeadingTitleHeading(text, title))
                        : DOMPurify.sanitize(text);
                    html = '<h2>' + escapeHtmlLocal(title) + '</h2>' + html;
                    await saveImportedNote(html);
                    imported++;
                } else {
                    errors++;
                }
            } catch (e) {
                errors++;
                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert(t('error', 'Error'), file.name + ': ' + e.message, 'error');
                }
            }
        }
        reportResult(imported, errors);
    }

    // ── Evernote (.enex) ──────────────────────────────────────────────

    // ENEX timestamps look like 20260817T140500Z
    function parseEnexDate(s) {
        if (!s) return Date.now();
        const m = String(s).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
        if (!m) return Date.now();
        const d = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        return isNaN(d) ? Date.now() : d;
    }

    // ENML (Evernote's note body format) is XHTML-ish wrapped in
    // <en-note>...</en-note> — strip the wrapper/DOCTYPE and sanitize the
    // rest as regular HTML. Embedded <en-media> resources (attachments,
    // inline images) aren't fetched/decoded in this first pass — noted as
    // a known limitation rather than silently dropping content without a trace.
    function enmlToHtml(enml) {
        let body = String(enml || '')
            .replace(/<\?xml[^>]*\?>/i, '')
            .replace(/<!DOCTYPE[^>]*>/i, '')
            .replace(/<\/?en-note[^>]*>/gi, '');
        const hasMedia = /<en-media/i.test(body);
        body = body.replace(/<en-media[^>]*\/?>/gi, '<p><em>[attachment omitted — open the original .enex to recover it]</em></p>');
        let html = DOMPurify.sanitize(body);
        if (hasMedia && typeof t === 'function') { /* limitation already communicated inline above */ }
        return html;
    }

    async function importEvernoteEnex(files) {
        let imported = 0, errors = 0;
        for (const file of files) {
            try {
                const text = await file.text();
                const doc = new DOMParser().parseFromString(text, 'text/xml');
                if (doc.querySelector('parsererror')) throw new Error('Malformed .enex XML');
                const notes = doc.querySelectorAll('note');
                if (!notes.length) { errors++; continue; }
                for (const noteEl of notes) {
                    const title = (noteEl.querySelector('title')?.textContent || '').trim();
                    const contentEl = noteEl.querySelector('content');
                    const enml = contentEl ? contentEl.textContent : '';
                    const html = (title ? '<h2>' + escapeHtmlLocal(title) + '</h2>' : '') + enmlToHtml(enml);
                    if (!html.trim()) continue;
                    const created = parseEnexDate(noteEl.querySelector('created')?.textContent);
                    const updated = parseEnexDate(noteEl.querySelector('updated')?.textContent) || created;
                    const id = typeof secureNoteId === 'function' ? secureNoteId() : ('note_' + Date.now() + '_' + Math.random().toString(36).slice(2));
                    await window.notesDB.saveNote({
                        id, content: html, creationTime: created, lastModified: updated,
                        title: window.notesDB.extractTitle(html)
                    });
                    imported++;
                }
            } catch (e) {
                errors++;
                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert(t('error', 'Error'), file.name + ': ' + e.message, 'error');
                }
            }
        }
        reportResult(imported, errors);
    }

    // ── Google Keep (Google Takeout .zip, or loose Keep/*.json files) ───

    // Matches the editor's own .cl-item markup (localnoteseditor/core.js
    // _makeChecklistItem) so imported checklists are indistinguishable from
    // ones typed by hand. The editor's _initChecklists() self-heals any
    // missing pieces (opts button, etc.) the first time the note is opened,
    // so this only needs the checkbox + text input with their state attrs.
    function keepJsonToHtml(data) {
        const parts = [];
        if (data.textContent) {
            parts.push('<p>' + escapeHtmlLocal(data.textContent).replace(/\n/g, '<br>') + '</p>');
        }
        if (Array.isArray(data.listContent)) {
            data.listContent.forEach(li => {
                const checked = !!li.isChecked;
                const value = escapeHtmlLocal(li.text || '');
                parts.push(
                    '<div class="cl-item' + (checked ? ' cl-item-done' : '') + '">' +
                        '<input type="checkbox" class="cl-cb" data-checked="' + (checked ? 'true' : 'false') + '"' + (checked ? ' checked' : '') + '>' +
                        '<input type="text" class="cl-text' + (checked ? ' cl-done' : '') + '" value="' + value + '">' +
                    '</div>'
                );
            });
        }
        return parts.join('');
    }

    async function importGoogleKeepSource(files) {
        let imported = 0, errors = 0;
        const jsonFiles = []; // { name, text }

        for (const file of files) {
            const lower = file.name.toLowerCase();
            try {
                if (lower.endsWith('.zip')) {
                    const entries = await readZipTextFiles(file, ['.json']);
                    entries.forEach(e => jsonFiles.push(e));
                } else if (lower.endsWith('.json')) {
                    jsonFiles.push({ fileName: file.name, text: await file.text() });
                } else {
                    errors++;
                }
            } catch (e) {
                errors++;
                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert(t('error', 'Error'), file.name + ': ' + e.message, 'error');
                }
            }
        }

        for (const jf of jsonFiles) {
            try {
                const data = JSON.parse(jf.text);
                // Google Keep also exports Labels.json / other metadata files
                // that won't have this shape — skip anything that isn't a note.
                if (typeof data !== 'object' || data === null) continue;
                if (data.textContent == null && !Array.isArray(data.listContent)) continue;

                const title = (data.title || '').trim();
                const html = (title ? '<h2>' + escapeHtmlLocal(title) + '</h2>' : '') + keepJsonToHtml(data);
                if (!html.trim()) continue;

                const created = data.createdTimestampUsec ? Math.round(data.createdTimestampUsec / 1000) : Date.now();
                const updated = data.userEditedTimestampUsec ? Math.round(data.userEditedTimestampUsec / 1000) : created;
                const id = typeof secureNoteId === 'function' ? secureNoteId() : ('note_' + Date.now() + '_' + Math.random().toString(36).slice(2));
                await window.notesDB.saveNote({
                    id, content: html, creationTime: created, lastModified: updated,
                    pinned: !!data.isPinned,
                    title: window.notesDB.extractTitle(html)
                });
                imported++;
            } catch (e) { errors++; }
        }
        reportResult(imported, errors);
    }

    window.LNImportFormats = {
        importNotionSource,
        importEvernoteEnex,
        importGoogleKeepSource,
        // exposed for potential reuse/testing
        readZipEntries, extractZipEntry, readZipTextFiles
    };
})();
