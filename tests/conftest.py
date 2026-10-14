"""Shared fixtures for the Local Notes browser tests.

Runs the real app in headless Chromium (Playwright) against a throw-away static
server rooted at the repository, with a fresh browser context (= empty
IndexedDB/localStorage) per test and the service worker blocked.
"""
import functools, http.server, os, socketserver, threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # keep test output readable
        pass


@pytest.fixture(scope='session')
def base_url():
    handler = functools.partial(_QuietHandler, directory=ROOT)
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{srv.server_address[1]}'
    srv.shutdown()


@pytest.fixture(scope='session')
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture()
def context(browser):
    ctx = browser.new_context(service_workers='block', accept_downloads=True,
                              viewport={'width': 1280, 'height': 900})
    yield ctx
    ctx.close()


class App:
    """Small driver around one page of the app."""

    def __init__(self, context, base_url):
        self.context, self.base_url = context, base_url
        self.page = context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))

    # -- navigation ---------------------------------------------------------
    def open(self, path='index.html'):
        self.page.goto(f'{self.base_url}/{path}')
        self.page.wait_for_function(
            "() => window.notesDB && window.AppLock && (document.getElementById('ln-lock-screen') || window.notesDB.vaultReady)",
            timeout=20000)
        return self

    def reload(self):
        self.page.reload()
        self.page.wait_for_function(
            "() => window.notesDB && window.AppLock && (document.getElementById('ln-lock-screen') || window.notesDB.vaultReady)",
            timeout=20000)
        return self

    # -- state helpers ------------------------------------------------------
    def slots(self):
        return self.page.evaluate("() => window.notesDB.getSetting('vaultSlots')")

    def setting(self, key):
        return self.page.evaluate("(k) => window.notesDB.getSetting(k)", key)

    def mode(self):
        return self.page.evaluate("() => window.notesDB.vaultMode")

    def ready(self):
        return self.page.evaluate("() => window.notesDB.vaultReady")

    def lock_screen_visible(self):
        return self.page.locator('#ln-lock-screen').count() > 0

    def save_note(self, note_id, title, body):
        self.page.evaluate(
            """([id, title, body]) => window.notesDB.saveNote({ id, title, content: '<p>' + body + '</p>', tags: [], createdAt: Date.now(), updatedAt: Date.now() })""",
            [note_id, title, body])

    def read_note(self, note_id):
        return self.page.evaluate("(id) => window.notesDB.getNote(id)", note_id)

    def raw_note(self, note_id):
        """The record exactly as it sits in IndexedDB (no decryption)."""
        return self.page.evaluate(
            """(id) => new Promise((res, rej) => {
                const r = window.notesDB.db.transaction(['notes'], 'readonly').objectStore('notes').get(id);
                r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error);
            })""", note_id)

    # -- UI flows -----------------------------------------------------------
    def start_without_password(self):
        self.page.click('#ln-setup-no-password')
        self.page.wait_for_function("() => window.notesDB.vaultReady && !document.getElementById('ln-lock-screen')", timeout=10000)

    def first_run_with_pin(self, pin='4821'):
        self.page.fill('#ln-setup-pin', pin)
        self.page.check('#ln-setup-ack')
        self.page.click('#ln-setup-confirm')
        self.finish_recovery_step()

    def finish_recovery_step(self):
        self.page.wait_for_selector('#ln-recovery-confirm', timeout=15000)
        phrase = self.page.inner_text('#ln-recovery-phrase').strip()
        self.page.click('#ln-recovery-download')
        self.page.check('#ln-recovery-ack')
        self.page.click('#ln-recovery-confirm')
        self.page.wait_for_function("() => !document.getElementById('ln-lock-screen')", timeout=10000)
        return phrase

    def unlock_with_pin(self, pin):
        self.page.fill('#ln-lock-pin-input', pin)
        self.page.click('#ln-lock-pin-btn')

    def open_lock_settings(self):
        self.page.evaluate("() => window.AppLock.openSettings()")
        self.page.wait_for_selector('#ln-lock-settings-modal.ln-lock-settings-visible', timeout=5000)


@pytest.fixture()
def app(context, base_url):
    return App(context, base_url)
