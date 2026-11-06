/*
 * Local Notes — a local-first, privacy-focused notes app (PWA): rich-text/Markdown editor,
 * AES-256-GCM encrypted storage in the browser, offline mode, 12 languages. No server-side data.
 * Local Notes — локальное приватное приложение для заметок (PWA): редактор rich-text/Markdown,
 * шифрование AES-256-GCM в браузере, офлайн-режим, 12 языков. Данные не уходят на сервер.
 *
 * Copyright (c) 2026 PsyGioX. Licensed under the MIT License.
 * Source: https://github.com/PsyGioX/localnotes — Site: https://localnotes-three.vercel.app
 */
/**
 * Office-style extension for LocalNotesEditor (loads after core.js).
 *
 *  New ribbon tabs : File · Layout · References · Review
 *  Added to Home   : formatting marks ¶, paragraph shading, text direction, change case, format painter, quick styles
 *  Added to Insert : page break, header & footer, text box, drop cap, bookmark, date & time
 *  Added to View   : navigation pane, read mode
 *  File            : import .docx/.doc/.rtf/.html, export .docx/.doc/PDF/HTML/Markdown/TXT, print, properties
 *
 * Document-level settings (page size/orientation/margins/columns/colour, header, footer, language,
 * title, author) live in editor._docMeta and are stored inside the note as one hidden
 * <div class="lne-docmeta" hidden data-meta="…"> — so they survive save/load, export and import.
 */
(function () {
    'use strict';
    if (typeof LocalNotesEditor === 'undefined' || LocalNotesEditor.prototype._oxInstalled) return;
    var P = LocalNotesEditor.prototype;
    P._oxInstalled = true;

    var CMD = LocalNotesEditor.extCommands = LocalNotesEditor.extCommands || {};
    var BLOCK_SEL = 'p,div:not(.lne-editor):not(.lne-callout):not(.lne-code-wrapper):not(.table-responsive),h1,h2,h3,h4,h5,h6,li,blockquote,pre';

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function lang() { return (window.LNLang && window.LNLang.htmlLang(window.currentLang)) || document.documentElement.lang || 'en'; }
    function isTouch() { return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); }
    function T(ed, k, fb) { return ed._(k, fb); }

    // ═══════════════════════════ document meta ═══════════════════════════
    function defMeta() { return window.LNDocx ? window.LNDocx.defaultMeta() : { size: 'A4', orient: 'portrait', margins: { t: 25.4, r: 25.4, b: 25.4, l: 25.4 }, cols: 1, pageColor: '', border: false, header: '', footer: '', pageNum: false, hyphen: false, title: '', author: '', lang: '' }; }
    function isDefault(m) {
        var d = defMeta(); if (!m) return true;
        return m.size === d.size && m.orient === d.orient && m.cols === d.cols && !m.pageColor && !m.border && !m.header && !m.footer && !m.pageNum && !m.hyphen && !m.title && !m.author && !m.lang &&
            m.margins.t === d.margins.t && m.margins.r === d.margins.r && m.margins.b === d.margins.b && m.margins.l === d.margins.l;
    }
    function luminance(hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 1;
        var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }

    P._oxMeta = function () { if (!this._docMeta) this._docMeta = defMeta(); return this._docMeta; };

    P._oxApplyMeta = function () {
        var m = this._oxMeta(), ed = this.ed, st = ed.style, body = this.body;
        var d = window.LNDocx ? window.LNDocx.pageDims(m) : [210, 297];
        st.setProperty('--ox-w', d[0] + 'mm'); st.setProperty('--ox-h', d[1] + 'mm');
        st.setProperty('--ox-pad', m.margins.t + 'mm ' + m.margins.r + 'mm ' + m.margins.b + 'mm ' + m.margins.l + 'mm');
        st.setProperty('--ox-cols', m.cols || 1);
        st.setProperty('--ox-pl', m.margins.l + 'mm'); st.setProperty('--ox-pr', m.margins.r + 'mm');
        if (m.pageColor) { st.setProperty('--ox-bg', m.pageColor); st.setProperty('--ox-fg', luminance(m.pageColor) > 0.55 ? '#1b1b1b' : '#f2f2f2'); }
        else { st.removeProperty('--ox-bg'); st.removeProperty('--ox-fg'); }
        // подпись разрыва страницы — из текущего языка интерфейса (у импортированных разрывов нет data-label)
        st.setProperty('--ox-pb-label', JSON.stringify(this._('oxPageBreak', 'Page break')));
        ed.setAttribute('data-ox-page', '1');
        ed.classList.toggle('lne-ox-border', !!m.border);
        ed.classList.toggle('lne-ox-landscape', m.orient === 'landscape');
        st.hyphens = m.hyphen ? 'auto' : ''; st.webkitHyphens = m.hyphen ? 'auto' : '';
        if (m.lang) ed.setAttribute('lang', m.lang); else ed.removeAttribute('lang');
        if (body) {
            if (m.header) body.setAttribute('data-ox-hdr', m.header); else body.removeAttribute('data-ox-hdr');
            var f = (m.footer || '') + (m.pageNum ? (m.footer ? '  ·  ' : '') + '#' : '');
            if (f) body.setAttribute('data-ox-ftr', f); else body.removeAttribute('data-ox-ftr');
        }
        this._oxSyncButtons();
        if (this._oxPgSchedule) this._oxPgSchedule(30);
    };
    P._oxSetMeta = function (patch, silent) {
        var m = this._oxMeta(); Object.keys(patch).forEach(function (k) { m[k] = patch[k]; });
        this._docMeta = m; this._oxApplyMeta();
        if (this._oxAutoToc) this._oxAutoToc(true);
        if (!silent) this._notifyChange();
    };

    // getContent/setContent: meta ↔ hidden <div>, footnote list regenerated
    var _get = P.getContent, _set = P.setContent;
    P.getContent = function () {
        var html = _get.call(this), m = this._docMeta;
        if (m && !isDefault(m)) html = '<div class="lne-docmeta" hidden data-meta="' + esc(JSON.stringify(m)) + '"></div>' + html;
        return html;
    };
    P.setContent = function (html) {
        var meta = null;
        if (html && html.indexOf('lne-docmeta') >= 0) {
            var t = document.createElement('div'); t.innerHTML = html;
            var el = t.querySelector('.lne-docmeta');
            if (el) { try { meta = JSON.parse(el.getAttribute('data-meta')); } catch (e) {} el.remove(); html = t.innerHTML; }
        }
        _set.call(this, html);
        var d = defMeta(); this._docMeta = meta ? Object.assign(d, meta, { margins: Object.assign(d.margins, (meta && meta.margins) || {}) }) : d;
        this._oxApplyMeta();
        this._oxRenumberFootnotes(true);
        this._oxRefreshNav();
        this._oxPgSchedule(0);
    };

    // ═══════════════════════════ ribbon injection ═══════════════════════════
    LocalNotesEditor.extendRibbon = function (ed) {
        var _ = function (k, fb) { return ed._(k, fb); };
        var tb = ed.toolbarScroll;
        var tabs = tb.querySelector('.lne-ribbon-tabs');
        var BL = function (cmd, icon, title, label) { return '<button class="lne-btn lne-btn-lg" data-cmd="' + cmd + '" title="' + esc(title) + '" aria-label="' + esc(title) + '"><i class="' + icon + '"></i><span class="lne-lg-label">' + esc(label) + '</span></button>'; };
        var BD = function (cmd, icon, title, label) { return '<button class="lne-btn lne-btn-lg" data-cmd="' + cmd + '" title="' + esc(title) + '" aria-label="' + esc(title) + '" aria-haspopup="true"><i class="' + icon + '"></i><span class="lne-lg-label">' + esc(label) + ' <i class="bi bi-chevron-down lne-dd-caret"></i></span></button>'; };
        var B = function (cmd, icon, title) { return '<button class="lne-btn" data-cmd="' + cmd + '" title="' + esc(title) + '" aria-label="' + esc(title) + '"><i class="' + icon + '"></i></button>'; };
        var G = function (label, lines) { return '<div class="lne-grp"><div class="lne-grp-body">' + lines.map(function (l) { return '<div class="lne-line">' + l + '</div>'; }).join('') + '</div><div class="lne-grp-label">' + esc(label) + '</div></div>'; };
        var panel = function (name, html) { return '<div class="lne-toolbar-row lne-panel" data-tab="' + name + '" role="tabpanel">' + html + '</div>'; };
        var tab = function (name, label) { return '<button class="lne-rtab" type="button" role="tab" data-tab="' + name + '" aria-selected="false">' + esc(label) + '</button>'; };

        // — tabs, Office order: File | Home | Insert | Layout | References | Review | View
        var byName = {}; Array.prototype.forEach.call(tabs.querySelectorAll('.lne-rtab'), function (t) { byName[t.dataset.tab] = t; });
        var tmp = document.createElement('div');
        tmp.innerHTML = tab('file', _('oxTabFile', 'File')) + tab('layout', _('oxTabLayout', 'Layout')) + tab('refs', _('oxTabRefs', 'References')) + tab('review', _('oxTabReview', 'Review'));
        var nt = {}; Array.prototype.forEach.call(tmp.children, function (t) { nt[t.dataset.tab] = t; });
        tabs.innerHTML = '';
        ['file', 'home', 'insert', 'layout', 'refs', 'review', 'view'].forEach(function (n) { tabs.appendChild(byName[n] || nt[n]); });

        // — FILE
        var file = panel('file',
            G(_('oxGrpImport', 'Open'), [BL('oxImport', 'bi bi-file-earmark-word', _('oxImportTip', 'Import a Word document (.docx, .doc), RTF or HTML'), _('oxImport', 'Import Word'))]) +
            G(_('oxGrpExport', 'Save as'), [
                BL('oxExportDocx', 'bi bi-file-earmark-word-fill', _('oxExportDocxTip', 'Export as Word document (.docx)'), 'DOCX') +
                BL('oxExportDoc', 'bi bi-file-earmark-text', _('oxExportDocTip', 'Export as Word 97–2003 compatible document (.doc)'), 'DOC') +
                BL('oxExportPdf', 'bi bi-file-earmark-pdf', _('oxExportPdfTip', 'Print or save as PDF'), 'PDF') +
                BL('oxExportHtml', 'bi bi-filetype-html', _('oxExportHtmlTip', 'Export as HTML page'), 'HTML') +
                BL('oxExportMd', 'bi bi-filetype-md', _('oxExportMdTip', 'Export as Markdown'), 'Markdown') +
                BL('oxExportTxt', 'bi bi-file-earmark-font', _('oxExportTxtTip', 'Export as plain text'), 'TXT')
            ]) +
            G(_('oxGrpDocument', 'Document'), [
                BL('oxPrint', 'bi bi-printer', _('oxPrintTip', 'Print'), _('oxPrint', 'Print')) +
                BL('oxProps', 'bi bi-info-circle', _('oxPropsTip', 'Document properties: title, author, language'), _('oxProps', 'Properties'))
            ]));

        // — LAYOUT
        var layout = panel('layout',
            G(_('oxGrpPageSetup', 'Page setup'), [
                BD('oxMargins', 'bi bi-aspect-ratio', _('oxMarginsTip', 'Page margins'), _('oxMargins', 'Margins')) +
                BD('oxOrient', 'bi bi-phone-landscape', _('oxOrientTip', 'Page orientation'), _('oxOrient', 'Orientation')) +
                BD('oxSize', 'bi bi-file-earmark', _('oxSizeTip', 'Paper size'), _('oxSize', 'Size')) +
                BD('oxColumns', 'bi bi-layout-split', _('oxColumnsTip', 'Columns'), _('oxColumns', 'Columns')) +
                BL('oxPageSetup', 'bi bi-gear', _('oxPageSetupTip', 'Page setup dialog'), _('oxPageSetupShort', 'Page setup'))
            ]) +
            G(_('oxGrpBackground', 'Page background'), [
                BL('oxPageColor', 'bi bi-palette', _('oxPageColorTip', 'Page colour'), _('oxPageColor', 'Page colour')) +
                BL('oxPageBorder', 'bi bi-border-outer', _('oxPageBorderTip', 'Page border'), _('oxPageBorder', 'Border'))
            ]) +
            G(_('oxGrpParagraph', 'Paragraph'), [
                BD('oxSpacing', 'bi bi-arrows-expand', _('oxSpacingTip', 'Spacing before and after paragraph'), _('oxSpacing', 'Spacing')) +
                BL('oxHyphen', 'bi bi-type', _('oxHyphenTip', 'Automatic hyphenation'), _('oxHyphen', 'Hyphenation'))
            ]) +
            G(_('oxGrpBreaks', 'Breaks'), [BL('oxPageBreak', 'bi bi-file-break', _('oxPageBreakTip', 'Insert page break'), _('oxPageBreak', 'Page break'))])
        );

        // — REFERENCES
        var refs = panel('refs',
            G(_('oxGrpTOC', 'Table of contents'), [
                BD('oxToc', 'bi bi-list-nested', _('oxTocTip', 'Table of contents'), _('oxToc', 'Contents')) +
                BL('oxTocUpdate', 'bi bi-arrow-repeat', _('oxTocUpdateTip', 'Update table of contents and footnotes'), _('oxUpdate', 'Update'))
            ]) +
            G(_('oxGrpFootnotes', 'Footnotes'), [BL('oxFootnote', 'bi bi-asterisk', _('oxFootnoteTip', 'Insert footnote'), _('oxFootnote', 'Footnote'))]) +
            G(_('oxGrpCaptions', 'Captions'), [BD('oxCaption', 'bi bi-card-text', _('oxCaptionTip', 'Insert caption'), _('oxCaption', 'Caption'))]) +
            G(_('oxGrpLinks', 'Links'), [
                BL('oxBookmark', 'bi bi-bookmark', _('oxBookmarkTip', 'Insert bookmark'), _('oxBookmark', 'Bookmark')) +
                BL('oxGoBookmark', 'bi bi-bookmarks', _('oxGoBookmarkTip', 'Go to bookmark'), _('oxGoBookmark', 'Go to'))
            ])
        );

        // — REVIEW
        var review = panel('review',
            G(_('oxGrpProofing', 'Proofing'), [
                BL('oxSpell', 'bi bi-spellcheck', _('oxSpellTip', 'Spelling check'), _('oxSpell', 'Spelling')) +
                BD('oxProofLang', 'bi bi-translate', _('oxProofLangTip', 'Proofing language'), _('oxProofLang', 'Language')) +
                BL('wordCount', 'bi bi-bar-chart-line', _('wordCount', 'Word count'), _('wordCountShort', 'Word count'))
            ]) +
            G(_('oxGrpComments', 'Comments'), [
                BL('oxComment', 'bi bi-chat-square-text', _('oxCommentTip', 'New comment on the selection'), _('oxComment', 'New comment')) +
                BL('oxComments', 'bi bi-chat-left-dots', _('oxCommentsTip', 'All comments'), _('oxComments', 'Comments'))
            ]) +
            G(_('oxGrpSpeech', 'Speech'), [BL('oxRead', 'bi bi-volume-up', _('oxReadTip', 'Read aloud (selection or whole document)'), _('oxRead', 'Read aloud'))]) +
            G(_('oxGrpAccess', 'Accessibility'), [BL('oxA11y', 'bi bi-universal-access', _('oxA11yTip', 'Check accessibility'), _('oxA11y', 'Accessibility'))])
        );

        var last = tb.querySelector('.lne-panel[data-tab="view"]');
        last.insertAdjacentHTML('beforebegin', file);
        tb.querySelector('.lne-panel[data-tab="insert"]').insertAdjacentHTML('afterend', layout + refs + review);

        // — HOME additions
        var home = tb.querySelector('.lne-panel[data-tab="home"]');
        home.insertAdjacentHTML('beforeend',
            G(_('oxGrpEditing2', 'Paragraph +'), [
                B('oxMarks', 'bi bi-paragraph', _('oxMarksTip', 'Show/hide formatting marks (¶)')) + B('oxShade', 'bi bi-paint-bucket', _('oxShadeTip', 'Paragraph shading')) +
                B('oxLtr', 'bi bi-text-indent-left', _('oxLtrTip', 'Left-to-right text direction')) + B('oxRtl', 'bi bi-text-indent-right', _('oxRtlTip', 'Right-to-left text direction'))
            ]) +
            G(_('oxGrpTextTools', 'Text tools'), [
                BD('oxQuickStyles', 'bi bi-type-h1', _('oxQuickStylesTip', 'Quick styles: title, subtitle, caption'), _('oxQuickStyles', 'Styles'))
            ]));

        // — INSERT additions
        tb.querySelector('.lne-panel[data-tab="insert"]').insertAdjacentHTML('beforeend',
            G(_('oxGrpPages', 'Pages'), [
                BL('oxPageBreak', 'bi bi-file-break', _('oxPageBreakTip', 'Insert page break'), _('oxPageBreak', 'Page break')) +
                BL('oxHeaderFooter', 'bi bi-layout-text-sidebar-reverse', _('oxHeaderFooterTip', 'Header, footer and page numbers'), _('oxHeaderFooter', 'Header & footer'))
            ]) +
            G(_('oxGrpText', 'Text'), [
                BL('oxTextBox', 'bi bi-textarea-t', _('oxTextBoxTip', 'Text box'), _('oxTextBox', 'Text box')) +
                BL('oxDropCap', 'bi bi-type-bold', _('oxDropCapTip', 'Drop cap'), _('oxDropCap', 'Drop cap')) +
                BD('oxDate', 'bi bi-calendar-event', _('oxDateTip', 'Insert date and time'), _('oxDate', 'Date & time'))
            ]));

        // — VIEW additions
        last.insertAdjacentHTML('beforeend',
            G(_('oxGrpNav', 'Navigation'), [
                BL('oxNav', 'bi bi-layout-sidebar', _('oxNavTip', 'Navigation pane with document headings'), _('oxNav', 'Navigation')) +
                BL('oxReadMode', 'bi bi-book', _('oxReadModeTip', 'Read mode (editing locked)'), _('oxReadMode', 'Read mode')) +
                BL('oxPaginate', 'bi bi-files', _('oxPaginateTip', 'Split the document into pages by sheet height (like Print Layout)'), _('oxPaginate', 'Pages'))
            ]));
    };

    // ═══════════════════════════ helpers ═══════════════════════════
    P._oxToast = function (msg) {
        if (typeof showCustomAlert === 'function') { try { showCustomAlert(this._('ok', 'OK'), msg, 'info'); return; } catch (e) {} }
        var t = document.createElement('div'); t.className = 'lne-ox-toast'; t.textContent = msg; document.body.appendChild(t);
        setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, 2200);
    };
    P._oxBlocks = function () {
        var sel = window.getSelection(); if (!sel || !sel.rangeCount) return [];
        var r = sel.getRangeAt(0), ed = this.ed; if (!ed.contains(r.commonAncestorContainer)) return [];
        var all = Array.prototype.slice.call(ed.querySelectorAll(BLOCK_SEL)), out = [];
        all.forEach(function (b) { if (b.closest('.cl-item') || b.closest('.lne-fnlist') || b.closest('.lne-toc')) return; if (r.intersectsNode(b) && !Array.prototype.some.call(b.children, function (c) { return /^(P|H[1-6]|LI|DIV|BLOCKQUOTE|PRE)$/.test(c.tagName) && r.intersectsNode(c) && !c.matches('.lne-ox-inline'); })) out.push(b); });
        if (!out.length) { var n = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer; var b = n.closest && n.closest(BLOCK_SEL); if (b && ed.contains(b)) out.push(b); }
        return out;
    };
    P._oxInsertHtml = function (html) {
        this._saveSnap(); this.ed.focus(); this._restoreRange();
        document.execCommand('insertHTML', false, html);
        this._saveRange(); this._notifyChange();
    };
    P._oxDownload = function (blob, name) {
        if (typeof downloadFile === 'function') { try { downloadFile(blob, name, blob.type); return; } catch (e) {} }
        var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1000);
    };
    P._oxFileName = function (ext) {
        var m = this._oxMeta(), base = m.title || ((this.ed.querySelector('h1,h2,h3') || {}).textContent || '').trim() || (this.ed.innerText || '').trim().split('\n')[0] || 'note';
        base = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'note';
        return base + '.' + ext;
    };
    P._oxCleanHtml = function () { // HTML без служебных элементов (список сносок остаётся; он нужен для печати)
        var t = document.createElement('div'); t.innerHTML = this.getContent();
        t.querySelectorAll('.lne-docmeta').forEach(function (e) { e.remove(); });
        return t.innerHTML;
    };
    P._oxMediaReady = async function () { // сохранённые ссылки на медиа → data URI (как делает приложение при экспорте)
        var html = this._oxCleanHtml();
        if (typeof processMediaContent === 'function') { try { html = await processMediaContent(html); } catch (e) {} }
        return html;
    };
    P._oxSyncButtons = function () {
        if (!this.toolbar) return;
        var m = this._oxMeta(), tb = this.toolbar, set = function (cmd, on) { var b = tb.querySelector('[data-cmd="' + cmd + '"]'); if (b) { b.classList.toggle('active', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); } };
        set('oxPageBorder', m.border); set('oxHyphen', m.hyphen); set('oxSpell', this.ed.spellcheck !== false);
        set('oxMarks', this.ed.classList.contains('lne-ox-marks')); set('oxReadMode', this.ed.getAttribute('contenteditable') === 'false');
        set('oxPaginate', !this._oxPgIsOff()); set('oxNav', !!this._oxNavEl); set('oxRead', this._oxSpeaking); set('oxPainter', !!this._oxPaint);
    };

    // ═══════════════════════════ FILE ═══════════════════════════
    CMD.oxImport = function () {
        var self = this, inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.docx,.doc,.rtf,.html,.htm,.mht,.mhtml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        inp.addEventListener('change', async function () {
            var f = inp.files && inp.files[0]; if (!f) return;
            try {
                if (!window.LNDocx) throw new Error('LNDocx not loaded');
                var res = await window.LNDocx.importFile(f);
                self._oxAskInsertMode(res, f);
            } catch (e) { console.error(e); self._oxToast(self._('oxImportError', 'Could not import the file') + ': ' + e.message); }
        });
        inp.click();
    };
    P._oxAskInsertMode = function (res, file) {
        var self = this, hasContent = (this.ed.innerText || '').trim().length > 0 || this.ed.querySelector('img,table');
        var apply = function (replace) {
            self._saveSnap();
            if (replace) {
                var meta = Object.assign(defMeta(), res.meta || {}); meta.margins = Object.assign(defMeta().margins, (res.meta || {}).margins || {});
                _set.call(self, res.html); self._docMeta = meta; self._oxApplyMeta();
                self.undoStack = []; self.redoStack = []; self._saveSnap();
            } else { self.ed.focus(); self._restoreRange(); document.execCommand('insertHTML', false, res.html); self._initAll(); }
            self._oxRenumberFootnotes(true); self._oxRefreshNav(); self._notifyChange(); self._updateStatusbar();
            if (replace) { var ed0 = self.ed; ed0.classList.remove('lne-ox-in'); void ed0.offsetWidth; ed0.classList.add('lne-ox-in'); setTimeout(function () { ed0.classList.remove('lne-ox-in'); }, 500); }
            var note = res.partial ? ' ' + self._('oxImportPartial', 'Legacy .doc: text, tables and links were imported; formatting is limited — save as .docx for full fidelity.') : '';
            self._oxToast(self._('oxImported', 'Imported') + ': ' + file.name + note);
        };
        if (!hasContent) return apply(true);
        this._modal(this._('oxImport', 'Import Word'), 'bi bi-file-earmark-word',
            '<p style="margin:0 0 12px">' + esc(file.name) + '</p>' +
            '<label class="lne-chk" style="display:block;margin:6px 0"><input type="radio" name="oxm" value="replace" checked> <span>' + esc(this._('oxReplaceDoc', 'Replace the current document (applies page setup)')) + '</span></label>' +
            '<label class="lne-chk" style="display:block;margin:6px 0"><input type="radio" name="oxm" value="insert"> <span>' + esc(this._('oxInsertAtCursor', 'Insert at the cursor')) + '</span></label>',
            function (ov, close) { var v = ov.querySelector('input[name=oxm]:checked').value; close(); apply(v === 'replace'); });
    };
    CMD.oxExportDocx = async function () {
        try {
            var blob = await window.LNDocx.exportDocx(await this._oxMediaReady(), { meta: this._oxMeta(), author: this._oxMeta().author });
            this._oxDownload(blob, this._oxFileName('docx'));
        } catch (e) { console.error(e); this._oxToast(this._('oxExportError', 'Export failed') + ': ' + e.message); }
    };
    CMD.oxExportDoc = async function () {
        try {
            var blob = await window.LNDocx.exportDoc(await this._oxMediaReady(), { meta: this._oxMeta() });
            this._oxDownload(blob, this._oxFileName('doc'));
        } catch (e) { console.error(e); this._oxToast(this._('oxExportError', 'Export failed') + ': ' + e.message); }
    };
    CMD.oxExportHtml = async function () {
        var m = this._oxMeta(), body = await this._oxMediaReady();
        var html = '<!DOCTYPE html><html lang="' + esc(m.lang || lang()) + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(m.title || this._oxFileName('').slice(0, -1)) + '</title>' +
            '<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:24px;line-height:1.6}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #999;padding:6px 8px}pre{background:#f4f4f4;padding:10px;overflow:auto}blockquote{border-left:4px solid #ccc;margin-left:0;padding-left:14px;color:#555}</style></head><body>' + body + '</body></html>';
        this._oxDownload(new Blob([html], { type: 'text/html' }), this._oxFileName('html'));
    };
    CMD.oxExportMd = async function () {
        var html = await this._oxMediaReady();
        if (typeof exportToMarkdown === 'function') { exportToMarkdown(html); return; }
        this._oxDownload(new Blob([this.ed.innerText], { type: 'text/markdown' }), this._oxFileName('md'));
    };
    CMD.oxExportTxt = function () { this._oxDownload(new Blob([this.ed.innerText.replace(/​/g, '')], { type: 'text/plain;charset=utf-8' }), this._oxFileName('txt')); };
    CMD.oxExportPdf = CMD.oxPrint = async function () {
        var m = this._oxMeta(), d = window.LNDocx.pageDims(m), mg = m.margins, body = await this._oxMediaReady();
        var w = window.open('', '_blank');
        if (!w) { this._oxToast(this._('oxPopupBlocked', 'Allow pop-ups to print')); return; }
        var fg = m.pageColor ? (luminance(m.pageColor) > .55 ? '#1b1b1b' : '#f2f2f2') : '#111';
        w.document.write('<!DOCTYPE html><html lang="' + esc(m.lang || lang()) + '"><head><meta charset="UTF-8"><title>' + esc(m.title || '') + '</title><style>' +
            '@page{size:' + d[0] + 'mm ' + d[1] + 'mm;margin:' + mg.t + 'mm ' + mg.r + 'mm ' + mg.b + 'mm ' + mg.l + 'mm;' + (m.pageNum ? '@bottom-center{content:counter(page)}' : '') + '}' +
            'html,body{margin:0;padding:0}body{font-family:' + (LocalNotesEditor._prefs().font || 'system-ui,sans-serif') + ';font-size:' + (LocalNotesEditor._prefs().size || 15) + 'px;line-height:1.55;color:' + fg + ';' + (m.pageColor ? 'background:' + m.pageColor + ';-webkit-print-color-adjust:exact;print-color-adjust:exact;' : '') + (m.hyphen ? 'hyphens:auto;' : '') + '}' +
            '.doc{' + (m.cols > 1 ? 'column-count:' + m.cols + ';column-gap:10mm;' : '') + '}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:5px 8px;vertical-align:top}pre{background:#f4f4f4;padding:8px;white-space:pre-wrap}blockquote{border-left:4px solid #ccc;margin-left:0;padding-left:14px;color:#555}' +
            '.lne-pagebreak{break-after:page;height:0;border:0}.lne-toc{border:0}.lne-toc ul{list-style:none;margin:0;padding:0}.lne-toc-item{display:flex;gap:4px;align-items:baseline}.lne-toc-leader{flex:1;height:0;border-bottom:1px dotted #666}.lne-toc[data-leader=dash] .lne-toc-leader{border-bottom-style:dashed}.lne-toc[data-leader=none] .lne-toc-leader{border-bottom-color:transparent}.lne-toc-title{font-weight:600;margin-bottom:6px}.hf{position:fixed;left:0;right:0;font-size:9pt;color:#666}.hf.h{top:-' + Math.max(6, mg.t - 8) + 'mm}.hf.f{bottom:-' + Math.max(6, mg.b - 8) + 'mm}' +
            '.cl-item{list-style:none}.lne-callout{border-left:4px solid #888;padding:6px 10px;background:#f4f4f4}.lne-footnotes,.lne-fnlist{border-top:1px solid #999;margin-top:16px;font-size:.85em}' +
            (m.border ? '.doc{outline:1px solid #777;outline-offset:6mm}' : '') +
            '</style></head><body>' + (m.header ? '<div class="hf h">' + esc(m.header) + '</div>' : '') + (m.footer ? '<div class="hf f">' + esc(m.footer) + '</div>' : '') + '<div class="doc">' + body + '</div></body></html>');
        w.document.querySelectorAll('.cl-item').forEach(function (it) { var cb = it.querySelector('.cl-cb'), tx = it.querySelector('.cl-text'), p = w.document.createElement('p'); p.textContent = ((cb && (cb.checked || cb.getAttribute('data-checked') === 'true')) ? '☑ ' : '☐ ') + (tx ? (tx.value || tx.getAttribute('value') || '') : ''); it.replaceWith(p); });
        w.document.querySelectorAll('script,iframe,video,audio,button,input').forEach(function (e) { e.remove(); });
        w.document.close(); w.focus();
        setTimeout(function () { w.print(); }, 500);
    };
    CMD.oxProps = function () {
        var self = this, m = this._oxMeta(), L = (window.LNLang && window.LNLang.META) || { en: { name: 'English' } };
        var opts = '<option value="">—</option>' + Object.keys(L).map(function (c) { var h = L[c].html || c; return '<option value="' + h + '"' + (m.lang === h ? ' selected' : '') + '>' + esc(L[c].name) + '</option>'; }).join('');
        this._modal(this._('oxProps', 'Properties'), 'bi bi-info-circle',
            '<div class="lne-fg"><label>' + esc(this._('oxTitle', 'Title')) + '</label><input class="lne-inp" id="ox-title" value="' + esc(m.title) + '"></div>' +
            '<div class="lne-fg"><label>' + esc(this._('oxAuthor', 'Author')) + '</label><input class="lne-inp" id="ox-author" value="' + esc(m.author) + '"></div>' +
            '<div class="lne-fg"><label>' + esc(this._('oxProofLang', 'Language')) + '</label><select class="lne-inp" id="ox-lang">' + opts + '</select></div>',
            function (ov, close) { self._oxSetMeta({ title: ov.querySelector('#ox-title').value.trim(), author: ov.querySelector('#ox-author').value.trim(), lang: ov.querySelector('#ox-lang').value }); close(); });
    };

    // ═══════════════════════════ LAYOUT ═══════════════════════════
    function menu(ed, btn, items) { ed._popMenu(btn, items); }
    CMD.oxMargins = function (btn) {
        var self = this, m = this._oxMeta(), mg = m.margins, P0 = window.LNDocx.MARGIN_PRESETS;
        var same = function (p) { return Math.abs(mg.t - p.t) < .2 && Math.abs(mg.l - p.l) < .2 && Math.abs(mg.r - p.r) < .2 && Math.abs(mg.b - p.b) < .2; };
        var it = function (k, label, hint) { return { label: label, hint: hint, active: same(P0[k]), icon: 'bi bi-aspect-ratio', action: function () { self._oxSetMeta({ margins: Object.assign({}, P0[k]) }); } }; };
        menu(this, btn, [it('normal', this._('oxMarginNormal', 'Normal'), '2.54 cm'), it('narrow', this._('oxMarginNarrow', 'Narrow'), '1.27 cm'), it('moderate', this._('oxMarginModerate', 'Moderate'), '1.91 / 2.54 cm'), it('wide', this._('oxMarginWide', 'Wide'), '5.08 cm'), 'sep',
            { label: this._('oxCustom', 'Custom…'), icon: 'bi bi-sliders', action: function () { self._oxPageSetup(); } }]);
    };
    CMD.oxOrient = function (btn) {
        var self = this, m = this._oxMeta();
        menu(this, btn, [{ label: this._('oxPortrait', 'Portrait'), icon: 'bi bi-phone', active: m.orient === 'portrait', action: function () { self._oxSetMeta({ orient: 'portrait' }); } },
            { label: this._('oxLandscape', 'Landscape'), icon: 'bi bi-phone-landscape', active: m.orient === 'landscape', action: function () { self._oxSetMeta({ orient: 'landscape' }); } }]);
    };
    CMD.oxSize = function (btn) {
        var self = this, m = this._oxMeta(), S = window.LNDocx.PAGE_SIZES;
        menu(this, btn, Object.keys(S).map(function (k) { return { label: k, hint: S[k][0] + ' × ' + S[k][1] + ' mm', active: m.size === k, icon: 'bi bi-file-earmark', action: function () { self._oxSetMeta({ size: k }); } }; }));
    };
    CMD.oxColumns = function (btn) {
        var self = this, m = this._oxMeta();
        menu(this, btn, [1, 2, 3].map(function (n) { return { label: n === 1 ? self._('oxOneCol', 'One') : n === 2 ? self._('oxTwoCols', 'Two') : self._('oxThreeCols', 'Three'), icon: 'bi bi-layout-split', active: m.cols === n, action: function () { self._oxSetMeta({ cols: n }); } }; }));
    };
    CMD.oxPageBorder = function () { this._oxSetMeta({ border: !this._oxMeta().border }); };
    CMD.oxHyphen = function () { this._oxSetMeta({ hyphen: !this._oxMeta().hyphen }); };
    CMD.oxPageColor = function () {
        var self = this, i = document.createElement('input'); i.type = 'color'; i.value = this._oxMeta().pageColor || '#ffffff';
        i.style.cssText = 'position:fixed;left:-100px;top:0;opacity:0'; document.body.appendChild(i);
        i.addEventListener('input', function () { self._oxSetMeta({ pageColor: i.value === '#ffffff' ? '' : i.value }); });
        i.addEventListener('change', function () { i.remove(); });
        i.click();
    };
    CMD.oxSpacing = function (btn) {
        var self = this, set = function (before, after) { return function () { self._saveSnap(); self._oxBlocks().forEach(function (b) { b.style.marginTop = before + 'pt'; b.style.marginBottom = after + 'pt'; }); self._notifyChange(); }; };
        menu(this, btn, [{ label: this._('oxSpacingNone', 'None (0 / 0 pt)'), icon: 'bi bi-arrows-collapse', action: set(0, 0) }, { label: '0 / 6 pt', icon: 'bi bi-arrows-expand', action: set(0, 6) }, { label: '6 / 6 pt', icon: 'bi bi-arrows-expand', action: set(6, 6) }, { label: '0 / 12 pt', icon: 'bi bi-arrows-expand', action: set(0, 12) }, { label: '12 / 12 pt', icon: 'bi bi-arrows-expand', action: set(12, 12) }]);
    };
    CMD.oxPageSetup = P._oxPageSetup = function () {
        var self = this, m = this._oxMeta(), S = window.LNDocx.PAGE_SIZES, mg = m.margins;
        var num = function (id, v, label) { return '<div class="lne-fg" style="flex:1;min-width:70px"><label>' + esc(label) + '</label><input type="number" step="0.1" min="0" max="100" class="lne-inp" id="' + id + '" value="' + v + '"></div>'; };
        this._modal(this._('oxPageSetupTip', 'Page setup'), 'bi bi-gear',
            '<div class="lne-row"><div class="lne-fg" style="flex:1"><label>' + esc(this._('oxSize', 'Size')) + '</label><select class="lne-inp" id="ox-size">' + Object.keys(S).map(function (k) { return '<option' + (m.size === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div>' +
            '<div class="lne-fg" style="flex:1"><label>' + esc(this._('oxOrient', 'Orientation')) + '</label><select class="lne-inp" id="ox-orient"><option value="portrait"' + (m.orient === 'portrait' ? ' selected' : '') + '>' + esc(this._('oxPortrait', 'Portrait')) + '</option><option value="landscape"' + (m.orient === 'landscape' ? ' selected' : '') + '>' + esc(this._('oxLandscape', 'Landscape')) + '</option></select></div></div>' +
            '<div class="lne-row">' + num('ox-mt', mg.t, this._('oxMarginTop', 'Top, mm')) + num('ox-mb', mg.b, this._('oxMarginBottom', 'Bottom, mm')) + '</div>' +
            '<div class="lne-row">' + num('ox-ml', mg.l, this._('oxMarginLeft', 'Left, mm')) + num('ox-mr', mg.r, this._('oxMarginRight', 'Right, mm')) + '</div>' +
            '<div class="lne-row"><div class="lne-fg" style="flex:1"><label>' + esc(this._('oxColumns', 'Columns')) + '</label><select class="lne-inp" id="ox-cols">' + [1, 2, 3].map(function (n) { return '<option' + (m.cols === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
            '<div class="lne-fg" style="flex:1"><label>' + esc(this._('oxPageColor', 'Page colour')) + '</label><input type="color" class="lne-inp" id="ox-bg" value="' + (m.pageColor || '#ffffff') + '"></div></div>' +
            '<div class="lne-checks"><label class="lne-chk"><input type="checkbox" id="ox-border"' + (m.border ? ' checked' : '') + '><span>' + esc(this._('oxPageBorder', 'Border')) + '</span></label>' +
            '<label class="lne-chk"><input type="checkbox" id="ox-hyph"' + (m.hyphen ? ' checked' : '') + '><span>' + esc(this._('oxHyphen', 'Hyphenation')) + '</span></label></div>',
            function (ov, close) {
                var v = function (id) { return parseFloat(ov.querySelector(id).value); }, cl = function (x, d) { return isFinite(x) ? Math.min(100, Math.max(0, x)) : d; };
                self._oxSetMeta({ size: ov.querySelector('#ox-size').value, orient: ov.querySelector('#ox-orient').value, cols: +ov.querySelector('#ox-cols').value,
                    margins: { t: cl(v('#ox-mt'), 25.4), b: cl(v('#ox-mb'), 25.4), l: cl(v('#ox-ml'), 25.4), r: cl(v('#ox-mr'), 25.4) },
                    pageColor: ov.querySelector('#ox-bg').value === '#ffffff' ? '' : ov.querySelector('#ox-bg').value, border: ov.querySelector('#ox-border').checked, hyphen: ov.querySelector('#ox-hyph').checked });
                close();
            });
    };
    CMD.oxHeaderFooter = function () {
        var self = this, m = this._oxMeta();
        this._modal(this._('oxHeaderFooter', 'Header & footer'), 'bi bi-layout-text-sidebar-reverse',
            '<div class="lne-fg"><label>' + esc(this._('oxHeaderText', 'Header')) + '</label><input class="lne-inp" id="ox-hdr" maxlength="200" value="' + esc(m.header) + '"></div>' +
            '<div class="lne-fg"><label>' + esc(this._('oxFooterText', 'Footer')) + '</label><input class="lne-inp" id="ox-ftr" maxlength="200" value="' + esc(m.footer) + '"></div>' +
            '<div class="lne-checks"><label class="lne-chk"><input type="checkbox" id="ox-pn"' + (m.pageNum ? ' checked' : '') + '><span>' + esc(this._('oxPageNumbers', 'Page numbers')) + '</span></label></div>' +
            '<p style="font-size:12px;opacity:.7;margin:8px 0 0">' + esc(this._('oxHFHint', 'Shown in print / PDF and in exported Word files.')) + '</p>',
            function (ov, close) { self._oxSetMeta({ header: ov.querySelector('#ox-hdr').value.trim(), footer: ov.querySelector('#ox-ftr').value.trim(), pageNum: ov.querySelector('#ox-pn').checked }); close(); });
    };
    CMD.oxPageBreak = function () {
        this._oxInsertHtml('<div class="lne-pagebreak" contenteditable="false" data-label="' + esc(this._('oxPageBreak', 'Page break')) + '"></div><p><br></p>');
        if (this._oxEnsureBreakLines && this._oxEnsureBreakLines()) this._notifyChange();   // разрыв в начале документа: добавили строку на листе ДО него
        if (this._oxAutoToc) this._oxAutoToc();
    };

    // ═══════════════════════════ HOME additions ═══════════════════════════
    CMD.oxMarks = function () { this.ed.classList.toggle('lne-ox-marks'); this._oxSyncButtons(); };
    CMD.oxShade = function () {
        var self = this, blocks = this._oxBlocks(); if (!blocks.length) return;
        var i = document.createElement('input'); i.type = 'color'; i.value = '#fff2a8'; i.style.cssText = 'position:fixed;left:-100px;top:0;opacity:0'; document.body.appendChild(i);
        var snap = false;
        i.addEventListener('input', function () { if (!snap) { self._saveSnap(); snap = true; } blocks.forEach(function (b) { b.style.backgroundColor = i.value; b.style.padding = b.style.padding || '2px 6px'; }); });
        i.addEventListener('change', function () { self._notifyChange(); i.remove(); });
        i.click();
    };
    CMD.oxLtr = function () { var s = this; this._saveSnap(); this._oxBlocks().forEach(function (b) { b.setAttribute('dir', 'ltr'); b.style.textAlign = ''; }); this._notifyChange(); };
    CMD.oxRtl = function () { this._saveSnap(); this._oxBlocks().forEach(function (b) { b.setAttribute('dir', 'rtl'); b.style.textAlign = 'right'; }); this._notifyChange(); };
    CMD.oxCase = function (btn) {
        var self = this, lg = lang();
        var tx = {
            upper: function (s) { return s.toLocaleUpperCase(lg); }, lower: function (s) { return s.toLocaleLowerCase(lg); },
            title: function (s) { return s.toLocaleLowerCase(lg).replace(/(^|[^\p{L}\p{M}'’])(\p{L})/gu, function (m, a, b) { return a + b.toLocaleUpperCase(lg); }); },
            sentence: function (s) { return s.toLocaleLowerCase(lg).replace(/(^|[.!?…]\s+)(\p{L})/gu, function (m, a, b) { return a + b.toLocaleUpperCase(lg); }); },
            toggle: function (s) { return Array.from(s).map(function (c) { return c === c.toLocaleUpperCase(lg) ? c.toLocaleLowerCase(lg) : c.toLocaleUpperCase(lg); }).join(''); }
        };
        var run = function (k) { return function () {
            self._expandWordIfCollapsed();
            var sel = window.getSelection(); if (!sel.rangeCount || sel.isCollapsed) return;
            self._saveSnap();
            var r = sel.getRangeAt(0), first = true, frag = r.extractContents(), wk = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT), n, nodes = [];
            while ((n = wk.nextNode())) nodes.push(n);
            nodes.forEach(function (t) { var v = t.nodeValue; t.nodeValue = k === 'sentence' || k === 'title' ? tx[k](v) : tx[k](v); });
            var last = frag.lastChild, firstN = frag.firstChild; r.insertNode(frag);
            var nr = document.createRange(); if (firstN && last) { nr.setStartBefore(firstN); nr.setEndAfter(last); sel.removeAllRanges(); sel.addRange(nr); }
            self._notifyChange(); self._saveRange();
        }; };
        menu(this, btn, [{ label: this._('oxCaseSentence', 'Sentence case'), action: run('sentence') }, { label: this._('oxCaseLower', 'lowercase'), action: run('lower') }, { label: this._('oxCaseUpper', 'UPPERCASE'), action: run('upper') }, { label: this._('oxCaseTitle', 'Capitalize Each Word'), action: run('title') }, { label: this._('oxCaseToggle', 'tOGGLE cASE'), action: run('toggle') }]);
    };
    CMD.oxQuickStyles = function (btn) {
        var self = this, mk = function (cls, tag) { return function () { self._saveSnap(); var bl = self._oxBlocks(); bl.forEach(function (b) { if (/^H[1-6]$/.test(b.tagName) || b.tagName === 'LI') return; b.classList.remove('lne-title', 'lne-subtitle', 'lne-caption'); if (cls) b.classList.add(cls); }); if (!bl.length) self._oxInsertHtml('<p class="' + cls + '"><br></p>'); self._notifyChange(); }; };
        menu(this, btn, [{ label: this._('oxStyleTitle', 'Title'), icon: 'bi bi-type-h1', action: mk('lne-title') }, { label: this._('oxStyleSubtitle', 'Subtitle'), icon: 'bi bi-type-h2', action: mk('lne-subtitle') }, { label: this._('oxStyleCaption', 'Caption'), icon: 'bi bi-card-text', action: mk('lne-caption') }, 'sep', { label: this._('oxStyleNormal', 'Normal text'), icon: 'bi bi-text-paragraph', action: mk('') }]);
    };
    CMD.oxPainter = function () {
        var self = this;
        if (this._oxPaint) { this._oxPaint = null; this.ed.classList.remove('lne-ox-painting'); this._oxSyncButtons(); return; }
        var sel = window.getSelection(); if (!sel.rangeCount) return;
        var n = sel.getRangeAt(0).startContainer; n = n.nodeType === 3 ? n.parentNode : n;
        var cs = getComputedStyle(n);
        this._oxPaint = { b: parseInt(cs.fontWeight, 10) >= 600, i: cs.fontStyle === 'italic', u: /underline/.test(cs.textDecorationLine), s: /line-through/.test(cs.textDecorationLine), color: cs.color, bg: cs.backgroundColor, font: cs.fontFamily, size: cs.fontSize };
        this.ed.classList.add('lne-ox-painting'); this._oxSyncButtons();
        var apply = function () {
            var s = window.getSelection(); if (!s.rangeCount || s.isCollapsed || !self.ed.contains(s.anchorNode)) return;
            var f = self._oxPaint; if (!f) return; self._oxPaint = null; self.ed.classList.remove('lne-ox-painting');
            self._saveSnap();
            [['bold', f.b], ['italic', f.i], ['underline', f.u], ['strikeThrough', f.s]].forEach(function (p) { if (document.queryCommandState(p[0]) !== p[1]) document.execCommand(p[0]); });
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('foreColor', false, f.color);
            if (f.bg && f.bg !== 'rgba(0, 0, 0, 0)') document.execCommand('hiliteColor', false, f.bg); else document.execCommand('hiliteColor', false, 'transparent');
            document.execCommand('fontName', false, f.font.split(',')[0].replace(/["']/g, ''));
            self._applySize(f.size);
            self._notifyChange(); self._oxSyncButtons();
        };
        var h = function () { setTimeout(apply, 0); self.ed.removeEventListener('mouseup', h); self.ed.removeEventListener('touchend', h); };
        this.ed.addEventListener('mouseup', h); this.ed.addEventListener('touchend', h);
    };

    // ═══════════════════════════ INSERT additions ═══════════════════════════
    CMD.oxTextBox = function () { this._oxInsertHtml('<div class="lne-textbox"><p>' + esc(this._('oxTextBoxText', 'Text box')) + '</p></div><p><br></p>'); };
    CMD.oxDropCap = function () { this._saveSnap(); var b = this._oxBlocks()[0]; if (b && b.tagName === 'P') { b.classList.toggle('lne-dropcap'); this._notifyChange(); } };
    CMD.oxDate = function (btn) {
        var self = this, now = new Date(), lg = lang(), f = function (o) { try { return new Intl.DateTimeFormat(lg, o).format(now); } catch (e) { return now.toLocaleString(); } };
        var opts = [f({ dateStyle: 'short' }), f({ dateStyle: 'medium' }), f({ dateStyle: 'long' }), f({ dateStyle: 'full' }), f({ timeStyle: 'short' }), f({ dateStyle: 'medium', timeStyle: 'short' }), now.toISOString().slice(0, 10)];
        menu(this, btn, opts.map(function (t) { return { label: t, icon: 'bi bi-calendar-event', action: function () { self._oxInsertHtml(esc(t)); } }; }));
    };
    CMD.oxBookmark = function () {
        var self = this;
        this._modal(this._('oxBookmark', 'Bookmark'), 'bi bi-bookmark', '<div class="lne-fg"><label>' + esc(this._('oxBookmarkName', 'Bookmark name')) + '</label><input class="lne-inp" id="ox-bm" maxlength="40" placeholder="intro"></div>',
            function (ov, close) {
                var n = ov.querySelector('#ox-bm').value.trim().replace(/[^\p{L}\p{N}_-]/gu, '_'); if (!n) return; close();
                self._oxInsertHtml('<a class="lne-bookmark" id="bm-' + esc(n) + '" data-bookmark="' + esc(n) + '">​</a>');
            });
    };
    CMD.oxGoBookmark = function () {
        var self = this, bms = Array.prototype.slice.call(this.ed.querySelectorAll('.lne-bookmark'));
        if (!bms.length) { this._oxToast(this._('oxNoBookmarks', 'No bookmarks in this document')); return; }
        this._modal(this._('oxGoBookmark', 'Go to'), 'bi bi-bookmarks', '<div class="lne-ox-list">' + bms.map(function (b, i) { return '<button type="button" class="lne-ox-row" data-i="' + i + '"><i class="bi bi-bookmark"></i> ' + esc(b.getAttribute('data-bookmark') || b.id) + '</button>'; }).join('') + '</div>',
            function (ov, close) { close(); });
        var ov = document.querySelector('.lne-modal-ov:last-of-type');
        ov && ov.addEventListener('click', function (e) { var r = e.target.closest('.lne-ox-row'); if (!r) return; bms[+r.dataset.i].scrollIntoView({ block: 'center', behavior: 'smooth' }); ov.querySelector('.lne-mclose').click(); });
    };

    // ═══════════════════════════ REFERENCES ═══════════════════════════
    P._oxHeadings = function () {
        var out = [], n = 0;
        this.ed.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (h) {
            if (h.closest('.lne-toc,.lne-fnlist,.lne-callout-header')) return;
            var t = h.textContent.trim(); if (!t) return;
            if (!h.id) h.id = 'lne-h-' + Date.now().toString(36) + (n++);
            out.push({ el: h, id: h.id, level: +h.tagName.charAt(1), text: t });
        });
        return out;
    };
    // ── Автооглавление (как «Автособираемое оглавление» в MS Word) ──
    // Стили «Автособираемое 1/2», уровни 1–6, номера страниц с заполнителем (точки/тире/нет),
    // обновление «только номера страниц» / «целиком» и автообновление при правке заголовков.
    var TOC_DEF = { levels: 3, pages: true, leader: 'dot', style: 'auto1' };
    P._oxTocCfgOf = function (nav) {
        var c = Object.assign({}, TOC_DEF); if (!nav) return c;
        var lv = parseInt(nav.getAttribute('data-levels'), 10); if (lv >= 1 && lv <= 6) c.levels = lv;
        if (nav.getAttribute('data-pages') === '0') c.pages = false;
        var ld = nav.getAttribute('data-leader'); if (ld === 'dot' || ld === 'dash' || ld === 'none') c.leader = ld;
        if (nav.getAttribute('data-style') === 'auto2') c.style = 'auto2';
        return c;
    };
    // Номера страниц: в редакторе один сплошной лист, поэтому считаем по высоте области текста
    // страницы (размер − поля) и по явным разрывам страниц — каждый разрыв начинает новую страницу.
    P._oxPageNumbers = function (hs) {
        try {
            if (this.ed.classList.contains('lne-ox-paged') && window.LNDocx) {   // реальная разбивка на страницы
                var g = pgGeom(this);
                return hs.map(function (h) { return h.el ? Math.max(1, Math.floor((g.Y(h.el.getBoundingClientRect().top) - g.mt + 2) / g.U) + 1) : ''; });
            }
            var ed = this.ed, m = this._oxMeta(), d = window.LNDocx ? window.LNDocx.pageDims(m) : [210, 297];
            var er = ed.getBoundingClientRect(), cs = getComputedStyle(ed);
            var sc = ed.offsetHeight ? er.height / ed.offsetHeight : 1; if (!isFinite(sc) || sc <= 0) sc = 1;
            var pageH = Math.max(120, (d[1] - m.margins.t - m.margins.b) * 96 / 25.4) * sc;
            var top0 = er.top + (parseFloat(cs.paddingTop) || 0) * sc, bot = er.bottom - (parseFloat(cs.paddingBottom) || 0) * sc;
            var pbs = Array.prototype.slice.call(ed.querySelectorAll('.lne-pagebreak')).map(function (b) { var r = b.getBoundingClientRect(); return { t: r.top, b: r.bottom }; });
            var starts = [top0].concat(pbs.map(function (q) { return q.b; })), ends = pbs.map(function (q) { return q.t; }).concat([bot]);
            var base = [], acc = 1;
            starts.forEach(function (st, i) { base.push(acc); acc += Math.max(1, Math.ceil((ends[i] - st - 2) / pageH)); });
            return hs.map(function (h) {
                if (!h.el) return '';
                var y = h.el.getBoundingClientRect().top, i = 0;
                while (i < pbs.length && pbs[i].t <= y) i++;
                return base[i] + Math.max(0, Math.floor((y - starts[i] + 1) / pageH));
            });
        } catch (e) { return []; }
    };
    P._oxBuildToc = function (opt) {
        var cfg = Object.assign({}, TOC_DEF, opt || {}), hs = this._oxHeadings();
        if (!hs.length) return null;
        var minL = Math.min.apply(null, hs.map(function (h) { return h.level; }));
        var list = hs.filter(function (h) { return h.level - minL < cfg.levels; });
        var nums = cfg.pages ? this._oxPageNumbers(list) : [];
        var nav = document.createElement('nav'); nav.className = 'lne-toc'; nav.setAttribute('contenteditable', 'false');
        nav.setAttribute('data-style', cfg.style); nav.setAttribute('data-levels', cfg.levels);
        nav.setAttribute('data-pages', cfg.pages ? '1' : '0'); nav.setAttribute('data-leader', cfg.leader);
        var title = cfg.style === 'auto2' ? this._('oxTocAuto2Title', 'Table of Contents') : this._('oxTocAuto1Title', 'Contents');
        nav.innerHTML = '<div class="lne-toc-title">' + esc(title) + '</div><ul>' + list.map(function (h, i) {
            return '<li class="lne-toc-item" data-level="' + (h.level - minL + 1) + '" data-target="' + h.id + '" style="margin-left:' + (h.level - minL) * 18 + 'px">' +
                '<span class="lne-toc-text">' + esc(h.text) + '</span>' +
                (cfg.pages ? '<span class="lne-toc-leader"></span><span class="lne-toc-pg">' + esc(nums[i] === undefined ? '' : nums[i]) + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
        return nav;
    };
    // пересчитать только номера страниц в уже вставленном оглавлении
    P._oxTocRefreshPages = function (nav) {
        if (!nav || !this._oxTocCfgOf(nav).pages) return;
        var ed = this.ed, items = Array.prototype.slice.call(nav.querySelectorAll('.lne-toc-item'));
        var hs = items.map(function (li) { var t = li.getAttribute('data-target'); return { el: t ? ed.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(t) : t)) : null }; });
        var nums = this._oxPageNumbers(hs);
        items.forEach(function (li, i) { var pg = li.querySelector('.lne-toc-pg'); if (pg && nums[i] !== undefined) pg.textContent = nums[i]; });
    };
    P._oxTocPut = function (opt) {
        var old = this.ed.querySelector('.lne-toc'), cfg = Object.assign({}, old ? this._oxTocCfgOf(old) : TOC_DEF, opt || {});
        var nav = this._oxBuildToc(cfg); if (!nav) { this._oxToast(this._('oxNoHeadings', 'Add headings first')); return; }
        this._saveSnap();
        if (old) old.replaceWith(nav); else this._oxInsertHtml(nav.outerHTML + '<p><br></p>');
        this._oxTocRefreshPages(this.ed.querySelector('.lne-toc'));
        this._notifyChange();
    };
    // тихое автообновление: заменяет оглавление, только если что-то изменилось (заголовки, уровни, номера страниц)
    P._oxAutoToc = function (quiet) {
        var old = this.ed.querySelector('.lne-toc'); if (!old) return false;
        var nav = this._oxBuildToc(this._oxTocCfgOf(old)); if (!nav) return false;
        if (nav.outerHTML === old.outerHTML) return false;
        old.replaceWith(nav); this._oxTocRefreshPages(nav);
        if (!quiet) this._notifyChange();
        return true;
    };
    P._oxTocDialog = function () {
        var self = this, _ = this._.bind(this), old = this.ed.querySelector('.lne-toc'), c = this._oxTocCfgOf(old);
        var opt = function (v, label, cur) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(label) + '</option>'; };
        this._modal(_('oxTocCustom', 'Custom Table of Contents…'), 'bi bi-list-nested',
            '<div class="lne-checks"><label class="lne-chk"><input type="checkbox" id="ox-toc-pg"' + (c.pages ? ' checked' : '') + '><span>' + esc(_('oxTocShowPages', 'Show page numbers')) + '</span></label></div>' +
            '<div class="lne-row"><div class="lne-fg" style="flex:1"><label>' + esc(_('oxTocLeader', 'Tab leader')) + '</label><select class="lne-inp" id="ox-toc-ld">' +
            opt('dot', _('oxTocLeaderDots', 'Dots'), c.leader) + opt('dash', _('oxTocLeaderDashes', 'Dashes'), c.leader) + opt('none', _('oxTocLeaderNone', 'None'), c.leader) + '</select></div>' +
            '<div class="lne-fg" style="flex:1"><label>' + esc(_('oxTocLevels', 'Levels')) + '</label><select class="lne-inp" id="ox-toc-lv">' +
            [1, 2, 3, 4, 5, 6].map(function (n) { return opt(String(n), String(n), String(c.levels)); }).join('') + '</select></div></div>',
            function (ov, close) {
                var cfg = { pages: ov.querySelector('#ox-toc-pg').checked, leader: ov.querySelector('#ox-toc-ld').value, levels: +ov.querySelector('#ox-toc-lv').value, style: c.style };
                close(); self._oxTocPut(cfg);
            });
    };
    CMD.oxToc = function (btn) {
        var self = this, _ = this._.bind(this), old = this.ed.querySelector('.lne-toc'), cfg = this._oxTocCfgOf(old);
        var items = [
            { label: _('oxTocAuto1', 'Automatic Table 1'), hint: _('oxTocAuto1Title', 'Contents'), icon: 'bi bi-list-nested', active: !!old && cfg.style === 'auto1', action: function () { self._oxTocPut({ style: 'auto1' }); } },
            { label: _('oxTocAuto2', 'Automatic Table 2'), hint: _('oxTocAuto2Title', 'Table of Contents'), icon: 'bi bi-list-ol', active: !!old && cfg.style === 'auto2', action: function () { self._oxTocPut({ style: 'auto2' }); } },
            'sep',
            { label: _('oxTocCustom', 'Custom Table of Contents…'), icon: 'bi bi-sliders', action: function () { self._oxTocDialog(); } }];
        if (old) items.push('sep',
            { label: _('oxTocUpdatePages', 'Update page numbers only'), icon: 'bi bi-123', action: function () { self._saveSnap(); self._oxTocRefreshPages(self.ed.querySelector('.lne-toc')); self._notifyChange(); } },
            { label: _('oxTocUpdateAll', 'Update entire table'), icon: 'bi bi-arrow-repeat', action: function () { self._saveSnap(); if (!self._oxAutoToc()) self._oxTocRefreshPages(self.ed.querySelector('.lne-toc')); } },
            'sep',
            { label: _('oxTocRemove', 'Remove table of contents'), icon: 'bi bi-trash3', action: function () { var o = self.ed.querySelector('.lne-toc'); if (o) { self._saveSnap(); o.remove(); self._notifyChange(); } } });
        menu(this, btn, items);
    };
    CMD.oxTocUpdate = function () {
        if (this.ed.querySelector('.lne-toc')) {
            this._saveSnap();
            if (!this._oxAutoToc(true)) { if (!this._oxBuildToc()) this._oxToast(this._('oxNoHeadings', 'Add headings first')); }
        }
        this._oxRenumberFootnotes(); this._oxRefreshNav(); this._notifyChange();
    };
    P._oxRenumberFootnotes = function (quiet) {
        var ed = this.ed, fns = Array.prototype.slice.call(ed.querySelectorAll('sup.lne-fn'));
        var list = ed.querySelector('.lne-fnlist');
        if (!fns.length) { if (list) list.remove(); return; }
        fns.forEach(function (f, i) { f.textContent = String(i + 1); f.setAttribute('contenteditable', 'false'); f.setAttribute('title', f.getAttribute('data-fn') || ''); });
        if (!list) { list = document.createElement('div'); list.className = 'lne-fnlist'; list.setAttribute('contenteditable', 'false'); ed.appendChild(list); }
        else if (list !== ed.lastElementChild) ed.appendChild(list);
        list.innerHTML = '<hr>' + fns.map(function (f, i) { return '<div class="lne-fn-line"><sup>' + (i + 1) + '</sup> ' + esc(f.getAttribute('data-fn') || '') + '</div>'; }).join('');
    };
    CMD.oxFootnote = function () {
        var self = this;
        this._modal(this._('oxFootnote', 'Footnote'), 'bi bi-asterisk', '<div class="lne-fg"><label>' + esc(this._('oxFootnoteText', 'Footnote text')) + '</label><textarea class="lne-inp" id="ox-fn" rows="3" maxlength="1000"></textarea></div>',
            function (ov, close) {
                var t = ov.querySelector('#ox-fn').value.trim(); if (!t) return; close();
                self._oxInsertHtml('<sup class="lne-fn" contenteditable="false" data-fn="' + esc(t) + '">*</sup>​');
                self._oxRenumberFootnotes(); self._notifyChange();
            });
    };
    CMD.oxCaption = function (btn) {
        var self = this, mk = function (kind, label) { return function () {
            var n = self.ed.querySelectorAll('.lne-caption[data-kind="' + kind + '"]').length + 1;
            self._oxInsertHtml('<p class="lne-caption" data-kind="' + kind + '">' + esc(label) + ' ' + n + ': </p>');
        }; };
        menu(this, btn, [{ label: this._('oxFigure', 'Figure'), icon: 'bi bi-image', action: mk('fig', this._('oxFigure', 'Figure')) }, { label: this._('oxTable', 'Table'), icon: 'bi bi-table', action: mk('tbl', this._('oxTable', 'Table')) }, { label: this._('oxEquation', 'Equation'), icon: 'bi bi-calculator', action: mk('eq', this._('oxEquation', 'Equation')) }]);
    };

    // ═══════════════════════════ REVIEW ═══════════════════════════
    CMD.oxSpell = function () { this.ed.spellcheck = !(this.ed.spellcheck !== false); this.ed.setAttribute('spellcheck', this.ed.spellcheck ? 'true' : 'false'); this._oxSyncButtons(); this.ed.blur(); this.ed.focus(); };
    CMD.oxProofLang = function (btn) {
        var self = this, m = this._oxMeta(), L = window.LNLang.META;
        menu(this, btn, [{ label: this._('oxAutoLang', 'Automatic'), active: !m.lang, action: function () { self._oxSetMeta({ lang: '' }); } }].concat(Object.keys(L).map(function (c) { return { label: L[c].name, active: m.lang === L[c].html, action: function () { self._oxSetMeta({ lang: L[c].html }); self.ed.blur(); self.ed.focus(); } }; })));
    };
    CMD.oxComment = function () {
        var self = this, sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) { this._oxExpandWord(); sel = window.getSelection(); }
        if (!sel.rangeCount || sel.isCollapsed) { this._oxToast(this._('oxSelectText', 'Select some text first')); return; }
        var range = sel.getRangeAt(0).cloneRange();
        this._modal(this._('oxComment', 'New comment'), 'bi bi-chat-square-text', '<div class="lne-fg"><label>' + esc(this._('oxCommentText', 'Comment')) + '</label><textarea class="lne-inp" id="ox-cm" rows="4" maxlength="2000"></textarea></div>',
            function (ov, close) {
                var t = ov.querySelector('#ox-cm').value.trim(); if (!t) return; close();
                self._saveSnap();
                var sp = document.createElement('span'); sp.className = 'lne-comment'; sp.setAttribute('data-cid', 'c' + Date.now().toString(36));
                sp.setAttribute('data-comment', t); sp.setAttribute('data-author', self._oxMeta().author || LocalNotesEditor._prefs().author || self._('oxMe', 'Me')); sp.setAttribute('data-date', new Date().toISOString());
                try { range.surroundContents(sp); } catch (e) { sp.appendChild(range.extractContents()); range.insertNode(sp); }
                self._notifyChange();
            });
    };
    P._oxExpandWord = function () { try { this._expandWordIfCollapsed(); } catch (e) {} };
    CMD.oxComments = function () {
        var self = this, list = Array.prototype.slice.call(this.ed.querySelectorAll('.lne-comment'));
        var cnt = (typeof window.tn === 'function' && list.length) ? '<p class="lne-ox-count">' + esc(window.tn('oxCommentsCount', list.length)) + '</p>' : '';
        var body = list.length ? cnt + '<div class="lne-ox-list">' + list.map(function (c, i) {
            return '<div class="lne-ox-cm"><div class="lne-ox-cm-h"><b>' + esc(c.getAttribute('data-author') || '') + '</b> <span>' + esc((c.getAttribute('data-date') || '').slice(0, 10)) + '</span></div><div class="lne-ox-cm-q">“' + esc(c.textContent.slice(0, 80)) + '”</div><div>' + esc(c.getAttribute('data-comment')) + '</div>' +
                '<div class="lne-ox-cm-a"><button type="button" class="lne-mbtn lne-mbtn-sec" data-go="' + i + '">' + esc(self._('oxGoTo', 'Go to')) + '</button> <button type="button" class="lne-mbtn lne-mbtn-sec" data-del="' + i + '">' + esc(self._('remove', 'Remove')) + '</button></div></div>';
        }).join('') + '</div>' : '<p>' + esc(this._('oxNoComments', 'No comments')) + '</p>';
        this._modal(this._('oxComments', 'Comments') + (list.length ? ' (' + list.length + ')' : ''), 'bi bi-chat-left-dots', body, function (ov, close) { close(); }, true);
        var ov = Array.prototype.slice.call(document.querySelectorAll('.lne-modal-ov')).pop();
        ov.addEventListener('click', function (e) {
            var g = e.target.closest('[data-go]'), d = e.target.closest('[data-del]');
            if (g) { list[+g.dataset.go].scrollIntoView({ block: 'center', behavior: 'smooth' }); ov.querySelector('.lne-mclose').click(); }
            if (d) { var c = list[+d.dataset.del]; self._saveSnap(); while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c); c.remove(); self._notifyChange(); ov.querySelector('.lne-mclose').click(); }
        });
    };
    CMD.oxRead = function () {
        var self = this, ss = window.speechSynthesis;
        if (!ss) { this._oxToast(this._('oxNoSpeech', 'Speech is not supported in this browser')); return; }
        if (this._oxSpeaking) { ss.cancel(); this._oxSpeaking = false; this._oxSyncButtons(); return; }
        var sel = window.getSelection(), text = (sel && !sel.isCollapsed && this.ed.contains(sel.anchorNode)) ? sel.toString() : this.ed.innerText;
        text = text.replace(/​/g, '').trim(); if (!text) return;
        var chunks = text.match(/[^.!?\n]+[.!?]*\s*|\n/g) || [text], q = [], cur = '';
        chunks.forEach(function (c) { if ((cur + c).length > 180) { if (cur) q.push(cur); cur = c; } else cur += c; }); if (cur.trim()) q.push(cur);
        this._oxSpeaking = true; this._oxSyncButtons();
        var i = 0, lg = this._oxMeta().lang || lang();
        var next = function () {
            if (!self._oxSpeaking || i >= q.length) { self._oxSpeaking = false; self._oxSyncButtons(); return; }
            var u = new SpeechSynthesisUtterance(q[i++]); u.lang = lg; u.onend = next; u.onerror = function () { self._oxSpeaking = false; self._oxSyncButtons(); };
            ss.speak(u);
        };
        ss.cancel(); next();
    };
    CMD.oxA11y = function () {
        var self = this, issues = [], ed = this.ed, add = function (el, msg) { issues.push({ el: el, msg: msg }); };
        ed.querySelectorAll('img').forEach(function (im) { if (!(im.getAttribute('alt') || '').trim()) add(im, self._('oxA11yAlt', 'Image without alternative text')); });
        var prev = 0; ed.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (h) { var l = +h.tagName.charAt(1); if (!h.textContent.trim()) add(h, self._('oxA11yEmptyHeading', 'Empty heading')); else if (prev && l > prev + 1) add(h, self._('oxA11yHeadingSkip', 'Heading level skipped') + ': H' + prev + ' → H' + l); prev = l; });
        ed.querySelectorAll('table').forEach(function (t) { if (!t.querySelector('th')) add(t, self._('oxA11yTableHeader', 'Table without a header row')); });
        ed.querySelectorAll('a[href]').forEach(function (a) { var x = a.textContent.trim(); if (!x) add(a, self._('oxA11yEmptyLink', 'Link without text')); else if (/^(click here|here|link|http|www\.|нажмите здесь|здесь|ссылка|тут)/i.test(x)) add(a, self._('oxA11yLinkText', 'Link text is not descriptive') + ': “' + x.slice(0, 30) + '”'); });
        var cnt2 = (typeof window.tn === 'function' && issues.length) ? '<p class="lne-ox-count">' + esc(window.tn('oxA11yCount', issues.length)) + '</p>' : '';
        var body = issues.length ? cnt2 + '<div class="lne-ox-list">' + issues.map(function (it, i) { return '<button type="button" class="lne-ox-row" data-i="' + i + '"><i class="bi bi-exclamation-triangle"></i> ' + esc(it.msg) + '</button>'; }).join('') + '</div>' : '<p><i class="bi bi-check-circle"></i> ' + esc(this._('oxA11yOk', 'No accessibility problems found')) + '</p>';
        this._modal(this._('oxA11y', 'Accessibility'), 'bi bi-universal-access', body, function (ov, close) { close(); });
        var ov = Array.prototype.slice.call(document.querySelectorAll('.lne-modal-ov')).pop();
        ov.addEventListener('click', function (e) { var r = e.target.closest('.lne-ox-row'); if (!r) return; var el = issues[+r.dataset.i].el; ov.querySelector('.lne-mclose').click(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('lne-ox-flash'); setTimeout(function () { el.classList.remove('lne-ox-flash'); }, 1800); });
    };

    // ═══════════════════════════ VIEW additions ═══════════════════════════
    CMD.oxReadMode = function () {
        var on = this.ed.getAttribute('contenteditable') !== 'false';
        this.ed.setAttribute('contenteditable', on ? 'false' : 'true'); this.ed.classList.toggle('lne-ox-read', on);
        this._oxSyncButtons();
    };
    P._oxRefreshNav = function () {
        var el = this._oxNavEl; if (!el) return;
        var hs = this._oxHeadings(), self = this;
        el.querySelector('.lne-ox-nav-list').innerHTML = hs.length ? hs.map(function (h) { return '<button type="button" class="lne-ox-nav-i" data-id="' + h.id + '" style="padding-left:' + (10 + (h.level - 1) * 12) + 'px">' + esc(h.text) + '</button>'; }).join('') : '<div class="lne-ox-nav-empty">' + esc(this._('oxNoHeadings', 'Add headings first')) + '</div>';
    };
    CMD.oxNav = function () {
        var self = this;
        if (this._oxNavEl) { this._oxNavEl.remove(); this._oxNavEl = null; this._oxSyncButtons(); return; }
        var el = document.createElement('aside'); el.className = 'lne-ox-nav'; el.setAttribute('aria-label', this._('oxNav', 'Navigation'));
        el.innerHTML = '<div class="lne-ox-nav-h"><b>' + esc(this._('oxNav', 'Navigation')) + '</b><button type="button" class="lne-ox-nav-x" aria-label="' + esc(this._('close', 'Close')) + '"><i class="bi bi-x-lg"></i></button></div><div class="lne-ox-nav-list"></div>';
        var host = this.body.parentNode; host.style.position = host.style.position || 'relative'; host.appendChild(el);
        el.style.top = (this.toolbar ? this.toolbar.offsetHeight : 0) + 'px';
        this._oxNavEl = el; this._oxRefreshNav(); this._oxSyncButtons();
        el.addEventListener('click', function (e) {
            if (e.target.closest('.lne-ox-nav-x')) { CMD.oxNav.call(self); return; }
            var b = e.target.closest('.lne-ox-nav-i'); if (!b) return;
            var h = self.ed.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(b.dataset.id) : b.dataset.id)); if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' });
            if (isTouch()) CMD.oxNav.call(self);
        });
    };

    // ═══════════════════════════ AUTO PAGINATION ═══════════════════════════
    // Страницы по высоте листа (как режим разметки в Word) БЕЗ изменения содержимого заметки:
    //  • границы страниц рисует фон листа (repeating-linear-gradient: белая страница → серый промежуток);
    //  • блок, не помещающийся в остаток страницы, сдвигается на следующую страницу через margin-top,
    //    а абзацы/пункты списков делятся по строкам (минимум 2 строки сверху и снизу) — для этого у блока
    //    есть float ::before с shape-outside, вытесняющий строки из «мёртвой зоны» (нижнее поле + промежуток
    //    + верхнее поле). Всё записывается в отдельный <style> внутри редактора, DOM текста не трогаем.
    //  • явный разрыв страницы переносит следующий блок на новую страницу.
    var PG_GAP = 28, PG_SEQ = 0;
    P._oxPgIsOff = function () {
        if (this._oxPgOff === undefined) { try { this._oxPgOff = localStorage.getItem('ln-ox-paginate') === '0'; } catch (e) { this._oxPgOff = false; } }
        return !!this._oxPgOff;
    };
    P._oxPgActive = function () {
        if (!this.ed || this._oxPgIsOff() || !window.LNDocx) return false;
        if (window.matchMedia && !window.matchMedia('(min-width: 769px)').matches) return false;
        return (this._oxMeta().cols || 1) <= 1;
    };
    function pgGeom(self) {
        var ed = self.ed, m = self._oxMeta(), d = window.LNDocx.pageDims(m), mm = 96 / 25.4;
        // масштаб экран→CSS (зум редактора). Делим на offsetWidth (граница-к-границе вместе с полями), а не на computed width:
        // у редактора content-box + padding, и деление на «чистую» ширину давало 1.03 вместо 1.00 (и 1.575 вместо 1.50 при зуме 150%) —
        // погрешность росла с высотой документа, и на поздних страницах текст ложился на серую щель между листами.
        var er = ed.getBoundingClientRect(), ow = ed.offsetWidth;
        var sc = (ow > 0 && er.width > 0) ? er.width / ow : 1; if (!isFinite(sc) || sc <= 0) sc = 1;
        var P0 = d[1] * mm, mt = m.margins.t * mm, mb = m.margins.b * mm;
        return { P: P0, mt: mt, mb: mb, C: P0 - mt - mb, U: P0 + PG_GAP, sc: sc, Y: function (v) { return (v - er.top) / sc; } };
    }
    P._oxPgSchedule = function (ms) {
        var self = this; clearTimeout(this._oxPgT);
        this._oxPgT = setTimeout(function () { self._oxPgT = null; try { self._oxPaginate(); } catch (e) { if (window.console) console.warn('paginate', e); } }, ms == null ? 120 : ms);
    };
    // Правила привязаны к :nth-child, поэтому при смене числа блоков (Enter, удаление, вставка) пересчитываем СРАЗУ —
    // до отрисовки кадра, иначе сдвиги и подпись разрыва на мгновение цепляются за чужие блоки. Обычный набор — throttle 120 мс.
    var PG_SEL = 'p,li,h1,h2,h3,h4,h5,h6,div,ul,ol,blockquote,pre,table';
    P._oxPgInput = function () {
        if (!this.ed.classList.contains('lne-ox-paged')) { this._oxPgSchedule(250); return; }
        var n = this.ed.querySelectorAll(PG_SEL).length;
        if (n !== this._oxPgN) { clearTimeout(this._oxPgT); this._oxPgT = null; try { this._oxPaginate(); } catch (e) { if (window.console) console.warn('paginate', e); } return; }
        if (this._oxPgT) return;
        var self = this; this._oxPgT = setTimeout(function () { self._oxPgT = null; try { self._oxPaginate(); } catch (e) { if (window.console) console.warn('paginate', e); } }, 120);
    };
    // строки блока: [{rt: верх строки относительно блока, lh: высота строки}]
    function pgLines(el, g, top) {
        var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 15, lh = parseFloat(cs.lineHeight); if (!(lh > 0)) lh = fs * 1.2;
        var rg = document.createRange(); rg.selectNodeContents(el);
        var rs = Array.prototype.slice.call(rg.getClientRects()).filter(function (r) { return r.height > 2; })
            .map(function (r) { return { t: g.Y(r.top), b: g.Y(r.bottom) }; }).sort(function (a, b) { return a.t - b.t; });
        var out = [];
        rs.forEach(function (r) {
            var L = out[out.length - 1];
            if (L && r.t < L.b - 2) { L.t = Math.min(L.t, r.t); L.b = Math.max(L.b, r.b); } else out.push({ t: r.t, b: r.b });
        });
        return out.map(function (L) { return { rt: (L.t + L.b) / 2 - lh / 2 - top, lh: lh }; });
    }
    // Перед каждым разрывом страницы должна быть строка, в которую можно поставить курсор (как в Word, где разрыв живёт
    // внутри абзаца). Разрыв — contenteditable=false: если он первый в документе, идёт сразу после другого разрыва или
    // после нередактируемого блока (оглавление и т.п.), на листе «до разрыва» печатать негде. Добавляем пустой абзац.
    P._oxEnsureBreakLines = function () {
        var ed = this.ed, ch = false;
        if (!ed) return false;
        Array.prototype.forEach.call(ed.querySelectorAll('.lne-pagebreak'), function (pb) {
            if (pb.parentNode !== ed) return;
            var pr = pb.previousElementSibling;
            if (pr && !pr.classList.contains('lne-pagebreak') && pr.getAttribute('contenteditable') !== 'false') return;
            var p = document.createElement('p'); p.appendChild(document.createElement('br'));
            ed.insertBefore(p, pb); ch = true;
        });
        return ch;
    };
    // Пересчёт сбрасывает стили листов и на миг укорачивает документ — браузер «прижимает» прокрутку к новой длине и
    // не возвращает её обратно (отображение прыгало к первому листу при наборе на втором). Запоминаем прокрутку окна и
    // всех прокручиваемых предков и возвращаем её тут же, до отрисовки кадра.
    // Заметки, сохранённые старой версией, могут содержать <span style="font-size…"> вокруг целых абзацев/списков
    // (блоки внутри строчного элемента). Разбивка на листы работает с прямыми потомками редактора и не может
    // разрезать такую обёртку, поэтому текст налезал на щель между листами. Разворачиваем обёртку: её стиль переносим
    // на содержимое каждого блока.
    var BLK_RE = /^(P|H[1-6]|UL|OL|LI|DIV|BLOCKQUOTE|PRE|TABLE)$/;
    function pushDown(w, node) {
        if (node.nodeType !== 1) return;
        var tg = node.tagName;
        if (tg === 'UL' || tg === 'OL') { Array.prototype.slice.call(node.children).forEach(function (c) { pushDown(w, c); }); return; }
        if (tg === 'TABLE') { Array.prototype.forEach.call(node.querySelectorAll('td,th'), function (c) { pushDown(w, c); }); return; }
        if (node.matches && node.matches('.lne-pagebreak,.lne-toc,[contenteditable="false"]')) return;
        var kids = Array.prototype.slice.call(node.childNodes);
        if (kids.some(function (c) { return c.nodeType === 1 && BLK_RE.test(c.tagName); })) { kids.forEach(function (c) { pushDown(w, c); }); return; }
        if (!node.firstChild) return;
        var inner = w.cloneNode(false); while (node.firstChild) inner.appendChild(node.firstChild); node.appendChild(inner);
    }
    P._oxFixBlockWrappers = function () {
        var ed = this.ed, ch = false;
        if (!ed) return false;
        Array.prototype.slice.call(ed.children).forEach(function (w) {
            if (w.tagName !== 'SPAN' && w.tagName !== 'FONT') return;
            if (!Array.prototype.some.call(w.children, function (c) { return BLK_RE.test(c.tagName); })) return;
            Array.prototype.slice.call(w.childNodes).forEach(function (c) {
                if (c.nodeType === 1 && BLK_RE.test(c.tagName)) pushDown(w, c);
                else if (c.nodeType === 3 && c.nodeValue.trim()) { var p = document.createElement('p'), i2 = w.cloneNode(false); i2.appendChild(document.createTextNode(c.nodeValue)); p.appendChild(i2); w.insertBefore(p, c); c.remove(); }
                else if (c.nodeType === 1) { /* строчные вставки (br и т.п.) оставляем как есть */ }
            });
            while (w.firstChild) { var c = w.firstChild; if (c.nodeType === 3 && !c.nodeValue.trim()) c.remove(); else ed.insertBefore(c, w); }
            w.remove(); ch = true;
        });
        return ch;
    };
    P._oxPaginate = function () {
        var ed = this.ed; if (!ed || !ed.isConnected) return;
        try { this._oxFixBlockWrappers(); } catch (e) {}
        var sv = [], n = ed.parentNode;
        while (n && n.nodeType === 1) { if (n.scrollTop || n.scrollLeft) sv.push([n, n.scrollTop, n.scrollLeft]); n = n.parentNode; }
        var wx = window.pageXOffset, wy = window.pageYOffset;
        try { this._oxPaginateRun(); }
        finally {
            sv.forEach(function (e) { if (e[0].scrollTop !== e[1]) e[0].scrollTop = e[1]; if (e[0].scrollLeft !== e[2]) e[0].scrollLeft = e[2]; });
            if (window.pageYOffset !== wy || window.pageXOffset !== wx) window.scrollTo(wx, wy);
        }
    };
    P._oxPaginateRun = function () {
        var ed = this.ed; if (!ed || !ed.isConnected || ed.offsetWidth === 0) return;
        try { this._oxEnsureBreakLines(); } catch (e) {}
        var st = this._oxPgStyle;
        if (!this._oxPgActive()) { if (st) st.textContent = ''; ed.classList.remove('lne-ox-paged'); ed.removeAttribute('data-ox-pg'); return; }
        if (!st) { st = this._oxPgStyle = document.createElement('style'); (this.wrapper || document.head).appendChild(st); }
        if (!this._oxPgId) this._oxPgId = 'pg' + (++PG_SEQ);
        var id = this._oxPgId, base = '.lne-editor[data-ox-pg="' + id + '"]';
        ed.setAttribute('data-ox-pg', id); st.textContent = ''; ed.classList.add('lne-ox-paged');
        var g = pgGeom(this); if (g.C < 80) { ed.classList.remove('lne-ox-paged'); return; }
        var Y = g.Y, P0 = g.P, U = g.U;
        var pageOf = function (y) { return Math.max(0, Math.floor((y - g.mt + 0.5) / U)); };
        var topOf = function (k) { return k * U + g.mt; }, botOf = function (k) { return k * U + P0 - g.mb; };

        // 1) единицы раскладки в «естественном» положении (без сдвигов)
        var units = [], prevB = g.mt;
        var push1 = function (el, sel, kind, first) {
            var r = el.getBoundingClientRect(), t = Y(r.top), b = Y(r.bottom);
            var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 15, lh = parseFloat(cs.lineHeight); if (!(lh > 0)) lh = fs * 1.2;
            var u = { el: el, sel: sel, kind: kind, t: t, b: b, h: b - t, gap: t - prevB, first: !!first, lh: lh,
                split: (kind === 'p' || kind === 'li') && !(cs.paddingTop !== '0px') && !/^(?!none|normal)/.test('') };
            if (u.split) { var pb = getComputedStyle(el, '::before').content; if (pb && pb !== 'none' && pb !== 'normal') u.split = false; }
            u.off = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.borderTopWidth) || 0);
            units.push(u); prevB = b;
        };
        Array.prototype.forEach.call(ed.children, function (el, i) {
            var cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed' || cs.float !== 'none') return;
            if (el.getBoundingClientRect().height === 0 && !el.classList.contains('lne-pagebreak')) return;
            var sel = base + ' > :nth-child(' + (i + 1) + ')', tag = el.tagName;
            if (el.classList.contains('lne-pagebreak')) return push1(el, sel, 'pb');
            if (/^H[1-6]$/.test(tag)) return push1(el, sel, 'h');
            if (tag === 'P') return push1(el, sel, 'p');
            if ((tag === 'UL' || tag === 'OL') && el.getBoundingClientRect().height / g.sc > g.C) {      // длинный список: по пунктам
                Array.prototype.forEach.call(el.children, function (li, j) {
                    if (li.tagName === 'LI' && !li.classList.contains('cl-item')) push1(li, sel + ' > li:nth-child(' + (j + 1) + ')', 'li', j === 0);
                    else if (li.tagName === 'LI') push1(li, sel + ' > li:nth-child(' + (j + 1) + ')', 'blk', j === 0);
                });
                return;
            }
            push1(el, sel, 'blk');
        });

        // 2) раскладка по страницам
        var s = 0, rules = [], minTop = null;
        var trySplit = function (u, y1) {
            var lines = u.lines || (u.lines = pgLines(u.el, g, u.t)), n = lines.length;
            if (n < 4) return null;
            var ex = [], bs = 0, jStart = 0;
            for (var j = 0; j < n; j++) {
                var lt = y1 + lines[j].rt + bs, lb = lt + lines[j].lh, kj = pageOf(lt), bj = botOf(kj);
                if (lt >= bj - 1 || lb > bj + 0.5) {
                    var jb = j;
                    if (n - jb < 2) jb = n - 2;                              // «вдова»: на новой странице не меньше 2 строк
                    if (jb - jStart < 2) { if (!ex.length) return null; jb = j; }   // «сирота»: на старой странице не меньше 2 строк
                    var ltb = y1 + lines[jb].rt + bs, D = topOf(kj + 1) - ltb;
                    if (D <= 0) continue;
                    var a = lines[jb].rt - u.off + bs;
                    ex.push([a, a + D]); bs += D; jStart = jb; j = jb;
                }
            }
            return ex.length ? { ex: ex, total: bs } : null;
        };
        units.forEach(function (u, i) {
            var y1 = u.t + s, push = 0, split = null;
            if (minTop !== null) { if (y1 < minTop - 0.5) { push += minTop - y1; y1 = minTop; } minTop = null; }
            for (var guard = 0; guard < 6; guard++) {
                var k = pageOf(y1), bot = botOf(k);
                if (u.kind === 'pb') break;                                  // разрыв не двигаем: он остаётся в конце своей страницы
                if (y1 >= bot - 1) { push += topOf(k + 1) - y1; y1 = topOf(k + 1); continue; }
                var need = u.h;
                if (u.kind === 'h') { var nx = units[i + 1]; if (nx && nx.kind !== 'pb') need += (nx.t - u.b) + Math.min(nx.h, nx.lh * 2); }
                if (u.kind === 'pb' || y1 + need <= bot + 0.5) break;
                if (u.kind === 'h' && y1 + u.h <= bot + 0.5 && u.h > g.C) break;
                if (u.split && !split) { var r = trySplit(u, y1); if (r) { split = r; break; } }
                if (u.h <= g.C && !u.first) { push += topOf(k + 1) - y1; y1 = topOf(k + 1); continue; }
                break;
            }
            if (push > 0.5) rules.push(u.sel + '{margin-top:' + (u.gap + push).toFixed(2) + 'px !important}');
            if (split) {
                var last = split.ex[split.ex.length - 1][1], pts = [];
                split.ex.forEach(function (e) { pts.push('0 ' + e[0].toFixed(2) + 'px', '100% ' + e[0].toFixed(2) + 'px', '100% ' + e[1].toFixed(2) + 'px', '0 ' + e[1].toFixed(2) + 'px'); });
                rules.push(u.sel + '::before{content:"";float:left;width:100%;height:' + last.toFixed(2) + 'px;margin:0;pointer-events:none;shape-outside:polygon(' + pts.join(',') + ')}');
                s += split.total;
            }
            s += push;
            if (u.kind === 'pb') {
                var kb = pageOf(y1);
                // подпись и линия разрыва рисуются в серой щели МЕЖДУ листами: смещение от верха элемента до середины щели
                rules.push(u.sel + '{--pb-top:' + (kb * U + P0 + PG_GAP / 2 - y1).toFixed(2) + 'px}');
                minTop = topOf(kb + 1);
            }
        });

        // 3) число страниц, фон-«листы» и минимальная высота
        var lastU = units[units.length - 1], mbLast = lastU ? (parseFloat(getComputedStyle(lastU.el).marginBottom) || 0) : 0;
        var need = (lastU ? lastU.b + s + mbLast : g.mt) + g.mb;
        var N = Math.max(1, Math.ceil((need - P0) / U) + 1), minH = N * P0 + (N - 1) * PG_GAP;
        var cv = 'var(--canvas-bg, #e6e6e6)', sh = 'color-mix(in srgb, ' + cv + ' 70%, #000)';
        rules.unshift(base + '.lne-ox-paged{min-height:' + minH.toFixed(2) + 'px !important;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent ' + P0.toFixed(2) + 'px,' +
            sh + ' ' + P0.toFixed(2) + 'px,' + cv + ' ' + (P0 + 7).toFixed(2) + 'px,' + cv + ' ' + (U - 7).toFixed(2) + 'px,' + sh + ' ' + U.toFixed(2) + 'px) !important}');
        st.textContent = rules.join('\n');
        this._oxPgPages = N; this._oxPgN = ed.querySelectorAll(PG_SEL).length;
        var nav = ed.querySelector('.lne-toc'); if (nav) this._oxTocRefreshPages(nav);
    };
    CMD.oxPaginate = function () {
        this._oxPgOff = !this._oxPgIsOff();
        try { localStorage.setItem('ln-ox-paginate', this._oxPgOff ? '0' : '1'); } catch (e) {}
        this._oxPaginate(); this._oxSyncButtons();
        var nav = this.ed.querySelector('.lne-toc'); if (nav) this._oxTocRefreshPages(nav);
    };

    // ═══════════════════════════ toolbar state feedback ═══════════════════════════
    // Подсветка кнопок-переключателей, зависящих от позиции курсора (цитата, код, чек-лист, LTR/RTL, буквица, заливка)
    // и пересинхронизация кнопок вкладок «Макет»/«Вид» при каждом обновлении состояния.
    P._oxSyncCaretButtons = function () {
        if (!this.toolbar || !this.ed) return;
        var tb = this.toolbar, ed = this.ed, sel = window.getSelection(), n = null;
        if (sel && sel.rangeCount) { n = sel.anchorNode; if (n && n.nodeType === 3) n = n.parentNode; if (n && !ed.contains(n)) n = null; }
        var inside = function (css) { var c = n && n.closest ? n.closest(css) : null; return !!(c && c !== ed && ed.contains(c)); };
        var blk = null; if (n && n.closest) { blk = n.closest('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,div'); if (blk === ed || (blk && !ed.contains(blk))) blk = null; }
        var dirOf = function () { var c = blk; while (c && c !== ed) { var d = c.getAttribute && c.getAttribute('dir'); if (d) return d.toLowerCase(); c = c.parentNode; } return ''; };
        var shaded = false; if (blk) { var bg = blk.style && blk.style.backgroundColor; shaded = !!(bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)'); }
        var set = function (cmd, on) { var b = tb.querySelector('[data-cmd="' + cmd + '"]'); if (b) { b.classList.toggle('active', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); } };
        var dir = dirOf();
        set('insertBlockquote', inside('blockquote'));
        set('insertCode', inside('pre'));
        set('insertChecklist', inside('.cl-item, .checklist-item-wrapper'));
        set('oxLtr', dir === 'ltr');
        set('oxRtl', dir === 'rtl');
        set('oxDropCap', !!(blk && blk.classList && blk.classList.contains('lne-dropcap')));
        set('oxShade', shaded);
        set('showBlocks', ed.classList.contains('lne-show-blocks'));
        set('focusMode', !!this._focusMode);
        ['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].forEach(function (c) {
            var b = tb.querySelector('[data-cmd="' + c + '"]'); if (b) b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
        });
        this._oxSyncButtons();
    };
    var _ssOrig = P._syncState;
    P._syncState = function () {
        var r = _ssOrig.apply(this, arguments);
        try { this._oxSyncCaretButtons(); } catch (e) {}
        return r;
    };

    // ═══════════════════════════ editor-side wiring ═══════════════════════════
    var _wire = P._wireEditor;
    P._wireEditor = function () {
        var r = _wire.apply(this, arguments), self = this, tmr = null;
        this._docMeta = this._docMeta || defMeta(); this._oxApplyMeta();
        this.ed.addEventListener('input', function () { self._oxPgInput(); });
        // клик по разрыву страницы выделяет его; Delete/Backspace удаляют выделенный разрыв
        this.ed.addEventListener('click', function (e) {
            var pb = e.target.closest && e.target.closest('.lne-pagebreak');
            Array.prototype.forEach.call(self.ed.querySelectorAll('.lne-pagebreak.lne-pb-sel'), function (x) { if (x !== pb) x.classList.remove('lne-pb-sel'); });
            if (pb && self.ed.getAttribute('contenteditable') !== 'false') pb.classList.add('lne-pb-sel');
        });
        this.ed.addEventListener('keydown', function (e) {
            if (e.key !== 'Delete' && e.key !== 'Backspace') return;
            var pb = self.ed.querySelector('.lne-pagebreak.lne-pb-sel'); if (!pb) return;
            e.preventDefault(); self._saveSnap(); pb.remove(); self._notifyChange(); self._oxPgSchedule(0);
            if (self._oxAutoToc) self._oxAutoToc();
        });
        this.ed.addEventListener('load', function () { self._oxPgSchedule(80); }, true);     // картинки меняют высоту
        // страховка: любое изменение inline-стилей (размер, интервалы, отступы…) без события input тоже пересчитывает листы
        if (window.MutationObserver) { try { new MutationObserver(function () { self._oxPgSchedule(80); }).observe(this.ed, { subtree: true, attributes: true, attributeFilter: ['style'] }); } catch (e) {} }
        if (window.ResizeObserver) { var lw = 0; try { new ResizeObserver(function () { var w = Math.round(self.ed.offsetWidth); if (w !== lw) { lw = w; self._oxPgSchedule(60); } }).observe(this.ed); } catch (e) {} }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { self._oxPgSchedule(0); });
        this.ed.addEventListener('input', function () {
            clearTimeout(tmr); tmr = setTimeout(function () { if (self.ed.querySelector('.lne-toc') && self._oxAutoToc()) self._oxPgSchedule(60); if (self.ed.querySelector('sup.lne-fn') || self.ed.querySelector('.lne-fnlist')) self._oxRenumberFootnotes(true); if (self._oxNavEl) self._oxRefreshNav(); }, 500);
        });
        this.ed.addEventListener('click', function (e) {
            var toc = e.target.closest && e.target.closest('.lne-toc-item');
            if (toc) { var h = self.ed.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(toc.dataset.target) : toc.dataset.target)); if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
            var fn = e.target.closest && e.target.closest('sup.lne-fn');
            if (fn && self.ed.getAttribute('contenteditable') !== 'false') {
                self._modal(self._('oxFootnote', 'Footnote'), 'bi bi-asterisk', '<div class="lne-fg"><textarea class="lne-inp" id="ox-fn2" rows="3" maxlength="1000">' + esc(fn.getAttribute('data-fn')) + '</textarea></div><label class="lne-chk"><input type="checkbox" id="ox-fn-del"><span>' + esc(self._('remove', 'Remove')) + '</span></label>',
                    function (ov, close) { self._saveSnap(); if (ov.querySelector('#ox-fn-del').checked) fn.remove(); else fn.setAttribute('data-fn', ov.querySelector('#ox-fn2').value.trim()); self._oxRenumberFootnotes(); self._notifyChange(); close(); });
            }
        });
        return r;
    };

    // dispatch through core's _exec: patched in core.js (LocalNotesEditor.extCommands)
    window.addEventListener('ln:languagechange', function () { /* ribbon is rebuilt on page navigation; in-place language switch refreshes labels on next editor open */ });
})();
