/**
 * LAN Sync — direct device-to-device note sync over WebRTC, with no sync
 * server and no accounts.
 *
 * Reality check baked into the UX copy: a browser tab cannot do real
 * mDNS/Bonjour discovery of other tabs on the network (sandboxing), so
 * "discovery" here is a one-time pairing code the user copies from one
 * device to the other (via any channel they like — AirDrop, Telegram,
 * reading it out loud, a QR code from a phone camera app, whatever).
 * Once paired, the actual note data flows peer-to-peer over a WebRTC
 * DataChannel — when both devices really are on the same LAN, ICE
 * negotiation prefers the local "host" candidate, so the sync traffic
 * itself never leaves the network.
 *
 * The pairing code embeds a random one-time session secret alongside the
 * SDP, and every application-level message is additionally encrypted with
 * a per-session AES-256-GCM key derived straight from that secret via HKDF
 * (see getSessionKey() below) — defense in depth on top of WebRTC's own
 * DTLS, and it doubles as a pairing check (garbled/foreign codes just fail
 * to decrypt).
 *
 * Deliberately NOT window.encryption (AdvancedEncryption, the pipeline
 * behind .note export): that class hard-binds its derived key to
 * window.location.origin as an anti-phishing measure for *exported files*
 * meant for the real production domain — exactly wrong here, since it
 * silently breaks Sync Nearby on every self-hosted/forked/preview
 * deployment (encrypt()/decrypt() throw on any origin but the one
 * production domain or localhost). It also runs a fresh 600k-iteration
 * PBKDF2 per message (its salt-based KDF cache never hits, since the
 * message-level salt is always new), which is unnecessary work for a
 * session key that's already random with no password to stretch — HKDF
 * over the session secret gets the same AES-256-GCM security with none of
 * that cost. Same reasoning _deriveVaultKey() in index.js uses for the App
 * Lock vault, applied here to the sync session key.
 *
 * Sync protocol (application messages, JSON, then encrypted):
 *   manifest { notes: [{id, lastModified}] }
 *   request  { ids: [...] }
 *   notes    { items: [...fullNoteObjects], last: bool }
 *   complete {}
 *
 * Conflict rule: last-write-wins by lastModified. Good enough for a first
 * version; a per-peer sync-vector (to avoid re-diffing everything each
 * time) would be the natural next step.
 *
 * Exposes window.LanSync = { open }
 */
(function () {
    'use strict';

    var ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
    var ICE_GATHER_TIMEOUT_MS = 4000;
    var CHUNK_SIZE = 15; // notes per 'notes' message, keeps datachannel messages small

    var overlay = null, logEl = null;
    var pc = null, channel = null;
    var sessionSecret = null;
    var state = null;

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

    // Some privacy/ad-blocking extensions (and a few enterprise browser
    // policies) leave `RTCPeerConnection` defined but make `new
    // RTCPeerConnection(...)` throw synchronously — seen in the wild as
    // "WebRTC is blocked by extension" from injected shims like
    // inject-webrtc-block.js. isWebRTCSupported() below (used at dialog
    // open) only catches the "undefined entirely" case, so this throw
    // doesn't happen until later, inside startHost()/the join handler — both
    // async functions with no caller that awaits or catches them, so it was
    // surfacing only as an "Uncaught (in promise)" console error while the
    // dialog itself just sat on "Preparing code…" forever with no
    // indication anything had gone wrong. This turns that into an explicit,
    // actionable message instead of a silent hang.
    function renderWebRTCBlocked(body, err) {
        var detail = err && err.message ? String(err.message) : '';
        body.innerHTML =
            '<div class="lnls-warn"><i class="bi bi-exclamation-triangle"></i> ' +
                escapeHtml(t('lsWebrtcBlocked', 'WebRTC seems to be blocked in this browser — often by a privacy/ad-blocking extension, or a browser or network policy. Sync Nearby needs it to connect two devices directly.')) +
            '</div>' +
            '<div class="lnls-row"><label>' + escapeHtml(t('lsWebrtcBlockedHint', 'Try disabling privacy/ad-blocking extensions for this site (or open it in a private/incognito window without extensions), then try again.')) + '</label></div>' +
            (detail ? '<div class="lnls-log" style="margin-top:0">' + escapeHtml(detail) + '</div>' : '');
        if (logEl) log(t('lsWebrtcBlockedLog', 'Could not start WebRTC — see the message above.'));
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

    function randomSecret() {
        var bytes = new Uint8Array(18);
        crypto.getRandomValues(bytes);
        return Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    // ── styles ──────────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('lnls-style')) return;
        var css =
            '.lnls-ov{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;' +
                'background:rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .15s;}' +
            '.lnls-ov.lnls-open{opacity:1;pointer-events:auto;}' +
            '.lnls-box{width:min(520px,94vw);max-height:90vh;overflow:auto;background:var(--modal-bg,#1a1a1a);' +
                'border:1px solid var(--modal-border,#272727);border-radius:14px;padding:20px;color:var(--text-color,#e0e0e0);}' +
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
                'resize:vertical;word-break:break-all;}' +
            '.lnls-actions{display:flex;gap:10px;margin-top:6px;}' +
            '.lnls-btn{flex:1;padding:10px;border-radius:8px;border:0;font-size:13.5px;font-weight:600;cursor:pointer;}' +
            '.lnls-btn.primary{background:#aefc6e;color:#0c0c0c;}' +
            '.lnls-btn.secondary{background:transparent;border:1px solid var(--border-color,#333);color:var(--text-color,#e0e0e0);}' +
            '.lnls-btn:disabled{opacity:.5;cursor:default;}' +
            '.lnls-log{margin-top:14px;background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;max-height:130px;' +
                'overflow-y:auto;font-size:11.5px;color:var(--text-secondary,#999);font-family:monospace;line-height:1.6;}' +
            '.lnls-back{font-size:12px;color:var(--text-secondary,#999);cursor:pointer;margin-bottom:12px;display:inline-block;}' +
            '.lnls-back:hover{color:#aefc6e;}' +
            '.lnls-warn{background:rgba(255,193,7,.1);border:1px solid rgba(255,193,7,.35);border-radius:8px;' +
                'padding:10px 12px;font-size:12px;color:#e0b93d;margin-bottom:6px;line-height:1.5;}' +
            '.lnls-close{position:absolute;top:14px;right:16px;background:transparent;border:0;color:var(--text-secondary,#999);' +
                'font-size:20px;cursor:pointer;}';

        var style = document.createElement('style');
        style.id = 'lnls-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ── views ───────────────────────────────────────────────────────────────
    function renderChoice() {
        overlay.querySelector('.lnls-box').innerHTML =
            '<button type="button" class="lnls-close" id="lnlsClose">&times;</button>' +
            '<h3><i class="bi bi-arrow-left-right"></i>' + escapeHtml(t('lsTitle', 'Sync Nearby')) + '</h3>' +
            '<p class="lnls-sub">' + escapeHtml(t('lsSub', 'Sync notes directly with another device — no account, no cloud. Works best when both devices are on the same Wi-Fi.')) + '</p>' +
            '<div class="lnls-choice">' +
                '<div class="lnls-choicebtn" id="lnlsHost"><i class="bi bi-broadcast"></i>' + escapeHtml(t('lsHost', 'Start session')) + '<div style="opacity:.6;font-size:11px;margin-top:4px">' + escapeHtml(t('lsHostHint', 'On this device')) + '</div></div>' +
                '<div class="lnls-choicebtn" id="lnlsJoin"><i class="bi bi-qr-code-scan"></i>' + escapeHtml(t('lsJoin', 'Join session')) + '<div style="opacity:.6;font-size:11px;margin-top:4px">' + escapeHtml(t('lsJoinHint', 'Have a code from another device')) + '</div></div>' +
            '</div>';
        overlay.querySelector('#lnlsClose').addEventListener('click', close);
        overlay.querySelector('#lnlsHost').addEventListener('click', startHost);
        overlay.querySelector('#lnlsJoin').addEventListener('click', renderJoinInput);
    }

    function renderShell(title, backFn) {
        overlay.querySelector('.lnls-box').innerHTML =
            '<button type="button" class="lnls-close" id="lnlsClose">&times;</button>' +
            (backFn ? '<span class="lnls-back" id="lnlsBack"><i class="bi bi-arrow-left"></i> ' + escapeHtml(t('back', 'Back')) + '</span><br>' : '') +
            '<h3><i class="bi bi-arrow-left-right"></i>' + escapeHtml(title) + '</h3>' +
            '<div id="lnlsBody"></div>' +
            '<div class="lnls-log" id="lnlsLog"></div>';
        overlay.querySelector('#lnlsClose').addEventListener('click', close);
        if (backFn) overlay.querySelector('#lnlsBack').addEventListener('click', backFn);
        logEl = overlay.querySelector('#lnlsLog');
    }

    function waitIceComplete(peer) {
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
            setTimeout(finish, ICE_GATHER_TIMEOUT_MS); // don't hang forever on flaky networks
        });
    }

    function encodeCode(obj) {
        return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    }
    function decodeCode(str) {
        return JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    }

    // ── HOST flow ───────────────────────────────────────────────────────────
    async function startHost() {
        renderShell(t('lsHostTitle', 'Start session'), renderChoice);
        var body = overlay.querySelector('#lnlsBody');
        body.innerHTML = '<div class="lnls-row"><label>' + escapeHtml(t('lsPreparing', 'Preparing code\u2026')) + '</label></div>';

        if (!isWebRTCSupported()) { renderWebRTCBlocked(body); return; }

        try {
            sessionSecret = randomSecret();
            pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            setupPeerCommon();
            channel = pc.createDataChannel('sync');
            wireChannel();

            var offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            log(t('lsGathering', 'Gathering connection info\u2026'));
            await waitIceComplete(pc);
        } catch (e) {
            renderWebRTCBlocked(body, e);
            return;
        }

        var code = encodeCode({ sdp: pc.localDescription, secret: sessionSecret });

        body.innerHTML =
            '<div class="lnls-row"><label>' + escapeHtml(t('lsStep1', '1. Send this code to the other device')) + '</label>' +
                '<textarea class="lnls-code" id="lnlsOfferCode" readonly>' + escapeHtml(code) + '</textarea>' +
                '<div class="lnls-actions"><button type="button" class="lnls-btn secondary" id="lnlsCopyOffer">' + escapeHtml(t('copy', 'Copy code')) + '</button></div>' +
            '</div>' +
            '<div class="lnls-warn"><i class="bi bi-exclamation-triangle"></i> ' +
                escapeHtml(t('lsCodeWarning', 'This code lets anyone who has it connect and read your notes. Only share it through a channel you trust.')) +
            '</div>' +
            '<div class="lnls-row"><label>' + escapeHtml(t('lsStep2', '2. Paste the reply code from the other device')) + '</label>' +
                '<textarea class="lnls-code" id="lnlsAnswerInput" placeholder="' + escapeHtml(t('lsPasteHere', 'Paste here\u2026')) + '"></textarea>' +
                '<div class="lnls-actions"><button type="button" class="lnls-btn primary" id="lnlsConnect">' + escapeHtml(t('lsConnect', 'Connect')) + '</button></div>' +
            '</div>';

        overlay.querySelector('#lnlsCopyOffer').addEventListener('click', function () {
            navigator.clipboard.writeText(code).then(function () { log(t('lsCopied', 'Code copied.')); });
        });
        overlay.querySelector('#lnlsConnect').addEventListener('click', async function () {
            var raw = overlay.querySelector('#lnlsAnswerInput').value;
            try {
                var parsed = decodeCode(raw);
                if (parsed.secret !== sessionSecret) throw new Error('secret mismatch');
                await pc.setRemoteDescription(parsed.sdp);
                log(t('lsConnecting', 'Connecting\u2026'));
            } catch (e) {
                log(t('lsBadCode', 'That code doesn\u2019t look right — check it was copied in full.'));
            }
        });
        log(t('lsCodeReady', 'Code ready — share it with the other device.'));
    }

    // ── JOIN flow ───────────────────────────────────────────────────────────
    function renderJoinInput() {
        renderShell(t('lsJoinTitle', 'Join session'), renderChoice);
        var body = overlay.querySelector('#lnlsBody');
        body.innerHTML =
            '<div class="lnls-row"><label>' + escapeHtml(t('lsPasteOffer', 'Paste the code from the host device')) + '</label>' +
                '<textarea class="lnls-code" id="lnlsOfferInput" placeholder="' + escapeHtml(t('lsPasteHere', 'Paste here\u2026')) + '"></textarea>' +
                '<div class="lnls-actions"><button type="button" class="lnls-btn primary" id="lnlsGenAnswer">' + escapeHtml(t('lsGenAnswer', 'Generate reply code')) + '</button></div>' +
            '</div>';
        overlay.querySelector('#lnlsGenAnswer').addEventListener('click', async function () {
            var raw = overlay.querySelector('#lnlsOfferInput').value;
            var parsed;
            try { parsed = decodeCode(raw); } catch (e) { log(t('lsBadCode', 'That code doesn\u2019t look right — check it was copied in full.')); return; }
            sessionSecret = parsed.secret;

            if (!isWebRTCSupported()) { renderWebRTCBlocked(body); return; }

            try {
                pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
                setupPeerCommon();
                pc.addEventListener('datachannel', function (e) { channel = e.channel; wireChannel(); });

                await pc.setRemoteDescription(parsed.sdp);
                var answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                log(t('lsGathering', 'Gathering connection info\u2026'));
                await waitIceComplete(pc);
            } catch (e) {
                renderWebRTCBlocked(body, e);
                return;
            }

            var code = encodeCode({ sdp: pc.localDescription, secret: sessionSecret });
            body.innerHTML =
                '<div class="lnls-row"><label>' + escapeHtml(t('lsStep3', 'Send this reply code back to the host device')) + '</label>' +
                    '<textarea class="lnls-code" id="lnlsAnswerCode" readonly>' + escapeHtml(code) + '</textarea>' +
                    '<div class="lnls-actions"><button type="button" class="lnls-btn secondary" id="lnlsCopyAnswer">' + escapeHtml(t('copy', 'Copy code')) + '</button></div>' +
                '</div>' +
                '<div class="lnls-warn"><i class="bi bi-exclamation-triangle"></i> ' +
                    escapeHtml(t('lsCodeWarning', 'This code lets anyone who has it connect and read your notes. Only share it through a channel you trust.')) +
                '</div>' +
                '<p class="lnls-sub">' + escapeHtml(t('lsWaiting', 'Once the host enters this code, syncing starts automatically.')) + '</p>';
            overlay.querySelector('#lnlsCopyAnswer').addEventListener('click', function () {
                navigator.clipboard.writeText(code).then(function () { log(t('lsCopied', 'Code copied.')); });
            });
        });
    }

    // ── shared peer/channel wiring ───────────────────────────────────────────
    function setupPeerCommon() {
        pc.addEventListener('connectionstatechange', function () {
            log(t('lsConnState', 'Connection: ') + pc.connectionState);
            if (pc.connectionState === 'failed') log(t('lsFailed', 'Connection failed — codes may have expired, try again.'));
        });
    }

    function wireChannel() {
        state = {
            peerManifest: null, localManifest: null,
            sentManifest: false, receivedManifest: false,
            sentRequest: false, receivedRequest: false,
            sentNotes: false, receivedNotes: false,
            sentComplete: false, receivedComplete: false,
            applied: 0, sent: 0
        };
        channel.addEventListener('open', onChannelOpen);
        channel.addEventListener('message', onChannelMessage);
        channel.addEventListener('close', function () { log(t('lsChannelClosed', 'Connection closed.')); });
    }

    // ── session encryption (see header comment for why this isn't
    // window.encryption) ───────────────────────────────────────────────────
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

    // Loop-based, not String.fromCharCode.apply(null, bytes) — the 'notes'
    // message batches can carry a chunk's worth of full note HTML, and
    // spreading a large typed array as call arguments risks blowing the
    // stack. Same pattern AdvancedEncryption.arrayBufferToBase64 uses.
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

    async function send(obj) {
        var plain = new TextEncoder().encode(JSON.stringify(obj));
        var iv = crypto.getRandomValues(new Uint8Array(12));
        var key = await getSessionKey();
        var cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
        var out = new Uint8Array(12 + cipherBuf.byteLength);
        out.set(iv, 0);
        out.set(new Uint8Array(cipherBuf), 12);
        channel.send(bytesToBase64(out));
    }
    async function receive(raw) {
        var bytes = base64ToBytes(raw);
        var iv = bytes.slice(0, 12);
        var cipher = bytes.slice(12);
        var key = await getSessionKey();
        var plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cipher);
        return JSON.parse(new TextDecoder().decode(plainBuf));
    }

    async function onChannelOpen() {
        log(t('lsConnected', 'Connected! Comparing notes\u2026'));
        var all = await window.notesDB.getAllNotes();
        state.localAll = all;
        state.localManifest = all.map(function (n) { return { id: n.id, lastModified: n.lastModified || 0 }; });
        await send({ type: 'manifest', notes: state.localManifest });
        state.sentManifest = true;
    }

    async function onChannelMessage(e) {
        var msg;
        try { msg = await receive(e.data); }
        catch (err) { log(t('lsDecryptFail', 'Could not read a message from the other device.')); return; }

        if (msg.type === 'manifest') {
            state.receivedManifest = true;
            var localById = {};
            state.localAll.forEach(function (n) { localById[n.id] = n; });
            var needed = msg.notes.filter(function (m) {
                var local = localById[m.id];
                return !local || (local.lastModified || 0) < (m.lastModified || 0);
            }).map(function (m) { return m.id; });
            log(t('lsRequesting', 'Requesting {n} notes from the other device.').replace('{n}', needed.length));
            await send({ type: 'request', ids: needed });
            state.sentRequest = true;
            maybeComplete();
        } else if (msg.type === 'request') {
            state.receivedRequest = true;
            var items = [];
            for (var i = 0; i < msg.ids.length; i++) {
                var n = await window.notesDB.getNote(msg.ids[i]);
                if (n) items.push(n);
            }
            var batches = [];
            for (var i2 = 0; i2 < items.length; i2 += CHUNK_SIZE) batches.push(items.slice(i2, i2 + CHUNK_SIZE));
            if (batches.length === 0) batches.push([]);
            for (var b = 0; b < batches.length; b++) {
                await send({ type: 'notes', items: batches[b], last: b === batches.length - 1 });
            }
            state.sent = items.length;
            state.sentNotes = true;
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
                    state.applied++;
                }
            }
            if (rejected) log(t('lsRejected', 'Ignored {n} malformed note(s) from the other device.').replace('{n}', rejected));
            if (msg.last) {
                state.receivedNotes = true;
                log(t('lsApplied', 'Applied {n} notes from the other device.').replace('{n}', state.applied));
                if (typeof window.loadNotes === 'function') window.loadNotes();
                maybeComplete();
            }
        } else if (msg.type === 'complete') {
            state.receivedComplete = true;
            maybeComplete();
        }
    }

    async function maybeComplete() {
        if (state.sentNotes && state.receivedNotes && !state.sentComplete) {
            await send({ type: 'complete' });
            state.sentComplete = true;
        }
        if (state.sentComplete && state.receivedComplete) {
            log(t('lsDone', '\u2713 Sync complete — {sent} sent, {applied} received.')
                .replace('{sent}', state.sent).replace('{applied}', state.applied));
        }
    }

    // ── lifecycle ───────────────────────────────────────────────────────────
    function teardown() {
        try { if (channel) channel.close(); } catch (e) {}
        try { if (pc) pc.close(); } catch (e) {}
        channel = null; pc = null; state = null; sessionSecret = null;
        sessionKeyPromise = null;
    }

    function close() {
        teardown();
        if (!overlay) return;
        overlay.classList.remove('lnls-open');
        setTimeout(function () { if (overlay) { overlay.remove(); overlay = null; } }, 200);
    }

    function isWebRTCSupported() {
        return typeof RTCPeerConnection !== 'undefined' || typeof window.RTCPeerConnection !== 'undefined';
    }

    function renderUnsupported() {
        overlay.querySelector('.lnls-box').innerHTML =
            '<button type="button" class="lnls-close" id="lnlsClose">&times;</button>' +
            '<h3><i class="bi bi-arrow-left-right"></i>' + escapeHtml(t('lsTitle', 'Sync Nearby')) + '</h3>' +
            '<div class="lnls-warn"><i class="bi bi-exclamation-triangle"></i> ' +
                escapeHtml(t('lsUnsupported', 'This browser doesn\u2019t support WebRTC, so device-to-device sync isn\u2019t available here. Try a recent version of Chrome, Firefox, Edge, or Safari.')) +
            '</div>';
        overlay.querySelector('#lnlsClose').addEventListener('click', close);
    }

    function open() {
        injectStyles();
        overlay = document.createElement('div');
        overlay.className = 'lnls-ov';
        overlay.innerHTML = '<div class="lnls-box"></div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });

        if (!isWebRTCSupported()) {
            renderUnsupported();
        } else if (typeof crypto === 'undefined' || !crypto.subtle) {
            console.error('LanSync: Web Crypto API (crypto.subtle) is required but unavailable.');
            renderShell(t('lsTitle', 'Sync Nearby'), null);
            overlay.querySelector('#lnlsBody').innerHTML =
                '<div class="lnls-warn"><i class="bi bi-exclamation-triangle"></i> ' +
                escapeHtml(t('lsNoEncryption', 'The app\u2019s encryption module isn\u2019t available, so pairing can\u2019t be secured. Please reload the app and try again.')) +
                '</div>';
        } else {
            renderChoice();
        }
        requestAnimationFrame(function () { overlay.classList.add('lnls-open'); });
    }

    window.LanSync = { open: open };

    // ── toolbar button ──────────────────────────────────────────────────
    // No class/custom styling — css/action-bar.css already restyles this
    // button (by #lanSyncBtn) into the same segmented control as
    // #toggleTaskBoardButton/#appLockBtn; see the note in site-export.js's
    // mountToolbarButton for why the old pill-button class was removed.
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
