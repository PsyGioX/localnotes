# 📝 Local Notes — Локальные Заметки

![Local Notes Screenshot](https://github.com/PsyGioX/localnotes/blob/main/sccc.png?raw=true)

[![Version](https://img.shields.io/badge/Version-1.11.1-brightgreen.svg)](https://github.com/PsyGioX/localnotes/releases)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM%20%2B%20HMAC--SHA--512-blue.svg)](https://github.com/PsyGioX/localnotes)
[![DOMPurify](https://img.shields.io/badge/XSS-DOMPurify-red.svg)](https://github.com/cure53/DOMPurify)
[![PWA](https://img.shields.io/badge/PWA-Enabled-purple.svg)](https://github.com/PsyGioX/localnotes)
[![Offline](https://img.shields.io/badge/Offline-Supported-orange.svg)](https://github.com/PsyGioX/localnotes)
[![Languages](https://img.shields.io/badge/Languages-12-yellow.svg)](https://github.com/PsyGioX/localnotes)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

### 📖 README на других языках
[![README EN](https://img.shields.io/badge/📖_README_English-blue)](README.md)

### 🌍 Выберите язык приложения

[![EN](https://img.shields.io/badge/🇺🇸_English-blue)](https://localnotes-three.vercel.app/)
[![RU](https://img.shields.io/badge/🇷🇺_Русский-red)](https://localnotes-three.vercel.app/ru/)
[![UA](https://img.shields.io/badge/🇺🇦_Українська-yellow)](https://localnotes-three.vercel.app/ua/)
[![PL](https://img.shields.io/badge/🇵🇱_Polski-green)](https://localnotes-three.vercel.app/pl/)
[![CS](https://img.shields.io/badge/🇨🇿_Čeština-orange)](https://localnotes-three.vercel.app/cs/)
[![SK](https://img.shields.io/badge/🇸🇰_Slovenčina-pink)](https://localnotes-three.vercel.app/sk/)
[![BG](https://img.shields.io/badge/🇧🇬_Български-purple)](https://localnotes-three.vercel.app/bg/)
[![HR](https://img.shields.io/badge/🇭🇷_Hrvatski-lightblue)](https://localnotes-three.vercel.app/hr/)
[![SR](https://img.shields.io/badge/🇷🇸_Српски-darkred)](https://localnotes-three.vercel.app/sr/)
[![BS](https://img.shields.io/badge/🇧🇦_Bosanski-teal)](https://localnotes-three.vercel.app/bs/)
[![MK](https://img.shields.io/badge/🇲🇰_Македонски-gold)](https://localnotes-three.vercel.app/mk/)
[![SL](https://img.shields.io/badge/🇸🇮_Slovenščina-lime)](https://localnotes-three.vercel.app/sl/)

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Открыть_сайт-brightgreen)](https://localnotes-three.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Репозиторий-black)](https://github.com/PsyGioX/localnotes)

---

## 🎯 О проекте

**Local Notes** — современное, безопасное и многофункциональное веб-приложение для создания, хранения и организации заметок прямо в браузере. Все данные хранятся локально на вашем устройстве — никакого сервера, никакой слежки, никаких аккаунтов.

### Миссия

Дать каждому **приватный, быстрый и многоязычный блокнот** в браузере: писать заметки с форматированием, организовывать их тегами и рабочими пространствами, экспортировать зашифрованные резервные копии и работать офлайн — без регистрации и без отправки данных на сервер.

### Цели проекта

| Цель | Что это значит на практике |
|------|----------------------------|
| **Приватность по умолчанию** | Заметки в IndexedDB на вашем устройстве, зашифрованные мастер-паролем. Нет бэкенда, аналитика только после согласия, облако — только если вы сами экспортируете файлы. |
| **Проверяемая безопасность** | Открытое клиентское шифрование (AES-256-GCM, формат `.note` v5), DOMPurify, строгий CSP, привязка `.note` к домену. |
| **Работает везде** | PWA, офлайн-кэш Service Worker, 12 языков UI, поддержка мобильной клавиатуры и safe-area на iOS. |
| **Лёгкость и скорость** | Собственный редактор без зависимостей (один скрипт, без сборки, кэшируется Service Worker) вместо тяжёлых WYSIWYG; криптография в Web Worker — UI не подвисает. |
| **Гибкая организация** | Теги, цвета, дедлайны, календарь, закрепление, рабочие пространства (вкладки), сетка/список, поиск с транслитерацией. |
| **Переносимые данные** | Экспорт/импорт HTML, Markdown, зашифрованных `.note` — заметки не привязаны к одной вкладке. |
| **Расширяемость** | Стабильный API через `window.*` для интеграций и скриптов без сборщика. |

### Принципы разработки

1. **Local-first** — сеть опциональна; офлайн-режим — полноценная функция.
2. **Явный контроль пользователя** — пароль шифрования, блокировка приложения, cookies и сетевой режим — только по вашему решению.
3. **Минимум зависимостей** — vanilla JS, DOMPurify и иконки локально.
4. **Progressive enhancement** — работает во вкладке; лучше как установленное PWA.

### 🏆 Ключевые особенности

- **🔒 Шифрование Max-2026** — AES-256-GCM + HMAC-SHA-512 + PBKDF2-SHA-512 (600k итераций) + привязка к домену
- **🔐 Зашифрованное хранилище / блокировка** — заметки шифруются «на диске» случайным ключом AES-256, защищённым мастер-паролем; дополнительно файл доступа и фраза восстановления из 12 слов; авто-блокировка через 10 мин; после 5 неверных попыток ввод блокируется на 60 с
- **🛡️ DOMPurify защита от XSS** — весь контент заметок санитизируется перед рендерингом
- **🌍 12 языков** — полная локализация интерфейса, включая все модальные окна и сообщения об ошибках
- **📱 PWA поддержка** — установка как нативное приложение; корректное обновление без бесконечных тостов
- **⚡ Собственный редактор** — LocalNotesEditor без внешних зависимостей: таблицы, блоки кода, врезки, формулы, `[[вики-ссылки]]`, шаблоны, режим Markdown
- **🎨 Рисование** — векторные наброски прямо в заметке: кисти, 30+ фигур, заливка и цвет заливки, стиль линии, стрелки, прозрачность, маркеры изменения размера; рисунки можно редактировать повторно
- **🗂️ Рабочие пространства** — отдельные коллекции заметок во вкладках (см. [WORKSPACES_README.md](WORKSPACES_README.md))
- **🏷️ Теги и цветовые метки** — организация заметок по темам
- **📅 Встроенный календарь** — просмотр заметок по датам (месяц / неделя / повестка)
- **🗃️ Task Board** — канбан-доска заметок
- **🔄 Офлайн работа** — Service Worker + сетевой режим Online / Auto / Offline
- **📸 Скриншоты заметок** — экспорт карточки заметки в PNG
- **✅ Умные чеклисты** — плоский дизайн checkbox + input, кастомизация каждого пункта (цвет, приоритет, метка)
- **📋 11 шаблонов редактора** — встреча, проект, отчёт, мозговой штурм, лекция, карточка, исследование, дневной планировщик, недельный обзор, OKR, трекер привычек + собственные шаблоны
- **🕸️ Graph View** — интерактивная карта вики-ссылок; перетаскивание, масштаб, фильтр по пространству, подсветка по поиску
- **🌐 Экспорт статического сайта** — заметки в самодостаточный сайт (HTML/CSS/JS + поиск), zip собирается полностью на клиенте
- **⌨️ Палитра команд** — `Ctrl+K` / `⌘K`: быстрые действия и мгновенный поиск по заметкам
- **🧭 Обучающий тур** — пошаговая подсветка основных кнопок панели

---

## 🔌 JavaScript API

Local Notes предоставляет **глобальный браузерный API** (`window.*`) для скриптов и интеграций. REST-сервера нет — всё выполняется на клиенте.

> **Совет:** откройте DevTools на [localnotes-three.vercel.app](https://localnotes-three.vercel.app/ru/) и вызывайте API из консоли.

### Ядро — заметки и UI (`js/index.js`)

| API | Тип | Описание |
|-----|-----|----------|
| `window.notesDB` | `NotesDatabase` | Слой доступа к IndexedDB |
| `window.loadNotes()` | `async function` | Перезагрузить и отрисовать все заметки |
| `window.openModal(id, content, creationTime)` | `function` | Открыть редактор (новая/существующая заметка) |
| `window.closeModal()` | `function` | Закрыть модал редактора |
| `window.filterNotes(query)` | `function` | Фильтр заметок по строке поиска |
| `window.exportNote(content, password)` | `async function` | Экспорт одной заметки в `.note` |
| `window.importNotesWithFormat(files, format)` | `async function` | Импорт HTML / Markdown / `.note` |
| `window.showCustomAlert(title, msg, type)` | `function` | Уведомление (`success` / `error` / `warning`) |
| `window.showCustomPrompt(title, defaultVal)` | `Promise<string>` | Диалог ввода текста |
| `window.showExportOptions(noteContent)` | `function` | Выбор формата экспорта |
| `window.toggleQuickEditMode()` | `function` | Быстрое редактирование в списке |
| `window.updateButtonTexts()` | `function` | Обновить UI после смены языка |

#### Методы `NotesDatabase`

```javascript
await notesDB.init();
await notesDB.saveNote(note);        // { id, content, creationTime, lastModified, title, tags?, dueDate?, color?, pinned?, workspaceId? }
await notesDB.saveNotePatch(patch);  // частичное обновление поверх сохранённой заметки (теги, закрепление, цвет не теряются)
await notesDB.getAllNotes();         // контент с встроенными изображениями
await notesDB.getAllNotes({ light: true });  // без байтов изображений — для списков, поиска, графа
await notesDB.getNote(id);           // тоже принимает { light: true }
await notesDB.deleteNote(id);

// История версий (хранятся последние 20 на заметку)
await notesDB.saveVersion(noteId, content, savedAt);
await notesDB.getVersions(noteId);
await notesDB.deleteVersion(versionId);
await notesDB.pruneVersions(noteId, keep);

// Настройки
await notesDB.saveSetting(key, value);
await notesDB.getSetting(key);
await notesDB.saveEncryptedSetting(key, value);
await notesDB.getEncryptedSetting(key);

// Хранилище шифрования (см. «Блокировка приложения»)
notesDB.vaultReady;                              // true, когда ключ данных разблокирован в памяти
await notesDB.isVaultSetup();
await notesDB.setVaultCredential(slot, secret);  // slot: 'pin' | 'file' | 'recovery'
await notesDB.unlockVaultWithCredential(slot, secret);
await notesDB.removeVaultCredential(slot);       // последний оставшийся способ удалить нельзя

await notesDB.migrateFromLocalStorage();
```

**Схема IndexedDB:** база `LocalNotesDB` **v2** — хранилища:

| Хранилище | Ключ | Индексы | Содержимое |
|-----------|------|---------|------------|
| `notes` | `id` | `creationTime`, `lastModified`, `title` | Заметки (контент зашифрован, если хранилище настроено) |
| `settings` | `key` | — | Настройки, слоты хранилища и обёрнутые ключи, записи изображений (`img:<hash>`) |
| `noteVersions` | авто `id` | `noteId`, `savedAt` | Предыдущие версии заметки |

Крупные изображения хранятся один раз (по хэшу) записями `img:<hash>` в `settings`; в HTML заметки остаётся `<img src="cid:ln-<hash>">` (проходит DOMPurify и не делает сетевых запросов). `gcImages()` удаляет неиспользуемые записи.

### Шифрование (`window.encryption`)

Экземпляр `AdvancedEncryption` — пайплайн Max-2026 с Web Worker.

```javascript
const encrypted = await encryption.encrypt(plainText, password);
const decrypted = await encryption.decrypt(encrypted, password);
```

- **Форматы:** v5 (текущий, его пишет `encrypt`); v4, v3, v2 по-прежнему расшифровываются (legacy)
- **Привязка к домену:** `.note` расшифровывается только на `localnotes-three.vercel.app`; для разработки допустимы `localhost` / `127.0.0.1`
- **Worker:** `js/crypto-worker.js`; fallback в main thread при ошибке

### Редактор (`window.localNotesEditorAPI`)

```javascript
localNotesEditorAPI.getContent();     // HTML
localNotesEditorAPI.setContent(html);
localNotesEditorAPI.getText();        // plain text
localNotesEditorAPI.clear();
localNotesEditorAPI.focus();
localNotesEditorAPI.undo();
localNotesEditorAPI.redo();
localNotesEditorAPI.isInitialized();
localNotesEditorAPI.getInstance();
```

Сам класс редактора (`insertImage()`, `insertVideo()`, `destroy()`, опции вроде `onWikiLinkSearch`, рисование и т. д.) описан в [`localnoteseditor/README.md`](localnoteseditor/README.md).

### Блокировка приложения / хранилище шифрования (`window.AppLock`)

`js/app-lock.js` — экран разблокировки **хранилища шифрования**: ввод правильного секрета и *есть* расшифровка заметок, а не вторая проверка поверх них.

- **Мастер-пароль** (от 8 символов) обязателен: при первом запуске показывается экран настройки, который нельзя закрыть; `AppLock.ensureUnlocked()` ожидается при загрузке приложения до показа заметок.
- Заметки шифруются случайным **ключом данных** AES-256. Сам ключ нигде не хранится: он «оборачивается» отдельно для каждого способа разблокировки («слот», у каждого свой ключ PBKDF2-SHA-512, 600k итераций): `pin` (пароль / PIN), `file` (необязательный файл доступа) и `recovery` (необязательная фраза из 12 слов). Любой настроенный слот открывает те же заметки.
- Мастер-пароль **нельзя сбросить**. Фраза восстановления показывается один раз при создании и нигде не хранится; новая фраза делает старую недействительной.
- Бездействие: 10 минут. После 5 неверных попыток ввод блокируется на 60 секунд (счётчики лежат в `localStorage`, поэтому перезагрузка страницы их не сбрасывает).

```javascript
AppLock.ensureUnlocked();  // показывает экран настройки/разблокировки; резолвится, когда хранилище открыто
AppLock.isUnlocked();      // ключ данных в памяти (то же, что notesDB.vaultReady)
AppLock.isEnabled();       // псевдоним isUnlocked()
AppLock.lockNow();         // заблокировать сейчас (псевдоним: AppLock.lock())
AppLock.openSettings();    // настройки блокировки (добавить / сменить / удалить способ разблокировки)
```

| Где | Ключ | Назначение |
|-----|------|------------|
| IndexedDB `settings` | `vaultSlots`, `vaultSalt_<slot>`, `vaultWrapped_<slot>` | Настроенные слоты, соли и обёрнутый ключ данных |
| `localStorage` | `ln_lock_last_activity` | Таймер простоя |
| `localStorage` | `ln_lock_failed_attempts`, `ln_lock_locked_until` | Ограничение попыток |

> В прежних версиях этого документа были ключи `ln_lock_pin_hash`, `ln_lock_file_hash`, `ln_lock_enabled`, `ln_lock_session`. Приложение их больше не использует.

### Graph View (`window.GraphView`)

```javascript
GraphView.open();     // открыть граф
GraphView.close();    // закрыть
GraphView.toggle();   // переключить
```

### Экспорт статического сайта (`window.SiteExport`)

```javascript
await SiteExport.open();   // открыть диалог экспорта
```

### Теги и календарь (`window.TagsCalendar`)

```javascript
TagsCalendar.getTags();
TagsCalendar.createTag(name, color);
TagsCalendar.deleteTag(id);
TagsCalendar.addTagToNote(noteId, tagId);
TagsCalendar.applyTagFilter(tagId);
TagsCalendar.openCalendar();
TagsCalendar.getNoteMetaFromModal();
window.showTagsPanel();
```

### i18n (`window.t`, `window.translations`)

```javascript
window.t('addNoteButton');
window.t('decryptOriginError', { allowed, current });
window.changeLanguage('ru');
window.currentLang;
```

Источники: `/locales/<lang>.json` (строки приложения, загружает `js/i18n.js`) и `/locales/site/<lang>.json` (статические страницы) — см. [`locales/README.md`](locales/README.md).

### Темы (`window.themeManager`)

```javascript
themeManager.applyTheme('dark' | 'light' | 'auto');
```

Ключ `localStorage`: `theme`; атрибут `data-theme` на `<html>`.

### Скриншоты (`window.takeNoteScreenshot`)

```javascript
await takeNoteScreenshot(noteObject);  // PNG-превью карточки заметки
```

### Отправка (`window.shareNoteContent`, Web Share Target)

```javascript
await shareNoteContent(noteObject);  // navigator.share(), при отсутствии — копирование в буфер
```

В обе стороны: кнопка «Поделиться» на карточке отправляет заголовок и текст через системное меню; `share_target` в `manifest.json` и `js/share-target.js` принимают данные из других приложений (и действия ярлыков) и создают новую заметку.

### Безопасность (`window.SecurityManager`)

```javascript
new SecurityManager().getSecurityReport();
// { https, csp, frameBusting, userAgent, timestamp }
```

### Сетевой режим

```javascript
localStorage.getItem('ln_network_mode');  // 'online' | 'auto' | 'offline'
window.lnNetworkModeRefreshLabels();
```

Сообщение SW: `{ type: 'SET_NETWORK_MODE', mode }`.

### Сообщения Service Worker (`sw.js`)

| Сообщение | Описание |
|-----------|----------|
| `{ type: 'SKIP_WAITING' }` | Активировать ожидающий SW (обновление PWA) |
| `{ type: 'GET_VERSION' }` | Версия кэша `{ version: 'static-vX.Y.Z' }` |
| `{ type: 'SET_NETWORK_MODE', mode }` | Онлайн/офлайн стратегия fetch |
| `{ type: 'PRECACHE_ALL' }` | Перекэшировать статику → `PRECACHE_DONE` |

### Схема объекта заметки

```javascript
{
  id: 'note_<timestamp>_<random>',
  content: '<p>HTML из редактора</p>',
  title: 'Заголовок',
  creationTime: 1710000000000,
  lastModified: 1710000000000,
  tags: ['tagId1'],
  dueDate: '2026-05-20',
  color: '#aefc6e',
  pinned: false,
  workspaceId: 'ws_...'
}
```

---

## 🔐 Шифрование (v5)

Одни и те же примитивы используются в двух местах: **хранилище** (заметки «на диске», см. «Блокировка приложения») и экспортируемые **`.note` файлы**.

```
ПАРОЛЬ
  │
  ▼
PBKDF2-SHA-512 (600 000 итераций, случайная соль 32 байта) → 512 бит
  │
  ▼
HKDF-SHA-512 (info = привязка к домену) → 2 независимых ключа:
  K_aes  — AES-256-GCM  (шифрование)
  K_mac  — HMAC-SHA-512 (целостность)
  │
  ▼
ШИФРОВАНИЕ:
  1. AES-256-GCM со свежим IV 12 байт (K_aes)
  2. HMAC-SHA-512 по заголовку + шифртексту (K_mac) — Encrypt-then-MAC
  3. Обнуление промежуточных ключей
```

**Формат v5:** `magic "NV5\0"(4) | version(1) | salt(32) | iv(12) | hmac(64) | шифртекст`, в base64. HMAC считается по 49-байтному заголовку и шифртексту и проверяется до расшифровки.

**Привязка к домену:** ключи криптографически привязаны к `localnotes-three.vercel.app` через параметр `info` HKDF — `.note` невозможно расшифровать на домене-клоне. `localhost` / `127.0.0.1` считаются частью той же границы доверия, чтобы работала локальная разработка.

**KDF cache key:** `SHA-256(пароль + соль)` — пароль не хранится как ключ Map.

**Legacy:** файлы v4 (дополнительные слои XOR-потока и перестановки блоков, padding, canary bytes), v3 и v2 по-прежнему читаются. Дополнительные слои v4 в v5 убраны в пользу обычных AES-256-GCM + HMAC-SHA-512.

---

## 🛡️ Модель безопасности

### Защита от XSS
- **DOMPurify** (раздаётся локально, без CDN) санитизирует весь контент заметок перед присвоением `innerHTML`
- Применяется при рендеринге, импорте и всех внутренних функциях парсинга HTML
- `sanitizeImportedHTML()` использует DOMPurify — удаляет `<script>`, обработчики событий (`on*`), `javascript:` URL

### Content Security Policy
- `unsafe-eval` удалён — динамическое выполнение кода заблокировано
- `assets.twitch.tv` / `api.twitch.tv` удалены из `script-src` / `connect-src`
- Twitch-эмбеды работают только через `frame-src` (player.twitch.tv, clips.twitch.tv)
- GA Consent Mode v2 — `analytics_storage: 'denied'` по умолчанию до получения согласия

### Защита от Clickjacking
- Реальный frame-busting: `window.top.location = window.self.location`
- Fallback для cross-origin фреймов: `document.documentElement.style.display = 'none'`

### Шифрование «на диске»
- После настройки хранилища заметки хранятся зашифрованными (AES-256-GCM); ключ данных находится в памяти только пока приложение разблокировано
- Экспорт статического сайта, а также HTML/Markdown — **открытый текст** по замыслу

### Криптографические ID
- ID заметок генерируются через `crypto.getRandomValues()` — не `Math.random()`
- ID сообщений воркера используют CSPRNG
- Timing jitter использует CSPRNG (защита от timing-атак)

### Service Worker
- Обработчик события `message` проверяет origin источника по белому списку

---

## ✨ Основные возможности

### 📝 Редактор (LocalNotesEditor)
- Один скрипт без зависимостей (`localnoteseditor/core.js`, без сборки) — заменил TinyMCE; подробности в [`localnoteseditor/README.md`](localnoteseditor/README.md)
- Богатое форматирование: заголовки, списки, таблицы, ссылки, цитаты, блоки кода с подсветкой, врезки (callout)
- Медиа: изображения (drag & drop), видео (YouTube, Vimeo, Twitch, Rutube, VK, TikTok)
- Интерактивные чеклисты, пикер эмодзи, специальные символы, дата/время
- **Формулы** — нативный MathML, редактируются на месте
- **Рисование** — типы кистей (перо, маркер, карандаш, каллиграфия, спрей, пунктир), ластик, 30+ фигур; для каждого объекта заливка и цвет заливки, стиль линии (сплошная / пунктир / точки), стрелки, прозрачность, *Сохранять пропорции*, маркеры изменения размера и инструмент «Переместить», который редактирует выбранный объект; рисунки хранятся как векторные данные и открываются двойным кликом
- Найти и заменить, статистика слов/символов, показ блоков, просмотр HTML-кода
- Цвет текста и выделения с синхронизацией цвета курсора
- Полноэкранный режим (F11) и режим фокуса (F12), Undo/Redo (Ctrl+Z / Ctrl+Y), справка по горячим клавишам (Ctrl+/), меню быстрой вставки (`/`)
- Режим Markdown, импорт и экспорт Markdown/HTML
- Режим быстрого редактирования прямо в списке заметок
- **Свои шаблоны** — сохранить любую заметку как шаблон с иконкой/категорией, переменные `{{date}}`/`{{time}}`/`{{weekday}}`, экспорт/импорт JSON

### ⌨️ Палитра команд
- `Ctrl+K` / `⌘K` — новая заметка, календарь, task board, вид списка/сетки, тема, заблокировать, Graph View, публикация статического сайта
- Мгновенный поиск по названиям и содержимому заметок
- Учитывает блокировку: пока приложение заблокировано, палитра отключена

### 🕸️ Graph View
- Кнопка на панели рядом с переключателем вида / задачами / блокировкой + пункт палитры команд
- Силовая раскладка всех связей `[[...]]` между заметками — строится из той же разметки, что и обратные ссылки, отдельного индекса нет
- Перетаскивание узлов, масштаб колесом, клик открывает заметку
- Фильтр по текущему пространству или всем заметкам; показ/скрытие «сирот»; подсветка по названию
- Без новых зависимостей — простая симуляция на `<canvas>`

### 🌐 Экспорт статического сайта
- Кнопка на панели и пункт палитры команд («Опубликовать как статический сайт»)
- Самодостаточный сайт: `index.html` + `style.css` + `app.js` + `notes.json`, поиск с транслитерацией
- Настоящий `.zip`, собранный на клиенте без библиотек (`CompressionStream('deflate-raw')` + собственная запись заголовков ZIP)
- Фильтры: рабочее пространство, исключение тегов, только закреплённые
- Результат — **открытый текст** HTML, хотя внутри приложения заметки шифруются; диалог предупреждает об этом

### 🔗 Вики-ссылки и обратные ссылки
- Введите `[[` в редакторе — появится список заметок для ссылки
- Панель обратных ссылок в настройках заметки

### 🏷️ Теги и организация
- Цветные теги — создание, редактирование, удаление с выбором цвета
- Фильтрация заметок по тегу
- Дата выполнения с визуальными индикаторами (просрочено / сегодня / скоро)
- Модал настроек заметки — теги, дата, цвет, закрепление — полностью переведён

### 📅 Календарь
- Три режима: Месяц, Неделя, Повестка
- Навигация с кнопкой «Сегодня»
- Заметки привязаны к дате создания и дате выполнения
- Полная локализация: названия месяцев, дни недели, все подписи

### 🔍 Поиск
- Мгновенный поиск по содержимому заметок
- Операторы: `#тег`, `is:pinned|overdue|today|soon`, `has:image|video|table|checklist|link`, `before:` / `after:YYYY-MM-DD` — можно комбинировать в одном запросе
- Поддержка транслитерации (кириллица ↔ латиница)
- Два режима просмотра: сетка и список

### 💾 Экспорт и импорт
- Зашифрованные `.note` файлы (AES-256-GCM, формат v5)
- Экспорт/импорт HTML и Markdown
- Импорт из **Notion** (zip с Markdown/HTML), **Evernote** (`.enex`) и **Google Keep** (Takeout zip); ZIP читается встроенным кодом на `DecompressionStream`, без библиотек
- Модал расшифровки с live-проверкой пароля — полностью переведён
- Понятные сообщения об ошибках: неверный пароль vs. неверный домен

### 📜 История версий
- Каждое сохранение существующей заметки запоминает предыдущее содержимое (только если оно изменилось)
- Просмотр, восстановление и удаление версий в настройках заметки — хранится 20 последних на заметку

### 📤 Отправка
- Кнопка «Поделиться» на карточке — системное меню `navigator.share()`, при отсутствии — копирование в буфер
- Web Share Target — можно отправлять текст/ссылки в Local Notes из других приложений; создаётся новая заметка
- Ярлыки на главном экране («Новая заметка» / «Поиск» / «Импорт»)

---

## 🌐 Система переводов

Все 12 языков (EN, RU, UA, PL, CS, SK, BG, HR, SR, BS, MK, SL) имеют полные переводы — по 864 ключа приложения и 223 ключа статических страниц на язык (проверяется `node scripts/verify-locales.js`). Охвачено:

- Основной интерфейс (кнопки, заголовки, сообщения)
- Экраны хранилища / блокировки, модал Decrypt Note, ошибки импорта
- Календарь, настройки заметки, Task Board, Graph View, палитра команд
- Панель инструментов редактора, диалоги, шаблоны и рисование
- Все страницы политик

Строки лежат в `/locales/<lang>.json` (приложение) и `/locales/site/<lang>.json` (статические страницы). `js/i18n.js` загружает только английский (запасной) и текущий язык; текст читается через `window.t(key)`. Подробности: [`locales/README.md`](locales/README.md).

---

## 🏗️ Архитектура

### Структура файлов

```
localnotes/
├── index.html / beta.html          # Главная страница (EN) и бета-страница
├── manifest.json                   # PWA манифест (share_target, ярлыки)
├── sw.js                           # Service Worker (precache, сетевые режимы, проверка origin)
├── vercel.json / robots.txt / sitemap*.xml
├── privacy_policy.html / usage_policy.html / cookie_policy.html / cookie.html
├── README.md / README_RU.md / WORKSPACES_README.md / release-checklist.md
│
├── css/                            # index, adaptive, apple, page, print, highlight, modal-system,
│                                   # editor-modal, app-lock, action-bar, sidebar, tags-calendar,
│                                   # task-board, workspaces, onboarding-tour, screenshot, scroll-top, img
│
├── js/
│   ├── index.js                    # Логика приложения, NotesDatabase (IndexedDB + хранилище), шифрование v5, импорт/экспорт
│   ├── app-lock.js                 # UI разблокировки хранилища, фраза восстановления, авто-блокировка
│   ├── crypto-worker.js            # PBKDF2 / AES вне главного потока
│   ├── security.js                 # SecurityManager (clickjacking) + SecureStorage
│   ├── purify.min.js               # DOMPurify — санитизация XSS (локально, без CDN)
│   ├── i18n.js                     # window.t() — грузит /locales/<lang>.json
│   ├── translate.js                # Определение и переключение языка (window.changeLanguage)
│   ├── editor-integration.js       # Создаёт LocalNotesEditor, вики-ссылки, раскладка под мобильную клавиатуру
│   ├── markdown.js                 # Markdown <-> HTML, живой режим Markdown, умная вставка
│   ├── import-formats.js           # Импорт из Notion / Evernote / Google Keep
│   ├── tags-calendar.js            # Теги + календарь
│   ├── task-board.js               # Канбан-доска
│   ├── sidebar.js                  # Сворачиваемая боковая панель заметок
│   ├── action-bar.js               # Сворачиваемый блок кнопок (вид / задачи / блокировка / граф / публикация)
│   ├── command-palette.js          # Палитра Ctrl+K
│   ├── graph-view.js               # Graph View (карта вики-ссылок)
│   ├── site-export.js              # Экспорт статического сайта (zip на клиенте)
│   ├── screenshot.js               # Карточка заметки → PNG
│   ├── share-target.js             # Web Share Target / ярлыки
│   ├── workspaces.js / workspaces-integration.js   # Менеджер пространств + интеграция
│   ├── onboarding-tour.js          # Пошаговый тур по панели
│   ├── network-mode.js             # Online / Auto / Offline → Service Worker
│   ├── pwa.js                      # Регистрация SW + тост обновления
│   ├── themes.js / utils.js / selectors.js / date-utils.js / img.js / scroll-top.js
│   ├── performance.js / preloader.js
│   ├── script-loader.js / page-init.js / lang-redirect.js / ga-init.js   # загрузчики, совместимые с CSP
│   └── highlight.min.js            # Подсветка кода
│
├── locales/                        # <lang>.json (приложение) и site/<lang>.json (статические страницы); README.md
├── scripts/verify-locales.js       # Проверка: у всех языков одинаковые ключи
│
├── localnoteseditor/               # Редактор: core.js, styles.css, bootstrap-icons/, документация (*.md)
├── cookies_banner_universal/       # GDPR-баннер (Consent Mode v2) + README
├── landing/                        # Статические многоязычные лендинги
├── fonts/ favicon/ resources/
│
└── [lang]/                         # ru, ua, pl, cs, sk, bg, hr, sr, bs, mk, sl
    ├── index.html / beta.html
    └── privacy_policy.html / usage_policy.html / cookie_policy.html
```

### Технологический стек

| Слой | Технология |
|------|-----------|
| Frontend | Vanilla JS ES6+, HTML5, CSS3 |
| Редактор | LocalNotesEditor (собственный, без зависимостей) |
| Хранение | IndexedDB (`LocalNotesDB` v2), шифрование «на диске» |
| Шифрование | Web Crypto API — AES-256-GCM + HMAC-SHA-512 + PBKDF2-SHA-512 |
| Санитизация XSS | DOMPurify (локально) |
| PWA | Service Worker + Web App Manifest |
| Аналитика | Google Analytics с Consent Mode v2 |
| Иконки | Bootstrap Icons |

### Поток данных

1. **Инициализация** → определение языка → тема → инициализация редактора
2. **Создание заметки** → LocalNotesEditor → IndexedDB
3. **Рендеринг заметки** → `DOMPurify.sanitize(content)` → `innerHTML`
4. **Экспорт** → PBKDF2 → HKDF → AES-256-GCM + HMAC-SHA-512 (v5) → скачивание `.note` файла
5. **Импорт** → `DOMPurify.sanitize()` → модал расшифровки → валидация → IndexedDB
6. **Смена языка** → `updateButtonTexts()` → обновление всех элементов UI

---

## 🚀 Быстрый старт

### 🌐 Онлайн
Перейдите на [localnotes-three.vercel.app](https://localnotes-three.vercel.app/) — приложение готово к работе без установки.

### 💻 Локально

```bash
git clone https://github.com/PsyGioX/localnotes.git
cd localnotes
python -m http.server 8000
# или: npx serve .
```

Откройте `http://localhost:8000`.

> **Важно:** зашифрованные `.note` файлы привязаны к домену `localnotes-three.vercel.app`: на сторонних (клонированных) доменах они не расшифруются. `localhost` / `127.0.0.1` допускаются для разработки и используют ту же привязку, поэтому файл с продакшена открывается локально и наоборот.

### Установка как PWA
Нажмите иконку «Установить» в адресной строке Chrome/Edge и подтвердите.

---

## 📋 История изменений

### v1.11.1 (текущая)
- **🎨 Рисование — параметры для готовых фигур.** С инструментом «Переместить» панель параметров теперь редактирует *выбранный* объект (цвет, размер, заливка, цвет заливки, стиль линии, стрелки, прозрачность); одно изменение — один шаг Undo
- **✨ Новые параметры** — отдельный **цвет заливки**, **стиль линии** (сплошная / пунктир / точки), **стрелки** (на конце / на обоих концах), **прозрачность** (10–100 %, полупрозрачный объект накладывается целиком)
- **✨ Маркеры изменения размера** у выбранного объекта; **Сохранять пропорции** (или Shift) сохраняет соотношение сторон при растягивании; линии и стрелки привязываются к 45°, а *Сохранять пропорции* теперь работает и для них при рисовании
- **🌍 12 языков** — 10 новых строк (864 ключа на язык)
- **📚 Документация обновлена** — шифрование (формат v5), хранилище / блокировка (слоты, фраза восстановления, ограничение попыток), схема IndexedDB v2, переводы в `/locales`, документация редактора приведена к реальному API; убраны ссылки на удалённые файлы

### v1.11.0
- **🗑️ Sync Nearby удалён** — синхронизация устройств через WebRTC (`js/lan-sync.js` + `js/qrcode.js`), кнопка на панели и пункт палитры команд удалены

### v1.10.1
- **🐛 Graph View** — один клик теперь открывает заметку (как и написано в подсказке), а не двойной клик, который мог открыть не ту заметку; клик и перетаскивание различаются по порогам движения/времени
- **🎨 Кнопки панели** — Graph View и «Опубликовать как статический сайт» встроены в общий сегментированный блок (`css/action-bar.css`) и сворачиваются вместе с ним
- **✏️ Переименование** «Экспорт как статический сайт» → **«Опубликовать как статический сайт»**
- **🔗 Экспорт сайта** — в подвале сгенерированного сайта ссылка на приложение
- **🎨 Чекбоксы** — в окнах блокировки используется общий кастомный чекбокс

### v1.10.0
- **✨ Graph View** — интерактивная граф-карта связей между заметками (перетаскивание, масштаб, фильтр по пространству, «сироты», подсветка по названию), `<canvas>` без библиотек
- **✨ Sync Nearby** — синхронизация устройств без сервера через одноразовый код (удалён в v1.11.0)
- **✨ Экспорт статического сайта** — переносимый сайт с поиском, zip собирается на клиенте; выбор пространства, исключение тегов, только закреплённые

### v1.9.9
- **✨ Сетевой режим** — добавлен вариант **Auto** (по `navigator.onLine`), переключение SW в cache-only при потере соединения; трёхпозиционный переключатель с индикатором связи
- **✨ Импорт из Notion, Evernote, Google Keep** — Notion (zip с Markdown/HTML), Evernote (`.enex` с датами), Keep (Takeout; чеклисты становятся чеклистами, закреплённые остаются закреплёнными); ZIP читается без внешних библиотек

### v1.9.8
- **✨ Расширенный поиск** — `is:`, `has:`, `before:`/`after:` + `#тег`
- **✨ История версий** — до 20 версий на заметку, просмотр/восстановление/удаление
- **✨ Web Share Target** — приём текста/ссылок из других приложений и работа ярлыков
- **✨ Кнопка «Поделиться»** на карточке (`navigator.share()` + копирование в буфер)
- **🐛 Подтверждение удаления** — список заметок и task board теперь используют единое окно подтверждения
- **➖ Напоминания удалены** — без сервера они могли работать только при открытой вкладке

### v1.9.7
- **🐛 Названия месяцев/дней недели** в календаре (ошибка в `t()` для массивов)
- **🐛 Дублирование заметок при перезагрузке** — `loadNotes()` теперь выполняется последовательно через очередь
- **🐛 Чеклисты после вставки шаблона** — повторная инициализация после любой вставки
- **✨ Свои шаблоны** — сохранение заметки как шаблона, переменные `{{date}}`, `{{time}}`, `{{weekday}}`, `{{datetime}}`, категории и иконки, экспорт/импорт JSON с санитизацией и лимитами
- **✨ Палитра команд (Ctrl+K / ⌘K)** — быстрые действия и поиск по заметкам
- **✨ Вики-ссылки** — `[[` открывает список заметок; панель обратных ссылок в настройках заметки

### v1.9.6
- **🔐 Блокировка приложения** — PIN и/или файл доступа, idle-блокировка (10 мин), экран блокировки с мобильной вёрсткой
- **🔌 Документация API** — справочник `window.*` (notesDB, encryption, AppLock, TagsCalendar, SW)
- **🔔 Исправлен PWA-апдейт** — нет бесконечного тоста «Доступно обновление»; `SKIP_WAITING` до перезагрузки
- **🎨 UI блокировки** — зелёная полоска по скруглению панели; убран лишний тост «Приложение заблокировано»

### v1.9.4
- **🛡️ Ужесточение CSP** — `unsafe-inline` удалён из `script-src`; все инлайн-скрипты вынесены во внешние файлы (`ga-init.js`, `script-loader.js`, `lang-redirect.js`, `page-init.js`)
- **🔒 DOMPurify hard-fail** — `index.js` бросает исключение при старте если DOMPurify не загружен; все небезопасные fallback удалены
- **✅ Переработанный чеклист** — плоский дизайн `checkbox + input`; панель кастомизации пункта: цвет (7 вариантов), приоритет, метка; навигация Enter/Backspace
- **📋 11 шаблонов редактора** — Бизнес, Учёба, Планирование; переведены на 12 языков
- **🎨 Стили приоритета заметок** — градиентный фон + верхняя полоска; просрочено/сегодня/скоро перекрывают пользовательский цвет; крупнее бейджи дедлайна
- **🔔 Исправлен PWA-тост обновления** — определяет уже ожидающий SW; `controllerchange` авто-перезагрузка; текст переведён на 12 языков
- **🌍 Полная локализация** — кастомизация чеклиста, метки и контент шаблонов
- **🐛 Исправлен цикл редиректов** — `lang-redirect.js` работает только на корневой `/`

### v1.2.1
- **🔐 Шифрование v4 (Max-2026)** — PBKDF2-SHA-512 (600k итер.) + HKDF → 5 ключей + XOR-поток + перестановка блоков + HMAC-SHA-512 + canary bytes + zeroize
- **🔗 Привязка к домену** — `.note` файлы криптографически привязаны к `localnotes-three.vercel.app`
- **🔒 SecureStorage** — localStorage теперь шифруется AES-256-GCM + HMAC (сессионный ключ через HKDF)
- **🌍 Полная локализация ошибок** — ошибки импорта, ошибка домена, ошибки целостности — все 12 языков
- **🛡️ Защита от timing-атак** — jitter-задержки, constant-time сравнения, zeroize буферов

### v1.1.0
- **LocalNotesEditor** — замена TinyMCE: на 97% меньше, в 50 раз быстрее инициализация
- **Система тегов** — цветные теги, фильтрация, дата выполнения
- **Календарь** — три режима просмотра с полной локализацией
- **Полная локализация** — Calendar, Decrypt modal, Note Settings — все 12 языков

### v1.0.3
- Полный импорт Markdown с изображениями
- Мониторинг производительности (Core Web Vitals)
- Усиленная безопасность (CSP, XSS)
- Добавлены языки: украинский, боснийский, македонский, сербский

---

## ❓ FAQ

**Где хранятся мои заметки?**
Локально в IndexedDB вашего браузера. Данные никогда не передаются на сервер.

**Насколько безопасно шифрование?**
AES-256-GCM с PBKDF2-SHA-512 (600 000 итераций) + HMAC-SHA-512 + привязка к домену. Лучший стандарт защиты на 2026 год.

**Почему `.note` не расшифровывается на другом сайте?**
Файлы `.note` криптографически привязаны к `localnotes-three.vercel.app` через HKDF domain binding. Это сделано намеренно — защита от доменов-клонов. (`localhost` / `127.0.0.1` разрешены для локальной разработки.)

**Как перенести заметки в другой браузер?**
Экспортируйте в `.note` файл, затем импортируйте на [localnotes-three.vercel.app](https://localnotes-three.vercel.app/).

**Как добавить новый язык?**
Добавьте `locales/<lang>.json` и `locales/site/<lang>.json` с теми же ключами, что в `en.json` (проверьте `node scripts/verify-locales.js`), создайте папку `[lang]/` с HTML-страницами, добавьте код в `supportedLanguages` в `js/translate.js` и в список в `sw.js`.

**Как работает блокировка приложения?**
Это экран разблокировки хранилища шифрования. При первом запуске вы создаёте мастер-пароль (от 8 символов); дополнительно можно добавить файл доступа и фразу восстановления из 12 слов. Приложение блокируется при новой сессии браузера и после 10 мин бездействия; 5 неверных попыток блокируют ввод на 60 секунд.

**Я забыл мастер-пароль — можно восстановить заметки?**
Только с помощью фразы восстановления (если вы её создали и сохранили) или другого настроенного способа, например файла доступа. Иначе заметки прочитать нельзя — сервера, где можно сбросить пароль, нет.

**Есть ли публичный API?**
Да — см. раздел [JavaScript API](#-javascript-api). Основные функции доступны через `window.*` для скриптов и интеграций.

**Работает ли офлайн?**
Да — Service Worker кэширует все ресурсы после первой загрузки.

**DOMPurify загружается с CDN?**
Нет — `js/purify.min.js` раздаётся локально. Это сохраняет эффективность CSP `script-src 'self'` и исключает сторонние зависимости.

---

## 🤝 Вклад в проект

Приветствуются любые улучшения:

1. Fork репозитория
2. Создайте ветку: `git checkout -b feature/my-feature`
3. Внесите изменения и протестируйте
4. Создайте Pull Request

Особенно нужны: переводы на новые языки, улучшения доступности (a11y), тесты.

---

## 📄 Лицензия

MIT — подробности в файле [LICENSE](LICENSE).

---

## 👨‍💻 Автор

**PsyGioX** — [GitHub](https://github.com/PsyGioX) | [Website](https://psygiox-dev.vercel.app/)

---

<div align="center">

**⭐ Если проект понравился — поставьте звезду! ⭐**

[![GitHub stars](https://img.shields.io/github/stars/PsyGioX/localnotes?style=social)](https://github.com/PsyGioX/localnotes)

**🌐 [Попробуйте Local Notes прямо сейчас!](https://localnotes-three.vercel.app/)**

</div>
