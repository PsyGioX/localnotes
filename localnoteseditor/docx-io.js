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
 * LNDocx — импорт/экспорт Microsoft Word без внешних библиотек.
 *
 *   LNDocx.exportDocx(html, opts)  → Promise<Blob>   настоящий .docx (OOXML, ZIP): стили, заголовки,
 *                                                    списки с нумерацией, таблицы (colspan/rowspan), картинки,
 *                                                    ссылки, сноски, комментарии, колонтитулы, поля страниц,
 *                                                    оглавление (поле TOC), размер/ориентация/поля/колонки
 *   LNDocx.exportDoc(html, opts)   → Promise<Blob>   .doc в формате «Word HTML / MHTML»: открывается в Word,
 *                                                    LibreOffice и Pages (двоичный .doc браузер сам не пишет)
 *   LNDocx.importDocx(buf)         → Promise<{html, meta}>
 *   LNDocx.importDoc(buf)          → Promise<{html, meta}>  двоичный Word 97–2003 (OLE2): текст, абзацы, таблицы,
 *                                                           гиперссылки. Также понимает «.doc», который на деле
 *                                                           docx / RTF / HTML (так бывает часто).
 *   LNDocx.importFile(file)        → Promise<{html, meta, kind}>   по содержимому, а не по расширению
 *
 * meta = { size, orient, margins:{t,r,b,l} (мм), cols, header, footer, pageNum, title, author, … }
 */
(function (w) {
    'use strict';
    if (w.LNDocx) return;

    var W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    var R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    var enc = new TextEncoder();

    // ═════════════════════════════ общие утилиты ═════════════════════════════
    function xe(s) {
        return String(s == null ? '' : s)
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function he(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function tr(key, fb) {
        try { if (typeof w.t === 'function') { var v = w.t(key); if (v && v !== key) return v; } } catch (e) {}
        return fb;
    }
    function mmToTw(mm) { return Math.round(mm * 56.6929); }
    function twToMm(tw) { return Math.round(tw / 56.6929 * 10) / 10; }
    function pxToEmu(px) { return Math.round(px * 9525); }

    var PAGE_SIZES = { A3: [297, 420], A4: [210, 297], A5: [148, 210], B5: [176, 250], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
    var MARGIN_PRESETS = {
        normal:   { t: 25.4, r: 25.4, b: 25.4, l: 25.4 },
        narrow:   { t: 12.7, r: 12.7, b: 12.7, l: 12.7 },
        moderate: { t: 25.4, r: 19.1, b: 25.4, l: 19.1 },
        wide:     { t: 25.4, r: 50.8, b: 25.4, l: 50.8 }
    };
    function defaultMeta() { return { size: 'A4', orient: 'portrait', margins: Object.assign({}, MARGIN_PRESETS.normal), cols: 1, pageColor: '', border: false, header: '', footer: '', pageNum: false, hyphen: false, title: '', author: '', lang: '' }; }
    function pageDims(meta) {
        var d = PAGE_SIZES[meta.size] || (meta.pw && meta.ph ? [meta.pw, meta.ph] : PAGE_SIZES.A4);
        return meta.orient === 'landscape' ? [d[1], d[0]] : [d[0], d[1]];
    }

    // ─────────── CSS color → hex ───────────
    var _cv = null;
    function colorToHex(c) {
        if (!c) return null;
        c = String(c).trim().toLowerCase();
        if (!c || c === 'transparent' || c === 'inherit' || c === 'initial' || c === 'currentcolor' || c === 'none') return null;
        var m = c.match(/^#([0-9a-f]{3})$/);
        if (m) return (m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2]).toUpperCase();
        m = c.match(/^#([0-9a-f]{6})/);
        if (m) return m[1].toUpperCase();
        m = c.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?\s*\)/);
        if (m) {
            if (m[4] !== undefined) { var a = m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]); if (a === 0) return null; }
            return [m[1], m[2], m[3]].map(function (x) { return ('0' + Math.min(255, +x).toString(16)).slice(-2); }).join('').toUpperCase();
        }
        if (/^var\(|^color-mix|^hsl|^[a-z]+$/.test(c)) {
            try {
                _cv = _cv || document.createElement('canvas').getContext('2d');
                _cv.fillStyle = '#000'; _cv.fillStyle = c;
                var v = _cv.fillStyle;
                if (v && v !== c || /^[a-z]+$/.test(c)) { if (v.charAt(0) === '#') return v.slice(1).toUpperCase(); }
            } catch (e) {}
        }
        return null;
    }

    function parseCss(style) {
        var o = {};
        if (!style) return o;
        String(style).split(';').forEach(function (p) {
            var i = p.indexOf(':'); if (i < 1) return;
            o[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
        });
        return o;
    }
    function lenToPx(v, base) {
        if (!v) return null;
        var m = String(v).trim().match(/^(-?[\d.]+)(px|pt|em|rem|mm|cm|in|%)?$/);
        if (!m) return null;
        var n = parseFloat(m[1]), u = m[2] || 'px';
        switch (u) {
            case 'px': return n; case 'pt': return n * 4 / 3; case 'em': case 'rem': return n * (base || 16);
            case 'mm': return n * 3.7795; case 'cm': return n * 37.795; case 'in': return n * 96; default: return null;
        }
    }

    // ═════════════════════════════ ZIP: запись ═════════════════════════════
    var CRC = (function () {
        var t = new Uint32Array(256);
        for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
        return t;
    })();
    function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
    function concat(chunks) {
        var n = 0; chunks.forEach(function (c) { n += c.length; });
        var o = new Uint8Array(n), p = 0; chunks.forEach(function (c) { o.set(c, p); p += c.length; }); return o;
    }
    async function streamBytes(stream) {
        var r = stream.getReader(), ch = [];
        for (;;) { var x = await r.read(); if (x.done) break; ch.push(x.value); }
        return concat(ch);
    }
    async function deflateRaw(bytes) {
        if (typeof CompressionStream === 'undefined') throw new Error('no CompressionStream');
        var cs = new CompressionStream('deflate-raw'), wr = cs.writable.getWriter();
        wr.write(bytes); wr.close();
        return streamBytes(cs.readable);
    }
    async function buildZip(files) { // files: [{name, data:Uint8Array}] — [Content_Types].xml должен идти первым
        var local = [], central = [], offset = 0, d = new Date();
        var dosT = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31);
        var dosD = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
        for (var i = 0; i < files.length; i++) {
            var f = files[i], nb = enc.encode(f.name), crc = crc32(f.data), comp = f.data, method = 0;
            if (f.data.length > 64) { try { var z = await deflateRaw(f.data); if (z.length < f.data.length) { comp = z; method = 8; } } catch (e) {} }
            var lh = new Uint8Array(30 + nb.length), dv = new DataView(lh.buffer);
            dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, method, true);
            dv.setUint16(10, dosT, true); dv.setUint16(12, dosD, true); dv.setUint32(14, crc, true);
            dv.setUint32(18, comp.length, true); dv.setUint32(22, f.data.length, true); dv.setUint16(26, nb.length, true);
            lh.set(nb, 30);
            var ch = new Uint8Array(46 + nb.length), cv = new DataView(ch.buffer);
            cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
            cv.setUint16(10, method, true); cv.setUint16(12, dosT, true); cv.setUint16(14, dosD, true); cv.setUint32(16, crc, true);
            cv.setUint32(20, comp.length, true); cv.setUint32(24, f.data.length, true); cv.setUint16(28, nb.length, true);
            cv.setUint32(42, offset, true); ch.set(nb, 46);
            local.push(lh, comp); central.push(ch); offset += lh.length + comp.length;
        }
        var cd = concat(central), end = new Uint8Array(22), ev = new DataView(end.buffer);
        ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
        ev.setUint32(12, cd.length, true); ev.setUint32(16, offset, true);
        return concat(local.concat([cd, end]));
    }

    // ═════════════════════════════ ZIP: чтение ═════════════════════════════
    var MAX_ENTRY = 120 * 1024 * 1024;
    function readZip(buf) {
        var u8 = new Uint8Array(buf), dv = new DataView(buf), eocd = -1;
        for (var i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        if (eocd < 0) throw new Error('Not a valid ZIP/DOCX file');
        var total = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), map = {};
        for (var n = 0; n < total; n++) {
            if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt ZIP directory');
            var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
            var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
            var name = new TextDecoder('utf-8').decode(u8.subarray(p + 46, p + 46 + nl));
            map[name] = { method: method, csize: csize, usize: usize, lo: lo };
            p += 46 + nl + el + cl;
        }
        return { u8: u8, dv: dv, map: map };
    }
    async function zipGet(zip, name) {
        var e = zip.map[name]; if (!e) return null;
        if (e.usize > MAX_ENTRY || e.csize > MAX_ENTRY) throw new Error('ZIP entry too large: ' + name);
        var o = e.lo;
        if (zip.dv.getUint32(o, true) !== 0x04034b50) throw new Error('Bad local header: ' + name);
        var start = o + 30 + zip.dv.getUint16(o + 26, true) + zip.dv.getUint16(o + 28, true);
        var data = zip.u8.subarray(start, start + e.csize);
        if (e.method === 0) return data;
        if (e.method !== 8) throw new Error('Unsupported ZIP compression: ' + e.method);
        if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress ZIP (no DecompressionStream)');
        var ds = new DecompressionStream('deflate-raw'), wr = ds.writable.getWriter();
        wr.write(data); wr.close();
        var rd = ds.readable.getReader(), ch = [], tot = 0;
        for (;;) {
            var x = await rd.read(); if (x.done) break;
            tot += x.value.length; if (tot > MAX_ENTRY) { rd.cancel().catch(function () {}); throw new Error('ZIP entry expands too large: ' + name); }
            ch.push(x.value);
        }
        return concat(ch);
    }
    async function zipText(zip, name) { var b = await zipGet(zip, name); return b ? new TextDecoder('utf-8').decode(b) : null; }

    // ═════════════════════════════ изображения ═════════════════════════════
    function b64ToBytes(b64) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
    function bytesToB64(u8) { var s = '', ch = 0x8000; for (var i = 0; i < u8.length; i += ch) s += String.fromCharCode.apply(null, u8.subarray(i, i + ch)); return btoa(s); }
    function loadImage(src) {
        return new Promise(function (res, rej) {
            var im = new Image(); im.crossOrigin = 'anonymous';
            im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('image load failed')); };
            im.src = src;
        });
    }
    async function rasterize(src, wpx, hpx) {
        var im = await loadImage(src);
        var nw = im.naturalWidth || wpx || 300, nh = im.naturalHeight || hpx || 150, sc = 2;
        var cv = document.createElement('canvas'); cv.width = Math.min(4096, nw * sc); cv.height = Math.min(4096, nh * sc);
        var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cv.width, cv.height);
        var blob = await new Promise(function (r) { cv.toBlob(r, 'image/png'); });
        return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'png', w: nw, h: nh };
    }
    /** src (data:/blob:/http) → {bytes, ext, w, h} | null */
    async function fetchImage(src) {
        try {
            var m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(src), bytes, mime;
            if (m) { mime = m[1].toLowerCase(); bytes = m[2] ? b64ToBytes(m[3]) : enc.encode(decodeURIComponent(m[3])); }
            else { var r = await fetch(src); if (!r.ok) return null; mime = (r.headers.get('content-type') || '').split(';')[0].toLowerCase(); bytes = new Uint8Array(await r.arrayBuffer()); }
            if (bytes.length > 20 * 1024 * 1024) return null;
            var ext = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/gif': 'gif', 'image/bmp': 'bmp' }[mime];
            var url = m ? src : URL.createObjectURL(new Blob([bytes], { type: mime }));
            var im = null; try { im = await loadImage(url); } catch (e) {}
            if (!m) URL.revokeObjectURL(url);
            if (!ext) return await rasterize(m ? src : 'data:' + mime + ';base64,' + bytesToB64(bytes)); // svg / webp / avif → png
            return { bytes: bytes, ext: ext, w: im ? im.naturalWidth : 0, h: im ? im.naturalHeight : 0 };
        } catch (e) { return null; }
    }

    // ═════════════════════════════ HTML → DOCX ═════════════════════════════
    var BLOCK_TAGS = /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|UL|OL|LI|TABLE|THEAD|TBODY|TFOOT|TR|HR|FIGURE|FIGCAPTION|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|NAV|DETAILS|SUMMARY|DL|DT|DD|FORM|FIELDSET|ADDRESS|MAIN)$/;
    var SKIP_SEL = 'script,style,template,[hidden],.lne-code-header,.lne-callout-header,.cl-opts-btn,.lne-fnlist,.lne-docmeta,.lne-copy-btn,.lne-img-handle,button,noscript';

    function Ctx(meta, opts) {
        this.meta = meta; this.opts = opts || {};
        this.rels = []; this.media = []; this.nextRid = 10; this.mediaN = 0;
        this.numDefs = []; this.footnotes = []; this.comments = []; this.imgMap = new Map();
        this.bmId = 100; this.docPrId = 1;
        var d = pageDims(meta), m = meta.margins;
        this.textWidthPx = Math.max(200, (d[0] - m.l - m.r) / (meta.cols || 1) * 3.7795);
    }
    Ctx.prototype.rel = function (type, target, external) {
        var id = 'rId' + (this.nextRid++);
        this.rels.push({ id: id, type: type, target: target, external: !!external }); return id;
    };

    function isBlockEl(n) {
        if (n.nodeType !== 1) return false;
        if (BLOCK_TAGS.test(n.tagName)) return true;
        var c = n.classList;
        return !!(c && (c.contains('lne-code-wrapper') || c.contains('lne-callout') || c.contains('cl-item') || c.contains('lne-toc') || c.contains('lne-pagebreak') || c.contains('table-responsive')));
    }
    function hasBlockChild(el) { for (var c = el.firstChild; c; c = c.nextSibling) if (isBlockEl(c)) return true; return false; }

    // ---- run properties ----
    function rPr(f) {
        var s = '';
        if (f.style) s += '<w:rStyle w:val="' + f.style + '"/>';
        if (f.font) s += '<w:rFonts w:ascii="' + xe(f.font) + '" w:hAnsi="' + xe(f.font) + '" w:cs="' + xe(f.font) + '" w:eastAsia="' + xe(f.font) + '"/>';
        if (f.b) s += '<w:b/><w:bCs/>';
        if (f.i) s += '<w:i/><w:iCs/>';
        if (f.s) s += '<w:strike/>';
        if (f.color) s += '<w:color w:val="' + f.color + '"/>';
        if (f.sz) s += '<w:sz w:val="' + f.sz + '"/><w:szCs w:val="' + f.sz + '"/>';
        if (f.u) s += '<w:u w:val="single"/>';
        if (f.bg) s += '<w:shd w:val="clear" w:color="auto" w:fill="' + f.bg + '"/>';
        if (f.va) s += '<w:vertAlign w:val="' + f.va + '"/>';
        if (f.lang) s += '<w:lang w:val="' + xe(f.lang) + '"/>';
        return s ? '<w:rPr>' + s + '</w:rPr>' : '';
    }
    function run(text, f) { return '<w:r>' + rPr(f) + '<w:t xml:space="preserve">' + xe(text) + '</w:t></w:r>'; }

    function fmtFromEl(el, f) {
        var n = Object.assign({}, f), tag = el.tagName, st = parseCss(el.getAttribute && el.getAttribute('style'));
        if (tag === 'B' || tag === 'STRONG') n.b = true;
        if (tag === 'I' || tag === 'EM' || tag === 'CITE' || tag === 'DFN') n.i = true;
        if (tag === 'U' || tag === 'INS') n.u = true;
        if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') n.s = true;
        if (tag === 'SUB') n.va = 'subscript';
        if (tag === 'SUP') n.va = 'superscript';
        if (tag === 'MARK') n.bg = 'FFF200';
        if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP' || tag === 'TT') { n.font = 'Consolas'; if (!n.bg) n.bg = 'F2F2F2'; }
        if (tag === 'SMALL') n.sz = Math.max(2, Math.round((n.sz || 22) * 0.85));
        if (tag === 'FONT') {
            if (el.getAttribute('color')) n.color = colorToHex(el.getAttribute('color')) || n.color;
            if (el.getAttribute('face')) n.font = el.getAttribute('face').split(',')[0].replace(/["']/g, '').trim();
        }
        var fw = st['font-weight']; if (fw && (/bold/i.test(fw) || parseInt(fw, 10) >= 600)) n.b = true; else if (fw && (/normal/i.test(fw) || parseInt(fw, 10) < 600)) n.b = false;
        if (/italic|oblique/i.test(st['font-style'] || '')) n.i = true;
        var td = (st['text-decoration'] || '') + ' ' + (st['text-decoration-line'] || '');
        if (/underline/i.test(td)) n.u = true;
        if (/line-through/i.test(td)) n.s = true;
        if (st.color) n.color = colorToHex(st.color) || n.color;
        var bg = st['background-color'] || (st.background && !/url|gradient/.test(st.background) ? st.background : '');
        if (bg) { var hx = colorToHex(bg); if (hx) n.bg = hx; }
        if (st['font-family']) n.font = st['font-family'].split(',')[0].replace(/["']/g, '').trim();
        if (st['font-size']) { var px = lenToPx(st['font-size'], 16); if (px) n.sz = Math.max(2, Math.round(px * 0.75 * 2)); }
        if (/^sub/i.test(st['vertical-align'] || '')) n.va = 'subscript';
        if (/^super/i.test(st['vertical-align'] || '')) n.va = 'superscript';
        return n;
    }

    // ---- inline ----
    function collapse(s) { return s.replace(/[ \t\r\n\f]+/g, ' '); }

    async function inlineRuns(nodes, f, ctx, pre) {
        var out = [];
        for (var i = 0; i < nodes.length; i++) out.push(await inlineNode(nodes[i], f, ctx, pre));
        return out.join('');
    }
    async function inlineNode(n, f, ctx, pre) {
        if (n.nodeType === 3) {
            var t = pre ? n.nodeValue.replace(/\r/g, '') : collapse(n.nodeValue);
            if (!t) return '';
            if (pre) return t.split('\n').map(function (ln, i) { return (i ? '<w:r><w:br/></w:r>' : '') + (ln ? run(ln.replace(/\t/g, '    '), f) : ''); }).join('');
            return run(t, f);
        }
        if (n.nodeType !== 1) return '';
        if (n.matches && n.matches(SKIP_SEL)) return '';
        var tag = n.tagName, cl = n.classList;
        if (tag === 'BR') return '<w:r><w:br/></w:r>';
        if (tag === 'WBR') return '';
        if (tag === 'IMG' || tag === 'SVG' || tag === 'svg') return await imageRun(n, ctx);
        if (tag === 'INPUT') {
            var checked = n.checked || n.getAttribute('checked') !== null || n.getAttribute('data-checked') === 'true' || n.getAttribute('data-checked') === '1';
            if (n.type === 'checkbox') return run(checked ? '\u2611 ' : '\u2610 ', Object.assign({}, f, { font: 'Segoe UI Symbol' }));
            return '';
        }
        if (tag === 'IFRAME' || tag === 'VIDEO' || tag === 'AUDIO') {
            var src = n.getAttribute('data-src') || n.getAttribute('src') || (n.querySelector && n.querySelector('source') && n.querySelector('source').getAttribute('src')) || '';
            if (/^https?:/i.test(src)) return hyperlink(src, run(src, Object.assign({}, f, { style: 'Hyperlink' })), ctx);
            return run('[' + (tag === 'IFRAME' ? 'embed' : tag.toLowerCase()) + ']', f);
        }
        if (cl && cl.contains('lne-formula-wrap')) {
            var src2 = n.getAttribute('data-formula-src') || n.textContent;
            return run(src2, Object.assign({}, f, { font: 'Cambria Math', i: true }));
        }
        if (cl && cl.contains('lne-fn')) { // сноска
            var id = ctx.footnotes.length + 1; ctx.footnotes.push({ id: id, text: n.getAttribute('data-fn') || '' });
            return '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="' + id + '"/></w:r>';
        }
        if (cl && cl.contains('lne-comment')) { // комментарий
            var cid = ctx.comments.length; ctx.comments.push({ id: cid, text: n.getAttribute('data-comment') || '', author: n.getAttribute('data-author') || ctx.opts.author || 'Local Notes', date: n.getAttribute('data-date') || new Date().toISOString() });
            var inner = await inlineRuns(Array.prototype.slice.call(n.childNodes), f, ctx, pre);
            return '<w:commentRangeStart w:id="' + cid + '"/>' + inner + '<w:commentRangeEnd w:id="' + cid + '"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="' + cid + '"/></w:r>';
        }
        if (tag === 'A') {
            var href = n.getAttribute('href') || '', nf = fmtFromEl(n, f);
            var innerA = await inlineRuns(Array.prototype.slice.call(n.childNodes), Object.assign({}, nf, href ? { style: 'Hyperlink' } : {}), ctx, pre);
            if (cl && cl.contains('lne-bookmark') || (!href && n.id)) {
                var bid = ctx.bmId++, bname = (n.id || n.getAttribute('name') || 'bm' + bid).replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40);
                return '<w:bookmarkStart w:id="' + bid + '" w:name="' + xe(bname) + '"/>' + innerA + '<w:bookmarkEnd w:id="' + bid + '"/>';
            }
            if (!href || /^javascript:/i.test(href)) return innerA;
            return hyperlink(href, innerA, ctx);
        }
        var nf2 = fmtFromEl(n, f);
        return await inlineRuns(Array.prototype.slice.call(n.childNodes), nf2, ctx, pre);
    }
    function hyperlink(href, inner, ctx) {
        if (href.charAt(0) === '#') return '<w:hyperlink w:anchor="' + xe(href.slice(1).replace(/[^A-Za-z0-9_]/g, '_')) + '" w:history="1">' + inner + '</w:hyperlink>';
        var id = ctx.rel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', href, true);
        return '<w:hyperlink r:id="' + id + '" w:history="1">' + inner + '</w:hyperlink>';
    }

    async function imageRun(el, ctx) {
        var rec = ctx.imgMap.get(el);
        if (rec === undefined) {
            var src;
            if (el.tagName.toLowerCase() === 'svg') {
                if (!el.getAttribute('xmlns')) el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(el));
            } else src = el.getAttribute('src') || '';
            rec = src ? await fetchImage(src) : null;
            ctx.imgMap.set(el, rec);
        }
        var alt = el.getAttribute && (el.getAttribute('alt') || el.getAttribute('title')) || '';
        if (!rec) return alt ? run('[' + alt + ']', {}) : '';
        var st = parseCss(el.getAttribute('style')), wpx = parseFloat(el.getAttribute('width')) || lenToPx(st.width) || rec.w || 300;
        var hpx = parseFloat(el.getAttribute('height')) || lenToPx(st.height);
        if (/%/.test(st.width || '')) wpx = ctx.textWidthPx * parseFloat(st.width) / 100;
        if (!hpx || /auto|%/.test(st.height || '')) hpx = rec.w ? wpx * rec.h / rec.w : wpx * 0.6;
        if (wpx > ctx.textWidthPx) { hpx = hpx * ctx.textWidthPx / wpx; wpx = ctx.textWidthPx; }
        var name = 'image' + (++ctx.mediaN) + '.' + rec.ext;
        ctx.media.push({ name: name, bytes: rec.bytes, ext: rec.ext });
        var rid = ctx.rel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', 'media/' + name);
        var cx = pxToEmu(wpx), cy = pxToEmu(hpx), id = ctx.docPrId++;
        return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="Picture ' + id + '" descr="' + xe(alt) + '"/>' +
            '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + id + '" name="' + name + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
            '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
            '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }

    // ---- paragraphs ----
    function pPr(b) {
        var s = '';
        if (b.style) s += '<w:pStyle w:val="' + b.style + '"/>';
        if (b.keepNext) s += '<w:keepNext/>';
        if (b.pageBreakBefore) s += '<w:pageBreakBefore/>';
        if (b.numId) s += '<w:numPr><w:ilvl w:val="' + (b.ilvl || 0) + '"/><w:numId w:val="' + b.numId + '"/></w:numPr>';
        if (b.border) s += '<w:pBdr>' + b.border + '</w:pBdr>';
        if (b.shd) s += '<w:shd w:val="clear" w:color="auto" w:fill="' + b.shd + '"/>';
        if (b.rtl) s += '<w:bidi/>';
        if (b.before != null || b.after != null || b.line) {
            s += '<w:spacing' + (b.before != null ? ' w:before="' + b.before + '"' : '') + (b.after != null ? ' w:after="' + b.after + '"' : '') + (b.line ? ' w:line="' + b.line + '" w:lineRule="auto"' : '') + '/>';
        }
        if (b.left || b.right || b.first) s += '<w:ind' + (b.left ? ' w:left="' + b.left + '"' : '') + (b.right ? ' w:right="' + b.right + '"' : '') + (b.first ? (b.first < 0 ? ' w:hanging="' + (-b.first) + '"' : ' w:firstLine="' + b.first + '"') : '') + '/>';
        if (b.jc) s += '<w:jc w:val="' + b.jc + '"/>';
        return s ? '<w:pPr>' + s + '</w:pPr>' : '';
    }
    function blockFromEl(el, b) {
        var n = Object.assign({}, b), st = parseCss(el.getAttribute && el.getAttribute('style'));
        var al = (st['text-align'] || el.getAttribute('align') || '').toLowerCase();
        if (al === 'center') n.jc = 'center'; else if (al === 'right' || al === 'end') n.jc = n.rtl ? 'left' : 'right'; else if (al === 'justify') n.jc = 'both'; else if (al === 'left' || al === 'start') n.jc = 'left';
        var ml = lenToPx(st['margin-left'] || st['padding-left']); if (ml > 0) n.left = (n.left || 0) + Math.round(ml * 15);
        var mr = lenToPx(st['margin-right']); if (mr > 0) n.right = (n.right || 0) + Math.round(mr * 15);
        var ti = lenToPx(st['text-indent']); if (ti) n.first = Math.round(ti * 15);
        var mt = lenToPx(st['margin-top']), mb = lenToPx(st['margin-bottom']);
        if (mt != null && mt >= 0) n.before = Math.round(mt * 15);
        if (mb != null && mb >= 0) n.after = Math.round(mb * 15);
        var lh = st['line-height']; if (lh && /^[\d.]+$/.test(lh)) n.line = Math.round(parseFloat(lh) * 240);
        var bg = st['background-color'] || (st.background && !/url|gradient/.test(st.background) ? st.background : '');
        if (bg) { var hx = colorToHex(bg); if (hx) n.shd = hx; }
        if (el.getAttribute('dir') === 'rtl' || st.direction === 'rtl') n.rtl = true;
        if (/always|page/.test(st['page-break-before'] || st['break-before'] || '')) n.pageBreakBefore = true;
        return n;
    }
    async function para(nodes, b, f, ctx, pre) {
        var runs = await inlineRuns(nodes, f || {}, ctx, pre);
        return '<w:p>' + pPr(b) + runs + '</w:p>';
    }
    function trimNodes(nodes) { // убираем пробелы по краям абзаца (обработка whitespace как в браузере)
        var a = nodes.slice();
        while (a.length && a[0].nodeType === 3 && !/\S/.test(a[0].nodeValue)) a.shift();
        while (a.length && a[a.length - 1].nodeType === 3 && !/\S/.test(a[a.length - 1].nodeValue)) a.pop();
        return a;
    }

    // ---- blocks ----
    async function blocksOf(parent, ctx, b, f) {
        var out = [], buf = [];
        async function flush() {
            if (!buf.length) return;
            var nodes = trimNodes(buf); buf = [];
            if (!nodes.length) return;
            out.push(await para(nodes, b, f, ctx));
        }
        for (var c = parent.firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 3) buf.push(c);
            else if (c.nodeType === 1) {
                if (c.matches(SKIP_SEL)) continue;
                if (isBlockEl(c)) { await flush(); out.push(await blockEl(c, ctx, b, f)); } else buf.push(c);
            }
        }
        await flush();
        return out.join('');
    }
    var CALLOUT_COLORS = { note: ['E8F1FB', '2F6DB5'], tip: ['E7F5EC', '2E8B57'], warning: ['FFF4DC', 'D9A21B'], danger: ['FDE8E8', 'C0392B'] };

    async function blockEl(el, ctx, b, f) {
        var tag = el.tagName, cl = el.classList, nb = blockFromEl(el, b), xml;
        f = f || {};
        if (cl.contains('lne-pagebreak')) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        if (cl.contains('lne-toc')) return tocXml(el, ctx);
        if (cl.contains('cl-item')) {
            var cb = el.querySelector('.cl-cb'), tx = el.querySelector('.cl-text');
            var done = cb && (cb.checked || cb.getAttribute('data-checked') === 'true');
            var text = tx ? (tx.value || tx.getAttribute('value') || '') : el.textContent;
            return '<w:p>' + pPr(nb) + run(done ? '\u2611 ' : '\u2610 ', { font: 'Segoe UI Symbol' }) + run(text, done ? { s: true, color: '7F7F7F' } : {}) + '</w:p>';
        }
        if (cl.contains('lne-code-wrapper')) { var pe = el.querySelector('pre,code'); return pe ? preBlock(pe, ctx, nb) : ''; }
        if (cl.contains('lne-callout')) {
            var type = el.getAttribute('data-callout') || 'note', col = CALLOUT_COLORS[type] || CALLOUT_COLORS.note;
            var lab = el.querySelector('.lne-callout-type'), body = el.querySelector('.lne-callout-body') || el;
            var cb2 = Object.assign({}, nb, { shd: col[0], left: (nb.left || 0) + 120, border: '<w:left w:val="single" w:sz="24" w:space="8" w:color="' + col[1] + '"/>' });
            var head = lab ? await para([document.createTextNode(lab.textContent)], cb2, { b: true, color: col[1] }, ctx) : '';
            return head + await blocksOf(body, ctx, cb2, f);
        }
        if (/^H[1-6]$/.test(tag)) {
            var hn = Object.assign({}, nb, { style: 'Heading' + tag.charAt(1), keepNext: true });
            return await para(trimNodes(Array.prototype.slice.call(el.childNodes)), hn, f, ctx);
        }
        if (tag === 'PRE') return preBlock(el, ctx, nb);
        if (tag === 'BLOCKQUOTE') return await blocksOf(el, ctx, Object.assign({}, nb, { style: 'Quote' }), f);
        if (tag === 'UL' || tag === 'OL') return await listXml(el, ctx, nb, f, 0, null);
        if (tag === 'TABLE') return await tableXml(el, ctx, f);
        if (tag === 'HR') return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="A6A6A6"/></w:pBdr></w:pPr></w:p>';
        if (tag === 'SUMMARY') return await para(trimNodes(Array.prototype.slice.call(el.childNodes)), nb, Object.assign({}, f, { b: true }), ctx);
        if (tag === 'FIGCAPTION') return await para(trimNodes(Array.prototype.slice.call(el.childNodes)), Object.assign({}, nb, { style: 'Caption' }), f, ctx);
        if (cl.contains('lne-title')) return await para(trimNodes(Array.prototype.slice.call(el.childNodes)), Object.assign({}, nb, { style: 'Title' }), f, ctx);
        if (cl.contains('lne-subtitle')) return await para(trimNodes(Array.prototype.slice.call(el.childNodes)), Object.assign({}, nb, { style: 'Subtitle' }), f, ctx);
        if (cl.contains('lne-caption')) return await para(trimNodes(Array.prototype.slice.call(el.childNodes)), Object.assign({}, nb, { style: 'Caption' }), f, ctx);
        if (tag === 'P' || (tag === 'DIV' && !hasBlockChild(el)) || tag === 'LI' || tag === 'DT' || tag === 'DD' || tag === 'ADDRESS') {
            var nodes = trimNodes(Array.prototype.slice.call(el.childNodes));
            if (!nodes.length) return '<w:p>' + pPr(nb) + '</w:p>';
            return await para(nodes, nb, f, ctx);
        }
        xml = await blocksOf(el, ctx, nb, f); // DIV/SECTION/… с вложенными блоками
        return xml;
    }
    function preBlock(pe, ctx, nb) {
        var txt = pe.textContent.replace(/\r/g, '').replace(/\n$/, '');
        var cb = Object.assign({}, nb, { style: 'CodeBlock', shd: 'F2F2F2' });
        return txt.split('\n').map(function (ln) { return '<w:p>' + pPr(cb) + (ln ? run(ln.replace(/\t/g, '    '), { font: 'Consolas' }) : '') + '</w:p>'; }).join('');
    }

    async function listXml(listEl, ctx, b, f, lvl, numId) {
        var ordered = listEl.tagName === 'OL', out = [];
        if (numId == null || lvl === 0) {
            numId = ctx.numDefs.length + 1;
            ctx.numDefs.push({ numId: numId, abs: ordered ? 1 : 0, start: ordered ? (parseInt(listEl.getAttribute('start'), 10) || 1) : 1 });
        }
        for (var li = listEl.firstElementChild; li; li = li.nextElementSibling) {
            if (li.tagName !== 'LI') continue;
            var inline = [], sub = [];
            for (var c = li.firstChild; c; c = c.nextSibling) {
                if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) { sub.push(c); continue; }
                if (c.nodeType === 1 && isBlockEl(c) && c.tagName !== 'LI') { // <li><p>…</p></li>
                    if (inline.length) { /* already have inline: keep order by flushing */ }
                    inline.push(c);
                } else inline.push(c);
            }
            var lb = Object.assign({}, b, { numId: numId, ilvl: Math.min(lvl, 8), style: 'ListParagraph', left: 0, first: 0, before: 0, after: 0 });
            var nodes = trimNodes(inline.reduce(function (acc, n2) {
                if (n2.nodeType === 1 && (n2.tagName === 'P' || n2.tagName === 'DIV')) { if (acc.length) acc.push(document.createElement('br')); Array.prototype.push.apply(acc, Array.prototype.slice.call(n2.childNodes)); } else acc.push(n2);
                return acc;
            }, []));
            out.push(await para(nodes, lb, f, ctx));
            for (var s = 0; s < sub.length; s++) out.push(await listXml(sub[s], ctx, b, f, lvl + 1, numId));
        }
        return out.join('');
    }

    async function tableXml(tbl, ctx, f) {
        var rows = [], i;
        tbl.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr').forEach(function (r) { rows.push(r); });
        if (!rows.length) return '';
        var grid = [], cols = 0;
        rows.forEach(function (r) { var n = 0; Array.prototype.forEach.call(r.children, function (c) { if (/^T[DH]$/.test(c.tagName)) n += parseInt(c.getAttribute('colspan'), 10) || 1; }); cols = Math.max(cols, n); });
        if (!cols) return '';
        var totalTw = Math.round(ctx.textWidthPx * 15), colW = Math.floor(totalTw / cols);
        var stT = parseCss(tbl.getAttribute('style')), fullW = /100%/.test(stT.width || tbl.getAttribute('width') || '') || !(stT.width || tbl.getAttribute('width'));
        var cgs = tbl.querySelectorAll(':scope > colgroup > col'), colWs = [];
        for (i = 0; i < cols; i++) {
            var cw = cgs[i] && (lenToPx(parseCss(cgs[i].getAttribute('style')).width) || parseFloat(cgs[i].getAttribute('width')));
            colWs.push(cw ? Math.round(cw * 15) : colW);
        }
        var sum = colWs.reduce(function (a, c) { return a + c; }, 0); if (sum > totalTw * 1.01) colWs = colWs.map(function (c) { return Math.floor(c * totalTw / sum); });
        var occupied = new Array(cols).fill(0); // rowspan, оставшийся по колонкам
        var trs = [];
        for (var ri = 0; ri < rows.length; ri++) {
            var r = rows[ri], cells = Array.prototype.filter.call(r.children, function (c) { return /^T[DH]$/.test(c.tagName); }), col = 0, tcs = '';
            var isHeadRow = r.parentNode.tagName === 'THEAD' || (cells.length && cells.every(function (c) { return c.tagName === 'TH'; }));
            var ci = 0;
            while (col < cols) {
                if (occupied[col] > 0) { // продолжение объединённой по вертикали ячейки
                    tcs += '<w:tc><w:tcPr><w:tcW w:w="' + colWs[col] + '" w:type="dxa"/><w:vMerge/></w:tcPr><w:p/></w:tc>';
                    occupied[col]--; col++; continue;
                }
                var cell = cells[ci++]; if (!cell) { tcs += '<w:tc><w:tcPr><w:tcW w:w="' + colWs[col] + '" w:type="dxa"/></w:tcPr><w:p/></w:tc>'; col++; continue; }
                var cs = Math.min(parseInt(cell.getAttribute('colspan'), 10) || 1, cols - col), rs = parseInt(cell.getAttribute('rowspan'), 10) || 1, wtw = 0;
                for (var k = 0; k < cs; k++) wtw += colWs[col + k];
                var cst = parseCss(cell.getAttribute('style')), bgc = colorToHex(cst['background-color'] || cst.background || cell.getAttribute('bgcolor') || '');
                var isTh = cell.tagName === 'TH' || isHeadRow;
                var inner = await blocksOf(cell, ctx, { before: 0, after: 0, jc: cell.tagName === 'TH' && !cst['text-align'] ? 'center' : undefined }, isTh ? Object.assign({}, f, { b: true }) : f);
                if (!inner) inner = '<w:p/>';
                var va = /middle/.test(cst['vertical-align'] || '') ? '<w:vAlign w:val="center"/>' : '';
                tcs += '<w:tc><w:tcPr><w:tcW w:w="' + wtw + '" w:type="dxa"/>' + (cs > 1 ? '<w:gridSpan w:val="' + cs + '"/>' : '') + (rs > 1 ? '<w:vMerge w:val="restart"/>' : '') +
                    (bgc ? '<w:shd w:val="clear" w:color="auto" w:fill="' + bgc + '"/>' : isTh ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '') + va + '</w:tcPr>' + inner + '</w:tc>';
                if (rs > 1) for (k = 0; k < cs; k++) occupied[col + k] = rs - 1;
                col += cs;
            }
            trs.push('<w:tr><w:trPr><w:cantSplit/>' + (isHeadRow && ri === 0 ? '<w:tblHeader/>' : '') + '</w:trPr>' + tcs + '</w:tr>');
        }
        var bd = '<w:top w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/><w:left w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/><w:right w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>';
        var gridXml = '<w:tblGrid>' + colWs.map(function (c) { return '<w:gridCol w:w="' + c + '"/>'; }).join('') + '</w:tblGrid>';
        return '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="' + (fullW ? 5000 : colWs.reduce(function (a, c) { return a + c; }, 0)) + '" w:type="' + (fullW ? 'pct' : 'dxa') + '"/><w:tblBorders>' + bd + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
            gridXml + trs.join('') + '</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>';
    }

    function tocXml(el, ctx) {
        var items = Array.prototype.slice.call(el.querySelectorAll('a, li, .lne-toc-item'));
        var lines = [];
        var seen = new Set();
        (items.length ? items : []).forEach(function (a) {
            var li = a.closest('li') || a, t = li.textContent.trim();
            if (!t || seen.has(li)) return; seen.add(li);
            var lv = parseInt(li.getAttribute('data-level') || (a.getAttribute && a.getAttribute('data-level')) || '1', 10) || 1;
            lines.push({ t: t, lv: Math.min(Math.max(lv, 1), 3) });
        });
        var title = el.querySelector('.lne-toc-title'), head = title ? '<w:p><w:pPr><w:pStyle w:val="TOCHeading"/></w:pPr>' + run(title.textContent.trim(), {}) + '</w:p>' : '';
        if (!lines.length) lines.push({ t: ' ', lv: 1 });
        var xml = head;
        lines.forEach(function (ln, i) {
            var pre = i === 0 ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' : '';
            var post = i === lines.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : '';
            xml += '<w:p><w:pPr><w:pStyle w:val="TOC' + ln.lv + '"/></w:pPr>' + pre + run(ln.t, {}) + post + '</w:p>';
        });
        return xml;
    }

    // ---- package parts ----
    function stylesXml(meta, base) {
        var font = xe(base.font || 'Calibri'), sz = base.sz || 22, lang = xe(meta.lang || 'en-US');
        function pst(id, name, based, pr, rp, extra) {
            return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/>' + (based ? '<w:basedOn w:val="' + based + '"/>' : '') + '<w:next w:val="Normal"/>' + (extra || '') + '<w:qFormat/>' + (pr ? '<w:pPr>' + pr + '</w:pPr>' : '') + (rp ? '<w:rPr>' + rp + '</w:rPr>' : '') + '</w:style>';
        }
        var H = [[32, '2F5496'], [26, '2F5496'], [24, '1F3763'], [22, '2F5496'], [22, '1F3763'], [22, '595959']], hs = '';
        H.forEach(function (h, i) {
            hs += pst('Heading' + (i + 1), 'heading ' + (i + 1), 'Normal', '<w:keepNext/><w:keepLines/><w:spacing w:before="' + (i === 0 ? 360 : 200) + '" w:after="80"/><w:outlineLvl w:val="' + i + '"/>', '<w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '"/><w:b/><w:color w:val="' + h[1] + '"/><w:sz w:val="' + h[0] + '"/><w:szCs w:val="' + h[0] + '"/>');
        });
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="' + W_NS + '">' +
            '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '" w:eastAsia="' + font + '" w:cs="' + font + '"/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/><w:lang w:val="' + lang + '" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>' +
            '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
            '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
            '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>' +
            '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
            hs +
            pst('Title', 'Title', 'Normal', '<w:spacing w:after="80" w:line="240" w:lineRule="auto"/><w:contextualSpacing/>', '<w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '"/><w:sz w:val="56"/><w:szCs w:val="56"/>') +
            pst('Subtitle', 'Subtitle', 'Normal', '<w:spacing w:after="160"/>', '<w:color w:val="595959"/><w:spacing w:val="15"/><w:sz w:val="28"/><w:szCs w:val="28"/>') +
            pst('Quote', 'Quote', 'Normal', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="10" w:color="BFBFBF"/></w:pBdr><w:spacing w:before="160" w:after="160"/><w:ind w:left="567" w:right="567"/>', '<w:i/><w:iCs/><w:color w:val="404040"/>') +
            pst('CodeBlock', 'Code Block', 'Normal', '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/><w:szCs w:val="20"/>') +
            pst('Caption', 'caption', 'Normal', '<w:spacing w:after="200" w:line="240" w:lineRule="auto"/>', '<w:i/><w:iCs/><w:color w:val="44546A"/><w:sz w:val="18"/><w:szCs w:val="18"/>') +
            pst('ListParagraph', 'List Paragraph', 'Normal', '<w:spacing w:after="40"/><w:ind w:left="720"/><w:contextualSpacing/>', '') +
            pst('TOCHeading', 'TOC Heading', 'Heading1', '<w:outlineLvl w:val="9"/>', '') +
            pst('TOC1', 'toc 1', 'Normal', '<w:spacing w:after="100"/>', '') + pst('TOC2', 'toc 2', 'Normal', '<w:spacing w:after="100"/><w:ind w:left="220"/>', '') + pst('TOC3', 'toc 3', 'Normal', '<w:spacing w:after="100"/><w:ind w:left="440"/>', '') +
            pst('FootnoteText', 'footnote text', 'Normal', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', '<w:sz w:val="20"/><w:szCs w:val="20"/>') +
            pst('CommentText', 'annotation text', 'Normal', '<w:spacing w:line="240" w:lineRule="auto"/>', '<w:sz w:val="20"/><w:szCs w:val="20"/>') +
            pst('Header', 'header', 'Normal', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', '<w:color w:val="595959"/>') + pst('Footer', 'footer', 'Normal', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', '<w:color w:val="595959"/>') +
            '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
            '<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>' +
            '<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>' +
            '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style>' +
            '</w:styles>';
    }
    function numberingXml(defs) {
        function lvls(bullet) {
            var s = '';
            for (var i = 0; i < 9; i++) {
                var fmt = bullet ? 'bullet' : ['decimal', 'lowerLetter', 'lowerRoman'][i % 3];
                var txt = bullet ? ['\u2022', '\u25E6', '\u25AA'][i % 3] : '%' + (i + 1) + '.';
                s += '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="' + fmt + '"/><w:lvlText w:val="' + txt + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 + 360 * i) + '" w:hanging="360"/></w:pPr>' +
                    (bullet ? '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:hint="default"/></w:rPr>' : '') + '</w:lvl>';
            }
            return s;
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="' + W_NS + '">' +
            '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>' + lvls(true) + '</w:abstractNum>' +
            '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>' + lvls(false) + '</w:abstractNum>' +
            defs.map(function (d) { return '<w:num w:numId="' + d.numId + '"><w:abstractNumId w:val="' + d.abs + '"/>' + (d.abs === 1 ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="' + d.start + '"/></w:lvlOverride>' : '') + '</w:num>'; }).join('') + '</w:numbering>';
    }
    var NS_ALL = 'xmlns:w="' + W_NS + '" xmlns:r="' + R_NS + '" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

    function hfXml(kind, text, withPageNum) {
        var tag = kind === 'header' ? 'hdr' : 'ftr', style = kind === 'header' ? 'Header' : 'Footer';
        var body = '<w:p><w:pPr><w:pStyle w:val="' + style + '"/><w:jc w:val="' + (kind === 'footer' && withPageNum && !text ? 'center' : 'left') + '"/></w:pPr>' + (text ? run(text, {}) : '');
        if (withPageNum) {
            if (text) body += '<w:r><w:tab/></w:r>';
            body += '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:' + tag + ' ' + NS_ALL + '>' + body + '</w:p></w:' + tag + '>';
    }

    function readBaseFont() {
        var p = {}; try { p = JSON.parse(localStorage.getItem('lne-prefs') || '{}') || {}; } catch (e) {}
        var font = (p.font || '').split(',')[0].replace(/["']/g, '').trim() || 'Calibri';
        var px = parseFloat(p.size) || 16;
        return { font: font, sz: Math.round(px * 0.75 * 2) };
    }

    function prepareDom(html) {
        var clean = (w.DOMPurify && w.DOMPurify.sanitize) ? w.DOMPurify.sanitize(html || '', { ADD_TAGS: ['iframe', 'video', 'source'], ADD_ATTR: ['data-src', 'allowfullscreen', 'target'] }) : (html || '');
        return new DOMParser().parseFromString('<!doctype html><body>' + clean, 'text/html').body;
    }

    async function exportDocx(html, opts) {
        opts = opts || {};
        var meta = Object.assign(defaultMeta(), opts.meta || {});
        meta.margins = Object.assign({}, MARGIN_PRESETS.normal, meta.margins || {});
        var body = prepareDom(html), ctx = new Ctx(meta, opts), base = readBaseFont();
        var inner = await blocksOf(body, ctx, {}, meta.lang ? { lang: meta.lang } : {});
        if (!inner) inner = '<w:p/>';

        var dims = pageDims(meta), m = meta.margins, rel = [], ct = [];
        var hdrId = '', ftrId = '';
        var files = [];
        if (meta.header) { hdrId = ctx.rel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/header', 'header1.xml'); files.push({ name: 'word/header1.xml', data: enc.encode(hfXml('header', meta.header, false)) }); }
        if (meta.footer || meta.pageNum) { ftrId = ctx.rel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer', 'footer1.xml'); files.push({ name: 'word/footer1.xml', data: enc.encode(hfXml('footer', meta.footer, !!meta.pageNum)) }); }
        var sect = '<w:sectPr>' + (hdrId ? '<w:headerReference w:type="default" r:id="' + hdrId + '"/>' : '') + (ftrId ? '<w:footerReference w:type="default" r:id="' + ftrId + '"/>' : '') +
            '<w:pgSz w:w="' + mmToTw(dims[0]) + '" w:h="' + mmToTw(dims[1]) + '"' + (meta.orient === 'landscape' ? ' w:orient="landscape"' : '') + '/>' +
            '<w:pgMar w:top="' + mmToTw(m.t) + '" w:right="' + mmToTw(m.r) + '" w:bottom="' + mmToTw(m.b) + '" w:left="' + mmToTw(m.l) + '" w:header="708" w:footer="708" w:gutter="0"/>' +
            (meta.border ? '<w:pgBorders w:offsetFrom="page"><w:top w:val="single" w:sz="8" w:space="24" w:color="7F7F7F"/><w:left w:val="single" w:sz="8" w:space="24" w:color="7F7F7F"/><w:bottom w:val="single" w:sz="8" w:space="24" w:color="7F7F7F"/><w:right w:val="single" w:sz="8" w:space="24" w:color="7F7F7F"/></w:pgBorders>' : '') +
            (meta.cols > 1 ? '<w:cols w:num="' + meta.cols + '" w:space="708"/>' : '') + '</w:sectPr>';
        var bgc = colorToHex(meta.pageColor);
        var docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS_ALL + '>' + (bgc ? '<w:background w:color="' + bgc + '"/>' : '') + '<w:body>' + inner + sect + '</w:body></w:document>';

        var hasFn = ctx.footnotes.length > 0, hasCm = ctx.comments.length > 0;
        var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
        var relsBase = [
            { id: 'rId1', type: R + 'styles', target: 'styles.xml' }, { id: 'rId2', type: R + 'numbering', target: 'numbering.xml' },
            { id: 'rId3', type: R + 'settings', target: 'settings.xml' }
        ];
        if (hasFn) relsBase.push({ id: 'rId4', type: R + 'footnotes', target: 'footnotes.xml' });
        if (hasCm) relsBase.push({ id: 'rId5', type: R + 'comments', target: 'comments.xml' });
        var allRels = relsBase.concat(ctx.rels);
        var relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            allRels.map(function (r) { return '<Relationship Id="' + r.id + '" Type="' + r.type + '" Target="' + xe(r.target) + '"' + (r.external ? ' TargetMode="External"' : '') + '/>'; }).join('') + '</Relationships>';

        var exts = {}; ctx.media.forEach(function (x) { exts[x.ext] = 1; });
        var ctXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
            Object.keys(exts).map(function (e) { return '<Default Extension="' + e + '" ContentType="image/' + e + '"/>'; }).join('') +
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
            '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
            '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
            (hasFn ? '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>' : '') +
            (hasCm ? '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' : '') +
            (hdrId ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : '') +
            (ftrId ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') +
            '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
            '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';

        var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        var core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
            '<dc:title>' + xe(meta.title || opts.title || '') + '</dc:title><dc:creator>' + xe(meta.author || opts.author || 'Local Notes') + '</dc:creator>' +
            '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>';
        var app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Local Notes</Application></Properties>';
        var settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ' + NS_ALL + '>' + (bgc ? '<w:displayBackgroundShape/>' : '') + (meta.hyphen ? '<w:autoHyphenation/>' : '') +
            (hasFn ? '<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr>' : '') + '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';

        var out = [
            { name: '[Content_Types].xml', data: enc.encode(ctXml) },
            { name: '_rels/.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + 'officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="' + R + 'extended-properties" Target="docProps/app.xml"/></Relationships>') },
            { name: 'word/document.xml', data: enc.encode(docXml) },
            { name: 'word/_rels/document.xml.rels', data: enc.encode(relsXml) },
            { name: 'word/styles.xml', data: enc.encode(stylesXml(meta, base)) },
            { name: 'word/numbering.xml', data: enc.encode(numberingXml(ctx.numDefs)) },
            { name: 'word/settings.xml', data: enc.encode(settings) },
            { name: 'docProps/core.xml', data: enc.encode(core) },
            { name: 'docProps/app.xml', data: enc.encode(app) }
        ].concat(files);
        if (hasFn) {
            var fx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes ' + NS_ALL + '><w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>';
            ctx.footnotes.forEach(function (n) { fx += '<w:footnote w:id="' + n.id + '"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>' + run(' ' + n.text, {}) + '</w:p></w:footnote>'; });
            out.push({ name: 'word/footnotes.xml', data: enc.encode(fx + '</w:footnotes>') });
        }
        if (hasCm) {
            var cx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments ' + NS_ALL + '>';
            ctx.comments.forEach(function (c) {
                var ini = (c.author.match(/\b\p{L}/gu) || ['L']).slice(0, 2).join('').toUpperCase();
                cx += '<w:comment w:id="' + c.id + '" w:author="' + xe(c.author) + '" w:date="' + xe(String(c.date).replace(/\.\d+Z$/, 'Z')) + '" w:initials="' + xe(ini) + '"><w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>' + run(c.text, {}) + '</w:p></w:comment>';
            });
            out.push({ name: 'word/comments.xml', data: enc.encode(cx + '</w:comments>') });
        }
        ctx.media.forEach(function (x) { out.push({ name: 'word/media/' + x.name, data: x.bytes }); });
        var zip = await buildZip(out);
        return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }

    // ═════════════════════════════ .doc как Word-HTML (MHTML) ═════════════════════════════
    async function exportDoc(html, opts) {
        opts = opts || {};
        var meta = Object.assign(defaultMeta(), opts.meta || {});
        meta.margins = Object.assign({}, MARGIN_PRESETS.normal, meta.margins || {});
        var body = prepareDom(html), parts = [], n = 0;
        var imgs = Array.prototype.slice.call(body.querySelectorAll('img, svg'));
        for (var i = 0; i < imgs.length; i++) {
            var el = imgs[i], src;
            if (el.tagName.toLowerCase() === 'svg') {
                if (!el.getAttribute('xmlns')) el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(el));
            } else src = el.getAttribute('src') || '';
            var rec = src ? await fetchImage(src) : null;
            if (!rec) { el.remove(); continue; }
            var name = 'image' + (++n) + '.' + rec.ext, img = el.tagName.toLowerCase() === 'svg' ? document.createElement('img') : el;
            img.setAttribute('src', 'file:///C:/localnotes/' + name);
            if (img !== el) { img.setAttribute('width', rec.w); img.setAttribute('height', rec.h); el.replaceWith(img); }
            parts.push({ name: name, ext: rec.ext, bytes: rec.bytes });
        }
        body.querySelectorAll(SKIP_SEL).forEach(function (e) { e.remove(); });
        body.querySelectorAll('.cl-item').forEach(function (it) {
            var cb = it.querySelector('.cl-cb'), tx = it.querySelector('.cl-text'), p = document.createElement('p');
            p.textContent = ((cb && (cb.checked || cb.getAttribute('data-checked') === 'true')) ? '\u2611 ' : '\u2610 ') + (tx ? (tx.value || tx.getAttribute('value') || '') : '');
            it.replaceWith(p);
        });
        body.querySelectorAll('.lne-pagebreak').forEach(function (e) { e.outerHTML = '<br clear="all" style="page-break-before:always;mso-special-character:line-break">'; });
        body.querySelectorAll('input,button,iframe,video,audio').forEach(function (e) { e.remove(); });
        var dims = pageDims(meta), mm = meta.margins, fo = meta.orient === 'landscape';
        var base = readBaseFont();
        var css = '@page Section1{size:' + dims[0] + 'mm ' + dims[1] + 'mm;' + (fo ? 'mso-page-orientation:landscape;' : '') + 'margin:' + mm.t + 'mm ' + mm.r + 'mm ' + mm.b + 'mm ' + mm.l + 'mm;mso-header-margin:12.5mm;mso-footer-margin:12.5mm;}' +
            'div.Section1{page:Section1;' + (meta.cols > 1 ? '-moz-column-count:' + meta.cols + ';column-count:' + meta.cols + ';' : '') + '}' +
            'body{font-family:"' + base.font + '",sans-serif;font-size:' + (base.sz / 2) + 'pt;' + (meta.pageColor ? 'background:' + meta.pageColor + ';' : '') + '}' +
            'table{border-collapse:collapse}td,th{border:1pt solid #A6A6A6;padding:3pt 5pt;vertical-align:top}th{background:#F2F2F2}' +
            'pre{font-family:Consolas,monospace;background:#F2F2F2;padding:6pt;white-space:pre-wrap}blockquote{border-left:3pt solid #BFBFBF;margin-left:18pt;padding-left:10pt;color:#404040}' +
            'img{max-width:100%;height:auto}';
        var title = xe(meta.title || opts.title || 'Document');
        var hdr = meta.header ? '<p style="color:#595959;font-size:9pt">' + he(meta.header) + '</p><hr>' : '';
        var ftr = (meta.footer || meta.pageNum) ? '<hr><p style="color:#595959;font-size:9pt">' + he(meta.footer || '') + '</p>' : '';
        var htmlDoc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns="http://www.w3.org/TR/REC-html40">' +
            '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>' + title + '</title>' +
            '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->' +
            '<style><!--' + css + '--></style></head><body lang="' + xe(meta.lang || 'en-US') + '"><div class="Section1">' + hdr + body.innerHTML + ftr + '</div></body></html>';
        var boundary = '----=_NextPart_LN_' + Math.random().toString(36).slice(2), CRLF = '\r\n';
        var chunks = [enc.encode('MIME-Version: 1.0' + CRLF + 'Content-Type: multipart/related; boundary="' + boundary + '"; type="text/html"' + CRLF + CRLF)];
        function qp(s) { // quoted-printable (UTF-8), строки ≤ 76 символов
            var bytes = enc.encode(s), out = '', line = '';
            for (var k = 0; k < bytes.length; k++) {
                var c = bytes[k], t;
                if (c === 10) { out += line + CRLF; line = ''; continue; } if (c === 13) continue;
                t = (c >= 33 && c <= 126 && c !== 61) || c === 32 || c === 9 ? String.fromCharCode(c) : '=' + ('0' + c.toString(16)).slice(-2).toUpperCase();
                if (line.length + t.length > 75) { out += line + '=' + CRLF; line = ''; }
                line += t;
            }
            return out + line;
        }
        chunks.push(enc.encode('--' + boundary + CRLF + 'Content-Location: file:///C:/localnotes/document.htm' + CRLF + 'Content-Transfer-Encoding: quoted-printable' + CRLF + 'Content-Type: text/html; charset="utf-8"' + CRLF + CRLF + qp(htmlDoc) + CRLF + CRLF));
        parts.forEach(function (p) {
            var b64 = bytesToB64(p.bytes).replace(/(.{76})/g, '$1' + CRLF);
            chunks.push(enc.encode('--' + boundary + CRLF + 'Content-Location: file:///C:/localnotes/' + p.name + CRLF + 'Content-Transfer-Encoding: base64' + CRLF + 'Content-Type: image/' + p.ext + CRLF + CRLF + b64 + CRLF + CRLF));
        });
        chunks.push(enc.encode('--' + boundary + '--' + CRLF));
        return new Blob(chunks, { type: 'application/msword' });
    }

    // ═════════════════════════════ DOCX → HTML ═════════════════════════════
    function parseXml(text) {
        var d = new DOMParser().parseFromString(text, 'application/xml');
        if (d.getElementsByTagName('parsererror').length) throw new Error('Invalid XML in document');
        return d;
    }
    function kids(el, name) { var o = []; if (!el) return o; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) o.push(c); return o; }
    function kid(el, name) { if (!el) return null; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c; return null; }
    function wattr(el, name) { if (!el) return null; var v = el.getAttributeNS(W_NS, name); if (v == null || v === '') v = el.getAttribute('w:' + name); return v == null ? null : v; }
    function rattr(el, name) { if (!el) return null; var v = el.getAttributeNS(R_NS, name); if (v == null || v === '') v = el.getAttribute('r:' + name); return v || null; }
    function onOff(el) { if (!el) return false; var v = wattr(el, 'val'); return !(v === '0' || v === 'false' || v === 'off' || v === 'none'); }
    function descend(el, name, out) { out = out || []; for (var c = el.firstElementChild; c; c = c.nextElementSibling) { if (c.localName === name) out.push(c); descend(c, name, out); } return out; }
    function textOf(el) { return descend(el, 't').map(function (t) { return t.textContent; }).join(''); }

    var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', tif: 'image/tiff', tiff: 'image/tiff' };
    var HL = { yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff' };

    async function importDocx(buf) {
        var zip = readZip(buf);
        if (!zip.map['word/document.xml']) throw new Error('word/document.xml not found — not a Word document');
        var docXml = parseXml(await zipText(zip, 'word/document.xml'));
        var rels = {};
        var relsText = await zipText(zip, 'word/_rels/document.xml.rels');
        if (relsText) kids(parseXml(relsText).documentElement, 'Relationship').forEach(function (r) { rels[r.getAttribute('Id')] = { target: r.getAttribute('Target'), mode: r.getAttribute('TargetMode'), type: r.getAttribute('Type') }; });
        var styles = {}, numbering = { nums: {}, abs: {} };
        var stText = await zipText(zip, 'word/styles.xml');
        if (stText) kids(parseXml(stText).documentElement, 'style').forEach(function (s) { styles[wattr(s, 'styleId')] = { name: (wattr(kid(s, 'name'), 'val') || '').toLowerCase(), basedOn: wattr(kid(s, 'basedOn'), 'val'), el: s }; });
        var nmText = await zipText(zip, 'word/numbering.xml');
        if (nmText) {
            var nd = parseXml(nmText).documentElement;
            kids(nd, 'abstractNum').forEach(function (a) { var lv = {}; kids(a, 'lvl').forEach(function (l) { lv[wattr(l, 'ilvl')] = { fmt: wattr(kid(l, 'numFmt'), 'val'), start: parseInt(wattr(kid(l, 'start'), 'val') || '1', 10) }; }); numbering.abs[wattr(a, 'abstractNumId')] = lv; });
            kids(nd, 'num').forEach(function (n) { numbering.nums[wattr(n, 'numId')] = wattr(kid(n, 'abstractNumId'), 'val'); });
        }
        // сноски и комментарии
        var footnotes = {}, comments = {};
        var fnText = await zipText(zip, 'word/footnotes.xml');
        if (fnText) kids(parseXml(fnText).documentElement, 'footnote').forEach(function (f) { var id = wattr(f, 'id'); if (id > 0) footnotes[id] = kids(f, 'p').map(textOf).join(' ').trim(); });
        var cmText = await zipText(zip, 'word/comments.xml');
        if (cmText) kids(parseXml(cmText).documentElement, 'comment').forEach(function (c) { comments[wattr(c, 'id')] = { text: kids(c, 'p').map(textOf).join('\n').trim(), author: wattr(c, 'author') || '', date: wattr(c, 'date') || '' }; });

        var imgCache = {};
        async function imgData(rid) {
            if (!rid || !rels[rid]) return null;
            if (imgCache[rid] !== undefined) return imgCache[rid];
            var t = rels[rid].target, path = t.charAt(0) === '/' ? t.slice(1) : 'word/' + t;
            path = path.replace(/[^/]+\/\.\.\//g, '');
            var ext = (path.split('.').pop() || '').toLowerCase(), r = null;
            if (MIME[ext] && ext !== 'tif' && ext !== 'tiff') {
                try { var b = await zipGet(zip, path); if (b && b.length < 12 * 1024 * 1024) r = 'data:' + MIME[ext] + ';base64,' + bytesToB64(b); } catch (e) {}
            }
            return (imgCache[rid] = r);
        }

        // ── вспомогательные: стиль → h1/quote/code ──
        function styleChain(id) { var o = [], s = styles[id], g = 0; while (s && g++ < 12) { o.push(s); s = styles[s.basedOn]; } return o; }
        function styleKind(id) {
            var ch = styleChain(id);
            for (var i = 0; i < ch.length; i++) {
                var n = ch[i].name;
                var m = n.match(/^heading (\d)$/); if (m) return { h: Math.min(6, +m[1]) };
                if (n === 'title') return { title: true }; if (n === 'subtitle') return { subtitle: true };
                if (/^(quote|intense quote|block text)$/.test(n)) return { quote: true };
                if (/^(html preformatted|source code|code|plain text|macro text|preformatted)/.test(n)) return { code: true };
                var ol = kid(kid(ch[i].el, 'pPr'), 'outlineLvl'); if (ol && wattr(ol, 'val') !== '9') { var lv = parseInt(wattr(ol, 'val'), 10); if (lv >= 0 && lv < 6) return { h: lv + 1 }; }
            }
            return {};
        }
        function charStyleFlags(id) {
            var f = {}; styleChain(id).forEach(function (s) { var rp = kid(s.el, 'rPr'); if (rp) { if (kid(rp, 'b')) f.b = onOff(kid(rp, 'b')); if (kid(rp, 'i')) f.i = onOff(kid(rp, 'i')); } });
            return f;
        }
        function paraStyleRun(id) { // базовые b/i из стиля абзаца (кроме заголовков, где это и так «жирный»)
            var f = {}; styleChain(id).reverse().forEach(function (s) { var rp = kid(s.el, 'rPr'); if (rp) { if (kid(rp, 'b')) f.b = onOff(kid(rp, 'b')); if (kid(rp, 'i')) f.i = onOff(kid(rp, 'i')); } });
            return f;
        }
        function numInfo(numId, ilvl) {
            var abs = numbering.abs[numbering.nums[numId]]; var l = abs && abs[ilvl];
            return { ordered: !!l && l.fmt !== 'bullet' && l.fmt !== 'none', start: l ? l.start : 1 };
        }

        // ── runs ──
        var hasPageField = false;
        async function convRuns(pEl, state, baseFlags) {
            var out = '';
            async function walk(parent, linkCtx) {
                for (var c = parent.firstElementChild; c; c = c.nextElementSibling) {
                    var ln = c.localName;
                    if (ln === 'r') out += await convRun(c, linkCtx);
                    else if (ln === 'hyperlink') {
                        var rid = rattr(c, 'id'), anchor = wattr(c, 'anchor'), href = rid && rels[rid] ? rels[rid].target : (anchor ? '#' + anchor : '');
                        var save = out; out = ''; await walk(c, null);
                        var inner = out; out = save + (href && !/^javascript:/i.test(href) ? '<a href="' + he(href) + '" target="_blank" rel="noopener">' + inner + '</a>' : inner);
                    }
                    else if (ln === 'ins' || ln === 'smartTag' || ln === 'sdt' || ln === 'sdtContent' || ln === 'customXml' || ln === 'fldSimple' || ln === 'moveTo') {
                        if (ln === 'fldSimple' && /\bPAGE\b|NUMPAGES/.test(c.getAttribute('w:instr') || '')) { hasPageField = true; continue; }
                        await walk(c, linkCtx);
                    }
                    else if (ln === 'AlternateContent') { var ch = kid(c, 'Choice') || kid(c, 'Fallback'); if (ch) await walk(ch, linkCtx); }
                    else if (ln === 'commentRangeStart') state.cmt.push(wattr(c, 'id'));
                    else if (ln === 'commentRangeEnd') { var ix = state.cmt.indexOf(wattr(c, 'id')); if (ix >= 0) state.cmt.splice(ix, 1); }
                    else if (ln === 'bookmarkStart') { var bn = wattr(c, 'name'); if (bn && bn.charAt(0) !== '_') out += '<a class="lne-bookmark" id="' + he(bn) + '"></a>'; }
                }
            }
            var fieldStack = [];
            async function convRun(r, linkCtx) {
                var rp = kid(r, 'rPr'), flags = Object.assign({}, baseFlags || {}), st = '';
                if (rp) {
                    var rs = wattr(kid(rp, 'rStyle'), 'val'); if (rs) Object.assign(flags, charStyleFlags(rs));
                    if (kid(rp, 'b')) flags.b = onOff(kid(rp, 'b')); if (kid(rp, 'i')) flags.i = onOff(kid(rp, 'i'));
                    if (kid(rp, 'u')) flags.u = wattr(kid(rp, 'u'), 'val') !== 'none';
                    if (kid(rp, 'strike') || kid(rp, 'dstrike')) flags.s = onOff(kid(rp, 'strike') || kid(rp, 'dstrike'));
                    var va = wattr(kid(rp, 'vertAlign'), 'val'); if (va === 'superscript') flags.sup = true; if (va === 'subscript') flags.sub = true;
                    var col = wattr(kid(rp, 'color'), 'val'); if (col && /^[0-9a-f]{6}$/i.test(col) && col.toUpperCase() !== '000000') st += 'color:#' + col + ';';
                    var hl = wattr(kid(rp, 'highlight'), 'val'); if (hl && HL[hl]) st += 'background-color:' + HL[hl] + ';';
                    var shd = kid(rp, 'shd'); if (shd) { var fill = wattr(shd, 'fill'); if (fill && /^[0-9a-f]{6}$/i.test(fill)) st += 'background-color:#' + fill + ';'; }
                    var rf = kid(rp, 'rFonts'); var ff = rf && (wattr(rf, 'ascii') || wattr(rf, 'hAnsi')); if (ff && !/^(calibri|aptos|times new roman|cambria|arial)( light| display)?$/i.test(ff) || (ff && state.keepFonts)) st += 'font-family:' + ff.replace(/[^\w\s-]/g, '') + ';';
                    var sz = parseInt(wattr(kid(rp, 'sz'), 'val') || '0', 10); if (sz && sz !== 22 && sz !== 24 && !state.noSize) st += 'font-size:' + Math.round(sz / 2 * 4 / 3) + 'px;';
                }
                var html = '';
                for (var x = r.firstElementChild; x; x = x.nextElementSibling) {
                    var n = x.localName;
                    if (n === 'fldChar') {
                        var ty = wattr(x, 'fldCharType');
                        if (ty === 'begin') fieldStack.push({ instr: '', phase: 'code' });
                        else if (ty === 'separate' && fieldStack.length) fieldStack[fieldStack.length - 1].phase = 'result';
                        else if (ty === 'end') fieldStack.pop();
                        continue;
                    }
                    if (n === 'instrText') { if (fieldStack.length) { fieldStack[fieldStack.length - 1].instr += x.textContent; if (/\bPAGE\b|NUMPAGES/.test(x.textContent)) hasPageField = true; } continue; }
                    if (fieldStack.length && fieldStack[fieldStack.length - 1].phase === 'code') continue;
                    if (fieldStack.some(function (f) { return /^\s*(PAGE|NUMPAGES)\b/.test(f.instr); })) continue;
                    if (n === 't' || n === 'delText') { if (n === 't') html += he(x.textContent); }
                    else if (n === 'tab') html += '&emsp;';
                    else if (n === 'br' || n === 'cr') { if (wattr(x, 'type') === 'page') state.pageBreak = true; else html += '<br>'; }
                    else if (n === 'noBreakHyphen') html += '-';
                    else if (n === 'softHyphen') html += '';
                    else if (n === 'sym') { var ch2 = parseInt(wattr(x, 'char') || '0', 16); if (ch2) html += he(String.fromCharCode(ch2 > 0xF000 ? ch2 - 0xF000 : ch2)); }
                    else if (n === 'footnoteReference') { var ft = footnotes[wattr(x, 'id')]; if (ft != null) html += '<sup class="lne-fn" data-fn="' + he(ft) + '">*</sup>'; }
                    else if (n === 'drawing' || n === 'pict' || n === 'object') html += await convDrawing(x);
                    else if (n === 'AlternateContent') { var ch3 = kid(x, 'Choice') || kid(x, 'Fallback'); if (ch3) html += await convDrawing(ch3); }
                }
                if (!html) return '';
                if (flags.b) html = '<strong>' + html + '</strong>'; if (flags.i) html = '<em>' + html + '</em>'; if (flags.u) html = '<u>' + html + '</u>'; if (flags.s) html = '<s>' + html + '</s>';
                if (flags.sup) html = '<sup>' + html + '</sup>'; if (flags.sub) html = '<sub>' + html + '</sub>';
                if (st) html = '<span style="' + st + '">' + html + '</span>';
                if (state.cmt.length && comments[state.cmt[0]]) { var cm = comments[state.cmt[0]]; html = '<span class="lne-comment" data-cid="c' + state.cmt[0] + '" data-comment="' + he(cm.text) + '" data-author="' + he(cm.author) + '" data-date="' + he(cm.date) + '">' + html + '</span>'; }
                // гиперссылка-поле HYPERLINK "url"
                var hf = fieldStack.filter(function (f) { return /^\s*HYPERLINK\s+"([^"]+)"/i.test(f.instr) && f.phase === 'result'; })[0];
                if (hf) { var url = /HYPERLINK\s+"([^"]+)"/i.exec(hf.instr)[1]; if (!/^javascript:/i.test(url)) html = '<a href="' + he(url) + '" target="_blank" rel="noopener">' + html + '</a>'; }
                return html;
            }
            await walk(pEl, null);
            return out;
        }
        async function convDrawing(el) {
            var blip = descend(el, 'blip')[0], rid = blip && rattr(blip, 'embed'), cx = 0, cy = 0, alt = '';
            var ext = descend(el, 'extent')[0]; if (ext) { cx = parseInt(ext.getAttribute('cx'), 10) || 0; cy = parseInt(ext.getAttribute('cy'), 10) || 0; }
            var dp = descend(el, 'docPr')[0]; if (dp) alt = dp.getAttribute('descr') || dp.getAttribute('title') || '';
            if (!rid) { var vi = descend(el, 'imagedata')[0]; if (vi) rid = rattr(vi, 'id'); }
            if (!rid) return '';
            var src = await imgData(rid); if (!src) return '';
            var wpx = cx ? Math.round(cx / 9525) : 0, hpx = cy ? Math.round(cy / 9525) : 0;
            return '<img src="' + src + '" alt="' + he(alt) + '"' + (wpx ? ' width="' + wpx + '"' : '') + ' style="max-width:100%;height:auto">';
        }

        // ── абзацы/списки/таблицы ──
        async function convContainer(parent, opts) {
            opts = opts || {};
            var html = '', stack = []; // открытые списки
            function closeTo(n) { while (stack.length > n) { var s = stack.pop(); html += '</li></' + s.tag + '>'; } }
            for (var c = parent.firstElementChild; c; c = c.nextElementSibling) {
                var ln = c.localName;
                if (ln === 'p') {
                    var pp = kid(c, 'pPr'), np = kid(pp, 'numPr'), sid = wattr(kid(pp, 'pStyle'), 'val'), kind = styleKind(sid);
                    var state = { cmt: [], pageBreak: false, noSize: !!kind.h };
                    // нумерация может прийти из стиля
                    var numId = np ? wattr(kid(np, 'numId'), 'val') : null, ilvl = np ? parseInt(wattr(kid(np, 'ilvl'), 'val') || '0', 10) : 0;
                    if (numId == null && sid) { styleChain(sid).some(function (s) { var sn = kid(kid(s.el, 'pPr'), 'numPr'); if (sn) { numId = wattr(kid(sn, 'numId'), 'val'); ilvl = parseInt(wattr(kid(sn, 'ilvl'), 'val') || '0', 10); return true; } return false; }); }
                    var base = kind.h ? {} : paraStyleRun(sid);
                    var inner = await convRuns(c, state, base);
                    var ps = '', jc = wattr(kid(pp, 'jc'), 'val');
                    if (jc === 'center') ps += 'text-align:center;'; else if (jc === 'right' || jc === 'end') ps += 'text-align:right;'; else if (jc === 'both' || jc === 'distribute') ps += 'text-align:justify;';
                    var ind = kid(pp, 'ind'), left = ind ? parseInt(wattr(ind, 'left') || wattr(ind, 'start') || '0', 10) : 0;
                    var shd = kid(pp, 'shd'), fill = shd && wattr(shd, 'fill'); if (fill && /^[0-9a-f]{6}$/i.test(fill)) ps += 'background-color:#' + fill + ';';
                    var rtl = kid(pp, 'bidi') && onOff(kid(pp, 'bidi'));
                    if (pp && kid(pp, 'pageBreakBefore')) { closeTo(0); html += '<div class="lne-pagebreak" contenteditable="false"></div>'; }
                    var emptyP = !inner.replace(/<[^>]+>/g, '').trim() && !/<img/.test(inner);
                    if (numId && numId !== '0' && !kind.h) {
                        var ni = numInfo(numId, ilvl), tag = ni.ordered ? 'ol' : 'ul', lvl = Math.min(ilvl, 8);
                        while (stack.length > lvl + 1) { var sx = stack.pop(); html += '</li></' + sx.tag + '>'; }
                        if (stack.length === lvl + 1) {
                            if (stack[lvl].tag !== tag) { closeTo(lvl); html += '<' + tag + '>'; stack.push({ tag: tag }); html += '<li>'; }
                            else html += '</li><li>';
                        } else {
                            while (stack.length < lvl + 1) { html += '<' + tag + (stack.length === lvl && ni.ordered && ni.start > 1 ? ' start="' + ni.start + '"' : '') + '>'; stack.push({ tag: tag }); html += '<li>'; }
                        }
                        html += inner || '<br>';
                    } else {
                        closeTo(0);
                        if (left > 0 && !kind.h) ps += 'margin-left:' + Math.round(left / 15) + 'px;';
                        var attrs = (ps ? ' style="' + ps + '"' : '') + (rtl ? ' dir="rtl"' : '');
                        if (kind.h) html += '<h' + kind.h + attrs + '>' + (inner || '<br>') + '</h' + kind.h + '>';
                        else if (kind.title) html += '<p class="lne-title"' + attrs + '>' + (inner || '<br>') + '</p>';
                        else if (kind.subtitle) html += '<p class="lne-subtitle"' + attrs + '>' + (inner || '<br>') + '</p>';
                        else if (kind.quote) html += '<blockquote' + attrs + '>' + (inner || '<br>') + '</blockquote>';
                        else if (kind.code) html += '<pre' + attrs + '>' + (inner.replace(/<br>/g, '\n') || '\n') + '</pre>';
                        else html += '<p' + attrs + '>' + (emptyP ? '<br>' : inner) + '</p>';
                    }
                    if (state.pageBreak) { closeTo(0); html += '<div class="lne-pagebreak" contenteditable="false"></div>'; }
                } else if (ln === 'tbl') { closeTo(0); html += await convTable(c); }
                else if (ln === 'sdt') { var sc = kid(c, 'sdtContent'); if (sc) { closeTo(0); html += await convContainer(sc); } }
                else if (ln === 'AlternateContent') { var chx = kid(c, 'Choice') || kid(c, 'Fallback'); if (chx) { closeTo(0); html += await convContainer(chx); } }
                else if (ln === 'ins' || ln === 'moveTo' || ln === 'customXml') { closeTo(0); html += await convContainer(c); }
            }
            closeTo(0);
            return html;
        }
        async function convTable(tbl) {
            var rows = kids(tbl, 'tr'), vm = {}, out = '<div class="table-responsive"><table style="width:100%;border-collapse:collapse"><tbody>';
            // сначала считаем rowspan по vMerge
            var grid = rows.map(function (tr) { var col = 0, cells = []; kids(tr, 'tc').forEach(function (tc) { var tp = kid(tc, 'tcPr'), gs = parseInt(wattr(kid(tp, 'gridSpan'), 'val') || '1', 10), v = kid(tp, 'vMerge'); cells.push({ tc: tc, col: col, gs: gs, vm: v ? (wattr(v, 'val') === 'restart' ? 'restart' : 'cont') : null, rs: 1 }); col += gs; }); return cells; });
            for (var ri = 0; ri < grid.length; ri++) grid[ri].forEach(function (cell) {
                if (cell.vm === 'restart') { for (var k = ri + 1; k < grid.length; k++) { var nx = grid[k].filter(function (x) { return x.col === cell.col; })[0]; if (nx && nx.vm === 'cont') { cell.rs++; nx.skip = true; } else break; } }
            });
            for (var r = 0; r < rows.length; r++) {
                var hdr = kid(kid(rows[r], 'trPr'), 'tblHeader') ? true : false;
                out += '<tr>';
                for (var i = 0; i < grid[r].length; i++) {
                    var cell = grid[r][i]; if (cell.skip) continue;
                    var tp = kid(cell.tc, 'tcPr'), shd = kid(tp, 'shd'), fill = shd && wattr(shd, 'fill'), st = 'border:1px solid #888;padding:6px 8px;vertical-align:top;';
                    if (fill && /^[0-9a-f]{6}$/i.test(fill)) st += 'background-color:#' + fill + ';';
                    var inner = await convContainer(cell.tc);
                    var tg = hdr ? 'th' : 'td';
                    out += '<' + tg + (cell.gs > 1 ? ' colspan="' + cell.gs + '"' : '') + (cell.rs > 1 ? ' rowspan="' + cell.rs + '"' : '') + ' style="' + st + '">' + (inner || '<p><br></p>') + '</' + tg + '>';
                }
                out += '</tr>';
            }
            return out + '</tbody></table></div><p><br></p>';
        }

        var bodyEl = kid(docXml.documentElement, 'body');
        var html = await convContainer(bodyEl);

        // ── meta: страница, колонтитулы, свойства ──
        var meta = defaultMeta();
        var sect = bodyEl ? kids(bodyEl, 'sectPr').pop() : null;
        if (sect) {
            var pg = kid(sect, 'pgSz'), pm = kid(sect, 'pgMar'), cols = kid(sect, 'cols');
            if (pg) {
                var pw = twToMm(parseInt(wattr(pg, 'w') || '0', 10)), ph = twToMm(parseInt(wattr(pg, 'h') || '0', 10));
                if (wattr(pg, 'orient') === 'landscape' || pw > ph) { meta.orient = 'landscape'; var tmp = pw; pw = ph; ph = tmp; }
                var best = null; Object.keys(PAGE_SIZES).forEach(function (k) { if (Math.abs(PAGE_SIZES[k][0] - pw) < 3 && Math.abs(PAGE_SIZES[k][1] - ph) < 3) best = k; });
                if (best) meta.size = best; else { meta.size = 'custom'; meta.pw = pw; meta.ph = ph; }
            }
            if (pm) meta.margins = { t: twToMm(+wattr(pm, 'top') || 1440), r: twToMm(+wattr(pm, 'right') || 1440), b: twToMm(+wattr(pm, 'bottom') || 1440), l: twToMm(+wattr(pm, 'left') || 1440) };
            if (cols) meta.cols = Math.min(3, Math.max(1, parseInt(wattr(cols, 'num') || '1', 10)));
            async function hf(kind) {
                var ref = kids(sect, kind + 'Reference').filter(function (x) { return wattr(x, 'type') === 'default'; })[0] || kid(sect, kind + 'Reference');
                var rid = ref && rattr(ref, 'id'); if (!rid || !rels[rid]) return '';
                var tx = await zipText(zip, 'word/' + rels[rid].target); if (!tx) return '';
                var d = parseXml(tx).documentElement, hadPage = /\bPAGE\b/.test(tx);
                if (hadPage) meta.pageNum = true;
                // текст без результатов полей PAGE/NUMPAGES (иначе в колонтитул попадает «1»)
                return kids(d, 'p').map(function (p) {
                    var txt = '', depth = 0, skipDepth = 0, instr = [];
                    descend(p, 'r').forEach(function (r) {
                        for (var x = r.firstElementChild; x; x = x.nextElementSibling) {
                            if (x.localName === 'fldChar') {
                                var ty = wattr(x, 'fldCharType');
                                if (ty === 'begin') { depth++; instr[depth] = ''; }
                                else if (ty === 'separate') { if (/^\s*(PAGE|NUMPAGES)\b/.test(instr[depth] || '') && !skipDepth) skipDepth = depth; }
                                else if (ty === 'end') { if (skipDepth === depth) skipDepth = 0; depth = Math.max(0, depth - 1); }
                            } else if (x.localName === 'instrText') { if (depth) instr[depth] += x.textContent; }
                            else if (x.localName === 't' && !skipDepth) txt += x.textContent;
                        }
                    });
                    return txt;
                }).filter(Boolean).join(' ').trim();
            }
            meta.header = await hf('header'); meta.footer = await hf('footer');
        }
        var bg = kid(docXml.documentElement, 'background'); if (bg && wattr(bg, 'color') && /^[0-9a-f]{6}$/i.test(wattr(bg, 'color')) && wattr(bg, 'color').toUpperCase() !== 'FFFFFF') meta.pageColor = '#' + wattr(bg, 'color');
        try {
            var core = await zipText(zip, 'docProps/core.xml');
            if (core) { var cd = parseXml(core); var g = function (n) { var e = cd.getElementsByTagNameNS('*', n)[0]; return e ? e.textContent : ''; }; meta.title = g('title'); meta.author = g('creator'); }
        } catch (e) {}
        return { html: sanitize(html), meta: meta };
    }

    function sanitize(html) {
        if (w.DOMPurify && w.DOMPurify.sanitize) return w.DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'contenteditable'] });
        return String(html).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/ on\w+="[^"]*"/gi, '');
    }

    // ═════════════════════════════ двоичный .doc (OLE2 / CFB) ═════════════════════════════
    function parseCFB(buf) {
        var u8 = new Uint8Array(buf), dv = new DataView(buf);
        var sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
        for (var i = 0; i < 8; i++) if (u8[i] !== sig[i]) throw new Error('Not an OLE2 (.doc) file');
        var ss = 1 << dv.getUint16(30, true), mss = 1 << dv.getUint16(32, true), END = 0xFFFFFFFE, FREE = 0xFFFFFFFF;
        var dirStart = dv.getUint32(48, true), cutoff = dv.getUint32(56, true), miniStart = dv.getUint32(60, true), difatStart = dv.getUint32(68, true), numDifat = dv.getUint32(72, true);
        function secOff(s) { return (s + 1) * ss; }
        var difat = [], k;
        for (k = 0; k < 109; k++) { var v = dv.getUint32(76 + k * 4, true); if (v !== FREE && v !== END) difat.push(v); }
        var ds = difatStart, guard = 0;
        while (ds !== END && ds !== FREE && numDifat-- > 0 && guard++ < 10000) {
            var o = secOff(ds); if (o + ss > u8.length) break;
            for (k = 0; k < ss / 4 - 1; k++) { var v2 = dv.getUint32(o + k * 4, true); if (v2 !== FREE && v2 !== END) difat.push(v2); }
            ds = dv.getUint32(o + ss - 4, true);
        }
        var fat = [];
        difat.forEach(function (s) { var o = secOff(s); if (o + ss > u8.length) return; for (var j = 0; j < ss / 4; j++) fat.push(dv.getUint32(o + j * 4, true)); });
        function chain(start, size) {
            var parts = [], s = start, n = 0, total = 0, limit = fat.length + 2;
            while (s !== END && s !== FREE && n++ < limit) {
                var o = secOff(s); if (o < 0 || o + ss > u8.length + ss) break;
                parts.push(u8.subarray(o, Math.min(o + ss, u8.length))); total += ss; s = fat[s];
                if (size != null && total >= size) break;
            }
            var out = concat(parts); return size != null ? out.subarray(0, size) : out;
        }
        var dir = chain(dirStart), entries = [];
        for (k = 0; k + 128 <= dir.length; k += 128) {
            var d = new DataView(dir.buffer, dir.byteOffset + k, 128), nl = Math.max(0, d.getUint16(64, true) - 2), nm = '';
            for (var q = 0; q < nl; q += 2) nm += String.fromCharCode(d.getUint16(q, true));
            entries.push({ name: nm, type: d.getUint8(66), start: d.getUint32(116, true), size: d.getUint32(120, true) });
        }
        var root = entries.filter(function (e) { return e.type === 5; })[0];
        var mini = root ? chain(root.start, root.size) : new Uint8Array(0);
        var miniFat = []; if (miniStart !== END) { var mf = chain(miniStart); var mdv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength); for (k = 0; k + 4 <= mf.length; k += 4) miniFat.push(mdv.getUint32(k, true)); }
        function stream(name) {
            var e = entries.filter(function (x) { return x.type === 2 && x.name === name; })[0]; if (!e) return null;
            if (e.size >= cutoff) return chain(e.start, e.size);
            var parts = [], s = e.start, n = 0;
            while (s !== END && s !== FREE && n++ < miniFat.length + 2) { var o = s * mss; parts.push(mini.subarray(o, o + mss)); s = miniFat[s]; }
            return concat(parts).subarray(0, e.size);
        }
        return { stream: stream, names: entries.map(function (e) { return e.name; }) };
    }

    function decodeDocText(wd, tbl, fib) {
        var dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
        var ccpText = dv.getUint32(76, true), fcClx = dv.getUint32(0x1A2, true), lcbClx = dv.getUint32(0x1A6, true);
        var td = new DataView(tbl.buffer, tbl.byteOffset, tbl.byteLength), p = fcClx, end = fcClx + lcbClx, plc = null;
        while (p < end) {
            var b = tbl[p];
            if (b === 1) p += 3 + td.getUint16(p + 1, true);
            else if (b === 2) { var lcb = td.getUint32(p + 1, true); plc = { off: p + 5, lcb: lcb }; break; }
            else break;
        }
        if (!plc) throw new Error('Unsupported .doc structure (no piece table)');
        var n = (plc.lcb - 4) / 12, text = '', win1252 = new TextDecoder('windows-1252');
        for (var i = 0; i < n; i++) {
            var cpS = td.getUint32(plc.off + i * 4, true), cpE = td.getUint32(plc.off + (i + 1) * 4, true);
            if (cpS >= ccpText) break; if (cpE > ccpText) cpE = ccpText;
            var fc = td.getUint32(plc.off + (n + 1) * 4 + i * 8 + 2, true), comp = (fc & 0x40000000) !== 0, len = cpE - cpS;
            if (len <= 0) continue;
            if (comp) { var o = (fc & 0x3FFFFFFF) >>> 1; text += win1252.decode(wd.subarray(o, o + len)); }
            else { var o2 = fc & 0x3FFFFFFF; text += new TextDecoder('utf-16le').decode(wd.subarray(o2, o2 + len * 2)); }
        }
        return text;
    }
    function splitRows(items) {
        // Маркер конца строки в .doc — пустая «ячейка» (0x07 сразу после 0x07). Находим число колонок k так,
        // чтобы каждый (k+1)-й элемент был пустым — это отличает конец строки от пустой ячейки.
        var N = items.length, k, j, rows = [];
        for (k = 1; k < N; k++) {
            if (N % (k + 1)) continue;
            var ok = true; for (j = k; j < N; j += k + 1) if (items[j] !== '') { ok = false; break; }
            // одна «строка на всю таблицу» (k = N-1) принимаем, только если пустых ячеек нет — иначе это объединённые/пустые ячейки
            if (ok && (k < N - 1 || items.slice(0, N - 1).every(Boolean))) { for (j = 0; j < N; j += k + 1) rows.push(items.slice(j, j + k)); return rows; }
        }
        var row = [];
        items.forEach(function (s) { if (s === '' && row.length) { rows.push(row); row = []; } else row.push(s); });
        if (row.length) rows.push(row);
        return rows;
    }
    function docTextToHtml(text) {
        // \r — конец абзаца, \x07 — конец ячейки/строки, \x0B — перенос строки, \x0C — разрыв страницы, \x13…\x14…\x15 — поля
        var html = '', cur = '', depth = [], items = null, i, ch;
        function inCode() { return depth.some(function (d) { return d.phase === 'code'; }); }
        function take() { var t = cur; cur = ''; return t; }
        function emitPara(t) { html += '<p>' + ((t.replace(/<[^>]*>/g, '').trim() || /<a /.test(t)) ? t : '<br>') + '</p>'; }
        function closeTable() {
            if (!items) return;
            var rows = splitRows(items); items = null;
            if (!rows.length) return;
            html += '<div class="table-responsive"><table style="width:100%;border-collapse:collapse"><tbody>' + rows.map(function (r) {
                return '<tr>' + r.map(function (c) { return '<td style="border:1px solid #888;padding:6px 8px;vertical-align:top">' + (c || '<br>') + '</td>'; }).join('') + '</tr>';
            }).join('') + '</tbody></table></div><p><br></p>';
        }
        for (i = 0; i < text.length; i++) {
            ch = text[i];
            if (ch === '\x13') { depth.push({ phase: 'code', code: '', start: cur.length }); continue; }
            if (ch === '\x14') { if (depth.length) depth[depth.length - 1].phase = 'result'; continue; }
            if (ch === '\x15') {
                var f = depth.pop();
                if (f && f.phase === 'result') { var m = /HYPERLINK\s+(?:\\[a-z]\s+)*"([^"]+)"/i.exec(f.code); if (m && /^(https?:|mailto:|#)/i.test(m[1])) cur = cur.slice(0, f.start) + '<a href="' + he(m[1]) + '" target="_blank" rel="noopener">' + cur.slice(f.start) + '</a>'; }
                else if (f) cur = cur.slice(0, f.start);
                continue;
            }
            if (inCode()) { depth[depth.length - 1].code += ch; continue; }
            if (ch === '\r') { closeTable(); emitPara(take()); }
            else if (ch === '\x07') { if (!items) items = []; items.push(take()); }
            else if (ch === '\x0B') cur += '<br>';
            else if (ch === '\x0C') { closeTable(); if (cur) emitPara(take()); html += '<div class="lne-pagebreak" contenteditable="false"></div>'; }
            else if (ch === '\x1E') cur += '-';
            else if (ch === '\x09') cur += '&emsp;';
            else if (ch < ' ' || ch === '\x1F') continue;
            else cur += ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;
        }
        closeTable();
        if (cur.trim()) emitPara(cur);
        return html;
    }

    function rtfToHtml(src) {
        var out = '', i = 0, stack = [], st = { b: 0, i: 0, u: 0, skip: 0, uc: 1 }, open = '<p>', skipDest = /^(fonttbl|colortbl|stylesheet|info|pict|header|footer|footnote|generator|themedata|colorschememapping|latentstyles|datastore|listtable|listoverridetable|rsidtbl|xmlnstbl|fldinst)$/;
        function flush(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
        var toks = 0, pending = '', cur = { b: 0, i: 0, u: 0 };
        function emit(t) {
            if (st.skip) return; var s = flush(t); if (!s) return;
            if (st.b) s = '<strong>' + s + '</strong>'; if (st.i) s = '<em>' + s + '</em>'; if (st.u) s = '<u>' + s + '</u>';
            out += s;
        }
        var cp = new TextDecoder('windows-1252');
        while (i < src.length && toks++ < 5e6) {
            var c = src[i];
            if (c === '{') { stack.push(Object.assign({}, st)); i++; }
            else if (c === '}') { st = stack.pop() || st; i++; }
            else if (c === '\\') {
                i++; var d = src[i];
                if (d === '\\' || d === '{' || d === '}') { emit(d); i++; }
                else if (d === '\'') { var hx = parseInt(src.substr(i + 1, 2), 16); emit(cp.decode(new Uint8Array([hx]))); i += 3; }
                else if (d === '*') { st.skip = 1; i++; }
                else if (d === '~') { emit('\u00a0'); i++; } else if (d === '-' || d === '_') { i++; }
                else if (/[a-zA-Z]/.test(d)) {
                    var m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(src.substr(i, 40)); var w2 = m[1], arg = m[2] != null ? parseInt(m[2], 10) : null; i += m[0].length;
                    if (skipDest.test(w2)) st.skip = 1;
                    else if (w2 === 'par' || w2 === 'sect') { if (!st.skip) out += '</p><p>'; }
                    else if (w2 === 'line') { if (!st.skip) out += '<br>'; }
                    else if (w2 === 'tab') emit('\u2003');
                    else if (w2 === 'b') st.b = arg === 0 ? 0 : 1; else if (w2 === 'i') st.i = arg === 0 ? 0 : 1; else if (w2 === 'ul') st.u = 1; else if (w2 === 'ulnone') st.u = 0;
                    else if (w2 === 'pard') { st.b = 0; st.i = 0; st.u = 0; }
                    else if (w2 === 'uc') st.uc = arg; else if (w2 === 'u') { var cc = arg < 0 ? arg + 65536 : arg; emit(String.fromCharCode(cc)); if (src[i] === '\\' && src[i + 1] === '\'') i += 4; else if (src[i] && src[i] !== '\\' && src[i] !== '{' && src[i] !== '}') i++; }
                } else i++;
            } else if (c === '\r' || c === '\n') i++;
            else { var j = i; while (j < src.length && '{}\\\r\n'.indexOf(src[j]) < 0) j++; emit(src.slice(i, j)); i = j; }
        }
        return out ? '<p>' + out + '</p>' : '';
    }

    async function importDoc(buf) {
        var u8 = new Uint8Array(buf);
        // «.doc», который на самом деле другой формат
        if (u8[0] === 0x50 && u8[1] === 0x4B) return importDocx(buf);
        var head = new TextDecoder('utf-8').decode(u8.subarray(0, 1024)).replace(/^\uFEFF/, '');
        if (/^\s*\{\\rtf/i.test(head)) return { html: sanitize(rtfToHtml(new TextDecoder('windows-1252').decode(u8))), meta: defaultMeta() };
        if (/^MIME-Version:/i.test(head) || /<html[\s>]/i.test(head) || /^\s*<!doctype html/i.test(head)) return importMhtmlOrHtml(new TextDecoder('utf-8').decode(u8));
        var cfb = parseCFB(buf), wd = cfb.stream('WordDocument');
        if (!wd) throw new Error('WordDocument stream not found — not a Word 97–2003 file');
        var dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
        if (dv.getUint16(0, true) !== 0xA5EC) throw new Error('Unsupported Word file signature');
        var flags = dv.getUint16(0x0A, true);
        if (flags & 0x0100) throw new Error('The document is password-protected (encrypted)');
        var tbl = cfb.stream((flags & 0x0200) ? '1Table' : '0Table');
        if (!tbl) throw new Error('Table stream not found');
        var html = docTextToHtml(decodeDocText(wd, tbl, flags));
        var meta = defaultMeta();
        return { html: sanitize(html || '<p><br></p>'), meta: meta, partial: true };
    }

    function importMhtmlOrHtml(text) {
        var html = text, images = {};
        if (/^MIME-Version:/i.test(text)) { // MHTML (в том числе наш собственный .doc)
            var bm = /boundary="?([^"\r\n;]+)"?/i.exec(text);
            if (bm) {
                var parts = text.split('--' + bm[1]);
                parts.forEach(function (part) {
                    var sp = part.search(/\r?\n\r?\n/); if (sp < 0) return;
                    var hd = part.slice(0, sp), bd = part.slice(sp).replace(/^\r?\n\r?\n/, '');
                    var loc = /Content-Location:\s*(\S+)/i.exec(hd), typ = /Content-Type:\s*([^;\r\n]+)/i.exec(hd), te = /Content-Transfer-Encoding:\s*(\S+)/i.exec(hd);
                    if (!typ) return;
                    if (/text\/html/i.test(typ[1])) {
                        html = (te && /quoted-printable/i.test(te[1])) ? decodeQP(bd) : bd;
                    } else if (/^image\//i.test(typ[1]) && loc && te && /base64/i.test(te[1])) {
                        images[loc[1].split('/').pop()] = 'data:' + typ[1].trim() + ';base64,' + bd.replace(/\s+/g, '').replace(/-+$/, '');
                    }
                });
            }
        }
        var doc = new DOMParser().parseFromString(html, 'text/html'), body = doc.body;
        doc.querySelectorAll('style,script,xml,meta,link,title,o\\:p').forEach(function (e) { e.remove(); });
        body.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || '', nm = s.split('/').pop(); if (images[nm]) im.setAttribute('src', images[nm]); else if (!/^data:/.test(s)) im.remove(); });
        return { html: sanitize(body.innerHTML), meta: defaultMeta() };
    }
    function decodeQP(s) {
        var bytes = [], t = s.replace(/=\r?\n/g, '');
        for (var i = 0; i < t.length; i++) {
            if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(t.substr(i + 1, 2))) { bytes.push(parseInt(t.substr(i + 1, 2), 16)); i += 2; }
            else { var cc = t.charCodeAt(i); if (cc < 128) bytes.push(cc); else Array.prototype.push.apply(bytes, enc.encode(t[i])); }
        }
        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    }

    async function importFile(file) {
        var buf = await file.arrayBuffer(), u8 = new Uint8Array(buf), name = (file.name || '').toLowerCase();
        var res;
        if (u8[0] === 0x50 && u8[1] === 0x4B) { res = await importDocx(buf); res.kind = 'docx'; }
        else if (u8[0] === 0xD0 && u8[1] === 0xCF) { res = await importDoc(buf); res.kind = 'doc'; }
        else if (/\.(doc|rtf|docx)$/.test(name)) { res = await importDoc(buf); res.kind = 'doc'; }
        else throw new Error(tr('docxUnsupportedFile', 'Unsupported file. Choose a .docx or .doc file.'));
        if (!res.meta.title) res.meta.title = (file.name || '').replace(/\.[^.]+$/, '');
        return res;
    }

    w.LNDocx = {
        exportDocx: exportDocx, exportDoc: exportDoc, importDocx: importDocx, importDoc: importDoc, importFile: importFile,
        defaultMeta: defaultMeta, PAGE_SIZES: PAGE_SIZES, MARGIN_PRESETS: MARGIN_PRESETS, pageDims: pageDims,
        _buildZip: buildZip, _readZip: readZip, _zipText: zipText, _parseCFB: parseCFB
    };
})(window);
