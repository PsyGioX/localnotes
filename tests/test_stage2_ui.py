"""Browser tests for the v1.12 interface refresh: compact header, the "⋯"
menu (with a separated, red "Clear all notes"), Calendar in the view switcher,
the compact empty state, and a mobile layout that must not regress."""

DESKTOP = {'width': 1280, 'height': 800}
PHONE = {'width': 390, 'height': 780}
RED = 'rgb(220, 53, 69)'


def _boot(app, context=None):
    app.open(); app.start_without_password()
    app.page.wait_for_timeout(600)
    return app


def _with_note(app):
    """The view bar (Grid/List, Tasks, Calendar, Lock) is only shown once at least one note exists."""
    app.save_note('n1', 'One', 'body')
    app.page.evaluate("() => window.loadNotes && window.loadNotes()")
    app.page.wait_for_function("() => getComputedStyle(document.querySelector('.btn_view_div')).display !== 'none'", timeout=8000)


def _open_menu(app):
    app.page.click('#moreActionsToggle')
    app.page.wait_for_function("() => document.getElementById('moreActionsMenu').classList.contains('open')")
    app.page.wait_for_timeout(250)  # transition


# ── Header / toolbar ───────────────────────────────────────────────────────

def test_header_is_a_slim_single_row(app):
    _boot(app)
    h = app.page.evaluate("() => Math.round(document.querySelector('.info-app').getBoundingClientRect().height)")
    assert h <= 64, f'header is {h}px'
    # logo, title and BETA badge still there and on one line
    boxes = app.page.evaluate("""() => ['.info-app .logo', '.info-app .name-app', '.info-app .beta-badge']
        .map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })""")
    assert all(b[0] >= 0 and b[1] <= 64 for b in boxes), boxes


def test_content_starts_higher_than_before(app):
    _boot(app)
    top = app.page.evaluate("() => Math.round(document.querySelector('#notesContainer').getBoundingClientRect().top)")
    assert top <= 250, f'content starts at {top}px (was 270px before the refresh)'


def test_secondary_actions_are_tucked_into_the_menu_on_desktop(app):
    _boot(app)
    p = app.page
    assert p.locator('#addNoteButton').is_visible() and p.locator('#searchInput').is_visible()
    assert p.locator('#moreActionsToggle').is_visible()
    for sel in ('#importButton', '#calendarBtn', '#quickEditToggle', '#clearAllButton'):
        assert not p.locator(sel).is_visible(), f'{sel} should be hidden until the menu is opened'
    _open_menu(app)
    for sel in ('#importButton', '#calendarBtn', '#quickEditToggle', '#clearAllButton'):
        assert p.locator(sel).is_visible(), f'{sel} should be visible in the open menu'
    assert p.get_attribute('#moreActionsToggle', 'aria-expanded') == 'true'


def test_menu_closes_on_escape_and_on_outside_click(app):
    _boot(app)
    _open_menu(app)
    app.page.keyboard.press('Escape')
    app.page.wait_for_function("() => !document.getElementById('moreActionsMenu').classList.contains('open')")
    _open_menu(app)
    app.page.mouse.click(700, 500)
    app.page.wait_for_function("() => !document.getElementById('moreActionsMenu').classList.contains('open')")
    assert app.page.get_attribute('#moreActionsToggle', 'aria-expanded') == 'false'


def test_clear_all_is_last_red_and_separated(app):
    _boot(app)
    _open_menu(app)
    order = app.page.evaluate("""() => [...document.querySelectorAll('#moreActionsMenu > button')]
        .map(b => ({ id: b.id, y: Math.round(b.getBoundingClientRect().top) })).sort((a, b) => a.y - b.y).map(x => x.id)""")
    assert order[-1] == 'clearAllButton', order
    assert app.page.evaluate("() => getComputedStyle(document.getElementById('clearAllButton')).color") == RED
    gap = app.page.evaluate("""() => { const b = [...document.querySelectorAll('#moreActionsMenu > button')].map(x => x.getBoundingClientRect());
        const last = Math.max(...b.map(r => r.top)); const prev = Math.max(...b.map(r => r.top).filter(t => t < last));
        const prevBox = b.find(r => r.top === prev); return Math.round(last - prevBox.bottom); }""")
    assert gap >= 6, f'destructive action needs breathing room, got {gap}px'


def test_clear_all_still_asks_first_and_cancel_keeps_every_note(app):
    _boot(app)
    app.save_note('n1', 'Keep me', 'body')
    _open_menu(app)
    app.page.click('#clearAllButton')
    app.page.wait_for_selector('.clear-notes-modal', state='visible')
    assert app.page.locator('.clear-notes-delete').is_disabled(), 'nothing is selected yet'
    app.page.click('.clear-notes-cancel')
    app.page.wait_for_selector('.clear-notes-modal', state='detached')
    assert app.read_note('n1') is not None
    assert app.page.evaluate("() => document.getElementById('moreActionsMenu').classList.contains('open')") is False


def test_menu_items_still_work(app):
    _boot(app)
    _open_menu(app)
    with app.page.expect_file_chooser():
        app.page.click('#importButton')
    _open_menu(app)
    app.page.click('#calendarBtn')
    app.page.wait_for_selector('#calendarModal', state='visible', timeout=8000)


# ── View switcher ──────────────────────────────────────────────────────────

def test_calendar_is_a_view_segment_next_to_grid_and_tasks(app):
    _boot(app); _with_note(app)
    p = app.page
    ids = p.evaluate("""() => [...document.querySelectorAll('.btn_view_div > button, .btn_view_div > div button')]
        .filter(b => b.offsetParent !== null).map(b => b.id)""")
    assert 'toggleViewButton' in ids and 'toggleTaskBoardButton' in ids and 'viewCalendarBtn' in ids, ids
    ys = p.evaluate("() => ['toggleViewButton','toggleTaskBoardButton','viewCalendarBtn'].map(i => Math.round(document.getElementById(i).getBoundingClientRect().top))")
    assert len(set(ys)) == 1, f'segments should share one row: {ys}'
    p.click('#viewCalendarBtn')
    p.wait_for_selector('#calendarModal', state='visible', timeout=8000)


def test_view_calendar_label_is_translated(app):
    app.open('ru/index.html'); app.start_without_password(); app.page.wait_for_timeout(1500)
    _with_note(app)
    assert app.page.inner_text('#viewCalendarBtn').strip() == 'Календарь'


def test_grid_list_toggle_and_tasks_board_are_unaffected(app):
    _boot(app)
    app.save_note('n2', 'Two', 'body')
    _with_note(app)
    before = app.page.evaluate("() => document.getElementById('notesContainer').className")
    app.page.click('#toggleViewButton')
    app.page.wait_for_timeout(400)
    after = app.page.evaluate("() => document.getElementById('notesContainer').className")
    assert before != after, 'Grid/List toggle changed nothing'
    app.page.click('#toggleTaskBoardButton')
    app.page.wait_for_timeout(500)
    assert app.page.evaluate("() => document.getElementById('toggleTaskBoardButton').classList.contains('active')")


# ── Empty state ────────────────────────────────────────────────────────────

def test_empty_state_is_compact_with_three_actions(app):
    _boot(app)
    p = app.page
    p.wait_for_selector('.welcome-message .welcome-quick')
    assert p.locator('.welcome-quick-btn').count() == 3
    assert p.locator('.welcome-message .welcome-section').first.is_hidden(), 'long text starts collapsed'
    h = p.evaluate("() => Math.round(document.querySelector('.welcome-message').getBoundingClientRect().height)")
    assert h <= 420, f'empty state is {h}px tall'
    p.click('.welcome-more-summary')
    assert p.locator('.welcome-message .welcome-section').first.is_visible()


def test_empty_state_actions_forward_to_the_real_buttons(app):
    _boot(app)
    app.page.click('#welcomeNewNote')
    app.page.wait_for_selector('#editModal', state='visible', timeout=8000)
    app.page.keyboard.press('Escape')
    app.page.evaluate("() => document.getElementById('cancelNoteButton') && document.getElementById('cancelNoteButton').click()")
    app.page.wait_for_timeout(500)
    if app.page.locator('#confirmModal').is_visible():
        app.page.evaluate("() => document.querySelectorAll('#confirmModal button').forEach(b => b.offsetParent && /discard|yes|ok|да|confirm/i.test(b.textContent) && b.click())")
    with app.page.expect_file_chooser():
        app.page.click('#welcomeImportNotes')


def test_empty_state_labels_follow_the_language(app):
    app.open('ru/index.html'); app.start_without_password(); app.page.wait_for_timeout(1800)
    assert app.page.inner_text('#welcomeNewNote').strip() == app.page.inner_text('#addNoteButton').strip()
    assert app.page.inner_text('.welcome-more-summary').strip() != 'About Local Notes'


def test_empty_state_disappears_when_a_note_exists(app):
    _boot(app)
    app.save_note('n1', 'First', 'body')
    app.page.evaluate("() => window.loadNotes && window.loadNotes()")
    app.page.wait_for_timeout(800)
    assert app.page.locator('.welcome-message').count() == 0


# ── Tour keeps working with the desktop dropdown ───────────────────────────

def test_onboarding_tour_opens_the_menu_for_menu_buttons(app):
    _boot(app)
    p = app.page
    p.evaluate("() => window.startInteractiveGuide()")
    p.wait_for_selector('.ln-tour-next')
    assert not p.evaluate("() => document.getElementById('moreActionsMenu').classList.contains('open')"), 'step 1 is the Add button'
    p.click('.ln-tour-next')                      # step 2: Import (inside the menu)
    p.wait_for_function("() => document.getElementById('moreActionsMenu').classList.contains('open')")
    p.wait_for_selector('#importButton', state='visible', timeout=3000)   # waits out the fade-in
    p.click('.ln-tour-next')                      # step 3: Calendar (inside the menu)
    assert p.evaluate("() => document.getElementById('moreActionsMenu').classList.contains('open')")
    p.wait_for_selector('#calendarBtn', state='visible', timeout=3000)
    p.click('.ln-tour-next'); p.click('.ln-tour-next')   # Quick Edit, then Search (not in menu)
    p.wait_for_function("() => !document.getElementById('moreActionsMenu').classList.contains('open')")


# ── Phones must not regress ────────────────────────────────────────────────

def test_phone_layout_keeps_its_dropdown_and_does_not_overflow(context, base_url):
    from conftest import App
    page_app = App(context, base_url)
    page_app.page.set_viewport_size(PHONE)
    _boot(page_app)
    p = page_app.page
    assert p.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"), 'horizontal overflow'
    assert p.locator('#moreActionsToggle').is_visible()
    assert not p.locator('#importButton').is_visible()
    w = p.evaluate("() => Math.round(document.getElementById('addNoteButton').getBoundingClientRect().width)")
    assert w >= 90, f'Add button is only {w}px wide'
    p.click('#moreActionsToggle')
    p.wait_for_function("() => document.getElementById('moreActionsMenu').classList.contains('open')")
    p.wait_for_selector('#clearAllButton', state='visible', timeout=3000)  # waits out the fade-in
    assert p.locator('#calendarBtn').is_visible()
    assert not p.locator('#viewCalendarBtn').is_visible(), 'phones reach Calendar via the menu'


def test_onboarding_tour_opens_the_menu_on_phones_too(context, base_url):
    # Regression: the Next button re-rendered the tooltip, so the "click outside"
    # handler saw a detached target and closed the menu the tour had just opened.
    from conftest import App
    a = App(context, base_url)
    a.page.set_viewport_size(PHONE)
    _boot(a)
    p = a.page
    p.evaluate("() => window.startInteractiveGuide()")
    p.wait_for_selector('.ln-tour-next')
    p.click('.ln-tour-next')
    p.wait_for_function("() => document.getElementById('moreActionsMenu').classList.contains('open')")
    p.wait_for_selector('#importButton', state='visible', timeout=3000)
