/**
 * Local Notes — App Lock
 * PIN and file are configured on separate settings tabs.
 * If both are set, the lock screen shows tabs so the user picks how to unlock.
 */

(function () {
    'use strict';

    const KEY_ENABLED      = 'ln_lock_enabled';
    const KEY_PIN_HASH     = 'ln_lock_pin_hash';
    const KEY_FILE_HASH    = 'ln_lock_file_hash';
    const KEY_UNLOCKED     = 'ln_lock_session';
    const KEY_LAST_ACTIVITY = 'ln_lock_last_activity';
    const IDLE_TIMEOUT_MS  = 10 * 60 * 1000; // 10 minutes

    async function sha256hex(data) {
        const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function hasPinConfigured()  { return !!localStorage.getItem(KEY_PIN_HASH); }
    function hasFileConfigured() { return !!localStorage.getItem(KEY_FILE_HASH); }

    function getLockMode() {
        const pin = hasPinConfigured();
        const file = hasFileConfigured();
        if (!pin && !file) {
            localStorage.removeItem(KEY_ENABLED);
            return '';
        }
        const mode = pin && file ? 'both' : (pin ? 'pin' : 'file');
        localStorage.setItem(KEY_ENABLED, mode);
        return mode;
    }

    function syncEnabledMode() { return getLockMode(); }
    function modeUsesPin(mode)  { return mode === 'pin' || mode === 'both'; }
    function modeUsesFile(mode) { return mode === 'file' || mode === 'both'; }
    function isUnlocked() { return sessionStorage.getItem(KEY_UNLOCKED) === '1'; }
    function markUnlocked() {
        sessionStorage.setItem(KEY_UNLOCKED, '1');
        touchActivity();
        setupIdleWatcher();
    }
    function clearSession() {
        sessionStorage.removeItem(KEY_UNLOCKED);
        sessionStorage.removeItem(KEY_LAST_ACTIVITY);
    }

    function touchActivity() {
        if (!getLockMode() || !isUnlocked()) return;
        sessionStorage.setItem(KEY_LAST_ACTIVITY, String(Date.now()));
    }

    function isIdleExpired() {
        if (!isUnlocked()) return false;
        const raw = sessionStorage.getItem(KEY_LAST_ACTIVITY);
        if (!raw) return true;
        const last = parseInt(raw, 10);
        if (!Number.isFinite(last)) return true;
        return Date.now() - last >= IDLE_TIMEOUT_MS;
    }

    function applyLockInert() {
        document.body.classList.add('ln-lock-body');
        document.body.querySelectorAll(':scope > *:not(#ln-lock-screen)').forEach(el => {
            el.setAttribute('inert', '');
        });
    }

    function showLockScreen() {
        if (document.getElementById('ln-lock-screen')) return;
        applyLockInert();
        buildLockScreen();
        applyLockInert();
    }

    function lockDueToIdle() {
        if (!getLockMode() || !isUnlocked()) return;
        if (!isIdleExpired()) return;
        clearSession();
        showLockScreen();
    }

    let idleWatcherSetup = false;
    function setupIdleWatcher() {
        if (idleWatcherSetup || !getLockMode()) return;
        idleWatcherSetup = true;

        const onActivity = () => touchActivity();
        ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'pointerdown'].forEach(evt => {
            document.addEventListener(evt, onActivity, { passive: true, capture: true });
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') lockDueToIdle();
        });

        window.addEventListener('focus', lockDueToIdle);
        window.addEventListener('pageshow', (e) => {
            if (e.persisted) lockDueToIdle();
        });

        setInterval(lockDueToIdle, 30 * 1000);
    }

    function tr(key, fallback) {
        if (typeof window.t === 'function') {
            const v = window.t(key);
            if (v && v !== key) return v;
        }
        const FB = {
            lockTitle: 'App Locked',
            lockSubtitle: 'Enter PIN or upload access file',
            lockPinPlaceholder: 'Enter PIN',
            lockUnlock: 'Unlock',
            lockFileBtn: 'Upload access file',
            lockWrongPin: 'Wrong PIN',
            lockWrongFile: 'Wrong access file',
            lockAttemptsLeft: 'Attempts left: ',
            lockTooMany: 'Too many attempts. Wait 1 minute.',
            lockSettingsTitle: 'App Lock',
            lockModeNone: 'No lock',
            lockModePin: 'PIN code',
            lockModeFile: 'Access file',
            lockTabPin: 'PIN',
            lockUnlockChoose: 'Choose how to unlock',
            lockTabFile: 'File',
            lockPinNew: 'New PIN (4-8 digits)',
            lockPinConfirm: 'Confirm PIN',
            lockPinMismatch: 'PINs do not match',
            lockPinTooShort: 'PIN must be 4-8 digits',
            lockFileSelect: 'Select access file',
            lockFileHint: "Any file becomes your key. Don't lose it!",
            lockSave: 'Save',
            lockDisable: 'Disable lock',
            lockSaved: 'Lock settings saved',
            lockDisabled: 'Lock disabled',
            cancel: 'Cancel',
            lockCurrentPin: 'Current PIN (to confirm)',
            lockCurrentFile: 'Current access file (to confirm)',
            lockGenerateFile: 'Generate & Download access file',
            lockGenerateHint: 'A unique key file will be generated and downloaded. Use it to unlock the app.',
            lockGenerateDownloaded: 'File downloaded! Now select it below to set as your key.',
            lockFileOrExisting: 'Or use an existing file',
            lockNow: 'Lock now',
            lockNowTitle: 'Tap to lock. Hold or right-click for settings.',
            lockNowDone: 'App locked',
        };
        return FB[key] || fallback || key;
    }

    const MAX_ATTEMPTS = 5;
    let failedAttempts = 0;
    let lockedUntil = 0;

    function isRateLimited() {
        if (lockedUntil && Date.now() < lockedUntil) return true;
        if (lockedUntil && Date.now() >= lockedUntil) { lockedUntil = 0; failedAttempts = 0; }
        return false;
    }

    function recordFailure() {
        failedAttempts++;
        if (failedAttempts >= MAX_ATTEMPTS) {
            lockedUntil = Date.now() + 60 * 1000;
            failedAttempts = 0;
        }
    }

    function clearLockStorage() {
        localStorage.removeItem(KEY_ENABLED);
        localStorage.removeItem(KEY_PIN_HASH);
        localStorage.removeItem(KEY_FILE_HASH);
    }

    async function verifyPinInput(overlay, inputId) {
        const stored = localStorage.getItem(KEY_PIN_HASH);
        if (!stored) return true;
        const input = overlay.querySelector(inputId);
        if (!input?.value) return false;
        return (await sha256hex(input.value)) === stored;
    }

    async function verifyFileInput(overlay, inputId) {
        const stored = localStorage.getItem(KEY_FILE_HASH);
        if (!stored) return true;
        const input = overlay.querySelector(inputId);
        if (!input?.files?.[0]) return false;
        const buf = await input.files[0].arrayBuffer();
        return (await sha256hex(new Uint8Array(buf))) === stored;
    }

    /** Verify stored lock before disable or mode switch (checks OLD mode only). */
    async function verifyBeforeChange(overlay, storedMode) {
        if (!storedMode) return true;
        if (storedMode === 'pin') return verifyPinInput(overlay, '#ln-lss-current-pin');
        if (storedMode === 'file') return verifyFileInput(overlay, '#ln-lss-current-file');
        if (storedMode === 'both') {
            const pinOk = !hasPinConfigured() || await verifyPinInput(overlay, '#ln-lss-current-pin');
            const fileOk = !hasFileConfigured() || await verifyFileInput(overlay, '#ln-lss-current-file');
            return pinOk && fileOk;
        }
        return true;
    }

    function verifyErrorForMode(mode) {
        if (mode === 'pin') return tr('lockWrongPin');
        if (mode === 'file') return tr('lockWrongFile');
        if (mode === 'both') return tr('lockWrongPin') + ' / ' + tr('lockWrongFile');
        return tr('lockWrongPin');
    }

    /** Settings UI: configTab is which panel to edit — '', 'pin', or 'file' (not 'both'). */
    function applySettingsTab(overlay, configTab) {
        overlay.querySelector('#ln-lss-selected-mode').value = configTab;
        overlay.querySelectorAll('.ln-lss-tab').forEach(tab => {
            const on = tab.dataset.mode === configTab;
            tab.classList.toggle('active', on);
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
        });

        const pinSec = overlay.querySelector('#ln-lss-pin-section');
        const fileSec = overlay.querySelector('#ln-lss-file-section');
        if (pinSec) pinSec.style.display = configTab === 'pin' ? '' : 'none';
        if (fileSec) fileSec.style.display = configTab === 'file' ? '' : 'none';

        const curPin = overlay.querySelector('#ln-lss-current-pin-field');
        const curFile = overlay.querySelector('#ln-lss-current-file-field');
        if (curPin) curPin.style.display = (configTab === 'pin' && hasPinConfigured()) ? '' : 'none';
        if (curFile) curFile.style.display = (configTab === 'file' && hasFileConfigured()) ? '' : 'none';
    }

    function getSelectedSettingsMode(overlay) {
        return overlay.querySelector('#ln-lss-selected-mode')?.value || '';
    }

    async function readNewFileHash(overlay) {
        const file = overlay.querySelector('#ln-lss-new-file')?.files?.[0];
        if (!file) return null;
        const buf = await file.arrayBuffer();
        return sha256hex(new Uint8Array(buf));
    }

    // ── Lock screen ───────────────────────────────────────────────────────────

    function buildLockScreen() {
        const showPin = hasPinConfigured();
        const showFile = hasFileConfigured();
        const useTabs = showPin && showFile;

        const overlay = document.createElement('div');
        overlay.id = 'ln-lock-screen';
        overlay.className = 'ln-lock-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', tr('lockTitle'));

        overlay.innerHTML = `
            <div class="ln-lock-panel">
                <div class="ln-lock-icon"><i class="bi bi-lock-fill"></i></div>
                <h2 class="ln-lock-title">${tr('lockTitle')}</h2>
                <p class="ln-lock-subtitle">${useTabs ? tr('lockUnlockChoose') : tr('lockSubtitle')}</p>

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
                <div class="ln-lock-section ln-lock-tab-panel ${useTabs ? 'active' : ''}" data-panel="pin">
                    <div class="ln-lock-pin-dots" id="ln-lock-pin-dots">
                        <span></span><span></span><span></span><span></span>
                    </div>
                    <input type="password" inputmode="numeric" pattern="[0-9]*"
                           id="ln-lock-pin-input" class="ln-lock-pin-input"
                           placeholder="${tr('lockPinPlaceholder')}"
                           maxlength="8" autocomplete="current-password" />
                    <button type="button" class="ln-lock-btn ln-lock-btn-primary" id="ln-lock-pin-btn">
                        <i class="bi bi-unlock"></i> ${tr('lockUnlock')}
                    </button>
                </div>` : ''}

                ${showFile ? `
                <div class="ln-lock-section ln-lock-tab-panel ${useTabs ? '' : 'active'}" data-panel="file">
                    <label class="ln-lock-file-label" for="ln-lock-file-input">
                        <i class="bi bi-file-earmark-lock"></i>
                        <span id="ln-lock-file-name">${tr('lockFileBtn')}</span>
                    </label>
                    <input type="file" id="ln-lock-file-input" class="ln-lock-file-input"
                           aria-label="${tr('lockFileBtn')}" />
                </div>` : ''}

                <div class="ln-lock-error" id="ln-lock-error" aria-live="polite"></div>
            </div>`;

        document.body.appendChild(overlay);

        function showLockError(msg) {
            const el = overlay.querySelector('#ln-lock-error');
            if (el) { el.textContent = msg; el.classList.add('visible'); }
        }

        if (useTabs) {
            overlay.querySelectorAll('.ln-lock-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.dataset.tab;
                    overlay.querySelectorAll('.ln-lock-tab').forEach(t => {
                        const on = t.dataset.tab === tabId;
                        t.classList.toggle('active', on);
                        t.setAttribute('aria-selected', on ? 'true' : 'false');
                    });
                    overlay.querySelectorAll('.ln-lock-tab-panel').forEach(p => {
                        p.classList.toggle('active', p.dataset.panel === tabId);
                    });
                    const err = overlay.querySelector('#ln-lock-error');
                    if (err) { err.textContent = ''; err.classList.remove('visible'); }
                    if (tabId === 'pin') {
                        setTimeout(() => overlay.querySelector('#ln-lock-pin-input')?.focus(), 50);
                    }
                });
            });
        }

        const pinInput = overlay.querySelector('#ln-lock-pin-input');
        const pinDots = overlay.querySelector('#ln-lock-pin-dots');
        if (pinInput && pinDots) {
            pinInput.addEventListener('input', () => {
                const len = Math.min(pinInput.value.length, 8);
                pinDots.querySelectorAll('span').forEach((d, i) => d.classList.toggle('filled', i < len));
            });
            pinInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') overlay.querySelector('#ln-lock-pin-btn')?.click();
            });
            setTimeout(() => pinInput.focus(), 300);
        }

        overlay.querySelector('#ln-lock-pin-btn')?.addEventListener('click', async () => {
            if (isRateLimited()) { showLockError(tr('lockTooMany')); return; }
            const pin = pinInput?.value || '';
            const hash = await sha256hex(pin);
            if (hash === localStorage.getItem(KEY_PIN_HASH)) {
                unlockApp(overlay);
            } else {
                recordFailure();
                const left = MAX_ATTEMPTS - failedAttempts;
                showLockError(tr('lockWrongPin') + (left > 0 ? ` (${tr('lockAttemptsLeft')}${left})` : ''));
                if (pinInput) {
                    pinInput.value = '';
                    pinInput.classList.add('ln-lock-shake');
                    setTimeout(() => pinInput.classList.remove('ln-lock-shake'), 500);
                }
                if (pinDots) pinDots.querySelectorAll('span').forEach(d => d.classList.remove('filled'));
            }
        });

        overlay.querySelector('#ln-lock-file-input')?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const nameEl = overlay.querySelector('#ln-lock-file-name');
            if (nameEl) nameEl.textContent = file.name;
            try {
                const buf = await file.arrayBuffer();
                const hash = await sha256hex(new Uint8Array(buf));
                if (hash === localStorage.getItem(KEY_FILE_HASH)) {
                    unlockApp(overlay);
                } else {
                    if (isRateLimited()) { showLockError(tr('lockTooMany')); return; }
                    recordFailure();
                    showLockError(tr('lockWrongFile'));
                }
            } catch { showLockError(tr('lockWrongFile')); }
        });
    }

    function unlockApp(overlay) {
        markUnlocked();
        overlay.classList.add('ln-lock-unlocking');
        document.body.querySelectorAll(':scope > *:not(#ln-lock-screen)').forEach(el => {
            el.removeAttribute('inert');
        });
        setTimeout(() => {
            overlay.remove();
            document.body.classList.remove('ln-lock-body');
        }, 400);
    }

    function initLock() {
        const mode = getLockMode();
        if (!mode) return;

        // New browser/tab session: sessionStorage is empty → require unlock
        if (!isUnlocked()) {
            showLockScreen();
            return;
        }

        // Same session but idle ≥ 10 minutes
        if (isIdleExpired()) {
            clearSession();
            showLockScreen();
            return;
        }

        touchActivity();
        setupIdleWatcher();
    }

    // ── Settings modal ────────────────────────────────────────────────────────

    function openAppLockSettings() {
        document.getElementById('ln-lock-settings-modal')?.remove();

        const storedMode = getLockMode();
        const initialTab = storedMode === 'file' ? 'file' : 'pin';

        const overlay = document.createElement('div');
        overlay.id = 'ln-lock-settings-modal';
        overlay.className = 'ln-lock-settings-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', tr('lockSettingsTitle'));

        overlay.innerHTML = `
            <div class="ln-lock-settings-panel">
                <div class="ln-lock-settings-header">
                    <span class="ln-lock-settings-title">
                        <i class="bi bi-shield-lock"></i> ${tr('lockSettingsTitle')}
                    </span>
                    <button type="button" class="ln-lock-settings-close" id="ln-lss-close" aria-label="${tr('cancel')}">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>

                <div class="ln-lock-settings-body">
                    <input type="hidden" id="ln-lss-selected-mode" value="${initialTab}" />

                    <div class="ln-lss-tabs" role="tablist">
                        <button type="button" class="ln-lss-tab" data-mode="" role="tab">
                            <i class="bi bi-unlock"></i> ${tr('lockModeNone')}
                        </button>
                        <button type="button" class="ln-lss-tab" data-mode="pin" role="tab">
                            <i class="bi bi-123"></i> ${tr('lockModePin')}
                        </button>
                        <button type="button" class="ln-lss-tab" data-mode="file" role="tab">
                            <i class="bi bi-file-earmark-lock"></i> ${tr('lockModeFile')}
                        </button>
                    </div>

                    <div class="ln-lss-section ln-lss-pin-section" id="ln-lss-pin-section">
                        <div class="ln-lss-field" id="ln-lss-current-pin-field" style="display:none">
                            <label class="ln-lss-label">${tr('lockCurrentPin')}</label>
                            <input type="password" inputmode="numeric" pattern="[0-9]*"
                                   id="ln-lss-current-pin" class="ln-lss-input"
                                   maxlength="8" autocomplete="current-password" />
                        </div>
                        <div class="ln-lss-field">
                            <label class="ln-lss-label">${tr('lockPinNew')}</label>
                            <input type="password" inputmode="numeric" pattern="[0-9]*"
                                   id="ln-lss-new-pin" class="ln-lss-input"
                                   maxlength="8" autocomplete="new-password" />
                        </div>
                        <div class="ln-lss-field">
                            <label class="ln-lss-label">${tr('lockPinConfirm')}</label>
                            <input type="password" inputmode="numeric" pattern="[0-9]*"
                                   id="ln-lss-confirm-pin" class="ln-lss-input"
                                   maxlength="8" autocomplete="new-password" />
                        </div>
                    </div>

                    <div class="ln-lss-section ln-lss-file-section" id="ln-lss-file-section">
                        <div class="ln-lss-field" id="ln-lss-current-file-field" style="display:none">
                            <label class="ln-lss-label">${tr('lockCurrentFile')}</label>
                            <label class="ln-lss-file-label" for="ln-lss-current-file">
                                <i class="bi bi-file-earmark-check"></i>
                                <span id="ln-lss-current-file-name">${tr('lockFileSelect')}</span>
                            </label>
                            <input type="file" id="ln-lss-current-file" class="ln-lock-file-input" />
                        </div>
                        <div class="ln-lss-field">
                            <label class="ln-lss-label">${tr('lockFileSelect')}</label>
                            <button type="button" class="ln-lss-generate-btn" id="ln-lss-generate-file">
                                <i class="bi bi-download"></i> ${tr('lockGenerateFile')}
                            </button>
                            <p class="ln-lss-hint ln-lss-hint-generate">
                                <i class="bi bi-info-circle"></i> ${tr('lockGenerateHint')}
                            </p>
                            <label class="ln-lss-label" style="margin-top:12px">${tr('lockFileOrExisting')}</label>
                            <label class="ln-lss-file-label" for="ln-lss-new-file">
                                <i class="bi bi-file-earmark-lock"></i>
                                <span id="ln-lss-new-file-name">${tr('lockFileSelect')}</span>
                            </label>
                            <input type="file" id="ln-lss-new-file" class="ln-lock-file-input" />
                            <p class="ln-lss-hint">
                                <i class="bi bi-info-circle"></i> ${tr('lockFileHint')}
                            </p>
                        </div>
                    </div>

                    <div class="ln-lss-error" id="ln-lss-error" aria-live="polite"></div>
                </div>

                <div class="ln-lock-settings-footer">
                    ${storedMode ? `
                    <button type="button" class="ln-lss-btn ln-lss-btn-lock-now" id="ln-lss-lock-now">
                        <i class="bi bi-lock-fill"></i> ${tr('lockNow')}
                    </button>
                    <button type="button" class="ln-lss-btn ln-lss-btn-danger" id="ln-lss-disable">
                        <i class="bi bi-unlock"></i> ${tr('lockDisable')}
                    </button>` : ''}
                    <button type="button" class="ln-lss-btn ln-lss-btn-cancel" id="ln-lss-cancel">
                        <i class="bi bi-x-lg"></i> ${tr('cancel')}
                    </button>
                    <button type="button" class="ln-lss-btn ln-lss-btn-primary" id="ln-lss-save">
                        <i class="bi bi-floppy"></i> ${tr('lockSave')}
                    </button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('ln-lock-settings-visible'));

        applySettingsTab(overlay, initialTab);

        const close = () => {
            overlay.classList.remove('ln-lock-settings-visible');
            setTimeout(() => overlay.remove(), 280);
        };

        overlay.querySelector('#ln-lss-close').addEventListener('click', close);
        overlay.querySelector('#ln-lss-cancel').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
        });

        overlay.querySelectorAll('.ln-lss-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                applySettingsTab(overlay, tab.dataset.mode);
                const err = overlay.querySelector('#ln-lss-error');
                if (err) { err.textContent = ''; err.classList.remove('visible'); }
            });
        });

        overlay.querySelector('#ln-lss-new-file')?.addEventListener('change', e => {
            const f = e.target.files?.[0];
            if (f) overlay.querySelector('#ln-lss-new-file-name').textContent = f.name;
        });
        overlay.querySelector('#ln-lss-current-file')?.addEventListener('change', e => {
            const f = e.target.files?.[0];
            if (f) overlay.querySelector('#ln-lss-current-file-name').textContent = f.name;
        });

        overlay.querySelector('#ln-lss-generate-file')?.addEventListener('click', () => {
            generateAndDownloadAccessFile();
            const hint = overlay.querySelector('.ln-lss-hint-generate');
            if (hint) {
                hint.style.color = 'var(--primary-color, #aefc6e)';
                hint.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${tr('lockGenerateDownloaded')}`;
            }
        });

        const showError = msg => {
            const el = overlay.querySelector('#ln-lss-error');
            if (el) { el.textContent = msg; el.classList.add('visible'); }
        };

        overlay.querySelector('#ln-lss-lock-now')?.addEventListener('click', () => {
            close();
            lockNow();
        });

        overlay.querySelector('#ln-lss-disable')?.addEventListener('click', async () => {
            if (!(await verifyBeforeChange(overlay, storedMode))) {
                showError(verifyErrorForMode(storedMode));
                return;
            }
            clearLockStorage();
            clearSession();
            close();
            showToast(tr('lockDisabled'));
            if (typeof window._updateLockBtn === 'function') window._updateLockBtn();
        });

        overlay.querySelector('#ln-lss-save').addEventListener('click', async () => {
            const configTab = getSelectedSettingsMode(overlay);

            if (!configTab) {
                if (storedMode) {
                    if (!(await verifyBeforeChange(overlay, storedMode))) {
                        showError(verifyErrorForMode(storedMode));
                        return;
                    }
                }
                clearLockStorage();
                clearSession();
                close();
                showToast(tr('lockDisabled'));
                if (typeof window._updateLockBtn === 'function') window._updateLockBtn();
                return;
            }

            if (configTab === 'pin') {
                if (hasPinConfigured()) {
                    if (!(await verifyPinInput(overlay, '#ln-lss-current-pin'))) {
                        showError(tr('lockWrongPin'));
                        return;
                    }
                }
                const newPin = overlay.querySelector('#ln-lss-new-pin')?.value || '';
                const confirmPin = overlay.querySelector('#ln-lss-confirm-pin')?.value || '';
                if (!/^\d{4,8}$/.test(newPin)) { showError(tr('lockPinTooShort')); return; }
                if (newPin !== confirmPin) { showError(tr('lockPinMismatch')); return; }
                try {
                    localStorage.setItem(KEY_PIN_HASH, await sha256hex(newPin));
                    syncEnabledMode();
                    markUnlocked();
                    close();
                    showToast(tr('lockSaved'));
                    if (typeof window._updateLockBtn === 'function') window._updateLockBtn();
                } catch {
                    showError(tr('lockWrongPin'));
                }
                return;
            }

            if (configTab === 'file') {
                if (hasFileConfigured()) {
                    if (!(await verifyFileInput(overlay, '#ln-lss-current-file'))) {
                        showError(tr('lockWrongFile'));
                        return;
                    }
                }
                const fileHash = await readNewFileHash(overlay);
                if (!fileHash && !hasFileConfigured()) {
                    showError(tr('lockFileSelect'));
                    return;
                }
                try {
                    if (fileHash) localStorage.setItem(KEY_FILE_HASH, fileHash);
                    syncEnabledMode();
                    markUnlocked();
                    close();
                    showToast(tr('lockSaved'));
                    if (typeof window._updateLockBtn === 'function') window._updateLockBtn();
                } catch {
                    showError(tr('lockWrongFile'));
                }
            }
        });
    }

    function generateAndDownloadAccessFile() {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const content = `LocalNotes Access Key\n${hex}\n${Date.now()}`;
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'localnotes-access.key';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
        return blob;
    }

    function showToast(msg) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('', msg, 'success');
            return;
        }
        const t = document.createElement('div');
        t.className = 'ln-lock-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('visible'));
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 2500);
    }

    function lockNow() {
        if (!getLockMode()) return;
        clearSession();
        showLockScreen();
        showToast(tr('lockNowDone'));
    }

    window.AppLock = {
        init: initLock,
        openSettings: openAppLockSettings,
        isEnabled: () => !!getLockMode(),
        isUnlocked: () => isUnlocked(),
        lockNow,
        lock: lockNow
    };

    function tryInit() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(initLock, 80));
        } else {
            setTimeout(initLock, 80);
        }
    }
    tryInit();
})();
