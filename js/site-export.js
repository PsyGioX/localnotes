/**
 * Static Site Export — turns the local workspace into a portable,
 * host-anywhere static site (index.html + app.js + style.css + notes.json)
 * packaged as a real .zip built entirely client-side.
 *
 * No ZIP library is added: like the Notion/Keep import in js/import-formats.js
 * (which reads zips via native DecompressionStream), this writes zips via the
 * native CompressionStream('deflate-raw') API plus a hand-rolled Local File
 * Header / Central Directory / EOCD writer — same zero-dependency approach,
 * mirrored for the write side.
 *
 * IMPORTANT PRIVACY NOTE (surfaced in the UI, not just here): notes in
 * IndexedDB are stored as plain HTML. App Lock is a UI gate, not content
 * encryption — it does not protect exported data. Only the AES-256-GCM
 * `.note` export pipeline in index.js actually encrypts bytes. This export
 * produces a PLAINTEXT static site; the dialog says so explicitly.
 *
 * SECURITY: note content is raw HTML (it's never guaranteed clean — it can
 * carry markup from copy/paste or from a Sync Nearby peer) and the
 * generated app.js renders it via innerHTML with no sanitizer of its own.
 * Every note's content is therefore run through the same DOMPurify.sanitize()
 * the main app uses before it's written into notes.json below, and the
 * generated index.html carries a script-src CSP as a second line of
 * defense — see generate() and siteIndexHTML().
 *
 * Exposes window.SiteExport = { open }
 */
(function () {
    'use strict';

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

    // ────────────────────────────────────────────────────────────────────
    // Minimal ZIP writer (store filenames flat, method = deflate)
    // ────────────────────────────────────────────────────────────────────
    var CRC_TABLE = (function () {
        var table = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        var crc = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) {
            crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function concatBytes(chunks) {
        var total = 0;
        chunks.forEach(function (c) { total += c.length; });
        var out = new Uint8Array(total);
        var offset = 0;
        chunks.forEach(function (c) { out.set(c, offset); offset += c.length; });
        return out;
    }

    async function deflateRaw(bytes) {
        if (typeof CompressionStream === 'undefined') {
            // Extremely old browser fallback: store uncompressed (method 0) is
            // handled by the caller when this throws — kept simple here.
            throw new Error('CompressionStream unsupported');
        }
        var cs = new CompressionStream('deflate-raw');
        var writer = cs.writable.getWriter();
        writer.write(bytes);
        writer.close();
        var reader = cs.readable.getReader();
        var chunks = [];
        while (true) {
            var res = await reader.read();
            if (res.done) break;
            chunks.push(res.value);
        }
        return concatBytes(chunks);
    }

    function dosDateTime(date) {
        var d = date || new Date();
        var dosTime = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() >> 1) & 0x1F);
        var dosDate = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0xF) << 5) | (d.getDate() & 0x1F);
        return { time: dosTime & 0xFFFF, date: dosDate & 0xFFFF };
    }

    function u16(dv, offset, val) { dv.setUint16(offset, val, true); }
    function u32(dv, offset, val) { dv.setUint32(offset, val, true); }

    // files: [{ name: 'index.html', data: Uint8Array }]
    async function buildZip(files) {
        var encoder = new TextEncoder();
        var localChunks = [];
        var centralChunks = [];
        var offset = 0;
        var dt = dosDateTime();

        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var nameBytes = encoder.encode(f.name);
            var crc = crc32(f.data);
            var compressed;
            try { compressed = await deflateRaw(f.data); }
            catch (e) { compressed = f.data; } // fallback: store uncompressed

            var method = compressed === f.data ? 0 : 8;

            var lh = new Uint8Array(30 + nameBytes.length);
            var ldv = new DataView(lh.buffer);
            u32(ldv, 0, 0x04034b50);
            u16(ldv, 4, 20);
            u16(ldv, 6, 0);
            u16(ldv, 8, method);
            u16(ldv, 10, dt.time);
            u16(ldv, 12, dt.date);
            u32(ldv, 14, crc);
            u32(ldv, 18, compressed.length);
            u32(ldv, 22, f.data.length);
            u16(ldv, 26, nameBytes.length);
            u16(ldv, 28, 0);
            lh.set(nameBytes, 30);

            localChunks.push(lh, compressed);

            var ch = new Uint8Array(46 + nameBytes.length);
            var cdv = new DataView(ch.buffer);
            u32(cdv, 0, 0x02014b50);
            u16(cdv, 4, 20);
            u16(cdv, 6, 20);
            u16(cdv, 8, 0);
            u16(cdv, 10, method);
            u16(cdv, 12, dt.time);
            u16(cdv, 14, dt.date);
            u32(cdv, 16, crc);
            u32(cdv, 20, compressed.length);
            u32(cdv, 24, f.data.length);
            u16(cdv, 28, nameBytes.length);
            u16(cdv, 30, 0);
            u16(cdv, 32, 0);
            u16(cdv, 34, 0);
            u16(cdv, 36, 0);
            u32(cdv, 38, 0);
            u32(cdv, 42, offset);
            ch.set(nameBytes, 46);
            centralChunks.push(ch);

            offset += lh.length + compressed.length;
        }

        var centralStart = offset;
        var central = concatBytes(centralChunks);
        var eocd = new Uint8Array(22);
        var edv = new DataView(eocd.buffer);
        u32(edv, 0, 0x06054b50);
        u16(edv, 4, 0);
        u16(edv, 6, 0);
        u16(edv, 8, files.length);
        u16(edv, 10, files.length);
        u32(edv, 12, central.length);
        u32(edv, 16, centralStart);
        u16(edv, 20, 0);

        return concatBytes(localChunks.concat([central, eocd]));
    }

    // ────────────────────────────────────────────────────────────────────
    // Site templates
    // ────────────────────────────────────────────────────────────────────
    function siteCSS() {
        return ':root{--bg:#121212;--panel:#1a1a1a;--border:#272727;--text:#e0e0e0;--muted:#999;--accent:#aefc6e;}\n' +
            '*{box-sizing:border-box;}\n' +
            'body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);}\n' +
            '.ln-wrap{max-width:920px;margin:0 auto;padding:24px 16px 60px;}\n' +
            '.ln-hd{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;}\n' +
            '.ln-hd h1{font-size:20px;margin:0;flex:1;}\n' +
            '.ln-search{flex:1;min-width:180px;background:var(--panel);border:1px solid var(--border);border-radius:8px;' +
            'padding:9px 12px;color:var(--text);font-size:14px;outline:0;}\n' +
            '.ln-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}\n' +
            '.ln-card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;' +
            'transition:border-color .15s;overflow:hidden;}\n' +
            '.ln-card:hover{border-color:var(--accent);}\n' +
            '.ln-card h3{margin:0 0 6px;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n' +
            '.ln-card p{margin:0;font-size:12.5px;color:var(--muted);max-height:54px;overflow:hidden;}\n' +
            '.ln-card .ln-tags{margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;}\n' +
            '.ln-tag{font-size:10.5px;padding:2px 7px;border-radius:20px;background:rgba(174,252,110,.15);color:var(--accent);}\n' +
            '.ln-note-view{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:22px;}\n' +
            '.ln-note-view h2{margin-top:0;}\n' +
            '.ln-back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none;font-size:13px;margin-bottom:14px;cursor:pointer;}\n' +
            '.ln-back:hover{color:var(--accent);}\n' +
            '.ln-wikilink{color:var(--accent);cursor:pointer;text-decoration:underline;}\n' +
            '.ln-wikilink-broken{color:var(--muted);text-decoration:line-through;}\n' +
            '.ln-empty{color:var(--muted);text-align:center;padding:40px 0;}\n' +
            '.ln-footer{margin-top:40px;text-align:center;font-size:11.5px;color:var(--muted);}\n' +
            '.ln-footer a{color:var(--muted);text-decoration:underline;}\n' +
            '.ln-footer a:hover{color:var(--accent);}\n' +
            'img{max-width:100%;border-radius:6px;}\n' +
            'table{border-collapse:collapse;} td,th{border:1px solid var(--border);padding:6px 10px;}\n' +
            '@media (prefers-color-scheme:light){:root{--bg:#f4f4f4;--panel:#fff;--border:#e2e2e2;--text:#222;--muted:#777;}}\n';
    }

    function siteAppJS() {
        // Transliteration map mirrors js/index.js's own transliterateAdvanced()
        // verbatim (same final values once JS resolves that object literal's
        // duplicate keys) so search behaves identically across every language
        // the app supports: Russian, Ukrainian, Bulgarian, Serbian,
        // Macedonian, Bosnian, Croatian, Slovak, Czech, Polish, Slovenian
        // (plus German, for shared diacritics like ä/ö/ü/ß).
        return "(function(){\n" +
            "var TR={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'a','ы':'y','ь':'','э':'e','ю':'yu','я':'ya','і':'i','ї':'yi','є':'ye','ґ':'g','ђ':'dj','љ':'lj','њ':'nj','ћ':'c','џ':'dz','ѓ':'gj','ѕ':'dz','ѐ':'e','ј':'j','ќ':'kj','ѣ':'e','ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z','á':'a','č':'c','ď':'d','é':'e','ě':'e','í':'i','ň':'n','ř':'r','š':'s','ť':'t','ú':'u','ů':'u','ý':'y','ž':'z','đ':'d','ä':'ae','ö':'oe','ü':'ue','ß':'ss'};\n" +
            "function tr(s){return String(s==null?'':s).toLowerCase().split('').map(function(c){return TR[c]!==undefined?TR[c]:c;}).join('');}\n" +
            "var DATA=[]; var byId={};\n" +
            "function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];});}\n" +
            "function plain(html){return String(html||'').replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim();}\n" +
            // Text-match logic (phrase / all-words / word-prefix / fuzzy)
            // mirrors js/index.js's own textMatchesQuery(), so a search that
            // finds a note in the app finds it here too — just run against
            // transliterated text on both sides so e.g. typing "moloko" (or
            // "mleko", "mlijeko"...) still matches text written in any of
            // the supported Cyrillic or accented-Latin scripts.
            "function textMatches(hay,hayTr,q,qTr,words,wordsTr){\n" +
            "if(!q)return true;\n" +
            "if(hay.indexOf(q)!==-1||hayTr.indexOf(qTr)!==-1)return true;\n" +
            "if(words.length>1){var all=true;for(var i=0;i<words.length;i++){if(hay.indexOf(words[i])===-1&&hayTr.indexOf(wordsTr[i])===-1){all=false;break;}}if(all)return true;}\n" +
            "var hw=hay.split(/\\s+/),hwTr=hayTr.split(/\\s+/);\n" +
            "for(var i=0;i<hw.length;i++){if(hw[i].indexOf(q)===0)return true;}\n" +
            "for(var i=0;i<hwTr.length;i++){if(hwTr[i].indexOf(qTr)===0)return true;}\n" +
            "if(q.length>2){var fz=q.slice(0,-1),fzTr=tr(fz);if(hay.indexOf(fz)!==-1||hayTr.indexOf(fzTr)!==-1)return true;}\n" +
            "return false;}\n" +
            "function card(n){var snippet=plain(n.content).slice(0,120);var tags=(n.tagNames||[]).map(function(tag){return '<span class=\"ln-tag\">'+esc(tag)+'</span>';}).join('');\n" +
            "return '<div class=\"ln-card\" data-id=\"'+esc(n.id)+'\"><h3>'+esc(n.title||'Untitled')+'</h3><p>'+esc(snippet)+'</p>'+(tags?'<div class=\"ln-tags\">'+tags+'</div>':'')+'</div>';}\n" +
            "function renderList(filter){var raw=(filter||'').trim().toLowerCase();var q=raw,qTr=tr(raw);var words=raw?raw.split(/\\s+/):[];var wordsTr=words.map(tr);\n" +
            "var items=DATA.filter(function(n){if(!raw)return true;\n" +
            "var hay=(n.title+' '+plain(n.content)+' '+(n.tagNames||[]).join(' ')).toLowerCase();\n" +
            "return textMatches(hay,tr(hay),q,qTr,words,wordsTr);});\n" +
            "var list=document.getElementById('ln-list');\n" +
            "list.innerHTML=items.length?items.map(card).join(''):'<div class=\"ln-empty\">No notes match.</div>';\n" +
            "Array.prototype.forEach.call(list.querySelectorAll('.ln-card'),function(el){el.addEventListener('click',function(){location.hash='#/note/'+el.getAttribute('data-id');});});}\n" +
            // The title shown above the note is extracted from the note's
            // own first heading (or, failing that, its first paragraph) —
            // see notesDB.extractTitle() in js/index.js. That source node is
            // still sitting at the top of n.content, so rendering both the
            // heading below AND the title above repeated it verbatim. Strip
            // whichever single node produced the title (matched the same
            // way extractTitle found it) before it's rendered again.
            "function stripTitleNode(html,title){\n" +
            "if(!title)return html;\n" +
            "var tmp=document.createElement('div');tmp.innerHTML=html;\n" +
            "var h=tmp.querySelector('h1,h2,h3,h4,h5,h6');\n" +
            "if(h&&h.textContent.trim()===title){h.remove();return tmp.innerHTML;}\n" +
            "var p=tmp.querySelector('p');\n" +
            "if(p){var ptxt=p.textContent.trim();var truncated=ptxt.length>50?ptxt.substring(0,50)+'...':ptxt;\n" +
            "if(truncated===title){p.remove();return tmp.innerHTML;}}\n" +
            "return html;}\n" +
            "function renderNote(id){var n=byId[id];var wrap=document.getElementById('ln-app');\n" +
            "if(!n){wrap.innerHTML='<div class=\"ln-empty\">Note not found.</div>';return;}\n" +
            "var body=stripTitleNode(n.content,n.title||'');\n" +
            // Only the OPENING tag of the wiki-link chip is rewritten (class +
            // data-goto instead of data-note-id); the icon/label markup nested
            // inside, and the chip's own closing </span>, are left completely
            // untouched — safer than trying to re-match a closing tag.
            "var html=body.replace(/<span class=\"lne-wikilink\"([^>]*)data-note-id=\"([^\"]+)\"([^>]*)>/g,function(m,pre,linkId,post){\n" +
            "return byId[linkId]?('<span class=\"ln-wikilink\" data-goto=\"'+linkId+'\"'+pre+post+'>'):('<span class=\"ln-wikilink-broken\"'+pre+post+'>');});\n" +
            "wrap.innerHTML='<div class=\"ln-wrap\"><a class=\"ln-back\" href=\"#/\">&larr; Back to all notes</a><div class=\"ln-note-view\"><h2>'+esc(n.title||'Untitled')+'</h2>'+html+'</div><div class=\"ln-footer\">Exported from <a href=\"https://localnotes-three.vercel.app/\" target=\"_blank\" rel=\"noopener\">Local Notes</a></div></div>';\n" +
            "Array.prototype.forEach.call(wrap.querySelectorAll('.ln-wikilink'),function(el){el.addEventListener('click',function(){location.hash='#/note/'+el.getAttribute('data-goto');});});}\n" +
            "function renderHome(){var wrap=document.getElementById('ln-app');\n" +
            "wrap.innerHTML='<div class=\"ln-wrap\"><div class=\"ln-hd\"><h1>My Notes</h1><input class=\"ln-search\" id=\"ln-search\" placeholder=\"Search notes\\u2026\"></div><div class=\"ln-list\" id=\"ln-list\"></div><div class=\"ln-footer\">Exported from <a href=\"https://localnotes-three.vercel.app/\" target=\"_blank\" rel=\"noopener\">Local Notes</a> \\u00b7 '+DATA.length+' notes</div></div>';\n" +
            "renderList('');\n" +
            "document.getElementById('ln-search').addEventListener('input',function(e){renderList(e.target.value);});}\n" +
            "function route(){var h=location.hash;var m=h.match(/^#\\/note\\/(.+)$/);if(m)renderNote(decodeURIComponent(m[1]));else renderHome();}\n" +
            "window.addEventListener('hashchange',route);\n" +
            "fetch('notes.json').then(function(r){return r.json();}).then(function(data){DATA=data;DATA.forEach(function(n){byId[n.id]=n;});route();});\n" +
            "})();\n";
    }

    function siteIndexHTML(siteTitle) {
        // CSP as a second line of defense on top of the DOMPurify pass in
        // generate(): even if some markup slips through sanitization, the
        // browser won't execute any <script> that isn't this site's own
        // app.js — no inline scripts, no third-party script origins.
        return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
            '<meta http-equiv="Content-Security-Policy" content="script-src \'self\'; object-src \'none\'; base-uri \'self\'">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<meta name="robots" content="noindex">' +
            '<title>' + escapeHtml(siteTitle) + '</title>' +
            '<link rel="stylesheet" href="style.css"></head>' +
            '<body><div id="ln-app"><div class="ln-wrap ln-empty">Loading\u2026</div></div>' +
            '<script src="app.js"></script></body></html>';
    }

    // ────────────────────────────────────────────────────────────────────
    // Dialog UI
    // ────────────────────────────────────────────────────────────────────
    var overlay = null;

    function injectStyles() {
        if (document.getElementById('lnse-style')) return;
        var css =
            '.lnse-ov{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;' +
                'background:rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .15s;}' +
            '.lnse-ov.lnse-open{opacity:1;pointer-events:auto;}' +
            '.lnse-box{width:min(480px,92vw);max-height:88vh;overflow:auto;background:var(--modal-bg,#1a1a1a);' +
                'border:1px solid var(--modal-border,#272727);border-radius:14px;padding:20px;color:var(--text-color,#e0e0e0);}' +
            '.lnse-box h3{margin:0 0 4px;font-size:16px;display:flex;align-items:center;gap:8px;}' +
            '.lnse-sub{font-size:12.5px;color:var(--text-secondary,#999);margin:0 0 16px;line-height:1.5;}' +
            '.lnse-warn{background:rgba(255,193,7,.1);border:1px solid rgba(255,193,7,.35);border-radius:8px;' +
                'padding:10px 12px;font-size:12px;color:#e0b93d;margin-bottom:16px;line-height:1.5;}' +
            '.lnse-row{margin-bottom:14px;}' +
            '.lnse-row label{display:block;font-size:12.5px;color:var(--text-secondary,#999);margin-bottom:6px;}' +
            '.lnse-select,.lnse-input{width:100%;background:var(--input-bg,#242424);border:1px solid var(--border-color,#333);' +
                'border-radius:8px;padding:8px 10px;color:var(--text-color,#e0e0e0);font-size:13px;}' +
            '.lnse-tags{display:flex;flex-wrap:wrap;gap:6px;}' +
            '.lnse-tagchk{display:flex;align-items:center;gap:5px;font-size:12px;background:var(--input-bg,#242424);' +
                'border:1px solid var(--border-color,#333);border-radius:20px;padding:4px 10px;cursor:pointer;}' +
            '.lnse-actions{display:flex;gap:10px;margin-top:6px;}' +
            '.lnse-btn{flex:1;padding:10px;border-radius:8px;border:0;font-size:13.5px;font-weight:600;cursor:pointer;}' +
            '.lnse-btn.primary{background:#aefc6e;color:#0c0c0c;}' +
            '.lnse-btn.secondary{background:transparent;border:1px solid var(--border-color,#333);color:var(--text-color,#e0e0e0);}' +
            '.lnse-status{font-size:12px;color:var(--text-secondary,#999);margin-top:10px;text-align:center;min-height:16px;}' +
            '.lnse-box input[type="checkbox"]{appearance:none;-webkit-appearance:none;width:16px;height:16px;' +
                'min-width:16px;border:2px solid rgba(174,252,110,.55);border-radius:4px;background:transparent;' +
                'cursor:pointer;position:relative;flex-shrink:0;vertical-align:middle;transition:background .15s,border-color .15s;margin:0 4px 0 0;}' +
            '.lnse-box input[type="checkbox"]:checked{background:#aefc6e;border-color:#aefc6e;}' +
            '.lnse-box input[type="checkbox"]:checked::after{content:"";position:absolute;top:1px;left:4px;' +
                'width:5px;height:8px;border:2px solid #000;border-top:none;border-left:none;transform:rotate(45deg);}' +
            '.lnse-box input[type="checkbox"]:hover{border-color:#aefc6e;box-shadow:0 0 0 3px rgba(174,252,110,.15);}' +
            '[data-theme="light"] .lnse-box input[type="checkbox"]{border-color:rgba(40,167,69,.5);}' +
            '[data-theme="light"] .lnse-box input[type="checkbox"]:checked{background:#28a745;border-color:#28a745;}' +
            '[data-theme="light"] .lnse-box input[type="checkbox"]:checked::after{border-color:#fff;}';
        var style = document.createElement('style');
        style.id = 'lnse-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    async function getAllTags() {
        try {
            if (window.TagsCalendar && typeof window.TagsCalendar.getTags === 'function') {
                var tags = window.TagsCalendar.getTags();
                return (tags && tags.then) ? await tags : (tags || []);
            }
        } catch (e) { /* ignore */ }
        return [];
    }

    function buildDOM(tags) {
        if (overlay) overlay.remove();
        injectStyles();
        overlay = document.createElement('div');
        overlay.className = 'lnse-ov';

        var tagsHtml = tags.map(function (tag) {
            return '<label class="lnse-tagchk"><input type="checkbox" value="' + escapeHtml(tag.id) + '"> ' + escapeHtml(tag.name) + '</label>';
        }).join('');

        overlay.innerHTML =
            '<div class="lnse-box">' +
                '<h3><i class="bi bi-globe2"></i>' + escapeHtml(t('seTitle', 'Publish as static site')) + '</h3>' +
                '<p class="lnse-sub">' + escapeHtml(t('seSub', 'Package your notes into a self-contained website (HTML + CSS + JS, with search) that you can host anywhere — GitHub Pages, Vercel, Netlify, or just open locally. No account, no server.')) + '</p>' +
                '<div class="lnse-warn"><i class="bi bi-exclamation-triangle"></i> ' + escapeHtml(t('seWarn', 'This produces PLAIN, unencrypted HTML files. App Lock only guards the app UI — it does not encrypt note content in storage. Exclude anything sensitive below before sharing the result.')) + '</div>' +
                '<div class="lnse-row"><label>' + escapeHtml(t('seScope', 'Which notes')) + '</label>' +
                    '<select class="lnse-select" id="lnseScope">' +
                        '<option value="workspace">' + escapeHtml(t('seScopeWorkspace', 'Current workspace only')) + '</option>' +
                        '<option value="all">' + escapeHtml(t('seScopeAll', 'All workspaces')) + '</option>' +
                    '</select>' +
                '</div>' +
                (tags.length ? '<div class="lnse-row"><label>' + escapeHtml(t('seExcludeTags', 'Exclude notes tagged')) + '</label><div class="lnse-tags" id="lnseTags">' + tagsHtml + '</div></div>' : '') +
                '<div class="lnse-row"><label><input type="checkbox" id="lnsePinned"> ' + escapeHtml(t('seOnlyPinned', 'Only export pinned notes')) + '</label></div>' +
                '<div class="lnse-actions">' +
                    '<button type="button" class="lnse-btn secondary" id="lnseCancel">' + escapeHtml(t('cancel', 'Cancel')) + '</button>' +
                    '<button type="button" class="lnse-btn primary" id="lnseGo">' + escapeHtml(t('seGenerate', 'Generate & download')) + '</button>' +
                '</div>' +
                '<div class="lnse-status" id="lnseStatus"></div>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        overlay.querySelector('#lnseCancel').addEventListener('click', close);
        overlay.querySelector('#lnseGo').addEventListener('click', function () { generate(tags); });
    }

    function close() {
        if (overlay) overlay.classList.remove('lnse-open');
        setTimeout(function () { if (overlay) { overlay.remove(); overlay = null; } }, 200);
    }

    function currentWorkspaceNotes(all, scopeAll) {
        if (scopeAll) return all;
        try {
            if (typeof workspacesManager !== 'undefined' && workspacesManager && workspacesManager.currentWorkspace) {
                return workspacesManager.filterNotesByWorkspace(all);
            }
        } catch (e) { /* workspaces module not present */ }
        return all;
    }

    async function generate(tags) {
        var statusEl = overlay.querySelector('#lnseStatus');
        var goBtn = overlay.querySelector('#lnseGo');
        goBtn.disabled = true;
        statusEl.textContent = t('seWorking', 'Gathering notes\u2026');
        try {
            if (!window.notesDB || typeof window.notesDB.getAllNotes !== 'function') throw new Error('notesDB unavailable');
            // Hard dependency, same stance as index.js's own DOMPurify check:
            // abort rather than ship an export that renders note content
            // unsanitized (see SECURITY note at the top of this file).
            if (typeof window.DOMPurify === 'undefined' || typeof window.DOMPurify.sanitize !== 'function') {
                throw new Error('DOMPurify unavailable — aborting export to avoid producing an unsanitized site.');
            }
            var all = await window.notesDB.getAllNotes();
            var scopeAll = overlay.querySelector('#lnseScope').value === 'all';
            var onlyPinned = overlay.querySelector('#lnsePinned').checked;
            var excludedTags = Array.prototype.map.call(
                overlay.querySelectorAll('#lnseTags input:checked'), function (el) { return el.value; }
            );

            var notes = currentWorkspaceNotes(all, scopeAll);
            if (onlyPinned) notes = notes.filter(function (n) { return !!n.pinned; });
            if (excludedTags.length) {
                notes = notes.filter(function (n) {
                    var nTags = n.tags || [];
                    return !nTags.some(function (tid) { return excludedTags.indexOf(tid) !== -1; });
                });
            }
            if (!notes.length) { statusEl.textContent = t('seEmpty', 'No notes match these filters.'); goBtn.disabled = false; return; }

            var tagById = {};
            tags.forEach(function (tag) { tagById[tag.id] = tag.name; });

            // Same allow-list the main app renders notes with (index.js's
            // notePreview.innerHTML pass) — keeps checklists, images and
            // embeds looking right in the exported site while stripping
            // anything DOMPurify doesn't consider safe. data-note-id (used
            // by the wikilink chips app.js rewrites at view time, see
            // siteAppJS()) is a data-* attribute and passes through by
            // DOMPurify's default ALLOW_DATA_ATTR.
            var SANITIZE_CONFIG = {
                ADD_TAGS: ['iframe', 'video', 'source'],
                ADD_ATTR: ['data-checked', 'data-cl-color', 'data-cl-priority', 'data-cl-tag', 'value', 'checked', 'type', 'placeholder', 'autocomplete', 'spellcheck',
                           'allowfullscreen', 'frameborder', 'scrolling', 'allow', 'src', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop',
                           'target', 'rel']
            };

            var exportRecords = notes.map(function (n) {
                return {
                    id: n.id,
                    title: n.title || '',
                    content: window.DOMPurify.sanitize(n.content || '', SANITIZE_CONFIG),
                    tagNames: (n.tags || []).map(function (tid) { return tagById[tid]; }).filter(Boolean),
                    pinned: !!n.pinned,
                    dueDate: n.dueDate || null,
                    creationTime: n.creationTime || null,
                    lastModified: n.lastModified || null
                };
            });

            statusEl.textContent = t('seBuilding', 'Building site files\u2026');
            var encoder = new TextEncoder();
            var files = [
                { name: 'index.html', data: encoder.encode(siteIndexHTML(t('seSiteTitle', 'My Notes'))) },
                { name: 'style.css', data: encoder.encode(siteCSS()) },
                { name: 'app.js', data: encoder.encode(siteAppJS()) },
                { name: 'notes.json', data: encoder.encode(JSON.stringify(exportRecords)) }
            ];

            statusEl.textContent = t('seZipping', 'Packaging zip\u2026');
            var zipBytes = await buildZip(files);

            var blob = new Blob([zipBytes], { type: 'application/zip' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            var stamp = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = 'localnotes-site-' + stamp + '.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

            statusEl.textContent = t('seDone', 'Done — {n} notes exported.').replace('{n}', exportRecords.length);
            goBtn.disabled = false;
        } catch (err) {
            console.error('Site export failed:', err);
            statusEl.textContent = t('seError', 'Export failed — see console for details.');
            goBtn.disabled = false;
        }
    }

    async function open() {
        var tags = await getAllTags();
        buildDOM(tags);
        requestAnimationFrame(function () { overlay.classList.add('lnse-open'); });
    }

    // ── toolbar button ──────────────────────────────────────────────────
    // Deliberately no class/custom styling here: css/action-bar.css already
    // restyles this button (by #siteExportBtn) into the same segmented
    // control as #toggleTaskBoardButton/#appLockBtn — that stylesheet's own
    // comment says as much ("Graph View / Sync Nearby / Static Site Export
    // join this same segmented control ... rather than keeping their own
    // pill-button look"). Adding the old pill-button class back on top of
    // that left this button visibly mismatched (different text color,
    // font-weight, padding) from its neighbors, since action-bar.css only
    // overrides what it explicitly targets.
    function mountToolbarButton() {
        if (document.getElementById('siteExportBtn')) return;
        var container = document.querySelector('.btn_view_div');
        if (!container) return;
        injectStyles();
        var btn = document.createElement('button');
        btn.id = 'siteExportBtn';
        btn.type = 'button';
        btn.title = t('seTitle', 'Publish as static site');
        btn.innerHTML = '<i class="bi bi-globe2"></i> ' + escapeHtml(t('seToolbarLabel', 'Publish'));
        btn.addEventListener('click', function () { open(); });
        var lockGroup = document.getElementById('appLockBtnGroup');
        if (lockGroup && lockGroup.parentNode === container) container.insertBefore(btn, lockGroup);
        else container.appendChild(btn);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountToolbarButton);
    } else {
        mountToolbarButton();
    }

    window.SiteExport = { open: open };
})();
