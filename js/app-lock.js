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
 * Local Notes — App Lock == the encryption vault's unlock screen.
 *
 * PIN and/or an access file are not a separate "screen lock" bolted on top
 * of encryption — entering the right one IS how the notes get decrypted.
 * See NotesDatabase.setVaultCredential / unlockVaultWithCredential /
 * removeVaultCredential in js/index.js for the actual envelope-encryption
 * key handling; this file only builds the setup/unlock/settings UI and the
 * idle-timeout re-lock around it.
 *
 * A master password is mandatory: window.AppLock.ensureUnlocked() is
 * awaited from index.js's boot sequence before notes ever load, and shows
 * a non-dismissable first-run setup screen if no credential exists yet.
 */
(function () {
    'use strict';

    const KEY_LAST_ACTIVITY = 'ln_lock_last_activity';
    const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    const MAX_ATTEMPTS = 5;
    const KEY_FAILED_ATTEMPTS = 'ln_lock_failed_attempts';
    const KEY_LOCKED_UNTIL = 'ln_lock_locked_until';

    function db() { return window.notesDB; }

    // ── Recovery phrase ──────────────────────────────────────────────────
    // A 12-word phrase picked from a fixed 256-word list (8 bits/word ⇒ 96
    // bits of entropy — plenty against offline brute force once run through
    // 600k rounds of PBKDF2, see NotesDatabase._deriveVaultKey) — enrolled
    // as its own vault credential slot ('recovery') exactly like PIN/file.
    // It's the answer to "this can never be recovered if you forget it":
    // it *can*, via this phrase, as long as it was saved when generated —
    // it is never stored anywhere, only its derived key ever touches disk.
    const RECOVERY_WORDS = [
        'abbey','acid','acorn','actor','adept','agile','alarm','alert','alloy','almond',
        'alpha','amber','anchor','angle','ankle','apple','apron','arbor','arctic','arena',
        'armor','arrow','ashen','aspen','atlas','atom','aunt','autumn','avenue','axis',
        'badge','baker','banjo','barley','basil','beacon','beam','bear','beaver','beetle',
        'begin','belt','bench','berry','bike','birch','bison','blade','blaze','bloom',
        'blue','boat','bolt','bone','bonus','boots','bottle','boxer','brand','brave',
        'bread','breeze','brick','bridge','bright','broom','brown','brush','bubble','bucket',
        'buddy','bugle','bunny','cabin','cable','cactus','camel','camera','candle','canoe',
        'canyon','cargo','carrot','castle','cedar','cellar','chalk','charm','chase','cheese',
        'cherry','chess','chief','chill','choir','circle','clamp','clay','cliff','clock',
        'cloud','clover','coach','coast','cobalt','cocoa','coffee','comet','copper','coral',
        'corner','cotton','cousin','coyote','crane','crater','cream','creek','crest','crown',
        'cuddle','curl','custom','dance','daisy','dawn','delta','denim','depot','desert',
        'design','diamond','dinner','disc','doctor','dolphin','domain','donkey','dragon','drift',
        'drum','eagle','earth','easel','ebony','echo','eden','edge','eight','elbow',
        'ember','emerald','engine','envoy','equal','estate','ethic','ever','exact','expert',
        'fable','fabric','falcon','feast','fence','fern','field','finch','fjord','flame',
        'flare','flask','fleet','flint','flora','flute','forest','forge','fossil','fox',
        'frame','frost','fruit','galaxy','garden','garnet','gecko','gentle','ghost','giant',
        'ginger','glacier','glider','globe','gloss','glow','goat','gold','gopher','grain',
        'grand','granite','grape','graph','gravel','green','grove','guard','guitar','gulf',
        'habit','halo','hammer','harbor','harp','hazel','heron','hidden','hive','honey',
        'hoop','horizon','hornet','hotel','hound','human','humble','hydro','iceberg','ideal',
        'igloo','image','indigo','inlet','iron','ivory','jacket','jade','jasper','jelly',
        'jewel','joker','jolly','jungle','kayak','kernel','kettle','kitten','knight','koala',
        'label','ladder','lagoon','lake','lamp','laser','latch','laurel','lemon','lentil',
        'level','lilac','lily','linen','lion','loft','logic','lotus','lucky','lumber',
        'lunar','lyric','magma','maple','marble','marina','marsh','mask','matrix','meadow',
        'melon','mentor','mesa','meteor','metric','mint','mirror','mist','model','moss'
    ];

    function generateRecoveryPhrase() {
        // crypto.getRandomValues, not Math.random — this is a real key.
        const idx = new Uint32Array(12);
        crypto.getRandomValues(idx);
        return Array.from(idx, i => RECOVERY_WORDS[i % RECOVERY_WORDS.length]).join(' ');
    }

    function normalizePhrase(phrase) {
        return String(phrase || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function downloadRecoveryPhrase(phrase) {
        const content =
            'Local Notes — recovery phrase\n' +
            '==============================\n\n' +
            phrase + '\n\n' +
            'Keep this somewhere safe and offline (not in cloud storage next to\n' +
            'anything that names this app). Anyone with this phrase can decrypt\n' +
            'your notes, and there is no other way to recover them if you lose\n' +
            'both your PIN/access file AND this phrase.\n' +
            'Generated: ' + new Date().toISOString() + '\n';
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'localnotes-recovery-phrase.txt';
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    }

    async function hasRecoveryConfigured() { return db().hasVaultCredential('recovery'); }

    async function sha256hex(data) {
        const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function hasPinConfigured() { return db().hasVaultCredential('pin'); }
    async function hasFileConfigured() { return db().hasVaultCredential('file'); }
    async function getLockMode() {
        const pin = await hasPinConfigured();
        const file = await hasFileConfigured();
        if (!pin && !file) return '';
        return pin && file ? 'both' : (pin ? 'pin' : 'file');
    }

    // "Unlocked" only ever means one thing now: notesDB actually holds the
    // real AES key in memory. It never survives a reload (nothing about a
    // CryptoKey is written to session/local storage), so — unlike the old
    // PIN-only screen-lock — a fresh page load always needs a real
    // PIN/file entry again, not just a leftover sessionStorage flag.
    function isUnlocked() { return db().vaultReady; }

    function touchActivity() {
        sessionStorage.setItem(KEY_LAST_ACTIVITY, String(Date.now()));
    }
    function clearActivity() { sessionStorage.removeItem(KEY_LAST_ACTIVITY); }
    function isIdleExpired() {
        const raw = sessionStorage.getItem(KEY_LAST_ACTIVITY);
        if (!raw) return true;
        const last = parseInt(raw, 10);
        if (!Number.isFinite(last)) return true;
        return Date.now() - last >= IDLE_TIMEOUT_MS;
    }

    function applyLockInert(lockScreenId) {
        document.body.classList.add('ln-lock-body');
        document.body.querySelectorAll(':scope > *').forEach(el => {
            if (el.id === lockScreenId) el.removeAttribute('inert');
            else el.setAttribute('inert', '');
        });
    }
    function releaseInert() {
        document.body.classList.remove('ln-lock-body');
        document.body.querySelectorAll(':scope > *').forEach(el => el.removeAttribute('inert'));
    }

    function tr(key, fallback) {
        if (typeof window.t === 'function') {
            const v = window.t(key);
            if (v && v !== key) return v;
        }
        const FB = {
            lockTitle: 'App Locked',
            lockSubtitle: 'Enter PIN or upload access file',
            lockSubtitlePin: 'Enter your PIN to unlock',
            lockSubtitleFile: 'Upload your access file to unlock',
            lockConfigured: 'Active unlock methods:',
            lockPinPlaceholder: 'Enter PIN',
            lockUnlock: 'Unlock',
            lockFileBtn: 'Upload access file',
            lockWrongPin: 'Wrong PIN',
            lockWrongFile: 'Wrong access file',
            lockAttemptsLeft: 'Attempts left: ',
            lockTooMany: 'Too many attempts. Wait 1 minute.',
            lockSettingsTitle: 'App Lock',
            lockModePin: 'PIN code',
            lockModeFile: 'Access file',
            lockTabPin: 'PIN',
            lockUnlockChoose: 'Choose how to unlock',
            lockTabFile: 'File',
            lockPinNew: 'New PIN (4-8 digits)',
            lockPinTooShort: 'PIN must be 4-8 digits',
            lockFileSelect: 'Select access file',
            lockFileHint: "Any file becomes your key. Don't lose it!",
            lockSave: 'Save',
            lockSaved: 'Unlock method updated',
            cancel: 'Cancel',
            lockGenerateFile: 'Generate & Download access file',
            lockGenerateHint: 'A unique key file will be generated and downloaded. Use it to unlock the app.',
            lockGenerateDownloaded: 'File downloaded! Now select it below to set as your key.',
            lockFileOrExisting: 'Or use an existing file',
            lockNow: 'Lock now',
            lockNowTitle: 'Tap to lock. Hold or right-click for settings.',
            lockNowDone: 'App locked',
            lockFirstRunTitle: 'Protect your notes',
            lockFirstRunDesc: 'Set a PIN or an access file — this becomes the key your notes are encrypted with. It cannot be reset or recovered if you lose it.',
            lockFirstRunConfirm: 'Create & continue',
            lockRemoveMethod: 'Remove this unlock method',
            lockCannotRemoveLast: 'You need at least one unlock method — set up another one first.',
            lockAckLabel: 'I understand this cannot be reset or recovered.',
            lockAckRequired: 'Please confirm you understand this cannot be recovered.',
            lockRecoveryTitle: 'Save your recovery phrase',
            lockRecoveryDesc: 'This 12-word phrase can unlock your notes if you ever forget your PIN or lose your access file. Save it somewhere safe — anyone with it can read your notes.',
            lockRecoveryDownload: 'Download as text file',
            lockRecoveryAckLabel: "I've saved this phrase somewhere safe.",
            lockRecoveryDownloadFirst: 'Please download the phrase before continuing.',
            lockForgotLink: 'Forgot your PIN or lost your file? Use recovery phrase',
            lockRecoveryPlaceholder: 'Enter your 12-word recovery phrase',
            lockRecoveryWrong: 'That recovery phrase is not correct.',
            lockTabRecovery: 'Recovery phrase',
            lockRecoveryRegenHint: 'Generating a new phrase replaces the old one — the previous phrase will stop working immediately.',
            lockRecoveryRegen: 'Generate new recovery phrase',
        };
        return FB[key] || fallback || key;
    }

    // In-memory counters alone are pointless here — the realistic attack on
    // a short PIN is "guess, reload, guess again", which would silently
    // reset failedAttempts/lockedUntil to 0 every time. Persisting to
    // localStorage means the lockout actually survives a reload.
    function getFailedAttempts() { return parseInt(localStorage.getItem(KEY_FAILED_ATTEMPTS) || '0', 10) || 0; }
    function setFailedAttempts(n) { localStorage.setItem(KEY_FAILED_ATTEMPTS, String(n)); }
    function getLockedUntil() { return parseInt(localStorage.getItem(KEY_LOCKED_UNTIL) || '0', 10) || 0; }
    function setLockedUntil(ts) {
        if (ts) localStorage.setItem(KEY_LOCKED_UNTIL, String(ts));
        else localStorage.removeItem(KEY_LOCKED_UNTIL);
    }
    function isRateLimited() {
        const lockedUntil = getLockedUntil();
        if (lockedUntil && Date.now() < lockedUntil) return true;
        if (lockedUntil && Date.now() >= lockedUntil) { setLockedUntil(0); setFailedAttempts(0); }
        return false;
    }
    function recordFailure() {
        const failedAttempts = getFailedAttempts() + 1;
        if (failedAttempts >= MAX_ATTEMPTS) { setLockedUntil(Date.now() + 60 * 1000); setFailedAttempts(0); }
        else setFailedAttempts(failedAttempts);
    }
    function clearRateLimit() { setFailedAttempts(0); setLockedUntil(0); }

    function isCoarsePointer() { return window.matchMedia('(hover: none) and (pointer: coarse)').matches; }

    function showToast(msg) {
        if (typeof showCustomAlert === 'function') { showCustomAlert('', msg, 'success'); return; }
        const el = document.createElement('div');
        el.className = 'ln-lock-toast';
        el.textContent = msg;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('visible'));
        setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 2500);
    }

    async function readFileSecret(file) {
        const buf = await file.arrayBuffer();
        return sha256hex(new Uint8Array(buf));
    }

    function generateAndDownloadAccessFile() {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const content = `LocalNotes Access Key\n${hex}\n${Date.now()}`;
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'localnotes-access.key';
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
        return blob;
    }

    // ── Idle watcher — clears the real in-memory key after inactivity ──────

    let idleWatcherSetup = false;
    function setupIdleWatcher() {
        if (idleWatcherSetup) return;
        idleWatcherSetup = true;
        touchActivity();
        const onActivity = () => { if (isUnlocked()) touchActivity(); };
        ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'pointerdown'].forEach(evt => {
            document.addEventListener(evt, onActivity, { passive: true, capture: true });
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') checkIdleLock();
        });
        window.addEventListener('focus', checkIdleLock);
        window.addEventListener('pageshow', (e) => { if (e.persisted) checkIdleLock(); });
        setInterval(checkIdleLock, 30 * 1000);
    }

    function checkIdleLock() {
        if (!isUnlocked()) return;
        if (!isIdleExpired()) return;
        db().lockVaultSession();
        clearActivity();
        showUnlockScreen();
    }

    function lockNow() {
        if (!isUnlocked()) return;
        db().lockVaultSession();
        clearActivity();
        showUnlockScreen();
    }

    // ── Unlock screen (credentials already exist) ───────────────────────────

    function showUnlockScreen() {
        if (document.getElementById('ln-lock-screen')) return;
        buildUnlockScreen();
    }

    async function buildUnlockScreen() {
        const showPin = await hasPinConfigured();
        const showFile = await hasFileConfigured();
        const showRecovery = await hasRecoveryConfigured();
        const useTabs = showPin && showFile;

        const overlay = document.createElement('div');
        overlay.id = 'ln-lock-screen';
        overlay.className = 'ln-lock-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', tr('lockTitle'));

        const subtitle = useTabs ? tr('lockUnlockChoose')
            : showPin ? tr('lockSubtitlePin')
            : showFile ? tr('lockSubtitleFile')
            : tr('lockSubtitle');

        overlay.innerHTML = `
            <div class="ln-lock-panel">
                <div class="ln-lock-icon"><i class="bi bi-lock-fill"></i></div>
                <h2 class="ln-lock-title">${tr('lockTitle')}</h2>
                <p class="ln-lock-subtitle">${subtitle}</p>

                ${useTabs ? `
                <div class="ln-lock-tabs" role="tablist">
                    <button type="button" class="ln-lock-tab active" data-tab="pin" role="tab" aria-selected="true">
                        <i class="bi bi-123"></i> ${tr('lockTabPin')}
                    </button>
                    <button type="button" class="ln-lock-tab" data-tab="file" role="tab" aria-selected="false">
                        <i class="bi bi-file-earmark-lock"></i> ${tr('lockTabFile')}
                    </button>
                </div>` : ''}

                ${showPin ? `
                <div class="ln-lock-section${useTabs ? ' ln-lock-tab-panel active' : ''}" data-panel="pin">
                    <div class="ln-lock-pin-dots" id="ln-lock-pin-dots"></div>
                    <input type="password" inputmode="numeric" pattern="[0-9]*"
                           id="ln-lock-pin-input" class="ln-lock-pin-input"
                           placeholder="${tr('lockPinPlaceholder')}"
                           maxlength="8" autocomplete="current-password" />
                    <button type="button" class="ln-lock-btn ln-lock-btn-primary" id="ln-lock-pin-btn">
                        <i class="bi bi-unlock"></i> ${tr('lockUnlock')}
                    </button>
                </div>` : ''}

                ${showFile ? `
                <div class="ln-lock-section${useTabs ? ' ln-lock-tab-panel' : ''}" data-panel="file">
                    <input type="file" id="ln-lock-file-input" class="ln-lock-file-input-hidden"
                           tabindex="-1" aria-hidden="true" />
                    <button type="button" class="ln-lock-file-label" id="ln-lock-file-btn">
                        <i class="bi bi-file-earmark-lock"></i>
                        <span id="ln-lock-file-name">${tr('lockFileBtn')}</span>
                    </button>
                </div>` : ''}

                <div class="ln-lock-error" id="ln-lock-error" aria-live="polite"></div>

                ${showRecovery ? `
                <button type="button" class="ln-lock-forgot-link" id="ln-lock-forgot">${tr('lockForgotLink')}</button>
                <div class="ln-lock-section" id="ln-lock-recovery-panel" style="display:none">
                    <textarea id="ln-lock-recovery-input" class="ln-lock-recovery-input"
                        placeholder="${tr('lockRecoveryPlaceholder')}" rows="2" autocomplete="off"
                        autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
                    <button type="button" class="ln-lock-btn ln-lock-btn-primary" id="ln-lock-recovery-btn">
                        <i class="bi bi-unlock"></i> ${tr('lockUnlock')}
                    </button>
                </div>` : ''}
            </div>`;

        document.body.appendChild(overlay);
        applyLockInert('ln-lock-screen');

        const showLockError = msg => {
            const el = overlay.querySelector('#ln-lock-error');
            if (el) { el.textContent = msg; el.classList.add('visible'); }
        };

        if (useTabs) {
            overlay.querySelectorAll('.ln-lock-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.dataset.tab;
                    overlay.querySelectorAll('.ln-lock-tab').forEach(t => {
                        const on = t.dataset.tab === tabId;
                        t.classList.toggle('active', on);
                        t.setAttribute('aria-selected', on ? 'true' : 'false');
                    });
                    overlay.querySelectorAll('.ln-lock-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabId));
                    const err = overlay.querySelector('#ln-lock-error');
                    if (err) { err.textContent = ''; err.classList.remove('visible'); }
                });
            });
        }

        const fileBtn = overlay.querySelector('#ln-lock-file-btn');
        const fileInput = overlay.querySelector('#ln-lock-file-input');
        if (fileBtn && fileInput) fileBtn.addEventListener('click', () => fileInput.click());

        const pinInput = overlay.querySelector('#ln-lock-pin-input');
        const pinDots = overlay.querySelector('#ln-lock-pin-dots');
        if (pinInput && pinDots) {
            // The PIN itself can be 4-8 digits (see the setup screen's
            // \d{4,8} check) and nothing here knows which length a given
            // vault was set up with — a fixed 4-dot indicator silently
            // stopped updating past the 4th digit, making a 5-8 digit PIN
            // look "stuck". Rebuilding one dot per actual character typed
            // (capped at the same 8-digit maxlength as the input) keeps it
            // accurate for any configured length.
            const renderDots = () => {
                const len = Math.min(pinInput.value.length, 8);
                const emptyPad = Math.max(4 - len, 0); // keep a min 4-dot baseline while typing a short PIN
                pinDots.innerHTML = '<span class="filled"></span>'.repeat(len) + '<span></span>'.repeat(emptyPad);
            };
            renderDots();
            pinInput.addEventListener('input', renderDots);
            pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#ln-lock-pin-btn')?.click(); });
            pinInput.addEventListener('focus', () => {
                requestAnimationFrame(() => { try { pinInput.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} });
            });
            if (!isCoarsePointer()) setTimeout(() => pinInput.focus(), 300);
        }

        return new Promise(resolve => {
            const finish = () => {
                clearRateLimit();
                touchActivity();
                setupIdleWatcher();
                overlay.classList.add('ln-lock-unlocking');
                releaseInert();
                setTimeout(() => overlay.remove(), 400);
                resolve();
            };

            overlay.querySelector('#ln-lock-pin-btn')?.addEventListener('click', async () => {
                if (isRateLimited()) { showLockError(tr('lockTooMany')); return; }
                const pin = pinInput?.value || '';
                const ok = await db().unlockVaultWithCredential('pin', pin);
                if (ok) { finish(); return; }
                recordFailure();
                const left = MAX_ATTEMPTS - getFailedAttempts();
                showLockError(tr('lockWrongPin') + (left > 0 ? ` (${tr('lockAttemptsLeft')}${left})` : ''));
                if (pinInput) {
                    pinInput.value = '';
                    pinInput.classList.add('ln-lock-shake');
                    setTimeout(() => pinInput.classList.remove('ln-lock-shake'), 500);
                }
                if (pinDots) pinDots.innerHTML = '<span></span>'.repeat(4);
            });

            overlay.querySelector('#ln-lock-file-input')?.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const nameEl = overlay.querySelector('#ln-lock-file-name');
                if (nameEl) nameEl.textContent = file.name;
                if (isRateLimited()) { showLockError(tr('lockTooMany')); return; }
                try {
                    const secret = await readFileSecret(file);
                    const ok = await db().unlockVaultWithCredential('file', secret);
                    if (ok) { finish(); return; }
                    recordFailure();
                    showLockError(tr('lockWrongFile'));
                } catch { showLockError(tr('lockWrongFile')); }
            });

            overlay.querySelector('#ln-lock-forgot')?.addEventListener('click', () => {
                const panel = overlay.querySelector('#ln-lock-recovery-panel');
                const forgotBtn = overlay.querySelector('#ln-lock-forgot');
                const showing = panel.style.display !== 'none';
                panel.style.display = showing ? 'none' : '';
                forgotBtn.style.display = showing ? '' : 'none';
                if (!showing) overlay.querySelector('#ln-lock-recovery-input')?.focus();
            });

            overlay.querySelector('#ln-lock-recovery-btn')?.addEventListener('click', async () => {
                if (isRateLimited()) { showLockError(tr('lockTooMany')); return; }
                const phrase = normalizePhrase(overlay.querySelector('#ln-lock-recovery-input')?.value);
                const ok = await db().unlockVaultWithCredential('recovery', phrase);
                if (ok) { finish(); return; }
                recordFailure();
                showLockError(tr('lockRecoveryWrong'));
            });
        });
    }

    // ── First-run setup screen (no credential exists yet) ───────────────────
    // Mandatory, non-dismissable: the app can't do anything useful with
    // notes until there's a key to encrypt them with.

    function buildFirstRunScreen() {
        const overlay = document.createElement('div');
        overlay.id = 'ln-lock-screen';
        overlay.className = 'ln-lock-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', tr('lockFirstRunTitle'));

        overlay.innerHTML = `
            <div class="ln-lock-panel ln-lock-panel-setup">
                <div class="ln-lock-icon"><i class="bi bi-shield-lock-fill"></i></div>
                <h2 class="ln-lock-title">${tr('lockFirstRunTitle')}</h2>
                <p class="ln-lock-subtitle">${tr('lockFirstRunDesc')}</p>

                <div class="ln-lock-tabs" role="tablist">
                    <button type="button" class="ln-lock-tab active" data-tab="pin" role="tab" aria-selected="true">
                        <i class="bi bi-123"></i> ${tr('lockTabPin')}
                    </button>
                    <button type="button" class="ln-lock-tab" data-tab="file" role="tab" aria-selected="false">
                        <i class="bi bi-file-earmark-lock"></i> ${tr('lockTabFile')}
                    </button>
                </div>

                <div class="ln-lock-section ln-lock-tab-panel active" data-panel="pin">
                    <input type="password" inputmode="numeric" pattern="[0-9]*"
                           id="ln-setup-pin" class="ln-lock-pin-input"
                           placeholder="${tr('lockPinNew')}" maxlength="8" autocomplete="new-password" />
                </div>

                <div class="ln-lock-section ln-lock-tab-panel" data-panel="file">
                    <button type="button" class="ln-lss-generate-btn" id="ln-setup-generate-file">
                        <i class="bi bi-download"></i> ${tr('lockGenerateFile')}
                    </button>
                    <p class="ln-lss-hint ln-setup-hint-generate">
                        <i class="bi bi-info-circle"></i> ${tr('lockGenerateHint')}
                    </p>
                    <div class="ln-lss-file-field">
                        <input type="file" id="ln-setup-file" class="ln-lock-file-input" />
                        <label class="ln-lss-file-label" for="ln-setup-file">
                            <i class="bi bi-file-earmark-lock"></i>
                            <span id="ln-setup-file-name">${tr('lockFileSelect')}</span>
                        </label>
                    </div>
                </div>

                <label class="ln-lock-ack">
                    <input type="checkbox" id="ln-setup-ack" />
                    <span>${tr('lockAckLabel')}</span>
                </label>

                <button type="button" class="ln-lock-btn ln-lock-btn-primary" id="ln-setup-confirm">
                    <i class="bi bi-check-lg"></i> ${tr('lockFirstRunConfirm')}
                </button>
                <div class="ln-lock-error" id="ln-lock-error" aria-live="polite"></div>
            </div>`;

        document.body.appendChild(overlay);
        applyLockInert('ln-lock-screen');

        const showLockError = msg => {
            const el = overlay.querySelector('#ln-lock-error');
            if (el) { el.textContent = msg; el.classList.add('visible'); }
        };

        let activeTab = 'pin';
        overlay.querySelectorAll('.ln-lock-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                activeTab = tab.dataset.tab;
                overlay.querySelectorAll('.ln-lock-tab').forEach(t => {
                    const on = t.dataset.tab === activeTab;
                    t.classList.toggle('active', on);
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                overlay.querySelectorAll('.ln-lock-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === activeTab));
            });
        });

        overlay.querySelector('#ln-setup-generate-file')?.addEventListener('click', () => {
            generateAndDownloadAccessFile();
            const hint = overlay.querySelector('.ln-setup-hint-generate');
            if (hint) {
                hint.style.color = 'var(--primary-color, #aefc6e)';
                hint.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${tr('lockGenerateDownloaded')}`;
            }
        });
        overlay.querySelector('#ln-setup-file')?.addEventListener('change', e => {
            const f = e.target.files?.[0];
            if (f) overlay.querySelector('#ln-setup-file-name').textContent = f.name;
        });

        return new Promise(resolve => {
            overlay.querySelector('#ln-setup-confirm').addEventListener('click', async () => {
                if (!overlay.querySelector('#ln-setup-ack').checked) { showLockError(tr('lockAckRequired')); return; }

                if (activeTab === 'pin') {
                    const pin = overlay.querySelector('#ln-setup-pin')?.value || '';
                    if (!/^\d{4,8}$/.test(pin)) { showLockError(tr('lockPinTooShort')); return; }
                    await db().setVaultCredential('pin', pin);
                } else {
                    const file = overlay.querySelector('#ln-setup-file')?.files?.[0];
                    if (!file) { showLockError(tr('lockFileSelect')); return; }
                    const secret = await readFileSecret(file);
                    await db().setVaultCredential('file', secret);
                }

                // The PIN/file just set up is the only thing standing
                // between "forgot it" and "notes gone forever" — a
                // recovery phrase is enrolled as a second, independent way
                // to unwrap the same data key, right here before the app
                // is ever used, so it isn't something that only gets set
                // up after it's already too late.
                await showRecoveryPhraseStep(overlay);

                touchActivity();
                setupIdleWatcher();
                overlay.classList.add('ln-lock-unlocking');
                releaseInert();
                setTimeout(() => overlay.remove(), 400);
                resolve();
            });
        });
    }

    // Shown once, immediately after the first PIN/file is enrolled.
    // Reuses the same overlay (already inert-locked) so there's no flicker
    // or gap where the app becomes interactive without a recovery method.
    function showRecoveryPhraseStep(overlay) {
        const phrase = generateRecoveryPhrase();
        const panel = overlay.querySelector('.ln-lock-panel');

        panel.innerHTML = `
            <div class="ln-lock-icon"><i class="bi bi-key-fill"></i></div>
            <h2 class="ln-lock-title">${tr('lockRecoveryTitle')}</h2>
            <p class="ln-lock-subtitle">${tr('lockRecoveryDesc')}</p>

            <div class="ln-lock-recovery-phrase" id="ln-recovery-phrase">${phrase}</div>

            <button type="button" class="ln-lss-generate-btn" id="ln-recovery-download">
                <i class="bi bi-download"></i> ${tr('lockRecoveryDownload')}
            </button>

            <label class="ln-lock-ack">
                <input type="checkbox" id="ln-recovery-ack" />
                <span>${tr('lockRecoveryAckLabel')}</span>
            </label>

            <button type="button" class="ln-lock-btn ln-lock-btn-primary" id="ln-recovery-confirm" disabled>
                <i class="bi bi-check-lg"></i> ${tr('lockFirstRunConfirm')}
            </button>
            <div class="ln-lock-error" id="ln-lock-error" aria-live="polite"></div>`;

        const showErr = msg => {
            const el = panel.querySelector('#ln-lock-error');
            if (el) { el.textContent = msg; el.classList.add('visible'); }
        };

        return new Promise(resolve => {
            let downloaded = false;
            panel.querySelector('#ln-recovery-download').addEventListener('click', () => {
                downloadRecoveryPhrase(phrase);
                downloaded = true;
                const btn = panel.querySelector('#ln-recovery-download');
                btn.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${tr('lockGenerateDownloaded')}`;
            });

            panel.querySelector('#ln-recovery-ack').addEventListener('change', e => {
                panel.querySelector('#ln-recovery-confirm').disabled = !e.target.checked;
            });

            panel.querySelector('#ln-recovery-confirm').addEventListener('click', async () => {
                if (!downloaded) { showErr(tr('lockRecoveryDownloadFirst')); return; }
                await db().setVaultCredential('recovery', normalizePhrase(phrase));
                resolve();
            });
        });
    }

    // Awaited once from index.js's boot sequence, before notes ever load.
    let ensurePromise = null;
    function ensureUnlocked() {
        if (ensurePromise) return ensurePromise;
        ensurePromise = (async () => {
            if (isUnlocked()) return;
            const setUp = await db().isVaultSetup();
            await (setUp ? buildUnlockScreen() : buildFirstRunScreen());
        })();
        return ensurePromise;
    }

    // ── Settings: add / rotate / remove an unlock method ────────────────────
    // Only reachable once already unlocked (opened from the app's own
    // settings menu), so setVaultCredential always has a live _vaultKey to
    // re-wrap for a new or rotated slot.

    async function openAppLockSettings() {
        document.getElementById('ln-lock-settings-modal')?.remove();
        const showPin = await hasPinConfigured();
        const showFile = await hasFileConfigured();
        const initialTab = showFile && !showPin ? 'file' : 'pin';

        const overlay = document.createElement('div');
        overlay.id = 'ln-lock-settings-modal';
        overlay.className = 'ln-lock-settings-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', tr('lockSettingsTitle'));

        overlay.innerHTML = `
            <div class="ln-lock-settings-panel">
                <div class="ln-lock-settings-header">
                    <span class="ln-lock-settings-title"><i class="bi bi-shield-lock"></i> ${tr('lockSettingsTitle')}</span>
                    <button type="button" class="ln-lock-settings-close" id="ln-lss-close" aria-label="${tr('cancel')}"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="ln-lock-settings-body">
                    <div class="ln-lss-tabs" role="tablist">
                        <button type="button" class="ln-lss-tab" data-mode="pin" role="tab"><i class="bi bi-123"></i> ${tr('lockModePin')}</button>
                        <button type="button" class="ln-lss-tab" data-mode="file" role="tab"><i class="bi bi-file-earmark-lock"></i> ${tr('lockModeFile')}</button>
                        <button type="button" class="ln-lss-tab" data-mode="recovery" role="tab"><i class="bi bi-key"></i> ${tr('lockTabRecovery')}</button>
                    </div>

                    <div class="ln-lss-section ln-lss-pin-section" id="ln-lss-pin-section">
                        <div class="ln-lss-field">
                            <label class="ln-lss-label">${tr('lockPinNew')}</label>
                            <input type="password" inputmode="numeric" pattern="[0-9]*" id="ln-lss-new-pin" class="ln-lss-input" maxlength="8" autocomplete="new-password" />
                        </div>
                        <button type="button" class="ln-lss-btn ln-lss-btn-danger" id="ln-lss-remove-pin" style="display:none">
                            <i class="bi bi-trash"></i> ${tr('lockRemoveMethod')}
                        </button>
                    </div>

                    <div class="ln-lss-section ln-lss-file-section" id="ln-lss-file-section">
                        <div class="ln-lss-field">
                            <label class="ln-lss-label">${tr('lockFileSelect')}</label>
                            <button type="button" class="ln-lss-generate-btn" id="ln-lss-generate-file"><i class="bi bi-download"></i> ${tr('lockGenerateFile')}</button>
                            <p class="ln-lss-hint ln-lss-hint-generate"><i class="bi bi-info-circle"></i> ${tr('lockGenerateHint')}</p>
                            <label class="ln-lss-label" style="margin-top:12px">${tr('lockFileOrExisting')}</label>
                            <div class="ln-lss-file-field">
                                <input type="file" id="ln-lss-new-file" class="ln-lock-file-input" />
                                <label class="ln-lss-file-label" for="ln-lss-new-file"><i class="bi bi-file-earmark-lock"></i> <span id="ln-lss-new-file-name">${tr('lockFileSelect')}</span></label>
                            </div>
                            <p class="ln-lss-hint"><i class="bi bi-info-circle"></i> ${tr('lockFileHint')}</p>
                        </div>
                        <button type="button" class="ln-lss-btn ln-lss-btn-danger" id="ln-lss-remove-file" style="display:none">
                            <i class="bi bi-trash"></i> ${tr('lockRemoveMethod')}
                        </button>
                    </div>

                    <div class="ln-lss-section ln-lss-recovery-section" id="ln-lss-recovery-section">
                        <div class="ln-lss-field">
                            <p class="ln-lss-hint"><i class="bi bi-info-circle"></i> ${tr('lockRecoveryRegenHint')}</p>
                            <button type="button" class="ln-lss-generate-btn" id="ln-lss-regen-recovery"><i class="bi bi-arrow-repeat"></i> ${tr('lockRecoveryRegen')}</button>
                        </div>
                    </div>

                    <p class="ln-lss-status" id="ln-lss-status" aria-live="polite"></p>
                    <div class="ln-lss-error" id="ln-lss-error" aria-live="polite"></div>
                </div>
                <div class="ln-lock-settings-footer">
                    <button type="button" class="ln-lss-btn ln-lss-btn-lock-now" id="ln-lss-lock-now"><i class="bi bi-lock-fill"></i> ${tr('lockNow')}</button>
                    <button type="button" class="ln-lss-btn ln-lss-btn-cancel" id="ln-lss-cancel"><i class="bi bi-x-lg"></i> ${tr('cancel')}</button>
                    <button type="button" class="ln-lss-btn ln-lss-btn-primary" id="ln-lss-save"><i class="bi bi-floppy"></i> ${tr('lockSave')}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('ln-lock-settings-visible'));

        let activeTab = initialTab;
        const applyTab = () => {
            overlay.querySelectorAll('.ln-lss-tab').forEach(t => {
                const on = t.dataset.mode === activeTab;
                t.classList.toggle('active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            overlay.querySelector('#ln-lss-pin-section').style.display = activeTab === 'pin' ? '' : 'none';
            overlay.querySelector('#ln-lss-file-section').style.display = activeTab === 'file' ? '' : 'none';
            overlay.querySelector('#ln-lss-recovery-section').style.display = activeTab === 'recovery' ? '' : 'none';
            overlay.querySelector('#ln-lss-save').style.display = activeTab === 'recovery' ? 'none' : '';
        };

        const refreshStatus = async () => {
            const pin = await hasPinConfigured(), file = await hasFileConfigured(), recovery = await hasRecoveryConfigured();
            const parts = [];
            if (pin) parts.push(tr('lockModePin'));
            if (file) parts.push(tr('lockModeFile'));
            if (recovery) parts.push(tr('lockTabRecovery'));
            const el = overlay.querySelector('#ln-lss-status');
            el.textContent = parts.length ? `${tr('lockConfigured')} ${parts.join(' + ')}` : '';
            el.style.display = parts.length ? '' : 'none';
            // Can only remove PIN/file if another PRIMARY method would still
            // remain — recovery alone isn't meant to be the everyday
            // unlock, so it doesn't count as "another method" here.
            overlay.querySelector('#ln-lss-remove-pin').style.display = (pin && file) ? '' : 'none';
            overlay.querySelector('#ln-lss-remove-file').style.display = (pin && file) ? '' : 'none';
        };

        applyTab();
        await refreshStatus();

        const close = () => { overlay.classList.remove('ln-lock-settings-visible'); setTimeout(() => overlay.remove(), 280); };
        const showError = msg => { const el = overlay.querySelector('#ln-lss-error'); if (el) { el.textContent = msg; el.classList.add('visible'); } };

        overlay.querySelector('#ln-lss-close').addEventListener('click', close);
        overlay.querySelector('#ln-lss-cancel').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });

        overlay.querySelectorAll('.ln-lss-tab').forEach(tab => {
            tab.addEventListener('click', () => { activeTab = tab.dataset.mode; applyTab(); showError(''); });
        });

        overlay.querySelector('#ln-lss-new-file')?.addEventListener('change', e => {
            const f = e.target.files?.[0];
            if (f) overlay.querySelector('#ln-lss-new-file-name').textContent = f.name;
        });
        overlay.querySelector('#ln-lss-generate-file')?.addEventListener('click', () => {
            generateAndDownloadAccessFile();
            const hint = overlay.querySelector('.ln-lss-hint-generate');
            if (hint) { hint.style.color = 'var(--primary-color, #aefc6e)'; hint.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${tr('lockGenerateDownloaded')}`; }
        });

        overlay.querySelector('#ln-lss-lock-now')?.addEventListener('click', () => { close(); lockNow(); });

        overlay.querySelector('#ln-lss-remove-pin')?.addEventListener('click', async () => {
            try { await db().removeVaultCredential('pin'); await refreshStatus(); showToast(tr('lockSaved')); }
            catch { showError(tr('lockCannotRemoveLast')); }
        });
        overlay.querySelector('#ln-lss-remove-file')?.addEventListener('click', async () => {
            try { await db().removeVaultCredential('file'); await refreshStatus(); showToast(tr('lockSaved')); }
            catch { showError(tr('lockCannotRemoveLast')); }
        });

        overlay.querySelector('#ln-lss-regen-recovery')?.addEventListener('click', () => {
            const section = overlay.querySelector('#ln-lss-recovery-section .ln-lss-field');
            const phrase = generateRecoveryPhrase();
            section.innerHTML = `
                <div class="ln-lock-recovery-phrase">${phrase}</div>
                <button type="button" class="ln-lss-generate-btn" id="ln-lss-recovery-download"><i class="bi bi-download"></i> ${tr('lockRecoveryDownload')}</button>
                <label class="ln-lock-ack" style="margin-top:10px">
                    <input type="checkbox" id="ln-lss-recovery-ack" />
                    <span>${tr('lockRecoveryAckLabel')}</span>
                </label>
                <button type="button" class="ln-lss-btn ln-lss-btn-primary" id="ln-lss-recovery-confirm" disabled style="margin-top:10px">
                    <i class="bi bi-check-lg"></i> ${tr('lockSave')}
                </button>`;
            let downloaded = false;
            section.querySelector('#ln-lss-recovery-download').addEventListener('click', () => {
                downloadRecoveryPhrase(phrase);
                downloaded = true;
                section.querySelector('#ln-lss-recovery-download').innerHTML = `<i class="bi bi-check-circle-fill"></i> ${tr('lockGenerateDownloaded')}`;
            });
            section.querySelector('#ln-lss-recovery-ack').addEventListener('change', e => {
                section.querySelector('#ln-lss-recovery-confirm').disabled = !e.target.checked;
            });
            section.querySelector('#ln-lss-recovery-confirm').addEventListener('click', async () => {
                if (!downloaded) { showError(tr('lockRecoveryDownloadFirst')); return; }
                await db().setVaultCredential('recovery', normalizePhrase(phrase));
                await refreshStatus();
                close();
                showToast(tr('lockSaved'));
            });
        });

        overlay.querySelector('#ln-lss-save').addEventListener('click', async () => {
            if (activeTab === 'pin') {
                const newPin = overlay.querySelector('#ln-lss-new-pin')?.value || '';
                if (!newPin) { showError(tr('lockPinTooShort')); return; }
                if (!/^\d{4,8}$/.test(newPin)) { showError(tr('lockPinTooShort')); return; }
                await db().setVaultCredential('pin', newPin);
                await refreshStatus();
                close();
                showToast(tr('lockSaved'));
                return;
            }
            if (activeTab === 'file') {
                const file = overlay.querySelector('#ln-lss-new-file')?.files?.[0];
                if (!file) { showError(tr('lockFileSelect')); return; }
                const secret = await readFileSecret(file);
                await db().setVaultCredential('file', secret);
                await refreshStatus();
                close();
                showToast(tr('lockSaved'));
            }
        });
    }

    window.AppLock = {
        ensureUnlocked,
        openSettings: openAppLockSettings,
        isEnabled: () => isUnlocked(),
        isUnlocked,
        lockNow,
        lock: lockNow
    };
})();
