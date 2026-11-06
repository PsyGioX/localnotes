#!/usr/bin/env node
/*
 * Local Notes — a local-first, privacy-focused notes app (PWA): rich-text/Markdown editor,
 * AES-256-GCM encrypted storage in the browser, offline mode, 12 languages. No server-side data.
 * Local Notes — локальное приватное приложение для заметок (PWA): редактор rich-text/Markdown,
 * шифрование AES-256-GCM в браузере, офлайн-режим, 12 языков. Данные не уходят на сервер.
 *
 * Copyright (c) 2026 PsyGioX. Licensed under the MIT License.
 * Source: https://github.com/PsyGioX/localnotes — Site: https://localnotes-three.vercel.app
 *
 * Copyright (c) 2026 PsyGioX. Лицензия MIT.
 * Исходники: https://github.com/PsyGioX/localnotes — Сайт: https://localnotes-three.vercel.app
 */
/**
 * Verifies the translation files under /locales and /locales/site:
 *   1. every language defines the same set of keys (plural keys are compared by
 *      base name — see below) and no value is empty;
 *   2. {placeholders} match English in every language;
 *   3. plural keys (`key_one`, `key_few`, …) provide `_other` and every CLDR
 *      category the language actually needs (Intl.PluralRules);
 *   4. (app only) every key used in the code — t('k'), tn('k'), _('k'), data-i18n*="k" —
 *      exists in en.json;
 *   5. (warning only) values identical to English in non-English files.
 *
 * Usage: node scripts/verify-locales.js [--strict]   (--strict: warnings fail too)
 * Exit code 0 = all good, 1 = problems found (prints details).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');
const PLURAL_RE = /^(.+)_(zero|one|two|few|many|other)$/;
const BCP = { ua: 'uk' };
let warnings = 0;

function cats(lang) {
    try { return new Intl.PluralRules(BCP[lang] || lang).resolvedOptions().pluralCategories; }
    catch (e) { return ['one', 'other']; }
}
function placeholders(v) {
    return [...String(v).matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(m => m[1]).sort().join(',');
}
/** plural base names = keys that have a `_other` sibling */
function pluralBases(keys) {
    const bases = new Set();
    for (const k of keys) { const m = k.match(PLURAL_RE); if (m && m[2] === 'other') bases.add(m[1]); }
    return bases;
}
function logicalKeys(keys, bases) {
    const out = new Set();
    for (const k of keys) {
        const m = k.match(PLURAL_RE);
        out.add(m && bases.has(m[1]) ? m[1] + '_*' : k);
    }
    return out;
}

function collectCodeKeys() {
    const found = new Map();
    const skip = new Set(['node_modules', '.git', 'locales', 'scripts']);
    (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (skip.has(e.name)) continue;
            const f = path.join(dir, e.name);
            if (e.isDirectory()) { walk(f); continue; }
            if (!/\.(js|html)$/.test(e.name)) continue;
            const src = fs.readFileSync(f, 'utf8');
            const add = k => { if (!found.has(k)) found.set(k, path.relative(ROOT, f)); };
            for (const m of src.matchAll(/(?:^|[^\w$.])(?:window\.)?(?:t|tn|tr)\(\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]/g)) add(m[1]);
            for (const m of src.matchAll(/\b_\(\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]/g)) add(m[1]);
            for (const m of src.matchAll(/data-i18n(?:-[a-z]+)?=["']([A-Za-z][A-Za-z0-9_]*)["']/g)) add(m[1]);
        }
    })(ROOT);
    return found;
}

function verifyDir(dir, label, codeKeys) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    if (files.length === 0) { console.log(`[${label}] no .json files found in ${dir}`); return true; }

    const data = {};
    for (const f of files) data[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const langs = Object.keys(data).sort();
    const en = data.en || {};
    const bases = new Set();
    for (const l of langs) pluralBases(Object.keys(data[l])).forEach(b => bases.add(b));

    const union = new Set();
    for (const l of langs) logicalKeys(Object.keys(data[l]), bases).forEach(k => union.add(k));

    let ok = true;
    for (const l of langs) {
        const own = Object.keys(data[l]);
        const logical = logicalKeys(own, bases);
        const problems = [];
        const missing = [...union].filter(k => !logical.has(k)).sort();
        if (missing.length) problems.push(`MISSING (${missing.length}): ${missing.join(', ')}`);
        const empty = Object.entries(data[l]).filter(([, v]) => v === '' || v === null).map(([k]) => k);
        if (empty.length) problems.push(`EMPTY VALUE (${empty.length}): ${empty.join(', ')}`);

        // plural categories
        const need = cats(l);
        for (const b of bases) {
            const have = ['zero', 'one', 'two', 'few', 'many', 'other'].filter(c => data[l][b + '_' + c] != null);
            if (!have.includes('other')) { problems.push(`PLURAL ${b}: missing _other`); continue; }
            const lack = need.filter(c => !have.includes(c));
            if (lack.length) problems.push(`PLURAL ${b}: missing ${lack.join('/')} for "${l}"`);
        }

        // placeholders vs English
        if (l !== 'en') {
            const bad = [];
            for (const k of own) {
                const m = k.match(PLURAL_RE);
                const ref = en[k] != null ? en[k] : (m ? (en[m[1] + '_other'] != null ? en[m[1] + '_other'] : en[m[1] + '_one']) : undefined);
                if (ref == null) continue;
                if (placeholders(ref) !== placeholders(data[l][k])) {
                    // plural "one" forms may legitimately drop {n} ("one comment")
                    if (m && m[2] !== 'other' && placeholders(data[l][k]) === '') continue;
                    bad.push(`${k} (en: {${placeholders(ref)}} / ${l}: {${placeholders(data[l][k])}})`);
                }
            }
            if (bad.length) problems.push(`PLACEHOLDER MISMATCH (${bad.length}): ${bad.join('; ')}`);

            const same = own.filter(k => typeof en[k] === 'string' && data[l][k] === en[k] && /[A-Za-zА-Яа-я]{4,}/.test(en[k]));
            if (same.length) { warnings += same.length; console.log(`[${label}] ${l}: warning — ${same.length} value(s) identical to English${same.length <= 8 ? ': ' + same.join(', ') : ''}`); }
        }

        if (problems.length) {
            ok = false;
            console.log(`[${label}] ${l}: ${own.length} keys`);
            problems.forEach(p => console.log('  ' + p));
        }
    }

    if (codeKeys) {
        const defined = new Set(Object.keys(en));
        const unknown = [...codeKeys.entries()].filter(([k]) => !defined.has(k) && !bases.has(k)).sort();
        if (unknown.length) {
            // keys built dynamically or belonging to other namespaces show up as warnings, not errors
            warnings += unknown.length;
            console.log(`[${label}] warning — ${unknown.length} key(s) used in code but not in en.json:`);
            unknown.slice(0, 40).forEach(([k, f]) => console.log(`  ${k}  (${f})`));
        }
    }

    if (ok) console.log(`[${label}] OK - ${langs.length} languages, ${union.size} keys each, no gaps.`);
    return ok;
}

function main() {
    const codeKeys = collectCodeKeys();
    const ok1 = verifyDir(path.join(ROOT, 'locales'), 'app', codeKeys);
    const ok2 = verifyDir(path.join(ROOT, 'locales', 'site'), 'site', null);
    const ok = ok1 && ok2 && !(STRICT && warnings);
    if (warnings) console.log(`\n${warnings} warning(s)${STRICT ? ' (strict mode: failing)' : ''}.`);
    process.exit(ok ? 0 : 1);
}

main();
