/**
 * Workspaces Integration
 * Патчит loadNotes (фильтрация) и openModal (выбор пространства при сохранении)
 */

(function () {
    'use strict';

    function waitFor(check, cb, interval) {
        if (check()) { cb(); return; }
        const id = setInterval(() => { if (check()) { clearInterval(id); cb(); } }, interval || 100);
    }

    // ── 1. Патч loadNotes — фильтрация по пространству ──────────────────────
    function patchLoadNotes() {
        const orig = window.loadNotes;
        if (!orig) return;

        window.loadNotes = async function () {
            if (!workspacesManager || !workspacesManager.currentWorkspace) {
                return orig.apply(this, arguments);
            }

            const nc = document.getElementById('notesContainer');

            // Скрываем содержимое и фиксируем высоту — нет прыжков и мерцания
            if (nc) {
                nc.style.minHeight = nc.offsetHeight + 'px';
                nc.style.opacity = '0';
                nc.style.transition = 'none';
            }

            // Блокируем showWelcomeMessage на время загрузки
            const origWelcome = window.showWelcomeMessage;
            window.showWelcomeMessage = function () { /* подавляем */ };

            // Подменяем getAllNotes для фильтрации по пространству
            const origGetAll = notesDB.getAllNotes.bind(notesDB);
            notesDB.getAllNotes = async () => {
                const all = await origGetAll();
                return workspacesManager.filterNotesByWorkspace(all);
            };

            try {
                await orig.apply(this, arguments);
            } finally {
                notesDB.getAllNotes = origGetAll;
                window.showWelcomeMessage = origWelcome;

                if (nc) {
                    nc.style.minHeight = '';
                    // Плавно показываем результат
                    nc.style.transition = 'opacity 0.15s ease';
                    nc.style.opacity = '1';
                    // Убираем transition после анимации
                    setTimeout(() => { nc.style.transition = ''; }, 160);
                }

                // Показываем welcome если пространство пустое
                if (nc && nc.children.length === 0 && typeof origWelcome === 'function') {
                    origWelcome();
                }
            }
        };
    }

    // ── 2. Патч openModal — перехватываем кнопку Save внутри модала ─────────
    function patchOpenModal() {
        const orig = window.openModal;
        if (!orig) return;

        window.openModal = function (noteId, noteContent, noteCreationTime) {
            // Вызываем оригинал — он сам навешивает saveBtn.onclick
            orig.apply(this, arguments);

            // Если это новая заметка — оборачиваем onclick
            if (!noteId) {
                const saveBtn = document.getElementById('saveNoteButton');
                if (!saveBtn) return;

                const originalOnClick = saveBtn.onclick;
                saveBtn.onclick = async function (e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    if (!workspacesManager) {
                        return originalOnClick && originalOnClick.call(this, e);
                    }

                    const wsId = await workspacesManager.showWorkspaceSelector();
                    if (!wsId) return; // пользователь отменил

                    // Запоминаем выбранное пространство
                    window._pendingWorkspaceId = wsId;

                    // Вызываем оригинальный обработчик
                    if (originalOnClick) await originalOnClick.call(this, e);

                    delete window._pendingWorkspaceId;
                };
            }
        };
    }

    // ── 3. Патч notesDB.saveNote — проставляем workspaceId ──────────────────
    function patchNotesDB() {
        const origSave = notesDB.saveNote.bind(notesDB);
        notesDB.saveNote = async function (note) {
            if (!note.workspaceId) {
                note.workspaceId =
                    window._pendingWorkspaceId ||
                    (workspacesManager && workspacesManager.currentWorkspace?.id) ||
                    null;
            }
            return origSave(note);
        };
    }

    // ── Инициализация ────────────────────────────────────────────────────────
    function init() {
        waitFor(
            () => typeof notesDB !== 'undefined' &&
                  typeof loadNotes !== 'undefined' &&
                  typeof openModal !== 'undefined' &&
                  typeof workspacesManager !== 'undefined',
            () => {
                patchLoadNotes();
                patchOpenModal();
                patchNotesDB();
                // Перерисовываем заметки с фильтром
                if (typeof loadNotes === 'function' && window.notesDB && window.notesDB.vaultReady) loadNotes();
            }
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
