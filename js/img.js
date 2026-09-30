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
// Image load/error handlers
function handleImageLoad(img) {
    img.classList.add('loaded');
    img.classList.remove('error');
}

function handleImageError(img) {
    // cid: placeholders are resolved to object URLs a moment later (see resolver below)
    if (String(img.getAttribute('src') || '').startsWith('cid:ln-')) return;
    img.classList.add('error');
    img.classList.remove('loaded');
    console.warn('Failed to load image:', img.src);
}

function initializeImageHandlers() {
    document.querySelectorAll('.note img').forEach(img => {
        if (!img.hasAttribute('data-handlers-added')) {
            img.addEventListener('load', () => handleImageLoad(img));
            img.addEventListener('error', () => handleImageError(img));
            img.setAttribute('data-handlers-added', 'true');
            if (img.complete && img.naturalHeight !== 0) handleImageLoad(img);
            else if (img.complete && img.naturalHeight === 0) handleImageError(img);
        }
    });
}

// ── Image viewer (gallery / zoom / pan / pinch / rotate / download) ─────────
// One viewer for every image in a note (photos, pictures, drawings):
//  · gallery: prev/next buttons, ←/→, swipe, thumbnails, counter
//  · zoom: wheel, pinch, double tap/click, +/-/0/1, buttons; pan by dragging
//  · rotate, fullscreen, download, swipe up/down to close on touch screens
//  · tap on an image toggles the controls, tap on the backdrop closes

function openImageViewer(items, startIndex) {
    if (!items || !items.length || document.querySelector('.ln-dv')) return;

    const tr = (k, fb) => {
        if (typeof t !== 'function') return fb;
        const v = t(k);
        return (typeof v === 'string' && v !== k) ? v : fb;
    };
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const opener = document.activeElement;
    const many = items.length > 1;
    let idx = Math.max(0, Math.min(items.length - 1, startIndex | 0));

    const fsRoot = (el) => el.requestFullscreen || el.webkitRequestFullscreen;
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;

    const btn = (cls, icon, label, extra) =>
        `<button type="button" class="ln-dv-btn ${cls}${extra ? ' ' + extra : ''}" title="${esc(label)}" aria-label="${esc(label)}"><i class="bi ${icon}"></i></button>`;

    const overlay = document.createElement('div');
    overlay.className = 'ln-dv is-loading';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', tr('viewerImage', 'Image'));
    overlay.innerHTML =
        '<div class="ln-dv-stage"><img class="ln-dv-img" alt="" draggable="false"></div>' +
        '<div class="ln-dv-spin" aria-hidden="true"></div>' +
        `<div class="ln-dv-err"><i class="bi bi-exclamation-triangle"></i><span>${esc(tr('viewerFailed', 'Could not load the image'))}</span></div>` +
        '<div class="ln-dv-bar">' +
            '<div class="ln-dv-side">' +
                (many ? '<div class="ln-dv-group"><span class="ln-dv-count" aria-live="polite"></span></div>' : '') +
                '<div class="ln-dv-group ln-dv-hide-sm">' +
                    btn('ln-dv-out', 'bi-zoom-out', tr('viewerZoomOut', 'Zoom out')) +
                    '<span class="ln-dv-pct" aria-live="polite">100%</span>' +
                    btn('ln-dv-in', 'bi-zoom-in', tr('viewerZoomIn', 'Zoom in')) +
                '</div>' +
            '</div>' +
            '<div class="ln-dv-side">' +
                '<div class="ln-dv-group">' +
                    btn('ln-dv-fit', 'bi-arrows-angle-contract', tr('viewerFit', 'Fit to screen')) +
                    btn('ln-dv-100', 'bi-aspect-ratio', tr('viewerActualSize', 'Actual size (100%)'), 'ln-dv-hide-sm') +
                    btn('ln-dv-rot', 'bi-arrow-clockwise', tr('viewerRotate', 'Rotate')) +
                '</div>' +
                '<div class="ln-dv-group">' +
                    (fsRoot(overlay) ? btn('ln-dv-fs', 'bi-fullscreen', tr('viewerFullscreen', 'Fullscreen'), 'ln-dv-hide-sm') : '') +
                    btn('ln-dv-dl', 'bi-download', tr('viewerDownload', 'Download')) +
                    btn('ln-dv-x', 'bi-x-lg', tr('close', 'Close')) +
                '</div>' +
            '</div>' +
        '</div>' +
        (many ? btn('ln-dv-nav ln-dv-prev', 'bi-chevron-left', tr('viewerPrev', 'Previous image')) +
                btn('ln-dv-nav ln-dv-next', 'bi-chevron-right', tr('viewerNext', 'Next image')) : '') +
        '<div class="ln-dv-foot">' +
            '<div class="ln-dv-cap"></div>' +
            (many && items.length <= 30
                ? '<div class="ln-dv-thumbs" role="tablist">' + items.map((it, i) =>
                    `<button type="button" class="ln-dv-thumb" role="tab" data-i="${i}" aria-label="${i + 1} / ${items.length}"><img src="${esc(it.src)}" alt="" draggable="false" loading="lazy"></button>`
                  ).join('') + '</div>'
                : '') +
        '</div>';

    const $ = (sel) => overlay.querySelector(sel);
    const stage = $('.ln-dv-stage'), img = $('.ln-dv-img'), pct = $('.ln-dv-pct');
    const bar = $('.ln-dv-bar'), foot = $('.ln-dv-foot'), cap = $('.ln-dv-cap');
    const countEl = $('.ln-dv-count'), thumbs = $('.ln-dv-thumbs');
    const prevBtn = $('.ln-dv-prev'), nextBtn = $('.ln-dv-next'), fsBtn = $('.ln-dv-fs');

    const MAX_S = 10;
    let nw = 0, nh = 0, rotAcc = 0, fitS = 1, minS = 1, s = 1, tx = 0, ty = 0, dragX = 0, dragY = 0;
    let loaded = false, token = 0, animT = 0, tapTimer = 0, lastTap = 0, closed = false;

    // Rotated (bounding box) size of the image
    const rot = () => ((rotAcc % 360) + 360) % 360;
    const ew = () => (rot() % 180 ? nh : nw);
    const eh = () => (rot() % 180 ? nw : nh);
    // Area of the stage not covered by the top bar / footer
    const region = () => {
        const W = stage.clientWidth, H = stage.clientHeight;
        const top = bar.offsetHeight, bottom = foot.offsetHeight;
        return { W, H, top, vh: Math.max(50, H - top - bottom) };
    };
    const clampPan = () => {
        const { W, top, vh } = region();
        const iw = ew() * s, ih = eh() * s;
        tx = iw <= W ? (W - iw) / 2 : Math.min(0, Math.max(W - iw, tx));
        ty = ih <= vh ? top + (vh - ih) / 2 : Math.min(top, Math.max(top + vh - ih, ty));
    };
    const apply = (anim) => {
        clampPan();
        clearTimeout(animT);
        img.classList.toggle('is-anim', !!anim);
        if (anim) animT = setTimeout(() => img.classList.remove('is-anim'), 300);
        img.style.transform =
            `translate3d(${tx + dragX}px, ${ty + dragY}px, 0) scale(${s}) ` +
            `translate(${ew() / 2}px, ${eh() / 2}px) rotate(${rotAcc}deg) translate(${-nw / 2}px, ${-nh / 2}px)`;
        pct.textContent = Math.round(s * 100) + '%';
        overlay.classList.toggle('is-zoomed', s > fitS * 1.02);
    };
    const computeFit = () => {
        const { W, vh } = region();
        if (!nw || !nh) return 1;
        return Math.min(W / ew(), vh / eh(), 2);
    };
    const toFit = (anim) => {
        fitS = computeFit(); minS = Math.min(fitS, 1);
        s = fitS; tx = ty = 0; apply(anim);
    };
    const toActual = (anim) => { s = 1; tx = ty = 0; apply(anim); };
    // Zoom keeping the point (cx, cy) — in stage coordinates — under the finger/cursor
    const zoomAt = (ns, cx, cy, anim) => {
        ns = Math.max(minS, Math.min(MAX_S, ns));
        const k = ns / s;
        tx = cx - (cx - tx) * k;
        ty = cy - (cy - ty) * k;
        s = ns; apply(anim);
    };
    const zoomCenter = (f) => {
        const { W, top, vh } = region();
        zoomAt(s * f, W / 2, top + vh / 2, true);
    };
    const atFit = () => s <= fitS * 1.02;

    // ── File info helpers ──
    const mimeOf = (src) => {
        if (src.startsWith('blob:') && window.notesDB && window.notesDB.imageInfoForUrl) {
            const info = window.notesDB.imageInfoForUrl(src);
            if (info) return info.mime;
        }
        const m = /^data:([^;,]+)/.exec(src);
        if (m) return m[1].toLowerCase();
        const e = (/\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(src) || [])[1];
        return e ? ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp' }[e.toLowerCase()] || '') : '';
    };
    const extOf = (mime) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/bmp': 'bmp' }[mime] || 'png');
    const fmtBytes = (b) => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
    const sizeOf = (src) => {
        if (src.startsWith('blob:') && window.notesDB && window.notesDB.imageInfoForUrl) {
            const info = window.notesDB.imageInfoForUrl(src);
            if (info) return fmtBytes(info.size);
        }
        const m = /^data:[^,]*?(;base64)?,/.exec(src);
        if (!m) return '';
        const body = src.length - m[0].length;
        const bytes = m[1] ? Math.floor(body * 3 / 4) - (src.endsWith('==') ? 2 : src.endsWith('=') ? 1 : 0) : body;
        return fmtBytes(Math.max(0, bytes));
    };

    const updateMeta = () => {
        const it = items[idx];
        const parts = [];
        if (it.alt) parts.push(it.alt);
        if (loaded && nw) parts.push(nw + '×' + nh);
        const sz = sizeOf(it.src); if (sz) parts.push(sz);
        const mt = mimeOf(it.src); if (mt) parts.push(extOf(mt).toUpperCase());
        cap.textContent = parts.join(' · ');
        cap.style.display = parts.length ? '' : 'none';
        if (countEl) countEl.textContent = (idx + 1) + ' / ' + items.length;
        if (prevBtn) prevBtn.disabled = idx === 0;
        if (nextBtn) nextBtn.disabled = idx === items.length - 1;
        if (thumbs) {
            thumbs.querySelectorAll('.ln-dv-thumb').forEach((b, i) => {
                const on = i === idx;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
                if (on) {
                    const c = b.offsetLeft + b.offsetWidth / 2 - thumbs.clientWidth / 2;
                    thumbs.scrollTo ? thumbs.scrollTo({ left: c, behavior: 'smooth' }) : (thumbs.scrollLeft = c);
                }
            });
        }
        overlay.setAttribute('aria-label', it.alt || tr('viewerImage', 'Image'));
    };

    // ── Showing an image ──
    const show = (i, dir) => {
        idx = i;
        const it = items[idx], my = ++token;
        loaded = false; rotAcc = 0; dragX = dragY = 0;
        overlay.classList.add('is-loading');
        overlay.classList.remove('is-error');
        img.classList.remove('is-ready');
        img.classList.toggle('is-drawing', !!it.drawing);
        img.alt = it.alt || '';
        updateMeta();
        let handled = false;
        const done = () => {
            if (my !== token || handled) return;
            handled = true;
            nw = img.naturalWidth || 1200; nh = img.naturalHeight || 800;
            img.style.width = nw + 'px'; img.style.height = nh + 'px';
            loaded = true;
            overlay.classList.remove('is-loading');
            toFit(false);
            if (dir) {   // slide in from the side we navigated towards
                dragX = dir * Math.min(140, stage.clientWidth * 0.22);
                apply(false);
                requestAnimationFrame(() => requestAnimationFrame(() => { dragX = 0; apply(true); }));
            }
            img.classList.add('is-ready');
            updateMeta();
            // warm the cache for neighbours
            [idx - 1, idx + 1].forEach((n) => { if (items[n]) { const p = new Image(); p.src = items[n].src; } });
        };
        const fail = () => {
            if (my !== token || handled) return;
            handled = true;
            overlay.classList.remove('is-loading');
            overlay.classList.add('is-error');
        };
        img.onload = done; img.onerror = fail;
        img.src = it.src;
        if (img.complete && img.naturalWidth) done();
    };
    const go = (n, dir) => {
        if (n < 0 || n >= items.length || n === idx) return false;
        clearTimeout(tapTimer);
        show(n, dir || (n > idx ? 1 : -1));
        return true;
    };

    // ── Wheel / trackpad ──
    stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!loaded) return;
        const r = stage.getBoundingClientRect();
        const dy = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
        zoomAt(s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top, false);
    }, { passive: false });

    // ── Pointer gestures ──
    const pts = new Map();
    let g = null, lastDist = 0;
    const resetBg = () => overlay.style.removeProperty('--dv-a');
    const toggleChrome = () => overlay.classList.toggle('is-chrome-hidden');

    stage.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const now = performance.now();
        if (pts.size === 1) {
            g = { x0: e.clientX, y0: e.clientY, moved: 0, axis: null, onImg: e.target === img, type: e.pointerType, samples: [{ t: now, x: e.clientX, y: e.clientY }] };
        } else if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            lastDist = Math.hypot(a.x - b.x, a.y - b.y);
            if (g) { g.axis = 'pinch'; g.moved += 100; }
            dragX = dragY = 0; resetBg(); apply(false);
        }
        stage.classList.add('is-grabbing');
    });
    stage.addEventListener('pointermove', (e) => {
        const p = pts.get(e.pointerId);
        if (!p || !loaded) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (g) g.moved += Math.abs(dx) + Math.abs(dy);
        if (pts.size === 1 && g) {
            if (!atFit()) {
                tx += dx; ty += dy; apply(false);
            } else {
                const totX = e.clientX - g.x0, totY = e.clientY - g.y0;
                if (!g.axis && Math.hypot(totX, totY) > 8) g.axis = Math.abs(totX) > Math.abs(totY) ? 'x' : 'y';
                if (g.axis === 'x' && many) {
                    let d = totX;
                    if ((idx === 0 && d > 0) || (idx === items.length - 1 && d < 0)) d *= 0.3;   // rubber band at the ends
                    dragX = d; apply(false);
                } else if (g.axis === 'y' && g.type !== 'mouse') {
                    dragY = totY;
                    overlay.style.setProperty('--dv-a', String(Math.max(0.3, 0.94 - Math.abs(totY) / 380)));
                    apply(false);
                }
                g.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
                if (g.samples.length > 6) g.samples.shift();
            }
        } else if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (lastDist > 0) {
                const r = stage.getBoundingClientRect();
                zoomAt(s * (dist / lastDist), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, false);
            }
            lastDist = dist;
        }
    });
    let lastDbl = 0;
    const dblZoom = (e) => {
        lastDbl = Date.now();
        const r = stage.getBoundingClientRect();
        if (s > fitS * 1.05) toFit(true);
        else zoomAt(Math.max(fitS * 2.5, 1), e.clientX - r.left, e.clientY - r.top, true);
    };
    const endPointer = (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.delete(e.pointerId);
        if (pts.size < 2) lastDist = 0;
        if (pts.size > 0) return;
        stage.classList.remove('is-grabbing');
        const gg = g; g = null;
        if (!gg) return;
        if (e.type === 'pointercancel') { dragX = dragY = 0; resetBg(); apply(true); return; }
        const sm = gg.samples;
        let vx = 0, vy = 0;
        if (sm.length > 1) {
            const a = sm[0], b = sm[sm.length - 1], dt = Math.max(1, b.t - a.t);
            vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt;
        }
        if (gg.axis === 'pinch') { if (s < fitS) toFit(true); return; }
        if (gg.axis === 'x' && dragX) {
            const th = Math.min(90, stage.clientWidth * 0.18);
            if (Math.abs(dragX) > th || (Math.abs(vx) > 0.5 && Math.abs(dragX) > 24)) {
                if (go(idx + (dragX < 0 ? 1 : -1), dragX < 0 ? 1 : -1)) return;
            }
            dragX = 0; apply(true); return;
        }
        if (gg.axis === 'y' && dragY) {
            if (Math.abs(dragY) > 110 || (Math.abs(vy) > 0.6 && Math.abs(dragY) > 40)) { close(); return; }
            dragY = 0; resetBg(); apply(true); return;
        }
        if (gg.moved < 8) {
            if (!gg.onImg) { close(); return; }                         // tap on the backdrop
            const now = Date.now();
            if (now - lastTap < 320) {                                  // double tap / click
                clearTimeout(tapTimer); lastTap = 0; dblZoom(e);
            } else {
                lastTap = now;
                if (gg.type !== 'mouse') tapTimer = setTimeout(toggleChrome, 260);
            }
        }
    };
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
    // Fallback for inputs that only produce a native dblclick (assistive tech, some pens);
    // skipped when the pointer sequence above already handled the double tap.
    stage.addEventListener('dblclick', (e) => {
        if (!loaded || Date.now() - lastDbl < 500) return;
        const r = img.getBoundingClientRect();   // pointer capture retargets the event to the stage
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) dblZoom(e);
    });

    // ── Actions ──
    const rotate = () => {
        if (!loaded) return;
        rotAcc += 90;
        fitS = computeFit(); minS = Math.min(fitS, 1);
        s = fitS; tx = ty = 0; apply(true);
    };
    const download = async () => {
        const it = items[idx];
        const d = new Date(), z = (n) => String(n).padStart(2, '0');
        const stamp = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
        const name = `${it.drawing ? 'drawing' : 'image'}-${stamp}${many ? '-' + (idx + 1) : ''}.${extOf(mimeOf(it.src))}`;
        let href = it.src, revoke = null;
        if (!/^(data|blob):/i.test(href)) {
            try { const r = await fetch(href); href = revoke = URL.createObjectURL(await r.blob()); }
            catch (err) { window.open(it.src, '_blank', 'noopener'); return; }
        }
        const a = document.createElement('a');
        a.href = href; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 4000);
    };
    const toggleFs = () => {
        if (fsElement()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
        const req = fsRoot(overlay);
        if (req) { const r = req.call(overlay); if (r && r.catch) r.catch(() => {}); }
    };
    const onFsChange = () => {
        if (!fsBtn) return;
        const on = fsElement() === overlay;
        fsBtn.querySelector('i').className = 'bi ' + (on ? 'bi-fullscreen-exit' : 'bi-fullscreen');
        const l = on ? tr('viewerExitFullscreen', 'Exit fullscreen') : tr('viewerFullscreen', 'Fullscreen');
        fsBtn.title = l; fsBtn.setAttribute('aria-label', l);
    };

    const onKey = (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key;
        if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
        if (k === '+' || k === '=') { e.preventDefault(); zoomCenter(1.25); }
        else if (k === '-' || k === '_') { e.preventDefault(); zoomCenter(0.8); }
        else if (k === '0') { e.preventDefault(); toFit(true); }
        else if (k === '1') { e.preventDefault(); toActual(true); }
        else if (k === 'r' || k === 'R') { e.preventDefault(); rotate(); }
        else if ((k === 'f' || k === 'F') && fsBtn) { e.preventDefault(); toggleFs(); }
        else if (k === 'Home' && many) { e.preventDefault(); go(0, -1); }
        else if (k === 'End' && many) { e.preventDefault(); go(items.length - 1, 1); }
        else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
            e.preventDefault();
            if (atFit() && many && (k === 'ArrowLeft' || k === 'ArrowRight')) { go(idx + (k === 'ArrowRight' ? 1 : -1)); return; }
            const step = 70;
            if (k === 'ArrowLeft') tx += step; else if (k === 'ArrowRight') tx -= step;
            else if (k === 'ArrowUp') ty += step; else ty -= step;
            apply(false);
        } else if (k === 'Tab') {
            const f = [...overlay.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
            if (!f.length) return;
            e.preventDefault();
            const i = f.indexOf(document.activeElement);
            f[(i + (e.shiftKey ? f.length - 1 : 1) + (i < 0 ? (e.shiftKey ? 0 : -1) : 0)) % f.length].focus();
        }
    };
    const onResize = () => {
        if (!loaded) return;
        const wasFit = atFit();
        fitS = computeFit(); minS = Math.min(fitS, 1);
        s = wasFit ? fitS : Math.max(minS, s);
        apply(false);
    };

    function close() {
        if (closed) return;
        closed = true;
        clearTimeout(tapTimer); clearTimeout(animT);
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('fullscreenchange', onFsChange);
        document.removeEventListener('webkitfullscreenchange', onFsChange);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        if (fsElement() === overlay) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (err) {} }
        document.body.classList.remove('ln-dv-open');
        overlay.classList.add('is-closing');
        setTimeout(() => overlay.remove(), 180);
        if (opener && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch (err) {} }
    }

    $('.ln-dv-in').addEventListener('click', () => zoomCenter(1.4));
    $('.ln-dv-out').addEventListener('click', () => zoomCenter(1 / 1.4));
    $('.ln-dv-fit').addEventListener('click', () => toFit(true));
    $('.ln-dv-100').addEventListener('click', () => toActual(true));
    $('.ln-dv-rot').addEventListener('click', rotate);
    $('.ln-dv-dl').addEventListener('click', download);
    $('.ln-dv-x').addEventListener('click', close);
    if (fsBtn) fsBtn.addEventListener('click', toggleFs);
    if (prevBtn) prevBtn.addEventListener('click', () => go(idx - 1, -1));
    if (nextBtn) nextBtn.addEventListener('click', () => go(idx + 1, 1));
    if (thumbs) thumbs.addEventListener('click', (e) => {
        const b = e.target.closest('.ln-dv-thumb');
        if (b) go(parseInt(b.dataset.i, 10));
    });
    // Clicks inside the viewer must not reach the page underneath
    overlay.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.body.classList.add('ln-dv-open');
    document.body.appendChild(overlay);
    show(idx, 0);
    $('.ln-dv-x').focus({ preventScroll: true });
}
window.openImageViewer = openImageViewer;

// Every image of the note that was clicked, so the viewer can page through them
function collectGallery(target) {
    const scope = target.closest('.noteContent') || target.closest('.note') || target.parentElement;
    const list = [...scope.querySelectorAll('img')].filter((im) =>
        (im.currentSrc || im.src) && !im.classList.contains('error') && !im.closest('.note-tags, .note-btn-row'));
    if (!list.includes(target)) list.push(target);
    return {
        index: list.indexOf(target),
        items: list.map((im) => ({
            src: im.currentSrc || im.src,
            // never use the transient 'Image load error' placeholder as a caption
            alt: (() => {
                const a = im.hasAttribute('data-orig-alt') ? im.getAttribute('data-orig-alt') : (im.getAttribute('alt') || '');
                // also drops the placeholder if it was already saved into note HTML (e.g. by a checklist toggle)
                return a === 'Image load error' ? '' : a;
            })(),
            drawing: im.classList.contains('lne-drawing')
        }))
    };
}

// ── Click on a note image ────────────────────────────────────────────────────

function handleImageClick(event) {
    const target = event.target;
    if (!target.matches('.note img')) return;

    // Prevent the opening event from immediately closing the overlay
    event.stopPropagation();
    event.preventDefault();

    const gallery = collectGallery(target);
    openImageViewer(gallery.items, gallery.index);
}

// Single global listener — 'click' fires after touch sequence ends,
// avoiding duplicate events from pointerdown+touchend+click
document.addEventListener('click', handleImageClick);

// DOM observer for dynamically added note images
document.addEventListener('DOMContentLoaded', initializeImageHandlers);

const imgObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            const imgs = node.matches?.('.note img')
                ? [node]
                : [...(node.querySelectorAll?.('.note img') || [])];
            imgs.forEach(img => {
                if (!img.hasAttribute('data-handlers-added')) {
                    img.addEventListener('load', () => handleImageLoad(img));
                    img.addEventListener('error', () => handleImageError(img));
                    img.setAttribute('data-handlers-added', 'true');
                }
            });
        });
    });
});

imgObserver.observe(document.body, { childList: true, subtree: true });

// ── Image-store resolver ────────────────────────────────────────────────────
// Notes keep big images in a separate encrypted store and reference them as
// <img src="cid:ln-…">. Whenever such an <img> lands in the document (note
// cards, calendar, sidebar preview...) it is pointed at an object URL of the
// decrypted bytes — lazily, only for images that are actually rendered.
(function () {
    const SEL = 'img[src^="cid:ln-"]';
    async function resolveImg(img) {
        const src = img.getAttribute('src') || '';
        const db = window.notesDB;
        if (!db || !db.vaultReady || !src.startsWith('cid:ln-')) return;
        try {
            const url = await db.imageBlobUrl(src.slice(4));
            if (url && img.getAttribute('src') === src) img.src = url;
        } catch (e) { console.warn('Could not load stored image', e); }
    }
    function scan(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.matches(SEL)) resolveImg(node);
        node.querySelectorAll(SEL).forEach(resolveImg);
    }
    new MutationObserver((muts) => {
        for (const m of muts) m.addedNodes.forEach(scan);
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.lnResolveImages = scan; // for callers that need to force a pass
})();