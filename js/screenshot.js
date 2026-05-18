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

    const CL_PRIO = { high: '#f87171', mid: '#fbbf24', low: '#60a5fa' };
    const CL_CB_INDENT = 28;

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
                const candidate = line ? line + ' ' + word : word;
                if (measure(candidate, fSize, state.bold || !!state.heading,
                            state.italic, state.code) > avail && line) {
                    segs.push({ kind:'text', text: line, bold: state.bold,
                        italic: state.italic, underline: state.underline,
                        strike: state.strike, code: state.code,
                        heading: state.heading, quote: state.quote,
                        listItem: state.listItem && first,
                        fontSize: fSize, indentPx: indent });
                    line = word;
                    first = false;
                } else {
                    line = candidate;
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

        function parseChecklistItem(el) {
            const isLegacy = el.classList.contains('checklist-item-wrapper');
            let text = '', checked = false, color = '', priority = '', tag = '';

            if (isLegacy) {
                const cb = el.querySelector('.checklist-checkbox-ios, input[type="checkbox"]');
                const span = el.querySelector('.checklist-text-content, .checklist-text-ios');
                text = span ? span.textContent.trim() : '';
                checked = !!(cb && (cb.checked || cb.getAttribute('data-checked') === 'true'))
                    || el.classList.contains('checklist-item-done');
            } else {
                const inp = el.querySelector('.cl-text');
                const cb = el.querySelector('.cl-cb');
                text = inp ? (inp.value || inp.getAttribute('value') || '').trim() : '';
                checked = !!(cb && (cb.checked || cb.hasAttribute('checked')
                    || cb.getAttribute('data-checked') === 'true'))
                    || el.classList.contains('cl-item-done')
                    || inp?.classList.contains('cl-done');
                color = el.dataset.clColor || '';
                priority = el.dataset.clPriority || '';
                tag = el.dataset.clTag || '';
            }
            return { text, checked, color, priority, tag };
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
                const candidate = line ? line + ' ' + word : word;
                if (measure(candidate, fSize, false, false, false) > avail && line) {
                    lines.push(line);
                    line = word;
                } else {
                    line = candidate;
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

    // ── Height pre-pass ───────────────────────────────────────────────────────
    function calcContentHeight(segs, lineH, cellH) {
        let h = 0;
        for (const s of segs) {
            if (s.kind === 'hr')     { h += 24; continue; }
            if (s.kind === 'spacer') { h += lineH * 0.45; continue; }
            if (s.kind === 'br')     { h += lineH * 0.6; continue; }
            if (s.kind === 'checklistItem') { h += lineH; continue; }
            if (s.kind === 'table') {
                h += s.rows.length * cellH + 8;
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
        const CARD_W    = opts.width || 1080;
        const PAD       = 64;
        const FONT      = 'Golos Text, system-ui, sans-serif';
        const dark      = isDark();
        const watermark = opts.watermark !== undefined ? opts.watermark : 'Local Notes';

        const BG       = dark ? '#0d0d0d' : '#f4f5f7';
        const SURFACE  = dark ? '#161616' : '#ffffff';
        const TEXT     = dark ? '#f0f0f0' : '#111111';
        const SUBTEXT  = dark ? '#c0c0c0' : '#3a4250';
        const ACCENT   = note.color || (dark ? '#aefc6e' : '#28a745');
        const BORDER   = dark ? '#2a2a2a' : '#e0e3e8';
        const CODE_BG  = dark ? '#222'    : '#f0f0f0';
        const QUOTE_BG = dark ? 'rgba(174,252,110,0.07)' : 'rgba(40,167,69,0.07)';
        const TBL_HEAD = dark ? '#1e1e1e' : '#f0f2f5';
        const TBL_BDR  = dark ? '#333'    : '#d0d4da';

        const BASE     = 22;
        const LINE_H   = Math.round(BASE * 1.75);  // line-box height (top-based)
        const CELL_H   = Math.round(BASE * 2.0);
        const META_SZ  = 17;
        const HEADER_H = 80;
        const FOOTER_H = 72;
        const MARGIN   = 40;
        const CONTENT_W = CARD_W - PAD * 2;

        // Parse
        const parser = document.createElement('div');
        parser.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;visibility:hidden;pointer-events:none;';
        parser.innerHTML = note.content || '';
        document.body.appendChild(parser);

        const mc = document.createElement('canvas');
        mc.width = CARD_W; mc.height = 100;
        const mctx = mc.getContext('2d');

        const segs = domToSegments(parser, mctx, CONTENT_W, BASE, FONT);
        document.body.removeChild(parser);

        const contentH = calcContentHeight(segs, LINE_H, CELL_H);
        // Divider gap: 16px above line + 24px below line before first text top
        const DIV_GAP  = 40;
        const META_H   = 56;
        const TOTAL_H  = MARGIN + PAD + HEADER_H + DIV_GAP + contentH + META_H + FOOTER_H + PAD + MARGIN;

        const canvas = document.createElement('canvas');
        canvas.width  = CARD_W * SCALE;
        canvas.height = Math.max(TOTAL_H, 480) * SCALE;
        const ctx = canvas.getContext('2d');
        ctx.scale(SCALE, SCALE);
        const CH = canvas.height / SCALE;

        // Outer bg
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, CARD_W, CH);
        const bgG = ctx.createLinearGradient(0, 0, CARD_W, CH);
        bgG.addColorStop(0, dark ? 'rgba(174,252,110,0.03)' : 'rgba(40,167,69,0.04)');
        bgG.addColorStop(1, 'transparent');
        ctx.fillStyle = bgG; ctx.fillRect(0, 0, CARD_W, CH);

        // Card
        const cX = MARGIN, cY = MARGIN, cW = CARD_W - MARGIN * 2, cH = CH - MARGIN * 2;
        ctx.fillStyle = dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.07)';
        ctx.fillRect(cX + 4, cY + 4, cW, cH);
        ctx.fillStyle = SURFACE; ctx.fillRect(cX, cY, cW, cH);
        ctx.strokeStyle = BORDER; ctx.lineWidth = 1; ctx.strokeRect(cX, cY, cW, cH);
        ctx.fillStyle = ACCENT; ctx.fillRect(cX, cY, 5, cH);
        const tG = ctx.createLinearGradient(cX, 0, cX + cW, 0);
        tG.addColorStop(0, ACCENT);
        tG.addColorStop(0.5, dark ? 'rgba(174,252,110,0.25)' : 'rgba(40,167,69,0.25)');
        tG.addColorStop(1, 'transparent');
        ctx.fillStyle = tG; ctx.fillRect(cX, cY, cW, 3);

        // Header
        const conX = cX + PAD;
        let y = cY + PAD;  // y = TOP of current element

        const lR = 22, lX = conX + lR, lY = y + lR;
        ctx.beginPath(); ctx.arc(lX, lY, lR, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT; ctx.fill();
        ctx.fillStyle = dark ? '#000' : '#fff';
        ctx.font = `700 16px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('LN', lX, lY);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = TEXT; ctx.font = `600 22px ${FONT}`;
        ctx.fillText('Local Notes', conX + lR * 2 + 14, y + lR + 7);

        if (note.pinned) {
            const pl = '📌 Pinned';
            ctx.font = `500 15px ${FONT}`;
            const pW = ctx.measureText(pl).width + 20;
            const pX = cX + cW - PAD - pW, pY = y + 6;
            ctx.fillStyle = dark ? 'rgba(174,252,110,0.12)' : 'rgba(40,167,69,0.1)';
            ctx.fillRect(pX, pY, pW, 28);
            ctx.strokeStyle = ACCENT; ctx.lineWidth = 1; ctx.strokeRect(pX, pY, pW, 28);
            ctx.fillStyle = ACCENT;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(pl, pX + pW / 2, pY + 14);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
        y += HEADER_H;

        // Divider — 16px gap above, draw line, 24px gap below
        y += 16;
        const dG = ctx.createLinearGradient(conX, 0, cX + cW - PAD, 0);
        dG.addColorStop(0, ACCENT); dG.addColorStop(0.3, BORDER); dG.addColorStop(1, 'transparent');
        ctx.strokeStyle = dG; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(conX, y); ctx.lineTo(cX + cW - PAD, y); ctx.stroke();
        y += 24;

        // ── Body segments — y is always TOP of line box ───────────────────────
        const rightEdge = cX + cW - PAD; // right boundary of content area

        for (const seg of segs) {
            if (seg.kind === 'hr') {
                ctx.strokeStyle = BORDER; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(conX, y + 12); ctx.lineTo(rightEdge, y + 12); ctx.stroke();
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
                if (seg.color && !seg.priority) {
                    ctx.fillStyle = dark ? 'rgba(174,252,110,0.06)' : 'rgba(40,167,69,0.06)';
                    ctx.fillRect(conX, y + 1, rightEdge - conX, lh - 2);
                }

                if (seg.showCheckbox) {
                    const cbCol = seg.color || ACCENT;
                    if (seg.checked) {
                        ctx.fillStyle = cbCol;
                        ctx.fillRect(cbX, cbY, CB, CB);
                        ctx.strokeStyle = dark ? '#000' : '#fff';
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
                ctx.fillStyle = seg.checked
                    ? (dark ? 'rgba(240,240,240,0.42)' : 'rgba(58,66,80,0.45)')
                    : SUBTEXT;
                ctx.fillText(seg.text, textX, baseline);

                if (seg.checked) {
                    const tw = ctx.measureText(seg.text).width;
                    ctx.strokeStyle = dark ? 'rgba(174,252,110,0.45)' : 'rgba(40,167,69,0.45)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(textX, baseline - fSize * 0.35);
                    ctx.lineTo(textX + Math.min(tw, rightEdge - textX), baseline - fSize * 0.35);
                    ctx.stroke();
                }

                if (seg.showTag && seg.tag) {
                    const tagSz = Math.round(fSize * 0.72);
                    ctx.font = `500 ${tagSz}px ${FONT}`;
                    const tw = ctx.measureText(seg.tag).width;
                    const pillX = rightEdge - tw - 14;
                    const pillY = y + Math.round((lh - tagSz - 6) / 2);
                    ctx.fillStyle = dark ? 'rgba(174,252,110,0.1)' : 'rgba(40,167,69,0.1)';
                    ctx.fillRect(pillX, pillY, tw + 12, tagSz + 6);
                    ctx.strokeStyle = dark ? 'rgba(174,252,110,0.25)' : 'rgba(40,167,69,0.25)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(pillX + 0.5, pillY + 0.5, tw + 11, tagSz + 5);
                    ctx.fillStyle = dark ? 'rgba(174,252,110,0.75)' : 'rgba(40,167,69,0.85)';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(seg.tag, pillX + 6, pillY + (tagSz + 6) / 2);
                    ctx.textBaseline = 'alphabetic';
                }

                y += lh;
                continue;
            }

            // ── Table ─────────────────────────────────────────────────────────
            if (seg.kind === 'table') {
                const cols   = Math.max(...seg.rows.map(r => r.length));
                if (cols === 0) continue;
                const tW     = rightEdge - conX;
                const colW   = Math.floor(tW / cols);
                const tPad   = 10;

                for (let ri = 0; ri < seg.rows.length; ri++) {
                    const row   = seg.rows[ri];
                    const isHdr = ri === 0 && row.some(c => c.bold);
                    const rowY  = y + ri * CELL_H;

                    // Row background
                    ctx.fillStyle = isHdr ? TBL_HEAD : (ri % 2 === 0 ? SURFACE : (dark ? '#1a1a1a' : '#fafafa'));
                    ctx.fillRect(conX, rowY, tW, CELL_H);

                    // Row border
                    ctx.strokeStyle = TBL_BDR; ctx.lineWidth = 1;
                    ctx.strokeRect(conX, rowY, tW, CELL_H);

                    for (let ci = 0; ci < cols; ci++) {
                        const cell  = row[ci] || { text: '', bold: false };
                        const cellX = conX + ci * colW;

                        // Cell right border
                        if (ci < cols - 1) {
                            ctx.strokeStyle = TBL_BDR; ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.moveTo(cellX + colW, rowY);
                            ctx.lineTo(cellX + colW, rowY + CELL_H);
                            ctx.stroke();
                        }

                        // Cell text — clip to cell width
                        ctx.save();
                        ctx.rect(cellX + tPad, rowY, colW - tPad * 2, CELL_H);
                        ctx.clip();
                        ctx.fillStyle = isHdr ? TEXT : SUBTEXT;
                        ctx.font = `${isHdr || cell.bold ? '700' : '400'} ${BASE - 2}px ${FONT}`;
                        ctx.textBaseline = 'middle';
                        ctx.fillText(cell.text, cellX + tPad, rowY + CELL_H / 2);
                        ctx.textBaseline = 'alphabetic';
                        ctx.restore();
                    }
                }
                y += seg.rows.length * CELL_H + 8;
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

            if      (seg.heading)  ctx.fillStyle = TEXT;
            else if (seg.code)     ctx.fillStyle = dark ? '#aefc6e' : '#28a745';
            else if (seg.quote)    ctx.fillStyle = dark ? '#d8d8d8' : '#333';
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

        y += 20;

        // Meta date
        const dateStr = fmtDate(note.lastModified || note.creationTime);
        if (dateStr) {
            ctx.fillStyle = dark ? 'rgba(174,252,110,0.65)' : 'rgba(40,167,69,0.75)';
            ctx.font = `500 ${META_SZ}px ${FONT}`;
            ctx.textBaseline = 'top';
            ctx.fillText('📅 ' + dateStr, conX, y);
            ctx.textBaseline = 'alphabetic';
        }
        y += META_H;

        // Footer
        const fY = cY + cH - FOOTER_H;
        ctx.fillStyle = dark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.03)';
        ctx.fillRect(cX, fY, cW, FOOTER_H);
        ctx.strokeStyle = BORDER; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cX + 5, fY); ctx.lineTo(cX + cW, fY); ctx.stroke();
        ctx.beginPath(); ctx.arc(conX + 6, fY + FOOTER_H / 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT; ctx.fill();
        ctx.fillStyle = SUBTEXT; ctx.font = `600 ${META_SZ}px ${FONT}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(watermark || 'Local Notes', conX + 20, fY + FOOTER_H / 2);
        ctx.fillStyle = ACCENT; ctx.font = `500 ${Math.round(META_SZ * 0.88)}px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText('localnotes-three.vercel.app', cX + cW - PAD, fY + FOOTER_H / 2);
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
            <div style="width:44px;height:44px;border:4px solid rgba(174,252,110,0.25);
                border-top:4px solid #aefc6e;border-radius:50%;
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
