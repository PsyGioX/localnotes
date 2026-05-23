/**
 * Task Board (Kanban) mode for Local Notes
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'taskBoardMode';
    const ORDER_KEY = 'taskBoardOrder';
    const FILTER_KEY = 'taskBoardFilter';
    const SORT_KEY = 'taskBoardSort';

    const COLUMNS = [
        { id: 'todo', icon: 'bi-circle', accent: '#6c757d' },
        { id: 'in_progress', icon: 'bi-arrow-repeat', accent: '#4a86e8' },
        { id: 'done', icon: 'bi-check-circle-fill', accent: '#28a745' }
    ];

    function t(key, fallback) {
        if (typeof window.t === 'function') {
            const v = window.t(key);
            if (v) return v;
        }
        return fallback;
    }

    function esc(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function getLang() {
        if (typeof getCurrentLanguage === 'function') return getCurrentLanguage();
        return window.currentLang || 'en';
    }

    function columnTitle(id) {
        const map = {
            todo: ['taskColTodo', 'To do'],
            in_progress: ['taskColInProgress', 'In progress'],
            done: ['taskColDone', 'Done']
        };
        const pair = map[id] || [id, id];
        return t(pair[0], pair[1]);
    }

    function normalizeStatus(note) {
        const s = note && note.taskStatus;
        if (s === 'in_progress' || s === 'done' || s === 'todo') return s;
        return 'todo';
    }

    function getOrderMap() {
        try {
            return JSON.parse(localStorage.getItem(ORDER_KEY) || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    function saveOrderMap(map) {
        localStorage.setItem(ORDER_KEY, JSON.stringify(map));
    }

    function cardSortKey(note, orderMap) {
        const sort = localStorage.getItem(SORT_KEY) || 'manual';
        if (sort === 'due') {
            return note.dueDate ? note.dueDate : Number.MAX_SAFE_INTEGER;
        }
        if (sort === 'priority') {
            const p = { high: 0, medium: 1, low: 2 };
            return p[note.taskPriority] != null ? p[note.taskPriority] : 3;
        }
        const col = normalizeStatus(note);
        const list = orderMap[col] || [];
        const idx = list.indexOf(note.id);
        return idx >= 0 ? idx : list.length + (note.lastModified || 0) / 1e15;
    }

    function sortNotes(notes, orderMap) {
        const sort = localStorage.getItem(SORT_KEY) || 'manual';
        const copy = notes.slice();
        copy.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            const ka = cardSortKey(a, orderMap);
            const kb = cardSortKey(b, orderMap);
            if (sort === 'due') return ka - kb;
            if (sort === 'priority') return ka - kb;
            return ka - kb;
        });
        return copy;
    }

    function stripPreview(html, maxLen) {
        const d = document.createElement('div');
        d.innerHTML = typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(html || '', { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
            : (html || '');
        let text = (d.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) text = t('taskUntitled', 'Untitled');
        return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    }

    function noteTitle(note) {
        if (note.title && note.title !== 'Untitled') return note.title;
        if (typeof window.notesDB !== 'undefined' && window.notesDB.extractTitle) {
            return window.notesDB.extractTitle(note.content || '');
        }
        return stripPreview(note.content, 60);
    }

    function getChecklistPct(content) {
        if (typeof getChecklistProgress === 'function') {
            const p = getChecklistProgress(content);
            if (p && p.total > 0) return Math.round((p.checked / p.total) * 100);
        }
        return null;
    }

    function matchesFilter(note) {
        const f = localStorage.getItem(FILTER_KEY) || 'all';
        if (f === 'all') return true;
        if (f === 'overdue') {
            return note.dueDate && typeof isOverdue === 'function' && isOverdue(note.dueDate);
        }
        if (f === 'priority') {
            return note.taskPriority === 'high' || note.taskPriority === 'medium';
        }
        if (f.startsWith('tag:')) {
            const tagId = f.slice(4);
            return (note.tags || []).includes(tagId);
        }
        return true;
    }

    class TaskBoardManager {
        constructor() {
            this._dragId = null;
            this._toolbar = null;
            this._isRendering = false;
        }

        isActive() {
            return localStorage.getItem(STORAGE_KEY) === '1';
        }

        setActive(on) {
            localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
            document.body.classList.toggle('task-board-active', !!on);
            const viewBtn = document.getElementById('toggleViewButton');
            if (viewBtn) viewBtn.style.display = on ? 'none' : '';
            this.updateToggleButton();
            
            // Обновляем кнопку переключения вида при выходе из режима доски задач
            if (!on && window.appUtils && typeof window.appUtils.updateToggleViewButton === 'function') {
                window.appUtils.updateToggleViewButton();
            }
            
            if (typeof loadNotes === 'function') loadNotes();
        }

        toggle() {
            this.setActive(!this.isActive());
        }

        updateToggleButton() {
            const btn = document.getElementById('toggleTaskBoardButton');
            if (!btn) return;
            const on = this.isActive();
            btn.classList.toggle('active', on);
            if (on) {
                btn.innerHTML = `<i class="bi bi-kanban-fill"></i> ${t('taskBoardOff', 'Notes view')}`;
                btn.title = t('taskBoardOffTitle', 'Switch to notes view');
            } else {
                btn.innerHTML = `<i class="bi bi-kanban"></i> ${t('taskBoardOn', 'Task board')}`;
                btn.title = t('taskBoardOnTitle', 'Switch to task board');
            }
        }

        async updateTaskStatus(noteId, status, insertBeforeId) {
            const note = await window.notesDB.getNote(noteId);
            if (!note) return;
            note.taskStatus = status;
            note.lastModified = Date.now();
            await window.notesDB.saveNote(note);

            const orderMap = getOrderMap();
            COLUMNS.forEach(c => {
                orderMap[c.id] = (orderMap[c.id] || []).filter(id => id !== noteId);
            });
            const list = orderMap[status] || [];
            if (insertBeforeId && list.includes(insertBeforeId)) {
                const idx = list.indexOf(insertBeforeId);
                list.splice(idx, 0, noteId);
            } else if (!list.includes(noteId)) {
                list.push(noteId);
            }
            orderMap[status] = list;
            saveOrderMap(orderMap);
        }

        async createQuickTask(title, status) {
            const text = (title || '').trim() || t('taskNewDefault', 'New task');
            const html = `<h1>${esc(text)}</h1><p></p>`;
            const ts = Date.now();
            const note = {
                id: typeof secureNoteId === 'function' ? secureNoteId() : 'note_' + ts,
                content: html,
                creationTime: ts,
                lastModified: ts,
                title: text,
                taskStatus: status || 'todo',
                tags: [],
                dueDate: null,
                color: '',
                pinned: false,
                taskPriority: ''
            };
            if (window.workspacesManager && window.workspacesManager.currentWorkspace) {
                note.workspaceId = window.workspacesManager.currentWorkspace.id;
            }
            await window.notesDB.saveNote(note);
            const orderMap = getOrderMap();
            orderMap[note.taskStatus] = (orderMap[note.taskStatus] || []).concat(note.id);
            saveOrderMap(orderMap);
            if (typeof loadNotes === 'function') await loadNotes();
            if (typeof openModal === 'function') openModal(note.id, note.content, note.creationTime);
        }

        _buildToolbar(allTags) {
            const wrap = document.createElement('div');
            wrap.className = 'tb-toolbar';
            wrap.id = 'taskBoardToolbar';

            const filter = localStorage.getItem(FILTER_KEY) || 'all';
            const sort = localStorage.getItem(SORT_KEY) || 'manual';

            const tagOpts = (allTags || []).map(tag => {
                const c = (typeof TAG_COLORS !== 'undefined' ? TAG_COLORS : []).find(x => x.id === tag.colorId);
                const hex = c ? c.hex : '#aefc6e';
                const sel = filter === 'tag:' + tag.id ? ' active' : '';
                return `<button type="button" class="tb-chip tb-tag-chip${sel}" data-filter="tag:${tag.id}" style="--tag-color:${hex}">${esc(tag.name)}</button>`;
            }).join('');

            wrap.innerHTML = `
                <div class="tb-toolbar-row">
                    <span class="tb-toolbar-label"><i class="bi bi-funnel"></i> ${t('taskBoardFilter', 'Filter')}</span>
                    <button type="button" class="tb-chip${filter === 'all' ? ' active' : ''}" data-filter="all">${t('taskFilterAll', 'All')}</button>
                    <button type="button" class="tb-chip${filter === 'overdue' ? ' active' : ''}" data-filter="overdue">${t('taskFilterOverdue', 'Overdue')}</button>
                    <button type="button" class="tb-chip${filter === 'priority' ? ' active' : ''}" data-filter="priority">${t('taskFilterPriority', 'Priority')}</button>
                    ${tagOpts}
                </div>
                <div class="tb-toolbar-row">
                    <span class="tb-toolbar-label"><i class="bi bi-sort-down"></i> ${t('taskBoardSort', 'Sort')}</span>
                    <button type="button" class="tb-chip${sort === 'manual' ? ' active' : ''}" data-sort="manual">${t('taskSortManual', 'Manual')}</button>
                    <button type="button" class="tb-chip${sort === 'due' ? ' active' : ''}" data-sort="due">${t('taskSortDue', 'Due date')}</button>
                    <button type="button" class="tb-chip${sort === 'priority' ? ' active' : ''}" data-sort="priority">${t('taskSortPriority', 'Priority')}</button>
                </div>`;

            wrap.querySelectorAll('[data-filter]').forEach(btn => {
                btn.addEventListener('click', () => {
                    localStorage.setItem(FILTER_KEY, btn.dataset.filter);
                    if (typeof loadNotes === 'function') loadNotes();
                });
            });
            wrap.querySelectorAll('[data-sort]').forEach(btn => {
                btn.addEventListener('click', () => {
                    localStorage.setItem(SORT_KEY, btn.dataset.sort);
                    if (typeof loadNotes === 'function') loadNotes();
                });
            });
            return wrap;
        }

        _renderCard(note, allTags) {
            const card = document.createElement('article');
            card.className = 'tb-card';
            card.draggable = true;
            card.dataset.noteId = note.id;
            if (note.color) card.style.setProperty('--tb-accent', note.color);
            if (note.pinned) card.classList.add('tb-card-pinned');

            const status = normalizeStatus(note);
            const pri = note.taskPriority || '';
            const priLbl = pri === 'high' ? t('taskPriorityHigh', 'High')
                : pri === 'medium' ? t('taskPriorityMid', 'Medium')
                    : pri === 'low' ? t('taskPriorityLow', 'Low') : '';

            let dueHtml = '';
            if (note.dueDate) {
                const due = new Date(note.dueDate);
                let cls = 'tb-due';
                if (typeof isOverdue === 'function' && isOverdue(note.dueDate)) cls += ' tb-due-overdue';
                else if (typeof isDueToday === 'function' && isDueToday(note.dueDate)) cls += ' tb-due-today';
                const localeMap = { ru: 'ru-RU', ua: 'uk-UA', pl: 'pl-PL', cs: 'cs-CZ', sk: 'sk-SK', bg: 'bg-BG', hr: 'hr-HR', sr: 'sr-RS', bs: 'bs-BA', mk: 'mk-MK', sl: 'sl-SI' };
                const locale = localeMap[getLang()] || 'en-US';
                dueHtml = `<span class="${cls}"><i class="bi bi-clock"></i>${due.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</span>`;
            }

            const pct = getChecklistPct(note.content);
            const progressHtml = pct != null
                ? `<div class="tb-progress"><div class="tb-progress-bar" style="width:${pct}%"></div></div><span class="tb-progress-text">${pct}%</span>`
                : '';

            const tagsHtml = (note.tags || []).map(tid => {
                const tag = (allTags || []).find(x => x.id === tid);
                if (!tag) return '';
                const c = (typeof TAG_COLORS !== 'undefined' ? TAG_COLORS : []).find(x => x.id === tag.colorId);
                const hex = c ? c.hex : '#aefc6e';
                return `<span class="tb-tag" style="--tag-color:${hex}">${esc(tag.name)}</span>`;
            }).join('');

            card.innerHTML = `
                <div class="tb-card-top">
                    <div class="tb-card-badges">
                        ${note.pinned ? '<i class="bi bi-pin-angle-fill tb-pin" title="' + esc(t('pinned', 'Pinned')) + '"></i>' : ''}
                        ${pri ? `<span class="tb-priority tb-priority-${pri}">${esc(priLbl)}</span>` : ''}
                    </div>
                    <button type="button" class="tb-card-menu" aria-label="${esc(t('taskMoveMenu', 'Move task'))}"><i class="bi bi-arrow-left-right"></i></button>
                </div>
                <h3 class="tb-card-title">${esc(noteTitle(note))}</h3>
                <p class="tb-card-preview">${esc(stripPreview(note.content, 120))}</p>
                ${progressHtml ? `<div class="tb-card-progress">${progressHtml}</div>` : ''}
                <div class="tb-card-meta">${dueHtml}${tagsHtml}</div>
                <div class="tb-card-actions">
                    <button type="button" class="tb-btn-edit" title="${esc(t('edit', 'Edit'))}"><i class="bi bi-pencil"></i><span>${esc(t('edit', 'Edit'))}</span></button>
                    <button type="button" class="tb-btn-del" title="${esc(t('delete', 'Delete'))}"><i class="bi bi-trash"></i><span>${esc(t('delete', 'Delete'))}</span></button>
                </div>
                <div class="tb-move-menu" hidden>
                    ${COLUMNS.filter(c => c.id !== status).map(c =>
                        `<button type="button" data-move="${c.id}"><i class="bi ${c.icon}"></i> ${esc(columnTitle(c.id))}</button>`
                    ).join('')}
                </div>`;

            card.addEventListener('dragstart', e => {
                this._dragId = note.id;
                card.classList.add('tb-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', note.id);
            });
            card.addEventListener('dragend', () => {
                this._dragId = null;
                card.classList.remove('tb-dragging');
                document.querySelectorAll('.tb-column-body.drag-over').forEach(el => el.classList.remove('drag-over'));
            });

            card.querySelector('.tb-card-menu').addEventListener('click', e => {
                e.stopPropagation();
                const menu = card.querySelector('.tb-move-menu');
                document.querySelectorAll('.tb-move-menu').forEach(m => { if (m !== menu) m.hidden = true; });
                menu.hidden = !menu.hidden;
            });

            card.querySelector('.tb-btn-edit').addEventListener('click', e => {
                e.stopPropagation();
                if (typeof openModal === 'function') openModal(note.id, note.content, note.creationTime);
            });

            card.querySelector('.tb-btn-del').addEventListener('click', e => {
                e.stopPropagation();
                const msg = t('confirmDeleteOneNote', 'Delete this note?');
                const doDel = async () => {
                    await window.notesDB.deleteNote(note.id);
                    const orderMap = getOrderMap();
                    COLUMNS.forEach(c => {
                        orderMap[c.id] = (orderMap[c.id] || []).filter(id => id !== note.id);
                    });
                    saveOrderMap(orderMap);
                    if (typeof loadNotes === 'function') loadNotes();
                };
                if (typeof showConfirmModal === 'function') {
                    showConfirmModal(msg, doDel);
                } else if (confirm(msg)) doDel();
            });

            card.querySelectorAll('[data-move]').forEach(btn => {
                btn.addEventListener('click', async e => {
                    e.stopPropagation();
                    await this.updateTaskStatus(note.id, btn.dataset.move);
                    if (typeof loadNotes === 'function') loadNotes();
                });
            });

            card.addEventListener('dblclick', () => {
                if (typeof openModal === 'function') openModal(note.id, note.content, note.creationTime);
            });

            return card;
        }

        _wireColumnDrop(colBody, status) {
            colBody.addEventListener('dragover', e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                colBody.classList.add('drag-over');
            });
            colBody.addEventListener('dragleave', e => {
                if (!colBody.contains(e.relatedTarget)) colBody.classList.remove('drag-over');
            });
            colBody.addEventListener('drop', async e => {
                e.preventDefault();
                colBody.classList.remove('drag-over');
                const noteId = e.dataTransfer.getData('text/plain') || this._dragId;
                if (!noteId) return;
                let insertBefore = null;
                const after = document.elementFromPoint(e.clientX, e.clientY);
                const targetCard = after && after.closest('.tb-card');
                if (targetCard && targetCard.dataset.noteId !== noteId) {
                    insertBefore = targetCard.dataset.noteId;
                }
                await this.updateTaskStatus(noteId, status, insertBefore);
                if (typeof loadNotes === 'function') loadNotes();
            });
        }

        async render(notes) {
            // Защита от повторного вызова
            if (this._isRendering) {
                console.warn('Task board is already rendering, skipping duplicate call');
                return;
            }
            
            this._isRendering = true;
            
            try {
                const viewer = document.querySelector('.btn_view_div');
                const notesContainer = document.getElementById('notesContainer');
                const notesCenter = document.querySelector('.notes_center');
                if (!notesContainer) return;

                // Удаляем все существующие доски перед добавлением новой
                const existingBoards = notesContainer.querySelectorAll('.tb-board');
                existingBoards.forEach(board => board.remove());
                
                notesContainer.innerHTML = '';
                notesContainer.className = 'task-board-view';
                if (notesCenter) notesCenter.classList.add('task-board-center');

            const filtered = (notes || []).filter(matchesFilter);
            const allTags = typeof getTags === 'function' ? await getTags() : [];

            const toolbar = this._buildToolbar(allTags);
            if (this._toolbar && this._toolbar.parentNode) this._toolbar.remove();
            this._toolbar = toolbar;
            if (notesCenter) {
                notesCenter.insertBefore(toolbar, notesContainer);
            } else {
                notesContainer.insertBefore(toolbar, notesContainer.firstChild);
            }

            if (filtered.length === 0) {
                if (viewer) viewer.style.display = '';
                const existingWelcome = document.querySelector('.welcome-message');
                if (existingWelcome) existingWelcome.remove();

                const filter = localStorage.getItem(FILTER_KEY) || 'all';
                const hasActiveFilter = filter !== 'all';
                const empty = document.createElement('div');
                empty.className = 'tb-empty-state';
                empty.innerHTML = `
                    <div class="tb-empty-icon"><i class="bi ${hasActiveFilter ? 'bi-funnel' : 'bi-kanban'}"></i></div>
                    <p>${t('taskBoardEmpty', 'No tasks match the filter. Create a task or change the filter.')}</p>
                    ${hasActiveFilter ? `<button type="button" class="tb-empty-clear"><i class="bi bi-x-circle"></i> ${esc(t('taskFilterClear', 'Clear filter'))}</button>` : ''}`;
                if (hasActiveFilter) {
                    empty.querySelector('.tb-empty-clear').addEventListener('click', () => {
                        localStorage.setItem(FILTER_KEY, 'all');
                        if (typeof loadNotes === 'function') loadNotes();
                    });
                }
                notesContainer.appendChild(empty);
                if (typeof showWelcomeMessage === 'function' && (notes || []).length === 0) {
                    showWelcomeMessage();
                }
                return;
            }

            if (viewer) viewer.style.display = '';
            const existingWelcome = document.querySelector('.welcome-message');
            if (existingWelcome) existingWelcome.remove();

            const board = document.createElement('div');
            board.className = 'tb-board';

            const orderMap = getOrderMap();
            const columnsWrap = document.createElement('div');
            columnsWrap.className = 'tb-columns';

            COLUMNS.forEach(col => {
                const colNotes = sortNotes(filtered.filter(n => normalizeStatus(n) === col.id), orderMap);
                const colEl = document.createElement('section');
                colEl.className = 'tb-column';
                colEl.dataset.status = col.id;
                colEl.style.setProperty('--tb-col-accent', col.accent);

                colEl.innerHTML = `
                    <header class="tb-column-header">
                        <span class="tb-column-icon" aria-hidden="true"><i class="bi ${col.icon}"></i></span>
                        <div class="tb-column-title-wrap">
                            <h2>${esc(columnTitle(col.id))}</h2>
                            <span class="tb-column-count">${colNotes.length}</span>
                        </div>
                    </header>
                    <div class="tb-column-body"></div>
                    <footer class="tb-column-footer">
                        <input type="text" class="tb-quick-input" placeholder="${esc(t('taskAddPlaceholder', 'Add a task…'))}" autocomplete="off">
                        <button type="button" class="tb-quick-add" title="${esc(t('taskAddCard', 'Add task'))}"><i class="bi bi-plus-lg"></i></button>
                    </footer>`;

                const body = colEl.querySelector('.tb-column-body');
                colNotes.forEach(note => body.appendChild(this._renderCard(note, allTags)));

                if (colNotes.length === 0) {
                    const ph = document.createElement('p');
                    ph.className = 'tb-column-empty';
                    ph.textContent = t('taskEmptyColumn', 'Drop tasks here');
                    body.appendChild(ph);
                }

                this._wireColumnDrop(body, col.id);

                const input = colEl.querySelector('.tb-quick-input');
                const addBtn = colEl.querySelector('.tb-quick-add');
                const submitQuick = () => {
                    const val = input.value;
                    input.value = '';
                    if (val.trim()) this.createQuickTask(val, col.id);
                };
                addBtn.addEventListener('click', submitQuick);
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { e.preventDefault(); submitQuick(); }
                });

                columnsWrap.appendChild(colEl);
            });

            board.appendChild(columnsWrap);
            notesContainer.appendChild(board);

            document.addEventListener('click', this._closeMenus, { once: true });
            } finally {
                this._isRendering = false;
            }
        }

        _closeMenus() {
            document.querySelectorAll('.tb-move-menu').forEach(m => { m.hidden = true; });
        }

        restore() {
            const on = this.isActive();
            document.body.classList.toggle('task-board-active', on);
            const viewBtn = document.getElementById('toggleViewButton');
            if (viewBtn) viewBtn.style.display = on ? 'none' : '';
            this.updateToggleButton();
            
            // Обновляем кнопку переключения вида при восстановлении
            if (!on && window.appUtils && typeof window.appUtils.updateToggleViewButton === 'function') {
                window.appUtils.updateToggleViewButton();
            }
        }

        init() {
            this.restore();
            const btn = document.getElementById('toggleTaskBoardButton');
            if (btn) {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    this.toggle();
                });
            }
            document.addEventListener('click', () => this._closeMenus());
        }
    }

    window.taskBoard = new TaskBoardManager();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.taskBoard.init());
    } else {
        window.taskBoard.init();
    }
})();
