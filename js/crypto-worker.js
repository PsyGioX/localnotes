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
// ============================================================================
// CRYPTO WORKER — весь pipeline в отдельном потоке, UI не блокируется
// op = 'encrypt' | 'decrypt'
// ============================================================================

// ── Утилиты ──────────────────────────────────────────────────────────────────
const zeroize = (...bufs) => {
    for (const b of bufs) {
        if (b instanceof Uint8Array) b.fill(0);
        else if (b instanceof ArrayBuffer) new Uint8Array(b).fill(0);
    }
};

// ── KDF: PBKDF2-SHA-512 → HKDF-SHA-512 → 2 ключа ────────────────────────────
async function deriveKeys(password, salt, originInfo) {
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
        derive('k-aes-gcm'),
        derive('k-hmac-512', 512),
    ]);
    zeroize(baseBits);
    const encKey = await crypto.subtle.importKey('raw', new Uint8Array(encBits), 'AES-GCM', false, ['encrypt', 'decrypt']);
    const macKey = await crypto.subtle.importKey('raw', new Uint8Array(macBits), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign', 'verify']);
    return { encKey, macKey };
}

// ── MAGIC / FORMAT ────────────────────────────────────────────────────────────
const MAGIC = new Uint8Array([0x4E, 0x56, 0x35, 0x00]); // v5: NV5\x00
const FORMAT_VERSION = 5;

function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf); let b = '';
    for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
    return btoa(b);
}
function base64ToArrayBuffer(b64) {
    const b = atob(b64), bytes = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
    return bytes.buffer;
}
function generateRandomBytes(n) {
    const a = new Uint8Array(n); crypto.getRandomValues(a); return a;
}

// ── FORMAT v5 ─────────────────────────────────────────────────────────────────
// magic(4) | version(1) | salt(32) | iv(12) | hmac(64) | cipher
// Total header = 113 bytes
// Pipeline: AES-256-GCM → HMAC-SHA-512 (Encrypt-then-MAC)
// Simple, correct, fast.

async function encryptV5(text, password, originInfo) {
    const salt  = generateRandomBytes(32);
    const iv    = generateRandomBytes(12);
    const plain = new TextEncoder().encode(text);

    const { encKey, macKey } = await deriveKeys(password, salt, originInfo);

    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encKey, plain);
    const cipher = new Uint8Array(cipherBuf);

    // Header: magic(4) + version(1) + salt(32) + iv(12) = 49 bytes
    const header = new Uint8Array(49);
    header.set(MAGIC, 0);
    header[4] = FORMAT_VERSION;
    header.set(salt, 5);
    header.set(iv, 37);

    // HMAC over header + cipher
    const macInput = new Uint8Array(49 + cipher.length);
    macInput.set(header, 0);
    macInput.set(cipher, 49);
    const hmacTag = new Uint8Array(await crypto.subtle.sign('HMAC', macKey, macInput));

    // Output: header(49) + hmac(64) + cipher
    const out = new Uint8Array(49 + 64 + cipher.length);
    out.set(header,  0);
    out.set(hmacTag, 49);
    out.set(cipher,  113);

    zeroize(cipher);
    return arrayBufferToBase64(out.buffer);
}

async function decryptV5(combined, password, originInfo) {
    const salt    = combined.slice(5,  37);
    const iv      = combined.slice(37, 49);
    const hmacTag = combined.slice(49, 113);
    const cipher  = combined.slice(113);

    const { encKey, macKey } = await deriveKeys(password, salt, originInfo);

    // Verify HMAC before decrypting
    const header   = combined.slice(0, 49);
    const macInput = new Uint8Array(49 + cipher.length);
    macInput.set(header, 0);
    macInput.set(cipher, 49);

    const valid = await crypto.subtle.verify('HMAC', macKey, hmacTag, macInput);
    if (!valid) throw new Error('Integrity check failed — wrong password or tampered data');

    const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encKey, cipher);
    return new TextDecoder().decode(decBuf);
}

// ── Legacy v4 fallback ────────────────────────────────────────────────────────
// v4 had broken xorStream/blockShuffle — decrypt without them
async function decryptV4Legacy(combined, password, originInfo) {
    const salt    = combined.slice(5,  37);
    const iv      = combined.slice(37, 49);
    const hmacTag = combined.slice(51, 115);
    const withCanary = combined.slice(115);
    const cipher  = withCanary.length >= 8 ? withCanary.slice(0, withCanary.length - 8) : withCanary;

    // Derive all 5 keys as v4 did
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
    const [encBits, macBits] = await Promise.all([derive('k-aes-gcm'), derive('k-hmac-512', 512)]);
    zeroize(baseBits);

    const encKey = await crypto.subtle.importKey('raw', new Uint8Array(encBits), 'AES-GCM', false, ['decrypt']);
    const macKey = await crypto.subtle.importKey('raw', new Uint8Array(macBits), { name: 'HMAC', hash: 'SHA-512' }, false, ['verify']);

    // Verify HMAC
    const macInput = new Uint8Array(51 + cipher.length);
    macInput.set(combined.slice(0, 51), 0);
    macInput.set(cipher, 51);
    const valid = await crypto.subtle.verify('HMAC', macKey, hmacTag, macInput);
    if (!valid) throw new Error('Integrity check failed — wrong password or tampered data');

    // AES decrypt — v4 encrypted: xorStream(blockShuffle(plain+pad))
    // We can't reverse xorStream/blockShuffle reliably, so just decrypt AES
    // and strip padding if present, otherwise return raw
    const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encKey, cipher);
    const decBytes = new Uint8Array(decBuf);

    // Try to strip zero-padding (last 2 bytes = padLen)
    if (decBytes.length >= 2) {
        const padLen = (decBytes[decBytes.length - 2] << 8) | decBytes[decBytes.length - 1];
        if (padLen >= 1 && padLen <= 64 && decBytes.length >= padLen + 2) {
            return new TextDecoder().decode(decBytes.slice(0, decBytes.length - padLen - 2));
        }
    }
    return new TextDecoder().decode(decBytes);
}

// ── v3 fallback ───────────────────────────────────────────────────────────────
async function decryptV3(combined, password) {
    const salt = combined.slice(1, 17), iv = combined.slice(17, 29);
    const pepper = combined.slice(29, 33), hmacTag = combined.slice(33, 65);
    const cipher = combined.slice(65);

    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const baseBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, baseKey, 512);
    const hkdfKey = await crypto.subtle.importKey('raw', baseBits, 'HKDF', false, ['deriveBits']);
    const [encBits, macBits] = await Promise.all([
        crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('enc-key-v3'), info: new Uint8Array(0) }, hkdfKey, 256),
        crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('mac-key-v3'), info: new Uint8Array(0) }, hkdfKey, 256),
    ]);
    const encKey = await crypto.subtle.importKey('raw', encBits, 'AES-GCM', false, ['decrypt']);
    const macKey = await crypto.subtle.importKey('raw', macBits, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const aad = new Uint8Array(33 + cipher.length);
    aad.set(combined.slice(0, 33), 0); aad.set(cipher, 33);
    const valid = await crypto.subtle.verify('HMAC', macKey, hmacTag, aad);
    if (!valid) throw new Error('Integrity check failed');
    const decBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encKey, cipher);
    const decBytes = new Uint8Array(decBuf);
    // v3 LCG xorScramble
    const pepperSeed = (pepper[0] << 24 | pepper[1] << 16 | pepper[2] << 8 | pepper[3]) >>> 0;
    const out = new Uint8Array(decBytes.length);
    let s = pepperSeed;
    for (let i = 0; i < decBytes.length; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        out[i] = decBytes[i] ^ (s & 0xff);
    }
    return new TextDecoder().decode(out);
}

// ── v2 legacy ─────────────────────────────────────────────────────────────────
async function decryptV2(combined, password) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: combined.slice(0, 16), iterations: 100000, hash: 'SHA-256' }, km, 256);
    const key = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt']);
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(16, 28) }, key, combined.slice(28));
    return new TextDecoder().decode(dec);
}

// ── Main dispatch ─────────────────────────────────────────────────────────────
async function decrypt(encData, password, originInfo) {
    const combined = new Uint8Array(base64ToArrayBuffer(encData));

    // v5 (current)
    if (combined.length > 4 &&
        combined[0] === MAGIC[0] && combined[1] === MAGIC[1] &&
        combined[2] === MAGIC[2] && combined[3] === MAGIC[3] &&
        combined[4] === FORMAT_VERSION) {
        return decryptV5(combined, password, originInfo);
    }

    // v4 (broken xorStream — special handling)
    const V4_MAGIC = new Uint8Array([0x4E, 0x56, 0x34, 0x00]);
    if (combined.length > 4 &&
        combined[0] === V4_MAGIC[0] && combined[1] === V4_MAGIC[1] &&
        combined[2] === V4_MAGIC[2] && combined[3] === V4_MAGIC[3] &&
        combined[4] === 4) {
        return decryptV4Legacy(combined, password, originInfo);
    }

    // v3
    if (combined[0] === 3) return decryptV3(combined, password);

    // v2 legacy
    return decryptV2(combined, password);
}

// ── Message handler ───────────────────────────────────────────────────────────
self.onmessage = async ({ data }) => {
    const { id, op, password, originInfo } = data;
    const info = new Uint8Array(originInfo);
    try {
        if (op === 'encrypt') {
            const result = await encryptV5(data.text, password, info);
            self.postMessage({ id, result });
        } else if (op === 'decrypt') {
            const result = await decrypt(data.encData, password, info);
            self.postMessage({ id, result });
        }
    } catch (err) {
        self.postMessage({ id, error: err.message });
    }
};
