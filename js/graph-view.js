/**
 * Graph View — force-directed visualization of wiki-link connections
 * between notes (the same `data-note-id="..."` chips that power
 * findBacklinks() in index.js). Self-contained: own DOM, own CSS,
 * own tiny physics loop — no external graph/charting library.
 *
 * Exposes window.GraphView = { open, close, toggle }
 */
(function () {
    'use strict';

    var overlay = null, canvas = null, ctx = null;
    var searchInput = null, statsEl = null, hideOrphansBox = null, scopeSelect = null;
    var raf = null;
    var nodes = [];      // { id, title, color, x, y, vx, vy, degree, fixed, tags }
    var edges = [];      // { from, to } — indices into nodes
    var nodeIndex = {};  // note id -> node
    var hovered = null, dragging = null;
    var camera = { x: 0, y: 0, scale: 1 };
    var panStart = null;
    var query = '';
    var W = 0, H = 0;

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

    function toPlainTitle(n) {
        var title = (n && (n.title || '')).toString();
        if (title) return title;
        var text = String((n && n.content) || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return text.slice(0, 40) || t('gvUntitled', 'Untitled note');
    }

    // ── styles ──────────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('lngv-style')) return;
        var css =
            '.lngv-ov{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;' +
                'background:rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .15s;}' +
            '.lngv-ov.lngv-open{opacity:1;pointer-events:auto;}' +
            '.lngv-box{width:min(1100px,96vw);height:min(760px,92vh);display:flex;flex-direction:column;' +
                'background:var(--modal-bg,#1a1a1a);border:1px solid var(--modal-border,#272727);border-radius:14px;' +
                'box-shadow:0 20px 70px rgba(0,0,0,.5);overflow:hidden;}' +
            '.lngv-hd{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border-color,#272727);flex-shrink:0;flex-wrap:wrap;}' +
            '.lngv-hd h3{margin:0;font-size:15px;color:var(--text-color,#e0e0e0);flex-shrink:0;display:flex;align-items:center;gap:8px;}' +
            '.lngv-search{flex:1;min-width:120px;background:var(--input-bg,#242424);border:1px solid var(--border-color,#333);' +
                'border-radius:8px;padding:7px 10px;color:var(--text-color,#e0e0e0);font-size:13px;outline:0;}' +
            '.lngv-select{background:var(--input-bg,#242424);border:1px solid var(--border-color,#333);border-radius:8px;' +
                'padding:6px 8px;color:var(--text-color,#e0e0e0);font-size:12.5px;}' +
            '.lngv-chk{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text-secondary,#999);white-space:nowrap;}' +
            '.lngv-close{margin-left:auto;background:transparent;border:0;color:var(--text-secondary,#999);font-size:20px;cursor:pointer;line-height:1;padding:2px 6px;}' +
            '.lngv-close:hover{color:var(--text-color,#e0e0e0);}' +
            '.lngv-body{position:relative;flex:1;min-height:0;}' +
            '.lngv-canvas{width:100%;height:100%;display:block;cursor:grab;touch-action:none;}' +
            '.lngv-canvas.lngv-grabbing{cursor:grabbing;}' +
            '.lngv-stats{position:absolute;left:12px;bottom:10px;font-size:11px;color:var(--text-secondary,#999);' +
                'background:rgba(0,0,0,.35);padding:4px 8px;border-radius:6px;pointer-events:none;}' +
            '.lngv-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
                'color:var(--text-secondary,#999);font-size:13px;text-align:center;padding:0 24px;}' +
            '.lngv-tip{position:absolute;right:12px;bottom:10px;font-size:11px;color:var(--text-secondary,#999);' +
                'background:rgba(0,0,0,.35);padding:4px 8px;border-radius:6px;pointer-events:none;}' +
            '@media (max-width:640px){.lngv-box{width:100vw;height:100dvh;border-radius:0;}.lngv-tip{display:none;}}' +
            // Toolbar button gets no custom class/styling here — see the note
            // in mountToolbarButton() below for why. css/action-bar.css
            // (loaded by every page via page-init.js) already restyles
            // #graphViewBtn to match #toggleTaskBoardButton/#appLockBtn.
            // Custom checkbox — same visual language as the checklist checkbox
            // already used inside rendered notes (.noteContent .tbl-cb in
            // css/index.css: 16px box, rounded corners, accent-green fill +
            // checkmark on :checked) instead of the bare native control.
            '.lngv-hd input[type="checkbox"]{appearance:none;-webkit-appearance:none;width:16px;height:16px;' +
                'min-width:16px;border:2px solid rgba(174,252,110,.55);border-radius:4px;background:transparent;' +
                'cursor:pointer;position:relative;flex-shrink:0;transition:background .15s,border-color .15s;margin:0;}' +
            '.lngv-hd input[type="checkbox"]:checked{background:#aefc6e;border-color:#aefc6e;}' +
            '.lngv-hd input[type="checkbox"]:checked::after{content:"";position:absolute;top:1px;left:4px;' +
                'width:5px;height:8px;border:2px solid #000;border-top:none;border-left:none;transform:rotate(45deg);}' +
            '.lngv-hd input[type="checkbox"]:hover{border-color:#aefc6e;box-shadow:0 0 0 3px rgba(174,252,110,.15);}' +
            '[data-theme="light"] .lngv-hd input[type="checkbox"]{border-color:rgba(40,167,69,.5);}' +
            '[data-theme="light"] .lngv-hd input[type="checkbox"]:checked{background:#28a745;border-color:#28a745;}' +
            '[data-theme="light"] .lngv-hd input[type="checkbox"]:checked::after{border-color:#fff;}';
        var style = document.createElement('style');
        style.id = 'lngv-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ── DOM ─────────────────────────────────────────────────────────────────
    function buildDOM() {
        if (overlay) return;
        injectStyles();
        overlay = document.createElement('div');
        overlay.className = 'lngv-ov';
        overlay.innerHTML =
            '<div class="lngv-box">' +
                '<div class="lngv-hd">' +
                    '<h3><i class="bi bi-diagram-3"></i>' + escapeHtml(t('gvTitle', 'Graph View')) + '</h3>' +
                    '<input type="text" class="lngv-search" placeholder="' + escapeHtml(t('gvSearchPlaceholder', 'Highlight note…')) + '">' +
                    '<select class="lngv-select" id="lngvScope">' +
                        '<option value="workspace">' + escapeHtml(t('gvScopeWorkspace', 'Current workspace')) + '</option>' +
                        '<option value="all">' + escapeHtml(t('gvScopeAll', 'All notes')) + '</option>' +
                    '</select>' +
                    '<label class="lngv-chk"><input type="checkbox" id="lngvOrphans"> ' + escapeHtml(t('gvHideOrphans', 'Hide unlinked notes')) + '</label>' +
                    '<button type="button" class="lngv-close" aria-label="Close">&times;</button>' +
                '</div>' +
                '<div class="lngv-body">' +
                    '<canvas class="lngv-canvas"></canvas>' +
                    '<div class="lngv-stats"></div>' +
                    '<div class="lngv-tip">' + escapeHtml(t('gvTip', 'Drag nodes • Scroll to zoom • Click to open')) + '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        canvas = overlay.querySelector('.lngv-canvas');
        ctx = canvas.getContext('2d');
        searchInput = overlay.querySelector('.lngv-search');
        statsEl = overlay.querySelector('.lngv-stats');
        hideOrphansBox = overlay.querySelector('#lngvOrphans');
        scopeSelect = overlay.querySelector('#lngvScope');

        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        overlay.querySelector('.lngv-close').addEventListener('click', close);
        document.addEventListener('keydown', onKeydown);

        searchInput.addEventListener('input', function () { query = searchInput.value.trim().toLowerCase(); });
        hideOrphansBox.addEventListener('change', function () { layoutAndRender(); });
        scopeSelect.addEventListener('change', function () { rebuild(); });

        canvas.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });

        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);

        window.addEventListener('resize', resizeCanvas);
    }

    function onKeydown(e) {
        if (!overlay || !overlay.classList.contains('lngv-open')) return;
        if (e.key === 'Escape') close();
    }

    function resizeCanvas() {
        if (!canvas) return;
        var box = overlay.querySelector('.lngv-body');
        var rect = box.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        W = rect.width; H = rect.height;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ── data ────────────────────────────────────────────────────────────────
    function currentWorkspaceNotes(all) {
        try {
            if (scopeSelect && scopeSelect.value === 'all') return all;
            if (typeof workspacesManager !== 'undefined' && workspacesManager && workspacesManager.currentWorkspace) {
                return workspacesManager.filterNotesByWorkspace(all);
            }
        } catch (e) { /* workspaces module not present — fall through */ }
        return all;
    }

    async function rebuild() {
        if (!window.notesDB || typeof window.notesDB.getAllNotes !== 'function') return;
        var all = await window.notesDB.getAllNotes();
        var scoped = currentWorkspaceNotes(all);
        var scopedIds = {};
        scoped.forEach(function (n) { scopedIds[n.id] = true; });

        nodes = []; edges = []; nodeIndex = {};
        var marker = /data-note-id="([^"]+)"/g;

        scoped.forEach(function (n) {
            var node = {
                id: n.id, title: toPlainTitle(n), color: n.color || '',
                x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400,
                vx: 0, vy: 0, degree: 0, fixed: null
            };
            nodes.push(node);
            nodeIndex[n.id] = node;
        });

        scoped.forEach(function (n) {
            var m; marker.lastIndex = 0;
            var seen = {};
            while ((m = marker.exec(n.content || ''))) {
                var targetId = m[1];
                if (targetId === n.id) continue;
                if (!nodeIndex[targetId]) continue; // link points outside current scope
                var key = n.id < targetId ? n.id + '|' + targetId : targetId + '|' + n.id;
                if (seen[key]) continue; // no duplicate edges between the same pair
                seen[key] = true;
                edges.push({ from: nodeIndex[n.id], to: nodeIndex[targetId] });
                nodeIndex[n.id].degree++;
                nodeIndex[targetId].degree++;
            }
        });

        layoutAndRender();
    }

    function visibleNodes() {
        if (hideOrphansBox && hideOrphansBox.checked) return nodes.filter(function (n) { return n.degree > 0; });
        return nodes;
    }

    // ── physics (simple Fruchterman-Reingold-ish simulation) ────────────────
    var simTicks = 0;
    function step() {
        var vn = visibleNodes();
        var n = vn.length;
        if (n === 0) { render(); raf = requestAnimationFrame(step); return; }
        var area = Math.max(W * H, 40000);
        var k = Math.sqrt(area / n) * 0.9;

        // repulsion (O(n^2) — fine for personal note counts; capped below)
        if (n <= 600) {
            for (var i = 0; i < n; i++) {
                var a = vn[i];
                if (a.fixed) continue;
                var fx = 0, fy = 0;
                for (var j = 0; j < n; j++) {
                    if (i === j) continue;
                    var b = vn[j];
                    var dx = a.x - b.x, dy = a.y - b.y;
                    var d2 = dx * dx + dy * dy || 0.01;
                    var d = Math.sqrt(d2);
                    var force = (k * k) / d2;
                    fx += (dx / d) * force;
                    fy += (dy / d) * force;
                }
                a.vx = (a.vx + fx) * 0.85;
                a.vy = (a.vy + fy) * 0.85;
            }
        }
        // attraction along edges
        edges.forEach(function (e) {
            if (hideOrphansBox && hideOrphansBox.checked && (e.from.degree === 0 || e.to.degree === 0)) return;
            var dx = e.from.x - e.to.x, dy = e.from.y - e.to.y;
            var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
            var force = (d * d) / k * 0.02;
            var ux = dx / d, uy = dy / d;
            if (!e.from.fixed) { e.from.vx -= ux * force; e.from.vy -= uy * force; }
            if (!e.to.fixed) { e.to.vx += ux * force; e.to.vy += uy * force; }
        });
        // mild gravity to center + integrate
        vn.forEach(function (a) {
            if (a.fixed) { a.x = a.fixed.x; a.y = a.fixed.y; return; }
            a.vx -= a.x * 0.006;
            a.vy -= a.y * 0.006;
            a.vx *= 0.9; a.vy *= 0.9;
            a.x += a.vx; a.y += a.vy;
        });

        render();
        simTicks++;
        // keep simulating gently forever at low amplitude — cheap, keeps
        // the graph "alive" without ever fully freezing mid-layout
        raf = requestAnimationFrame(step);
    }

    function layoutAndRender() {
        cancelAnimationFrame(raf);
        simTicks = 0;
        raf = requestAnimationFrame(step);
    }

    // ── render ──────────────────────────────────────────────────────────────
    function worldToScreen(x, y) {
        return { x: W / 2 + (x + camera.x) * camera.scale, y: H / 2 + (y + camera.y) * camera.scale };
    }
    function screenToWorld(x, y) {
        return { x: (x - W / 2) / camera.scale - camera.x, y: (y - H / 2) / camera.scale - camera.y };
    }

    function render() {
        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);
        var vn = visibleNodes();
        var visibleSet = {};
        vn.forEach(function (n) { visibleSet[n.id] = true; });

        var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        var edgeColor = isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.14)';
        var accent = '#aefc6e';

        ctx.lineWidth = 1;
        edges.forEach(function (e) {
            if (!visibleSet[e.from.id] || !visibleSet[e.to.id]) return;
            var p1 = worldToScreen(e.from.x, e.from.y), p2 = worldToScreen(e.to.x, e.to.y);
            ctx.strokeStyle = edgeColor;
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        });

        vn.forEach(function (n) {
            var p = worldToScreen(n.x, n.y);
            var r = Math.min(18, 5 + Math.sqrt(n.degree) * 3);
            var matches = query && n.title.toLowerCase().indexOf(query) !== -1;
            var dim = query && !matches;

            ctx.globalAlpha = dim ? 0.25 : 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = n.color || (n === hovered ? accent : (isDark ? '#4a5d3a' : '#8fbf6a'));
            ctx.fill();
            if (matches || n === hovered) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = accent;
                ctx.stroke();
            }
            if (camera.scale > 0.5 || matches || n === hovered) {
                ctx.font = '11px system-ui, sans-serif';
                ctx.fillStyle = isDark ? '#e0e0e0' : '#222';
                ctx.textAlign = 'center';
                var label = n.title.length > 22 ? n.title.slice(0, 22) + '…' : n.title;
                ctx.fillText(label, p.x, p.y + r + 13);
            }
            ctx.globalAlpha = 1;
        });

        statsEl.textContent = t('gvStats', 'Notes: {n} · Links: {e}')
            .replace('{n}', vn.length).replace('{e}', edges.filter(function (e) {
                return visibleSet[e.from.id] && visibleSet[e.to.id];
            }).length);
    }

    // ── interaction ─────────────────────────────────────────────────────────
    function nodeAtScreen(x, y) {
        var vn = visibleNodes();
        for (var i = vn.length - 1; i >= 0; i--) {
            var n = vn[i];
            var p = worldToScreen(n.x, n.y);
            var r = Math.min(18, 5 + Math.sqrt(n.degree) * 3) + 4;
            if ((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) <= r * r) return n;
        }
        return null;
    }

    function localXY(e) {
        var rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onPointerDown(e) {
        var pos = localXY(e);
        var n = nodeAtScreen(pos.x, pos.y);
        if (n) {
            dragging = n;
            n.fixed = { x: n.x, y: n.y };
            // Remembers the exact node (and where/when) the pointer went down
            // on, so mouseup can open THAT note regardless of how far the
            // simulation nudges nodes around in between — re-hit-testing at
            // mouseup time was the bug that could open the wrong note (or,
            // via a stale/undefined id, a blank new one).
            clickCandidate = { node: n, sx: e.clientX, sy: e.clientY, t: Date.now() };
            canvas.classList.add('lngv-grabbing');
        } else {
            panStart = { x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y };
            clickCandidate = null;
            canvas.classList.add('lngv-grabbing');
        }
    }
    function onPointerMove(e) {
        if (dragging) {
            var pos = localXY(e);
            var w = screenToWorld(pos.x, pos.y);
            dragging.fixed = { x: w.x, y: w.y };
            if (clickCandidate && !withinClickThreshold(e.clientX, e.clientY, clickCandidate)) clickCandidate = null;
        } else if (panStart) {
            camera.x = panStart.camX + (e.clientX - panStart.x) / camera.scale;
            camera.y = panStart.camY + (e.clientY - panStart.y) / camera.scale;
        } else if (canvas) {
            var p2 = localXY(e);
            var newHover = nodeAtScreen(p2.x, p2.y);
            if (newHover !== hovered) { hovered = newHover; canvas.style.cursor = hovered ? 'pointer' : 'grab'; }
        }
    }
    function onPointerUp() {
        if (dragging) { dragging.fixed = null; dragging = null; }
        panStart = null;
        if (canvas) canvas.classList.remove('lngv-grabbing');
        resolveClick();
    }
    function onWheel(e) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? 0.9 : 1.1;
        camera.scale = Math.max(0.15, Math.min(3, camera.scale * delta));
    }
    // A single click (not a drag) opens the note — matches the on-screen tip
    // ("Click to open"), instead of requiring an undocumented double-click.
    var clickCandidate = null; // { node, sx, sy, t }
    var CLICK_MOVE_PX = 6, CLICK_TIME_MS = 600;
    function withinClickThreshold(clientX, clientY, candidate) {
        var dx = clientX - candidate.sx, dy = clientY - candidate.sy;
        return (dx * dx + dy * dy) <= (CLICK_MOVE_PX * CLICK_MOVE_PX);
    }
    function resolveClick() {
        if (!clickCandidate) return;
        var candidate = clickCandidate;
        clickCandidate = null;
        if (Date.now() - candidate.t > CLICK_TIME_MS) return; // held too long — treat as a drag, not a click
        var node = candidate.node;
        if (!node || !node.id || typeof window.openModal !== 'function') return;
        var noteId = node.id;
        // Keep the graph open behind the note modal — closing it here meant
        // every click on a node dismissed the graph, forcing a re-open (and
        // loss of pan/zoom) just to look at another note.
        // openModal(noteId, noteContent, noteCreationTime) needs the actual
        // content — graph nodes only carry id/title/color for layout (see
        // rebuild() above), so without this fetch it was calling
        // openModal(id) with content undefined, which openModal reads as
        // "no existing note" and opens a blank new-note editor instead.
        if (window.notesDB && typeof window.notesDB.getNote === 'function') {
            window.notesDB.getNote(noteId).then(function (note) {
                if (note) window.openModal(note.id, note.content, note.creationTime);
            });
        }
    }
    // touch support (tap opens a note, drag pans/repositions — same
    // click-vs-drag disambiguation as the mouse handlers above)
    var lastTouch = null;
    function onTouchStart(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        var touch = e.touches[0];
        var pos = localXY(touch);
        var n = nodeAtScreen(pos.x, pos.y);
        if (n) {
            dragging = n; n.fixed = { x: n.x, y: n.y };
            clickCandidate = { node: n, sx: touch.clientX, sy: touch.clientY, t: Date.now() };
        } else {
            lastTouch = { x: touch.clientX, y: touch.clientY };
            clickCandidate = null;
        }
    }
    function onTouchMove(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        var touch = e.touches[0];
        if (dragging) {
            var pos = localXY(touch);
            var w = screenToWorld(pos.x, pos.y);
            dragging.fixed = { x: w.x, y: w.y };
            if (clickCandidate && !withinClickThreshold(touch.clientX, touch.clientY, clickCandidate)) clickCandidate = null;
        } else if (lastTouch) {
            camera.x += (touch.clientX - lastTouch.x) / camera.scale;
            camera.y += (touch.clientY - lastTouch.y) / camera.scale;
            lastTouch = { x: touch.clientX, y: touch.clientY };
        }
    }
    function onTouchEnd() {
        if (dragging) { dragging.fixed = null; dragging = null; }
        lastTouch = null;
        resolveClick();
    }

    // ── public API ──────────────────────────────────────────────────────────
    function open() {
        buildDOM();
        overlay.classList.add('lngv-open');
        resizeCanvas();
        camera = { x: 0, y: 0, scale: 0.9 };
        rebuild();
    }
    function close() {
        if (!overlay) return;
        overlay.classList.remove('lngv-open');
        cancelAnimationFrame(raf);
    }
    function toggle() {
        if (overlay && overlay.classList.contains('lngv-open')) close(); else open();
    }

    // ── toolbar button ──────────────────────────────────────────────────────
    // Mounted into the existing .btn_view_div row (Toggle View / Tasks / Lock)
    // so the feature has a real, always-visible entry point — Command Palette
    // (Ctrl+K) alone is invisible to anyone who doesn't already know it exists.
    // .btn_view_div is present on the root page AND every /xx/index.html
    // locale copy, so mounting here (rather than editing 12+ HTML files)
    // reaches all of them at once.
    //
    // No custom class on the button: css/action-bar.css already restyles
    // it (by #graphViewBtn) into the same segmented control as
    // #toggleTaskBoardButton/#appLockBtn — its own comment says the intent
    // is for Graph View/Site Export to "join this same
    // segmented control (rather than keeping their own pill-button look)".
    // The old .ln-toolbar-btn class fought that (different text color,
    // font-weight, padding weren't covered by action-bar.css's overrides),
    // which is what made this button visibly mismatched from Lock/Tasks.
    function mountToolbarButton() {
        if (document.getElementById('graphViewBtn')) return;
        var container = document.querySelector('.btn_view_div');
        if (!container) return;
        var btn = document.createElement('button');
        btn.id = 'graphViewBtn';
        btn.type = 'button';
        btn.title = t('gvTitle', 'Graph View');
        btn.innerHTML = '<i class="bi bi-diagram-3"></i> ' + escapeHtml(t('gvToolbarLabel', 'Graph'));
        btn.addEventListener('click', open);
        var lockGroup = document.getElementById('appLockBtnGroup');
        if (lockGroup && lockGroup.parentNode === container) container.insertBefore(btn, lockGroup);
        else container.appendChild(btn);
    }
    function initToolbarButton() {
        injectStyles();
        mountToolbarButton();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToolbarButton);
    } else {
        initToolbarButton();
    }

    window.GraphView = { open: open, close: close, toggle: toggle };
})();
