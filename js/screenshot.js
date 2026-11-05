/*
 * Local Notes — a local-first, privacy-focused notes app (PWA): rich-text/Markdown editor,
 * AES-256-GCM encrypted storage in the browser, offline mode, 12 languages. No server-side data.
 * Local Notes — локальное приватное приложение для заметок (PWA): редактор rich-text/Markdown,
 * шифрование AES-256-GCM в браузере, офлайн-режим, 12 языков. Данные не уходят на сервер.
 *
 * Copyright (c) 2026 PsyGioX. Licensed under the MIT License.
 * Source: https://github.com/PsyGioX/localnotes — Site: https://localnotes-three.vercel.app
 *
 * Copyright (c) 2026 PsyGioX. Лицензия MIT.
 * Исходники: https://github.com/PsyGioX/localnotes — Сайт: https://localnotes-three.vercel.app
 */
/**
 * Local Notes — Note Screenshot (PNG for social media)
 * Canvas-based renderer with proper line-box model.
 * y always points to the TOP of the current line box, not baseline.
 */
(function () {
    'use strict';

    function isDark() {
        return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    function fmtDate(ts) {
        if (!ts) return '';
        try {
            const lang = window.currentLang || 'en';
            const map = { ru:'ru-RU', ua:'uk-UA', pl:'pl-PL', cs:'cs-CZ', sk:'sk-SK',
                          bg:'bg-BG', hr:'hr-HR', sr:'sr-RS', bs:'bs-BA', mk:'mk-MK',
                          sl:'sl-SI', en:'en-US' };
            return new Date(ts).toLocaleDateString(map[lang] || 'en-US',
                { year:'numeric', month:'short', day:'numeric' });
        } catch { return ''; }
    }

    const CL_PRIO = { high: '#f87171', mid: '#fbbf24', low: '#47d877' };
    const CL_CB_INDENT = 28;

    /** Only accept explicit #rgb / #rrggbb (ignore garbage attrs). */
    function parseClColor(raw) {
        if (!raw || typeof raw !== 'string') return '';
        const c = raw.trim();
        return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? c : '';
    }

    function readClItemColor(el) {
        let c = parseClColor(el.getAttribute('data-cl-color'));
        if (!c && el.dataset?.clColor) c = parseClColor(el.dataset.clColor);
        if (!c && el.style) {
            c = parseClColor(el.style.getPropertyValue('--cl-accent'));
        }
        return c;
    }

    /** Row tint: only when a custom color is set; priority overrides accent (matches editor CSS). */
    function checklistRowColor(seg) {
        if (!seg.color) return '';
        if (seg.priority && CL_PRIO[seg.priority]) return CL_PRIO[seg.priority];
        return seg.color;
    }

    function hexToRgba(hex, alpha) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // ── DOM → segment list ────────────────────────────────────────────────────
    // Each segment: { kind, text, bold, italic, underline, strike,
    //                 code, heading(1-6), quote, listItem, fontSize, indentPx,
    //                 tableRow:[{text,bold}] }
    // checklistItem: { text, checked, color, priority, tag, showCheckbox, showTag }
    function domToSegments(root, ctx, contentW, baseSize, font) {

        const segs = [];

        function measure(text, fSize, bold, italic, isCode) {
            const w = bold ? '700' : '400';
            const s = italic ? 'italic' : 'normal';
            const f = isCode ? 'monospace' : font;
            ctx.font = `${s} ${w} ${fSize}px ${f}`;
            return ctx.measureText(text).width;
        }

        function pushLines(text, state) {
            if (!text.trim()) return;
            const fSize  = state.heading
                ? Math.round(baseSize + (6 - state.heading) * 3.5)
                : (state.code ? baseSize - 2 : baseSize);
            const indent = (state.listItem ? baseSize + 4 : 0) + (state.quote ? 20 : 0);
            const avail  = contentW - indent;

            const words = text.replace(/\s+/g, ' ').trim().split(' ');
            let line = state.listItem && segs.length === 0 ? '' : '';
            let first = true;

            for (const word of words) {
                // Break URLs and other unbroken tokens by character when a
                // single word is wider than the available canvas line.
                const parts = [];
                let part = '';
                for (const char of word) {
                    const candidatePart = part + char;
                    if (measure(candidatePart, fSize, state.bold || !!state.heading,
                                state.italic, state.code) > avail && part) {
                        parts.push(part);
                        part = char;
                    } else {
                        part = candidatePart;
                    }
                }
                if (part) parts.push(part);
                for (const token of (parts.length ? parts : [''])) {
                const candidate = line ? line + (token === parts[0] ? ' ' : '') + token : token;
                if (measure(candidate, fSize, state.bold || !!state.heading,
                            state.italic, state.code) > avail && line) {
                    segs.push({ kind:'text', text: line, bold: state.bold,
                        italic: state.italic, underline: state.underline,
                        strike: state.strike, code: state.code,
                        heading: state.heading, quote: state.quote,
                        listItem: state.listItem && first,
                        fontSize: fSize, indentPx: indent });
                    line = token;
                    first = false;
                } else {
                    line = candidate;
                }
                }
            }
            if (line) {
                segs.push({ kind:'text', text: line, bold: state.bold,
                    italic: state.italic, underline: state.underline,
                    strike: state.strike, code: state.code,
                    heading: state.heading, quote: state.quote,
                    listItem: state.listItem && first,
                    fontSize: fSize, indentPx: indent });
            }
        }

        function isCheckboxChecked(cb, el, textEl, doneClass, textDoneClass) {
            if (!cb) {
                return el.classList.contains(doneClass)
                    || (textEl && textEl.classList.contains(textDoneClass));
            }
            const dc = cb.getAttribute('data-checked');
            if (dc === 'true') return true;
            if (dc === 'false') return false;
            return cb.checked
                || el.classList.contains(doneClass)
                || (textEl && textEl.classList.contains(textDoneClass));
        }

        function parseChecklistItem(el) {
            const isLegacy = el.classList.contains('checklist-item-wrapper');
            let text = '', checked = false, color = '', priority = '', tag = '';

            if (isLegacy) {
                const cb = el.querySelector('.checklist-checkbox-ios, input[type="checkbox"]');
                const span = el.querySelector('.checklist-text-content, .checklist-text-ios');
                text = span ? span.textContent.trim() : '';
                checked = isCheckboxChecked(cb, el, span, 'checklist-item-done', 'checklist-done');
                color = readClItemColor(el);
                priority = el.dataset.clPriority || '';
                tag = el.dataset.clTag || '';
            } else {
                const inp = el.querySelector('.cl-text');
                const cb = el.querySelector('.cl-cb');
                text = inp ? (inp.value || inp.getAttribute('value') || '').trim() : '';
                checked = isCheckboxChecked(cb, el, inp, 'cl-item-done', 'cl-done');
                color = readClItemColor(el);
                priority = el.dataset.clPriority || '';
                tag = el.dataset.clTag || '';
            }
            return { text, checked, color, priority, tag, legacy: isLegacy };
        }

        function pushChecklistSegments(item) {
            if (!item.text) return;
            const fSize = baseSize;
            ctx.font = `400 ${fSize}px ${font}`;
            let tagW = 0;
            if (item.tag) {
                ctx.font = `500 ${Math.round(fSize * 0.72)}px ${font}`;
                tagW = ctx.measureText(item.tag).width + 16;
                ctx.font = `400 ${fSize}px ${font}`;
            }
            const avail = contentW - CL_CB_INDENT - tagW;
            const words = item.text.replace(/\s+/g, ' ').trim().split(' ');
            let line = '';
            const lines = [];
            for (const word of words) {
                const parts = [];
                let part = '';
                for (const char of word) {
                    const candidatePart = part + char;
                    if (measure(candidatePart, fSize, false, false, false) > avail && part) {
                        parts.push(part);
                        part = char;
                    } else {
                        part = candidatePart;
                    }
                }
                if (part) parts.push(part);
                for (const token of (parts.length ? parts : [''])) {
                const candidate = line ? line + (token === parts[0] ? ' ' : '') + token : token;
                if (measure(candidate, fSize, false, false, false) > avail && line) {
                    lines.push(line);
                    line = token;
                } else {
                    line = candidate;
                }
                }
            }
            if (line) lines.push(line);
            lines.forEach((ln, i) => {
                segs.push({
                    kind: 'checklistItem',
                    text: ln,
                    checked: item.checked,
                    color: item.color,
                    priority: item.priority,
                    legacy: item.legacy,
                    tag: i === 0 ? item.tag : '',
                    showCheckbox: i === 0,
                    showTag: i === 0 && !!item.tag,
                });
            });
        }

        function walk(node, st) {
            if (node.nodeType === Node.TEXT_NODE) {
                st.buf += node.textContent;
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.tagName.toLowerCase();

            // Skip editor-only checklist UI
            if (node.classList?.contains('cl-opts-btn')
                || node.classList?.contains('cl-opts-panel')
                || node.classList?.contains('checklist-add-desc')) return;

            // Checklist item — atomic block (text lives in <input value>, not textContent)
            if (node.classList?.contains('cl-item')
                || node.classList?.contains('checklist-item-wrapper')) {
                // Skip nested items (only process outermost checklist row)
                if (node.parentElement?.closest('.cl-item, .checklist-item-wrapper')) return;
                flush(st);
                pushChecklistSegments(parseChecklistItem(node));
                return;
            }

            if (tag === 'br') { flush(st); segs.push({ kind:'br' }); return; }
            if (tag === 'hr') { flush(st); segs.push({ kind:'hr' }); return; }

            // Table — collect rows
            if (tag === 'table') {
                flush(st);
                const rows = [];
                node.querySelectorAll('tr').forEach(tr => {
                    const cells = [];
                    tr.querySelectorAll('td,th').forEach(td => {
                        cells.push({ text: td.textContent.trim(),
                                     bold: td.tagName.toLowerCase() === 'th' });
                    });
                    if (cells.length) rows.push(cells);
                });
                if (rows.length) segs.push({ kind:'table', rows });
                segs.push({ kind:'spacer' });
                return;
            }

            const ns = { ...st, buf: '' };
            if (tag === 'b' || tag === 'strong') ns.bold = true;
            if (tag === 'i' || tag === 'em')     ns.italic = true;
            if (tag === 'u')                      ns.underline = true;
            if (tag === 's' || tag === 'del' || tag === 'strike') ns.strike = true;
            if (tag === 'code' || tag === 'kbd')  ns.code = true;
            if (tag === 'pre')                    { ns.code = true; ns.pre = true; }
            if (tag === 'blockquote')             ns.quote = true;
            if (/^h[1-6]$/.test(tag))            ns.heading = +tag[1];
            if (tag === 'li')                     ns.listItem = true;

            const isBlock = /^(p|div|h[1-6]|li|ul|ol|blockquote|pre|br|hr|table)$/.test(tag);

            if (isBlock) {
                flush(st);
                ns.buf = '';
                for (const c of node.childNodes) walk(c, ns);
                flush(ns);
                if (tag !== 'li') segs.push({ kind:'spacer' });
            } else {
                for (const c of node.childNodes) walk(c, ns);
                st.buf += ns.buf; // propagate inline text back
            }
        }

        function flush(st) {
            if (st.buf.trim()) pushLines(st.buf, st);
            st.buf = '';
        }

        const root0 = { buf:'', bold:false, italic:false, underline:false,
                         strike:false, code:false, pre:false, quote:false,
                         heading:0, listItem:false };
        for (const c of root.childNodes) walk(c, root0);
        flush(root0);
        return segs;
    }

    // ── Pre-layout: wrap table cells & checklist rows so nothing overflows ────
    function wrapText(ctx, text, maxW) {
        const out = [];
        const paras = String(text || '').split(/\n/);
        for (const para of paras) {
            let line = '';
            for (const word of para.split(/\s+/).filter(Boolean)) {
                let w = word;
                while (ctx.measureText(w).width > maxW && w.length > 1) {
                    // hard-break over-long tokens by character
                    let k = w.length;
                    while (k > 1 && ctx.measureText(w.slice(0, k)).width > maxW) k--;
                    if (line) { out.push(line); line = ''; }
                    out.push(w.slice(0, k)); w = w.slice(k);
                }
                const cand = line ? line + ' ' + w : w;
                if (ctx.measureText(cand).width > maxW && line) { out.push(line); line = w; }
                else line = cand;
            }
            out.push(line);
        }
        return out.length ? out : [''];
    }

    function layoutBlocks(segs, ctx, contentW, base, font, lineH, pad) {
        for (const seg of segs) {
            if (seg.kind !== 'table') continue;
            const cols = Math.max(1, ...seg.rows.map(r => r.length));
            const fs = Math.max(14, base - 3), lh = Math.round(fs * 1.45);
            // column widths proportional to the longest content, min share so nothing collapses
            const weights = [];
            for (let c = 0; c < cols; c++) {
                let m = 0;
                for (const r of seg.rows) {
                    const cell = r[c]; if (!cell) continue;
                    ctx.font = `${cell.bold ? '700' : '400'} ${fs}px ${font}`;
                    m = Math.max(m, Math.min(ctx.measureText(cell.text).width + pad * 2, contentW));
                }
                weights.push(Math.max(m, 48));
            }
            // never narrower than the longest single word (so words don't split mid-way)
            const minW = [];
            for (let c = 0; c < cols; c++) {
                let m = 0;
                for (const r of seg.rows) {
                    const cell = r[c]; if (!cell) continue;
                    ctx.font = `${cell.bold ? '700' : '400'} ${fs}px ${font}`;
                    for (const w of String(cell.text).split(/\s+/)) m = Math.max(m, ctx.measureText(w).width);
                }
                minW.push(Math.ceil(m + pad * 2 + 2));
            }
            const sum = weights.reduce((a, b) => a + b, 0);
            let colW = weights.map((w, c) => Math.max(Math.floor(contentW * 0.12), Math.min(minW[c], Math.floor(contentW * 0.45)), Math.floor(w / sum * contentW)));
            let over = colW.reduce((a, b) => a + b, 0) - contentW;
            while (over > 0) { const i = colW.indexOf(Math.max(...colW)); const d = Math.min(over, Math.max(1, colW[i] - 40)); colW[i] -= d; over -= d; if (d <= 1 && colW[i] <= 40) break; }
            const diff = contentW - colW.reduce((a, b) => a + b, 0);
            colW[colW.indexOf(Math.max(...colW))] += diff;
            const lines = [], rowH = [];
            seg.rows.forEach((r, ri) => {
                lines[ri] = []; let mx = 1;
                for (let c = 0; c < cols; c++) {
                    const cell = r[c] || { text: '', bold: false };
                    ctx.font = `${(ri === 0 && cell.bold) || cell.bold ? '700' : '400'} ${fs}px ${font}`;
                    lines[ri][c] = wrapText(ctx, cell.text, colW[c] - pad * 2);
                    mx = Math.max(mx, lines[ri][c].length);
                }
                rowH[ri] = mx * lh + pad * 2;
            });
            seg.layout = { cols, colW, lines, rowH, fs, lh, total: rowH.reduce((a, b) => a + b, 0) };
        }
    }

    // ── Height pre-pass ───────────────────────────────────────────────────────
    function calcContentHeight(segs, lineH, cellH) {
        let h = 0;
        for (const s of segs) {
            if (s.kind === 'hr')     { h += 24; continue; }
            if (s.kind === 'spacer') { h += lineH * 0.45; continue; }
            if (s.kind === 'br')     { h += lineH * 0.6; continue; }
            if (s.kind === 'checklistItem') { h += lineH; continue; }
            if (s.kind === 'table') {
                h += (s.layout ? s.layout.total : s.rows.length * cellH) + 8;
                continue;
            }
            // text
            const lh = s.heading ? lineH * (1 + (6 - s.heading) * 0.1) : lineH;
            h += lh;
        }
        return h;
    }

    // ── Main render ───────────────────────────────────────────────────────────
    async function renderNoteToCanvas(note, opts = {}) {
        const SCALE     = 2;
        const narrow    = window.innerWidth <= 600;
        const CARD_W    = opts.width || (narrow ? 720 : 1000);
        const small     = CARD_W < 800;
        const PAD       = small ? 36 : 56;
        const FONT      = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
        const dark      = isDark();
        const watermark = opts.watermark !== undefined ? opts.watermark : 'Local Notes';

        // Office 2024 palette
        const BG       = dark ? '#1f1f1f' : '#f3f2f1';
        const SURFACE  = dark ? '#292929' : '#ffffff';
        const TEXT     = dark ? '#f0f0f0' : '#242424';
        const HEADING  = dark ? '#74e297' : '#08471a';
        const SUBTEXT  = dark ? '#d6d6d6' : '#424242';
        const MUTED    = dark ? '#a6a6a6' : '#616161';
        const ACCENT   = dark ? '#43d774' : '#098b38';
        const BAR      = note.color || (dark ? '#18512b' : '#098b38');
        const BORDER   = dark ? '#3d3d3d' : '#e1dfdd';
        const CODE_BG  = dark ? '#1f1f1f' : '#f3f2f1';
        const QUOTE_BG = dark ? 'rgba(67,215,116,0.12)' : 'rgba(9,139,56,0.08)';
        const TBL_HEAD = dark ? '#23412d' : '#e3faeb';
        const TBL_BDR  = dark ? '#4a4a4a' : '#c8c6c4';

        const BASE     = small ? 21 : 22;
        const LINE_H   = Math.round(BASE * 1.7);
        const CELL_PAD = 10;
        const META_SZ  = 16;
        const BAR_H    = 64;      // blue title bar
        const HEADER_H = 0;
        const FOOTER_H = 44;      // blue status bar
        const MARGIN   = small ? 20 : 32;
        const CONTENT_W = CARD_W - MARGIN * 2 - PAD * 2;

        // Parse
        const parser = document.createElement('div');
        parser.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;visibility:hidden;pointer-events:none;';
        parser.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(note.content || '') : '';
        document.body.appendChild(parser);

        const mc = document.createElement('canvas');
        mc.width = CARD_W; mc.height = 100;
        const mctx = mc.getContext('2d');

        const segs = domToSegments(parser, mctx, CONTENT_W, BASE, FONT);
        document.body.removeChild(parser);

        const CELL_H = LINE_H;
        layoutBlocks(segs, mctx, CONTENT_W, BASE, FONT, LINE_H, CELL_PAD);
        const contentH = calcContentHeight(segs, LINE_H, CELL_H);
        // Divider gap: 16px above line + 24px below line before first text top
        const DIV_GAP  = 36;
        const META_H   = 0;
        const TOTAL_H  = MARGIN + BAR_H + PAD * 0.75 + contentH + DIV_GAP + FOOTER_H + MARGIN + 12;

        const canvas = document.createElement('canvas');
        canvas.width  = CARD_W * SCALE;
        canvas.height = Math.ceil(Math.max(TOTAL_H, 420) * SCALE);
        const ctx = canvas.getContext('2d');
        ctx.scale(SCALE, SCALE);
        const CH = canvas.height / SCALE;

        // Canvas
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, CARD_W, CH);

        // Paper sheet
        const cX = MARGIN, cY = MARGIN, cW = CARD_W - MARGIN * 2, cH = CH - MARGIN * 2;
        ctx.fillStyle = dark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(cX + 1, cY + 3, cW, cH);
        ctx.fillStyle = SURFACE; ctx.fillRect(cX, cY, cW, cH);
        ctx.strokeStyle = BORDER; ctx.lineWidth = 1; ctx.strokeRect(cX + 0.5, cY + 0.5, cW - 1, cH - 1);

        // Title bar (always white text on blue)
        ctx.fillStyle = BAR; ctx.fillRect(cX, cY, cW, BAR_H);
        const conX = cX + PAD;
        const rightEdge = cX + cW - PAD;
        const tile = 32, tileY = cY + (BAR_H - tile) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(conX, tileY, tile, tile);
        ctx.fillStyle = '#098b38';
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('LN', conX + tile / 2, tileY + tile / 2 + 1);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff'; ctx.font = `600 20px ${FONT}`;
        ctx.fillText('Local Notes', conX + tile + 14, cY + BAR_H / 2 + 1);
        if (note.pinned) {
            const pl = (window.t && window.t('pinned') !== 'pinned' && window.t('pinned')) || 'Pinned';
            ctx.font = `600 14px ${FONT}`;
            const pW = ctx.measureText(pl).width + 22;
            const pX = rightEdge - pW, pY = cY + (BAR_H - 28) / 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
            ctx.strokeRect(pX + 0.5, pY + 0.5, pW - 1, 27);
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
            ctx.fillText(pl, pX + pW / 2, pY + 14.5);
            ctx.textAlign = 'left';
        }
        ctx.textBaseline = 'alphabetic';

        let y = cY + BAR_H + Math.round(PAD * 0.75);  // y = TOP of current element

        // ── Body segments — y is always TOP of line box ───────────────────────
        const bodyClipBottom = cY + cH - FOOTER_H - 8;
        ctx.save();
        ctx.beginPath();
        ctx.rect(conX, y, rightEdge - conX, Math.max(0, bodyClipBottom - y));
        ctx.clip();

        for (const seg of segs) {
            if (seg.kind === 'hr') {
                ctx.strokeStyle = BORDER; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(conX, y + 12.5); ctx.lineTo(rightEdge, y + 12); ctx.stroke();
                y += 24; continue;
            }
            if (seg.kind === 'spacer') { y += Math.round(LINE_H * 0.45); continue; }
            if (seg.kind === 'br')     { y += Math.round(LINE_H * 0.6);  continue; }

            // ── Checklist item ────────────────────────────────────────────────
            if (seg.kind === 'checklistItem') {
                const fSize  = BASE;
                const lh     = LINE_H;
                const CB     = 16;
                const baseline = y + Math.round(fSize * 0.82) + Math.round((lh - fSize) / 2);
                const cbY    = y + Math.round((lh - CB) / 2);
                const accent = seg.priority ? (CL_PRIO[seg.priority] || ACCENT)
                    : (seg.color || '');
                const cbX    = conX + (accent ? 6 : 0);
                const textX  = conX + CL_CB_INDENT;

                if (accent) {
                    ctx.fillStyle = accent;
                    ctx.fillRect(conX, y + 3, 3, lh - 6);
                }
                const rowColor = checklistRowColor(seg);
                if (rowColor) {
                    ctx.fillStyle = hexToRgba(rowColor, dark ? 0.06 : 0.08);
                    ctx.fillRect(conX, y + 1, rightEdge - conX, lh - 2);
                } else if (seg.legacy) {
                    ctx.fillStyle = dark ? 'rgba(88,220,131,0.05)' : 'rgba(9,139,56,0.05)';
                    ctx.fillRect(conX, y + 1, rightEdge - conX, lh - 2);
                }

                if (seg.showCheckbox) {
                    const cbCol = seg.color || ACCENT;
                    if (seg.checked) {
                        ctx.fillStyle = cbCol;
                        ctx.fillRect(cbX, cbY, CB, CB);
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(cbX + 4, cbY + 9);
                        ctx.lineTo(cbX + 7, cbY + 12);
                        ctx.lineTo(cbX + 12, cbY + 5);
                        ctx.stroke();
                    } else {
                        ctx.strokeStyle = cbCol;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(cbX + 1, cbY + 1, CB - 2, CB - 2);
                    }
                }

                ctx.font = `400 ${fSize}px ${FONT}`;
                ctx.textBaseline = 'alphabetic';
                ctx.fillStyle = seg.checked ? MUTED : SUBTEXT;
                ctx.fillText(seg.text, textX, baseline);

                if (seg.checked) {
                    const tw = Math.min(ctx.measureText(seg.text).width, rightEdge - textX);
                    ctx.strokeStyle = MUTED;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(textX, baseline - fSize * 0.35);
                    ctx.lineTo(textX + tw, baseline - fSize * 0.35);
                    ctx.stroke();
                }

                if (seg.showTag && seg.tag) {
                    const tagSz = Math.round(fSize * 0.72);
                    ctx.font = `500 ${tagSz}px ${FONT}`;
                    const tw = ctx.measureText(seg.tag).width;
                    const pillX = rightEdge - tw - 14;
                    const pillY = y + Math.round((lh - tagSz - 6) / 2);
                    const tagAccent = seg.color || ACCENT;
                    ctx.fillStyle = hexToRgba(tagAccent, dark ? 0.1 : 0.12);
                    ctx.fillRect(pillX, pillY, tw + 12, tagSz + 6);
                    ctx.strokeStyle = hexToRgba(tagAccent, dark ? 0.25 : 0.3);
                    ctx.lineWidth = 1;
                    ctx.strokeRect(pillX + 0.5, pillY + 0.5, tw + 11, tagSz + 5);
                    ctx.fillStyle = hexToRgba(tagAccent, dark ? 0.75 : 0.85);
                    ctx.textBaseline = 'middle';
                    ctx.fillText(seg.tag, pillX + 6, pillY + (tagSz + 6) / 2);
                    ctx.textBaseline = 'alphabetic';
                }

                y += lh;
                continue;
            }

            // ── Table (wrapped cells, row heights from layoutBlocks) ──────────
            if (seg.kind === 'table') {
                const L = seg.layout; if (!L) continue;
                const tW = rightEdge - conX;
                let rowY = y;
                for (let ri = 0; ri < seg.rows.length; ri++) {
                    const row = seg.rows[ri], rh = L.rowH[ri];
                    const isHdr = ri === 0 && row.some(c => c.bold);
                    ctx.fillStyle = isHdr ? TBL_HEAD : SURFACE;
                    ctx.fillRect(conX, rowY, tW, rh);
                    let cx = conX;
                    for (let ci = 0; ci < L.cols; ci++) {
                        const cell = row[ci] || { text: '', bold: false };
                        const lines = L.lines[ri][ci] || [];
                        ctx.strokeStyle = TBL_BDR; ctx.lineWidth = 1;
                        ctx.strokeRect(cx + 0.5, rowY + 0.5, L.colW[ci] - 1, rh - 1);
                        ctx.fillStyle = isHdr ? HEADING : SUBTEXT;
                        ctx.font = `${isHdr || cell.bold ? '700' : '400'} ${L.fs}px ${FONT}`;
                        ctx.textBaseline = 'alphabetic';
                        lines.forEach((ln, li) => {
                            ctx.fillText(ln, cx + CELL_PAD, rowY + CELL_PAD + li * L.lh + Math.round(L.fs * 0.85) + 2);
                        });
                        cx += L.colW[ci];
                    }
                    rowY += rh;
                }
                y += L.total + 8;
                continue;
            }

            // ── Text segment ──────────────────────────────────────────────────
            const fSize  = seg.fontSize || BASE;
            const lh     = seg.heading ? Math.round(LINE_H * (1 + (6 - seg.heading) * 0.1)) : LINE_H;
            // baseline = y + ascent ≈ y + fSize * 0.82
            const baseline = y + Math.round(fSize * 0.82) + Math.round((lh - fSize) / 2);
            const drawX  = conX + seg.indentPx;
            // content width for this segment (never exceeds right edge)
            const segW   = rightEdge - drawX;

            // Blockquote background — exactly [conX .. rightEdge] × [y .. y+lh]
            if (seg.quote) {
                ctx.fillStyle = QUOTE_BG;
                ctx.fillRect(conX, y, rightEdge - conX, lh);
                ctx.fillStyle = ACCENT;
                ctx.fillRect(conX, y, 3, lh);
            }

            // List bullet
            if (seg.listItem) {
                ctx.fillStyle = ACCENT;
                ctx.font = `700 ${fSize}px ${FONT}`;
                ctx.textBaseline = 'alphabetic';
                ctx.fillText('•', conX + (seg.quote ? 20 : 0), baseline);
            }

            // Inline code background
            if (seg.code && !seg.pre) {
                const w2 = seg.bold ? '700' : '400';
                const s2 = seg.italic ? 'italic' : 'normal';
                ctx.font = `${s2} ${w2} ${fSize}px monospace`;
                const tw = ctx.measureText(seg.text).width;
                ctx.fillStyle = CODE_BG;
                ctx.fillRect(drawX - 3, y + 2, Math.min(tw + 6, segW), lh - 4);
            }

            // Font & color
            const fw = (seg.bold || seg.heading) ? '700' : '400';
            const fs = seg.italic ? 'italic' : 'normal';
            const ff = seg.code ? 'monospace' : FONT;
            ctx.font = `${fs} ${fw} ${fSize}px ${ff}`;
            ctx.textBaseline = 'alphabetic';

            if      (seg.heading)  ctx.fillStyle = HEADING;
            else if (seg.code)     ctx.fillStyle = dark ? '#74e297' : '#098b38';
            else if (seg.quote)    ctx.fillStyle = SUBTEXT;
            else                   ctx.fillStyle = SUBTEXT;

            ctx.fillText(seg.text, drawX, baseline);

            // Underline
            if (seg.underline) {
                const tw = ctx.measureText(seg.text).width;
                ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(drawX, baseline + 2);
                ctx.lineTo(drawX + Math.min(tw, segW), baseline + 2);
                ctx.stroke();
            }
            // Strikethrough
            if (seg.strike) {
                const tw = ctx.measureText(seg.text).width;
                ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(drawX, baseline - fSize * 0.3);
                ctx.lineTo(drawX + Math.min(tw, segW), baseline - fSize * 0.3);
                ctx.stroke();
            }

            y += lh;
        }

        ctx.restore();

        // Status bar (blue, white text)
        const fY = cY + cH - FOOTER_H;
        ctx.fillStyle = BAR; ctx.fillRect(cX, fY, cW, FOOTER_H);
        ctx.fillStyle = '#ffffff'; ctx.font = `500 ${META_SZ}px ${FONT}`;
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        const dateStr = fmtDate(note.lastModified || note.creationTime);
        const words = segs.reduce((n, g) => n + (g.text ? g.text.split(/\s+/).filter(Boolean).length : 0), 0);
        const wl = (window.t && window.t('words') !== 'words' && window.t('words')) || 'Words';
        const left = [dateStr, words ? `${wl}: ${words}` : ''].filter(Boolean).join('   ·   ');
        ctx.fillText(left, conX, fY + FOOTER_H / 2 + 1);
        ctx.textAlign = 'right';
        const rtxt = small ? (watermark || 'Local Notes') : (watermark || 'Local Notes') + ' · localnotes-three.vercel.app';
        ctx.fillText(rtxt, rightEdge, fY + FOOTER_H / 2 + 1);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

        return canvas.toDataURL('image/png');
    }

    // ── Download ──────────────────────────────────────────────────────────────
    function downloadPng(dataUrl, filename) {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = filename || 'note.png';
        document.body.appendChild(a); a.click();
        setTimeout(() => document.body.removeChild(a), 100);
    }

    // ── Preview modal ─────────────────────────────────────────────────────────
    function showScreenshotPreview(dataUrl, note) {
        document.getElementById('ln-screenshot-modal')?.remove();

        const _t = key => {
            if (typeof window.t === 'function') {
                const v = window.t(key);
                if (v && v !== key) return v;
            }
            return { screenshotTitle:'Note Screenshot', screenshotHint:'Ready for social media',
                     screenshotDownload:'Download PNG', cancel:'Close' }[key] || key;
        };

        const overlay = document.createElement('div');
        overlay.id = 'ln-screenshot-modal';
        overlay.className = 'ln-screenshot-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', _t('screenshotTitle'));
        overlay.innerHTML = `
            <div class="ln-screenshot-panel">
                <div class="ln-screenshot-header">
                    <span class="ln-screenshot-title"><i class="bi bi-camera"></i> ${_t('screenshotTitle')}</span>
                    <button class="ln-screenshot-close" id="ln-ss-close" aria-label="${_t('cancel')}">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="ln-screenshot-body">
                    <div class="ln-screenshot-hint"><i class="bi bi-check-circle-fill"></i> ${_t('screenshotHint')}</div>
                    <div class="ln-screenshot-img-wrap">
                        <img src="${dataUrl}" alt="Note screenshot" class="ln-screenshot-img" />
                    </div>
                </div>
                <div class="ln-screenshot-footer">
                    <button class="ln-ss-btn ln-ss-btn-primary" id="ln-ss-download">
                        <i class="bi bi-download"></i> ${_t('screenshotDownload')}
                    </button>
                    <button class="ln-ss-btn ln-ss-btn-cancel" id="ln-ss-cancel">
                        <i class="bi bi-x-lg"></i> ${_t('cancel')}
                    </button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('ln-screenshot-visible'));

        const close = () => {
            overlay.classList.remove('ln-screenshot-visible');
            setTimeout(() => overlay.remove(), 280);
        };
        overlay.querySelector('#ln-ss-close').addEventListener('click', close);
        overlay.querySelector('#ln-ss-cancel').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
        });
        overlay.querySelector('#ln-ss-download').addEventListener('click', () => {
            const t = (note.title || 'note').replace(/[^a-z0-9а-яёА-ЯЁ\s]/gi, '').trim().slice(0, 40) || 'note';
            downloadPng(dataUrl, `localnotes-${t}.png`);
        });
    }

    // ── Loading overlay ───────────────────────────────────────────────────────
    function showLoading() {
        document.getElementById('ln-ss-loading')?.remove();
        const el = document.createElement('div');
        el.id = 'ln-ss-loading';
        el.style.cssText = `
            position:fixed;inset:0;z-index:21000;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);
            color:#fff;font-family:system-ui,sans-serif;gap:14px;`;
        let genText = typeof window.t === 'function' ? window.t('screenshotGenerating') : '';
        if (!genText || genText === 'screenshotGenerating') {
            genText = window.langData?.[window.currentLang || 'en']?.screenshotGenerating
                || window.langData?.en?.screenshotGenerating
                || 'Generating screenshot…';
        }
        el.innerHTML = `
            <div style="width:44px;height:44px;border:4px solid rgba(88,220,131,0.25);
                border-top:4px solid #58dc83;border-radius:50%;
                animation:ln-spin 0.75s linear infinite;"></div>
            <span style="font-size:15px;opacity:0.85;">${genText}</span>
            <style>@keyframes ln-spin{to{transform:rotate(360deg)}}</style>`;
        document.body.appendChild(el);
    }
    function hideLoading() {
        document.getElementById('ln-ss-loading')?.remove();
    }

    // ── Public API ────────────────────────────────────────────────────────────
    async function takeNoteScreenshot(note) {
        if (!note) return;
        showLoading();
        // yield to browser so spinner renders before heavy canvas work
        await new Promise(r => setTimeout(r, 30));
        try {
            const dataUrl = await renderNoteToCanvas(note);
            hideLoading();
            showScreenshotPreview(dataUrl, note);
        } catch (e) {
            hideLoading();
            console.error('Screenshot error:', e);
            const msg = (typeof window.t === 'function' ? window.t('screenshotError') : null) || 'Screenshot failed';
            if (typeof showCustomAlert === 'function') showCustomAlert('Error', msg, 'error');
            else alert(msg);
        }
    }

    window.takeNoteScreenshot = takeNoteScreenshot;
})();
