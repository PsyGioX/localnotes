# Translations (`/locales`)

Single source of truth for all translated text in Local Notes, and the
files the app actually loads at runtime — nothing is generated anymore.

This replaces three previously-scattered, out-of-sync, and much heavier
files that have been **deleted**:

- ~~`js/translations.js`~~ — 424 KB JS object holding all 12 languages,
  loaded in full on every single page load regardless of which language
  the visitor needed.
- ~~`js/workspaces-translations.js`~~ — a second object merged into the
  first at runtime via `Object.assign`.
- ~~`json/lang.json`~~ — a separate, partially stale 160 KB copy used only
  by the static landing pages.

## Layout

```
locales/
  en.json  ru.json  ua.json  pl.json  cs.json  sk.json
  bg.json  hr.json  sr.json  bs.json  mk.json  sl.json     <- in-app strings (t())
  site/
    en.json ... sl.json                                     <- static landing-page strings
```

Every file is a **flat** `{ "key": "value" }` map — no nesting, no
generated boilerplate. Every language file in a given folder has
**exactly the same set of keys** (enforced — see `verify-locales.js`
below): 652 keys in `locales/`, 223 keys in `locales/site/`.

## How the app loads them now

- **`js/i18n.js`** (replaces `js/translations.js`) loads only two files —
  `/locales/en.json` (fallback) and `/locales/<currentLang>.json` — via a
  **synchronous** `XMLHttpRequest`. It's synchronous on purpose:
  `script-loader.js` runs scripts in a fixed order, and the rest of the
  app (`index.js` and friends) reads `window.translations` / calls `t()`
  immediately after this script runs, with no promise to await. This cuts
  what a page loads from one 424 KB file to two files of roughly 25-40 KB
  each.
- **`js/translate.js`** (the static-page / language-switcher logic) now
  fetches `/locales/site/<lang>.json` + `/locales/<lang>.json` for
  whichever language the visitor picks, instead of one 160 KB file
  containing all 12 languages. It merges both into `window.langData` (for
  the static DOM text it updates directly) and into `window.translations`
  (so `t()` reflects the switched language immediately too).
- **`sw.js`** precaches all 24 locale files (they're small — together
  still smaller than the single old `translations.js`), so offline mode
  and language switching offline keep working exactly as before.

## Editing translations

1. Edit the relevant `locales/<lang>.json` (or `locales/site/<lang>.json`)
   file directly — it's what ships, there's no build step.
2. Run `node scripts/verify-locales.js` to confirm every language still
   has the exact same key set (catches typos/missing keys immediately).
3. Commit.

## What was fixed in the original cleanup pass

- `ru` had 8 extra meta/SEO keys that no other language had — pulled the
  real localized values for every language from each `/xx/index.html`'s
  `<title>`/`<meta>` tags.
- 10 of 12 languages were missing ~55-63 keys for newer features (command
  palette, custom templates, backlinks, version history, find & replace) —
  translated and filled in.
- The old `json/lang.json` was short 9 keys in `hr/sr/bs/mk/sl` and one in
  `en` — filled from the same sources.

## Note on cache-busting

The `?v=1.9.13` query-string versioning in HTML/`script-loader.js` was
**not** bumped as part of this change — that's a release-process decision
(see `release-checklist.md`). Bump it before shipping so returning users'
service worker picks up `js/i18n.js` and the new `/locales` files instead
of trying to fetch the now-deleted `js/translations.js` /
`json/lang.json` from its old cache.
