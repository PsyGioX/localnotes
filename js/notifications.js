/**
 * Reminders (Notification API)
 *
 * IMPORTANT SCOPE NOTE: Local Notes is a fully local, serverless app — there
 * is no backend to send Web Push while the app is closed. What this module
 * provides is "foreground reminders": due/overdue notes are checked (and a
 * browser Notification shown) whenever the app is open, becomes visible
 * again, or periodically while a tab stays open. That is a real and useful
 * reminder, but it is not a background push notification system.
 */
(function () {
    'use strict';

    const ENABLED_KEY = 'ln_notifications_enabled';
    const NOTIFIED_KEY = 'ln_notified_due_v1';
    const CHECK_INTERVAL_MS = 15 * 60 * 1000; // re-check every 15 min while the tab is open

    function t(key, fallback) {
        if (typeof window.t === 'function') {
            const v = window.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    function injectStyles() {
        if (document.getElementById('ln-notif-style')) return;
        const css =
            '.ln-notif-ov{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;' +
                'padding:16px;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);}' +
            '.ln-notif-box{width:min(420px,100%);background:var(--modal-bg,#1a1a1a);border:1px solid var(--border-color,#272727);' +
                'border-radius:14px;box-shadow:0 16px 64px rgba(0,0,0,.45);overflow:hidden;}' +
            '.ln-notif-hd{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border-color,#272727);' +
                'font-weight:700;color:var(--text-color,#e0e0e0);}' +
            '.ln-notif-hd i{color:var(--primary-color,#28a745);font-size:16px;}' +
            '.ln-notif-hd span{flex:1;}' +
            '.ln-notif-close{background:transparent;border:0;color:var(--text-secondary,#999);cursor:pointer;font-size:15px;padding:4px;}' +
            '.ln-notif-close:hover{color:var(--text-color,#e0e0e0);}' +
            '.ln-notif-body{padding:16px;display:flex;flex-direction:column;gap:12px;}' +
            '.ln-notif-hint{margin:0;font-size:12.5px;line-height:1.5;color:var(--text-secondary,#999);}' +
            '.ln-notif-warn{margin:0;padding:9px 11px;border-radius:8px;font-size:12.5px;' +
                'background:rgba(220,53,69,.1);border:1px solid rgba(220,53,69,.3);color:#dc3545;}' +
            '.ln-notif-toggle{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;color:var(--text-color,#e0e0e0);}' +
            '.ln-notif-toggle input{width:18px;height:18px;accent-color:var(--primary-color,#28a745);cursor:pointer;}' +
            '.ln-notif-active{border-color:var(--primary-color,#aefc6e)!important;color:var(--primary-color,#aefc6e)!important;}';
        const style = document.createElement('style');
        style.id = 'ln-notif-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function todayKey() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function loadNotifiedMap() {
        try {
            const raw = localStorage.getItem(NOTIFIED_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    function alreadyNotifiedToday(noteId) {
        const data = loadNotifiedMap();
        const list = data[todayKey()];
        return Array.isArray(list) && list.includes(noteId);
    }

    function markNotified(noteId) {
        try {
            const data = loadNotifiedMap();
            const key = todayKey();
            if (!data[key]) data[key] = [];
            if (!data[key].includes(noteId)) data[key].push(noteId);
            // Keep only the last few days so this never grows unbounded
            const keys = Object.keys(data).sort();
            while (keys.length > 3) { delete data[keys.shift()]; }
            localStorage.setItem(NOTIFIED_KEY, JSON.stringify(data));
        } catch (e) { /* storage unavailable — reminders just won't dedupe today, harmless */ }
    }

    function isSupported() { return 'Notification' in window; }
    function isEnabled() { return isSupported() && localStorage.getItem(ENABLED_KEY) === '1'; }
    function setEnabled(v) { try { localStorage.setItem(ENABLED_KEY, v ? '1' : '0'); } catch (e) {} }
    function permission() { return isSupported() ? Notification.permission : 'unsupported'; }

    async function requestPermission() {
        if (!isSupported()) return 'unsupported';
        if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission;
        try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
    }

    function showNoteNotification(note, overdue) {
        if (!isSupported() || Notification.permission !== 'granted') return;
        try {
            const title = note.title || t('cpUntitled', 'Untitled note');
            const body = overdue
                ? t('notifOverdueBody', 'This note is overdue')
                : t('notifDueTodayBody', 'Due today');
            const n = new Notification(title, { body, tag: 'ln-due-' + note.id, icon: '/favicon/android-chrome-192x192.png' });
            n.onclick = () => {
                window.focus();
                if (typeof window.openModal === 'function') window.openModal(note.id, note.content, note.creationTime);
                n.close();
            };
        } catch (e) { /* some platforms throw if the page isn't allowed to construct Notification directly — ignore */ }
    }

    async function checkDueNotes() {
        if (!isEnabled() || !isSupported() || Notification.permission !== 'granted') return;
        if (!window.notesDB || typeof window.notesDB.getAllNotes !== 'function') return;
        try {
            const notes = await window.notesDB.getAllNotes();
            notes.forEach(note => {
                if (!note.dueDate || alreadyNotifiedToday(note.id)) return;
                const overdue = typeof window.isOverdue === 'function' && window.isOverdue(note.dueDate);
                const dueToday = typeof window.isDueToday === 'function' && window.isDueToday(note.dueDate);
                if (overdue || dueToday) {
                    showNoteNotification(note, overdue);
                    markNotified(note.id);
                }
            });
        } catch (e) { /* never let a reminder check break the app */ }
    }

    // ── Settings panel ──────────────────────────────────────────────────
    function openSettings() {
        document.getElementById('ln-notif-settings-modal')?.remove();
        injectStyles();

        const overlay = document.createElement('div');
        overlay.id = 'ln-notif-settings-modal';
        overlay.className = 'ln-notif-ov';

        const render = () => {
            const supported = isSupported();
            const perm = permission();
            const enabled = isEnabled();
            overlay.innerHTML = `
                <div class="ln-notif-box" role="dialog" aria-modal="true">
                    <div class="ln-notif-hd">
                        <i class="bi bi-bell"></i>
                        <span>${t('notifSettingsTitle', 'Reminders')}</span>
                        <button type="button" class="ln-notif-close" aria-label="Close"><i class="bi bi-x-lg"></i></button>
                    </div>
                    <div class="ln-notif-body">
                        <p class="ln-notif-hint">${t('notifScopeHint', 'Local Notes has no server, so reminders only fire while this app is open (on load, when you switch back to the tab, and every 15 minutes) — not as background push notifications when the app is fully closed.')}</p>
                        ${!supported ? `
                            <p class="ln-notif-warn">${t('notifUnsupported', 'Notifications are not supported in this browser.')}</p>
                        ` : perm === 'denied' ? `
                            <p class="ln-notif-warn">${t('notifBlocked', 'Notifications are blocked for this site in your browser settings.')}</p>
                        ` : `
                            <label class="ln-notif-toggle">
                                <input type="checkbox" id="ln-notif-toggle-input" ${enabled ? 'checked' : ''}>
                                <span>${t('notifEnable', 'Remind me about due and overdue notes')}</span>
                            </label>
                        `}
                    </div>
                </div>`;

            overlay.querySelector('.ln-notif-close').addEventListener('click', close);
            overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); }, { once: true });

            const toggleInput = overlay.querySelector('#ln-notif-toggle-input');
            if (toggleInput) {
                toggleInput.addEventListener('change', async () => {
                    if (toggleInput.checked) {
                        const result = await requestPermission();
                        if (result !== 'granted') { toggleInput.checked = false; render(); return; }
                        setEnabled(true);
                        checkDueNotes();
                    } else {
                        setEnabled(false);
                    }
                    render();
                });
            }
        };

        const close = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
        const onEsc = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onEsc);

        render();
        document.body.appendChild(overlay);
    }

    // Check on load (after a short delay so notesDB/date-utils are ready),
    // whenever the tab becomes visible again, and periodically while open.
    setTimeout(checkDueNotes, 3000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkDueNotes(); });
    setInterval(checkDueNotes, CHECK_INTERVAL_MS);

    window.LNNotifications = { isSupported, isEnabled, setEnabled, permission, requestPermission, checkDueNotes, openSettings };
})();
