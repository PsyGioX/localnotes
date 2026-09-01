/**
 * Workspaces Manager
 */

class WorkspacesManager {
    constructor() {
        this.currentWorkspace = null;
        this.workspaces = [];
        this._init();
    }

    async _init() {
        await this.loadWorkspaces();
        if (this.workspaces.length === 0) {
            await this.createWorkspace('Default', true);
        }
        this.currentWorkspace = this.workspaces.find(w => w.isDefault) || this.workspaces[0];
        this._waitForDOM(() => {
            this.renderWorkspaceTabs();
            this.attachEventListeners();
        });
    }

    _waitForDOM(fn) {
        if (document.querySelector('.center_nav')) {
            fn();
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    }

    async loadWorkspaces() {
        try {
            const stored = localStorage.getItem('ln_workspaces');
            if (stored) this.workspaces = JSON.parse(stored);
        } catch (e) {
            this.workspaces = [];
        }
    }

    async saveWorkspaces() {
        try {
            localStorage.setItem('ln_workspaces', JSON.stringify(this.workspaces));
        } catch (e) { /* ignore */ }
    }

    async createWorkspace(name, isDefault = false) {
        const id = 'ws_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        if (isDefault) this.workspaces.forEach(w => { w.isDefault = false; });
        const ws = { id, name, isDefault, createdAt: Date.now(), color: this._randomColor() };
        this.workspaces.push(ws);
        await this.saveWorkspaces();
        return ws;
    }

    async deleteWorkspace(workspaceId) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (!ws) return;
        if (ws.isDefault && this.workspaces.length > 1) {
            const msg = (typeof window.t === 'function' && window.t('cannotDeleteDefaultWorkspace'))
                || 'Cannot delete the default workspace. Set another as default first.';
            throw new Error(msg);
        }
        if (typeof window.notesDB !== 'undefined') {
            try {
                const notes = await window.notesDB.getAllNotes();
                for (const note of notes.filter(n => n.workspaceId === workspaceId)) {
                    await window.notesDB.deleteNote(note.id);
                }
            } catch (e) { /* ignore */ }
        }
        this.workspaces = this.workspaces.filter(w => w.id !== workspaceId);
        await this.saveWorkspaces();
        if (this.currentWorkspace && this.currentWorkspace.id === workspaceId) {
            this.currentWorkspace = this.workspaces[0] || null;
        }
    }

    async renameWorkspace(workspaceId, newName) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (ws) { ws.name = newName; await this.saveWorkspaces(); }
    }

    async setDefaultWorkspace(workspaceId) {
        this.workspaces.forEach(w => { w.isDefault = (w.id === workspaceId); });
        await this.saveWorkspaces();
    }

    switchWorkspace(workspaceId) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (!ws) return;
        this.currentWorkspace = ws;
        this.renderWorkspaceTabs();
        if (typeof loadNotes === 'function') loadNotes();
    }

    _randomColor() {
        const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#E91E63', '#FF5722'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    _t(key, fallback) {
        return (typeof window.t === 'function' && window.t(key)) || fallback;
    }

    _escHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    filterNotesByWorkspace(notes) {
        if (!this.currentWorkspace) return notes;
        const defaultWs = this.workspaces.find(w => w.isDefault);
        const defaultId = defaultWs ? defaultWs.id : null;
        return notes.filter(n => {
            const nwid = n.workspaceId || defaultId;
            return nwid === this.currentWorkspace.id;
        });
    }

    // ── Рендер вкладок ───────────────────────────────────────────────────────
    renderWorkspaceTabs() {
        let container = document.getElementById('workspaceTabsContainer');
        if (!container) {
            const centerNav = document.querySelector('.center_nav');
            if (!centerNav) return;
            container = document.createElement('div');
            container.id = 'workspaceTabsContainer';
            container.className = 'workspace-tabs-container';
            centerNav.insertBefore(container, centerNav.firstChild);
        }

        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'workspace-tabs-wrapper';

        this.workspaces.forEach(ws => {
            const tab = document.createElement('div');
            tab.className = 'workspace-tab' + (this.currentWorkspace && this.currentWorkspace.id === ws.id ? ' active' : '');
            tab.dataset.wsId = ws.id;
            // Передаём цвет пространства как CSS-переменную для верхней черты
            tab.style.setProperty('--ws-accent', ws.color);
            tab.innerHTML =
                '<span class="workspace-tab-color" style="background:' + ws.color + '"></span>' +
                '<span class="workspace-tab-name">' + this._escHtml(ws.name) + '</span>' +
                (ws.isDefault ? '<span class="workspace-tab-default" title="Default">★</span>' : '') +
                '<button class="workspace-tab-menu" data-ws-id="' + ws.id + '" title="Options">⋮</button>';

            tab.addEventListener('click', e => {
                if (!e.target.closest('.workspace-tab-menu')) {
                    this.switchWorkspace(ws.id);
                }
            });
            wrapper.appendChild(tab);
        });

        // Скроллим активную вкладку в видимую зону
        requestAnimationFrame(() => {
            const activeTab = wrapper.querySelector('.workspace-tab.active');
            if (activeTab) {
                activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            }
        });

        // Кнопка + вынесена из wrapper — не скроллируется
        const addBtn = document.createElement('button');
        addBtn.className = 'workspace-tab-add';
        addBtn.innerHTML = '<i class="bi bi-plus-lg"></i>';
        addBtn.title = this._t('addWorkspace', 'Add workspace');
        addBtn.addEventListener('click', () => { this._promptCreate(); });

        container.appendChild(wrapper);
        container.appendChild(addBtn);

        // Горизонтальный скролл колёсиком мыши на ПК
        wrapper.addEventListener('wheel', e => {
            if (e.deltaY === 0) return;
            e.preventDefault();
            wrapper.scrollLeft += e.deltaY;
        }, { passive: false });

        // Drag-scroll зажатием ЛКМ
        let isDragging = false;
        let dragStartX = 0;
        let scrollStartLeft = 0;

        wrapper.addEventListener('mousedown', e => {
            // Только ЛКМ, не по кнопкам внутри
            if (e.button !== 0 || e.target.closest('button')) return;
            isDragging = true;
            dragStartX = e.clientX;
            scrollStartLeft = wrapper.scrollLeft;
            wrapper.style.cursor = 'grabbing';
            wrapper.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartX;
            wrapper.scrollLeft = scrollStartLeft - dx;
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            wrapper.style.cursor = '';
            wrapper.style.userSelect = '';
        });
    }

    // ── Делегирование клика по кнопке ⋮ ──────────────────────────────────────
    attachEventListeners() {
        document.addEventListener('click', e => {
            const btn = e.target.closest('.workspace-tab-menu');
            if (btn) {
                e.stopPropagation();
                this._showMenu(btn.dataset.wsId, btn);
            }
        });
    }

    // ── Контекстное меню ──────────────────────────────────────────────────────
    _showMenu(workspaceId, anchor) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (!ws) return;

        document.querySelectorAll('.workspace-menu').forEach(m => m.remove());

        const menu = document.createElement('div');
        menu.className = 'workspace-menu';
        menu.innerHTML =
            '<button class="workspace-menu-item" data-action="rename">' +
                '<i class="bi bi-pencil"></i> ' + this._t('rename', 'Rename') +
            '</button>' +
            '<button class="workspace-menu-item" data-action="color">' +
                '<span class="ws-menu-color-dot" style="background:' + ws.color + '"></span> ' +
                this._t('changeColor', 'Change color') +
            '</button>' +
            (!ws.isDefault
                ? '<button class="workspace-menu-item" data-action="setDefault">' +
                    '<i class="bi bi-star"></i> ' + this._t('setAsDefault', 'Set as default') +
                  '</button>'
                : '') +
            '<button class="workspace-menu-item workspace-menu-item-danger" data-action="delete">' +
                '<i class="bi bi-trash3"></i> ' + this._t('delete', 'Delete') +
            '</button>';

        // Позиционирование — не выходим за края экрана
        const rect = anchor.getBoundingClientRect();
        const menuWidth = 180;
        let left = rect.left - menuWidth + rect.width;
        if (left < 8) left = 8;
        if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
        menu.style.cssText = 'position:fixed;top:' + (rect.bottom + 4) + 'px;left:' + left + 'px;z-index:10002;';
        document.body.appendChild(menu);

        menu.addEventListener('click', e => {
            const item = e.target.closest('[data-action]');
            if (!item) return;
            menu.remove();
            const action = item.dataset.action;
            if (action === 'rename') { this._promptRename(workspaceId); }
            if (action === 'color') { this._pickColor(workspaceId); }
            if (action === 'setDefault') {
                this.setDefaultWorkspace(workspaceId).then(() => { this.renderWorkspaceTabs(); });
            }
            if (action === 'delete') { this._confirmDelete(workspaceId); }
        });

        const outside = e => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', outside, true);
            }
        };
        setTimeout(() => { document.addEventListener('click', outside, true); }, 0);
    }

    // ── Диалог создания ───────────────────────────────────────────────────────
    _promptCreate() {
        showCustomPrompt(
            this._t('createWorkspace', 'Create Workspace'),
            this._t('enterWorkspaceName', 'Workspace name:'),
            this._t('newWorkspace', 'New Workspace'),
            name => {
                if (!name || !name.trim()) return;
                this.createWorkspace(name.trim()).then(() => { this.renderWorkspaceTabs(); });
            }
        );
    }

    // ── Диалог переименования ─────────────────────────────────────────────────
    _promptRename(workspaceId) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (!ws) return;
        showCustomPrompt(
            this._t('renameWorkspace', 'Rename Workspace'),
            this._t('enterNewName', 'New name:'),
            ws.name,
            newName => {
                if (!newName || !newName.trim()) return;
                this.renameWorkspace(workspaceId, newName.trim()).then(() => { this.renderWorkspaceTabs(); });
            }
        );
    }

    // ── Выбор цвета пространства ──────────────────────────────────────────────
    _pickColor(workspaceId) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (!ws) return;

        document.querySelectorAll('.ws-color-picker').forEach(p => p.remove());

        const colors = [
            '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
            '#F44336', '#00BCD4', '#E91E63', '#FF5722',
            '#607D8B', '#795548', '#FFEB3B', '#8BC34A',
            '#3F51B5', '#009688', '#FF4081', '#aefc6e'
        ];

        const picker = document.createElement('div');
        picker.className = 'ws-color-picker';

        const grid = document.createElement('div');
        grid.className = 'ws-color-grid';

        colors.forEach(color => {
            const swatch = document.createElement('button');
            swatch.className = 'ws-color-swatch' + (ws.color === color ? ' active' : '');
            swatch.style.background = color;
            swatch.title = color;
            swatch.addEventListener('click', () => {
                picker.remove();
                ws.color = color;
                this.saveWorkspaces().then(() => { this.renderWorkspaceTabs(); });
            });
            grid.appendChild(swatch);
        });

        picker.appendChild(grid);

        // Позиционируем под вкладкой пространства
        const tab = document.querySelector('.workspace-tab[data-ws-id="' + workspaceId + '"]');
        const anchor = tab || document.body;
        const rect = anchor.getBoundingClientRect();
        const pickerWidth = 176;
        let left = rect.left;
        if (left + pickerWidth > window.innerWidth - 8) left = window.innerWidth - pickerWidth - 8;
        if (left < 8) left = 8;
        picker.style.cssText = 'position:fixed;top:' + (rect.bottom + 6) + 'px;left:' + left + 'px;z-index:10003;';
        document.body.appendChild(picker);

        const outside = e => {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', outside, true);
            }
        };
        setTimeout(() => { document.addEventListener('click', outside, true); }, 0);
    }

    // ── Диалог удаления ───────────────────────────────────────────────────────
    _confirmDelete(workspaceId) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (!ws) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';

        const contentError = document.createElement('div');
        contentError.className = 'modal-content-error';

        const inner = document.createElement('div');
        inner.className = 'modal-content-inner';

        const h3 = document.createElement('h3');
        h3.style.cssText = 'display:flex;align-items:center;gap:10px;color:#f44336;margin-bottom:16px;font-size:1.1rem;';
        h3.innerHTML = '<i class="bi bi-trash3" style="font-size:1.1rem;flex-shrink:0;"></i><span>' +
            this._t('deleteWorkspace', 'Delete Workspace') + '</span>';

        const p1 = document.createElement('p');
        p1.style.cssText = 'margin:0 0 12px;line-height:1.65;font-size:14.5px;color:var(--text-color);';
        p1.innerHTML = this._t('deleteWorkspaceConfirm', 'Delete workspace "{name}"? All its notes will be removed.')
            .replace('{name}', '<strong style="color:var(--primary-color);">' + this._escHtml(ws.name) + '</strong>');

        const p2 = document.createElement('p');
        p2.style.cssText = 'margin:0;font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;';
        p2.innerHTML = '<i class="bi bi-exclamation-triangle" style="color:#ffc107;font-size:13px;flex-shrink:0;"></i>' +
            '<span>' + this._t('clearAllWarning', 'This action is irreversible!') + '</span>';

        inner.appendChild(h3);
        inner.appendChild(p1);
        inner.appendChild(p2);

        const btns = document.createElement('div');
        btns.className = 'modal-buttons-container';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn ws-delete-confirm-btn';
        confirmBtn.style.cssText = 'background:#f44336;color:#fff;border-color:#f44336;';
        confirmBtn.innerHTML = '<i class="bi bi-trash3"></i> ' + this._t('delete', 'Delete');

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn cancel ws-delete-cancel-btn';
        cancelBtn.innerHTML = '<i class="bi bi-x-lg"></i> ' + this._t('cancel', 'Cancel');

        btns.appendChild(confirmBtn);
        btns.appendChild(cancelBtn);
        contentError.appendChild(inner);
        contentError.appendChild(btns);
        modal.appendChild(contentError);
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');

        const close = () => {
            modal.remove();
            document.body.classList.remove('modal-open');
        };

        confirmBtn.addEventListener('click', () => {
            close();
            this.deleteWorkspace(workspaceId).then(() => {
                this.renderWorkspaceTabs();
                if (typeof loadNotes === 'function') loadNotes();
            }).catch(err => {
                showCustomAlert(this._t('error', 'Error'), err.message, 'error');
            });
        });

        cancelBtn.addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });

        const escHandler = e => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                close();
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // ── Выбор пространства при сохранении ────────────────────────────────────
    showWorkspaceSelector() {
        // With a single workspace there's nothing to actually choose — the
        // modal was pure extra friction on every save (open modal, click the
        // only option). Resolve immediately with it instead.
        if (this.workspaces.length <= 1) {
            const only = this.workspaces[0];
            return Promise.resolve(only ? only.id : null);
        }
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'ws-selector-overlay';

            const box = document.createElement('div');
            box.className = 'ws-selector-box';

            const title = document.createElement('h3');
            title.className = 'ws-selector-title';
            title.textContent = this._t('selectWorkspace', 'Select Workspace');

            const hint = document.createElement('p');
            hint.className = 'ws-selector-hint';
            hint.textContent = this._t('selectWorkspaceHint', 'Choose a workspace to save this note:');

            const list = document.createElement('div');
            list.className = 'ws-selector-list';

            this.workspaces.forEach(ws => {
                const item = document.createElement('button');
                item.className = 'ws-selector-item' + (this.currentWorkspace && this.currentWorkspace.id === ws.id ? ' current' : '');
                item.innerHTML =
                    '<span class="ws-selector-dot" style="background:' + ws.color + '"></span>' +
                    '<span class="ws-selector-name">' + this._escHtml(ws.name) + '</span>' +
                    (ws.isDefault ? '<span class="ws-selector-star">★</span>' : '');
                item.addEventListener('click', () => { overlay.remove(); resolve(ws.id); });
                list.appendChild(item);
            });

            const actions = document.createElement('div');
            actions.className = 'ws-selector-actions';

            const newBtn = document.createElement('button');
            newBtn.className = 'ws-selector-btn-new';
            newBtn.innerHTML = '<i class="bi bi-plus-lg"></i> ' + this._t('createNewWorkspace', 'Create New');
            newBtn.addEventListener('click', () => {
                overlay.remove();
                showCustomPrompt(
                    this._t('createWorkspace', 'Create Workspace'),
                    this._t('enterWorkspaceName', 'Workspace name:'),
                    this._t('newWorkspace', 'New Workspace'),
                    name => {
                        if (!name || !name.trim()) { resolve(null); return; }
                        this.createWorkspace(name.trim()).then(created => {
                            this.renderWorkspaceTabs();
                            resolve(created.id);
                        });
                    }
                );
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'ws-selector-btn-cancel';
            cancelBtn.innerHTML = '<i class="bi bi-x-lg"></i> ' + this._t('cancel', 'Cancel');
            cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(null); });

            actions.appendChild(newBtn);
            actions.appendChild(cancelBtn);
            box.appendChild(title);
            box.appendChild(hint);
            box.appendChild(list);
            box.appendChild(actions);
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', e => {
                if (e.target === overlay) { overlay.remove(); resolve(null); }
            });
        });
    }
}

// ── Глобальный экземпляр ──────────────────────────────────────────────────────
let workspacesManager = null;

function _initWorkspacesManager() {
    workspacesManager = new WorkspacesManager();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initWorkspacesManager);
} else {
    _initWorkspacesManager();
}
