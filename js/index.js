/**
 * Local Notes - Main Application
 * Based on original code, TinyMCE replaced with LocalNotesEditor
 */

// DOMPurify is a hard dependency — abort early if missing
if (typeof DOMPurify === 'undefined') {
    throw new Error('DOMPurify failed to load — aborting to prevent XSS');
}

// ============================================================================
// RESPONSIVE MANAGER
// ============================================================================
class ResponsiveManager {
    constructor() {
        this.breakpoints = { mobile: 768, tablet: 1024, largeTablet: 1366, desktop: 1200 };
        this.currentBreakpoint = this.getCurrentBreakpoint();
        this.isMobile = this.currentBreakpoint === 'mobile';
        this.isTablet = this.currentBreakpoint === 'tablet';
        this.isLargeTablet = this.currentBreakpoint === 'largeTablet';
        this.isDesktop = this.currentBreakpoint === 'desktop';
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isTabletDevice = this.isTablet || this.isLargeTablet;
        this.init();
    }
    getCurrentBreakpoint() {
        const w = window.innerWidth;
        if (w < 768) return 'mobile';
        if (w < 1024) return 'tablet';
        if (w < 1366) return 'largeTablet';
        return 'desktop';
    }
    init() {
        document.documentElement.classList.add(`${this.currentBreakpoint}-device`);
        if (this.isTouch) document.documentElement.classList.add('touch-device');
        if (this.isTabletDevice) document.documentElement.classList.add('tablet-device');
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('orientationchange', () => setTimeout(() => this.handleResize(), 100));
        if (this.isTabletDevice) this.initTabletOptimizations();
    }
    handleResize() {
        const nb = this.getCurrentBreakpoint();
        if (nb !== this.currentBreakpoint) {
            document.documentElement.classList.remove(`${this.currentBreakpoint}-device`);
            this.currentBreakpoint = nb;
            this.isMobile = nb === 'mobile'; this.isTablet = nb === 'tablet';
            this.isLargeTablet = nb === 'largeTablet'; this.isDesktop = nb === 'desktop';
            this.isTabletDevice = this.isTablet || this.isLargeTablet;
            document.documentElement.classList.add(`${nb}-device`);
        }
    }
    initTabletOptimizations() {
        document.querySelectorAll('button, input, select, textarea, .note, .modal-buttons-container button').forEach(t => {
            t.style.minHeight = '44px'; t.style.touchAction = 'manipulation';
        });
        const obs = new MutationObserver(muts => muts.forEach(m => {
            if (m.type === 'attributes' && m.attributeName === 'style') {
                const modal = m.target;
                if (modal.classList.contains('modal') && modal.style.display === 'block') this.applyFullscreenModal(modal);
            }
        }));
        document.querySelectorAll('.modal').forEach(m => obs.observe(m, { attributes: true, attributeFilter: ['style'] }));
    }
    applyFullscreenModal(modal) {
        if (!this.isTabletDevice) return;
        const mc = modal.querySelector('.modal-content');
        if (mc) mc.style.cssText = 'width:100vw!important;height:100vh!important;margin:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;border-radius:0!important;position:fixed!important;transform:none!important;display:flex!important;flex-direction:column!important;background:var(--modal-bg)!important;border:none!important;box-shadow:none!important;z-index:10000!important;';
    }
    optimizeScrolling() {
        if (this.isTabletDevice) {
            document.documentElement.style.scrollBehavior = 'smooth';
            const nc = document.getElementById('notesContainer');
            if (nc) { nc.style.webkitOverflowScrolling = 'touch'; nc.style.overscrollBehavior = 'contain'; }
        }
    }
    resetEditorStyles() {
        const ec = document.getElementById('editorContainer');
        if (ec) { ec.style.height = ''; ec.style.minHeight = ''; }
    }
}

// ============================================================================
// POINTER EVENT MANAGER
// ============================================================================
class PointerEventManager {
    constructor() {
        this.pointerType = 'mouse'; this.isTouchDevice = false; this.isPenDevice = false;
        this.init();
    }
    init() {
        if (window.PointerEvent) {
            ['pointerdown','pointermove','pointerup'].forEach(ev =>
                document.addEventListener(ev, e => this.updatePointerType(e), { passive: true }));
        } else {
            this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (this.isTouchDevice) this.pointerType = 'touch';
        }
    }
    updatePointerType(e) {
        if (e.pointerType) { this.pointerType = e.pointerType; this.isTouchDevice = e.pointerType === 'touch'; this.isPenDevice = e.pointerType === 'pen'; }
    }
    getEventType() { return this.isTouchDevice ? 'touchstart' : this.isPenDevice ? 'pointerdown' : 'click'; }
    isTouch() { return this.isTouchDevice; }
    isPen() { return this.isPenDevice; }
    isMouse() { return this.pointerType === 'mouse'; }
    getPointerType() { return this.pointerType; }
}

function isSupportedFileExtension(filename) {
    return ['.note','.html','.md'].includes('.' + filename.split('.').pop().toLowerCase());
}

const pointerManager = new PointerEventManager();
const responsiveManager = new ResponsiveManager();

// ============================================================================
// GLOBALS
// ============================================================================
// localNotesEditorInstance declared in editor-integration.js
let currentNoteId = null;
let quickEditActive = false;
const getCurrentLang = () => (window.currentLang || navigator.language || 'en').split('-')[0];
let currentLang = getCurrentLang();

// ============================================================================
// NOTES DATABASE (from backup)
// ============================================================================
class NotesDatabase {
    constructor() { this.dbName = 'LocalNotesDB'; this.dbVersion = 1; this.db = null; }
    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.dbVersion);
            req.onerror = () => reject(new Error('Failed to open database'));
            req.onsuccess = () => { this.db = req.result; resolve(this.db); };
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('notes')) {
                    const s = db.createObjectStore('notes', { keyPath: 'id' });
                    s.createIndex('creationTime', 'creationTime', { unique: false });
                    s.createIndex('lastModified', 'lastModified', { unique: false });
                    s.createIndex('title', 'title', { unique: false });
                }
                if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
            };
        });
    }
    async saveNote(note) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['notes'], 'readwrite');
            const req = tx.objectStore('notes').put(note);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async getAllNotes() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['notes'], 'readonly');
            const req = tx.objectStore('notes').getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async getNote(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['notes'], 'readonly');
            const req = tx.objectStore('notes').get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async deleteNote(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['notes'], 'readwrite');
            const req = tx.objectStore('notes').delete(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async saveSetting(key, value) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['settings'], 'readwrite');
            const req = tx.objectStore('settings').put({ key, value });
            req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
        });
    }
    async getSetting(key) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['settings'], 'readonly');
            const req = tx.objectStore('settings').get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => reject(req.error);
        });
    }
    async migrateFromLocalStorage() {
        try {
            const existing = await this.getAllNotes();
            if (existing.length > 0) return;
            const keys = Object.keys(localStorage).filter(k => k.startsWith('note_'));
            for (const key of keys) {
                try {
                    const d = JSON.parse(localStorage.getItem(key));
                    await this.saveNote({ id: key, content: d.content, creationTime: d.creationTime, lastModified: d.lastModified, title: this.extractTitle(d.content) });
                } catch (e) { console.error(`Migration error for ${key}:`, e); }
            }
        } catch (e) { console.error('Migration error:', e); }
    }
    extractTitle(content) {
        const d = document.createElement('div');
        d.innerHTML = DOMPurify.sanitize(content || '');
        const h = d.querySelector('h1,h2,h3,h4,h5,h6');
        if (h) return h.textContent.trim();
        const p = d.querySelector('p');
        if (p) { const t = p.textContent.trim(); return t.length > 50 ? t.substring(0, 50) + '...' : t; }
        return 'Untitled';
    }
}

const notesDB = new NotesDatabase();

// ============================================================================
// ENCRYPTION  ·  MAX-2026 EDITION
// ============================================================================
//
//  Архитектура защиты (defence-in-depth):
//
//  PASSWORD
//    │
//    ▼
//  ┌─────────────────────────────────────────────────────────────────────┐
//  │  KDF PIPELINE                                                       │
//  │  PBKDF2-SHA-512 (600 000 iter)  →  HKDF-SHA-512  →  5 ключей:     │
//  │    K_aes   (256 bit)  — AES-256-GCM                                │
//  │    K_cc    (256 bit)  — ChaCha20-Poly1305 (XOR-эмуляция)          │
//  │    K_mac   (256 bit)  — HMAC-SHA-512                               │
//  │    K_shuf  (256 bit)  — Fisher-Yates block shuffle seed            │
//  │    K_xor   (256 bit)  — XOR-stream keystream seed                  │
//  └─────────────────────────────────────────────────────────────────────┘
//    │
//    ▼
//  ENCRYPT PIPELINE
//    1. zeropad(plaintext)          — скрываем длину (padding до блока 64 байт)
//    2. xorStream(K_xor, padded)    — XOR-поток на основе CSPRNG-seed
//    3. blockShuffle(K_shuf, xored) — Fisher-Yates перестановка 16-байт блоков
//    4. AES-256-GCM(K_aes)          — основное шифрование
//    5. HMAC-SHA-512(K_mac, header‖cipher) — Encrypt-then-MAC
//    6. canary bytes                — детектор обрезки/порчи
//    7. zeroize(все промежуточные буферы)
//
//  FORMAT v4:
//    magic(4) | version(1) | salt(32) | iv_aes(12) | shuf_iv(8) |
//    xor_iv(8) | pad_len(2) | hmac(64) | cipher | canary(8)
//
//  Обратная совместимость: v3 и v2 (legacy) поддерживаются при дешифровке.
// ============================================================================

// ── Утилита: безопасное обнуление буфера (zeroize) ───────────────────────────
const zeroize = (...bufs) => {
    for (const b of bufs) {
        if (b instanceof Uint8Array) b.fill(0);
        else if (b instanceof ArrayBuffer) new Uint8Array(b).fill(0);
    }
};

// ── Утилита: constant-time bytes compare (защита от timing oracle) ────────────
const constTimeEqual = (a, b) => {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
};

// ── CryptoMutations: Promise-мутации шифрования ──────────────────────────────
const CryptoMutations = (() => {
    // Случайная задержка [min, max] мс — ломает timing-атаки (CSPRNG)
    const jitter = (min = 2, max = 18) => {
        const arr = new Uint8Array(1);
        crypto.getRandomValues(arr);
        const delay = min + (arr[0] / 255) * (max - min);
        return new Promise(resolve => setTimeout(resolve, delay));
    };

    // Мутация 1: XOR-поток на основе CSPRNG-seed (ChaCha-like keystream без WASM)
    // Использует SHA-512 как PRF для генерации keystream блоков
    const xorStream = async (keyBytes, data) => {
        const out = new Uint8Array(data.length);
        const blockSize = 64; // SHA-512 output
        const blocks = Math.ceil(data.length / blockSize);
        for (let b = 0; b < blocks; b++) {
            // counter || key → SHA-512 → keystream block
            const ctr = new Uint8Array(8);
            new DataView(ctr.buffer).setUint32(4, b, false);
            const prfInput = new Uint8Array(8 + keyBytes.length);
            prfInput.set(ctr, 0);
            prfInput.set(keyBytes, 8);
            const ksBlock = new Uint8Array(await crypto.subtle.digest('SHA-512', prfInput));
            const start = b * blockSize;
            const end   = Math.min(start + blockSize, data.length);
            for (let i = start; i < end; i++) out[i] = data[i] ^ ksBlock[i - start];
        }
        return out;
    };

    // Мутация 2: Fisher-Yates block shuffle с CSPRNG-seed через SHA-256
    // Детерминированная перестановка 16-байт блоков — полностью обратима
    const blockShuffle = async (keyBytes, data, blockSize = 16) => {
        if (data.length < blockSize * 2) return new Uint8Array(data);
        // Разбиваем на блоки (последний может быть короче)
        const blocks = [];
        for (let i = 0; i < data.length; i += blockSize)
            blocks.push(new Uint8Array(data.slice(i, i + blockSize)));
        const n = blocks.length;
        // Генерируем перестановку: для каждого i нужен случайный j ∈ [0, i]
        // Используем SHA-256(key || i) как источник энтропии
        const order = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
            const prfIn = new Uint8Array(keyBytes.length + 4);
            prfIn.set(keyBytes, 0);
            new DataView(prfIn.buffer).setUint32(keyBytes.length, i, false);
            const h = new Uint8Array(await crypto.subtle.digest('SHA-256', prfIn));
            const rand = (h[0] << 24 | h[1] << 16 | h[2] << 8 | h[3]) >>> 0;
            const j = rand % (i + 1);
            [order[i], order[j]] = [order[j], order[i]];
        }
        // Применяем перестановку
        const out = new Uint8Array(data.length);
        let pos = 0;
        order.forEach(idx => { out.set(blocks[idx], pos); pos += blocks[idx].length; });
        return out;
    };

    // Обратная перестановка (для дешифровки)
    const blockUnshuffle = async (keyBytes, data, blockSize = 16) => {
        if (data.length < blockSize * 2) return new Uint8Array(data);
        const blocks = [];
        for (let i = 0; i < data.length; i += blockSize)
            blocks.push(new Uint8Array(data.slice(i, i + blockSize)));
        const n = blocks.length;
        const order = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
            const prfIn = new Uint8Array(keyBytes.length + 4);
            prfIn.set(keyBytes, 0);
            new DataView(prfIn.buffer).setUint32(keyBytes.length, i, false);
            const h = new Uint8Array(await crypto.subtle.digest('SHA-256', prfIn));
            const rand = (h[0] << 24 | h[1] << 16 | h[2] << 8 | h[3]) >>> 0;
            const j = rand % (i + 1);
            [order[i], order[j]] = [order[j], order[i]];
        }
        // Инвертируем перестановку
        const inverse = new Array(n);
        order.forEach((orig, shuffled) => { inverse[orig] = shuffled; });
        const out = new Uint8Array(data.length);
        let pos = 0;
        inverse.forEach(idx => { out.set(blocks[idx], pos); pos += blocks[idx].length; });
        return out;
    };

    // Мутация 3: HMAC-SHA-512 (сильнее SHA-256, устойчив к length-extension)
    const computeHMAC = async (keyBytes, data) => {
        const hmacKey = await crypto.subtle.importKey(
            'raw', keyBytes, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
        );
        return new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, data));
    };

    const verifyHMAC = async (keyBytes, data, tag) => {
        const hmacKey = await crypto.subtle.importKey(
            'raw', keyBytes, { name: 'HMAC', hash: 'SHA-512' }, false, ['verify']
        );
        // WebCrypto verify — constant-time внутри браузера
        return crypto.subtle.verify('HMAC', hmacKey, tag, data);
    };

    // Мутация 4: Zero-padding — скрываем реальную длину plaintext
    // Дополняем до кратного padBlock байт + 2 байта длины padding
    const zeroPad = (data, padBlock = 64) => {
        const padLen = padBlock - (data.length % padBlock);
        const out = new Uint8Array(data.length + padLen + 2);
        out.set(data, 0);
        // Последние 2 байта — длина padding (big-endian)
        new DataView(out.buffer).setUint16(data.length + padLen, padLen, false);
        return { padded: out, padLen };
    };

    const zeroUnpad = (data) => {
        if (data.length < 2) throw new Error('Invalid padded data');
        const padLen = new DataView(data.buffer, data.byteOffset).getUint16(data.length - 2, false);
        if (padLen < 1 || padLen > 64 || data.length < padLen + 2) throw new Error('Invalid padding');
        return data.slice(0, data.length - padLen - 2);
    };

    // Мутация 5: Canary bytes — 8 случайных байт в конце, проверяем при дешифровке
    const appendCanary = (data, canary) => {
        const out = new Uint8Array(data.length + 8);
        out.set(data, 0);
        out.set(canary, data.length);
        return out;
    };

    const verifyCanary = (data, expectedCanary) => {
        const actual = data.slice(data.length - 8);
        if (!constTimeEqual(actual, expectedCanary))
            throw new Error('Canary mismatch — data truncated or corrupted');
        return data.slice(0, data.length - 8);
    };

    return { jitter, xorStream, blockShuffle, blockUnshuffle, computeHMAC, verifyHMAC, zeroPad, zeroUnpad, appendCanary, verifyCanary };
})();

class AdvancedEncryption {
    constructor() {
        this.failedAttempts  = {};
        this.lockoutDuration = 15 * 60 * 1000;
        this.FORMAT_VERSION  = 5;
        // Magic bytes: 'NV5\x00' — v5 format (clean AES-256-GCM + HMAC-SHA-512)
        this.MAGIC = new Uint8Array([0x4E, 0x56, 0x35, 0x00]);
        // v4 magic for legacy detection
        this.MAGIC_V4 = new Uint8Array([0x4E, 0x56, 0x34, 0x00]);
    }

    generateRandomBytes(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }

    arrayBufferToBase64(buf) {
        const bytes = new Uint8Array(buf); let b = '';
        for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
        return btoa(b);
    }

    base64ToArrayBuffer(b64) {
        const b = atob(b64), bytes = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
        return bytes.buffer;
    }

    // ── Привязка к домену ─────────────────────────────────────────────────────
    // Единственный разрешённый origin. Файлы .note зашифрованы с этим значением
    // в HKDF info — расшифровать можно ТОЛЬКО здесь.
    static get ALLOWED_ORIGIN() {
        return 'https://localnotes-three.vercel.app';
    }

    // Проверяем origin и возвращаем его байты для вшивания в KDF.
    // На любом другом домене — бросаем ошибку ДО начала шифрования/дешифровки.
    _getOriginBinding() {
        const current = window.location.origin;
        const allowed = AdvancedEncryption.ALLOWED_ORIGIN;
        if (current !== allowed) {
            // Используем переводимый ключ если t() доступен
            const msg = (typeof window.t === 'function')
                ? (window.t('decryptOriginError', { allowed, current }) ||
                   `Decryption is only allowed on ${allowed}`)
                : `Decryption is only allowed on ${allowed}`;
            const err = new Error(msg);
            err.code = 'ORIGIN_MISMATCH';
            throw err;
        }
        return new TextEncoder().encode(`origin-binding::${allowed}::localnotes-v4`);
    }

    // ── KDF через Web Worker — не блокирует UI ───────────────────────────────
    // Тяжёлый PBKDF2 (600k итераций) выполняется в отдельном потоке.
    // Кеш: повторный ввод того же пароля не пересчитывает KDF (живёт 5 мин).
    _getWorker() {
        if (!this._worker) {
            try { this._worker = new Worker('/js/crypto-worker.js'); }
            catch { this._worker = null; }
        }
        return this._worker;
    }

    async _kdfCacheKey(password, salt) {
        const saltHex = Array.from(salt.slice(0, 8)).map(b => b.toString(16).padStart(2,'0')).join('');
        const pwBytes = new TextEncoder().encode(password + '::' + saltHex);
        const hashBuf = await crypto.subtle.digest('SHA-256', pwBytes);
        return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
    }

    async _deriveRawBits(password, salt, originInfo) {
        const cacheKey = await this._kdfCacheKey(password, salt);
        const cached = this._kdfCache?.get(cacheKey);
        if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.bits;

        const worker = this._getWorker();
        let bits;

        if (worker) {
            bits = await new Promise((resolve, reject) => {
                const idArr = new Uint8Array(9); crypto.getRandomValues(idArr);
                const id = Array.from(idArr).map(b => b.toString(36)).join('');
                const handler = ({ data }) => {
                    if (data.id !== id) return;
                    worker.removeEventListener('message', handler);
                    if (data.error) reject(new Error(data.error));
                    else resolve(data);
                };
                worker.addEventListener('message', handler);
                worker.postMessage({ id, password, salt: Array.from(salt), originInfo: Array.from(originInfo) });
            });
        } else {
            // Fallback: main thread
            const pwBytes = new TextEncoder().encode(password);
            const baseKey = await crypto.subtle.importKey('raw', pwBytes, 'PBKDF2', false, ['deriveBits']);
            const baseBits = await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-512' }, baseKey, 512
            );
            const hkdfKey = await crypto.subtle.importKey('raw', baseBits, 'HKDF', false, ['deriveBits']);
            const derive = (label, b = 256) => crypto.subtle.deriveBits(
                { name: 'HKDF', hash: 'SHA-512', salt: new TextEncoder().encode(label), info: originInfo },
                hkdfKey, b
            );
            const [encBits, macBits, shufBits, xorBits, ccBits] = await Promise.all([
                derive('k-aes-gcm'), derive('k-hmac-512', 512),
                derive('k-block-shuf'), derive('k-xor-stream'), derive('k-cc20-poly'),
            ]);
            zeroize(baseBits);
            bits = { encBits, macBits, shufBits, xorBits, ccBits };
        }

        if (!this._kdfCache) this._kdfCache = new Map();
        this._kdfCache.set(cacheKey, { bits, ts: Date.now() });
        if (this._kdfCache.size > 3) {
            const oldest = [...this._kdfCache.entries()].sort((a,b) => a[1].ts - b[1].ts)[0][0];
            this._kdfCache.delete(oldest);
        }
        return bits;
    }

    // ── KDF PIPELINE: PBKDF2-SHA-512 → HKDF-SHA-512 → 5 независимых ключей ──
    // info = origin-binding — ключи криптографически привязаны к домену
    async deriveKeys(password, salt) {
        const originInfo = this._getOriginBinding();
        const { encBits, macBits, shufBits, xorBits, ccBits } =
            await this._deriveRawBits(password, salt, originInfo);

        const encKey = await crypto.subtle.importKey(
            'raw', new Uint8Array(encBits), 'AES-GCM', false, ['encrypt', 'decrypt']
        );
        return {
            encKey,
            macKey:  new Uint8Array(macBits),
            shufKey: new Uint8Array(shufBits),
            xorKey:  new Uint8Array(xorBits),
            ccKey:   new Uint8Array(ccBits),
        };
    }

    // Обратная совместимость v3
    async _deriveKeysV3(password, salt) {
        const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const baseBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, baseKey, 512);
        const hkdfKey = await crypto.subtle.importKey('raw', baseBits, 'HKDF', false, ['deriveBits']);
        const [encBits, macBits] = await Promise.all([
            crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('enc-key-v3'), info: new Uint8Array(0) }, hkdfKey, 256),
            crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('mac-key-v3'), info: new Uint8Array(0) }, hkdfKey, 256),
        ]);
        const encKey = await crypto.subtle.importKey('raw', encBits, 'AES-GCM', false, ['encrypt', 'decrypt']);
        return { encKey, macKey: new Uint8Array(macBits) };
    }

    // Обратная совместимость v2 (legacy)
    async _legacyDeriveKey(password, salt) {
        const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, 256);
        return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
    }

    // KDF напрямую в main thread — для fallback без Worker
    async _deriveKeysDirect(password, salt, originInfo) {
        const pwBytes = new TextEncoder().encode(password);
        const baseKey = await crypto.subtle.importKey('raw', pwBytes, 'PBKDF2', false, ['deriveBits']);
        const baseBits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-512' }, baseKey, 512
        );
        const hkdfKey = await crypto.subtle.importKey('raw', baseBits, 'HKDF', false, ['deriveBits']);
        const derive = (label, bits = 256) => crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-512', salt: new TextEncoder().encode(label), info: originInfo },
            hkdfKey, bits
        );
        const [encBits, macBits] = await Promise.all([
            derive('k-aes-gcm'), derive('k-hmac-512', 512),
        ]);
        const encKey = await crypto.subtle.importKey('raw', encBits, 'AES-GCM', false, ['encrypt', 'decrypt']);
        zeroize(baseBits);
        return { encKey, macKey: new Uint8Array(macBits) };
    }

    // ── Вызов Worker с таймаутом ─────────────────────────────────────────────
    _callWorker(msg, transferable = []) {
        return new Promise((resolve, reject) => {
            const worker = this._getWorker();
            if (!worker) { reject(new Error('Worker unavailable')); return; }
            const idArr = new Uint8Array(9); crypto.getRandomValues(idArr);
            const id = Array.from(idArr).map(b => b.toString(36)).join('');
            const timer = setTimeout(() => {
                worker.removeEventListener('message', handler);
                reject(new Error('Worker timeout'));
            }, 60000);
            const handler = ({ data }) => {
                if (data.id !== id) return;
                worker.removeEventListener('message', handler);
                clearTimeout(timer);
                if (data.error) reject(new Error(data.error));
                else resolve(data);
            };
            worker.addEventListener('message', handler);
            worker.postMessage({ ...msg, id }, transferable);
        });
    }

    // ── ENCRYPT v5 — Worker ──────────────────────────────────────────────────
    async encrypt(text, password) {
        const originInfo = this._getOriginBinding();
        try {
            const { result } = await this._callWorker({
                op: 'encrypt', text, password,
                originInfo: Array.from(originInfo),
            });
            return result;
        } catch {
            return this._encryptMainThread(text, password, originInfo);
        }
    }

    // ── DECRYPT — Worker с fallback ──────────────────────────────────────────
    async decrypt(encData, password) {
        const originInfo = this._getOriginBinding();
        let workerErr = null;
        try {
            const { result } = await this._callWorker({
                op: 'decrypt', encData, password,
                originInfo: Array.from(originInfo),
            });
            return result;
        } catch (e) {
            workerErr = e;
        }
        try {
            return await this._decryptMainThread(encData, password, originInfo);
        } catch (mainErr) {
            throw mainErr;
        }
    }

    // ── Fallback: main thread encrypt (v5) ───────────────────────────────────
    async _encryptMainThread(text, password, originInfo) {
        const salt = this.generateRandomBytes(32);
        const iv   = this.generateRandomBytes(12);
        const keys = await this._deriveKeysDirect(password, salt, originInfo);
        const plain = new TextEncoder().encode(text);
        const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keys.encKey, plain);
        const cipher = new Uint8Array(cipherBuf);
        const header = new Uint8Array(49);
        header.set(this.MAGIC, 0); header[4] = this.FORMAT_VERSION;
        header.set(salt, 5); header.set(iv, 37);
        const macInput = new Uint8Array(49 + cipher.length);
        macInput.set(header, 0); macInput.set(cipher, 49);
        const macKey = await crypto.subtle.importKey('raw', keys.macKey, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
        const hmacTag = new Uint8Array(await crypto.subtle.sign('HMAC', macKey, macInput));
        const out = new Uint8Array(49 + 64 + cipher.length);
        out.set(header, 0); out.set(hmacTag, 49); out.set(cipher, 113);
        zeroize(cipher, keys.macKey);
        return this.arrayBufferToBase64(out.buffer);
    }

    // ── Fallback: main thread decrypt ────────────────────────────────────────
    async _decryptMainThread(encData, password, originInfo) {
        const combined = new Uint8Array(this.base64ToArrayBuffer(encData));

        // v5
        const isV5 = combined.length > 4 &&
            combined[0] === this.MAGIC[0] && combined[1] === this.MAGIC[1] &&
            combined[2] === this.MAGIC[2] && combined[3] === this.MAGIC[3] &&
            combined[4] === this.FORMAT_VERSION;
        if (isV5) {
            const salt = combined.slice(5, 37), iv = combined.slice(37, 49);
            const hmacTag = combined.slice(49, 113), cipher = combined.slice(113);
            const keys = await this._deriveKeysDirect(password, salt, originInfo);
            const macKey = await crypto.subtle.importKey('raw', keys.macKey, { name: 'HMAC', hash: 'SHA-512' }, false, ['verify']);
            const macInput = new Uint8Array(49 + cipher.length);
            macInput.set(combined.slice(0, 49), 0); macInput.set(cipher, 49);
            const valid = await crypto.subtle.verify('HMAC', macKey, hmacTag, macInput);
            if (!valid) throw new Error('Integrity check failed — wrong password or tampered data');
            const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keys.encKey, cipher);
            zeroize(keys.macKey);
            return new TextDecoder().decode(dec);
        }

        // v4 legacy (broken xorStream — decrypt AES only, strip padding if valid)
        const isV4 = combined.length > 4 &&
            combined[0] === this.MAGIC_V4[0] && combined[1] === this.MAGIC_V4[1] &&
            combined[2] === this.MAGIC_V4[2] && combined[3] === this.MAGIC_V4[3] &&
            combined[4] === 4;
        if (isV4) {
            const salt = combined.slice(5, 37), iv = combined.slice(37, 49);
            const hmacTag = combined.slice(51, 115);
            const withCanary = combined.slice(115);
            const cipher = withCanary.length >= 8 ? withCanary.slice(0, withCanary.length - 8) : withCanary;
            const keys = await this._deriveKeysDirect(password, salt, originInfo);
            const macKey = await crypto.subtle.importKey('raw', keys.macKey, { name: 'HMAC', hash: 'SHA-512' }, false, ['verify']);
            const macInput = new Uint8Array(51 + cipher.length);
            macInput.set(combined.slice(0, 51), 0); macInput.set(cipher, 51);
            const valid = await crypto.subtle.verify('HMAC', macKey, hmacTag, macInput);
            if (!valid) throw new Error('Integrity check failed — wrong password or tampered data');
            const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keys.encKey, cipher);
            const decBytes = new Uint8Array(decBuf);
            zeroize(keys.macKey);
            if (decBytes.length >= 2) {
                const padLen = (decBytes[decBytes.length - 2] << 8) | decBytes[decBytes.length - 1];
                if (padLen >= 1 && padLen <= 64 && decBytes.length >= padLen + 2)
                    return new TextDecoder().decode(decBytes.slice(0, decBytes.length - padLen - 2));
            }
            return new TextDecoder().decode(decBytes);
        }

        // v3
        if (combined[0] === 3) {
            const salt = combined.slice(1,17), iv = combined.slice(17,29), pepper = combined.slice(29,33);
            const hmacTag = combined.slice(33,65), cipher = combined.slice(65);
            const { encKey, macKey: macRaw } = await this._deriveKeysV3(password, salt);
            const macKey256 = await crypto.subtle.importKey('raw', macRaw, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
            const aad = new Uint8Array(33 + cipher.length);
            aad.set(combined.slice(0,33), 0); aad.set(cipher, 33);
            const valid = await crypto.subtle.verify('HMAC', macKey256, hmacTag, aad);
            if (!valid) throw new Error('Integrity check failed');
            const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encKey, cipher);
            const decBytes = new Uint8Array(decBuf);
            const pepperSeed = (pepper[0]<<24|pepper[1]<<16|pepper[2]<<8|pepper[3])>>>0;
            const out = new Uint8Array(decBytes.length);
            let s = pepperSeed;
            for (let i = 0; i < decBytes.length; i++) {
                s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
                out[i] = decBytes[i] ^ (s & 0xff);
            }
            return new TextDecoder().decode(out);
        }

        // v2 legacy
        const legacyKey = await this._legacyDeriveKey(password, combined.slice(0,16));
        return new TextDecoder().decode(
            await crypto.subtle.decrypt({ name:'AES-GCM', iv: combined.slice(16,28) }, legacyKey, combined.slice(28))
        );
    }

    isLocked(id) {
        const li = this.failedAttempts[id]; if (!li) return false;
        if (Date.now() - li.timestamp > this.lockoutDuration) { delete this.failedAttempts[id]; return false; }
        return li.attempts >= 5;
    }
    recordFailedAttempt(id) {
        if (!this.failedAttempts[id]) this.failedAttempts[id] = { attempts: 0, timestamp: Date.now() };
        this.failedAttempts[id].attempts++;
    }
    resetAttempts(id) { delete this.failedAttempts[id]; }
}
const encryption = new AdvancedEncryption();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function transliterate(text) {
    const m = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
    return text.toLowerCase().split('').map(c => m[c] || c).join('');
}

function isEncryptedFile(content) {
    return content && (content.startsWith('{"encrypted":') || content.includes('"format":"encrypted"') || /^[A-Za-z0-9+/]{100,}={0,2}$/.test(content.trim()));
}

function validateAndFixImages(content) {
    if (!content) return content;
    try {
        const safe = DOMPurify.sanitize(content, {
            ADD_TAGS: ['iframe', 'video', 'source'],
            ADD_ATTR: ['allowfullscreen', 'frameborder', 'scrolling', 'allow', 'src', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop']
        });
        const d = document.createElement('div'); d.innerHTML = safe;
        d.querySelectorAll('img').forEach(img => {
            if (!img.src) { img.remove(); return; }
            if (img.src.startsWith('blob:')) img.remove();
        });
        // Восстановить src у iframe из data-src (браузер теряет src при innerHTML)
        d.querySelectorAll('iframe[data-src]').forEach(f => {
            f.setAttribute('src', f.getAttribute('data-src'));
        });
        return d.innerHTML;
    } catch (e) { return content; }
}

function fixChecklistStructure(content) {
    if (!content) return content;
    const safe = DOMPurify.sanitize(content, {
        ADD_TAGS: ['iframe', 'video', 'source'],
        ADD_ATTR: ['allowfullscreen', 'frameborder', 'scrolling', 'allow', 'src', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop']
    });
    const d = document.createElement('div'); d.innerHTML = safe;
    d.querySelectorAll('.checklist-item-wrapper').forEach(wrapper => {
        let cb = wrapper.querySelector('.checklist-checkbox-ios');
        let span = wrapper.querySelector('.checklist-text-content');
        let text = '';
        wrapper.childNodes.forEach(node => {
            if (node.nodeType === 3) text += node.textContent;
            else if (node !== cb && node !== span && !node.classList?.contains('checklist-checkbox-ios') && !node.classList?.contains('checklist-text-content'))
                text += node.textContent;
        });
        if (!cb) { cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'checklist-checkbox-ios'; cb.setAttribute('data-checked', 'false'); }
        if (!span) { span = document.createElement('span'); span.className = 'checklist-text-content checklist-text-ios'; }
        if (text.trim() && !span.textContent) span.textContent = text.trim();
        wrapper.innerHTML = ''; wrapper.appendChild(cb); wrapper.appendChild(span);
    });
    return d.innerHTML;
}

function isClCheckboxChecked(cb) {
    const dc = cb.getAttribute('data-checked');
    if (dc === 'true') return true;
    if (dc === 'false') return false;
    return cb.checked;
}

function getChecklistProgress(content) {
    if (!content) return null;
    const safe = DOMPurify.sanitize(content);
    const d = document.createElement('div'); d.innerHTML = safe;
    // New .cl-item structure
    const newItems = d.querySelectorAll('.cl-item .cl-cb');
    if (newItems.length > 0) {
        const checked = [...newItems].filter(isClCheckboxChecked).length;
        return { total: newItems.length, checked };
    }
    // Legacy .checklist-item-wrapper
    const all = d.querySelectorAll('.checklist-checkbox-ios, input[type="checkbox"]:not([data-md-checkbox])');
    if (all.length === 0) return null;
    const checked = [...all].filter(isClCheckboxChecked).length;
    return { total: all.length, checked };
}

function blobToBase64(blob) {
    return new Promise(resolve => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.readAsDataURL(blob); });
}

async function processMediaContent(content) {
    if (!content) return content;
    const safe = DOMPurify.sanitize(content, {
        ADD_TAGS: ['iframe', 'video', 'source'],
        ADD_ATTR: ['allowfullscreen', 'frameborder', 'scrolling', 'allow', 'src', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop']
    });
    const d = document.createElement('div'); d.innerHTML = safe;
    const imgs = d.querySelectorAll('img[src^="blob:"]');
    for (const img of imgs) {
        try { const resp = await fetch(img.src); const blob = await resp.blob(); img.src = await blobToBase64(blob); }
        catch (e) { img.remove(); }
    }
    return d.innerHTML;
}

// Strip inline styles added by hljs from code blocks inside lne-code-wrapper
// so our CSS dark theme always wins
function fixCodeBlockStyles(container) {
    const root = container || document;
    root.querySelectorAll('.lne-code-wrapper pre, .lne-code-wrapper .lne-code').forEach(pre => {
        // Remove inline background/color set by hljs
        pre.style.removeProperty('background');
        pre.style.removeProperty('background-color');
        pre.style.removeProperty('color');
        pre.style.removeProperty('border');
        pre.style.removeProperty('box-shadow');
        pre.style.removeProperty('padding');
        pre.style.removeProperty('border-radius');
        pre.style.removeProperty('font-size');
        pre.style.removeProperty('line-height');
        pre.style.removeProperty('overflow-x');
        pre.style.removeProperty('margin');
    });
}

// Add copy buttons to code blocks in note cards
function initCodeBlockCopyButtons(container) {
    if (!container) return;

    const makeLabel = (icon, key, fallback) =>
        `<i class="bi bi-${icon}"></i> ` + (typeof t === 'function' ? t(key) || fallback : fallback);

    const attachCopyBtn = (pre, header) => {
        // Remove stale button (saved HTML has button but no live event listener)
        const existing = header.querySelector('.lne-copy-btn');
        if (existing) existing.remove();

        const codeEl = pre.querySelector('code');
        const copyBtn = document.createElement('button');
        copyBtn.className = 'lne-copy-btn';
        copyBtn.setAttribute('data-copy-state', 'idle');
        copyBtn.innerHTML = makeLabel('clipboard', 'copy', 'Copy');

        copyBtn.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            if (copyBtn.getAttribute('data-copy-state') === 'copied') return;

            const text = ((codeEl || pre).textContent || '').replace(/\n$/, '');
            const labelCopy = makeLabel('clipboard', 'copy', 'Copy');
            const labelDone = makeLabel('check-lg', 'copied', 'Copied!');

            const showCopied = () => {
                copyBtn.setAttribute('data-copy-state', 'copied');
                copyBtn.innerHTML = labelDone;
                copyBtn.classList.add('copied');
                clearTimeout(copyBtn._t);
                copyBtn._t = setTimeout(() => {
                    copyBtn.innerHTML = labelCopy;
                    copyBtn.classList.remove('copied');
                    copyBtn.setAttribute('data-copy-state', 'idle');
                }, 2000);
            };

            const fallback = () => {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
                    document.body.appendChild(ta);
                    ta.focus(); ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                } catch (ex) { /* silent */ }
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(showCopied).catch(() => { fallback(); showCopied(); });
            } else {
                fallback();
                showCopied();
            }
        });

        header.appendChild(copyBtn);
    };

    // Case 1: already-wrapped blocks (from editor) — just add button to existing header
    container.querySelectorAll('.lne-code-wrapper').forEach(wrapper => {
        if (wrapper.closest('.lne-editor') || wrapper.closest('.lne-modal-ov')) return;
        const pre = wrapper.querySelector('pre, .lne-code');
        const header = wrapper.querySelector('.lne-code-header');
        if (pre && header) attachCopyBtn(pre, header);
    });

    // Case 2: bare pre/.lne-code not yet wrapped — wrap them
    container.querySelectorAll('pre, .lne-code').forEach(pre => {
        if (pre.closest('.lne-code-wrapper')) return; // already handled above
        if (pre.closest('.lne-editor') || pre.closest('.lne-modal-ov')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'lne-code-wrapper';

        const header = document.createElement('div');
        header.className = 'lne-code-header';

        const langSpan = document.createElement('span');
        const codeEl = pre.querySelector('code');
        const langClass = codeEl && [...codeEl.classList].find(c => c.startsWith('language-'));
        langSpan.textContent = langClass ? langClass.replace('language-', '') : 'code';
        header.appendChild(langSpan);

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);

        attachCopyBtn(pre, header);
    });
}

function processTablesForResponsiveness(container) {
    container.querySelectorAll('table').forEach(table => {
        if (!table.parentElement.classList.contains('table-responsive')) {
            const w = document.createElement('div'); w.className = 'table-responsive';
            table.parentNode.insertBefore(w, table); w.appendChild(table);
        }
    });
}

function generateFileVersion() { return Date.now().toString(36); }

function downloadFile(blob, filename, mimeType) {
    if (!(blob instanceof Blob)) blob = new Blob([blob], { type: mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function isValidImageUrl(url) {
    try {
        const u = new URL(url);
        if (!['http:','https:'].includes(u.protocol)) return false;
        return ['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp'].some(e => u.pathname.toLowerCase().endsWith(e)) || url.includes('data:image/');
    } catch { return false; }
}

function isValidBase64Image(b64) {
    if (!b64?.startsWith('data:image/')) return false;
    try {
        const part = b64.split(',')[1];
        if (!part || part.length < 100 || part.length > 10000000) return false;
        return /^[A-Za-z0-9+/]*={0,2}$/.test(part);
    } catch { return false; }
}

function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const k = 1024, sizes = ['Bytes','KB','MB','GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
    });
}


// ============================================================================
// MODAL SYSTEM (from backup, adapted for LocalNotesEditor)
// ============================================================================
function showCustomAlert(title, message, type = 'info') {
    const iconMap = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    const colorMap = { info: '#007bff', success: '#28a745', warning: '#ffc107', error: '#dc3545' };
    const alertModal = document.createElement('div');
    alertModal.className = 'modal';
    alertModal.id = 'customAlertModal';
    alertModal.innerHTML = `
        <div class="modal-content-error">
            <h3 style="display:flex;align-items:center;gap:10px;color:${colorMap[type]};">
                <span style="font-size:24px;">${iconMap[type]}</span><span id="_caa_title"></span>
            </h3>
            <p style="margin:15px 0;line-height:1.5;" id="_caa_msg"></p>
            <div style="display:flex;justify-content:center;margin-top:20px;">
                <button id="customAlertOk" style="background:${colorMap[type]};color:white;border:none;padding:10px 30px;border-radius:5px;cursor:pointer;font-size:16px;">OK</button>
            </div>
        </div>`;
    document.body.appendChild(alertModal);
    alertModal.querySelector('#_caa_title').textContent = title;
    alertModal.querySelector('#_caa_msg').textContent = message;
    alertModal.style.display = 'block';
    const ok = alertModal.querySelector('#customAlertOk');
    const close = () => { if (alertModal.parentNode) document.body.removeChild(alertModal); };
    ok.addEventListener('click', close);
    document.addEventListener('keydown', function kh(e) { if (e.key === 'Enter' || e.key === 'Escape') { document.removeEventListener('keydown', kh); close(); } });
    alertModal.addEventListener('pointerdown', e => { if (e.target === alertModal) close(); });
    alertModal.addEventListener('click', e => { if (e.target === alertModal) close(); });
}

function showCustomPrompt(title, message, defaultValue = '', onConfirm = null) {
    const promptModal = document.createElement('div');
    promptModal.className = 'modal';
    promptModal.id = 'customPromptModal';
    promptModal.innerHTML = `
        <div class="modal-content-error">
            <h3 style="display:flex;align-items:center;gap:10px;color:#007bff;">
                <span style="font-size:24px;">✏️</span><span id="_csp_title"></span>
            </h3>
            <p style="margin:15px 0;line-height:1.5;" id="_csp_msg"></p>
            <input id="customPromptInput" type="text" value=""
                style="width:100%;box-sizing:border-box;padding:8px 12px;font-size:15px;border:1px solid #ccc;border-radius:5px;margin-bottom:15px;">
            <div style="display:flex;justify-content:center;gap:10px;margin-top:5px;">
                <button id="customPromptCancel" style="background:#6c757d;color:white;border:none;padding:10px 24px;border-radius:5px;cursor:pointer;font-size:15px;">
                    ${window.t ? window.t('cancel') : 'Cancel'}
                </button>
                <button id="customPromptOk" style="background:#007bff;color:white;border:none;padding:10px 24px;border-radius:5px;cursor:pointer;font-size:15px;">OK</button>
            </div>
        </div>`;
    document.body.appendChild(promptModal);
    promptModal.querySelector('#_csp_title').textContent = title;
    promptModal.querySelector('#_csp_msg').textContent = message;
    promptModal.querySelector('#customPromptInput').value = defaultValue;
    promptModal.style.display = 'block';
    const input = promptModal.querySelector('#customPromptInput');
    const okBtn = promptModal.querySelector('#customPromptOk');
    const cancelBtn = promptModal.querySelector('#customPromptCancel');
    input.focus();
    input.select();
    const close = (value) => {
        if (promptModal.parentNode) document.body.removeChild(promptModal);
        document.removeEventListener('keydown', kh);
        if (typeof onConfirm === 'function') onConfirm(value);
    };
    okBtn.addEventListener('click', () => close(input.value));
    cancelBtn.addEventListener('click', () => close(null));
    function kh(e) {
        if (e.key === 'Enter') { close(input.value); }
        else if (e.key === 'Escape') { close(null); }
    }
    document.addEventListener('keydown', kh);
    promptModal.addEventListener('pointerdown', e => { if (e.target === promptModal) close(null); });
    promptModal.addEventListener('click', e => { if (e.target === promptModal) close(null); });
}

function showEncryptModal(onSubmit) {
    const ov = document.createElement('div');
    ov.className = 'dcm-overlay';
    ov.innerHTML = `
        <div class="dcm-panel">
            <div class="dcm-header">
                <div class="dcm-icon"><i class="bi bi-lock-fill"></i></div>
                <div class="dcm-info">
                    <div class="dcm-title">${window.t ? window.t('encryptNote') : 'Encrypt Note'}</div>
                    <div class="dcm-file">${window.t ? window.t('enterPasswordForFile') : 'Enter password for file'}</div>
                </div>
            </div>
            <div class="dcm-body">
                <div class="dcm-field">
                    <label class="dcm-label">${window.t ? window.t('password') : 'Password'}</label>
                    <div class="dcm-input-wrap">
                        <input type="password" id="ecm-pw" class="dcm-input"
                            placeholder="${window.t ? window.t('dcmEnterPasswordPlaceholder') : 'Enter password...'}"
                            autocomplete="new-password">
                        <button type="button" class="dcm-toggle-pw" id="ecm-toggle-pw" title="Show/hide password">
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                </div>
                <div class="dcm-field" style="margin-top:10px">
                    <label class="dcm-label">${window.t ? window.t('confirmPassword') : 'Confirm password'}</label>
                    <div class="dcm-input-wrap">
                        <input type="password" id="ecm-pw2" class="dcm-input"
                            placeholder="${window.t ? window.t('dcmEnterPasswordPlaceholder') : 'Enter password...'}"
                            autocomplete="new-password">
                    </div>
                </div>
                <div class="dcm-status" id="ecm-status"></div>
            </div>
            <div class="dcm-footer">
                <button class="dcm-btn dcm-skip" id="ecm-cancel"><i class="bi bi-x-lg"></i> ${window.t ? window.t('cancel') : 'Cancel'}</button>
                <button class="dcm-btn dcm-primary" id="ecm-ok" disabled><i class="bi bi-lock"></i> ${window.t ? window.t('encryptNote') : 'Encrypt'}</button>
            </div>
        </div>`;
    document.body.appendChild(ov);

    const pw1     = ov.querySelector('#ecm-pw');
    const pw2     = ov.querySelector('#ecm-pw2');
    const status  = ov.querySelector('#ecm-status');
    const okBtn   = ov.querySelector('#ecm-ok');
    const cancelBtn = ov.querySelector('#ecm-cancel');
    const toggleBtn = ov.querySelector('#ecm-toggle-pw');

    pw1.focus();

    toggleBtn.addEventListener('click', () => {
        const hide = pw1.type === 'password';
        pw1.type = pw2.type = hide ? 'text' : 'password';
        toggleBtn.innerHTML = hide ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });

    const validate = () => {
        const v1 = pw1.value, v2 = pw2.value;
        if (!v1) { status.innerHTML = ''; okBtn.disabled = true; return; }
        if (v1.length < 4) {
            status.innerHTML = `<span class="dcm-invalid"><i class="bi bi-exclamation-circle"></i> ${window.t ? window.t('passwordTooShort') || 'Password too short' : 'Password too short'}</span>`;
            okBtn.disabled = true; return;
        }
        if (v2 && v1 !== v2) {
            status.innerHTML = `<span class="dcm-invalid"><i class="bi bi-x-circle-fill"></i> ${window.t ? window.t('passwordMismatch') || 'Passwords do not match' : 'Passwords do not match'}</span>`;
            okBtn.disabled = true; return;
        }
        if (v2 && v1 === v2) {
            status.innerHTML = `<span class="dcm-valid"><i class="bi bi-check-circle-fill"></i> ${window.t ? window.t('passwordMatch') || 'Passwords match' : 'Passwords match'}</span>`;
            okBtn.disabled = false; okBtn.classList.add('dcm-ready'); return;
        }
        status.innerHTML = ''; okBtn.disabled = true;
    };

    pw1.addEventListener('input', validate);
    pw2.addEventListener('input', validate);

    const close = () => { if (ov.parentNode) document.body.removeChild(ov); };

    okBtn.addEventListener('click', () => {
        const pw = pw1.value.trim();
        if (!pw) return;
        close();
        onSubmit(pw);
    });

    cancelBtn.addEventListener('click', () => { close(); onSubmit(null); });
    ov.addEventListener('pointerdown', e => { if (e.target === ov) { close(); onSubmit(null); } });
    pw2.addEventListener('keydown', e => { if (e.key === 'Enter' && !okBtn.disabled) okBtn.click(); });
    pw1.addEventListener('keydown', e => { if (e.key === 'Enter') pw2.focus(); });
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(); onSubmit(null); }
    });
}

function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text || ''; return d.innerHTML; }

function secureNoteId() {
    const arr = new Uint8Array(9);
    crypto.getRandomValues(arr);
    const rand = Array.from(arr).map(b => b.toString(36)).join('').slice(0, 9);
    return 'note_' + Date.now() + '_' + rand;
}

function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) { if (confirm(message)) onConfirm?.(); return; }
    const msgEl = document.getElementById('confirmMessage'); if (msgEl) msgEl.textContent = message;
    document.getElementById('confirmYes').onclick = () => { modal.style.display = 'none'; onConfirm?.(); };
    document.getElementById('confirmNo').onclick = () => { modal.style.display = 'none'; };
    modal.style.display = 'block';
}

// ============================================================================
// CLEAR ALL (from backup)
// ============================================================================
function showClearAllConfirmationModal() {
    const modal = document.createElement('div');
    modal.className = 'modal'; modal.style.display = 'block';
    modal.innerHTML = `<div class="modal-content modal-content-warning">
        <div class="modal-content-inner">
            <h3><i class="bi bi-exclamation-triangle"></i> <span id="_sca_title"></span></h3>
            <p id="_sca_msg"></p>
            <div class="warning-details">
                <p><strong>⚠️ <span id="_sca_warn_label"></span>:</strong> <span id="_sca_warn"></span></p>
                <ul>
                    <li id="_sca_w1"></li>
                    <li id="_sca_w2"></li>
                    <li id="_sca_w3"></li>
                </ul>
            </div>
        </div>
        <div class="modal-buttons-container">
            <button id="confirmClearAllBtn" class="btn cancel"><i class="bi bi-trash3"></i> <span id="_sca_del"></span></button>
            <button id="cancelClearAllBtn" class="btn save"><i class="bi bi-x-lg"></i> <span id="_sca_cancel"></span></button>
        </div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#_sca_title').textContent   = typeof t === 'function' ? t('confirmDeleteAllTitle') : 'Delete All Notes';
    modal.querySelector('#_sca_msg').textContent     = typeof t === 'function' ? t('confirmDeleteAll') : 'Delete ALL notes?';
    modal.querySelector('#_sca_warn_label').textContent = typeof t === 'function' ? t('warning') : 'Warning';
    modal.querySelector('#_sca_warn').textContent    = typeof t === 'function' ? t('clearAllWarning') : 'This action is irreversible!';
    modal.querySelector('#_sca_w1').textContent      = typeof t === 'function' ? t('clearAllWarning1') : 'All notes will be deleted permanently';
    modal.querySelector('#_sca_w2').textContent      = typeof t === 'function' ? t('clearAllWarning2') : 'Recovery will be impossible';
    modal.querySelector('#_sca_w3').textContent      = typeof t === 'function' ? t('clearAllWarning3') : 'Make a backup before deleting';
    modal.querySelector('#_sca_del').textContent     = typeof t === 'function' ? t('deleteAll') : 'Delete All';
    modal.querySelector('#_sca_cancel').textContent  = typeof t === 'function' ? t('cancel') : 'Cancel';
    document.body.classList.add('modal-open');
    const close = () => { if (modal.parentNode) document.body.removeChild(modal); document.body.classList.remove('modal-open'); };
    document.getElementById('confirmClearAllBtn').addEventListener('click', () => { clearAllNotes(); close(); });
    document.getElementById('cancelClearAllBtn').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(); } });
}

async function clearAllNotes() {
    try {
        const notes = await notesDB.getAllNotes();
        for (const n of notes) await notesDB.deleteNote(n.id);
        await loadNotes();
        showCustomAlert(typeof t === 'function' ? t('success') : 'Success', typeof t === 'function' ? t('allNotesDeleted') : 'All notes deleted!', 'success');
    } catch (e) {
        showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('errorClearingNotes') : 'Error clearing notes!', 'error');
    }
}

// ============================================================================
// NOTE SETTINGS MODAL  (Tags / Due date / Color / Pin)
// ============================================================================

// In-memory settings while editing — persisted only on Save
window._noteMeta = { tags: [], dueDate: null, color: '', pinned: false, taskStatus: 'todo', taskPriority: '' };

// Finds notes whose content contains a wiki-link (data-note-id="...") pointing
// at the given note id. Simple substring scan over already-loaded/decrypted
// note content — no separate index to maintain or migrate.
async function findBacklinks(noteId) {
    if (!noteId || !window.notesDB || typeof window.notesDB.getAllNotes !== 'function') return [];
    try {
        const all = await window.notesDB.getAllNotes();
        const marker = 'data-note-id="' + noteId + '"';
        return all.filter(n => n.id !== noteId && typeof n.content === 'string' && n.content.indexOf(marker) !== -1);
    } catch (e) { return []; }
}

function openNoteSettings(noteId) {
    // Snapshot original state so cancel can restore it
    const _orig = window._noteMeta;
    const _snapshot = {
        tags:    (_orig.tags || []).slice(),
        dueDate: _orig.dueDate,
        color:   _orig.color,
        pinned:  _orig.pinned,
        taskStatus: _orig.taskStatus || 'todo',
        taskPriority: _orig.taskPriority || ''
    };
    const meta = window._noteMeta;

    // Build tags HTML
    const buildTagsHTML = (allTags) => {
        const noteTags = meta.tags || [];
        const pills = noteTags.map(tid => {
            const tag = allTags.find(t => t.id === tid);
            if (!tag) return '';
            const c = (typeof TAG_COLORS !== 'undefined' ? TAG_COLORS : []).find(c => c.id === tag.colorId);
            const hex = c ? c.hex : '#aefc6e';
            return `<span class="nsm-tag-pill" data-tid="${tid}" style="--tag-color:${hex}">${escapeHtml(tag.name)}<button class="nsm-tag-remove" data-tid="${tid}"><i class="bi bi-x"></i></button></span>`;
        }).join('');

        const available = allTags.filter(t => !noteTags.includes(t.id));
        const opts = available.map(t => {
            const c = (typeof TAG_COLORS !== 'undefined' ? TAG_COLORS : []).find(c => c.id === t.colorId);
            const hex = c ? c.hex : '#aefc6e';
            return `<button class="nsm-tag-add-item" data-tid="${t.id}" style="--tag-color:${hex}"><span class="nsm-dot"></span>${escapeHtml(t.name)}</button>`;
        }).join('');

        // All tags manager list
        const managerRows = allTags.map(t => {
            const c = (typeof TAG_COLORS !== 'undefined' ? TAG_COLORS : []).find(c => c.id === t.colorId);
            const hex = c ? c.hex : '#aefc6e';
            return `<div class="nsm-mgr-row" data-tid="${t.id}">
                <span class="nsm-mgr-dot" style="background:${hex}"></span>
                <span class="nsm-mgr-name">${escapeHtml(t.name)}</span>
                <button class="nsm-mgr-edit" data-tid="${t.id}" title="Edit"><i class="bi bi-pencil"></i></button>
                <button class="nsm-mgr-del" data-tid="${t.id}" title="Delete"><i class="bi bi-trash"></i></button>
            </div>`;
        }).join('');

        return `<div class="nsm-tags-row" id="nsm-tags-row">${pills}</div>
            <div class="nsm-tags-add">${opts}
                <button class="nsm-new-tag-btn" id="nsm-new-tag"><i class="bi bi-plus-circle"></i> ${window.t ? window.t('newTag') : 'New tag'}</button>
            </div>
            ${allTags.length > 0 ? `
            <div class="nsm-mgr-toggle" id="nsm-mgr-toggle">
                <i class="bi bi-sliders"></i> ${window.t ? window.t('manageTags') : 'Manage tags'}
                <i class="bi bi-chevron-down nsm-mgr-chevron"></i>
            </div>
            <div class="nsm-mgr-list" id="nsm-mgr-list" style="display:none">${managerRows}</div>
            ` : ''}`;
    };

    const dateVal = meta.dueDate ? new Date(meta.dueDate).toISOString().slice(0, 16) : '';
    const colorSwatches = ['', '#aefc6e', '#4ec9b0', '#c586c0', '#f1c40f', '#e74c3c', '#4a86e8', '#ff7eb3'].map(c =>
        `<button class="nsm-color-sw${meta.color === c ? ' active' : ''}" data-c="${c}" style="background:${c || 'transparent'}" title="${c || 'Default'}"></button>`
    ).join('');

    // Build modal
    const ov = document.createElement('div');
    ov.id = 'noteSettingsModal';
    ov.className = 'nsm-overlay';

    const render = (allTags) => {
        ov.innerHTML = `
            <div class="nsm-panel">
                <div class="nsm-drag-handle"></div>
                <div class="nsm-header">
                    <h3><i class="bi bi-sliders2"></i> ${window.t ? window.t('noteSettings') : 'Note Settings'}</h3>
                    <button class="nsm-close" id="nsm-close"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="nsm-body">
                    <section class="nsm-section">
                        <div class="nsm-section-title"><i class="bi bi-tags"></i> ${window.t ? window.t('tags') : 'Tags'}</div>
                        ${buildTagsHTML(allTags)}
                    </section>
                    <section class="nsm-section">
                        <div class="nsm-section-title"><i class="bi bi-calendar-event"></i> ${window.t ? window.t('dueDate') : 'Due date'}</div>
                        <input type="datetime-local" id="nsm-due" class="nsm-input" value="${dateVal}" readonly onfocus="this.removeAttribute('readonly')">
                        ${meta.dueDate ? `<button class="nsm-clear-date" id="nsm-clear-date"><i class="bi bi-x"></i> ${window.t ? window.t('clear') : 'Clear'}</button>` : ''}
                    </section>
                    <section class="nsm-section">
                        <div class="nsm-section-title"><i class="bi bi-palette"></i> ${window.t ? window.t('color') : 'Color'}</div>
                        <div class="nsm-colors">${colorSwatches}</div>
                    </section>
                    <section class="nsm-section nsm-pin-section">
                        <div class="nsm-section-title"><i class="bi bi-pin-angle"></i> ${window.t ? window.t('pinNote') : 'Pin note'}</div>
                        <button class="nsm-pin-btn${meta.pinned ? ' active' : ''}" id="nsm-pin">
                            <i class="bi bi-pin-angle${meta.pinned ? '-fill' : ''}"></i>
                            ${meta.pinned ? (window.t ? window.t('pinned') : 'Pinned') : (window.t ? window.t('pin') : 'Pin')}
                        </button>
                    </section>
                    <section class="nsm-section">
                        <div class="nsm-section-title"><i class="bi bi-kanban"></i> ${window.t ? window.t('taskStatus') : 'Task status'}</div>
                        <div class="nsm-task-status-row" id="nsm-task-status">
                            <button type="button" class="nsm-status-btn${(meta.taskStatus || 'todo') === 'todo' ? ' active' : ''}" data-status="todo"><i class="bi bi-circle"></i> ${window.t ? window.t('taskStatusTodo') : 'To do'}</button>
                            <button type="button" class="nsm-status-btn${meta.taskStatus === 'in_progress' ? ' active' : ''}" data-status="in_progress"><i class="bi bi-arrow-repeat"></i> ${window.t ? window.t('taskStatusInProgress') : 'In progress'}</button>
                            <button type="button" class="nsm-status-btn${meta.taskStatus === 'done' ? ' active' : ''}" data-status="done"><i class="bi bi-check-circle"></i> ${window.t ? window.t('taskStatusDone') : 'Done'}</button>
                        </div>
                    </section>
                    <section class="nsm-section">
                        <div class="nsm-section-title"><i class="bi bi-flag"></i> ${window.t ? window.t('taskPriority') : 'Priority'}</div>
                        <div class="nsm-priority-row" id="nsm-priority">
                            <button type="button" class="nsm-pri-btn${!meta.taskPriority ? ' active' : ''}" data-pri="">${window.t ? window.t('taskPriorityNone') : 'None'}</button>
                            <button type="button" class="nsm-pri-btn${meta.taskPriority === 'low' ? ' active' : ''}" data-pri="low">${window.t ? window.t('taskPriorityLow') : 'Low'}</button>
                            <button type="button" class="nsm-pri-btn${meta.taskPriority === 'medium' ? ' active' : ''}" data-pri="medium">${window.t ? window.t('taskPriorityMid') : 'Medium'}</button>
                            <button type="button" class="nsm-pri-btn${meta.taskPriority === 'high' ? ' active' : ''}" data-pri="high">${window.t ? window.t('taskPriorityHigh') : 'High'}</button>
                        </div>
                    </section>
                    ${noteId ? `
                    <section class="nsm-section">
                        <div class="nsm-section-title"><i class="bi bi-link-45deg"></i> ${window.t ? window.t('backlinks') : 'Backlinks'}</div>
                        <div class="nsm-backlinks-list" id="nsm-backlinks-list">
                            <div class="nsm-backlinks-loading">${window.t ? window.t('backlinksLoading') : 'Searching…'}</div>
                        </div>
                    </section>` : ''}
                </div>
                <div class="nsm-footer">
                    <button class="nsm-btn nsm-btn-sec" id="nsm-cancel"><i class="bi bi-x-lg"></i> ${window.t ? window.t('cancel') : 'Cancel'}</button>
                    <button class="nsm-btn nsm-btn-pri" id="nsm-apply"><i class="bi bi-check-lg"></i> ${window.t ? window.t('apply') : 'Apply'}</button>
                </div>
            </div>`;

        // Wire close/cancel
        const closeOv = () => {
            const panel = ov.querySelector('.nsm-panel');
            if (panel) {
                panel.style.transition = 'transform 0.25s ease, opacity 0.2s ease';
                panel.style.transform = 'translateY(100%)';
                panel.style.opacity = '0';
                setTimeout(() => { if (ov.parentNode) document.body.removeChild(ov); }, 220);
            } else {
                if (ov.parentNode) document.body.removeChild(ov);
            }
        };
        const cancelOv = () => {
            // Restore original state on cancel
            window._noteMeta.tags        = _snapshot.tags;
            window._noteMeta.dueDate     = _snapshot.dueDate;
            window._noteMeta.color       = _snapshot.color;
            window._noteMeta.pinned      = _snapshot.pinned;
            window._noteMeta.taskStatus  = _snapshot.taskStatus;
            window._noteMeta.taskPriority = _snapshot.taskPriority;
            closeOv();
        };
        ov.querySelector('#nsm-close').addEventListener('click', cancelOv);
        ov.querySelector('#nsm-cancel').addEventListener('click', cancelOv);
        ov.addEventListener('click', e => { if (e.target === ov) cancelOv(); });

        // Swipe-down to close on touch devices
        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        if (isTouch) {
            const panel = ov.querySelector('.nsm-panel');
            if (panel) {
                let startY = 0, currentY = 0, dragging = false;
                const header = panel.querySelector('.nsm-header');
                const dragHandle = panel.querySelector('.nsm-drag-handle');

                const onStart = (e) => {
                    startY = e.touches[0].clientY;
                    currentY = startY;
                    dragging = true;
                    panel.style.transition = 'none';
                };
                const onMove = (e) => {
                    if (!dragging) return;
                    currentY = e.touches[0].clientY;
                    const delta = currentY - startY;
                    if (delta > 0) {
                        panel.style.transform = `translateY(${delta}px)`;
                        panel.style.opacity = String(Math.max(0, 1 - delta / 350));
                        e.preventDefault();
                    }
                };
                const onEnd = () => {
                    if (!dragging) return;
                    dragging = false;
                    const delta = currentY - startY;
                    panel.style.transition = '';
                    if (delta > 90) {
                        cancelOv();
                    } else {
                        panel.style.transform = '';
                        panel.style.opacity = '';
                    }
                };

                // Attach to header and drag handle
                [header, dragHandle].forEach(el => {
                    if (!el) return;
                    el.addEventListener('touchstart', onStart, { passive: true });
                    el.addEventListener('touchmove', onMove, { passive: false });
                    el.addEventListener('touchend', onEnd, { passive: true });
                });
                // Also allow drag from top 44px of panel
                panel.addEventListener('touchstart', (e) => {
                    const rect = panel.getBoundingClientRect();
                    if (e.touches[0].clientY - rect.top < 44) onStart(e);
                }, { passive: true });
                panel.addEventListener('touchmove', onMove, { passive: false });
                panel.addEventListener('touchend', onEnd, { passive: true });
            }
        }

        // Remove tag
        ov.querySelectorAll('.nsm-tag-remove').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                meta.tags = meta.tags.filter(t => t !== btn.dataset.tid);
                render(allTags);
            });
        });

        // Add tag
        ov.querySelectorAll('.nsm-tag-add-item').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!meta.tags.includes(btn.dataset.tid)) meta.tags.push(btn.dataset.tid);
                render(allTags);
            });
        });

        // New tag — open tag modal on top, re-render settings after creation
        ov.querySelector('#nsm-new-tag')?.addEventListener('click', () => {
            if (typeof showTagEditModal === 'function') {
                showTagEditModal(null, async () => {
                    // After tag created — refresh tags list inside settings panel
                    const freshTags = typeof getTags === 'function' ? await getTags() : [];
                    render(freshTags);
                });
            }
        });

        // Manage tags toggle
        ov.querySelector('#nsm-mgr-toggle')?.addEventListener('click', () => {
            const list = ov.querySelector('#nsm-mgr-list');
            const chevron = ov.querySelector('.nsm-mgr-chevron');
            if (!list) return;
            const open = list.style.display !== 'none';
            list.style.display = open ? 'none' : 'block';
            chevron?.classList.toggle('nsm-mgr-chevron-open', !open);
        });

        // Edit tag
        ov.querySelectorAll('.nsm-mgr-edit').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tag = allTags.find(t => t.id === btn.dataset.tid);
                if (!tag || typeof showTagEditModal !== 'function') return;
                showTagEditModal(tag, async () => {
                    const freshTags = typeof getTags === 'function' ? await getTags() : [];
                    render(freshTags);
                });
            });
        });

        // Delete tag
        ov.querySelectorAll('.nsm-mgr-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tag = allTags.find(t => t.id === btn.dataset.tid);
                if (!tag) return;
                const _t = (key, fb) => (window.t ? window.t(key) : fb);
                const msg = _t('confirmDeleteTag', 'Delete tag "' + tag.name + '"?').replace('{name}', tag.name);
                const title = _t('confirmDeleteTagTitle', 'Delete Tag');
                const deleteLabel = _t('delete', 'Delete');
                const cancelLabel = _t('cancel', 'Cancel');
                const confirmOv = document.createElement('div');
                confirmOv.className = 'lne-modal-ov';
                confirmOv.innerHTML = '<div class="lne-modal" style="max-width:360px"><div class="lne-mhd"><h3><i class="bi bi-trash"></i> <span id="_cdel_title"></span></h3><button class="lne-mclose"><i class="bi bi-x-lg"></i></button></div>' +
                    '<div class="lne-mbody"><p id="_cdel_msg"></p></div>' +
                    '<div class="lne-mft">' +
                    '<button class="lne-mbtn lne-mbtn-sec lne-mcancel"><i class="bi bi-x-lg"></i> <span id="_cdel_cancel"></span></button>' +
                    '<button class="lne-mbtn lne-mbtn-danger lne-mok"><i class="bi bi-trash"></i> <span id="_cdel_ok"></span></button>' +
                    '</div></div>';
                document.body.appendChild(confirmOv);
                confirmOv.querySelector('#_cdel_title').textContent = title;
                confirmOv.querySelector('#_cdel_msg').textContent = msg;
                confirmOv.querySelector('#_cdel_cancel').textContent = cancelLabel;
                confirmOv.querySelector('#_cdel_ok').textContent = deleteLabel;
                const closeConfirm = () => { if (confirmOv.parentNode) document.body.removeChild(confirmOv); };
                confirmOv.querySelector('.lne-mclose').addEventListener('click', closeConfirm);
                confirmOv.querySelector('.lne-mcancel').addEventListener('click', closeConfirm);
                confirmOv.addEventListener('click', e2 => { if (e2.target === confirmOv) closeConfirm(); });
                confirmOv.querySelector('.lne-mok').addEventListener('click', async () => {
                    closeConfirm();
                    if (typeof deleteTag === 'function') await deleteTag(tag.id);
                    meta.tags = (meta.tags || []).filter(t => t !== tag.id);
                    const freshTags = typeof getTags === 'function' ? await getTags() : [];
                    render(freshTags);
                    if (typeof renderTagPanel === 'function') renderTagPanel();
                });
            });
        });

        // Due date clear
        ov.querySelector('#nsm-clear-date')?.addEventListener('click', () => {
            meta.dueDate = null;
            ov.querySelector('#nsm-due').value = '';
            ov.querySelector('#nsm-clear-date')?.remove();
        });

        // Color
        ov.querySelectorAll('.nsm-color-sw').forEach(sw => {
            sw.addEventListener('click', () => {
                ov.querySelectorAll('.nsm-color-sw').forEach(s => s.classList.remove('active'));
                sw.classList.add('active');
                meta.color = sw.dataset.c;
            });
        });

        // Pin
        ov.querySelector('#nsm-pin').addEventListener('click', () => {
            meta.pinned = !meta.pinned;
            const btn = ov.querySelector('#nsm-pin');
            btn.classList.toggle('active', meta.pinned);
            btn.innerHTML = `<i class="bi bi-pin-angle${meta.pinned ? '-fill' : ''}"></i> ${meta.pinned ? (window.t ? window.t('pinned') : 'Pinned') : (window.t ? window.t('pin') : 'Pin')}`;
        });

        ov.querySelectorAll('#nsm-task-status .nsm-status-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                meta.taskStatus = btn.dataset.status || 'todo';
                ov.querySelectorAll('#nsm-task-status .nsm-status-btn').forEach(b => b.classList.toggle('active', b === btn));
            });
        });

        ov.querySelectorAll('#nsm-priority .nsm-pri-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                meta.taskPriority = btn.dataset.pri || '';
                ov.querySelectorAll('#nsm-priority .nsm-pri-btn').forEach(b => b.classList.toggle('active', b === btn));
            });
        });

        // Apply
        ov.querySelector('#nsm-apply').addEventListener('click', () => {
            const dueVal = ov.querySelector('#nsm-due').value;
            meta.dueDate = dueVal ? new Date(dueVal).getTime() : null;
            closeOv();
        });

        // Backlinks — which other notes reference this one via a wiki-link
        if (noteId) {
            const blContainer = ov.querySelector('#nsm-backlinks-list');
            if (blContainer) {
                findBacklinks(noteId).then(notes => {
                    if (!blContainer.isConnected) return; // modal closed/re-rendered before this resolved
                    if (!notes.length) {
                        blContainer.innerHTML = `<div class="nsm-backlinks-empty">${window.t ? window.t('backlinksEmpty') : 'No notes link here yet'}</div>`;
                        return;
                    }
                    blContainer.innerHTML = notes.map(n => `
                        <button type="button" class="nsm-backlink-item" data-id="${escapeHtml(n.id)}">
                            <i class="bi ${n.pinned ? 'bi-pin-angle-fill' : 'bi-file-earmark-text'}"></i>
                            <span>${escapeHtml(n.title || (window.t ? window.t('cpUntitled') : 'Untitled note'))}</span>
                        </button>
                    `).join('');
                    blContainer.querySelectorAll('.nsm-backlink-item').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const target = notes.find(n => n.id === btn.dataset.id);
                            if (!target) return;
                            cancelOv();
                            if (typeof window.openModal === 'function') window.openModal(target.id, target.content, target.creationTime);
                        });
                    });
                }).catch(() => {
                    if (blContainer.isConnected) blContainer.innerHTML = `<div class="nsm-backlinks-empty">${window.t ? window.t('backlinksEmpty') : 'No notes link here yet'}</div>`;
                });
            }
        }
    };

    document.body.appendChild(ov);
    const allTags = typeof getTags === 'function' ? getTags() : Promise.resolve([]);
    Promise.resolve(allTags).then(tags => render(tags));
}

// ============================================================================
// OPEN/CLOSE MODAL (adapted for LocalNotesEditor, no TinyMCE)
// ============================================================================
function openModal(noteId, noteContent, noteCreationTime) {
    const modal = document.getElementById('editModal');
    if (!modal) { console.error('Modal not found'); return; }

    // iOS Safari: save scroll position before locking body
    const scrollY = window.scrollY;
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    document.body.dataset.scrollY = scrollY;

    if (responsiveManager?.isTabletDevice) {
        setTimeout(() => responsiveManager.applyFullscreenModal(modal), 100);
    }

    currentNoteId = noteId || null;

    // Init meta from existing note
    if (noteId) {
        notesDB.getNote(noteId).then(note => {
            if (note) {
                window._noteMeta = {
                    tags:   note.tags   || [],
                    dueDate: note.dueDate || null,
                    color:  note.color  || '',
                    pinned: note.pinned || false,
                    taskStatus: note.taskStatus || 'todo',
                    taskPriority: note.taskPriority || ''
                };
            }
        }).catch(() => {});
    } else {
        window._noteMeta = { tags: [], dueDate: window._currentNoteDueDate || null, color: '', pinned: false, taskStatus: 'todo', taskPriority: '' };
        window._currentNoteDueDate = null;
    }

    // Wire settings button
    const settingsBtn = document.getElementById('noteSettingsBtn');
    if (settingsBtn) {
        settingsBtn.onclick = () => openNoteSettings(currentNoteId);
    }

    // Wait for LocalNotesEditor
    const waitForEditor = () => new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            attempts++;
            if (typeof localNotesEditorInstance !== 'undefined' && localNotesEditorInstance && !localNotesEditorInstance.isDestroyed) {
                resolve();
            } else if (attempts >= 50) {
                reject(new Error('Editor initialization timeout'));
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });

    waitForEditor()
        .then(() => {
            try {
                if (noteId && noteContent) {
                    let content = validateAndFixImages(noteContent);
                    content = fixChecklistStructure(content);
                    localNotesEditorInstance.setContent(content);
                    currentNoteId = noteId;
                } else {
                    localNotesEditorInstance.setContent('');
                    currentNoteId = null;
                }
                localNotesEditorInstance.focus();
                setTimeout(() => { if (typeof hljs !== 'undefined') hljs.highlightAll(); fixCodeBlockStyles(); }, 100);
            } catch (e) {
                console.error('Error setting content:', e);
            }
        })
        .catch(e => {
            console.error('Editor wait error:', e);
            showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('errorEditorTimeout') : 'Editor initialization timeout!', 'error');
        });

    const saveBtn = document.getElementById('saveNoteButton');
    if (saveBtn) saveBtn.onclick = async () => {
        let content = '';
        if (typeof window.isLNMarkdownMode === 'function' && window.isLNMarkdownMode()) {
            content = (typeof window.getLNEditorContent === 'function' ? window.getLNEditorContent() : '').trim();
        } else if (typeof localNotesEditorInstance !== 'undefined' && localNotesEditorInstance) {
            content = localNotesEditorInstance.getContent().trim();
        }
        if (!content || content === '<p></p>' || content === '<p><br></p>') {
            showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('errorEmptyNote') : 'Note cannot be empty!', 'error');
            return;
        }
        try {
            const processedContent = await processMediaContent(content);
            const timestamp = Date.now();
            const noteId2 = currentNoteId || secureNoteId();
            const meta = window._noteMeta || {};
            const note = {
                id: noteId2,
                content: processedContent,
                creationTime: noteCreationTime || timestamp,
                lastModified: timestamp,
                title: notesDB.extractTitle(processedContent),
                tags:    meta.tags    || [],
                dueDate: meta.dueDate || null,
                color:   meta.color   || '',
                pinned:  meta.pinned  || false,
                taskStatus: meta.taskStatus || 'todo',
                taskPriority: meta.taskPriority || ''
            };
            await notesDB.saveNote(note);
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            const savedY = parseInt(document.body.dataset.scrollY || '0', 10);
            window.scrollTo(0, savedY);
            delete document.body.dataset.scrollY;
            currentNoteId = null;
            if (typeof window.exitLNMarkdownMode === 'function') window.exitLNMarkdownMode();
            if (typeof localNotesEditorInstance !== 'undefined' && localNotesEditorInstance) {
                if (typeof localNotesEditorInstance._removeCtx === 'function') localNotesEditorInstance._removeCtx();
                localNotesEditorInstance.setContent('');
            }
            window._noteMeta = { tags: [], dueDate: null, color: '', pinned: false, taskStatus: 'todo', taskPriority: '' };
            await loadNotes();
        } catch (e) {
            console.error('Save error:', e);
            showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('errorSavingNote') : 'Error saving note!', 'error');
        }
    };
}

function closeModal() {
    const errorModal = document.getElementById('error');
    if (errorModal) errorModal.style.display = 'none';
    const editModal = document.getElementById('editModal');
    if (editModal) editModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    // iOS Safari: restore scroll position
    const savedY = parseInt(document.body.dataset.scrollY || '0', 10);
    window.scrollTo(0, savedY);
    delete document.body.dataset.scrollY;
    currentNoteId = null;
    if (typeof window.exitLNMarkdownMode === 'function') window.exitLNMarkdownMode();
    if (typeof localNotesEditorInstance !== 'undefined' && localNotesEditorInstance) {
        if (typeof localNotesEditorInstance._removeCtx === 'function') localNotesEditorInstance._removeCtx();
        localNotesEditorInstance.setContent('');
    }
}

// ============================================================================
// LOAD NOTES (from backup, adapted - using notesDB not notesDatabase)
// ============================================================================
// loadNotes() может вызываться параллельно из нескольких мест (инициализация
// приложения, патч workspaces-integration.js и т.д.). Без сериализации два
// одновременных вызова могут оба очистить #notesContainer, а затем оба
// дописать в него заметки — на экране появляются дубликаты при каждой
// перезагрузке страницы. Оборачиваем реализацию в очередь промисов, чтобы
// вызовы всегда выполнялись строго друг за другом.
let _loadNotesQueue = Promise.resolve();
function loadNotes() {
    _loadNotesQueue = _loadNotesQueue.then(() => _loadNotesImpl(), () => _loadNotesImpl());
    return _loadNotesQueue;
}

async function _loadNotesImpl() {
    const viewer = document.querySelector('.btn_view_div');
    const notesContainer = document.getElementById('notesContainer');
    const notesCenter = document.querySelector('.notes_center');
    if (!notesContainer) return;

    const tbToolbar = document.getElementById('taskBoardToolbar');
    if (tbToolbar) tbToolbar.remove();
    if (notesCenter) notesCenter.classList.remove('task-board-center');

    if (window.taskBoard && window.taskBoard.isActive()) {
        try {
            const allNotes = await notesDB.getAllNotes();
            const notes = typeof applyTagFilter === 'function' ? applyTagFilter(allNotes) : allNotes;
            notes.sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return b.lastModified - a.lastModified;
            });
            await window.taskBoard.render(notes);
            if (viewer) viewer.style.display = notes.length ? '' : '';
            return;
        } catch (e) {
            console.error('Task board render error:', e);
        }
    }

    notesContainer.innerHTML = '';
    notesContainer.classList.remove('task-board-view');
    
    // Восстанавливаем правильный режим отображения (сетка или список)
    const savedViewMode = localStorage.getItem('viewMode');
    if (savedViewMode === 'list') {
        notesContainer.classList.add('full-width-view');
        notesContainer.classList.remove('default-view');
    } else {
        notesContainer.classList.add('default-view');
        notesContainer.classList.remove('full-width-view');
    }
    
    // Обновляем текст кнопки переключения вида
    if (window.appUtils && typeof window.appUtils.updateToggleViewButton === 'function') {
        window.appUtils.updateToggleViewButton();
    }

    try {
        const allNotes = await notesDB.getAllNotes();
        // Apply tag filter
        const notes = typeof applyTagFilter === 'function' ? applyTagFilter(allNotes) : allNotes;
        // Sort: pinned first, then by lastModified
        notes.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.lastModified - a.lastModified;
        });
        notes.forEach(note => { if (note.content) note.content = validateAndFixImages(note.content); });

        if (notes.length === 0) {
            if (viewer) viewer.style.display = 'none';
            showWelcomeMessage();
            return;
        }

        if (viewer) viewer.style.display = '';
        const existingWelcome = document.querySelector('.welcome-message');
        if (existingWelcome) existingWelcome.remove();

        // Get all tags for rendering
        const allTags = typeof getTags === 'function' ? await getTags() : [];

        notes.forEach(note => {
            const noteEl = document.createElement('div');
            noteEl.classList.add('note');
            noteEl.dataset.noteId = note.id;
            noteEl.dataset.noteCreationTime = note.creationTime;
            // Color accent
            if (note.color) { noteEl.style.setProperty('--note-accent', note.color); noteEl.dataset.color = note.color; }
            if (note.pinned) noteEl.classList.add('pinned');

            // Footer with dates + inline pin + inline due badge
            const footer = document.createElement('div');
            footer.classList.add('note-footer');

            const actualLang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : currentLang;
            const localeMap = { ru:'ru-RU', ua:'uk-UA', pl:'pl-PL', cs:'cs-CZ', sk:'sk-SK', bg:'bg-BG', hr:'hr-HR', sr:'sr-RS', bs:'bs-BA', mk:'mk-MK', sl:'sl-SI' };
            const locale = localeMap[actualLang] || 'en-US';
            const opts = { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' };
            const creationTime = typeof formatDate === 'function' ? formatDate(note.creationTime, 'medium', actualLang) : new Date(note.creationTime).toLocaleString(locale, opts);
            const lastModified = typeof formatDate === 'function' ? formatDate(note.lastModified, 'medium', actualLang) : new Date(note.lastModified).toLocaleString(locale, opts);
            const createdText = window.langData?.[actualLang]?.created || (typeof t === 'function' ? t('created') : 'Created');
            const modifiedText = window.langData?.[actualLang]?.modified || (typeof t === 'function' ? t('modified') : 'Modified');

            // Footer content: date text
            const dateSpan = document.createElement('span');
            dateSpan.className = 'note-footer-date';
            dateSpan.textContent = `${createdText}: ${creationTime} | ${modifiedText}: ${lastModified}`;
            footer.appendChild(dateSpan);

            // Pin indicator inline in footer
            if (note.pinned) {
                const pinEl = document.createElement('span');
                pinEl.className = 'note-pin-indicator';
                pinEl.innerHTML = '<i class="bi bi-pin-angle-fill"></i>';
                footer.appendChild(pinEl);
            }

            // Due date badge inline in footer
            if (note.dueDate) {
                const due = new Date(note.dueDate);
                let cls = 'due-normal', icon = 'bi-clock';
                if (typeof isOverdue === 'function' && isOverdue(note.dueDate)) {
                    cls = 'due-overdue'; icon = 'bi-exclamation-circle';
                    noteEl.classList.add('note-overdue');
                } else if (typeof isDueToday === 'function' && isDueToday(note.dueDate)) {
                    cls = 'due-today'; icon = 'bi-alarm';
                    noteEl.classList.add('note-due-today');
                } else if (typeof isDueSoon === 'function' && isDueSoon(note.dueDate)) {
                    cls = 'due-soon'; icon = 'bi-clock-history';
                    noteEl.classList.add('note-due-soon');
                }
                const badge = document.createElement('span');
                badge.className = `note-due-badge ${cls}`;
                const lang = window.currentLang || 'en';
                const localeMap = { ru:'ru-RU', ua:'uk-UA', pl:'pl-PL', cs:'cs-CZ', sk:'sk-SK', bg:'bg-BG', hr:'hr-HR', sr:'sr-RS', bs:'bs-BA', mk:'mk-MK', sl:'sl-SI', en:'en-US' };
                const locale = localeMap[lang] || lang;
                badge.innerHTML = `<i class="bi ${icon}"></i>${due.toLocaleDateString(locale, {month:'short', day:'numeric'})}`;
                footer.appendChild(badge);
            }

            noteEl.appendChild(footer);

            // Checklist progress
            const progress = getChecklistProgress(note.content);
            if (progress) {
                const pct = Math.round(progress.checked / progress.total * 100);
                const doneLbl = escapeHtml(window.translations?.[actualLang]?.checklistDone || 'done');
                const pc = document.createElement('div');
                pc.classList.add('checklist-progress');
                pc.innerHTML = `<div class="checklist-progress-header"><span class="checklist-progress-label">☑ ${progress.checked}/${progress.total} ${doneLbl}</span><span class="checklist-progress-pct">${pct}%</span></div><div class="checklist-progress-bar-track"><div class="checklist-progress-bar-fill" style="width:${pct}%"></div></div>`;
                noteEl.appendChild(pc);
            }

            // Content
            const notePreview = document.createElement('div');
            notePreview.classList.add('noteContent');
            notePreview.innerHTML = DOMPurify.sanitize(note.content, {
                ADD_TAGS: ['iframe', 'video', 'source'],
                ADD_ATTR: ['data-checked', 'data-cl-color', 'data-cl-priority', 'data-cl-tag', 'value', 'checked', 'type', 'placeholder', 'autocomplete', 'spellcheck',
                           'allowfullscreen', 'frameborder', 'scrolling', 'allow', 'src', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop',
                           'target', 'rel']
            });

            // Ensure links open in new tab (target may be stripped by browser in contenteditable)
            notePreview.querySelectorAll('a[href]').forEach(a => {
                if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
                if (!a.getAttribute('rel')) a.setAttribute('rel', 'noopener');
            });

            // Restore input values from HTML attributes (DOMPurify preserves them but browser doesn't auto-sync)
            notePreview.querySelectorAll('.cl-item .cl-text').forEach(inp => {
                const v = inp.getAttribute('value');
                if (v !== null) inp.value = v;
            });

            // Restore color accents
            notePreview.querySelectorAll('.cl-item[data-cl-color]').forEach(item => {
                item.style.setProperty('--cl-accent', item.dataset.clColor);
            });

            // Remove any stale video touch overlays saved in note content
            notePreview.querySelectorAll('.lne-video-touch-overlay').forEach(ov => ov.remove());

            // Remove checklist options buttons from note cards (editor-only UI)
            notePreview.querySelectorAll('.cl-opts-btn').forEach(btn => btn.remove());

            // Remove contenteditable from all elements in note cards (not in editor)
            notePreview.querySelectorAll('[contenteditable]').forEach(el => {
                el.removeAttribute('contenteditable');
            });

            // Wiki-links (data-note-id chips) — clicking one in a note card
            // preview opens that note, same as clicking one inside the editor.
            // stopPropagation keeps this from also triggering quick-edit's
            // own click handling on the surrounding card in quick-edit mode.
            notePreview.querySelectorAll('.lne-wikilink').forEach(chip => {
                chip.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetId = chip.getAttribute('data-note-id');
                    if (!targetId) return;
                    notesDB.getNote(targetId).then(target => {
                        if (target && typeof window.openModal === 'function') window.openModal(target.id, target.content, target.creationTime);
                    }).catch(() => {});
                });
            });

            // Mark note card if it contains video/iframe — used for CSS height override
            if (notePreview.querySelector('iframe, video, .lne-video-wrapper, .video-embed-wrapper')) {
                noteEl.classList.add('has-video');
            }

            // Восстановить aspect-ratio на старых враперах без style (по атрибутам iframe/video)
            notePreview.querySelectorAll('.lne-video-wrapper:not([style]), .video-embed-wrapper:not([style])').forEach(wrapper => {
                const el = wrapper.querySelector('iframe, video');
                if (!el) return;
                const w = el.getAttribute('width') || el.width;
                const h = el.getAttribute('height') || el.height;
                if (w && h && parseInt(w) && parseInt(h)) {
                    wrapper.style.aspectRatio = w + '/' + h;
                    wrapper.style.maxWidth = w + 'px';
                } else {
                    wrapper.style.aspectRatio = '16/9';
                }
            });

            // Fix height of video wrappers with aspect-ratio so iframe fills correctly
            // Use ResizeObserver to recalculate when card width is known
            const fixVideoWrapperHeights = () => {
                notePreview.querySelectorAll('.lne-video-wrapper[style], .video-embed-wrapper[style]').forEach(wrapper => {
                    const ar = wrapper.style.aspectRatio;
                    if (!ar) return;
                    const parts = ar.split('/').map(Number);
                    if (parts.length !== 2 || !parts[1]) return;
                    const ratio = parts[0] / parts[1];
                    const width = wrapper.getBoundingClientRect().width || wrapper.offsetWidth;
                    if (width > 0) {
                        wrapper.style.height = Math.round(width / ratio) + 'px';
                    }
                });
            };
            // Run after layout
            requestAnimationFrame(() => { fixVideoWrapperHeights(); });
            if (window.ResizeObserver) {
                const ro = new ResizeObserver(() => fixVideoWrapperHeights());
                ro.observe(notePreview);
            }
            // Hide add-desc buttons in card view
            notePreview.querySelectorAll('.checklist-add-desc').forEach(btn => {
                btn.style.display = 'none';
            });

            // Save cl-text edits on blur in note cards
            notePreview.querySelectorAll('.cl-item .cl-text').forEach(inp => {
                inp.addEventListener('blur', async () => {
                    inp.setAttribute('value', inp.value);
                    syncClInputs(notePreview);
                    const updContent = notePreview.innerHTML;
                    const ts = Date.now();
                    try {
                        await notesDB.saveNote({ id: note.id, content: updContent, creationTime: note.creationTime, lastModified: ts, title: notesDB.extractTitle(updContent) });
                    } catch (err) { console.error('Checklist text save error:', err); }
                });
            });

            // Interactive checkboxes — new .cl-item and legacy .checklist-item-wrapper
            notePreview.querySelectorAll('.cl-item .cl-cb, .checklist-checkbox-ios, input[type="checkbox"]').forEach(cb => {                const isNew = cb.classList.contains('cl-cb');
                const item  = isNew ? cb.closest('.cl-item') : cb.closest('.checklist-item-wrapper');
                const textEl = isNew
                    ? item?.querySelector('.cl-text')
                    : item?.querySelector('.checklist-text-content, .checklist-text-ios');

                if (cb.getAttribute('data-checked') === 'true') {
                    cb.checked = true;
                    cb.setAttribute('checked', '');
                    if (textEl) textEl.classList.add(isNew ? 'cl-done' : 'checklist-done');
                    if (item)   item.classList.add(isNew ? 'cl-item-done' : 'checklist-item-done');
                } else if (cb.getAttribute('data-checked') === 'false') {
                    cb.checked = false;
                    cb.removeAttribute('checked');
                    if (textEl) textEl.classList.remove(isNew ? 'cl-done' : 'checklist-done');
                    if (item)   item.classList.remove(isNew ? 'cl-item-done' : 'checklist-item-done');
                }

                // Restore color accent for new items
                if (isNew && item?.dataset.clColor) {
                    item.style.setProperty('--cl-accent', item.dataset.clColor);
                }

                cb.addEventListener('change', async () => {
                    const isChecked = cb.checked;
                    cb.setAttribute('data-checked', isChecked ? 'true' : 'false');
                    if (textEl) textEl.classList.toggle(isNew ? 'cl-done' : 'checklist-done', isChecked);
                    if (item)   item.classList.toggle(isNew ? 'cl-item-done' : 'checklist-item-done', isChecked);
                    syncClInputs(notePreview);
                    const updContent = notePreview.innerHTML;
                    const ts = Date.now();
                    try {
                        await notesDB.saveNote({ id: note.id, content: updContent, creationTime: note.creationTime, lastModified: ts, title: notesDB.extractTitle(updContent) });
                        note.content = updContent;
                        const np = getChecklistProgress(updContent);
                        if (np) {
                            const pctNew = Math.round(np.checked / np.total * 100);
                            const fill = noteEl.querySelector('.checklist-progress-bar-fill');
                            const pctEl = noteEl.querySelector('.checklist-progress-pct');
                            const lblEl = noteEl.querySelector('.checklist-progress-label');
                            const actLng = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : currentLang;
                            const doneLbl2 = window.translations?.[actLng]?.checklistDone || 'done';
                            if (fill) fill.style.width = pctNew + '%';
                            if (pctEl) pctEl.textContent = pctNew + '%';
                            if (lblEl) lblEl.textContent = `☑ ${np.checked}/${np.total} ${doneLbl2}`;
                        }
                    } catch (err) { console.error('Checklist save error:', err); }
                });
            });

            setTimeout(() => { processTablesForResponsiveness(notePreview); }, 100);

            // Image handlers
            notePreview.querySelectorAll('img').forEach(img => {
                img.addEventListener('load', () => img.classList.add('loaded'));
                img.addEventListener('error', () => { img.classList.add('error'); img.alt = 'Image load error'; });
                if (img.complete && img.naturalHeight) img.classList.add('loaded');
                img.addEventListener('click', handleImageClick);
            });

            noteEl.appendChild(notePreview);

            // Buttons
            const btns = document.createElement('div'); btns.classList.add('note-buttons');

            // Tags inside footer
            if (note.tags && note.tags.length && allTags.length) {
                const tagsDiv = document.createElement('div');
                tagsDiv.className = 'note-tags';
                const tagNamesList = [];
                for (const tagId of note.tags) {
                    const tag = allTags.find(t => t.id === tagId);
                    if (!tag) continue;
                    tagNamesList.push(tag.name.toLowerCase());
                    const colorObj = (typeof TAG_COLORS !== 'undefined' ? TAG_COLORS : []).find(c => c.id === tag.colorId);
                    const hex = colorObj ? colorObj.hex : '#aefc6e';
                    const pill = document.createElement('span');
                    pill.className = 'note-tag-pill';
                    pill.style.setProperty('--tag-color', hex);
                    pill.textContent = tag.name;
                    tagsDiv.appendChild(pill);
                }
                btns.appendChild(tagsDiv);
                // Store lowercase tag names for search
                noteEl.dataset.tagNames = tagNamesList.join(',');
            } else {
                noteEl.dataset.tagNames = '';
            }

            const btnRow = document.createElement('div'); btnRow.className = 'note-btn-row';
            const editBtn = document.createElement('button'); editBtn.classList.add('editBtn');
            editBtn.innerHTML = typeof t === 'function' ? t('edit') : 'Edit';
            editBtn.onclick = () => openModal(note.id, note.content, note.creationTime);
            const delBtn = document.createElement('button'); delBtn.classList.add('deleteBtn');
            delBtn.innerHTML = typeof t === 'function' ? t('delete') : 'Delete';
            delBtn.onclick = () => {
                noteEl.classList.add('removing');
                setTimeout(async () => {
                    try { await notesDB.deleteNote(note.id); await loadNotes(); }
                    catch (e) { showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('errorDeletingNote') : 'Error deleting!', 'error'); }
                }, 500);
            };
            const expBtn = document.createElement('button'); expBtn.classList.add('exportBtn');
            expBtn.innerHTML = typeof t === 'function' ? t('export') : 'Export';
            expBtn.onclick = () => showExportOptions(note.content);

            // Screenshot button
            const ssBtn = document.createElement('button'); ssBtn.classList.add('screenshotBtn');
            const ssLabel = (typeof t === 'function' ? t('screenshotBtn') : null) || 'Screenshot';
            ssBtn.title = ssLabel;
            ssBtn.innerHTML = '<i class="bi bi-camera"></i>';
            ssBtn.setAttribute('aria-label', ssLabel);
            ssBtn.onclick = () => {
                if (typeof takeNoteScreenshot === 'function') {
                    syncClInputs(notePreview);
                    takeNoteScreenshot({ ...note, content: notePreview.innerHTML });
                }
            };

            btnRow.appendChild(editBtn); btnRow.appendChild(delBtn); btnRow.appendChild(expBtn); btnRow.appendChild(ssBtn);
            btns.appendChild(btnRow);
            noteEl.appendChild(btns);

            if (quickEditActive) enableQuickEditOnNote(noteEl);
            notesContainer.appendChild(noteEl);
        });

        setTimeout(() => { if (typeof hljs !== 'undefined') hljs.highlightAll(); initCodeBlockCopyButtons(notesContainer); fixCodeBlockStyles(notesContainer); }, 200);
    } catch (e) {
        console.error('Error loading notes:', e);
        showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('errorLoadingNotes') : 'Error loading notes!', 'error');
    }
}

function handleImageClick(e) {
    // Handled by js/img.js
}

// ============================================================================
// WELCOME MESSAGE (from backup)
// ============================================================================
function showWelcomeMessage() {
    const notesContainer = document.getElementById('notesContainer');
    if (!notesContainer || document.querySelector('.welcome-message')) return;

    function gt(key, fb) {
        try { if (typeof t === 'function') { const v = t(key); return (v && v !== key) ? v : fb; } return fb; } catch { return fb; }
    }

    const wc = document.createElement('div');
    wc.classList.add('welcome-message');
    wc.innerHTML = `<div class="welcome-content">
        <div class="welcome-header">
            <h1 class="welcome-title">${gt('welcomeTitle','Welcome to Local Notes')}</h1>
            <p class="welcome-subtitle">${gt('welcomeSubtitle','Secure, private note-taking in your browser')}</p>
        </div>
        <div class="welcome-section"><h2 class="welcome-section-title">${gt('welcomeAbout','About Local Notes')}</h2>
            <p class="welcome-description">${gt('welcomeDescription','Local Notes is a secure web application for creating and storing notes directly in your browser.')}</p></div>
        <div class="welcome-section"><h2 class="welcome-section-title">${gt('welcomeFeatures','Key Features')}</h2>
            <ul class="welcome-features">
                <li>${gt('welcomeFeature1','Industry-standard AES-256 encryption')}</li>
                <li>${gt('welcomeFeature2','12 languages supported')}</li>
                <li>${gt('welcomeFeature3','PWA support - install as app')}</li>
                <li>${gt('welcomeFeature4','Optimized performance')}</li>
                <li>${gt('welcomeFeature5','Enhanced security protection')}</li>
                <li>${gt('welcomeFeature6','Modern responsive design')}</li>
                <li>${gt('welcomeFeature7','Offline operation support')}</li>
            </ul></div>
        <div class="welcome-section"><h2 class="welcome-section-title">${gt('welcomeGoals','Project Goals')}</h2>
            <ul class="welcome-goals">
                <li>${gt('welcomeGoal1','Maximum privacy - data stays local')}</li>
                <li>${gt('welcomeGoal2','Security - industry-standard encryption')}</li>
                <li>${gt('welcomeGoal3','Accessibility - 12 languages')}</li>
                <li>${gt('welcomeGoal4','Universality - works everywhere')}</li>
                <li>${gt('welcomeGoal5','Performance - fast operation')}</li>
                <li>${gt('welcomeGoal6','Convenience - intuitive interface')}</li>
            </ul></div>
        <div class="welcome-section"><h2 class="welcome-section-title">${gt('welcomeDeveloper','Developer')}</h2>
            <p class="welcome-developer-info">${gt('welcomeDeveloperInfo','Developed by PsyGioX. Open source project focused on privacy and security.')}</p></div>
        <div class="welcome-section"><h2 class="welcome-section-title">${gt('welcomeGetStarted','Get Started')}</h2>
            <p class="welcome-get-started">${gt('welcomeGetStartedText','Click Add Note to create your first note.')}</p></div>
        <div class="welcome-actions">
            <button class="welcome-dismiss-btn" id="welcomeDismissBtn">${gt('welcomeDismiss','Show instructions')}</button>
        </div></div>`;
    notesContainer.appendChild(wc);
    var dismissBtn = document.getElementById('welcomeDismissBtn');
    if (dismissBtn) dismissBtn.addEventListener('click', showWelcomeInstructions);
    setTimeout(() => updateWelcomeTranslations(), 100);
}

function showWelcomeInstructions() {
    showCustomAlert(
        typeof t === 'function' ? t('welcomeInstructionsTitle') || 'How to get started' : 'How to get started',
        typeof t === 'function' ? t('welcomeInstructions') || "Click 'Add Note' to create your first note." : "Click 'Add Note' to create your first note.",
        'info'
    );
}

function updateWelcomeTranslations() {
    const wm = document.querySelector('.welcome-message');
    if (!wm || typeof t !== 'function') return;
    try {
        // Update all section titles by their order
        const sectionTitles = wm.querySelectorAll('.welcome-section-title');
        const sectionTitleKeys = ['welcomeAbout', 'welcomeFeatures', 'welcomeGoals', 'welcomeDeveloper', 'welcomeGetStarted'];
        sectionTitles.forEach((el, idx) => { if (sectionTitleKeys[idx]) el.textContent = t(sectionTitleKeys[idx]) || el.textContent; });

        // Update text blocks
        const map = {
            '.welcome-title': 'welcomeTitle',
            '.welcome-subtitle': 'welcomeSubtitle',
            '.welcome-description': 'welcomeDescription',
            '.welcome-developer-info': 'welcomeDeveloperInfo',
            '.welcome-get-started': 'welcomeGetStartedText',
            '.welcome-dismiss-btn': 'welcomeDismiss'
        };
        Object.entries(map).forEach(([sel, key]) => { const el = wm.querySelector(sel); if (el) el.textContent = t(key) || el.textContent; });

        // Update lists
        [['welcomeFeature1','welcomeFeature2','welcomeFeature3','welcomeFeature4','welcomeFeature5','welcomeFeature6','welcomeFeature7'],
         ['welcomeGoal1','welcomeGoal2','welcomeGoal3','welcomeGoal4','welcomeGoal5','welcomeGoal6']].forEach((keys, i) => {
            const items = wm.querySelectorAll(i === 0 ? '.welcome-features li' : '.welcome-goals li');
            items.forEach((item, idx) => { if (keys[idx]) item.textContent = t(keys[idx]) || item.textContent; });
        });
    } catch (e) { console.warn('Translation update error:', e); }
}

// ============================================================================
// ADVANCED SEARCH
// ============================================================================

// Extended transliteration covering all supported languages:
// Russian, Ukrainian, Bulgarian, Serbian, Macedonian, Bosnian, Croatian, Slovak, Czech, Polish, Slovenian
function transliterateAdvanced(text) {
    const map = {
        // Russian / Ukrainian / Bulgarian / Macedonian / Serbian / Bosnian
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z',
        'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
        'с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch',
        'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
        // Ukrainian specific
        'і':'i','ї':'yi','є':'ye','ґ':'g',
        // Bulgarian specific
        'ь':'','ъ':'a',
        // Serbian / Macedonian Cyrillic
        'ђ':'dj','ж':'zh','љ':'lj','њ':'nj','ћ':'c','џ':'dz','ѓ':'gj','ѕ':'dz','ѐ':'e',
        'ј':'j','ќ':'kj','ѓ':'gj','ѐ':'e','ѣ':'e',
        // Polish diacritics
        'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
        // Czech / Slovak diacritics
        'á':'a','č':'c','ď':'d','é':'e','ě':'e','í':'i','ň':'n','ř':'r','š':'s',
        'ť':'t','ú':'u','ů':'u','ý':'y','ž':'z',
        // Croatian / Bosnian / Serbian Latin
        'đ':'d','ć':'c','č':'c','š':'s','ž':'z',
        // Slovenian
        // (same as Croatian above)
        // German / other common
        'ä':'ae','ö':'oe','ü':'ue','ß':'ss',
        // Macedonian specific
        'ѓ':'gj','ѕ':'dz','ј':'j','љ':'lj','њ':'nj','ќ':'kj','џ':'dz',
    };
    return text.toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('');
}

// Parse search query: extract #tag parts and text parts
function parseSearchQuery(raw) {
    const tagMatches = [];
    const textParts = [];
    const tokens = raw.trim().split(/\s+/);
    for (const tok of tokens) {
        if (tok.startsWith('#') && tok.length > 1) {
            tagMatches.push(tok.slice(1).toLowerCase());
        } else if (tok.length > 0) {
            textParts.push(tok.toLowerCase());
        }
    }
    return { tagMatches, textQuery: textParts.join(' '), textWords: textParts };
}

// Get tag names for a note element (from data-tag-names attribute set during render)
function getNoteTagNames(noteEl) {
    return noteEl.dataset.tagNames || '';
}

// Text match logic with transliteration
function textMatchesQuery(allText, textQuery, textWords) {
    if (!textQuery) return true;
    const allTr = transliterateAdvanced(allText);
    const tq = transliterateAdvanced(textQuery);

    // Exact phrase match
    if (allText.includes(textQuery) || allTr.includes(tq)) return true;

    // All words must be present
    if (textWords.length > 1) {
        if (textWords.every(w => allText.includes(w) || allTr.includes(transliterateAdvanced(w)))) return true;
    }

    // Word prefix match
    const words = allText.split(/\s+/);
    const wordsTr = allTr.split(/\s+/);
    if (words.some(w => w.startsWith(textQuery)) || wordsTr.some(w => w.startsWith(tq))) return true;

    // Fuzzy: drop last char for queries > 2 chars
    if (textQuery.length > 2) {
        const fuzzy = textQuery.slice(0, -1);
        const fuzzyTr = transliterateAdvanced(fuzzy);
        if (allText.includes(fuzzy) || allTr.includes(fuzzyTr)) return true;
    }

    return false;
}

function filterNotes() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    const raw = searchInput.value.trim();

    if (!raw) {
        document.querySelectorAll('.note').forEach(n => n.classList.remove('hidden'));
        clearSearchHighlights();
        hideSearchStats();
        return;
    }

    const { tagMatches, textQuery, textWords } = parseSearchQuery(raw);

    document.querySelectorAll('.note').forEach(note => {
        const content = note.querySelector('.noteContent');
        if (!content) { note.classList.add('hidden'); return; }

        // Tag filter: all requested tags must be present
        // Supports both exact match and prefix (for partial typing)
        if (tagMatches.length > 0) {
            const noteTagNames = getNoteTagNames(note); // comma-separated lowercase tag names
            const noteTags = noteTagNames ? noteTagNames.split(',').map(s => s.trim()).filter(Boolean) : [];
            if (noteTags.length === 0) { note.classList.add('hidden'); return; }
            const allTagsMatch = tagMatches.every(searchTag =>
                noteTags.some(noteTag => noteTag === searchTag || noteTag.startsWith(searchTag))
            );
            if (!allTagsMatch) { note.classList.add('hidden'); return; }
        }

        // Text filter
        if (textQuery) {
            const allText = (content.textContent + ' ' + (note.querySelector('.note-footer')?.textContent || '')).toLowerCase();
            if (!textMatchesQuery(allText, textQuery, textWords)) {
                note.classList.add('hidden'); return;
            }
        }

        note.classList.remove('hidden');
    });

    applySearchHighlights(textQuery);
    updateSearchStats();
}

function applySearchHighlights(query) {
    clearSearchHighlights();
    if (!query || query.length < 2) return;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');

    document.querySelectorAll('.note:not(.hidden) .noteContent').forEach(content => {
        highlightTextNodes(content, regex);
    });
}

function highlightTextNodes(node, regex) {
    if (node.nodeType === 3) {
        const text = node.textContent;
        if (!regex.test(text)) return;
        regex.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0, m;
        while ((m = regex.exec(text)) !== null) {
            if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            const mark = document.createElement('mark');
            mark.className = 'search-highlight';
            mark.textContent = m[0];
            frag.appendChild(mark);
            last = regex.lastIndex;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === 1 && !['SCRIPT','STYLE','MARK'].includes(node.tagName)) {
        Array.from(node.childNodes).forEach(child => highlightTextNodes(child, regex));
    }
}

function clearSearchHighlights() {
    document.querySelectorAll('.search-highlight').forEach(mark => {
        const parent = mark.parentNode;
        if (parent) { parent.replaceChild(document.createTextNode(mark.textContent), mark); parent.normalize(); }
    });
}

function updateSearchStats() {
    const visible = document.querySelectorAll('.note:not(.hidden)').length;
    const total = document.querySelectorAll('.note').length;
    let statsEl = document.getElementById('searchStats');
    if (!statsEl) {
        statsEl = document.createElement('div');
        statsEl.id = 'searchStats';
        statsEl.className = 'search-stats';
        document.body.appendChild(statsEl);
    }
    statsEl.textContent = visible + ' / ' + total;
    statsEl.style.display = 'block';

    // Position as float below search input
    const si = document.getElementById('searchInput');
    if (si) {
        const r = si.getBoundingClientRect();
        statsEl.style.top = (r.bottom + window.scrollY + 6) + 'px';
        statsEl.style.left = r.left + 'px';
        statsEl.style.minWidth = r.width + 'px';
    }
}

function hideSearchStats() {
    const statsEl = document.getElementById('searchStats');
    if (statsEl) statsEl.style.display = 'none';
}

// Tag autocomplete dropdown for # searches + focus hint
function initSearchTagAutocomplete() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    let dropdown = null;

    const positionDropdown = (el) => {
        const rect = input.getBoundingClientRect();
        el.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;min-width:${Math.max(rect.width, 280)}px;z-index:9999;`;
    };

    const closeDropdown = () => {
        if (!dropdown) return;
        const el = dropdown;
        dropdown = null;
        el.classList.remove('is-open');
        el.classList.add('is-closing');
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 180);
    };

    const openDropdown = (el) => {
        // Force reflow so initial state is painted before transition starts
        el.getBoundingClientRect();
        requestAnimationFrame(() => el.classList.add('is-open'));
    };

    // Show hint panel on focus (when input is empty)
    const showHintDropdown = async () => {
        if (input.value.trim()) return; // already typing — don't override
        closeDropdown();

        const allTags = typeof getTags === 'function' ? await getTags() : [];

        dropdown = document.createElement('div');
        dropdown.className = 'search-tag-dropdown search-hint-dropdown';
        document.body.appendChild(dropdown);
        positionDropdown(dropdown);
        openDropdown(dropdown);

        const _t = (key, fb) => window.t ? (window.t(key) || fb) : fb;

        let html = `<div class="search-hint-header"><i class="bi bi-search"></i> ${_t('searchHintTitle', 'Как искать')}</div>`;
        html += `<div class="search-hint-tips">`;
        html += `<div class="search-hint-tip"><span class="search-hint-key">текст</span><span class="search-hint-desc">${_t('searchHintText', 'поиск по содержимому')}</span></div>`;
        html += `<div class="search-hint-tip"><span class="search-hint-key">#тег</span><span class="search-hint-desc">${_t('searchHintTag', 'поиск по тегу')}</span></div>`;
        html += `<div class="search-hint-tip"><span class="search-hint-key">текст #тег</span><span class="search-hint-desc">${_t('searchHintCombined', 'комбинированный поиск')}</span></div>`;
        html += `</div>`;

        if (allTags.length > 0) {
            html += `<div class="search-hint-tags-title"><i class="bi bi-tags"></i> ${_t('searchHintTags', 'Теги')}</div>`;
            html += `<div class="search-hint-tags">`;
            allTags.forEach(tag => {
                const colorObj = (typeof TAG_COLORS !== 'undefined' ? TAG_COLORS : []).find(c => c.id === tag.colorId);
                const hex = colorObj ? colorObj.hex : '#aefc6e';
                html += `<button class="search-hint-tag-pill" data-tag="${escapeHtml(tag.name)}" style="--tag-color:${hex}">
                    <span class="search-tag-dot" style="background:${hex}"></span>${escapeHtml(tag.name)}
                </button>`;
            });
            html += `</div>`;
        }

        dropdown.innerHTML = html;

        // Click on tag pill — insert #tagname into input
        dropdown.querySelectorAll('.search-hint-tag-pill').forEach(pill => {
            pill.addEventListener('mousedown', e => {
                e.preventDefault();
                input.value = '#' + pill.dataset.tag + ' ';
                closeDropdown();
                filterNotes();
                input.focus();
            });
            pill.addEventListener('touchend', e => {
                e.preventDefault();
                e.stopPropagation();
                input.value = '#' + pill.dataset.tag + ' ';
                closeDropdown();
                filterNotes();
                input.focus();
            });
        });
    };

    input.addEventListener('focus', showHintDropdown);

    input.addEventListener('input', async () => {
        filterNotes();
        const val = input.value;

        // Empty — show hint again
        if (!val.trim()) { showHintDropdown(); return; }

        const hashIdx = val.lastIndexOf('#');
        if (hashIdx === -1) { closeDropdown(); return; }

        const partial = val.slice(hashIdx + 1).toLowerCase();
        const allTags = typeof getTags === 'function' ? await getTags() : [];
        const matches = allTags.filter(t => t.name.toLowerCase().startsWith(partial));

        if (matches.length === 0) { closeDropdown(); return; }

        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'search-tag-dropdown';
            document.body.appendChild(dropdown);
            positionDropdown(dropdown);
            openDropdown(dropdown);
        }

        positionDropdown(dropdown);
        dropdown.innerHTML = '';

        matches.slice(0, 8).forEach(tag => {
            const colorObj = (typeof TAG_COLORS !== 'undefined' ? TAG_COLORS : []).find(c => c.id === tag.colorId);
            const hex = colorObj ? colorObj.hex : '#aefc6e';
            const item = document.createElement('button');
            item.className = 'search-tag-item';
            item.innerHTML = `<span class="search-tag-dot" style="background:${hex}"></span>${escapeHtml(tag.name)}`;
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                const before = val.slice(0, hashIdx + 1);
                input.value = before + tag.name + ' ';
                closeDropdown();
                filterNotes();
                input.focus();
            });
            item.addEventListener('touchend', e => {
                e.preventDefault();
                e.stopPropagation();
                const before = val.slice(0, hashIdx + 1);
                input.value = before + tag.name + ' ';
                closeDropdown();
                filterNotes();
                input.focus();
            });
            dropdown.appendChild(item);
        });
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeDropdown(); input.value = ''; filterNotes(); input.blur(); }
        if (e.key === 'Enter') {
            e.preventDefault();
            closeDropdown();
            const first = document.querySelector('.note:not(.hidden)');
            if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
        if (e.key === 'ArrowDown' && dropdown) {
            const items = dropdown.querySelectorAll('.search-tag-item, .search-hint-tag-pill');
            if (items.length) { items[0].focus(); }
        }
    });

    document.addEventListener('click', e => {
        if (dropdown && !dropdown.contains(e.target) && e.target !== input) closeDropdown();
    });

    document.addEventListener('touchstart', e => {
        if (dropdown && !dropdown.contains(e.target) && e.target !== input) closeDropdown();
    }, { passive: true });

    input.addEventListener('blur', () => {
        // Small delay so mousedown/touchstart on dropdown items fires first
        setTimeout(() => {
            if (dropdown && document.activeElement !== input && !dropdown.contains(document.activeElement)) {
                closeDropdown();
            }
        }, 300);
    });

    // Reposition stats badge and dropdown on scroll/resize
    const repositionStats = () => {
        const statsEl = document.getElementById('searchStats');
        if (!statsEl || statsEl.style.display === 'none') return;
        const r = input.getBoundingClientRect();
        statsEl.style.top = (r.bottom + window.scrollY + 6) + 'px';
        statsEl.style.left = r.left + 'px';
        statsEl.style.minWidth = r.width + 'px';
    };
    window.addEventListener('scroll', repositionStats, { passive: true });
    window.addEventListener('resize', repositionStats, { passive: true });
}

// ============================================================================
// WORD COUNT (adapted – works with LocalNotesEditor)
// ============================================================================
function showWordCount() {
    const text = (typeof localNotesEditorInstance !== 'undefined' && localNotesEditorInstance) ? localNotesEditorInstance.getText() : '';
    if (!text) return;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length, charsNoSpaces = text.replace(/\s/g, '').length;
    showCustomAlert(typeof t === 'function' ? t('info') : 'Info', typeof t === 'function' ? t('wordCount', { words, chars, charsNoSpaces }) : `Words: ${words} | Chars: ${chars} | No spaces: ${charsNoSpaces}`, 'info');
}

// ============================================================================
// QUICK EDIT (from backup)
// ============================================================================
function toggleQuickEditMode() {
    quickEditActive = !quickEditActive;
    localStorage.setItem('quickEditMode', quickEditActive ? '1' : '0');
    applyQuickEditMode();
}

function applyQuickEditMode() {
    const btn = document.getElementById('quickEditToggle');
    if (quickEditActive) {
        document.body.classList.add('quick-edit-active');
        if (btn) { btn.classList.add('active'); btn.innerHTML = `<i class="bi bi-lightning-charge-fill"></i> ${typeof t === 'function' ? t('quickEditOff') || 'Quick Edit: ON' : 'Quick Edit: ON'}`; btn.title = typeof t === 'function' ? t('quickEditOffTitle') || 'Disable quick edit mode' : 'Disable quick edit mode'; }
        document.getElementById('notesContainer')?.querySelectorAll('.note').forEach(el => enableQuickEditOnNote(el));
    } else {
        document.body.classList.remove('quick-edit-active');
        if (btn) { btn.classList.remove('active'); btn.innerHTML = `<i class="bi bi-lightning-charge"></i> ${typeof t === 'function' ? t('quickEditOn') || 'Quick Edit' : 'Quick Edit'}`; btn.title = typeof t === 'function' ? t('quickEditOnTitle') || 'Enable quick edit mode' : 'Enable quick edit mode'; }
        document.getElementById('notesContainer')?.querySelectorAll('.note').forEach(el => disableQuickEditOnNote(el));
    }
}

function enableQuickEditOnNote(noteEl) {
    const content = noteEl.querySelector('.noteContent');
    if (!content || content.getAttribute('contenteditable') === 'true') return;
    content.setAttribute('contenteditable', 'true'); content.setAttribute('spellcheck', 'true');
    noteEl.classList.add('quick-edit-note');
    if (noteEl.querySelector('.quick-edit-bar')) return;
    const bar = document.createElement('div'); bar.className = 'quick-edit-bar';
    bar.innerHTML = `<span class="quick-edit-hint">${typeof t === 'function' ? t('quickEditHint') || 'Quick edit' : 'Quick edit'}</span>
        <div class="quick-edit-actions">
            <button class="quick-edit-save">${typeof t === 'function' ? t('save') || 'Save' : 'Save'}</button>
            <button class="quick-edit-cancel">${typeof t === 'function' ? t('cancel') || 'Cancel' : 'Cancel'}</button>
        </div>`;
    noteEl.appendChild(bar);
    const noteId = noteEl.dataset.noteId, noteCreationTime = parseInt(noteEl.dataset.noteCreationTime, 10);
    let originalContent = content.innerHTML;
    bar.querySelector('.quick-edit-save').addEventListener('click', async e => {
        e.stopPropagation();
        await saveQuickEdit(noteEl, content, noteId, noteCreationTime);
        originalContent = content.innerHTML; noteEl.classList.remove('quick-edit-dirty');
    });
    bar.querySelector('.quick-edit-cancel').addEventListener('click', e => {
        e.stopPropagation(); content.innerHTML = originalContent; noteEl.classList.remove('quick-edit-dirty');
        disableQuickEditOnNote(noteEl);
        if (!document.querySelector('#notesContainer .note.quick-edit-note')) { quickEditActive = false; localStorage.setItem('quickEditMode','0'); applyQuickEditMode(); }
        showQuickEditNotification(typeof t === 'function' ? t('quickEditCancelled') || 'Changes cancelled' : 'Changes cancelled', 'info');
    });
    content.addEventListener('input', () => noteEl.classList.add('quick-edit-dirty'));
    let blurTimer;
    content.addEventListener('blur', () => { blurTimer = setTimeout(async () => { if (noteEl.classList.contains('quick-edit-dirty')) { await saveQuickEdit(noteEl, content, noteId, noteCreationTime); originalContent = content.innerHTML; noteEl.classList.remove('quick-edit-dirty'); } }, 400); });
    content.addEventListener('focus', () => clearTimeout(blurTimer));
}

// Sync cl-text input values to HTML attributes before reading innerHTML
function syncClInputs(container) {
    container.querySelectorAll('.cl-item .cl-text').forEach(inp => {
        inp.setAttribute('value', inp.value);
    });
    container.querySelectorAll('.cl-item .cl-cb').forEach(cb => {
        cb.setAttribute('data-checked', cb.checked ? 'true' : 'false');
        if (cb.checked) cb.setAttribute('checked', '');
        else cb.removeAttribute('checked');
    });
}

async function saveQuickEdit(noteEl, content, noteId, noteCreationTime) {
    syncClInputs(content);
    const updatedContent = content.innerHTML;
    const timestamp = Date.now();
    try {
        await notesDB.saveNote({ id: noteId, content: updatedContent, creationTime: noteCreationTime, lastModified: timestamp, title: notesDB.extractTitle(updatedContent) });
        noteEl.dataset.noteCreationTime = noteCreationTime;
        const footer = noteEl.querySelector('.note-footer');
        if (footer) {
            const actLng = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : currentLang;
            const localeMap = { ru:'ru-RU', ua:'uk-UA', pl:'pl-PL', cs:'cs-CZ', sk:'sk-SK', bg:'bg-BG', hr:'hr-HR', sr:'sr-RS', bs:'bs-BA', mk:'mk-MK', sl:'sl-SI' };
            const locale = localeMap[actLng] || 'en-US';
            const opts = { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' };
            const modifiedText = window.langData?.[actLng]?.modified || (typeof t === 'function' ? t('modified') : 'Modified');
            const createdText = window.langData?.[actLng]?.created || (typeof t === 'function' ? t('created') : 'Created');
            footer.textContent = `${createdText}: ${new Date(noteCreationTime).toLocaleString(locale, opts)} | ${modifiedText}: ${new Date(timestamp).toLocaleString(locale, opts)}`;
        }
        showQuickEditNotification(typeof t === 'function' ? t('noteSaved') || 'Note saved!' : 'Note saved!', 'success');
    } catch (e) {
        console.error('Quick edit save error:', e);
        showQuickEditNotification(typeof t === 'function' ? t('errorSavingNote') || 'Error saving!' : 'Error saving!', 'error');
    }
}

function disableQuickEditOnNote(noteEl) {
    const content = noteEl.querySelector('.noteContent');
    if (content) { content.removeAttribute('contenteditable'); content.removeAttribute('spellcheck'); }
    noteEl.classList.remove('quick-edit-note', 'quick-edit-dirty');
    const bar = noteEl.querySelector('.quick-edit-bar'); if (bar) noteEl.removeChild(bar);
}

function showQuickEditNotification(message, type = 'success') {
    const n = document.createElement('div');
    const colors = { success: '#28a745', error: '#dc3545', info: '#007bff' };
    n.style.cssText = `position:fixed;bottom:20px;right:20px;background:${colors[type]||colors.info};color:white;padding:12px 20px;border-radius:8px;z-index:99999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.3s;`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => { n.style.opacity = '0'; setTimeout(() => { if (n.parentNode) document.body.removeChild(n); }, 300); }, 2000);
}

function restoreQuickEditMode() {
    quickEditActive = localStorage.getItem('quickEditMode') === '1';
    applyQuickEditMode();
}

// ============================================================================
// VIEW MODE
// ============================================================================
function toggleViewMode() {
    const container = document.getElementById('notesContainer');
    if (!container) return;
    const isFull = container.classList.contains('full-width-view');
    container.classList.toggle('full-width-view', !isFull);
    container.classList.toggle('default-view', isFull);
    localStorage.setItem('viewMode', isFull ? 'grid' : 'list');
    if (window.appUtils) window.appUtils.updateToggleViewButton();
}

function restoreViewMode() {
    const saved = localStorage.getItem('viewMode');
    const container = document.getElementById('notesContainer');
    if (!container) return;
    if (saved === 'list') { container.classList.add('full-width-view'); container.classList.remove('default-view'); }
    else { container.classList.add('default-view'); container.classList.remove('full-width-view'); }
    if (window.appUtils) window.appUtils.updateToggleViewButton();
}

// ============================================================================
// FOOTER TEXTS
// ============================================================================
function updateFooterTexts() {
    if (typeof t === 'undefined' && typeof window.t === 'undefined') return;
    const fn = typeof t === 'function' ? t : window.t;
    if (typeof fn !== 'function') return;
    try {
        [['footerDescription','footerDescription'],['cookiePolicyLink','cookiePolicy'],['termsOfUseLink','termsOfUse'],['privacyPolicyLink','privacyPolicy'],['byAuthorLink','byAuthor'],['allRightsReserved','allRightsReserved']].forEach(([id, key]) => {
            const el = document.getElementById(id); if (el) el.textContent = fn(key) || el.textContent;
        });
        const yearEl = document.getElementById('currentYear'); if (yearEl) yearEl.textContent = new Date().getFullYear();
        if (typeof updateWelcomeTranslations === 'function') updateWelcomeTranslations();
    } catch (e) { console.error('Footer update error:', e); }
}

function updateButtonTexts() {
    if (typeof t !== 'function' && typeof window.t !== 'function') return;
    const fn = typeof t === 'function' ? t : window.t;
    if (typeof fn !== 'function') return;
    [
        ['addNoteButton', `<i class="bi bi-plus-lg"></i> ${fn('addNote') || 'Add a note'}`],
        ['importButton', `<i class="bi bi-box-arrow-in-down"></i> ${fn('importNotes') || 'Import notes'}`],
        ['clearAllButton', `<i class="bi bi-trash3"></i> ${fn('clearAllNotes') || 'Clear all notes'}`],
        ['saveNoteButton', `<i class="bi bi-floppy"></i> ${fn('saveNote') || 'Save note'}`],
        ['cancelNoteButton', `<i class="bi bi-x-lg"></i> ${fn('cancel') || 'Cancel'}`],
        ['confirmYes', `<i class="bi bi-check-lg"></i> ${fn('confirmYes') || 'Yes'}`],
        ['confirmNo', `<i class="bi bi-x-lg"></i> ${fn('confirmNo') || 'No'}`],
        ['ok', `<i class="bi bi-check-lg"></i> ${fn('ok') || 'OK'}`],
        ['calendarBtn', `<i class="bi bi-calendar3"></i> ${fn('calendar') || 'Calendar'}`]
    ].forEach(([id, html]) => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
    if (window.appUtils) window.appUtils.updateToggleViewButton();
    if (window.taskBoard) window.taskBoard.updateToggleButton();
    // Re-apply quick edit button text after language is ready
    applyQuickEditMode();
}
window.updateButtonTexts = updateButtonTexts;

// ============================================================================
// EXPORT / IMPORT (from backup)
// ============================================================================
function exportNoteHTML(noteContent) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([`<!-- Exported on ${ts} -->\n` + noteContent], { type: 'text/html' });
    downloadFile(blob, `note_${ts}.html`, 'text/html');
}

async function exportToMarkdown(noteContent) {
    try {
        const pc = await processMediaContent(noteContent);
        const md = pc
            .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (m, n, t) => '#'.repeat(+n) + ' ' + t + '\n\n')
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi,'**$1**').replace(/<b[^>]*>(.*?)<\/b>/gi,'**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi,'*$1*').replace(/<i[^>]*>(.*?)<\/i>/gi,'*$1*')
            .replace(/<s[^>]*>(.*?)<\/s>/gi,'~~$1~~').replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi,'> $1\n')
            .replace(/<code[^>]*>(.*?)<\/code>/gi,'`$1`').replace(/<pre[^>]*>(.*?)<\/pre>/gi,'```\n$1\n```\n')
            .replace(/<ul[^>]*>(.*?)<\/ul>/gi, (m, c) => c.replace(/<li[^>]*>(.*?)<\/li>/gi,'- $1\n') + '\n')
            .replace(/<ol[^>]*>(.*?)<\/ol>/gi, (m, c) => { let i=1; return c.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${i++}. $1\n`) + '\n'; })
            .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi,'[$2]($1)')
            .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi,'![$2]($1)')
            .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi,'![]($1)')
            .replace(/<br\s*\/?>/gi,'\n').replace(/<p[^>]*>(.*?)<\/p>/gi,'$1\n\n')
            .replace(/<[^>]*>/g,'').replace(/\n\s*\n\s*\n/g,'\n\n').trim();
        const ts = new Date().toISOString().replace(/[:.]/g,'-');
        const blob = new Blob([`# Exported Note\n*Exported ${new Date().toLocaleString()}*\n\n---\n\n${md}`], { type: 'text/markdown' });
        downloadFile(blob, `note_${ts}.md`, 'text/markdown');
        showCustomAlert(typeof t === 'function' ? t('success') : 'Success', typeof t === 'function' ? t('noteExported') : 'Note exported!', 'success');
    } catch (e) { showCustomAlert(typeof t === 'function' ? t('error') : 'Error', e.message, 'error'); }
}

async function exportToHTML(noteContent) {
    try {
        const pc = await processMediaContent(noteContent);
        const ts = new Date().toISOString().replace(/[:.]/g,'-');
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Note</title><style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px;line-height:1.6}img{max-width:100%}</style></head><body>${pc}</body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        downloadFile(blob, `note_${ts}.html`, 'text/html');
        showCustomAlert(typeof t === 'function' ? t('success') : 'Success', typeof t === 'function' ? t('noteExported') : 'Exported!', 'success');
    } catch (e) { showCustomAlert(typeof t === 'function' ? t('error') : 'Error', e.message, 'error'); }
}

function exportToPDF(noteContent) {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@media print{@page{margin:1in;size:A4}}body{font-family:sans-serif;line-height:1.6;max-width:800px;margin:0 auto;padding:20px}img{max-width:100%}</style></head><body>${noteContent}</body></html>`);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 500);
}

async function exportNote(noteContent, password) {
    try {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        // Даём UI обновиться перед тяжёлой операцией
        await new Promise(r => setTimeout(r, 0));
        const pc = await processMediaContent(noteContent);
        const contentWithTag = `<!-- Exported on ${ts} -->\n${pc}`;
        const encrypted = await encryption.encrypt(contentWithTag, password);
        const exportData = JSON.stringify({ version: '2.0', format: 'encrypted', data: encrypted, timestamp: Date.now() });
        const blob = new Blob([exportData], { type: 'application/json' });
        downloadFile(blob, `note_${ts}.note`, 'application/json');
        showCustomAlert(typeof t === 'function' ? t('success') : 'Success', typeof t === 'function' ? t('noteExported') : 'Note encrypted and exported!', 'success');
    } catch (e) {
        console.error('Export error:', e);
        showCustomAlert(typeof t === 'function' ? t('error') : 'Error', e.message, 'error');
    }
}

function exportNoteWithFormat(noteContent, format = 'html') {
    switch (format) {
        case 'markdown': exportToMarkdown(noteContent); break;
        case 'pdf': exportToPDF(noteContent); break;
        default: exportToHTML(noteContent); break;
    }
}

function showExportOptions(noteContent) {
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `<div class="export-modal-content">
        <h3>${typeof t === 'function' ? t('chooseImportFormat') || 'Choose export format' : 'Choose export format'}</h3>
        <div class="export-options">
            <button class="export-option" data-format="html"><span class="export-icon">🌐</span><span class="export-text">HTML</span><span class="export-desc">Web page</span></button>
            <button class="export-option" data-format="encrypted"><span class="export-icon">🔒</span><span class="export-text">Encrypted</span><span class="export-desc">Password protected</span></button>
            <button class="export-option" data-format="markdown"><span class="export-icon">📝</span><span class="export-text">Markdown</span><span class="export-desc">Text format</span></button>
            <button class="export-option" data-format="pdf"><span class="export-icon">📄</span><span class="export-text">PDF</span><span class="export-desc">Print document</span></button>
        </div>
        <button class="export-close">${typeof t === 'function' ? t('cancel') : 'Cancel'}</button></div>`;
    document.body.appendChild(modal);
    const close = () => { if (modal.parentNode) document.body.removeChild(modal); };
    modal.querySelectorAll('.export-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const fmt = opt.dataset.format; close();
            if (fmt === 'encrypted') {
                showEncryptModal(pw => {
                    if (pw?.trim()) exportNote(noteContent, pw.trim());
                });
            } else if (fmt === 'html') { exportNoteHTML(noteContent); }
            else { exportNoteWithFormat(noteContent, fmt); }
        });
    });
    modal.querySelector('.export-close').addEventListener('click', close);
    modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

function importNotesWithFormat(event) {
    const files = event.target.files;
    if (!files?.length) return;
    const filesArray = Array.from(files);
    event.target.value = '';

    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `<div class="export-modal-content">
        <h3>${typeof t === 'function' ? t('chooseImportFormat') || 'Choose import format' : 'Choose import format'}</h3>
        <div class="export-options">
            <button class="export-option" data-format="encrypted"><span class="export-icon">🔒</span><span class="export-text">Encrypted</span><span class="export-desc">.note files</span></button>
            <button class="export-option" data-format="html"><span class="export-icon">🌐</span><span class="export-text">HTML</span><span class="export-desc">HTML files</span></button>
            <button class="export-option" data-format="markdown"><span class="export-icon">📝</span><span class="export-text">Markdown</span><span class="export-desc">.md files</span></button>
        </div>
        <button class="export-close">${typeof t === 'function' ? t('cancel') : 'Cancel'}</button></div>`;

    // Remove loading overlay, show format modal
    document.body.appendChild(modal);

    const close = () => { if (modal.parentNode) document.body.removeChild(modal); };
    modal.querySelectorAll('.export-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const fmt = opt.dataset.format; close();
            if (fmt === 'encrypted') importNotesFiles(filesArray);
            else if (fmt === 'html') importNotesHTML(filesArray);
            else importNotesMarkdown(filesArray);
        });
    });
    modal.querySelector('.export-close').addEventListener('click', () => { close(); });
    modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

async function importNotesHTML(files) {
    // Strip dangerous/style-breaking tags from imported HTML
    function sanitizeImportedHTML(html) {
        return DOMPurify.sanitize(html);
    }

    let imported = 0, errors = 0;
    for (const file of files) {
        try {
            const text = await file.text();
            if (isEncryptedFile(text)) { errors++; showCustomAlert(typeof t === 'function' ? t('warning') : 'Warning', typeof t === 'function' ? t('importEncryptedUseFormat', { name: file.name }) || (file.name + ': use Encrypted format') : file.name + ': use Encrypted format', 'warning'); continue; }
            const tag = /<!-- Exported on [\d-T:.Z]+ -->/;
            let content = sanitizeImportedHTML(text);
            if (tag.test(text)) {
                const notes = text.replace(tag,'').trim().split('\n\n---\n\n');
                for (const n of notes) if (n.trim()) { await notesDB.saveNote({ id: secureNoteId(), content: sanitizeImportedHTML(n), creationTime: Date.now(), lastModified: Date.now(), title: notesDB.extractTitle(n) }); imported++; }
            } else { await notesDB.saveNote({ id: secureNoteId(), content, creationTime: Date.now(), lastModified: Date.now(), title: notesDB.extractTitle(content) }); imported++; }
        } catch (e) { errors++; showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('importFileError', { name: file.name, message: e.message }) || (file.name + ': ' + e.message) : file.name + ': ' + e.message, 'error'); }
    }
    if (imported > 0) {
        const msg = errors > 0
            ? (typeof t === 'function' ? t('importCompletedWithErrors', { count: imported, errors }) || `Imported ${imported}, errors: ${errors}` : `Imported ${imported}, errors: ${errors}`)
            : (typeof t === 'function' ? t('importCompleted', { count: imported }) : `Imported ${imported} notes`);
        showCustomAlert(typeof t === 'function' ? t('success') : 'Success', msg, 'success');
        await loadNotes();
    }
    else if (errors) showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('errorNoFilesImported') : 'No files imported', 'error');
}

async function importNotesMarkdown(files) {
    if (typeof window.importNotesMarkdownAdvanced === 'function') {
        return window.importNotesMarkdownAdvanced(files);
    }
    let imported = 0;
    for (const file of files) {
        try {
            const text = await file.text();
            // Use advanced parser if available, fallback to basic regex
            const html = (typeof LNMarkdown !== 'undefined')
                ? LNMarkdown.parse(text)
                : text.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/\n\n+/g,'</p><p>').replace(/^/,'<p>').replace(/$/, '</p>');
            await notesDB.saveNote({ id: secureNoteId(), content: html, creationTime: Date.now(), lastModified: Date.now(), title: notesDB.extractTitle(html) });
            imported++;
        } catch (e) { errors++; showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('importFileError', { name: file.name, message: e.message }) || (file.name + ': ' + e.message) : file.name + ': ' + e.message, 'error'); }
    }
    if (imported > 0) {
        const msg = errors > 0
            ? (typeof t === 'function' ? t('importCompletedWithErrors', { count: imported, errors }) || `Imported ${imported}, errors: ${errors}` : `Imported ${imported}, errors: ${errors}`)
            : (typeof t === 'function' ? t('importCompleted', { count: imported }) : `Imported ${imported} notes`);
        showCustomAlert(typeof t === 'function' ? t('success') : 'Success', msg, 'success');
        await loadNotes();
    }
}

async function importNotesFiles(files) {
    let imported = 0, errors = 0, skipped = 0;
    const fileList = Array.from(files);

    function showDecryptModal(file, fileText, index, total, onSubmit, onSkip) {
        const ov = document.createElement('div');
        ov.className = 'dcm-overlay';
        ov.innerHTML = `
            <div class="dcm-panel">
                <div class="dcm-header">
                    <div class="dcm-icon"><i class="bi bi-lock-fill"></i></div>
                    <div class="dcm-info">
                        <div class="dcm-title">${window.t ? window.t('decryptNote') : 'Decrypt Note'}</div>
                        <div class="dcm-file">${escapeHtml(file.name)}</div>
                        ${total > 1 ? `<div class="dcm-progress">${index + 1} ${window.t ? window.t('of') : 'of'} ${total}</div>` : ''}
                    </div>
                </div>
                <div class="dcm-body">
                    <div class="dcm-field">
                        <label class="dcm-label">${window.t ? window.t('password') : 'Password'}</label>
                        <div class="dcm-input-wrap">
                            <input type="password" id="dcm-pw" class="dcm-input" placeholder="${window.t ? window.t('dcmEnterPasswordPlaceholder') : 'Enter password...'}" autocomplete="current-password">
                            <button type="button" class="dcm-toggle-pw" id="dcm-toggle-pw" title="Show/hide password">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div class="dcm-status" id="dcm-status"></div>
                </div>
                <div class="dcm-footer">
                    <button class="dcm-btn dcm-skip" id="dcm-skip"><i class="bi bi-skip-forward"></i> ${window.t ? window.t('dcmSkipFile') : 'Skip file'}</button>
                    <button class="dcm-btn dcm-primary" id="dcm-ok"><i class="bi bi-unlock"></i> ${window.t ? window.t('dcmDecrypt') : 'Decrypt'}</button>
                </div>
            </div>`;
        document.body.appendChild(ov);

        const pwInput = ov.querySelector('#dcm-pw');
        const status  = ov.querySelector('#dcm-status');
        const okBtn   = ov.querySelector('#dcm-ok');
        const skipBtn = ov.querySelector('#dcm-skip');
        const toggleBtn = ov.querySelector('#dcm-toggle-pw');

        // Focus immediately — no delay
        pwInput.focus();

        // Toggle password visibility
        toggleBtn.addEventListener('click', () => {
            const isHidden = pwInput.type === 'password';
            pwInput.type = isHidden ? 'text' : 'password';
            toggleBtn.innerHTML = isHidden ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        });

        let checkTimer = null;

        // Live password check with debounce
        pwInput.addEventListener('input', () => {
            clearTimeout(checkTimer);
            const pw = pwInput.value;
            if (!pw) { status.innerHTML = ''; okBtn.disabled = false; return; }

            status.innerHTML = '<span class="dcm-checking"><i class="bi bi-hourglass-split"></i> ' + (window.t ? window.t('dcmChecking') : 'Checking...') + '</span>';
            checkTimer = setTimeout(async () => {
                try {
                    let parsed;
                    try { parsed = JSON.parse(fileText); } catch { parsed = null; }
                    const data = parsed ? (parsed.data || fileText) : fileText;
                    await encryption.decrypt(data, pw.trim());
                    status.innerHTML = '<span class="dcm-valid"><i class="bi bi-check-circle-fill"></i> ' + (window.t ? window.t('dcmPasswordCorrect') : 'Password correct!') + '</span>';
                    okBtn.classList.add('dcm-ready');
                } catch (err) {
                    if (err && err.code === 'ORIGIN_MISMATCH') {
                        status.innerHTML = '<span class="dcm-invalid"><i class="bi bi-shield-x"></i> ' + (window.t ? window.t('dcmOriginError') : 'Open on localnotes-three.vercel.app') + '</span>';
                        okBtn.disabled = true;
                    } else {
                        status.innerHTML = '<span class="dcm-invalid"><i class="bi bi-x-circle-fill"></i> ' + (window.t ? window.t('dcmWrongPassword') : 'Wrong password') + '</span>';
                    }
                    okBtn.classList.remove('dcm-ready');
                }
            }, 600);
        });

        const close = () => { if (ov.parentNode) document.body.removeChild(ov); };

        okBtn.addEventListener('click', async () => {
            const pw = pwInput.value.trim();
            if (!pw) { status.innerHTML = '<span class="dcm-invalid"><i class="bi bi-exclamation-circle"></i> ' + (window.t ? window.t('dcmEnterPassword') : 'Enter a password') + '</span>'; pwInput.focus(); return; }
            okBtn.disabled = true;
            okBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> ' + (window.t ? window.t('dcmDecrypting') : 'Decrypting...');
            try {
                let parsed;
                try { parsed = JSON.parse(fileText); } catch { parsed = null; }
                const data = parsed ? (parsed.data || fileText) : fileText;
                const content = (await encryption.decrypt(data, pw)).replace(/<!-- Exported on [\d-T:.Z]+ -->\n?/, '').trim();
                close();
                onSubmit(content);
            } catch (err) {
                okBtn.disabled = false;
                okBtn.innerHTML = '<i class="bi bi-unlock"></i> ' + (window.t ? window.t('dcmDecrypt') : 'Decrypt');
                if (err && err.code === 'ORIGIN_MISMATCH') {
                    status.innerHTML = '<span class="dcm-invalid"><i class="bi bi-shield-x"></i> ' + (window.t ? window.t('dcmOriginError') : 'Open on localnotes-three.vercel.app') + '</span>';
                    okBtn.disabled = true;
                } else {
                    status.innerHTML = '<span class="dcm-invalid"><i class="bi bi-x-circle-fill"></i> ' + (window.t ? window.t('dcmWrongPasswordRetry') : 'Wrong password — try again') + '</span>';
                    pwInput.select(); pwInput.focus();
                }
            }
        });

        skipBtn.addEventListener('click', () => { close(); onSkip(); });

        // Enter key submits
        pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') okBtn.click(); });
    }

    async function processNext(index) {
        if (index >= fileList.length) {
            await loadNotes();
            if (imported > 0) {
                let msg = typeof t === 'function' ? t('importCompleted', { count: imported }) : `Imported ${imported} notes`;
                if (skipped > 0) msg += ' · ' + (typeof t === 'function' ? t('importSkipped', { count: skipped }) || `Skipped: ${skipped}` : `Skipped: ${skipped}`);
                if (errors > 0)  msg += ' · ' + (typeof t === 'function' ? t('importErrors', { count: errors }) || `Errors: ${errors}` : `Errors: ${errors}`);
                showCustomAlert(typeof t === 'function' ? t('success') : 'Success', msg, errors > 0 ? 'warning' : 'success');
            } else {
                showCustomAlert(typeof t === 'function' ? t('error') : 'Error',
                    typeof t === 'function' ? t('errorNoFilesImported') : 'No files imported', 'error');
            }
            return;
        }

        const file     = fileList[index];
        const fileText = await file.text();

        showDecryptModal(file, fileText, index, fileList.length,
            async (content) => {
                try {
                    await notesDB.saveNote({
                        id: secureNoteId(),
                        content, creationTime: Date.now(), lastModified: Date.now(),
                        title: notesDB.extractTitle(content)
                    });
                    imported++;
                } catch (e) { errors++; }
                await processNext(index + 1);
            },
            async () => { skipped++; await processNext(index + 1); }
        );
    }

    await processNext(0);
}

// ============================================================================
// EVENT LISTENERS + INITIALIZATION (from backup)
// ============================================================================
function initializeEventListeners() {
    const eventType = pointerManager.getEventType();

    const addBtn = document.getElementById('addNoteButton');
    if (addBtn) addBtn.addEventListener(eventType, e => { e.preventDefault(); openModal(); });

    const importBtn = document.getElementById('importButton');
    const importInput = document.getElementById('importInput');
    if (importBtn && importInput) importBtn.addEventListener(eventType, e => { e.preventDefault(); importInput.click(); });
    if (importInput) importInput.addEventListener('change', importNotesWithFormat);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterNotes);
        // Keyboard shortcuts handled inside initSearchTagAutocomplete
    }
    initSearchTagAutocomplete();

    const clearBtn = document.getElementById('clearAllButton');
    if (clearBtn) clearBtn.addEventListener('click', showClearAllConfirmationModal);

    const quickEditBtn = document.getElementById('quickEditToggle');
    if (quickEditBtn) quickEditBtn.addEventListener('click', toggleQuickEditMode);

    // App Lock button: tap = lock now (if enabled), hold / right-click = settings
    const lockBtn = document.getElementById('appLockBtn');
    if (lockBtn) {
        const LONG_PRESS_MS = 500;
        const HOLD_CLASS = 'ln-lock-holding';
        const HOLD_DONE_CLASS = 'ln-lock-hold-complete';
        lockBtn.style.setProperty('--ln-lock-hold-ms', `${LONG_PRESS_MS}ms`);

        let longPressTimer = null;
        let longPressTriggered = false;

        const resetHoldVisual = () => {
            lockBtn.classList.remove(HOLD_CLASS, HOLD_DONE_CLASS);
        };

        const startHoldVisual = () => {
            resetHoldVisual();
            void lockBtn.offsetWidth;
            lockBtn.classList.add(HOLD_CLASS);
        };

        const completeHoldVisual = () => {
            lockBtn.classList.remove(HOLD_CLASS);
            lockBtn.classList.add(HOLD_DONE_CLASS);
        };

        const updateLockBtn = () => {
            resetHoldVisual();
            const enabled = window.AppLock && window.AppLock.isEnabled();
            lockBtn.classList.toggle('ln-lock-active', !!enabled);
            const label = (typeof t === 'function' ? t('appLockBtn') : null) || 'Lock';
            lockBtn.innerHTML = enabled
                ? `<i class="bi bi-shield-lock-fill"></i> ${label}`
                : `<i class="bi bi-shield-lock"></i> ${label}`;
            const titleHint = (typeof t === 'function' ? t('lockNowTitle') : null)
                || 'Tap to lock. Hold or right-click for settings.';
            lockBtn.title = enabled ? titleHint : ((typeof t === 'function' ? t('lockSettingsTitle') : null) || 'App Lock');
        };
        updateLockBtn();

        const openLockSettings = () => {
            if (!window.AppLock) return;
            window.AppLock.openSettings();
            const poll = setInterval(() => {
                if (!document.getElementById('ln-lock-settings-modal')) {
                    updateLockBtn();
                    clearInterval(poll);
                }
            }, 300);
        };

        const clearLongPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            resetHoldVisual();
        };

        lockBtn.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            longPressTriggered = false;
            clearLongPress();
            if (window.AppLock?.isEnabled()) {
                startHoldVisual();
                longPressTimer = setTimeout(() => {
                    longPressTriggered = true;
                    completeHoldVisual();
                    openLockSettings();
                }, LONG_PRESS_MS);
            }
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
            lockBtn.addEventListener(evt, clearLongPress);
        });

        lockBtn.addEventListener('click', (e) => {
            if (longPressTriggered) {
                longPressTriggered = false;
                e.preventDefault();
                return;
            }
            if (!window.AppLock) return;
            if (window.AppLock.isEnabled()) {
                window.AppLock.lockNow();
            } else {
                openLockSettings();
            }
        });

        lockBtn.addEventListener('contextmenu', (e) => {
            if (!window.AppLock?.isEnabled()) return;
            e.preventDefault();
            clearLongPress();
            completeHoldVisual();
            openLockSettings();
        });

        window._updateLockBtn = updateLockBtn;
    }

    // Calendar button
    const calBtn = document.getElementById('calendarBtn');
    if (calBtn) calBtn.addEventListener('click', () => {
        if (typeof openCalendar === 'function') openCalendar();
    });

    const cancelBtn = document.getElementById('cancelNoteButton');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        const modal = document.getElementById('editModal');
        if (modal) modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        const savedY = parseInt(document.body.dataset.scrollY || '0', 10);
        window.scrollTo(0, savedY);
        delete document.body.dataset.scrollY;
        currentNoteId = null;
        if (typeof localNotesEditorInstance !== 'undefined' && localNotesEditorInstance) {
            if (typeof localNotesEditorInstance._removeCtx === 'function') localNotesEditorInstance._removeCtx();
            localNotesEditorInstance.setContent('');
        }
    });

    // Close modal on backdrop click
    const editModal = document.getElementById('editModal');
    if (editModal) editModal.addEventListener('click', e => {
        if (e.target === editModal) {
            editModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            const savedY = parseInt(document.body.dataset.scrollY || '0', 10);
            window.scrollTo(0, savedY);
            delete document.body.dataset.scrollY;
            currentNoteId = null;
            if (typeof localNotesEditorInstance !== 'undefined' && localNotesEditorInstance) {
                if (typeof localNotesEditorInstance._removeCtx === 'function') localNotesEditorInstance._removeCtx();
            }
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const m = document.getElementById('editModal'); if (m?.style.display === 'block') closeModal();
        }
    });
}

// ============================================================================
// APP INIT
// ============================================================================
(async () => {
    const notesContainer = document.getElementById('notesContainer');
    if (notesContainer) notesContainer.style.visibility = 'hidden';

    try {
        await notesDB.init();
        await notesDB.migrateFromLocalStorage();
        await loadNotes();
        restoreViewMode();
        restoreQuickEditMode();
        if (window.taskBoard) window.taskBoard.restore();
        initializeEventListeners();
        updateFooterTexts();
        updateButtonTexts();
    } catch (e) {
        console.error('❌ Init error:', e);
        if (typeof showCustomAlert === 'function') showCustomAlert(typeof t === 'function' ? t('error') : 'Error', typeof t === 'function' ? t('errorInitializingApp') : 'Error initializing app!', 'error');
    }

    const revealContent = () => {
        if (notesContainer) notesContainer.style.visibility = '';
    };

    // Tell preloader app is ready — it will call onPreloaderDone after fade
    window.onPreloaderDone = revealContent;
    window.appReady = true;

    // If preloader already removed (e.g. safety fallback fired), reveal immediately
    if (!document.getElementById('app-preloader')) revealContent();
})();

// Export for compatibility
window.loadNotes = loadNotes;
window.openModal = openModal;
window.closeModal = closeModal;
window.showCustomAlert = showCustomAlert;
window.showCustomPrompt = showCustomPrompt;
window.showExportOptions = showExportOptions;
window.showWordCount = showWordCount;
window.toggleQuickEditMode = toggleQuickEditMode;
window.filterNotes = filterNotes;
window.showWelcomeMessage = showWelcomeMessage;
window.updateWelcomeTranslations = updateWelcomeTranslations;
window.updateFooterTexts = updateFooterTexts;
window.showWelcomeInstructions = showWelcomeInstructions;
window.notesDB = notesDB;
window.encryption = encryption;
window.exportNote = exportNote;
window.importNotesWithFormat = importNotesWithFormat;
window.getCurrentNoteId = () => currentNoteId;
