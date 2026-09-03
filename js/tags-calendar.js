/**
 * LocalNotes — Tags & Calendar System
 * Tags: create, edit, delete, filter by tag
 * Calendar: view notes by date, due dates, events
 */

// ─────────────────────────────────────────────────────────────
// TAG COLORS
// ─────────────────────────────────────────────────────────────
const TAG_COLORS = [
    { id: 'green',  hex: '#aefc6e', label: 'Green'  },
    { id: 'blue',   hex: '#4ec9b0', label: 'Blue'   },
    { id: 'purple', hex: '#c586c0', label: 'Purple' },
    { id: 'orange', hex: '#f1c40f', label: 'Orange' },
    { id: 'red',    hex: '#e74c3c', label: 'Red'    },
    { id: 'pink',   hex: '#ff7eb3', label: 'Pink'   },
    { id: 'cyan',   hex: '#00d4ff', label: 'Cyan'   },
    { id: 'gray',   hex: '#888888', label: 'Gray'   }
];

// ─────────────────────────────────────────────────────────────
// TAG STORE  (uses notesDB settings store)
// ─────────────────────────────────────────────────────────────

async function getTags() {
    try {
        const tags = await notesDB.getSetting('tags');
        return tags || [];
    } catch (e) { return []; }
}

async function saveTags(tags) {
    await notesDB.saveSetting('tags', tags);
}

async function createTag(name, colorId) {
    const tags = await getTags();
    const id = 'tag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    tags.push({ id, name, colorId: colorId || 'green' });
    await saveTags(tags);
    return id;
}

async function deleteTag(tagId) {
    let tags = await getTags();
    tags = tags.filter(t => t.id !== tagId);
    await saveTags(tags);
    // Remove tag from all notes
    const notes = await notesDB.getAllNotes();
    for (const note of notes) {
        if (note.tags && note.tags.includes(tagId)) {
            note.tags = note.tags.filter(t => t !== tagId);
            await notesDB.saveNote(note);
        }
    }
}

async function addTagToNote(noteId, tagId) {
    const note = await notesDB.getNote(noteId);
    if (!note) return;
    if (!note.tags) note.tags = [];
    if (!note.tags.includes(tagId)) {
        note.tags.push(tagId);
        await notesDB.saveNote(note);
    }
}

async function removeTagFromNote(noteId, tagId) {
    const note = await notesDB.getNote(noteId);
    if (!note) return;
    note.tags = (note.tags || []).filter(t => t !== tagId);
    await notesDB.saveNote(note);
}

// ─────────────────────────────────────────────────────────────
// RENDER TAGS ON NOTE CARDS
// ─────────────────────────────────────────────────────────────

async function renderNoteTags(noteEl, note, allTags) {
    const existing = noteEl.querySelector('.note-tags');
    if (existing) existing.remove();

    if (!note.tags || note.tags.length === 0) return;

    const container = document.createElement('div');
    container.className = 'note-tags';

    for (const tagId of note.tags) {
        const tag = allTags.find(t => t.id === tagId);
        if (!tag) continue;
        const color = TAG_COLORS.find(c => c.id === tag.colorId) || TAG_COLORS[0];
        const pill = document.createElement('span');
        pill.className = 'note-tag-pill';
        pill.style.setProperty('--tag-color', color.hex);
        pill.textContent = tag.name;
        pill.dataset.tagId = tag.id;
        container.appendChild(pill);
    }

    // Insert after footer
    const footer = noteEl.querySelector('.note-footer');
    if (footer) footer.after(container);
    else noteEl.insertBefore(container, noteEl.firstChild);
}

// ─────────────────────────────────────────────────────────────
// DUE DATE helpers
// ─────────────────────────────────────────────────────────────

function isDueToday(timestamp) {
    if (!timestamp) return false;
    const d = new Date(timestamp);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isDueSoon(timestamp) {
    if (!timestamp) return false;
    const diff = timestamp - Date.now();
    return diff > 0 && diff < 2 * 24 * 60 * 60 * 1000; // within 48 hours
}

function isOverdue(timestamp) {
    if (!timestamp) return false;
    return timestamp < Date.now();
}

// ─────────────────────────────────────────────────────────────
// TAG PANEL UI
// ─────────────────────────────────────────────────────────────

let activeTagFilter = null; // null = show all

async function renderTagPanel() {
    const panel = document.getElementById('tagPanel');
    if (!panel) return;

    const tags = await getTags();
    const notes = await notesDB.getAllNotes();

    panel.innerHTML = '<div class="tag-panel-header"><span class="tag-panel-title"><i class="bi bi-tags"></i> Tags</span><button id="addTagBtn" class="tag-add-btn" title="Add tag"><i class="bi bi-plus-lg"></i></button></div>';

    const list = document.createElement('div');
    list.className = 'tag-list';

    // "All notes" entry
    const allEl = document.createElement('button');
    allEl.className = 'tag-filter-btn' + (!activeTagFilter ? ' active' : '');
    allEl.innerHTML = '<i class="bi bi-journal-text"></i> <span>All notes</span> <span class="tag-count">' + notes.length + '</span>';
    allEl.addEventListener('click', () => {
        activeTagFilter = null;
        renderTagPanel();
        loadNotes();
    });
    list.appendChild(allEl);

    for (const tag of tags) {
        const count = notes.filter(n => n.tags && n.tags.includes(tag.id)).length;
        const color = TAG_COLORS.find(c => c.id === tag.colorId) || TAG_COLORS[0];

        const row = document.createElement('div');
        row.className = 'tag-filter-row';

        const btn = document.createElement('button');
        btn.className = 'tag-filter-btn' + (activeTagFilter === tag.id ? ' active' : '');
        btn.style.setProperty('--tag-color', color.hex);
        btn.innerHTML = '<span class="tag-dot"></span><span class="tag-name">' + escapeHtml(tag.name) + '</span><span class="tag-count">' + count + '</span>';
        btn.addEventListener('click', () => {
            activeTagFilter = tag.id;
            renderTagPanel();
            loadNotes();
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'tag-action-btn';
        editBtn.title = 'Edit';
        editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
        editBtn.addEventListener('click', e => { e.stopPropagation(); showTagEditModal(tag); });

        const delBtn = document.createElement('button');
        delBtn.className = 'tag-action-btn tag-del-btn';
        delBtn.title = 'Delete';
        delBtn.innerHTML = '<i class="bi bi-trash"></i>';
        delBtn.addEventListener('click', async e => {
            e.stopPropagation();
            const _t = (key, fb) => (window.t ? window.t(key) : fb);
            const msg = _t('confirmDeleteTag', 'Delete tag "' + tag.name + '"?').replace('{name}', tag.name);
            const title = _t('confirmDeleteTagTitle', 'Delete Tag');
            const deleteLabel = _t('delete', 'Delete');
            const cancelLabel = _t('cancel', 'Cancel');
            const ov = document.createElement('div');
            ov.className = 'lne-modal-ov';
            ov.innerHTML = '<div class="lne-modal" style="max-width:360px"><div class="lne-mhd"><h3><i class="bi bi-trash"></i> ' + title + '</h3><button class="lne-mclose"><i class="bi bi-x-lg"></i></button></div>' +
                '<div class="lne-mbody"><p>' + msg + '</p></div>' +
                '<div class="lne-mft">' +
                '<button class="lne-mbtn lne-mbtn-sec lne-mcancel"><i class="bi bi-x-lg"></i> ' + cancelLabel + '</button>' +
                '<button class="lne-mbtn lne-mbtn-danger lne-mok"><i class="bi bi-trash"></i> ' + deleteLabel + '</button>' +
                '</div></div>';
            document.body.appendChild(ov);
            const closeOv = () => { if (ov.parentNode) document.body.removeChild(ov); };
            ov.querySelector('.lne-mclose').addEventListener('click', closeOv);
            ov.querySelector('.lne-mcancel').addEventListener('click', closeOv);
            ov.addEventListener('click', e2 => { if (e2.target === ov) closeOv(); });
            ov.querySelector('.lne-mok').addEventListener('click', async () => {
                closeOv();
                await deleteTag(tag.id);
                if (activeTagFilter === tag.id) activeTagFilter = null;
                await renderTagPanel();
                await loadNotes();
            });
        });

        row.appendChild(btn); row.appendChild(editBtn); row.appendChild(delBtn);
        list.appendChild(row);
    }

    panel.appendChild(list);

    // Wire Add button
    panel.querySelector('#addTagBtn').addEventListener('click', () => showTagEditModal(null));
}

function showTagEditModal(tag, onCreated) {
    const isNew = !tag;
    const _t = (key, fb) => (window.t ? window.t(key) : fb);
    const title = isNew ? _t('createTagTitle', 'Create Tag') : _t('editTagTitle', 'Edit Tag');
    const name = tag ? tag.name : '';
    const colorId = tag ? tag.colorId : 'green';

    const swatches = TAG_COLORS.map(c =>
        '<button class="tc-swatch' + (c.id === colorId ? ' selected' : '') + '" data-color="' + c.id + '" style="background:' + c.hex + '" title="' + c.label + '"></button>'
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'lne-modal-ov';
    modal.innerHTML = '<div class="lne-modal" style="max-width:360px"><div class="lne-mhd"><h3><i class="bi bi-tag"></i> ' + title + '</h3><button class="lne-mclose"><i class="bi bi-x-lg"></i></button></div>' +
        '<div class="lne-mbody">' +
        '<div class="lne-fg"><label>' + _t('tagNameLabel', 'Tag name') + '</label><input type="text" id="tag-name-inp" class="lne-inp" value="' + escapeHtml(name) + '" placeholder="' + _t('tagNamePlaceholder', 'My tag...') + '" maxlength="32"></div>' +
        '<div class="lne-fg"><label>' + _t('tagColorLabel', 'Color') + '</label><div class="tc-swatches">' + swatches + '</div></div>' +
        '</div>' +
        '<div class="lne-mft">' +
        '<button class="lne-mbtn lne-mbtn-sec lne-mcancel"><i class="bi bi-x-lg"></i> ' + _t('cancel', 'Cancel') + '</button>' +
        '<button class="lne-mbtn lne-mbtn-pri lne-mok"><i class="bi bi-check-lg"></i> ' + (isNew ? _t('tagCreate', 'Create') : _t('tagSave', 'Save')) + '</button>' +
        '</div></div>';
    document.body.appendChild(modal);

    let selectedColor = colorId;
    modal.querySelectorAll('.tc-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            modal.querySelectorAll('.tc-swatch').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
            selectedColor = sw.dataset.color;
        });
    });

    const close = () => { 
        if (window.visualViewport) window.visualViewport.removeEventListener('resize', onVpResize);
        if (modal.parentNode) document.body.removeChild(modal); 
    };

    const lneModal = modal.querySelector('.lne-modal');
    const onVpResize = function() {
        var vv = window.visualViewport;
        if (!vv || !lneModal) return;
        // On mobile bottom-sheet: shrink maxHeight to visible area, don't shift with marginBottom
        var visibleH = vv.height;
        lneModal.style.maxHeight = (visibleH * 0.92) + 'px';
        // Reset any stale marginBottom
        lneModal.style.marginBottom = '';
    };
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onVpResize);
    modal.querySelector('.lne-mclose').addEventListener('click', close);
    modal.querySelector('.lne-mcancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(); }
    });

    // Swipe-down to close on touch devices
    const isTouchDev = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouchDev) {
        let startY = 0, curY = 0, dragging = false;
        const header = lneModal.querySelector('.lne-mhd');

        const onStart = (e) => {
            startY = e.touches[0].clientY;
            curY = startY;
            dragging = true;
            lneModal.style.transition = 'none';
        };
        const onMove = (e) => {
            if (!dragging) return;
            curY = e.touches[0].clientY;
            const delta = curY - startY;
            if (delta > 0) {
                lneModal.style.transform = 'translateY(' + delta + 'px)';
                lneModal.style.opacity = String(Math.max(0, 1 - delta / 300));
                e.preventDefault();
            }
        };
        const onEnd = () => {
            if (!dragging) return;
            dragging = false;
            const delta = curY - startY;
            lneModal.style.transition = '';
            if (delta > 80) {
                lneModal.style.transform = 'translateY(100%)';
                lneModal.style.opacity = '0';
                setTimeout(close, 200);
            } else {
                lneModal.style.transform = '';
                lneModal.style.opacity = '';
            }
        };

        // Drag from header
        if (header) {
            header.addEventListener('touchstart', onStart, { passive: true });
            header.addEventListener('touchmove', onMove, { passive: false });
            header.addEventListener('touchend', onEnd, { passive: true });
        }
        // Drag from top 44px of modal (covers ::before handle)
        lneModal.addEventListener('touchstart', (e) => {
            const rect = lneModal.getBoundingClientRect();
            if (e.touches[0].clientY - rect.top < 44) onStart(e);
        }, { passive: true });
        lneModal.addEventListener('touchmove', onMove, { passive: false });
        lneModal.addEventListener('touchend', onEnd, { passive: true });
    }
    modal.querySelector('.lne-mok').addEventListener('click', async () => {
        const tagName = modal.querySelector('#tag-name-inp').value.trim();
        if (!tagName) {
            const inp = modal.querySelector('#tag-name-inp');
            inp.style.borderColor = '#dc3545';
            inp.focus();
            return;
        }
        if (isNew) {
            await createTag(tagName, selectedColor);
        } else {
            const tags = await getTags();
            const idx = tags.findIndex(t => t.id === tag.id);
            if (idx !== -1) { tags[idx].name = tagName; tags[idx].colorId = selectedColor; await saveTags(tags); }
        }
        close();
        // If called from note settings panel — use callback instead of reloading
        if (typeof onCreated === 'function') {
            await onCreated();
        } else {
            await renderTagPanel();
            await loadNotes();
        }
    });
    // Focus input only on non-touch devices to avoid keyboard jump on mobile
    if (!isTouchDev) {
        setTimeout(() => modal.querySelector('#tag-name-inp').focus(), 60);
    }
}

// ─────────────────────────────────────────────────────────────
// NOTE TAG EDITOR (inside save modal)
// ─────────────────────────────────────────────────────────────

async function renderNoteTagEditor(noteId) {
    const container = document.getElementById('note-tag-editor');
    if (!container) return;

    const allTags = await getTags();
    const note = noteId ? await notesDB.getNote(noteId) : null;
    const noteTags = (note && note.tags) ? note.tags : [];

    container.innerHTML = '<div class="nte-label"><i class="bi bi-tags"></i> Tags</div><div class="nte-tags" id="nte-tags"></div>' +
        '<button class="nte-add-btn" id="nte-add-tag-btn"><i class="bi bi-plus"></i></button>';

    const tagsDiv = container.querySelector('#nte-tags');

    const render = () => {
        tagsDiv.innerHTML = '';
        window._currentNoteTags = window._currentNoteTags || [...noteTags];
        for (const tagId of window._currentNoteTags) {
            const tag = allTags.find(t => t.id === tagId);
            if (!tag) continue;
            const color = TAG_COLORS.find(c => c.id === tag.colorId) || TAG_COLORS[0];
            const pill = document.createElement('span');
            pill.className = 'nte-tag-pill';
            pill.style.setProperty('--tag-color', color.hex);
            pill.innerHTML = escapeHtml(tag.name) + '<button class="nte-remove-tag" data-tag="' + tagId + '"><i class="bi bi-x"></i></button>';
            pill.querySelector('.nte-remove-tag').addEventListener('click', () => {
                window._currentNoteTags = window._currentNoteTags.filter(t => t !== tagId);
                render();
            });
            tagsDiv.appendChild(pill);
        }
    };
    window._currentNoteTags = [...noteTags];
    render();

    // Add tag dropdown
    container.querySelector('#nte-add-tag-btn').addEventListener('click', e => {
        e.stopPropagation();
        const existingDrop = document.querySelector('.nte-dropdown');
        if (existingDrop) { existingDrop.remove(); return; }

        const drop = document.createElement('div');
        drop.className = 'nte-dropdown';

        const available = allTags.filter(t => !window._currentNoteTags.includes(t.id));
        if (available.length === 0) {
            drop.innerHTML = '<div class="nte-drop-empty">No tags yet. <a href="#" id="nte-create-new">Create one</a></div>';
        } else {
            for (const tag of available) {
                const color = TAG_COLORS.find(c => c.id === tag.colorId) || TAG_COLORS[0];
                const item = document.createElement('button');
                item.className = 'nte-drop-item';
                item.innerHTML = '<span class="nte-dot" style="background:' + color.hex + '"></span>' + escapeHtml(tag.name);
                item.addEventListener('click', () => {
                    window._currentNoteTags.push(tag.id);
                    drop.remove(); render();
                });
                drop.appendChild(item);
            }
            const sep = document.createElement('div'); sep.className = 'nte-drop-sep';
            const newBtn = document.createElement('button'); newBtn.className = 'nte-drop-item nte-drop-new';
            newBtn.innerHTML = '<i class="bi bi-plus-circle"></i> Create new tag';
            newBtn.addEventListener('click', () => { drop.remove(); showTagEditModal(null); });
            drop.appendChild(sep); drop.appendChild(newBtn);
        }

        const rect = e.currentTarget.getBoundingClientRect();
        drop.style.cssText = 'position:fixed;top:' + (rect.bottom + 4) + 'px;left:' + rect.left + 'px;z-index:99999;';
        document.body.appendChild(drop);

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function rm(ev) {
                if (!drop.contains(ev.target)) { drop.remove(); document.removeEventListener('click', rm); }
            });
        }, 10);

        drop.querySelector('#nte-create-new')?.addEventListener('click', e => { e.preventDefault(); drop.remove(); showTagEditModal(null); });
    });
}

// ─────────────────────────────────────────────────────────────
// DUE DATE EDITOR (inside save modal)
// ─────────────────────────────────────────────────────────────

async function renderNoteDueDate(noteId) {
    const container = document.getElementById('note-due-editor');
    if (!container) return;

    const note = noteId ? await notesDB.getNote(noteId) : null;
    const dueDate = note ? note.dueDate : null;
    const color = note ? (note.color || '') : '';
    const pinned = note ? (note.pinned || false) : false;

    const dateVal = dueDate ? new Date(dueDate).toISOString().slice(0, 16) : '';

    container.innerHTML =
        '<div class="lne-row" style="gap:10px;flex-wrap:wrap;">' +
        '<div class="lne-fg" style="flex:1;min-width:160px;">' +
        '<label><i class="bi bi-calendar-event"></i> Due date</label>' +
        '<input type="datetime-local" id="note-due-input" class="lne-inp" value="' + dateVal + '">' +
        '</div>' +
        '<div class="lne-fg">' +
        '<label><i class="bi bi-palette"></i> Color</label>' +
        '<div class="note-color-swatches" id="note-color-swatches">' +
        ['','#aefc6e','#4ec9b0','#c586c0','#f1c40f','#e74c3c','#4a86e8','#ff7eb3'].map(c =>
            '<button class="nc-swatch' + (c === color ? ' selected' : '') + '" data-c="' + c + '" style="background:' + (c || 'transparent') + '" title="' + (c || 'Default') + '"></button>'
        ).join('') + '</div></div>' +
        '<div class="lne-fg" style="justify-content:flex-end;">' +
        '<label><i class="bi bi-pin"></i> Pin</label>' +
        '<button class="note-pin-btn' + (pinned ? ' active' : '') + '" id="note-pin-btn"><i class="bi bi-pin' + (pinned ? '-angle-fill' : '-angle') + '"></i></button>' +
        '</div></div>';

    let selectedColor = color;
    let isPinned = pinned;

    container.querySelectorAll('.nc-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            container.querySelectorAll('.nc-swatch').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
            selectedColor = sw.dataset.c;
            window._currentNoteColor = selectedColor;
        });
    });
    window._currentNoteColor = color;

    container.querySelector('#note-pin-btn').addEventListener('click', () => {
        isPinned = !isPinned;
        window._currentNotePinned = isPinned;
        const btn = container.querySelector('#note-pin-btn');
        btn.classList.toggle('active', isPinned);
        btn.innerHTML = '<i class="bi bi-pin-angle' + (isPinned ? '-fill' : '') + '"></i>';
    });
    window._currentNotePinned = pinned;
}

// ─────────────────────────────────────────────────────────────
// GET NOTE META FROM MODAL
// ─────────────────────────────────────────────────────────────

function getNoteMetaFromModal() {
    const dueInput = document.getElementById('note-due-input');
    return {
        tags: window._currentNoteTags || [],
        dueDate: dueInput && dueInput.value ? new Date(dueInput.value).getTime() : null,
        color: window._currentNoteColor || '',
        pinned: window._currentNotePinned || false
    };
}

// ─────────────────────────────────────────────────────────────
// CALENDAR SYSTEM
// ─────────────────────────────────────────────────────────────

let calendarDate = new Date(); // currently viewed month
let calendarView = 'month'; // 'month' | 'week' | 'agenda'

async function openCalendar() {
    let modal = document.getElementById('calendarModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'calendarModal';
        modal.className = 'cal-overlay';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    await renderCalendar(modal);
}

async function renderCalendar(modal) {
    const notes = await notesDB.getAllNotes();
    const allTags = await getTags();
    const today = new Date();
    const _t = (key, fallback) => (window.t ? window.t(key) : fallback);

    modal.innerHTML = '<div class="cal-modal">' +
        '<div class="cal-header">' +
        '<div class="cal-nav">' +
        '<button class="cal-nav-btn" id="cal-prev"><i class="bi bi-chevron-left"></i></button>' +
        '<h2 class="cal-title" id="cal-title"></h2>' +
        '<button class="cal-nav-btn" id="cal-next"><i class="bi bi-chevron-right"></i></button>' +
        '<button class="cal-today-btn" id="cal-today">' + _t('calendarToday', 'Today') + '</button>' +
        '</div>' +
        '<div class="cal-view-btns">' +
        '<button class="cal-view-btn' + (calendarView==='month'?' active':'') + '" data-v="month">' + _t('calendarMonth', 'Month') + '</button>' +
        '<button class="cal-view-btn' + (calendarView==='week'?' active':'') + '" data-v="week">' + _t('calendarWeek', 'Week') + '</button>' +
        '<button class="cal-view-btn' + (calendarView==='agenda'?' active':'') + '" data-v="agenda">' + _t('calendarAgenda', 'Agenda') + '</button>' +
        '</div>' +
        '<button class="cal-close-btn" id="cal-close"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="cal-body" id="cal-body"></div>' +
        '</div>';

    // Update title and body
    const updateView = async () => {
        const title = modal.querySelector('#cal-title');
        const body  = modal.querySelector('#cal-body');
        const now   = new Date(); // always current date, not captured at open time
        const months = window.t ? window.t('months') : ['January','February','March','April','May','June','July','August','September','October','November','December'];

        if (calendarView === 'month') {
            title.textContent = months[calendarDate.getMonth()] + ' ' + calendarDate.getFullYear();
            body.innerHTML = await buildMonthView(notes, allTags, now);
        } else if (calendarView === 'week') {
            const weekStart = getWeekStart(calendarDate);
            const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
            title.textContent = formatDateShort(weekStart) + ' – ' + formatDateShort(weekEnd);
            body.innerHTML = buildWeekView(notes, allTags, now, weekStart);
        } else {
            title.textContent = _t('calendarAgenda', 'Agenda') + ' — ' + months[calendarDate.getMonth()] + ' ' + calendarDate.getFullYear();
            body.innerHTML = buildAgendaView(notes, allTags, now);
        }
        wireCalendarClicks(modal, notes);
    };

    // Navigation
    modal.querySelector('#cal-prev').addEventListener('click', async () => {
        if (calendarView === 'week') calendarDate.setDate(calendarDate.getDate() - 7);
        else calendarDate.setMonth(calendarDate.getMonth() - 1);
        await updateView();
    });
    modal.querySelector('#cal-next').addEventListener('click', async () => {
        if (calendarView === 'week') calendarDate.setDate(calendarDate.getDate() + 7);
        else calendarDate.setMonth(calendarDate.getMonth() + 1);
        await updateView();
    });
    modal.querySelector('#cal-today').addEventListener('click', async () => {
        calendarDate = new Date();
        await updateView();
        // Scroll to today's cell if visible
        const todayCell = modal.querySelector('.cal-today');
        if (todayCell) todayCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    modal.querySelector('#cal-close').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    modal.querySelectorAll('.cal-view-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            calendarView = btn.dataset.v;
            modal.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            await updateView();
        });
    });

    await updateView();
}

// ── Month View ────────────────────────────────────────────────

async function buildMonthView(notes, allTags, today) {
    const year  = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7; // Monday first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdaysShort = window.t ? window.t('weekdaysShort') : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    // Reorder to Monday-first
    const dowLabels = [...weekdaysShort.slice(1), weekdaysShort[0]];

    let html = '<div class="cal-month">';
    dowLabels.forEach(d => {
        html += '<div class="cal-dow">' + d + '</div>';
    });

    for (let i = 0; i < startDay; i++) html += '<div class="cal-day cal-day-empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const isToday = sameDay(date, today);
        const dayNotes = getNotesOnDay(notes, date);

        html += '<div class="cal-day' + (isToday ? ' cal-today' : '') + '" data-date="' + date.toISOString() + '">';
        html += '<span class="cal-day-num">' + d + '</span>';

        dayNotes.slice(0, 3).forEach(note => {
            const tag = note.tags && note.tags.length ? allTags.find(t => t.id === note.tags[0]) : null;
            const color = tag ? (TAG_COLORS.find(c => c.id === tag.colorId) || TAG_COLORS[0]).hex : 'var(--primary-color)';
            const title = extractNoteTitle(note);
            const overdue = isOverdue(note.dueDate) ? ' cal-overdue' : isDueToday(note.dueDate) ? ' cal-due-today' : '';
            html += '<div class="cal-note-chip' + overdue + '" style="--chip-color:' + color + '" data-note-id="' + note.id + '" title="' + escapeAttr(title) + '">' + escapeHtml(title.slice(0, 20)) + '</div>';
        });
        if (dayNotes.length > 3) {
            html += '<div class="cal-more">+' + (dayNotes.length - 3) + ' more</div>';
        }
        html += '</div>';
    }
    html += '</div>';
    return html;
}

// ── Week View ─────────────────────────────────────────────────

function buildWeekView(notes, allTags, today, weekStart) {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart); d.setDate(d.getDate() + i); days.push(d);
    }
    const weekdaysShort = window.t ? window.t('weekdaysShort') : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    // Reorder to Monday-first
    const dayNames = [...weekdaysShort.slice(1), weekdaysShort[0]];

    let html = '<div class="cal-week">';
    days.forEach((date, i) => {
        const isToday = sameDay(date, today);
        const dayNotes = getNotesOnDay(notes, date);
        html += '<div class="cal-week-col' + (isToday ? ' cal-today' : '') + '">';
        html += '<div class="cal-week-hd"><span>' + dayNames[i] + '</span><strong>' + date.getDate() + '</strong></div>';
        html += '<div class="cal-week-notes">';
        dayNotes.forEach(note => {
            const tag = note.tags && note.tags.length ? allTags.find(t => t.id === note.tags[0]) : null;
            const color = tag ? (TAG_COLORS.find(c => c.id === tag.colorId) || TAG_COLORS[0]).hex : 'var(--primary-color)';
            const overdue = isOverdue(note.dueDate) ? ' cal-overdue' : isDueToday(note.dueDate) ? ' cal-due-today' : '';
            html += '<div class="cal-note-chip' + overdue + '" style="--chip-color:' + color + '" data-note-id="' + note.id + '">' + escapeHtml(extractNoteTitle(note).slice(0, 25)) + '</div>';
        });
        if (dayNotes.length === 0) html += '<div class="cal-empty-day">' + (window.t ? window.t('calendarNoNotesDay') : 'No notes') + '</div>';
        html += '</div></div>';
    });
    html += '</div>';
    return html;
}

// ── Agenda View ───────────────────────────────────────────────

function buildAgendaView(notes, allTags, today) {
    const year  = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    // Get all notes with dueDate in this month
    const withDue = notes.filter(n => {
        if (!n.dueDate) return false;
        const d = new Date(n.dueDate);
        return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => a.dueDate - b.dueDate);

    // Also include notes created this month
    const created = notes.filter(n => {
        if (withDue.find(w => w.id === n.id)) return false;
        const d = new Date(n.creationTime || n.createdAt || Date.now());
        return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => (b.dueDate || b.lastModified) - (a.dueDate || a.lastModified));

    const all = [...withDue, ...created];
    if (all.length === 0) return '<div class="cal-agenda-empty"><i class="bi bi-calendar-x"></i><p>' + (window.t ? window.t('calendarNoNotes') : 'No notes this month') + '</p></div>';

    let html = '<div class="cal-agenda">';
    for (const note of all) {
        const title = extractNoteTitle(note);
        const tag = note.tags && note.tags.length ? allTags.find(t => t.id === note.tags[0]) : null;
        const color = tag ? (TAG_COLORS.find(c => c.id === tag.colorId) || TAG_COLORS[0]).hex : 'var(--primary-color)';
        const due = note.dueDate ? new Date(note.dueDate) : null;
        const overdue = due && isOverdue(note.dueDate) ? ' cal-overdue' : due && isDueToday(note.dueDate) ? ' cal-due-today' : due && isDueSoon(note.dueDate) ? ' cal-due-soon' : '';
        const dueTxt = due ? formatDateFull(due) : '';
        const pinIcon = note.pinned ? '<i class="bi bi-pin-angle-fill" style="color:var(--primary-color)"></i> ' : '';

        html += '<div class="cal-agenda-item' + overdue + '" data-note-id="' + note.id + '" style="--chip-color:' + color + '">';
        html += '<div class="cal-ai-bar"></div>';
        html += '<div class="cal-ai-body">';
        html += '<div class="cal-ai-title">' + pinIcon + escapeHtml(title) + '</div>';
        if (dueTxt) html += '<div class="cal-ai-due' + (overdue === ' cal-overdue' ? ' overdue' : '') + '"><i class="bi bi-clock"></i> ' + dueTxt + '</div>';
        if (note.tags && note.tags.length) {
            html += '<div class="cal-ai-tags">';
            for (const tagId of note.tags) {
                const t = allTags.find(tt => tt.id === tagId);
                if (t) { const c = TAG_COLORS.find(cc => cc.id === t.colorId) || TAG_COLORS[0]; html += '<span class="note-tag-pill" style="--tag-color:' + c.hex + '">' + escapeHtml(t.name) + '</span>'; }
            }
            html += '</div>';
        }
        html += '</div></div>';
    }
    html += '</div>';
    return html;
}

// ── Calendar helpers ──────────────────────────────────────────

function wireCalendarClicks(modal, notes) {
    modal.querySelectorAll('.cal-note-chip[data-note-id], .cal-agenda-item[data-note-id]').forEach(chip => {
        chip.addEventListener('click', e => {
            e.stopPropagation();
            const note = notes.find(n => n.id === chip.dataset.noteId);
            if (note) openCalendarNotePreview(note, modal);
        });
    });
    // Click on day to create note with due date
    modal.querySelectorAll('.cal-day[data-date]').forEach(dayEl => {
        dayEl.addEventListener('click', e => {
            if (e.target.classList.contains('cal-note-chip')) return;
            const date = new Date(dayEl.dataset.date);
            window._currentNoteDueDate = date.getTime();
            modal.style.display = 'none';
            openModal(null, '', Date.now());
        });
    });
}

function openCalendarNotePreview(note, calModal) {
    const existing = document.getElementById('cal-note-preview-overlay');
    if (existing) existing.remove();

    const _t = (key, fallback) => (window.t ? window.t(key) : fallback);

    const overlay = document.createElement('div');
    overlay.id = 'cal-note-preview-overlay';
    overlay.className = 'cnp-overlay';

    const title = extractNoteTitle(note);
    const due = note.dueDate ? new Date(note.dueDate) : null;
    const dueTxt = due ? formatDateFull(due) : '';
    const created = new Date(note.creationTime || note.createdAt || Date.now());
    const _lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en';
    const _localeMap = { ru:'ru-RU', ua:'uk-UA', pl:'pl-PL', cs:'cs-CZ', sk:'sk-SK', bg:'bg-BG', hr:'hr-HR', sr:'sr-RS', bs:'bs-BA', mk:'mk-MK', sl:'sl-SI' };
    const _locale = _localeMap[_lang] || 'en-US';
    const createdTxt = typeof formatDate === 'function'
        ? formatDate(created, 'short', _lang)
        : created.toLocaleDateString(_locale, { day: 'numeric', month: 'short', year: 'numeric' });

    overlay.innerHTML =
        '<div class="cnp-panel">' +
            '<div class="cnp-header">' +
                '<div class="cnp-title-row">' +
                    (note.pinned ? '<i class="bi bi-pin-angle-fill cnp-pin-icon"></i>' : '') +
                    '<span class="cnp-title" contenteditable="true" spellcheck="false" title="' + _t('clickToRename', 'Click to rename') + '">' + escapeHtml(title) + '</span>' +
                    '<span class="cnp-title-edit-hint"><i class="bi bi-pencil"></i></span>' +
                '</div>' +
                '<button class="cnp-close" id="cnp-close-btn" aria-label="Close"><i class="bi bi-x-lg"></i></button>' +
            '</div>' +
            '<div class="cnp-meta">' +
                (dueTxt ? '<span class="cnp-meta-item' + (isOverdue(note.dueDate) ? ' cnp-overdue' : isDueToday(note.dueDate) ? ' cnp-due-today' : '') + '"><i class="bi bi-clock"></i> ' + dueTxt + '</span>' : '') +
                '<span class="cnp-meta-item"><i class="bi bi-calendar-plus"></i> ' + createdTxt + '</span>' +
            '</div>' +
            '<div class="cnp-body"></div>' +
            '<div class="cnp-footer">' +
                '<button class="cnp-btn cnp-btn-edit" id="cnp-edit-btn"><i class="bi bi-pencil"></i> ' + _t('edit', 'Edit') + '</button>' +
                '<button class="cnp-btn cnp-btn-delete" id="cnp-delete-btn"><i class="bi bi-trash3"></i> ' + _t('delete', 'Delete') + '</button>' +
                '<button class="cnp-btn cnp-btn-cancel" id="cnp-cancel-btn"><i class="bi bi-x-lg"></i> ' + _t('cancel', 'Cancel') + '</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    // Populate body via DOM (not innerHTML) so iframes load correctly
    const cnpBody = overlay.querySelector('.cnp-body');
    const bodyFrag = document.createElement('div');
    bodyFrag.innerHTML = window.DOMPurify
        ? window.DOMPurify.sanitize(note.content || '', {
            ADD_TAGS: ['iframe', 'video', 'source'],
            ADD_ATTR: ['allowfullscreen', 'frameborder', 'scrolling', 'allow', 'src', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop']
        })
        : '';
    if (window.restrictIframeEmbeds) window.restrictIframeEmbeds(bodyFrag);
    // Convert aspect-ratio style to padding-top trick so iframe is visible before layout
    bodyFrag.querySelectorAll('.lne-video-wrapper, .video-embed-wrapper').forEach(wrapper => {
        let ratio = 9 / 16; // default 16:9
        const ar = wrapper.style.aspectRatio;
        if (ar) {
            const parts = ar.split('/').map(Number);
            if (parts.length === 2 && parts[0] && parts[1]) ratio = parts[1] / parts[0];
        } else {
            // Try to read from iframe/video attributes
            const el = wrapper.querySelector('iframe, video');
            const w = el && (el.getAttribute('width') || el.width);
            const h = el && (el.getAttribute('height') || el.height);
            if (w && h && parseInt(w) && parseInt(h)) ratio = parseInt(h) / parseInt(w);
        }
        wrapper.style.paddingTop = (ratio * 100).toFixed(4) + '%';
        wrapper.style.height = '0';
        wrapper.style.aspectRatio = '';
        wrapper.style.maxWidth = '100%';
    });
    while (bodyFrag.firstChild) cnpBody.appendChild(bodyFrag.firstChild);

    const close = () => overlay.remove();

    // ── Editable title ────────────────────────────────────────────
    const titleEl = overlay.querySelector('.cnp-title');
    let _titleOriginal = title;

    const showTitleToast = (msg, ok = true) => {
        const existing = overlay.querySelector('.cnp-title-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'cnp-title-toast' + (ok ? '' : ' cnp-title-toast-err');
        toast.innerHTML = (ok ? '<i class="bi bi-check-lg"></i> ' : '<i class="bi bi-x-lg"></i> ') + msg;
        overlay.querySelector('.cnp-header').appendChild(toast);
        setTimeout(() => toast.remove(), 2200);
    };

    const saveTitle = async () => {
        const newTitle = titleEl.textContent.trim();
        if (!newTitle || newTitle === _titleOriginal) return;
        _titleOriginal = newTitle;
        try {
            const ts = Date.now();
            let updContent = note.content || '';
            const tmpDiv = document.createElement('div');
            tmpDiv.innerHTML = updContent;
            const firstHeading = tmpDiv.querySelector('h1,h2,h3,h4,h5,h6');
            if (firstHeading && firstHeading.textContent.trim() === (note.title || extractNoteTitle(note))) {
                firstHeading.textContent = newTitle;
                updContent = tmpDiv.innerHTML;
            }
            await notesDB.saveNote({
                id: note.id,
                content: updContent,
                creationTime: note.creationTime,
                lastModified: ts,
                title: newTitle,
                tags: note.tags || [],
                dueDate: note.dueDate || null
            });
            note.title = newTitle;
            note.content = updContent;
            showTitleToast(_t('titleSaved', 'Title saved'));
            if (typeof loadNotes === 'function') await loadNotes();
            const calModalEl = document.getElementById('calendarModal');
            if (calModalEl && calModalEl.style.display !== 'none') {
                await renderCalendar(calModalEl);
            }
        } catch (e) {
            console.error('Title save error:', e);
            showTitleToast(_t('error', 'Error'), false);
        }
    };

    titleEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
        if (e.key === 'Escape') { titleEl.textContent = _titleOriginal; titleEl.blur(); }
    });
    titleEl.addEventListener('blur', saveTitle);

    // Pencil icon focuses the title for editing
    overlay.querySelector('.cnp-title-edit-hint').addEventListener('click', () => {
        titleEl.focus();
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(titleEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    });

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#cnp-close-btn').addEventListener('click', close);
    overlay.querySelector('#cnp-cancel-btn').addEventListener('click', close);

    overlay.querySelector('#cnp-edit-btn').addEventListener('click', () => {
        close();
        calModal.style.display = 'none';
        openModal(note.id, note.content, note.creationTime);
    });

    overlay.querySelector('#cnp-delete-btn').addEventListener('click', () => {
        const _t2 = (key, fallback) => (window.t ? window.t(key) : fallback);
        const msg = _t2('confirmDeleteOneNote', 'Delete this note? This cannot be undone.');

        // Show confirm inline — above all overlays
        const confirmOverlay = document.createElement('div');
        confirmOverlay.className = 'cnp-confirm-overlay';
        confirmOverlay.innerHTML =
            '<div class="cnp-confirm-box">' +
                '<p class="cnp-confirm-msg">' + escapeHtml(msg) + '</p>' +
                '<div class="cnp-confirm-btns">' +
                    '<button class="cnp-btn cnp-btn-delete" id="cnp-confirm-yes"><i class="bi bi-trash3"></i> ' + _t2('delete', 'Delete') + '</button>' +
                    '<button class="cnp-btn cnp-btn-cancel" id="cnp-confirm-no"><i class="bi bi-x-lg"></i> ' + _t2('cancel', 'Cancel') + '</button>' +
                '</div>' +
            '</div>';
        overlay.appendChild(confirmOverlay);

        confirmOverlay.querySelector('#cnp-confirm-no').addEventListener('click', () => confirmOverlay.remove());
        confirmOverlay.querySelector('#cnp-confirm-yes').addEventListener('click', async () => {
            confirmOverlay.remove();
            try {
                await notesDB.deleteNote(note.id);
                if (typeof notesDB.deleteVersionsForNote === 'function') await notesDB.deleteVersionsForNote(note.id);
                close();
                await loadNotes();
                const calModalEl = document.getElementById('calendarModal');
                if (calModalEl && calModalEl.style.display !== 'none') {
                    await renderCalendar(calModalEl);
                }
            } catch (e) {
                console.error('Delete error:', e);
            }
        });
    });

    // Highlight code blocks if hljs available
    setTimeout(() => {
        if (typeof hljs !== 'undefined') hljs.highlightAll();
    }, 80);
}

function getNotesOnDay(notes, date) {
    return notes.filter(n => {
        if (n.dueDate && sameDay(new Date(n.dueDate), date)) return true;
        const cd = new Date(n.creationTime || n.createdAt || Date.now());
        return sameDay(cd, date);
    });
}

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // 0=Mon
    d.setDate(d.getDate() - day);
    return d;
}

function formatDateShort(d) {
    return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
}

function formatDateFull(d) {
    if (typeof formatDate === 'function') {
        return formatDate(d, 'medium', typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : null);
    }
    const localeMap = { ru:'ru-RU', ua:'uk-UA', pl:'pl-PL', cs:'cs-CZ', sk:'sk-SK', bg:'bg-BG', hr:'hr-HR', sr:'sr-RS', bs:'bs-BA', mk:'mk-MK', sl:'sl-SI' };
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en';
    const locale = localeMap[lang] || 'en-US';
    return d.toLocaleDateString(locale, { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function extractNoteTitle(note) {
    if (note.title) return note.title;
    const div = document.createElement('div');
    div.innerHTML = window.DOMPurify
        ? window.DOMPurify.sanitize(note.content || '', { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
        : '';
    return div.textContent.trim().slice(0, 60) || 'Untitled';
}

function escapeAttr(str) {
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

// ─────────────────────────────────────────────────────────────
// FILTER NOTES BY ACTIVE TAG
// ─────────────────────────────────────────────────────────────

function applyTagFilter(notes) {
    if (!activeTagFilter) return notes;
    return notes.filter(n => n.tags && n.tags.includes(activeTagFilter));
}

// ─────────────────────────────────────────────────────────────
// TAG PANEL FLOATING POPUP
// ─────────────────────────────────────────────────────────────

function showTagsPanel() {
    var existing = document.getElementById('tagsFloatPanel');
    if (existing) { existing.remove(); return; }

    var panel = document.createElement('div');
    panel.id = 'tagsFloatPanel';
    panel.className = 'tags-float-panel';
    document.body.appendChild(panel);

    // Position under button
    var btn = document.getElementById('tagsFilterBtn');
    if (btn) {
        var r = btn.getBoundingClientRect();
        panel.style.top = (r.bottom + 6 + window.scrollY) + 'px';
        panel.style.left = r.left + 'px';
    }

    // Fill content (reuse renderTagPanel logic)
    getTags().then(function(tags) {
        notesDB.getAllNotes().then(function(notes) {
            var html = '<div class="tfp-header"><span><i class="bi bi-tags"></i> Tags</span>';
            html += '<div class="tfp-actions"><button class="tfp-add" id="tfpAdd"><i class="bi bi-plus-lg"></i></button>';
            html += '<button class="tfp-close" id="tfpClose"><i class="bi bi-x-lg"></i></button></div></div>';
            html += '<div class="tfp-list">';
            html += '<button class="tfp-item' + (!activeTagFilter ? ' tfp-item-active' : '') + '" data-tag="">';
            html += '<span class="tfp-all-icon"><i class="bi bi-journal-text"></i></span> All notes <span class="tfp-count">' + notes.length + '</span></button>';

            for (var i = 0; i < tags.length; i++) {
                var tag = tags[i];
                var cnt = notes.filter(function(n) { return n.tags && n.tags.includes(tag.id); }).length;
                var color = TAG_COLORS.find(function(c) { return c.id === tag.colorId; }) || TAG_COLORS[0];
                html += '<div class="tfp-row">';
                html += '<button class="tfp-item' + (activeTagFilter === tag.id ? ' tfp-item-active' : '') + '" data-tag="' + tag.id + '" style="--tc:' + color.hex + '">';
                html += '<span class="tfp-dot"></span><span class="tfp-name">' + escapeAttr(tag.name) + '</span><span class="tfp-count">' + cnt + '</span></button>';
                html += '<button class="tfp-edit" data-id="' + tag.id + '"><i class="bi bi-pencil"></i></button>';
                html += '<button class="tfp-del" data-id="' + tag.id + '"><i class="bi bi-trash"></i></button>';
                html += '</div>';
            }
            html += '</div>';
            panel.innerHTML = html;

            // Close
            panel.querySelector('#tfpClose').addEventListener('click', function() { panel.remove(); });
            // Add
            panel.querySelector('#tfpAdd').addEventListener('click', function() { panel.remove(); showTagEditModal(null); });

            // Filter clicks
            panel.querySelectorAll('.tfp-item').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    activeTagFilter = btn.dataset.tag || null;
                    panel.remove();
                    loadNotes();
                    // Update filter indicator on button
                    var tagsBtn = document.getElementById('tagsFilterBtn');
                    if (tagsBtn) {
                        tagsBtn.classList.toggle('active', !!activeTagFilter);
                        tagsBtn.innerHTML = activeTagFilter
                            ? '<i class="bi bi-tags-fill"></i> Tags'
                            : '<i class="bi bi-tags"></i> Tags';
                    }
                });
            });

            // Edit buttons
            panel.querySelectorAll('.tfp-edit').forEach(function(b) {
                b.addEventListener('click', function() {
                    var id = b.dataset.id;
                    getTags().then(function(tgs) {
                        var tag = tgs.find(function(t) { return t.id === id; });
                        if (tag) { panel.remove(); showTagEditModal(tag); }
                    });
                });
            });

            // Delete buttons
            panel.querySelectorAll('.tfp-del').forEach(function(b) {
                b.addEventListener('click', function() {
                    var id = b.dataset.id;
                    getTags().then(function(tgs) {
                        var tag = tgs.find(function(t) { return t.id === id; });
                        if (!tag) return;
                        var _t2 = function(key, fb) { return window.t ? window.t(key) : fb; };
                        var msg = _t2('confirmDeleteTag', 'Delete tag "' + tag.name + '"?').replace('{name}', tag.name);
                        var title = _t2('confirmDeleteTagTitle', 'Delete Tag');
                        var deleteLabel = _t2('delete', 'Delete');
                        var cancelLabel = _t2('cancel', 'Cancel');
                        var ov = document.createElement('div');
                        ov.className = 'lne-modal-ov';
                        ov.innerHTML = '<div class="lne-modal" style="max-width:360px"><div class="lne-mhd"><h3><i class="bi bi-trash"></i> ' + title + '</h3><button class="lne-mclose"><i class="bi bi-x-lg"></i></button></div>' +
                            '<div class="lne-mbody"><p>' + msg + '</p></div>' +
                            '<div class="lne-mft">' +
                            '<button class="lne-mbtn lne-mbtn-sec lne-mcancel"><i class="bi bi-x-lg"></i> ' + cancelLabel + '</button>' +
                            '<button class="lne-mbtn lne-mbtn-danger lne-mok"><i class="bi bi-trash"></i> ' + deleteLabel + '</button>' +
                            '</div></div>';
                        document.body.appendChild(ov);
                        var closeOv = function() { if (ov.parentNode) document.body.removeChild(ov); };
                        ov.querySelector('.lne-mclose').addEventListener('click', closeOv);
                        ov.querySelector('.lne-mcancel').addEventListener('click', closeOv);
                        ov.addEventListener('click', function(e2) { if (e2.target === ov) closeOv(); });
                        ov.querySelector('.lne-mok').addEventListener('click', function() {
                            closeOv();
                            deleteTag(id).then(function() {
                                if (activeTagFilter === id) {
                                    activeTagFilter = null;
                                    var tagsBtn = document.getElementById('tagsFilterBtn');
                                    if (tagsBtn) tagsBtn.classList.remove('active');
                                }
                                loadNotes();
                                panel.remove();
                                showTagsPanel();
                            });
                        });
                    });
                });
            });
        });
    });

    // Close on outside click
    setTimeout(function() {
        document.addEventListener('click', function outside(e) {
            if (!panel.contains(e.target) && e.target.id !== 'tagsFilterBtn' && !e.target.closest('#tagsFilterBtn')) {
                panel.remove();
                document.removeEventListener('click', outside);
            }
        });
    }, 10);
}

window.showTagsPanel = showTagsPanel;

// Calendar and tags panel wired via initializeEventListeners in index.js

window.TagsCalendar = { getTags, saveTags, createTag, deleteTag, addTagToNote, removeTagFromNote, renderTagPanel, renderNoteTagEditor, renderNoteDueDate, getNoteMetaFromModal, applyTagFilter, openCalendar, TAG_COLORS };
