# 📝 Local Notes — Локальные Заметки

![Local Notes Screenshot](https://github.com/SerGioPlay01/localnotes/blob/main/sccc.png?raw=true)

[![Version](https://img.shields.io/badge/Version-1.9.5-brightgreen.svg)](https://github.com/SerGioPlay01/localnotes/releases)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM%20%2B%20HMAC--SHA--512-blue.svg)](https://github.com/SerGioPlay01/localnotes)
[![DOMPurify](https://img.shields.io/badge/XSS-DOMPurify-red.svg)](https://github.com/cure53/DOMPurify)
[![PWA](https://img.shields.io/badge/PWA-Enabled-purple.svg)](https://github.com/SerGioPlay01/localnotes)
[![Offline](https://img.shields.io/badge/Offline-Supported-orange.svg)](https://github.com/SerGioPlay01/localnotes)
[![Languages](https://img.shields.io/badge/Languages-12-yellow.svg)](https://github.com/SerGioPlay01/localnotes)
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
[![GitHub](https://img.shields.io/badge/GitHub-Репозиторий-black)](https://github.com/SerGioPlay01/localnotes)

---

## 🎯 О проекте

**Local Notes** — современное, безопасное и многофункциональное веб-приложение для создания, хранения и организации заметок прямо в браузере. Все данные хранятся локально на вашем устройстве — никакого сервера, никакой слежки, никаких аккаунтов.

### Миссия

Дать каждому **приватный, быстрый и многоязычный блокнот** в браузере: писать заметки с форматированием, организовывать их тегами и рабочими пространствами, экспортировать зашифрованные резервные копии и работать офлайн — без регистрации и без отправки данных на сервер.

### Цели проекта

| Цель | Что это значит на практике |
|------|----------------------------|
| **Приватность по умолчанию** | Заметки в IndexedDB на вашем устройстве. Нет бэкенда, аналитика только после согласия, облако — только если вы сами экспортируете файлы. |
| **Проверяемая безопасность** | Открытое клиентское шифрование (AES-256-GCM v4/v5), DOMPurify, строгий CSP, привязка `.note` к домену. |
| **Работает везде** | PWA, офлайн-кэш Service Worker, 12 языков UI, поддержка мобильной клавиатуры и safe-area на iOS. |
| **Лёгкость и скорость** | Собственный редактор (~15 KB) вместо тяжёлых WYSIWYG; криптография в Web Worker — UI не подвисает. |
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
- **🔐 Блокировка приложения** — опциональный PIN и/или файл доступа; авто-блокировка через 10 мин бездействия
- **🛡️ DOMPurify защита от XSS** — весь контент заметок санитизируется перед рендерингом
- **🌍 12 языков** — полная локализация интерфейса, включая все модальные окна и сообщения об ошибках
- **📱 PWA поддержка** — установка как нативное приложение; корректное обновление без бесконечных тостов
- **⚡ Собственный редактор** — LocalNotesEditor (~15KB) без внешних зависимостей
- **🗂️ Рабочие пространства** — отдельные коллекции заметок во вкладках (см. [WORKSPACES_README.md](WORKSPACES_README.md))
- **🏷️ Теги и цветовые метки** — организация заметок по темам
- **📅 Встроенный календарь** — просмотр заметок по датам (месяц / неделя / повестка)
- **🔄 Офлайн работа** — Service Worker + переключатель сетевого режима
- **📸 Скриншоты заметок** — экспорт карточки заметки в PNG
- **✅ Умные чеклисты** — плоский дизайн checkbox + input, кастомизация каждого пункта (цвет, приоритет, метка)
- **📋 11 шаблонов редактора** — встреча, проект, отчёт, мозговой штурм, лекция, карточка, исследование, дневной планировщик, недельный обзор, OKR, трекер привычек

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
await notesDB.saveNote(note);      // { id, content, creationTime, lastModified, title, tags?, dueDate?, color?, pinned?, workspaceId? }
await notesDB.getAllNotes();
await notesDB.getNote(id);
await notesDB.deleteNote(id);
await notesDB.saveSetting(key, value);
await notesDB.getSetting(key);
await notesDB.migrateFromLocalStorage();
```

**Схема IndexedDB:** база `LocalNotesDB` v1 — хранилища `notes` (keyPath: `id`) и `settings`.

### Шифрование (`window.encryption`)

Экземпляр `AdvancedEncryption` — пайплайн Max-2026 с Web Worker.

```javascript
const encrypted = await encryption.encrypt(plainText, password);
const decrypted = await encryption.decrypt(encrypted, password);
```

- **Форматы:** v5 (текущий), v4, v3, v2 (расшифровка legacy)
- **Привязка к домену:** только `localnotes-three.vercel.app`
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

### Блокировка приложения (`window.AppLock`)

```javascript
AppLock.isEnabled();      // включена ли блокировка
AppLock.isUnlocked();     // разблокирована ли текущая сессия
AppLock.lockNow();        // заблокировать сейчас
AppLock.openSettings();   // настройки блокировки
```

| Ключ хранилища | Назначение |
|----------------|------------|
| `ln_lock_pin_hash` | SHA-256 PIN-кода |
| `ln_lock_file_hash` | SHA-256 файла доступа |
| `ln_lock_enabled` | Режим: `pin`, `file`, `both` |
| `ln_lock_session` | Флаг разблокировки (`sessionStorage`) |
| `ln_lock_last_activity` | Таймер простоя |

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

Источники: `js/translations.js` + `json/lang.json`.

### Темы (`window.themeManager`)

```javascript
themeManager.applyTheme('dark' | 'light' | 'auto');
```

Ключ `localStorage`: `theme`; атрибут `data-theme` на `<html>`.

### Скриншоты (`window.takeNoteScreenshot`)

```javascript
await takeNoteScreenshot(noteObject);  // PNG-превью карточки заметки
```

### Безопасность (`window.SecurityManager`)

```javascript
new SecurityManager().getSecurityReport();
// { https, csp, frameBusting, userAgent, timestamp }
```

### Сетевой режим

```javascript
localStorage.getItem('ln_network_mode');  // 'online' | 'offline'
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

## 🔐 Шифрование (v4 — Max-2026)

Local Notes использует многоуровневый пайплайн шифрования для экспортируемых `.note` файлов:

```
ПАРОЛЬ
  │
  ▼
PBKDF2-SHA-512 (600 000 итераций)
  │
  ▼
HKDF-SHA-512 → 5 независимых ключей:
  K_aes   — AES-256-GCM  (шифрование)
  K_mac   — HMAC-SHA-512 (целостность)
  K_shuf  — Fisher-Yates перестановка блоков
  K_xor   — XOR-поток (SHA-512 PRF)
  K_cc    — резерв (слой ChaCha20)
  │
  ▼
ПАЙПЛАЙН ШИФРОВАНИЯ:
  1. Zero-padding (скрывает длину plaintext)
  2. XOR-поток (K_xor) — первый слой трансформации
  3. Перестановка блоков (K_shuf) — Fisher-Yates
  4. AES-256-GCM (K_aes) — основное шифрование
  5. HMAC-SHA-512 (K_mac) — Encrypt-then-MAC
  6. Canary bytes — детектор обрезки/порчи данных
  7. Zeroize всех промежуточных буферов
```

**Формат v4:** `magic(4) | version(1) | salt(32) | iv(12) | hmac(64) | cipher | canary(8)`

**Привязка к домену:** ключи криптографически привязаны к `localnotes-three.vercel.app` через параметр `info` HKDF — файлы невозможно расшифровать на другом домене.

**KDF cache key:** `SHA-256(пароль + соль)` — пароль никогда не хранится в открытом виде как ключ Map.

**Обратная совместимость** с форматами v2 и v3.

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

### Криптографические ID
- ID заметок генерируются через `crypto.getRandomValues()` — не `Math.random()`
- ID сообщений воркера используют CSPRNG
- Timing jitter использует CSPRNG (защита от timing-атак)

### Service Worker
- Обработчик события `message` проверяет origin источника по белому списку

---

## ✨ Основные возможности

### 📝 Редактор (LocalNotesEditor)
- ~15KB, без зависимостей — заменил TinyMCE (был 500KB+)
- Богатое форматирование: заголовки, списки, таблицы, ссылки, цитаты, блоки кода
- Медиа: изображения (drag & drop), видео (YouTube, Vimeo, Twitch, Rutube, VK, TikTok)
- Интерактивные чеклисты, пикер эмодзи, специальные символы
- Найти и заменить, счётчик слов/символов
- Цвет текста и выделения с синхронизацией позиции курсора
- Полноэкранный режим, Undo/Redo (Ctrl+Z / Ctrl+Y)
- Режим быстрого редактирования прямо в списке заметок

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
- Поддержка транслитерации (кириллица ↔ латиница)
- Два режима просмотра: сетка и список

### 💾 Экспорт и импорт
- Зашифрованные `.note` файлы (пайплайн AES-256-GCM v4)
- Экспорт/импорт HTML и Markdown
- Модал расшифровки с live-проверкой пароля — полностью переведён
- Понятные сообщения об ошибках: неверный пароль vs. неверный домен

---

## 🌐 Система переводов

Все 12 языков (EN, RU, UA, PL, CS, SK, BG, HR, SR, BS, MK, SL) имеют полные переводы для:

- Основного интерфейса (кнопки, заголовки, сообщения)
- Модала Decrypt Note (заголовок, метка пароля, кнопки, статусы, ошибка домена)
- Ошибок импорта (зашифрованный файл, ошибка файла, частичный успех)
- Календаря (кнопки Month/Week/Agenda, Today, названия месяцев, дни недели)
- Модала настроек заметки (теги, дата, цвет, закрепление)
- Панели инструментов редактора
- Всех страниц политик

Переводы хранятся в `js/translations.js` и `json/lang.json`, применяются через `window.t(key)`.

---

## 🏗️ Архитектура

### Структура файлов

```
localnotes/
├── index.html                    # Главная страница (EN)
├── manifest.json                 # PWA манифест
├── sw.js                         # Service Worker (с проверкой origin)
├── robots.txt / sitemap.xml
│
├── css/
│   ├── index.css                 # Основные стили
│   ├── app-lock.css              # Экран блокировки и настройки
│   ├── editor-modal.css          # Стили модальных окон редактора
│   ├── tags-calendar.css         # Теги, календарь, модал расшифровки
│   ├── workspaces.css            # UI рабочих пространств
│   └── img.css / highlight.css / print.css / page.css / apple.css
│
├── js/
│   ├── index.js                  # Логика приложения, шифрование v4/v5, импорт/экспорт
│   ├── app-lock.js               # Блокировка приложения (PIN / файл / idle)
│   ├── purify.min.js             # DOMPurify — санитизация XSS (локально)
│   ├── translations.js           # 12 языков, 400+ ключей
│   ├── translate.js              # Определение и переключение языка
│   ├── tags-calendar.js          # Система тегов + календарь
│   ├── screenshot.js             # Скриншот карточки заметки → PNG
│   ├── workspaces.js             # Менеджер рабочих пространств
│   ├── workspaces-integration.js
│   ├── workspaces-translations.js
│   ├── security.js               # SecurityManager + SecureStorage
│   ├── network-mode.js           # Переключатель онлайн/офлайн → SW
│   ├── themes.js / utils.js / selectors.js
│   ├── performance.js / editor-integration.js
│   └── date-utils.js / img.js / preloader.js / magicurl.js / pwa.js / crypto-worker.js
│
├── json/lang.json                # Статические переводы UI (все 12 языков)
│
├── localnoteseditor/
│   ├── core.js                   # Движок редактора (~15KB)
│   ├── styles.css
│   └── bootstrap-icons/
│
├── fonts/ favicon/ resources/
├── cookies_banner_universal/     # GDPR-совместимый баннер (Consent Mode v2)
│
└── [lang]/                       # ru, ua, pl, cs, sk, bg, hr, sr, bs, mk, sl
    ├── index.html
    ├── manifest.json
    ├── privacy_policy.html
    ├── usage_policy.html
    └── cookie_policy.html
```

### Технологический стек

| Слой | Технология |
|------|-----------|
| Frontend | Vanilla JS ES6+, HTML5, CSS3 |
| Редактор | LocalNotesEditor (собственный, без зависимостей) |
| Хранение | IndexedDB |
| Шифрование | Web Crypto API — AES-256-GCM + HMAC-SHA-512 + PBKDF2-SHA-512 |
| Санитизация XSS | DOMPurify (локально) |
| PWA | Service Worker + Web App Manifest |
| Аналитика | Google Analytics с Consent Mode v2 |
| Иконки | Bootstrap Icons |

### Поток данных

1. **Инициализация** → определение языка → тема → инициализация редактора
2. **Создание заметки** → LocalNotesEditor → IndexedDB
3. **Рендеринг заметки** → `DOMPurify.sanitize(content)` → `innerHTML`
4. **Экспорт** → 5-уровневый пайплайн шифрования → скачивание `.note` файла
5. **Импорт** → `DOMPurify.sanitize()` → модал расшифровки → валидация → IndexedDB
6. **Смена языка** → `updateButtonTexts()` → обновление всех элементов UI

---

## 🚀 Быстрый старт

### 🌐 Онлайн
Перейдите на [localnotes-three.vercel.app](https://localnotes-three.vercel.app/) — приложение готово к работе без установки.

### 💻 Локально

```bash
git clone https://github.com/SerGioPlay01/localnotes.git
cd localnotes
python -m http.server 8000
# или: npx serve .
```

Откройте `http://localhost:8000`.

> **Важно:** зашифрованные `.note` файлы привязаны к домену `localnotes-three.vercel.app`. Расшифровка на localhost работать не будет.

### Установка как PWA
Нажмите иконку «Установить» в адресной строке Chrome/Edge и подтвердите.

---

## 📋 История изменений

### v1.9.5 (текущая)
- **🔐 Блокировка приложения** — PIN и/или файл доступа, idle-блокировка (10 мин), экран блокировки с мобильной вёрсткой
- **🔌 Документация API** — полный справочник `window.*` в README (notesDB, encryption, AppLock, TagsCalendar, SW)
- **🔔 Исправлен PWA-апдейт** — нет бесконечного тоста «Доступно обновление»; `SKIP_WAITING` до перезагрузки
- **🎨 UI блокировки** — зелёная полоска по скруглению панели; убран лишний тост «Приложение заблокировано»

### v1.9.5
- **🛡️ Ужесточение CSP** — `unsafe-inline` удалён из `script-src`; все инлайн-скрипты вынесены во внешние файлы (`ga-init.js`, `script-loader.js`, `lang-redirect.js`, `page-init.js`)
- **🔒 DOMPurify hard-fail** — `index.js` бросает исключение при старте если DOMPurify не загружен; все небезопасные fallback удалены
- **✅ Переработанный чеклист** — плоский дизайн `checkbox + input` без блоков-обёрток; панель кастомизации каждого пункта: цвет (7 вариантов), приоритет (низкий/средний/высокий), текстовая метка; навигация Enter/Backspace
- **📋 11 шаблонов редактора** — Бизнес (встреча, проект, отчёт, мозговой штурм), Учёба (лекция, карточка, исследование), Планирование (день, неделя, OKR, трекер привычек); все переведены на 12 языков
- **🎨 Стили приоритета заметок** — цветной акцент теперь показывает градиентный фон + верхнюю полоску; состояния просрочено/сегодня/скоро перекрывают пользовательский цвет; бейджи дедлайна крупнее и жирнее
- **🔔 Исправлен PWA-тост обновления** — определяет уже ожидающий SW; `controllerchange` авто-перезагрузка; текст тоста переведён на 12 языков
- **🌍 Полная локализация** — кастомизация чеклиста, метки и контент шаблонов — все 12 языков
- **🐛 Исправлен цикл редиректов** — `lang-redirect.js` работает только на корневой `/`; английская версия очищает устаревший `preferredLanguage` из localStorage

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

**Почему нельзя расшифровать на localhost?**
Файлы `.note` криптографически привязаны к `localnotes-three.vercel.app` через HKDF domain binding. Это сделано намеренно — предотвращает расшифровку вне официального сайта.

**Как перенести заметки в другой браузер?**
Экспортируйте в `.note` файл, затем импортируйте на [localnotes-three.vercel.app](https://localnotes-three.vercel.app/).

**Как добавить новый язык?**
Добавьте языковой блок в `js/translations.js`, создайте папку `[lang]/` с HTML-страницами, добавьте язык в `js/translate.js`.

**Как работает блокировка приложения?**
Опциональный PIN (4–8 цифр) и/или файл доступа. Блокировка при новой сессии браузера или после 10 мин бездействия. На экране разблокировки показывается только настроенный способ.

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

**SerGio Play** — [GitHub](https://github.com/SerGioPlay01) | [Website](https://sergioplay-dev.vercel.app/)

---

<div align="center">

**⭐ Если проект понравился — поставьте звезду! ⭐**

[![GitHub stars](https://img.shields.io/github/stars/SerGioPlay01/localnotes?style=social)](https://github.com/SerGioPlay01/localnotes)

**🌐 [Попробуйте Local Notes прямо сейчас!](https://localnotes-three.vercel.app/)**

</div>
