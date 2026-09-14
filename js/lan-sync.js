/**
 * LAN Sync — device-to-device note sync. Fully serverless: two browsers
 * connect directly to each other (RTCPeerConnection + a DataChannel), and
 * the one-time handshake needed to set that up travels between the two
 * devices by whatever out-of-band channel the person picks — read out
 * loud, copied through any messaging app, or (new in this version) shown
 * as a QR code one device displays and the other scans with its camera.
 *
 * WHY QR CODES, WHY HAND-ROLLED: a browser tab can't reach out to a
 * generic QR library over a CDN under this app's Content-Security-Policy,
 * and pulling in a bundled third-party dependency for one small feature
 * didn't seem worth it — so js/qrcode.js is a small, deliberately narrow
 * QR encoder (byte mode, versions 1–9, one fixed mask — see its own
 * header comment for the reasoning) written for this app. Decoding uses
 * the browser's own `BarcodeDetector` API where available; there's no
 * hand-written decoder.
 *
 * IMPORTANT — read this before relying on the QR path: a hand-written QR
 * encoder is exactly the kind of thing that's easy to get subtly wrong
 * and hard to verify without an actual phone camera to test against,
 * which wasn't available while writing it. That's why the plain-text
 * code — the exact same data, just as text you copy — is *always* shown
 * alongside the QR code, never hidden behind it. If a QR code doesn't
 * scan, or scans into something that doesn't connect, copy-pasting the
 * text code is the tested, guaranteed-to-work path underneath it.
 *
 * To keep the QR code itself small enough to actually be version 1–9
 * (see qrcode.js's capacity limits — roughly 230 bytes at most), the
 * *QR* payload is a compact binary encoding of just the fields needed to
 * rebuild a working SDP (ICE ufrag/password, DTLS fingerprint, a couple
 * of IPv4 candidates) — not the full SDP text, which is often 1-2KB once
 * a browser fills in every attribute. The *text* code, by contrast,
 * always carries the complete, real, browser-generated SDP verbatim (the
 * same thing the very first version of this feature used) — so even if
 * the compact-payload reconstruction has a bug, the text path is
 * unaffected and independently correct.
 *
 * Sync protocol (application messages, JSON, then encrypted) — unchanged:
 *   manifest { notes: [{id, lastModified}] }
 *   request  { ids: [...] }
 *   notes    { items: [...fullNoteObjects], last: bool }
 *   complete {}
 *
 * Conflict rule: last-write-wins by lastModified.
 *
 * Exposes window.LanSync = { open }
 */
(function () {
    'use strict';

    var ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
    var ICE_GATHER_TIMEOUT_MS = 4000;
    var CHUNK_SIZE = 15;                       // max notes per 'notes' message
    var NOTES_BATCH_MAX_BYTES = 200 * 1024;    // also cap batches by estimated byte size

    var overlay = null, logEl = null;
    var state = null; // active sync-engine state, see createSyncEngine()

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

    function log(msg) {
        if (!logEl) return;
        var line = document.createElement('div');
        line.textContent = msg;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    }

    // ── incoming note validation ───────────────────────────────────────────
    // Not an XSS concern (note content is sanitized at render time either
    // way, same as everywhere else in the app) — this is just a sanity gate
    // on structure/size so a buggy or hostile peer can't bloat the local DB
    // or crash saveNote() with garbage-shaped data.
    var MAX_NOTE_CONTENT_LENGTH = 5 * 1024 * 1024; // 5MB of HTML per note
    var MAX_TITLE_LENGTH = 2000;
    var MAX_TAGS = 200;
    var MAX_TAG_LENGTH = 200;

    function isValidIncomingNote(n) {
        if (!n || typeof n !== 'object') return false;
        if (typeof n.id !== 'string' || !n.id || n.id.length > 200) return false;
        if (typeof n.content !== 'string' || n.content.length > MAX_NOTE_CONTENT_LENGTH) return false;
        if (n.title != null && (typeof n.title !== 'string' || n.title.length > MAX_TITLE_LENGTH)) return false;
        if (n.lastModified != null && (typeof n.lastModified !== 'number' || !isFinite(n.lastModified))) return false;
        if (n.creationTime != null && (typeof n.creationTime !== 'number' || !isFinite(n.creationTime))) return false;
        if (n.tags != null) {
            if (!Array.isArray(n.tags) || n.tags.length > MAX_TAGS) return false;
            for (var i = 0; i < n.tags.length; i++) {
                if (typeof n.tags[i] !== 'string' || n.tags[i].length > MAX_TAG_LENGTH) return false;
            }
        }
        if (n.pinned != null && typeof n.pinned !== 'boolean') return false;
        if (n.dueDate != null && typeof n.dueDate !== 'string') return false;
        if (n.color != null && typeof n.color !== 'string') return false;
        if (n.taskStatus != null && typeof n.taskStatus !== 'string') return false;
        if (n.taskPriority != null && typeof n.taskPriority !== 'string') return false;
        return true;
    }

    function randomHex(nBytes) {
        var bytes = new Uint8Array(nBytes);
        crypto.getRandomValues(bytes);
        return Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    // Loop-based, not String.fromCharCode.apply(null, bytes) — spreading a
    // large typed array as call arguments risks blowing the stack.
    function bytesToBase64(bytes) {
        var b = '';
        for (var i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
        return btoa(b);
    }
    function base64ToBytes(b64) {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    // ── styles ──────────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('lnls-style')) return;
        var css =
            '.lnls-ov{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;' +
                'background:rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .15s;}' +
            '.lnls-ov.lnls-open{opacity:1;pointer-events:auto;}' +
            '.lnls-box{width:min(520px,94vw);max-height:90vh;overflow:auto;background:var(--modal-bg,#1a1a1a);' +
                'border:1px solid var(--modal-border,#272727);border-radius:14px;padding:20px;color:var(--text-color,#e0e0e0);' +
                'position:relative;}' +
            '.lnls-box h3{margin:0 0 4px;font-size:16px;display:flex;align-items:center;gap:8px;}' +
            '.lnls-sub{font-size:12.5px;color:var(--text-secondary,#999);margin:0 0 16px;line-height:1.5;}' +
            '.lnls-choice{display:flex;gap:10px;margin-bottom:6px;}' +
            '.lnls-choicebtn{flex:1;padding:16px 10px;border-radius:10px;border:1px solid var(--border-color,#333);' +
                'background:var(--input-bg,#242424);color:var(--text-color,#e0e0e0);cursor:pointer;text-align:center;font-size:13px;}' +
            '.lnls-choicebtn i{display:block;font-size:22px;margin-bottom:6px;color:#aefc6e;}' +
            '.lnls-choicebtn:hover{border-color:#aefc6e;}' +
            '.lnls-row{margin:14px 0;}' +
            '.lnls-row label{display:block;font-size:12.5px;color:var(--text-secondary,#999);margin-bottom:6px;}' +
            '.lnls-code{width:100%;min-height:90px;background:var(--input-bg,#242424);border:1px solid var(--border-color,#333);' +
                'border-radius:8px;padding:8px 10px;color:var(--text-color,#e0e0e0);font-size:11.5px;font-family:monospace;' +
                'resize:vertical;word-break:break-all;box-sizing:border-box;}' +
            '.lnls-actions{display:flex;gap:10px;margin-top:6px;}' +
            '.lnls-btn{flex:1;padding:10px;border-radius:8px;border:0;font-size:13.5px;font-weight:600;cursor:pointer;}' +
            '.lnls-btn.primary{background:#aefc6e;color:#0c0c0c;}' +
            '.lnls-btn.secondary{background:transparent;border:1px solid var(--border-color,#333);color:var(--text-color,#e0e0e0);}' +
            '.lnls-btn:disabled{opacity:.5;cursor:default;}' +
            '.lnls-log{margin-top:14px;background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;max-height:130px;' +
                'overflow-y:auto;font-size:11.5px;color:var(--text-secondary,#999);font-family:monospace;line-height:1.6;}' +
            '.lnls-back{font-size:12px;color:var(--text-secondary,#999);cursor:pointer;margin-bottom:12px;display:inline-block;}' +
            '.lnls-back:hover{color:#aefc6e;}' +
            '.lnls-link{font-size:12px;color:var(--text-secondary,#999);cursor:pointer;text-decoration:underline;}' +
            '.lnls-link:hover{color:#aefc6e;}' +
            '.lnls-warn{background:rgba(255,193,7,.1);border:1px solid rgba(255,193,7,.35);border-radius:8px;' +
                'padding:10px 12px;font-size:12px;color:#e0b93d;margin-bottom:6px;line-height:1.5;}' +
            '.lnls-close{position:absolute;top:14px;right:16px;background:transparent;border:0;color:var(--text-secondary,#999);' +
                'font-size:20px;cursor:pointer;}' +
            '.lnls-qr-wrap{display:flex;justify-content:center;margin:10px 0;}' +
            '.lnls-qr-wrap canvas{border-radius:8px;background:#fff;padding:10px;}' +
            '.lnls-tabs{display:flex;gap:6px;margin-bottom:10px;}' +
            '.lnls-tab{flex:1;padding:7px;border-radius:7px;border:1px solid var(--border-color,#333);background:transparent;' +
                'color:var(--text-secondary,#999);font-size:12px;cursor:pointer;}' +
            '.lnls-tab.active{background:var(--input-bg,#242424);color:var(--text-color,#e0e0e0);border-color:#aefc6e;}' +
            '.lnls-video-wrap{position:relative;border-radius:10px;overflow:hidden;background:#000;margin:10px 0;}' +
            '.lnls-video-wrap video{width:100%;display:block;max-height:280px;object-fit:cover;}' +
            '.lnls-scan-hint{text-align:center;font-size:11.5px;color:var(--text-secondary,#999);margin-top:4px;}';

        var style = document.createElement('style');
        style.id = 'lnls-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ── shell / chrome shared by every view ─────────────────────────────────
    function renderShell(title, backFn, withLog) {
        overlay.querySelector('.lnls-box').innerHTML =
            '<button type="button" class="lnls-close" id="lnlsClose">&times;</button>' +
            (backFn ? '<span class="lnls-back" id="lnlsBack"><i class="bi bi-arrow-left"></i> ' + escapeHtml(t('back', 'Back')) + '</span><br>' : '') +
            '<h3><i class="bi bi-arrow-left-right"></i>' + escapeHtml(title) + '</h3>' +
            '<div id="lnlsBody"></div>' +
            (withLog === false ? '' : '<div class="lnls-log" id="lnlsLog"></div>');
        overlay.querySelector('#lnlsClose').addEventListener('click', close);
        if (backFn) overlay.querySelector('#lnlsBack').addEventListener('click', backFn);
        logEl = overlay.querySelector('#lnlsLog') || null;
    }

    function body() { return overlay.querySelector('#lnlsBody'); }

    // =========================================================================
    // CRYPTO — a random secret (generated by whichever device starts the
    // session, carried inside the pairing code itself) stretched via HKDF
    // into an AES-256-GCM key. No third party is ever involved in moving
    // the pairing code from one device to the other — it's read, copied,
    // or optically scanned directly between the two — so there's no
    // "server could swap the keys" threat model to defend against the way
    // there would be if a rendezvous server were relaying the handshake.
    // =========================================================================

    var sessionSecret = null;
    var sessionKeyPromise = null;
    function getSessionKey() {
        if (sessionKeyPromise) return sessionKeyPromise;
        sessionKeyPromise = (async function () {
            var ikm = new TextEncoder().encode(sessionSecret);
            var baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
            return crypto.subtle.deriveKey(
                { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('localnotes-sync-v1') },
                baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
            );
        })();
        return sessionKeyPromise;
    }

    async function encryptMessage(key, obj) {
        var plain = new TextEncoder().encode(JSON.stringify(obj));
        var iv = crypto.getRandomValues(new Uint8Array(12));
        var cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
        var out = new Uint8Array(12 + cipherBuf.byteLength);
        out.set(iv, 0);
        out.set(new Uint8Array(cipherBuf), 12);
        return bytesToBase64(out);
    }
    async function decryptMessage(key, raw) {
        var bytes = base64ToBytes(raw);
        var iv = bytes.slice(0, 12);
        var cipher = bytes.slice(12);
        var plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cipher);
        return JSON.parse(new TextDecoder().decode(plainBuf));
    }

    // =========================================================================
    // SYNC ENGINE — runs over the RTCDataChannel once it's open.
    // =========================================================================

    function createSyncEngine(channel, opts) {
        opts = opts || {};
        var st = {
            localAll: null, localManifest: null,
            sentManifest: false, receivedManifest: false,
            sentRequest: false, receivedRequest: false,
            sentNotes: false, receivedNotes: false,
            sentComplete: false, receivedComplete: false,
            applied: 0, sent: 0
        };
        state = st;

        async function send(obj) {
            var key = await getSessionKey();
            channel.send(await encryptMessage(key, obj));
        }
        async function receive(raw) {
            var key = await getSessionKey();
            return decryptMessage(key, raw);
        }

        function batchByCountAndSize(items) {
            var batches = [];
            var current = [];
            var currentSize = 0;
            for (var i = 0; i < items.length; i++) {
                var approxSize = JSON.stringify(items[i]).length;
                if (current.length && (current.length >= CHUNK_SIZE || currentSize + approxSize > NOTES_BATCH_MAX_BYTES)) {
                    batches.push(current);
                    current = [];
                    currentSize = 0;
                }
                current.push(items[i]);
                currentSize += approxSize;
            }
            batches.push(current);
            return batches;
        }

        async function onOpen() {
            log(t('lsConnected', 'Connected! Comparing notes\u2026'));
            var all = await window.notesDB.getAllNotes();
            st.localAll = all;
            st.localManifest = all.map(function (n) { return { id: n.id, lastModified: n.lastModified || 0 }; });
            await send({ type: 'manifest', notes: st.localManifest });
            st.sentManifest = true;
        }

        async function onMessage(e) {
            var msg;
            try { msg = await receive(e.data); }
            catch (err) { log(t('lsDecryptFail', 'Could not read a message from the other device.')); return; }

            if (msg.type === 'manifest') {
                st.receivedManifest = true;
                var localById = {};
                st.localAll.forEach(function (n) { localById[n.id] = n; });
                var needed = msg.notes.filter(function (m) {
                    var local = localById[m.id];
                    return !local || (local.lastModified || 0) < (m.lastModified || 0);
                }).map(function (m) { return m.id; });
                log(t('lsRequesting', 'Requesting {n} notes from the other device.').replace('{n}', needed.length));
                await send({ type: 'request', ids: needed });
                st.sentRequest = true;
                maybeComplete();
            } else if (msg.type === 'request') {
                st.receivedRequest = true;
                var items = [];
                for (var i = 0; i < msg.ids.length; i++) {
                    var n = await window.notesDB.getNote(msg.ids[i]);
                    if (n) items.push(n);
                }
                var batches = batchByCountAndSize(items);
                for (var b = 0; b < batches.length; b++) {
                    await send({ type: 'notes', items: batches[b], last: b === batches.length - 1 });
                }
                st.sent = items.length;
                st.sentNotes = true;
                log(t('lsSent', 'Sent {n} notes.').replace('{n}', items.length));
                maybeComplete();
            } else if (msg.type === 'notes') {
                var rejected = 0;
                for (var j = 0; j < msg.items.length; j++) {
                    var incoming = msg.items[j];
                    if (!isValidIncomingNote(incoming)) { rejected++; continue; }
                    var existing = await window.notesDB.getNote(incoming.id);
                    if (!existing || (existing.lastModified || 0) < (incoming.lastModified || 0)) {
                        await window.notesDB.saveNote(incoming);
                        st.applied++;
                    }
                }
                if (rejected) log(t('lsRejected', 'Ignored {n} malformed note(s) from the other device.').replace('{n}', rejected));
                if (msg.last) {
                    st.receivedNotes = true;
                    log(t('lsApplied', 'Applied {n} notes from the other device.').replace('{n}', st.applied));
                    if (typeof window.loadNotes === 'function') window.loadNotes();
                    maybeComplete();
                }
            } else if (msg.type === 'complete') {
                st.receivedComplete = true;
                maybeComplete();
            }
        }

        async function maybeComplete() {
            if (st.sentNotes && st.receivedNotes && !st.sentComplete) {
                await send({ type: 'complete' });
                st.sentComplete = true;
            }
            if (st.sentComplete && st.receivedComplete) {
                log(t('lsDone', '\u2713 Sync complete — {sent} sent, {applied} received.')
                    .replace('{sent}', st.sent).replace('{applied}', st.applied));
                if (typeof opts.onComplete === 'function') opts.onComplete();
            }
        }

        channel.addEventListener('open', onOpen);
        channel.addEventListener('message', onMessage);
        channel.addEventListener('close', function () { log(t('lsChannelClosed', 'Connection closed.')); });
    }

    // =========================================================================
    // Compact QR payload — a minimal binary encoding of just what's needed
    // to rebuild a working SDP, so the QR code fits in a small (fast to
    // scan) version. See the file header for why this exists alongside,
    // never instead of, the full-SDP text code.
    // =========================================================================

    // Pull the fields we need out of a real, browser-generated SDP.
    //
    // Chromium-based browsers obfuscate "host" candidates behind a random
    // mDNS `.local` hostname by default (a privacy feature — it hides your
    // real LAN IP from the other peer until ICE actually connects), so a
    // candidate's address is NOT reliably a dotted-quad IPv4 literal. The
    // address is captured as a generic token here and carried as text, not
    // packed as 4 raw bytes, so both real IPs and mDNS hostnames survive
    // the trip — the receiving browser resolves an mDNS hostname via
    // multicast DNS the same way it would if it had negotiated it itself.
    function parseSdpEssentials(sdp) {
        var ufragMatch = /a=ice-ufrag:(\S+)/.exec(sdp);
        var pwdMatch = /a=ice-pwd:(\S+)/.exec(sdp);
        var fpMatch = /a=fingerprint:sha-256\s+([0-9A-Fa-f:]+)/.exec(sdp);
        if (!ufragMatch || !pwdMatch || !fpMatch) return null;
        var candidates = [];
        var re = /a=candidate:\S+ \d+ udp \d+ (\S+) (\d+) typ (host|srflx)/g;
        var m;
        while ((m = re.exec(sdp))) candidates.push({ type: m[3] === 'host' ? 0 : 1, addr: m[1], port: parseInt(m[2], 10) });
        if (!candidates.length) return null; // no usable candidates at all — QR path skipped, text still works
        // Prefer server-reflexive candidates first: they're always a short
        // real IP (never an mDNS hostname), which keeps the compact payload
        // smaller and leaves more headroom for whichever host candidate(s)
        // we can still fit.
        candidates.sort(function (a, b) { return b.type - a.type; }); // srflx(1) before host(0)
        return {
            ufrag: ufragMatch[1], pwd: pwdMatch[1],
            fingerprintHex: fpMatch[1].replace(/:/g, '').toUpperCase(),
            candidates: candidates
        };
    }

    // Pack as many of the (already size-preferred) candidates as fit under
    // a byte budget, rather than a fixed count — an mDNS hostname candidate
    // is ~40+ bytes where a plain IP is ~15, so a fixed "3 candidates" cap
    // could still blow the QR capacity while a fixed "1 candidate" cap
    // would needlessly throw away a second one that would've fit fine.
    var QR_CANDIDATE_BUDGET_BYTES = 90;

    function packCompact(tag, essentials, secretHex) {
        var ufragBytes = new TextEncoder().encode(essentials.ufrag);
        var pwdBytes = new TextEncoder().encode(essentials.pwd);
        var fpBytes = new Uint8Array(32);
        for (var i = 0; i < 32; i++) fpBytes[i] = parseInt(essentials.fingerprintHex.substr(i * 2, 2), 16);
        var secretBytes = secretHex ? new Uint8Array(secretHex.match(/../g).map(function (h) { return parseInt(h, 16); })) : new Uint8Array(0);

        var chosen = [];
        var candBudget = QR_CANDIDATE_BUDGET_BYTES;
        var candByteList = [];
        for (var i2 = 0; i2 < essentials.candidates.length; i2++) {
            var addrBytes = new TextEncoder().encode(essentials.candidates[i2].addr);
            var entryLen = 1 + 1 + addrBytes.length + 2; // type + addrLen + addr + port
            if (entryLen > candBudget) continue;
            chosen.push(essentials.candidates[i2]);
            candByteList.push(addrBytes);
            candBudget -= entryLen;
        }
        if (!chosen.length) return null; // every candidate's address was too long to fit at all

        var totalLen = 1 + 1 + secretBytes.length + 1 + ufragBytes.length + 1 + pwdBytes.length + 32 + 1;
        for (var j = 0; j < candByteList.length; j++) totalLen += 1 + 1 + candByteList[j].length + 2;

        var out = new Uint8Array(totalLen);
        var o = 0;
        out[o++] = tag;
        out[o++] = secretBytes.length;
        out.set(secretBytes, o); o += secretBytes.length;
        out[o++] = ufragBytes.length;
        out.set(ufragBytes, o); o += ufragBytes.length;
        out[o++] = pwdBytes.length;
        out.set(pwdBytes, o); o += pwdBytes.length;
        out.set(fpBytes, o); o += 32;
        out[o++] = chosen.length;
        for (var c = 0; c < chosen.length; c++) {
            out[o++] = chosen[c].type;
            out[o++] = candByteList[c].length;
            out.set(candByteList[c], o); o += candByteList[c].length;
            out[o++] = (chosen[c].port >> 8) & 0xFF;
            out[o++] = chosen[c].port & 0xFF;
        }
        return out;
    }

    function unpackCompact(bytes) {
        var o = 0;
        var tag = bytes[o++];
        var secretLen = bytes[o++];
        var secretHex = Array.prototype.map.call(bytes.slice(o, o + secretLen), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        o += secretLen;
        var ufragLen = bytes[o++];
        var ufrag = new TextDecoder().decode(bytes.slice(o, o + ufragLen)); o += ufragLen;
        var pwdLen = bytes[o++];
        var pwd = new TextDecoder().decode(bytes.slice(o, o + pwdLen)); o += pwdLen;
        var fpBytes = bytes.slice(o, o + 32); o += 32;
        var fingerprintHex = Array.prototype.map.call(fpBytes, function (b) { return b.toString(16).padStart(2, '0').toUpperCase(); }).join('');
        var candCount = bytes[o++];
        var candidates = [];
        for (var c = 0; c < candCount; c++) {
            var type = bytes[o++];
            var addrLen = bytes[o++];
            var addr = new TextDecoder().decode(bytes.slice(o, o + addrLen)); o += addrLen;
            var port = (bytes[o] << 8) | bytes[o + 1]; o += 2;
            candidates.push({ type: type === 0 ? 'host' : 'srflx', ip: addr, port: port });
        }
        return { tag: tag, secretHex: secretHex || null, ufrag: ufrag, pwd: pwd, fingerprintHex: fingerprintHex, candidates: candidates };
    }

    // Rebuild a minimal but valid data-channel-only SDP from compact fields.
    function synthesizeSdp(role, fields) {
        var setup = role === 'offer' ? 'actpass' : 'active';
        var fpColon = fields.fingerprintHex.match(/../g).join(':');
        var lines = [
            'v=0',
            'o=- 0 0 IN IP4 127.0.0.1',
            's=-',
            't=0 0',
            'a=group:BUNDLE 0',
            'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
            'c=IN IP4 0.0.0.0',
            'a=ice-ufrag:' + fields.ufrag,
            'a=ice-pwd:' + fields.pwd,
            'a=fingerprint:sha-256 ' + fpColon,
            'a=setup:' + setup,
            'a=mid:0',
            'a=sctp-port:5000',
            'a=max-message-size:262144'
        ];
        fields.candidates.forEach(function (c, i) {
            var priority = c.type === 'host' ? 2113937151 : 1677729535;
            lines.push('a=candidate:' + (i + 1) + ' 1 udp ' + priority + ' ' + c.ip + ' ' + c.port + ' typ ' + c.type);
        });
        lines.push('a=end-of-candidates');
        return lines.join('\r\n') + '\r\n';
    }

    // ── QR display + camera scan (best-effort — see file header) ───────────

    // BarcodeDetector hands decoded QR content back as a plain JS string,
    // and different browsers make different assumptions about how to turn
    // the QR's raw bytes into that string (UTF-8 is common, but not
    // guaranteed) — so arbitrary binary doesn't reliably round-trip through
    // it. Base64-encoding the compact payload first sidesteps that: the
    // result is pure ASCII, which every one of those charset assumptions
    // agrees on byte-for-byte, so it survives the trip intact either way.
    function renderQrCanvas(container, compactBytes) {
        try {
            var base64Text = bytesToBase64(compactBytes);
            var asciiBytes = new TextEncoder().encode(base64Text);
            var result = window.QrEncoder.encode(asciiBytes);
            var scale = 6, quiet = 4;
            var px = (result.size + quiet * 2) * scale;
            var canvas = document.createElement('canvas');
            canvas.width = px; canvas.height = px;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, px, px);
            ctx.fillStyle = '#000';
            for (var r = 0; r < result.size; r++) {
                for (var c = 0; c < result.size; c++) {
                    if (result.matrix[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
                }
            }
            container.innerHTML = '';
            container.appendChild(canvas);
            return true;
        } catch (e) {
            container.innerHTML = '';
            return false; // payload too big for this encoder, or a bug — caller falls back to text-only
        }
    }

    function barcodeDetectorSupported() {
        return typeof window.BarcodeDetector !== 'undefined';
    }

    var activeScanStream = null;
    function stopScan() {
        if (activeScanStream) {
            activeScanStream.getTracks().forEach(function (tr) { tr.stop(); });
            activeScanStream = null;
        }
    }

    async function startScan(videoEl, onDecoded, onError) {
        try {
            activeScanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        } catch (e) { onError(e); return; }
        videoEl.srcObject = activeScanStream;
        await videoEl.play().catch(function () {});
        var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        var stopped = false;
        (function loop() {
            if (stopped || !activeScanStream) return;
            detector.detect(videoEl).then(function (codes) {
                if (stopped) return;
                if (codes && codes.length) {
                    stopped = true;
                    onDecoded(codes[0].rawValue);
                } else {
                    setTimeout(loop, 250);
                }
            }).catch(function () { setTimeout(loop, 250); });
        })();
        return function cancel() { stopped = true; stopScan(); };
    }

    // ── code assembly: full text (reliable) + best-effort QR ────────────────
    // Text code carries the real SDP verbatim; the QR carries the compact
    // reconstruction. Both encode the same underlying handshake step.

    function buildCodes(role, sdp, secretHex) {
        var textPayload = role === 'offer' ? { sdp: sdp, secret: secretHex } : { sdp: sdp };
        var textCode = btoa(unescape(encodeURIComponent(JSON.stringify(textPayload))));

        var qrBytes = null;
        var essentials = parseSdpEssentials(sdp.sdp);
        if (essentials) {
            qrBytes = packCompact(role === 'offer' ? 1 : 2, essentials, role === 'offer' ? secretHex : null);
        }
        return { textCode: textCode, qrBytes: qrBytes };
    }

    function decodeTextCode(str) {
        return JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    }

    function decodeQrPayload(rawValue) {
        // The QR carries the compact payload as base64 ASCII text (see
        // renderQrCanvas for why) — decode that back to bytes first.
        var bytes = base64ToBytes(rawValue.trim());
        var fields = unpackCompact(bytes);
        var role = fields.tag === 1 ? 'offer' : 'answer';
        var sdpText = synthesizeSdp(role, fields);
        return { role: role, sdp: { type: role, sdp: sdpText }, secretHex: fields.secretHex };
    }

    async function waitIceComplete(peer) {
        return new Promise(function (resolve) {
            if (peer.iceGatheringState === 'complete') return resolve();
            var done = false;
            var finish = function () { if (!done) { done = true; resolve(); } };
            peer.addEventListener('icegatheringstatechange', function onChange() {
                if (peer.iceGatheringState === 'complete') {
                    peer.removeEventListener('icegatheringstatechange', onChange);
                    finish();
                }
            });
            setTimeout(finish, ICE_GATHER_TIMEOUT_MS);
        });
    }

    function isDirectConnectionSupported() {
        return typeof RTCPeerConnection !== 'undefined' || typeof window.RTCPeerConnection !== 'undefined';
    }

    // Some privacy/ad-blocking extensions (and a few enterprise browser
    // policies) leave `RTCPeerConnection` defined but make `new
    // RTCPeerConnection(...)` throw synchronously. Turn that into an
    // explicit, actionable message instead of a silent hang.
    function renderConnectionBlocked(b, err) {
        var detail = err && err.message ? String(err.message) : '';
        b.innerHTML =
            '<div class="lnls-warn"><i class="bi bi-exclamation-triangle"></i> ' +
                escapeHtml(t('lsBlocked', 'Direct device-to-device connections seem to be blocked in this browser — often by a privacy/ad-blocking extension, or a browser or network policy. Sync Nearby needs this to connect two devices.')) +
            '</div>' +
            '<div class="lnls-row"><label>' + escapeHtml(t('lsBlockedHint', 'Try disabling privacy/ad-blocking extensions for this site (or open it in a private/incognito window without extensions), then try again.')) + '</label></div>' +
            (detail ? '<div class="lnls-log" style="margin-top:0">' + escapeHtml(detail) + '</div>' : '');
        if (logEl) log(t('lsBlockedLog', 'Could not start a direct connection — see the message above.'));
    }

    var pc = null, channel = null;

    function teardown() {
        try { if (channel) channel.close(); } catch (e) {}
        try { if (pc) pc.close(); } catch (e) {}
        stopScan();
        pc = null; channel = null; state = null;
        sessionSecret = null; sessionKeyPromise = null;
    }

    function onSyncComplete() {
        setTimeout(function () { teardown(); if (overlay) renderChoice(); }, 1200);
    }

    // =========================================================================
    // VIEWS
    // =========================================================================

    function renderChoice() {
        overlay.querySelector('.lnls-box').innerHTML =
            '<button type="button" class="lnls-close" id="lnlsClose">&times;</button>' +
            '<h3><i class="bi bi-arrow-left-right"></i>' + escapeHtml(t('lsTitle', 'Sync Nearby')) + '</h3>' +
            '<p class="lnls-sub">' + escapeHtml(t('lsSub', 'Sync notes directly with another device — no account, no cloud, no server. Works best when both devices are on the same Wi-Fi.')) + '</p>' +
            '<div class="lnls-choice">' +
                '<div class="lnls-choicebtn" id="lnlsHost"><i class="bi bi-broadcast"></i>' + escapeHtml(t('lsHost', 'Start session')) + '<div style="opacity:.6;font-size:11px;margin-top:4px">' + escapeHtml(t('lsHostHint', 'On this device')) + '</div></div>' +
                '<div class="lnls-choicebtn" id="lnlsJoin"><i class="bi bi-qr-code-scan"></i>' + escapeHtml(t('lsJoin', 'Join session')) + '<div style="opacity:.6;font-size:11px;margin-top:4px">' + escapeHtml(t('lsJoinHint', 'Have a code from another device')) + '</div></div>' +
            '</div>';
        overlay.querySelector('#lnlsClose').addEventListener('click', close);
        overlay.querySelector('#lnlsHost').addEventListener('click', startHost);
        overlay.querySelector('#lnlsJoin').addEventListener('click', renderJoinChoice);
    }

    // ── host ──────────────────────────────────────────────────────────────

    async function startHost() {
        renderShell(t('lsHostTitle', 'Start session'), renderChoice, false);
        var b = body();
        b.innerHTML = '<div class="lnls-row"><label>' + escapeHtml(t('lsPreparing', 'Preparing code\u2026')) + '</label></div>';

        if (!isDirectConnectionSupported()) { renderConnectionBlocked(b); return; }
        try {
            sessionSecret = randomHex(18);
            pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            channel = pc.createDataChannel('sync');
            var offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            log(t('lsGathering', 'Gathering connection info\u2026'));
            await waitIceComplete(pc);
        } catch (e) { renderConnectionBlocked(b, e); return; }

        var codes = buildCodes('offer', pc.localDescription, sessionSecret);
        renderCodeStep(b, {
            stepLabel: t('lsStep1', '1. Show or send this code to the other device'),
            textCode: codes.textCode,
            qrBytes: codes.qrBytes,
            nextLabel: t('lsStep2', '2. Scan or paste the reply code from the other device'),
            onNext: async function (raw) {
                try {
                    var parsed = decodeTextCode(raw);
                    if (parsed.secret && parsed.secret !== sessionSecret) throw new Error('secret mismatch');
                    await pc.setRemoteDescription(parsed.sdp);
                    log(t('lsConnecting', 'Connecting\u2026'));
                } catch (e) { log(t('lsBadCode', 'That code doesn\u2019t look right — check it was copied or scanned in full.')); }
            },
            onScan: async function (rawValue) {
                try {
                    var decoded = decodeQrPayload(rawValue);
                    await pc.setRemoteDescription(decoded.sdp);
                    log(t('lsConnecting', 'Connecting\u2026'));
                } catch (e) { log(t('lsBadCode', 'That code doesn\u2019t look right — check it was copied or scanned in full.')); }
            }
        });
        channel.addEventListener('open', function () { createSyncEngine(channel, { onComplete: onSyncComplete }); });
        log(t('lsCodeReady', 'Code ready — share it with the other device.'));
    }

    // ── join ──────────────────────────────────────────────────────────────

    function renderJoinChoice() {
        renderShell(t('lsJoinTitle', 'Join session'), renderChoice, false);
        var b = body();
        renderScanOrPaste(b, {
            label: t('lsPasteOffer', 'Scan or paste the code from the host device'),
            onDecoded: handleJoinOffer
        });
    }

    async function handleJoinOffer(raw, isQr) {
        var parsed, secretHex;
        try {
            if (isQr) {
                var decoded = decodeQrPayload(raw);
                parsed = decoded.sdp;
                secretHex = decoded.secretHex;
            } else {
                var textParsed = decodeTextCode(raw);
                parsed = textParsed.sdp;
                secretHex = textParsed.secret;
            }
        } catch (e) {
            log(t('lsBadCode', 'That code doesn\u2019t look right — check it was copied or scanned in full.'));
            return;
        }
        sessionSecret = secretHex;

        var b = body();
        if (!isDirectConnectionSupported()) { renderConnectionBlocked(b); return; }
        try {
            pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pc.addEventListener('datachannel', function (e) {
                channel = e.channel;
                channel.addEventListener('open', function () { createSyncEngine(channel, { onComplete: onSyncComplete }); });
            });
            await pc.setRemoteDescription(parsed);
            var answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            log(t('lsGathering', 'Gathering connection info\u2026'));
            await waitIceComplete(pc);
        } catch (e) { renderConnectionBlocked(b, e); return; }

        var codes = buildCodes('answer', pc.localDescription, null);
        renderShell(t('lsJoinTitle', 'Join session'), renderChoice, true);
        var b2 = body();
        b2.innerHTML =
            '<div class="lnls-row"><label>' + escapeHtml(t('lsStep3', 'Send this reply code back to the host device')) + '</label></div>';
        var qrContainer = document.createElement('div');
        qrContainer.className = 'lnls-qr-wrap';
        b2.appendChild(qrContainer);
        var qrOk = codes.qrBytes && renderQrCanvas(qrContainer, codes.qrBytes);
        var textArea = document.createElement('textarea');
        textArea.className = 'lnls-code';
        textArea.readOnly = true;
        textArea.value = codes.textCode;
        b2.appendChild(textArea);
        var copyBtnRow = document.createElement('div');
        copyBtnRow.className = 'lnls-actions';
        copyBtnRow.innerHTML = '<button type="button" class="lnls-btn secondary" id="lnlsCopyAnswer">' + escapeHtml(t('copy', 'Copy code')) + '</button>';
        b2.appendChild(copyBtnRow);
        overlay.querySelector('#lnlsCopyAnswer').addEventListener('click', function () {
            navigator.clipboard.writeText(codes.textCode).then(function () { log(t('lsCopied', 'Code copied.')); });
        });
        var waitMsg = document.createElement('p');
        waitMsg.className = 'lnls-sub';
        waitMsg.textContent = t('lsWaiting', 'Once the host enters this code, syncing starts automatically.');
        b2.appendChild(waitMsg);
        if (!qrOk) {
            var warn = document.createElement('div');
            warn.className = 'lnls-warn';
            warn.textContent = t('lsQrUnavailable', 'Couldn\u2019t prepare a QR code for this connection — please use the text above instead.');
            b2.insertBefore(warn, textArea);
        }
    }

    // ── shared UI: a code step with QR + text + (optional) camera scan ──────

    function renderCodeStep(container, opts) {
        container.innerHTML = '';
        var label1 = document.createElement('label');
        label1.textContent = opts.stepLabel;
        container.appendChild(label1);

        var qrContainer = document.createElement('div');
        qrContainer.className = 'lnls-qr-wrap';
        container.appendChild(qrContainer);
        var qrOk = opts.qrBytes && renderQrCanvas(qrContainer, opts.qrBytes);

        var textArea = document.createElement('textarea');
        textArea.className = 'lnls-code';
        textArea.readOnly = true;
        textArea.value = opts.textCode;
        container.appendChild(textArea);

        if (!qrOk) {
            var warn = document.createElement('div');
            warn.className = 'lnls-warn';
            warn.textContent = t('lsQrUnavailable', 'Couldn\u2019t prepare a QR code for this connection — please use the text above instead.');
            container.insertBefore(warn, textArea);
        }

        var copyRow = document.createElement('div');
        copyRow.className = 'lnls-actions';
        copyRow.innerHTML = '<button type="button" class="lnls-btn secondary" id="lnlsCopyCode">' + escapeHtml(t('copy', 'Copy code')) + '</button>';
        container.appendChild(copyRow);
        copyRow.querySelector('#lnlsCopyCode').addEventListener('click', function () {
            navigator.clipboard.writeText(opts.textCode).then(function () { log(t('lsCopied', 'Code copied.')); });
        });

        var warnBox = document.createElement('div');
        warnBox.className = 'lnls-warn';
        warnBox.style.marginTop = '10px';
        warnBox.innerHTML = '<i class="bi bi-exclamation-triangle"></i> ' + escapeHtml(t('lsCodeWarning', 'This code lets anyone who has it connect and read your notes. Only share it through a channel you trust.'));
        container.appendChild(warnBox);

        var scanHost = document.createElement('div');
        container.appendChild(scanHost);
        renderScanOrPaste(scanHost, { label: opts.nextLabel, onDecoded: function (raw, isQr) {
            if (isQr) opts.onScan(raw); else opts.onNext(raw);
        } });
    }

    // Renders a paste box plus, when BarcodeDetector is available, a "Scan
    // with camera" option above it. onDecoded(value, isQr) fires either way.
    function renderScanOrPaste(container, opts) {
        var wrap = document.createElement('div');
        wrap.className = 'lnls-row';
        var label = document.createElement('label');
        label.textContent = opts.label;
        wrap.appendChild(label);

        if (barcodeDetectorSupported()) {
            var tabs = document.createElement('div');
            tabs.className = 'lnls-tabs';
            tabs.innerHTML =
                '<button type="button" class="lnls-tab active" data-tab="scan">' + escapeHtml(t('lsScanTab', 'Scan with camera')) + '</button>' +
                '<button type="button" class="lnls-tab" data-tab="paste">' + escapeHtml(t('lsPasteTab', 'Paste text')) + '</button>';
            wrap.appendChild(tabs);

            var scanPane = document.createElement('div');
            var pastePane = document.createElement('div');
            pastePane.style.display = 'none';
            wrap.appendChild(scanPane);
            wrap.appendChild(pastePane);
            container.appendChild(wrap);

            var cancelScan = null;
            function showScan() {
                pastePane.style.display = 'none';
                scanPane.style.display = '';
                var videoWrap = document.createElement('div');
                videoWrap.className = 'lnls-video-wrap';
                var video = document.createElement('video');
                video.setAttribute('playsinline', '');
                video.setAttribute('muted', '');
                videoWrap.appendChild(video);
                scanPane.innerHTML = '';
                scanPane.appendChild(videoWrap);
                var hint = document.createElement('p');
                hint.className = 'lnls-scan-hint';
                hint.textContent = t('lsScanHint', 'Point the camera at the other device\u2019s QR code.');
                scanPane.appendChild(hint);
                startScan(video, function (rawValue) { opts.onDecoded(rawValue, true); },
                    function (err) {
                        scanPane.innerHTML = '<div class="lnls-warn"><i class="bi bi-exclamation-triangle"></i> ' +
                            escapeHtml(t('lsCameraUnavailable', 'Could not access the camera — paste the code instead.')) + '</div>';
                        switchTo('paste');
                    }).then(function (cancel) { cancelScan = cancel; });
            }
            function showPaste() {
                if (cancelScan) { cancelScan(); cancelScan = null; }
                scanPane.style.display = 'none';
                pastePane.style.display = '';
                pastePane.innerHTML = '';
                var textarea = document.createElement('textarea');
                textarea.className = 'lnls-code';
                textarea.placeholder = t('lsPasteHere', 'Paste here\u2026');
                pastePane.appendChild(textarea);
                var actions = document.createElement('div');
                actions.className = 'lnls-actions';
                actions.innerHTML = '<button type="button" class="lnls-btn primary" id="lnlsPasteGo">' + escapeHtml(t('lsConnect', 'Connect')) + '</button>';
                pastePane.appendChild(actions);
                actions.querySelector('#lnlsPasteGo').addEventListener('click', function () {
                    if (textarea.value.trim()) opts.onDecoded(textarea.value, false);
                });
            }
            function switchTo(which) {
                tabs.querySelectorAll('.lnls-tab').forEach(function (tabBtn) {
                    tabBtn.classList.toggle('active', tabBtn.getAttribute('data-tab') === which);
                });
                if (which === 'scan') showScan(); else showPaste();
            }
            tabs.querySelectorAll('.lnls-tab').forEach(function (tabBtn) {
                tabBtn.addEventListener('click', function () { switchTo(tabBtn.getAttribute('data-tab')); });
            });
            showScan();
        } else {
            container.appendChild(wrap);
            var textarea2 = document.createElement('textarea');
            textarea2.className = 'lnls-code';
            textarea2.placeholder = t('lsPasteHere', 'Paste here\u2026');
            wrap.appendChild(textarea2);
            var actions2 = document.createElement('div');
            actions2.className = 'lnls-actions';
            actions2.innerHTML = '<button type="button" class="lnls-btn primary" id="lnlsPasteGo2">' + escapeHtml(t('lsConnect', 'Connect')) + '</button>';
            wrap.appendChild(actions2);
            actions2.querySelector('#lnlsPasteGo2').addEventListener('click', function () {
                if (textarea2.value.trim()) opts.onDecoded(textarea2.value, false);
            });
        }
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    function close() {
        teardown();
        if (!overlay) return;
        overlay.classList.remove('lnls-open');
        setTimeout(function () { if (overlay) { overlay.remove(); overlay = null; } }, 200);
    }

    function open() {
        injectStyles();
        overlay = document.createElement('div');
        overlay.className = 'lnls-ov';
        overlay.innerHTML = '<div class="lnls-box"></div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });

        if (typeof crypto === 'undefined' || !crypto.subtle) {
            console.error('LanSync: Web Crypto API (crypto.subtle) is required but unavailable.');
            renderShell(t('lsTitle', 'Sync Nearby'), null, false);
            body().innerHTML = '<div class="lnls-warn"><i class="bi bi-exclamation-triangle"></i> ' +
                escapeHtml(t('lsNoEncryption', 'The app\u2019s encryption module isn\u2019t available, so pairing can\u2019t be secured. Please reload the app and try again.')) + '</div>';
        } else {
            renderChoice();
        }
        requestAnimationFrame(function () { overlay.classList.add('lnls-open'); });
    }

    window.LanSync = { open: open };

    // ── toolbar button ──────────────────────────────────────────────────
    function mountToolbarButton() {
        if (document.getElementById('lanSyncBtn')) return;
        var container = document.querySelector('.btn_view_div');
        if (!container) return;
        injectStyles();
        var btn = document.createElement('button');
        btn.id = 'lanSyncBtn';
        btn.type = 'button';
        btn.title = t('lsTitle', 'Sync Nearby');
        btn.innerHTML = '<i class="bi bi-arrow-left-right"></i> ' + escapeHtml(t('lsToolbarLabel', 'Sync'));
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
})();
