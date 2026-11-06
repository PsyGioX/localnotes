/*
 * Local Notes — a local-first, privacy-focused notes app (PWA): rich-text/Markdown editor,
 * AES-256-GCM encrypted storage in the browser, offline mode, 12 languages. No server-side data.
 *
 * Copyright (c) 2026 PsyGioX. Licensed under the MIT License.
 * Source: https://github.com/PsyGioX/localnotes — Site: https://localnotes-three.vercel.app
 */
/**
 * Editor Pro — four additions to LocalNotesEditor (loaded before editor-integration.js):
 *   1. Voice dictation      — Web Speech API, live caption, works in the note's language
 *   2. Draft recovery       — encrypted autosave of unsaved edits, restore after crash/refresh
 *   3. Writing sprint       — timed focus session with a words-written counter
 *   4. Smart paste          — URL → link, "[ ] task" lines → checklist, "- item" lines → list
 * Plus: on-screen-keyboard aware layout for the full-page editor on phones.
 */
(function () {
    'use strict';
    if (typeof LocalNotesEditor === 'undefined' || LocalNotesEditor.prototype._proInstalled) return;
    var P = LocalNotesEditor.prototype;
    P._proInstalled = true;

    var CMD = LocalNotesEditor.extCommands = LocalNotesEditor.extCommands || {};
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var LANG_TAGS = { en: 'en-US', ru: 'ru-RU', ua: 'uk-UA', bg: 'bg-BG', bs: 'bs-BA', cs: 'cs-CZ', hr: 'hr-HR', mk: 'mk-MK', pl: 'pl-PL', sk: 'sk-SK', sl: 'sl-SI', sr: 'sr-RS' };
    var DRAFT_DELAY = 1500;

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function tr(ed, key, fb, params) {
        var v = null;
        try { if (typeof window.t === 'function') { v = window.t(key, params); if (v === key) v = null; } } catch (e) { v = null; }
        if (v == null) {
            v = fb;
            if (params) Object.keys(params).forEach(function (k) { v = v.replace('{' + k + '}', params[k]); });
        }
        return v;
    }
    function words(text) {
        text = String(text || '').replace(/\u200B/g, '').trim();
        return text ? text.split(/\s+/).length : 0;
    }
    function toast(msg, type) {
        if (typeof window.showCustomAlert === 'function') { try { window.showCustomAlert('', msg, type || 'success'); return; } catch (e) { /* fall through */ } }
        var d = document.createElement('div');
        d.className = 'lne-ox-toast'; d.textContent = msg; document.body.appendChild(d);
        setTimeout(function () { d.classList.add('out'); setTimeout(function () { d.remove(); }, 400); }, 2600);
    }

    // ═════════════ init hook ═════════════
    var origInit = P.init;
    P.init = function () {
        origInit.apply(this, arguments);
        try { this._proInit(); } catch (e) { console.error('[editor-pro] init failed', e); }
    };

    P._proInit = function () {
        var self = this;
        var wrap = this.container.querySelector('.lne-wrapper');
        if (!wrap) return;
        wrap.style.position = wrap.style.position || 'relative';

        // — toolbar group (Home tab) —
        var home = this.toolbar && this.toolbar.querySelector('.lne-panel[data-tab="home"]');
        var dictTip = tr(this, 'proDictateTip', 'Voice dictation');
        var sprintTip = tr(this, 'proSprintTip', 'Writing sprint');
        if (home) {
            var btn = function (cmd, icon, tip, label) {
                return '<button class="lne-btn lne-btn-lg" data-cmd="' + cmd + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '"><i class="' + icon + '"></i><span class="lne-lg-label">' + esc(label) + '</span></button>';
            };
            home.insertAdjacentHTML('beforeend',
                '<div class="lne-grp"><div class="lne-grp-body"><div class="lne-line">' +
                (SR ? btn('proDictate', 'bi bi-mic', dictTip, tr(this, 'proDictate', 'Dictate')) : '') +
                btn('proSprint', 'bi bi-stopwatch', sprintTip, tr(this, 'proSprint', 'Sprint')) +
                '</div></div><div class="lne-grp-label">' + esc(tr(this, 'proGroup', 'Write')) + '</div></div>');
            home.querySelectorAll('.lne-btn[data-cmd^="pro"]').forEach(function (b) {
                b.addEventListener('mousedown', function (e) { e.preventDefault(); self._saveRange(); });
                b.addEventListener('click', function (e) { e.preventDefault(); self._exec(b.dataset.cmd, b); });
            });
        }

        // — floating mic for touch devices —
        if (SR) {
            var fab = document.createElement('button');
            fab.type = 'button'; fab.className = 'lne-pro-fab lne-pro-fab-on';
            fab.innerHTML = '<i class="bi bi-mic-fill"></i>';
            fab.setAttribute('aria-label', dictTip); fab.title = dictTip;
            fab.addEventListener('mousedown', function (e) { e.preventDefault(); });
            fab.addEventListener('click', function () { self._proToggleDictation(); });
            wrap.appendChild(fab);
            this._proFab = fab;
        }

        // — live caption —
        var live = document.createElement('div');
        live.className = 'lne-pro-live'; live.hidden = true; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
        live.innerHTML = '<span class="lne-pro-dot"></span><span class="lne-pro-live-text"></span><button type="button" aria-label="' + esc(tr(this, 'proDictateStop', 'Stop dictation')) + '"><i class="bi bi-stop-fill"></i></button>';
        live.querySelector('button').addEventListener('click', function () { self._proStopDictation(); });
        wrap.appendChild(live);
        this._proLive = live;

        // — sprint chip in the status bar —
        if (this.statusbar) {
            var chip = document.createElement('button');
            chip.type = 'button'; chip.className = 'lne-pro-sprint';
            chip.title = sprintTip;
            chip.innerHTML = '<i class="bi bi-stopwatch"></i><span class="lne-pro-sprint-txt">' + esc(tr(this, 'proSprint', 'Sprint')) + '</span><span class="lne-pro-bar"><i></i></span>';
            chip.addEventListener('click', function () { self._proSprintMenu(chip); });
            var zoom = this.statusbar.querySelector('.lne-zoom');
            if (zoom) this.statusbar.insertBefore(chip, zoom); else this.statusbar.appendChild(chip);
            this._proChip = chip;
        }

        // — draft banner —
        var banner = document.createElement('div');
        banner.className = 'lne-pro-draft'; banner.hidden = true; banner.setAttribute('role', 'alert');
        banner.innerHTML = '<span></span><button type="button" class="lne-pro-restore"></button><button type="button" class="lne-pro-discard"></button>';
        wrap.appendChild(banner);
        this._proBanner = banner;

        // — autosave draft on input —
        this.ed.addEventListener('input', function () { self._proScheduleDraft(); });
        this.ed.addEventListener('blur', function () { self._proSaveDraft(); });
        document.addEventListener('visibilitychange', function () { if (document.hidden) self._proSaveDraft(); });
        window.addEventListener('pagehide', function () { self._proSaveDraft(); });

        // — watch the edit modal open/close —
        this._proWatchModal();
    };

    // ═════════════ 1. DICTATION ═════════════
    CMD.proDictate = function () { this._proToggleDictation(); };

    P._proToggleDictation = function () { if (this._proDictating) this._proStopDictation(); else this._proStartDictation(); };

    P._proSetDictUi = function (on) {
        var b = this.toolbar && this.toolbar.querySelector('[data-cmd="proDictate"]');
        if (b) b.classList.toggle('lne-pro-active', on);
        if (this._proFab) this._proFab.classList.toggle('active', on);
        if (this._proLive) {
            this._proLive.hidden = !on;
            var t = this._proLive.querySelector('.lne-pro-live-text');
            if (t) t.textContent = on ? tr(this, 'proDictateListening', 'Listening…') : '';
        }
    };

    P._proStartDictation = function () {
        var self = this;
        if (!SR) { toast(tr(this, 'proDictateUnsupported', "Voice dictation isn't supported in this browser"), 'error'); return; }
        if (this._proDictating) return;
        var rec = new SR();
        rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
        rec.lang = LANG_TAGS[window.currentLang] || (window.LNLang && window.LNLang.htmlLang ? window.LNLang.htmlLang(window.currentLang) : 'en-US');
        this._proDictating = true; this._proRec = rec;
        this._proSetDictUi(true);

        rec.onresult = function (e) {
            var finalText = '', interim = '';
            for (var i = e.resultIndex; i < e.results.length; i++) {
                var r = e.results[i];
                if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
            }
            if (finalText) self._proInsertSpeech(finalText);
            var t = self._proLive && self._proLive.querySelector('.lne-pro-live-text');
            if (t) t.textContent = interim || tr(self, 'proDictateListening', 'Listening…');
        };
        rec.onerror = function (e) {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                self._proDictating = false;
                toast(tr(self, 'proDictateDenied', 'Microphone access was denied'), 'error');
            }
        };
        rec.onend = function () {
            // Browsers end continuous sessions after silence — restart while the user wants it on.
            if (self._proDictating && self._proRec === rec) {
                try { rec.start(); return; } catch (err) { self._proDictating = false; }
            }
            self._proSetDictUi(false);
        };
        try { rec.start(); } catch (err) { this._proDictating = false; this._proSetDictUi(false); }
    };

    P._proStopDictation = function () {
        this._proDictating = false;
        var rec = this._proRec; this._proRec = null;
        if (rec) { try { rec.stop(); } catch (e) { /* already stopped */ } }
        this._proSetDictUi(false);
    };

    P._proInsertSpeech = function (raw) {
        var text = String(raw || '').trim();
        if (!text) return;
        var lowered = text.toLowerCase().replace(/[.,!?]/g, '');
        var NEWLINE = ['new line', 'newline', 'новая строка', 'нова линия', 'новий рядок', 'nový řádek', 'nowa linia', 'novi red', 'nový riadok', 'nova vrstica'];
        var PARA = ['new paragraph', 'новый абзац', 'новий абзац', 'nový odstavec', 'nowy akapit', 'novi odlomak', 'nov odstavec'];
        this.ed.focus();
        var sel = window.getSelection();
        if (!sel.rangeCount || !this.ed.contains(sel.anchorNode)) {
            if (this._range && this.ed.contains(this._range.startContainer)) this._restoreRange();
            else { var r = document.createRange(); r.selectNodeContents(this.ed); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
        }
        this._saveSnap();
        if (NEWLINE.indexOf(lowered) !== -1) { document.execCommand('insertLineBreak'); this._syncState(); return; }
        if (PARA.indexOf(lowered) !== -1) { document.execCommand('insertParagraph'); this._syncState(); return; }

        // spacing + sentence-case based on what precedes the caret
        var prev = '';
        try {
            var rg = sel.getRangeAt(0), pre = document.createRange();
            pre.selectNodeContents(this.ed); pre.setEnd(rg.startContainer, rg.startOffset);
            prev = pre.toString().replace(/\u200B/g, '');
        } catch (e) { /* ignore */ }
        var atStart = !prev.trim() || /[.!?…]\s*$/.test(prev) || /\n\s*$/.test(prev);
        if (atStart) text = text.charAt(0).toUpperCase() + text.slice(1);
        if (prev && !/\s$/.test(prev)) text = ' ' + text;
        document.execCommand('insertText', false, text);
        this._saveRange();
        this._syncState();
    };

    // ═════════════ 3. WRITING SPRINT ═════════════
    CMD.proSprint = function (btn) { this._proSprintMenu(this._proChip || btn); };

    P._proCurrentWords = function () { return words(this.ed.innerText); };

    P._proSprintMenu = function (anchor) {
        var self = this;
        this._proClosePop();
        var pop = document.createElement('div');
        pop.className = 'lne-pro-pop'; pop.setAttribute('role', 'menu');
        var items = this._proSprintState
            ? [{ k: 'stop', label: tr(this, 'proSprintStop', 'Stop sprint'), cls: 'danger' }]
            : [10, 15, 25, 45].map(function (m) { return { k: m, label: tr(self, 'proSprintMin', '{n} min', { n: m }) }; });
        items.forEach(function (it) {
            var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem');
            b.textContent = it.label; if (it.cls) b.className = it.cls;
            b.addEventListener('click', function () {
                self._proClosePop();
                if (it.k === 'stop') self._proSprintEnd(true); else self._proSprintStart(it.k);
            });
            pop.appendChild(b);
        });
        document.body.appendChild(pop);
        var r = anchor.getBoundingClientRect(), pr = pop.getBoundingClientRect();
        var left = Math.min(Math.max(8, r.left), window.innerWidth - pr.width - 8);
        var top = r.top - pr.height - 8; if (top < 8) top = r.bottom + 8;
        pop.style.left = left + 'px'; pop.style.top = top + 'px';
        var first = pop.querySelector('button'); if (first) first.focus();
        this._proPop = pop;
        this._proPopOff = function (e) {
            if (e.type === 'keydown' && e.key !== 'Escape') return;
            if (e.type !== 'keydown' && pop.contains(e.target)) return;
            self._proClosePop();
        };
        setTimeout(function () {
            document.addEventListener('mousedown', self._proPopOff, true);
            document.addEventListener('touchstart', self._proPopOff, true);
            document.addEventListener('keydown', self._proPopOff, true);
        }, 0);
    };

    P._proClosePop = function () {
        if (this._proPop) { this._proPop.remove(); this._proPop = null; }
        if (this._proPopOff) {
            document.removeEventListener('mousedown', this._proPopOff, true);
            document.removeEventListener('touchstart', this._proPopOff, true);
            document.removeEventListener('keydown', this._proPopOff, true);
            this._proPopOff = null;
        }
    };

    P._proSprintStart = function (minutes) {
        var self = this;
        this._proSprintEnd(false);
        this._proSprintState = { start: Date.now(), total: minutes * 60000, base: this._proCurrentWords(), minutes: minutes };
        if (this._proChip) this._proChip.classList.add('running');
        this._proSprintTick();
        this._proSprintTimer = setInterval(function () { self._proSprintTick(); }, 1000);
        if (this.ed) this.ed.focus();
    };

    P._proSprintTick = function () {
        var s = this._proSprintState; if (!s) return;
        var left = Math.max(0, s.total - (Date.now() - s.start));
        var mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
        var delta = this._proCurrentWords() - s.base;
        var txt = this._proChip && this._proChip.querySelector('.lne-pro-sprint-txt');
        if (txt) txt.textContent = (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss + ' · ' + (delta > 0 ? '+' : '') + delta;
        var bar = this._proChip && this._proChip.querySelector('.lne-pro-bar i');
        if (bar) bar.style.width = Math.min(100, (1 - left / s.total) * 100) + '%';
        if (left <= 0) this._proSprintEnd(true, true);
    };

    P._proSprintEnd = function (announce, completed) {
        var s = this._proSprintState;
        if (this._proSprintTimer) { clearInterval(this._proSprintTimer); this._proSprintTimer = null; }
        this._proSprintState = null;
        if (this._proChip) {
            this._proChip.classList.remove('running');
            var txt = this._proChip.querySelector('.lne-pro-sprint-txt'); if (txt) txt.textContent = tr(this, 'proSprint', 'Sprint');
        }
        if (s && announce) {
            var elapsed = Math.max(1, Math.round((Date.now() - s.start) / 60000));
            var delta = Math.max(0, this._proCurrentWords() - s.base);
            if (completed || delta > 0) toast(tr(this, 'proSprintDone', 'Sprint complete: {words} words in {min} min', { words: delta, min: elapsed }));
        }
    };

    // ═════════════ 2. DRAFT RECOVERY ═════════════
    function draftKey() {
        var id = typeof window.getCurrentNoteId === 'function' ? window.getCurrentNoteId() : null;
        return 'lnDraft:' + (id || 'new');
    }
    function modalOpen() { var m = document.getElementById('editModal'); return !!m && m.style.display !== 'none' && m.style.display !== ''; }
    function inMarkdown() { return typeof window.isLNMarkdownMode === 'function' && window.isLNMarkdownMode(); }

    P._proScheduleDraft = function () {
        var self = this;
        if (!this._proTracking) return;
        clearTimeout(this._proDraftTimer);
        this._proDraftTimer = setTimeout(function () { self._proSaveDraft(); }, DRAFT_DELAY);
    };

    P._proSaveDraft = function () {
        clearTimeout(this._proDraftTimer);
        if (!this._proTracking || !modalOpen() || inMarkdown() || !window.notesDB || !window.notesDB.saveEncryptedSetting) return;
        var html;
        try { html = this.getContent(); } catch (e) { return; }
        if (html === this._proBaseline) return;
        if (!this._proTextOf(html).trim() && !/<img|cl-item/i.test(html)) return;
        var key = this._proKey;
        window.notesDB.saveEncryptedSetting(key, { html: html, ts: Date.now() }).catch(function () { /* drafts are best-effort */ });
    };

    P._proTextOf = function (html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; };

    P._proClearDraft = function (key) {
        if (!key || !window.notesDB || !window.notesDB.saveSetting) return;
        try { window.notesDB.saveSetting(key, null).catch(function () {}); } catch (e) { /* ignore */ }
    };

    P._proSessionStart = function () {
        var self = this;
        this._proTracking = false;
        this._proKey = draftKey();
        // the editor is filled asynchronously by openModal(); wait for it to settle
        setTimeout(function () {
            if (!modalOpen()) return;
            self._proKey = draftKey();
            try { self._proBaseline = self.getContent(); } catch (e) { self._proBaseline = ''; }
            self._proTracking = true;
            self._proCheckDraft();
        }, 900);
    };

    P._proCheckDraft = function () {
        var self = this, key = this._proKey;
        if (!window.notesDB || !window.notesDB.getEncryptedSetting) return;
        window.notesDB.getEncryptedSetting(key).then(function (d) {
            if (!d || !d.html || key !== self._proKey || !modalOpen()) return;
            if (d.html === self._proBaseline) { self._proClearDraft(key); return; }
            var time = '';
            try { time = new Date(d.ts).toLocaleString(window.LNLang && window.LNLang.htmlLang ? window.LNLang.htmlLang(window.currentLang) : undefined, { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { time = new Date(d.ts).toLocaleString(); }
            var b = self._proBanner;
            b.querySelector('span').textContent = tr(self, 'proDraftFound', 'Unsaved draft from {time} found', { time: time });
            var rb = b.querySelector('.lne-pro-restore'), db = b.querySelector('.lne-pro-discard');
            rb.textContent = tr(self, 'proDraftRestore', 'Restore'); db.textContent = tr(self, 'proDraftDiscard', 'Discard');
            rb.onclick = function () {
                b.hidden = true;
                self._saveSnap();
                self.setContent(d.html);
                self._syncState();
                self._saveSnap();
                self.ed.dispatchEvent(new Event('input', { bubbles: true })); // refresh the "unsaved changes" indicator
            };
            db.onclick = function () { b.hidden = true; self._proClearDraft(key); };
            b.hidden = false;
        }).catch(function () { /* ignore */ });
    };

    P._proSessionEnd = function () {
        this._proStopDictation();
        this._proSprintEnd(false);
        this._proClosePop();
        clearTimeout(this._proDraftTimer);
        this._proTracking = false;
        if (this._proBanner) this._proBanner.hidden = true;
        // The modal only closes on a deliberate save/cancel (a crash or refresh never gets here),
        // so the draft is no longer needed.
        this._proClearDraft(this._proKey);
    };

    P._proWatchModal = function () {
        var self = this, modal = document.getElementById('editModal');
        if (!modal || typeof MutationObserver === 'undefined') return;
        var wasOpen = false;
        new MutationObserver(function () {
            var open = modalOpen();
            if (open === wasOpen) return;
            wasOpen = open;
            if (open) { self._proSessionStart(); self._proKeyboardOn(modal); }
            else { self._proSessionEnd(); self._proKeyboardOff(modal); }
        }).observe(modal, { attributes: true, attributeFilter: ['style'] });
    };

    // ═════════════ mobile keyboard-aware viewport ═════════════
    P._proKeyboardOn = function (modal) {
        var vv = window.visualViewport;
        if (!vv || !window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;
        var root = document.documentElement;
        var apply = function () {
            root.style.setProperty('--lne-vvh', Math.round(vv.height) + 'px');
            root.style.setProperty('--lne-vvt', Math.round(vv.offsetTop) + 'px');
            modal.classList.toggle('lne-kb-open', window.innerHeight - vv.height > 140);
        };
        this._proVvApply = apply;
        vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply);
        apply();
    };
    P._proKeyboardOff = function (modal) {
        var vv = window.visualViewport, root = document.documentElement;
        if (vv && this._proVvApply) { vv.removeEventListener('resize', this._proVvApply); vv.removeEventListener('scroll', this._proVvApply); }
        this._proVvApply = null;
        root.style.removeProperty('--lne-vvh'); root.style.removeProperty('--lne-vvt');
        modal.classList.remove('lne-kb-open');
    };

    // ═════════════ 4. SMART PASTE ═════════════
    var URL_RE = /^(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+\.[a-z]{2,}[^\s<>"]*)$/i;
    var TASK_RE = /^\s*(?:[-*•]\s*)?\[( |x|X)?\]\s+(.*\S)\s*$/;
    var BULLET_RE = /^\s*[-*•]\s+(.*\S)\s*$/;
    var NUM_RE = /^\s*\d{1,3}[.)]\s+(.*\S)\s*$/;

    var origPaste = P._onPaste;
    P._onPaste = function (e) {
        try { if (this._proSmartPaste(e)) return; } catch (err) { console.warn('[editor-pro] smart paste skipped', err); }
        return origPaste.call(this, e);
    };

    P._proSmartPaste = function (e) {
        var cd = e.clipboardData; if (!cd) return false;
        var text = (cd.getData('text/plain') || '').replace(/\r\n?/g, '\n');
        var trimmed = text.trim();
        if (!trimmed) return false;
        var html = cd.getData('text/html');
        var sel = window.getSelection();
        var lines = trimmed.split('\n').filter(function (l) { return l.trim(); });

        // a) single URL
        if (lines.length === 1 && URL_RE.test(trimmed)) {
            var url = /^www\./i.test(trimmed) ? 'https://' + trimmed : trimmed, u;
            try { u = new URL(url); } catch (err) { return false; }
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
            e.preventDefault(); this._saveSnap();
            var hasSel = sel && sel.rangeCount && !sel.isCollapsed && this.ed.contains(sel.anchorNode);
            if (hasSel) {
                document.execCommand('createLink', false, u.href);
            } else {
                var label = u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : '');
                if (label.length > 48) label = label.slice(0, 47) + '…';
                document.execCommand('insertHTML', false, '<a href="' + esc(u.href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>&nbsp;');
            }
            this._syncState(); this._saveSnap();
            return true;
        }
        if (lines.length < 2) return false;

        // b) every line is "[ ] task" / "- [x] task" → checklist items
        if (lines.every(function (l) { return TASK_RE.test(l); }) && typeof this._makeChecklistItem === 'function') {
            e.preventDefault(); this._saveSnap();
            this._restoreRange();
            var s2 = window.getSelection(), range = s2 && s2.rangeCount ? s2.getRangeAt(0) : null;
            var ed = this.ed, self = this;
            if (range && !ed.contains(range.startContainer)) range = null;
            if (range) range.deleteContents();
            var last = null;
            lines.forEach(function (l) {
                var m = TASK_RE.exec(l);
                var item = self._makeChecklistItem(m[2], { checked: m[1] === 'x' || m[1] === 'X' });
                if (range) { range.insertNode(item); range.setStartAfter(item); range.collapse(true); }
                else ed.appendChild(item);
                last = item;
            });
            if (range && last) { s2.removeAllRanges(); s2.addRange(range); }
            this._syncState(); this._saveSnap();
            return true;
        }

        // c) plain-text bullet / numbered list (only when the clipboard has no rich HTML of its own)
        if (!html) {
            var tag = null, rx = null;
            if (lines.every(function (l) { return BULLET_RE.test(l); })) { tag = 'ul'; rx = BULLET_RE; }
            else if (lines.every(function (l) { return NUM_RE.test(l); })) { tag = 'ol'; rx = NUM_RE; }
            if (tag) {
                e.preventDefault(); this._saveSnap();
                document.execCommand('insertHTML', false, '<' + tag + '>' + lines.map(function (l) { return '<li>' + esc(rx.exec(l)[1]) + '</li>'; }).join('') + '</' + tag + '>');
                this._syncState(); this._saveSnap();
                return true;
            }
        }
        return false;
    };

    // stop background work if an editor instance is torn down
    if (typeof P.destroy === 'function') {
        var origDestroy = P.destroy;
        P.destroy = function () { try { this._proSessionEnd(); } catch (e) { /* ignore */ } return origDestroy.apply(this, arguments); };
    }
})();
