#!/usr/bin/env node
/**
 * Verifies that every language file under /locales (and /locales/site)
 * defines exactly the same set of keys, and that no value is empty.
 *
 * Usage: node scripts/verify-locales.js
 * Exit code 0 = all good, 1 = problems found (prints details).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function verifyDir(dir, label) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.log(`[${label}] no .json files found in ${dir}`);
        return true;
    }

    const data = {};
    for (const f of files) {
        const lang = f.replace(/\.json$/, '');
        data[lang] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    }

    const langs = Object.keys(data).sort();
    const union = new Set();
    for (const l of langs) Object.keys(data[l]).forEach(k => union.add(k));

    let ok = true;
    for (const l of langs) {
        const keys = new Set(Object.keys(data[l]));
        const missing = [...union].filter(k => !keys.has(k)).sort();
        const empty = Object.entries(data[l]).filter(([, v]) => v === '' || v === null).map(([k]) => k).sort();
        const extra = [...keys].filter(k => !union.has(k)); // always empty by construction, kept for safety

        if (missing.length || empty.length || extra.length) {
            ok = false;
            console.log(`[${label}] ${l}: ${Object.keys(data[l]).length} keys`);
            if (missing.length) console.log(`  MISSING (${missing.length}): ${missing.join(', ')}`);
            if (empty.length) console.log(`  EMPTY VALUE (${empty.length}): ${empty.join(', ')}`);
            if (extra.length) console.log(`  UNEXPECTED: ${extra.join(', ')}`);
        }
    }

    if (ok) {
        console.log(`[${label}] OK - ${langs.length} languages, ${union.size} keys each, no gaps.`);
    }
    return ok;
}

function main() {
    const ok1 = verifyDir(path.join(ROOT, 'locales'), 'app');
    const ok2 = verifyDir(path.join(ROOT, 'locales', 'site'), 'site');
    process.exit(ok1 && ok2 ? 0 : 1);
}

main();
