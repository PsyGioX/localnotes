"""End-to-end tests for the optional lock (v1.12): passwordless "device" mode,
adding / removing a password later, and the configurable idle timeout.

Run:  pytest tests/ -v        (see tests/README.md for setup)
"""
import re

SECRET = 'launch-code-7731'


# ── First run ──────────────────────────────────────────────────────────────

def test_first_run_offers_start_without_password(app):
    app.open()
    assert app.lock_screen_visible()
    assert app.page.locator('#ln-setup-no-password').is_visible()
    # PIN / file setup is still there for people who want it
    assert app.page.locator('#ln-setup-confirm').is_visible()
    assert app.mode() == 'none'


def test_first_run_button_is_translated_on_localized_pages(app):
    app.open('ru/index.html')
    app.page.wait_for_selector('#ln-setup-no-password')
    assert app.page.inner_text('#ln-setup-no-password').strip() == 'Начать без пароля'
    app.start_without_password()
    app.page.evaluate("() => window._updateLockBtn && window._updateLockBtn()")
    assert app.page.inner_text('#appLockBtn').strip() == 'Защитить'


def test_start_without_password_opens_the_app(app):
    app.open()
    app.start_without_password()
    assert app.ready()
    assert app.mode() == 'device'
    assert app.slots() == ['device']
    assert isinstance(app.setting('vaultDeviceKey'), str) and len(app.setting('vaultDeviceKey')) > 20
    assert not app.errors, app.errors


def test_device_mode_still_encrypts_notes_at_rest(app):
    app.open(); app.start_without_password()
    app.save_note('n1', 'Title ' + SECRET, 'body ' + SECRET)
    raw = app.raw_note('n1')
    assert raw['encrypted'] is True
    assert SECRET not in str(raw['content']) and SECRET not in str(raw['title'])
    note = app.read_note('n1')
    assert SECRET in note['content'] and SECRET in note['title']


def test_device_mode_reload_opens_without_any_prompt(app):
    app.open(); app.start_without_password()
    app.save_note('n1', 'Persisted', 'body ' + SECRET)
    app.reload()
    assert not app.lock_screen_visible()
    assert app.ready() and app.mode() == 'device'
    assert SECRET in app.read_note('n1')['content']


def test_pre_vault_plaintext_notes_are_encrypted_when_starting_without_password(app):
    app.open()  # first-run screen is up, DB exists
    app.page.evaluate("""(secret) => new Promise((res, rej) => {
        const tx = window.notesDB.db.transaction(['notes'], 'readwrite');
        tx.objectStore('notes').put({ id: 'legacy', title: 'Legacy', content: '<p>' + secret + '</p>', tags: [], createdAt: 1, updatedAt: 1 });
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    })""", SECRET)
    assert SECRET in app.raw_note('legacy')['content']  # plaintext before
    app.start_without_password()
    raw = app.raw_note('legacy')
    assert raw['encrypted'] is True and SECRET not in str(raw['content'])
    assert SECRET in app.read_note('legacy')['content']


def test_missing_device_key_never_creates_a_new_vault_over_existing_notes(app):
    app.open(); app.start_without_password()
    app.save_note('n1', 'Keep me', 'body ' + SECRET)
    app.page.evaluate("() => window.notesDB.saveSetting('vaultDeviceKey', null)")
    app.page.reload()
    app.page.wait_for_timeout(2500)
    assert not app.lock_screen_visible(), 'must not show first-run setup over existing encrypted data'
    assert app.slots() == ['device']
    assert app.raw_note('n1')['encrypted'] is True  # untouched


# ── Existing password flow still works (regression) ────────────────────────

def test_first_run_with_pin_still_works_and_requires_pin_after_reload(app):
    app.open(); app.first_run_with_pin('4821')
    assert app.mode() == 'password'
    assert sorted(app.slots()) == ['pin', 'recovery']
    assert app.setting('vaultDeviceKey') is None
    app.save_note('n1', 'Secret', 'body ' + SECRET)
    app.reload()
    assert app.lock_screen_visible() and not app.ready()
    app.unlock_with_pin('0000')
    app.page.wait_for_function("() => document.getElementById('ln-lock-error').textContent.trim().length > 0", timeout=5000)
    assert not app.ready()
    app.unlock_with_pin('4821')
    app.page.wait_for_function("() => window.notesDB.vaultReady", timeout=10000)
    assert SECRET in app.read_note('n1')['content']


def test_recovery_phrase_still_unlocks(app):
    app.open(); app.page.fill('#ln-setup-pin', '4821'); app.page.check('#ln-setup-ack'); app.page.click('#ln-setup-confirm')
    phrase = app.finish_recovery_step()
    app.save_note('n1', 'Secret', 'body ' + SECRET)
    app.reload()
    app.page.click('#ln-lock-forgot')
    app.page.fill('#ln-lock-recovery-input', phrase)
    app.page.click('#ln-lock-recovery-btn')
    app.page.wait_for_function("() => window.notesDB.vaultReady", timeout=15000)
    assert SECRET in app.read_note('n1')['content']


# ── Adding a password later ────────────────────────────────────────────────

def test_add_pin_from_device_mode_keeps_notes_and_removes_device_key(app):
    app.open(); app.start_without_password()
    app.save_note('n1', 'Secret', 'body ' + SECRET)
    app.open_lock_settings()
    # device-mode settings: no recovery/off tabs, no lock-now, no idle select
    assert app.page.locator('.ln-lss-tab[data-mode="recovery"]').count() == 0
    assert app.page.locator('.ln-lss-tab[data-mode="off"]').count() == 0
    assert app.page.locator('#ln-lss-lock-now').count() == 0
    assert app.page.locator('#ln-lss-device-note').is_visible()
    app.page.fill('#ln-lss-new-pin', '5934')
    app.page.click('#ln-lss-save')
    app.finish_recovery_step()
    assert app.mode() == 'password'
    assert sorted(app.slots()) == ['pin', 'recovery']
    assert app.setting('vaultDeviceKey') is None
    assert SECRET in app.read_note('n1')['content']          # same key => no re-encryption needed
    app.reload()
    assert app.lock_screen_visible() and not app.ready()
    app.unlock_with_pin('5934')
    app.page.wait_for_function("() => window.notesDB.vaultReady", timeout=10000)
    assert SECRET in app.read_note('n1')['content']


def test_lock_button_says_protect_in_device_mode_and_lock_in_password_mode(app):
    app.open(); app.start_without_password()
    app.page.evaluate("() => window._updateLockBtn && window._updateLockBtn()")
    assert app.page.inner_text('#appLockBtn').strip() == 'Protect'
    assert 'bi-shield-plus' in app.page.inner_html('#appLockBtn')


# ── Removing the password ──────────────────────────────────────────────────

def _open_off_tab(app):
    app.open_lock_settings()
    app.page.click('.ln-lss-tab[data-mode="off"]')
    app.page.wait_for_selector('#ln-lss-off-section', state='visible')


def test_remove_password_rejects_wrong_pin_and_changes_nothing(app):
    app.open(); app.first_run_with_pin('4821')
    app.save_note('n1', 'Secret', 'body ' + SECRET)
    _open_off_tab(app)
    app.page.fill('#ln-lss-off-pin', '1111')
    app.page.click('#ln-lss-off-confirm')
    # NB: the error box gets class "visible" even for an empty message (tab clicks
    # reset it), so wait for actual text rather than the class.
    app.page.wait_for_function("() => document.getElementById('ln-lss-error').textContent.trim().length > 0", timeout=5000)
    assert app.mode() == 'password'
    assert sorted(app.slots()) == ['pin', 'recovery']
    assert app.setting('vaultDeviceKey') is None


def test_remove_password_with_correct_pin_switches_to_device_mode(app):
    app.open(); app.first_run_with_pin('4821')
    app.save_note('n1', 'Secret', 'body ' + SECRET)
    _open_off_tab(app)
    app.page.fill('#ln-lss-off-pin', '4821')
    app.page.click('#ln-lss-off-confirm')
    app.page.wait_for_function("() => window.notesDB.vaultMode === 'device'", timeout=10000)
    assert app.slots() == ['device']
    assert app.setting('vaultSalt_pin') is None and app.setting('vaultWrapped_pin') is None
    assert app.setting('vaultWrapped_recovery') is None
    app.reload()
    assert not app.lock_screen_visible()
    assert SECRET in app.read_note('n1')['content']
    assert app.raw_note('n1')['encrypted'] is True


def test_remove_password_with_recovery_phrase(app):
    app.open(); app.page.fill('#ln-setup-pin', '4821'); app.page.check('#ln-setup-ack'); app.page.click('#ln-setup-confirm')
    phrase = app.finish_recovery_step()
    _open_off_tab(app)
    app.page.fill('#ln-lss-off-phrase', phrase)
    app.page.click('#ln-lss-off-confirm')
    app.page.wait_for_function("() => window.notesDB.vaultMode === 'device'", timeout=10000)
    assert app.slots() == ['device']


def test_remove_then_add_password_roundtrip(app):
    app.open(); app.first_run_with_pin('4821')
    app.save_note('n1', 'Secret', 'body ' + SECRET)
    _open_off_tab(app)
    app.page.fill('#ln-lss-off-pin', '4821'); app.page.click('#ln-lss-off-confirm')
    app.page.wait_for_function("() => window.notesDB.vaultMode === 'device'")
    app.page.wait_for_selector('#ln-lock-settings-modal', state='detached')
    app.open_lock_settings()
    app.page.fill('#ln-lss-new-pin', '7070'); app.page.click('#ln-lss-save')
    app.finish_recovery_step()
    app.reload()
    app.unlock_with_pin('7070')
    app.page.wait_for_function("() => window.notesDB.vaultReady", timeout=10000)
    assert SECRET in app.read_note('n1')['content']


# ── Idle timeout ───────────────────────────────────────────────────────────

def _age_activity(app, minutes):
    app.page.evaluate(
        "(m) => { sessionStorage.setItem('ln_lock_last_activity', String(Date.now() - m * 60000)); window.dispatchEvent(new Event('focus')); }",
        minutes)
    app.page.wait_for_timeout(400)


def test_idle_timeout_default_is_ten_minutes(app):
    app.open(); app.first_run_with_pin('4821')
    assert app.page.evaluate("() => window.AppLock.getIdleMinutes()") == 10
    _age_activity(app, 9)
    assert app.ready()
    _age_activity(app, 11)
    assert not app.ready() and app.lock_screen_visible()


def test_idle_timeout_can_be_changed_and_persists(app):
    app.open(); app.first_run_with_pin('4821')
    app.open_lock_settings()
    app.page.select_option('#ln-lss-idle', '1')
    assert app.page.evaluate("() => window.AppLock.getIdleMinutes()") == 1
    app.page.evaluate("() => document.getElementById('ln-lss-close').click()")
    _age_activity(app, 2)
    assert not app.ready(), 'locks after the shorter timeout'
    app.unlock_with_pin('4821')
    app.page.wait_for_function("() => window.notesDB.vaultReady")
    app.reload(); app.unlock_with_pin('4821')
    app.page.wait_for_function("() => window.notesDB.vaultReady")
    assert app.page.evaluate("() => window.AppLock.getIdleMinutes()") == 1


def test_idle_timeout_never_does_not_lock(app):
    app.open(); app.first_run_with_pin('4821')
    app.page.evaluate("() => window.AppLock.setIdleMinutes(0)")
    _age_activity(app, 600)
    assert app.ready() and not app.lock_screen_visible()


def test_invalid_idle_value_falls_back_to_default(app):
    app.open(); app.first_run_with_pin('4821')
    app.page.evaluate("() => localStorage.setItem('ln_lock_idle_minutes', '7')")
    assert app.page.evaluate("() => window.AppLock.getIdleMinutes()") == 10


def test_device_mode_never_idle_locks(app):
    app.open(); app.start_without_password()
    _age_activity(app, 600)
    assert app.ready() and not app.lock_screen_visible()
    assert app.page.evaluate("() => window.AppLock.isEnabled()") is False
    app.page.evaluate("() => window.AppLock.lockNow()")  # no-op without a password
    assert app.ready()


# ── Model-level guards ─────────────────────────────────────────────────────

def test_device_is_not_a_removable_or_settable_credential(app):
    app.open(); app.start_without_password()
    r = app.page.evaluate("""async () => {
        const out = {};
        try { await window.notesDB.removeVaultCredential('device'); out.remove = 'allowed'; } catch (e) { out.remove = 'rejected'; }
        try { await window.notesDB.setVaultCredential('device', 'x'); out.set = 'allowed'; } catch (e) { out.set = 'rejected'; }
        try { await window.notesDB.enableDeviceMode(); out.again = 'allowed'; } catch (e) { out.again = 'rejected'; }
        return out;
    }""")
    assert r == {'remove': 'rejected', 'set': 'rejected', 'again': 'rejected'}
    assert app.slots() == ['device']


def test_verify_credential_does_not_change_the_session(app):
    app.open(); app.first_run_with_pin('4821')
    r = app.page.evaluate("""async () => ({
        good: await window.notesDB.verifyVaultCredential('pin', '4821'),
        bad: await window.notesDB.verifyVaultCredential('pin', '9999'),
        none: await window.notesDB.verifyVaultCredential('file', 'x'),
        ready: window.notesDB.vaultReady })""")
    assert r == {'good': True, 'bad': False, 'none': False, 'ready': True}
