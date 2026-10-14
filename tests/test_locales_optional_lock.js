#!/usr/bin/env node
// Dependency-free check: every language defines the optional-lock keys, uses
// the {n} placeholder for idle minutes, and keeps non-Latin scripts where the
// language uses them. Run: node tests/test_locales_optional_lock.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'locales');
const KEYS = ['lockStartWithout','lockStartWithoutHint','lockDeviceStatus','lockDeviceHonest','lockProtect','lockProtectTitle','lockTabOff','lockRemoveHint','lockCurrentPhrase','lockRemoveConfirmBtn','lockRemoved','lockVerifyFailed','lockIdleTitle','lockIdleMinutes','lockIdleNever','lockProtectedDone'];
const CYR = new Set(['ru', 'ua', 'bg', 'sr', 'mk']);
let failed = 0;
const fail = m => { failed++; console.error('FAIL ' + m); };
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
if (files.length !== 12) fail(`expected 12 locale files, found ${files.length}`);
for (const f of files) {
    const lang = f.replace('.json', '');
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const k of KEYS) {
        if (typeof d[k] !== 'string' || !d[k].trim()) { fail(`${lang}: missing/empty ${k}`); continue; }
        if (lang !== 'en' && d[k] === require('../locales/en.json')[k] && !/^\{n\}/.test(d[k])) fail(`${lang}: ${k} is still the English text`);
    }
    if (d.lockIdleMinutes && !d.lockIdleMinutes.includes('{n}')) fail(`${lang}: lockIdleMinutes lacks {n}`);
    if (CYR.has(lang) && !/[\u0400-\u04FF]/.test(d.lockStartWithout || '')) fail(`${lang}: expected Cyrillic`);
    if (!CYR.has(lang) && lang !== 'en' && /[\u0400-\u04FF]/.test(d.lockStartWithout || '')) fail(`${lang}: unexpected Cyrillic`);
}
if (failed) { console.error(`${failed} problem(s)`); process.exit(1); }
console.log(`OK - ${files.length} languages x ${KEYS.length} optional-lock keys`);
