# Tests

Real-browser tests for the vault / App Lock (headless Chromium via Playwright).
Every test gets a fresh browser context (empty IndexedDB + localStorage) and the
service worker is blocked. No network access is needed.

```bash
pip install pytest playwright
playwright install chromium
pytest tests/ -v

node tests/test_locales_optional_lock.js     # locale keys, no dependencies
node scripts/verify-locales.js               # key parity across the 12 languages
```
