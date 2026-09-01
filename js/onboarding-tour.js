// ============================================================================
// INTERACTIVE ONBOARDING GUIDE
// ============================================================================
// Replaces the old single-line static alert behind "Show instructions" with
// a real step-by-step spotlight tour of the main toolbar. Skippable at any
// point — closing it (Skip, Finish, backdrop click, or Escape) never blocks
// anything else in the app and never reappears on its own; it only ever
// starts when the user explicitly clicks the button.
(function () {
    'use strict';

    function gt(key, fallback) {
        try {
            if (typeof t === 'function') {
                const v = t(key);
                return (v && v !== key) ? v : fallback;
            }
        } catch (_) { /* ignore */ }
        return fallback;
    }

    function buildSteps() {
        // Built fresh each time the tour opens so translations are current
        // and so we can drop any step whose target isn't on screen.
        return [
            {
                selector: '#addNoteButton',
                title: gt('tourAddNoteTitle', 'Add a note'),
                text: gt('tourAddNoteText', 'Start here — click this any time to create a new note.')
            },
            {
                selector: '#importButton',
                title: gt('tourImportTitle', 'Import notes'),
                text: gt('tourImportText', 'Bring in notes you exported earlier, or a file someone shared with you.')
            },
            {
                selector: '#calendarBtn',
                title: gt('tourCalendarTitle', 'Calendar'),
                text: gt('tourCalendarText', 'Notes with a due date show up here, laid out by day.')
            },
            {
                selector: '#quickEditToggle',
                title: gt('tourQuickEditTitle', 'Quick Edit'),
                text: gt('tourQuickEditText', 'Edit notes right in the list, without opening the full editor each time.')
            },
            {
                selector: '#searchInput',
                title: gt('tourSearchTitle', 'Search'),
                text: gt('tourSearchText', 'Find notes by text, by #tag, or with filters like is:pinned or has:image.')
            },
            {
                selector: null,
                title: gt('tourDoneTitle', "You're all set"),
                text: gt('tourDoneText', "Click 'Add a note' whenever you're ready to write your first one.")
            }
        ];
    }

    let state = null; // { steps, index, overlay, cutout, tooltip }

    function teardown() {
        if (!state) return;
        if (state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
        document.removeEventListener('keydown', onKeydown, true);
        window.removeEventListener('resize', onReposition);
        state = null;
    }

    function onKeydown(e) {
        if (e.key === 'Escape') { teardown(); return; }
        if (e.key === 'ArrowRight') { goNext(); }
        if (e.key === 'ArrowLeft') { goBack(); }
    }

    function onReposition() {
        if (state) positionForStep(state.steps[state.index]);
    }

    function currentVisibleStep(index, direction) {
        // Skip steps whose target element isn't actually present/visible
        // (e.g. a future toolbar variant) instead of showing a spotlight
        // pointing at nothing.
        const steps = state.steps;
        while (index >= 0 && index < steps.length) {
            const s = steps[index];
            if (!s.selector) return index; // the centered closing step
            const el = document.querySelector(s.selector);
            if (el && el.offsetParent !== null) return index;
            index += direction;
        }
        return direction > 0 ? steps.length : -1;
    }

    function positionForStep(step) {
        const cutout = state.cutout;
        const tooltip = state.tooltip;
        const target = step.selector ? document.querySelector(step.selector) : null;

        if (target) {
            const r = target.getBoundingClientRect();
            const pad = 8;
            cutout.style.display = 'block';
            cutout.style.top = (r.top - pad) + 'px';
            cutout.style.left = (r.left - pad) + 'px';
            cutout.style.width = (r.width + pad * 2) + 'px';
            cutout.style.height = (r.height + pad * 2) + 'px';

            const spaceBelow = window.innerHeight - r.bottom;
            const tooltipTop = spaceBelow > 160 ? r.bottom + 16 : Math.max(16, r.top - 16);
            const tooltipTransform = spaceBelow > 160 ? '' : 'translateY(-100%)';
            tooltip.style.top = tooltipTop + 'px';
            tooltip.style.transform = tooltipTransform;
            let left = r.left;
            const maxLeft = window.innerWidth - 340;
            if (left > maxLeft) left = Math.max(16, maxLeft);
            tooltip.style.left = left + 'px';
        } else {
            cutout.style.display = 'none';
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
        }
    }

    function render() {
        const idx = state.index;
        const step = state.steps[idx];
        const total = state.steps.length;
        const isLast = idx === total - 1;

        state.tooltip.innerHTML =
            '<div class="ln-tour-progress">' + (idx + 1) + ' / ' + total + '</div>' +
            '<h3 class="ln-tour-title"></h3>' +
            '<p class="ln-tour-text"></p>' +
            '<div class="ln-tour-actions">' +
                '<button type="button" class="ln-tour-skip">' + gt('tourSkip', 'Skip') + '</button>' +
                '<div class="ln-tour-nav">' +
                    (idx > 0 ? '<button type="button" class="ln-tour-back">' + gt('tourBack', 'Back') + '</button>' : '') +
                    '<button type="button" class="ln-tour-next">' + (isLast ? gt('tourFinish', 'Finish') : gt('tourNext', 'Next')) + '</button>' +
                '</div>' +
            '</div>';
        // Text content set via textContent (not innerHTML) even though the
        // strings are our own translations — avoids ever interpreting stray
        // markup in a translation file as HTML.
        state.tooltip.querySelector('.ln-tour-title').textContent = step.title;
        state.tooltip.querySelector('.ln-tour-text').textContent = step.text;

        state.tooltip.querySelector('.ln-tour-skip').addEventListener('click', teardown);
        const backBtn = state.tooltip.querySelector('.ln-tour-back');
        if (backBtn) backBtn.addEventListener('click', goBack);
        state.tooltip.querySelector('.ln-tour-next').addEventListener('click', function () {
            if (isLast) { teardown(); } else { goNext(); }
        });

        positionForStep(step);
    }

    function goNext() {
        if (!state) return;
        const next = currentVisibleStep(state.index + 1, 1);
        if (next >= state.steps.length) { teardown(); return; }
        state.index = next;
        render();
    }

    function goBack() {
        if (!state) return;
        const prev = currentVisibleStep(state.index - 1, -1);
        if (prev < 0) return;
        state.index = prev;
        render();
    }

    function startInteractiveGuide() {
        teardown(); // in case one is somehow already open

        const overlay = document.createElement('div');
        overlay.className = 'ln-tour-overlay';
        overlay.innerHTML =
            '<div class="ln-tour-cutout" style="display:none"></div>' +
            '<div class="ln-tour-tooltip" role="dialog" aria-modal="true"></div>';
        document.body.appendChild(overlay);

        // Clicking the dimmed backdrop (not the tooltip itself) skips the tour
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) teardown();
        });

        state = {
            steps: buildSteps(),
            index: 0,
            overlay: overlay,
            cutout: overlay.querySelector('.ln-tour-cutout'),
            tooltip: overlay.querySelector('.ln-tour-tooltip')
        };

        const firstVisible = currentVisibleStep(0, 1);
        state.index = firstVisible < state.steps.length ? firstVisible : state.steps.length - 1;

        document.addEventListener('keydown', onKeydown, true);
        window.addEventListener('resize', onReposition);
        render();
    }

    window.startInteractiveGuide = startInteractiveGuide;
})();
