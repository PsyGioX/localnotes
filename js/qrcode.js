/**
 * Minimal from-scratch QR Code encoder (ISO/IEC 18004 "Model 2").
 *
 * Deliberately narrow scope, to keep a hand-written implementation of a
 * fairly intricate spec auditable:
 *   - Byte mode only (raw 8-bit data — no need for numeric/alphanumeric/
 *     kanji modes here).
 *   - Versions 1–9 only (21×21 to 53×53 modules) — plenty for the compact
 *     pairing payload lan-sync.js builds (see its own comments), and
 *     keeps the hardcoded per-version tables below to a size that's
 *     actually checkable by hand against the published standard, rather
 *     than transcribing the full 1–40 table blind.
 *   - Error-correction level L only, and a single fixed mask pattern (0)
 *     rather than evaluating all eight and scoring them — any valid mask
 *     works for a generic QR reader, the "best" mask only matters for
 *     print-quality edge cases, and skipping the scoring step removes a
 *     whole category of subtle bugs from a component that's inherently
 *     hard to test without a physical camera.
 *
 * Everything that has a closed-form algorithm (Galois-field arithmetic,
 * the Reed–Solomon generator polynomial, format/version info via BCH
 * codes) is computed at runtime rather than hardcoded, specifically to
 * shrink the amount of "trust me, this table is right" surface area to
 * the two tables that are genuinely just fixed standard data: per-version
 * capacity/block structure, and alignment-pattern positions.
 *
 * This code has not been tested against a physical camera/scanner in the
 * environment it was written in. lan-sync.js always offers the plain-text
 * version of the same code as a fallback for exactly this reason — if a
 * generated QR code doesn't scan, or a specific browser/phone struggles
 * with it, the text path uses the same underlying data and is unaffected.
 *
 * Exposes window.QrEncoder = { encode(Uint8Array) -> { size, matrix } }
 * where matrix is a size×size array of 0/1 (1 = dark module).
 */
(function () {
    'use strict';

    // ── GF(256) arithmetic (primitive polynomial 0x11D, generator 2) ───────
    var GF_EXP = new Uint8Array(512);
    var GF_LOG = new Uint8Array(256);
    (function buildGaloisTables() {
        var x = 1;
        for (var i = 0; i < 255; i++) {
            GF_EXP[i] = x;
            GF_LOG[x] = i;
            x <<= 1;
            if (x & 0x100) x ^= 0x11D;
        }
        for (var j = 255; j < 512; j++) GF_EXP[j] = GF_EXP[j - 255];
    })();
    function gfMul(a, b) {
        if (a === 0 || b === 0) return 0;
        return GF_EXP[GF_LOG[a] + GF_LOG[b]];
    }

    // Reed–Solomon generator polynomial for `degree` EC codewords, as an
    // array of coefficients (highest degree first), computed by repeatedly
    // multiplying (x - 2^i).
    function rsGeneratorPoly(degree) {
        var poly = [1];
        for (var i = 0; i < degree; i++) {
            var next = new Array(poly.length + 1).fill(0);
            for (var j = 0; j < poly.length; j++) {
                next[j] ^= gfMul(poly[j], 1);           // * x term (shift)
                next[j + 1] ^= gfMul(poly[j], GF_EXP[i]); // * root term
            }
            poly = next;
        }
        return poly;
    }

    // Compute EC codewords for one block of data codewords.
    function rsEncodeBlock(dataBytes, ecCount) {
        var generator = rsGeneratorPoly(ecCount);
        var remainder = new Uint8Array(dataBytes.length + ecCount);
        remainder.set(dataBytes, 0);
        for (var i = 0; i < dataBytes.length; i++) {
            var coeff = remainder[i];
            if (coeff === 0) continue;
            for (var j = 0; j < generator.length; j++) {
                remainder[i + j] ^= gfMul(generator[j], coeff);
            }
        }
        return Array.prototype.slice.call(remainder, dataBytes.length);
    }

    // BCH encode: returns the `bits`-bit remainder of dividing `data` (as a
    // binary polynomial) by `generator`, both given as integers with their
    // bit-length implied by their highest set bit. Used for both format
    // info (15,5) and version info (18,6).
    function bchRemainder(data, generator, generatorDegree) {
        var d = data;
        var dataDegree = 31 - Math.clz32(d);
        while (dataDegree >= generatorDegree) {
            d ^= generator << (dataDegree - generatorDegree);
            dataDegree = d === 0 ? -1 : 31 - Math.clz32(d);
        }
        return d;
    }

    var FORMAT_GENERATOR = 0x537;      // x^10+x^8+x^5+x^4+x^2+x+1
    var FORMAT_GENERATOR_DEGREE = 10;
    var FORMAT_MASK = 0x5412;
    var VERSION_GENERATOR = 0x1F25;    // x^12+x^11+x^10+x^9+x^8+x^5+x^2+1
    var VERSION_GENERATOR_DEGREE = 12;

    function formatInfoBits(maskPattern) {
        // EC level indicator for "L" is 01.
        var data = (0x01 << 3) | maskPattern; // 5 bits: 2 EC + 3 mask
        var withZeros = data << FORMAT_GENERATOR_DEGREE;
        var rem = bchRemainder(withZeros, FORMAT_GENERATOR, FORMAT_GENERATOR_DEGREE);
        return ((withZeros | rem) ^ FORMAT_MASK) & 0x7FFF; // 15 bits
    }
    function versionInfoBits(version) {
        var withZeros = version << VERSION_GENERATOR_DEGREE;
        var rem = bchRemainder(withZeros, VERSION_GENERATOR, VERSION_GENERATOR_DEGREE);
        return (withZeros | rem) & 0x3FFFF; // 18 bits
    }

    // ── per-version tables (Level L only, versions 1-9) ─────────────────────
    // [dataCodewords, ecCodewordsPerBlock, [[blockCount, dataCodewordsPerBlock], ...]]
    var VERSION_TABLE = {
        1: { data: 19, ec: 7, blocks: [[1, 19]] },
        2: { data: 34, ec: 10, blocks: [[1, 34]] },
        3: { data: 55, ec: 15, blocks: [[1, 55]] },
        4: { data: 80, ec: 20, blocks: [[1, 80]] },
        5: { data: 108, ec: 26, blocks: [[1, 108]] },
        6: { data: 136, ec: 18, blocks: [[2, 68]] },
        7: { data: 156, ec: 20, blocks: [[2, 78]] },
        8: { data: 194, ec: 24, blocks: [[2, 97]] },
        9: { data: 232, ec: 30, blocks: [[2, 116]] }
    };
    var ALIGNMENT_POSITIONS = {
        1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
        6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46]
    };

    function moduleCount(version) { return 17 + 4 * version; }

    // ── data codeword construction (byte mode) ──────────────────────────────
    function buildDataCodewords(version, bytes) {
        var table = VERSION_TABLE[version];
        var capacity = table.data;
        // Mode indicator (0100 = byte mode) + character count indicator.
        // Versions 1-9 use an 8-bit count indicator for byte mode.
        var bits = [];
        function pushBits(value, len) {
            for (var i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
        }
        pushBits(0x4, 4);
        pushBits(bytes.length, 8);
        for (var i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);

        // Terminator (up to 4 bits) then pad to a byte boundary.
        var capacityBits = capacity * 8;
        for (var t = 0; t < 4 && bits.length < capacityBits; t++) bits.push(0);
        while (bits.length % 8 !== 0) bits.push(0);

        var codewords = [];
        for (var b = 0; b < bits.length; b += 8) {
            var byte = 0;
            for (var k = 0; k < 8; k++) byte = (byte << 1) | bits[b + k];
            codewords.push(byte);
        }
        // Pad codewords with the standard alternating pad bytes.
        var padToggle = true;
        while (codewords.length < capacity) {
            codewords.push(padToggle ? 0xEC : 0x11);
            padToggle = !padToggle;
        }
        return codewords;
    }

    function interleave(version, dataCodewords) {
        var table = VERSION_TABLE[version];
        var blocks = [];
        var offset = 0;
        table.blocks.forEach(function (group) {
            var count = group[0], size = group[1];
            for (var i = 0; i < count; i++) {
                var block = dataCodewords.slice(offset, offset + size);
                offset += size;
                var ec = rsEncodeBlock(block, table.ec);
                blocks.push({ data: block, ec: ec });
            }
        });
        var maxData = Math.max.apply(null, blocks.map(function (b) { return b.data.length; }));
        var out = [];
        for (var i = 0; i < maxData; i++) {
            blocks.forEach(function (b) { if (i < b.data.length) out.push(b.data[i]); });
        }
        for (var j = 0; j < table.ec; j++) {
            blocks.forEach(function (b) { out.push(b.ec[j]); });
        }
        return out;
    }

    // ── module matrix construction ───────────────────────────────────────────
    function buildMatrix(version, finalCodewords) {
        var size = moduleCount(version);
        var matrix = [];
        var reserved = [];
        for (var r = 0; r < size; r++) {
            matrix.push(new Array(size).fill(0));
            reserved.push(new Array(size).fill(false));
        }

        function set(r, c, val, isReserved) {
            if (r < 0 || r >= size || c < 0 || c >= size) return;
            matrix[r][c] = val ? 1 : 0;
            if (isReserved) reserved[r][c] = true;
        }
        function reserveOnly(r, c) {
            if (r < 0 || r >= size || c < 0 || c >= size) return;
            reserved[r][c] = true;
        }

        function drawFinder(topR, topC) {
            for (var r = -1; r <= 7; r++) {
                for (var c = -1; c <= 7; c++) {
                    var rr = topR + r, cc = topC + c;
                    if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
                    var isBorder = r === -1 || r === 7 || c === -1 || c === 7;
                    var inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
                        (r === 0 || r === 6 || c === 0 || c === 6);
                    var inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
                    set(rr, cc, !isBorder && (inRing || inCore), true);
                }
            }
        }
        drawFinder(0, 0);
        drawFinder(0, size - 7);
        drawFinder(size - 7, 0);

        // Timing patterns.
        for (var i = 8; i < size - 8; i++) {
            set(6, i, i % 2 === 0, true);
            set(i, 6, i % 2 === 0, true);
        }

        // Alignment patterns (skip any centered inside a finder+separator zone).
        var positions = ALIGNMENT_POSITIONS[version];
        function overlapsFinder(r, c) {
            return (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
        }
        positions.forEach(function (pr) {
            positions.forEach(function (pc) {
                if (overlapsFinder(pr, pc)) return;
                for (var r = -2; r <= 2; r++) {
                    for (var c = -2; c <= 2; c++) {
                        var ring = Math.max(Math.abs(r), Math.abs(c));
                        set(pr + r, pc + c, ring !== 1, true);
                    }
                }
            });
        });

        // Dark module — always present, always on.
        set(4 * version + 9, 8, true, true);

        // Reserve format-info areas (values filled in after masking, since
        // format info encodes which mask was used).
        for (var f = 0; f <= 8; f++) {
            if (f !== 6) { reserveOnly(8, f); reserveOnly(f, 8); }
        }
        for (var g = 0; g < 8; g++) {
            reserveOnly(8, size - 1 - g);
            reserveOnly(size - 1 - g, 8);
        }

        // Reserve version-info areas (version 7+).
        if (version >= 7) {
            for (var vr = 0; vr < 6; vr++) {
                for (var vc = 0; vc < 3; vc++) {
                    reserveOnly(vr, size - 11 + vc);
                    reserveOnly(size - 11 + vc, vr);
                }
            }
        }

        // Place data bits in the standard zig-zag, skipping the timing column.
        var bitIndex = 0;
        var totalBits = finalCodewords.length * 8;
        function nextBit() {
            if (bitIndex >= totalBits) return 0;
            var codeword = finalCodewords[bitIndex >> 3];
            var bit = (codeword >> (7 - (bitIndex & 7))) & 1;
            bitIndex++;
            return bit;
        }

        var col = size - 1;
        var upward = true;
        while (col > 0) {
            if (col === 6) col--; // timing column has no data
            for (var stepIdx = 0; stepIdx < size; stepIdx++) {
                var row = upward ? size - 1 - stepIdx : stepIdx;
                for (var dc = 0; dc < 2; dc++) {
                    var c2 = col - dc;
                    if (!reserved[row][c2]) {
                        var bitVal = nextBit();
                        // Fixed mask 0: invert bit where (row+col) is even.
                        var masked = ((row + c2) % 2 === 0) ? (bitVal ^ 1) : bitVal;
                        set(row, c2, masked, false);
                    }
                }
            }
            upward = !upward;
            col -= 2;
        }

        // Write format info (mask pattern is fixed to 0).
        var fBits = formatInfoBits(0);
        var formatCoords1 = [[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],[8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]];
        for (var fi = 0; fi < 15; fi++) {
            var bitv = (fBits >> (14 - fi)) & 1;
            set(formatCoords1[fi][0], formatCoords1[fi][1], !!bitv, true);
        }
        var formatCoords2 = [];
        for (var a = 0; a < 8; a++) formatCoords2.push([size - 1 - a, 8]);
        for (var b2 = 0; b2 < 7; b2++) formatCoords2.push([8, size - 7 + b2]);
        for (var fi2 = 0; fi2 < 8; fi2++) set(formatCoords2[fi2][0], formatCoords2[fi2][1], !!((fBits >> (14 - fi2)) & 1), true);
        for (var fi3 = 0; fi3 < 7; fi3++) set(formatCoords2[8 + fi3][0], formatCoords2[8 + fi3][1], !!((fBits >> (6 - fi3)) & 1), true);

        // Write version info (version 7+).
        if (version >= 7) {
            var vBits = versionInfoBits(version);
            for (var vi = 0; vi < 18; vi++) {
                var bitv2 = (vBits >> vi) & 1;
                var vr2 = vi % 3, vc2 = Math.floor(vi / 3);
                set(vr2, size - 11 + vc2, !!bitv2, true);
                set(size - 11 + vc2, vr2, !!bitv2, true);
            }
        }

        return matrix;
    }

    function encode(bytes) {
        if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
        var version = null;
        for (var v = 1; v <= 9; v++) {
            // Capacity minus mode(4 bits)+count(8 bits) header, in bytes.
            var usableBytes = VERSION_TABLE[v].data - Math.ceil(12 / 8);
            if (bytes.length <= usableBytes) { version = v; break; }
        }
        if (!version) {
            throw new Error('Payload too large for this QR encoder (max ~' +
                (VERSION_TABLE[9].data - 2) + ' bytes, got ' + bytes.length + ').');
        }
        var dataCodewords = buildDataCodewords(version, bytes);
        var finalCodewords = interleave(version, dataCodewords);
        var matrix = buildMatrix(version, finalCodewords);
        return { size: moduleCount(version), matrix: matrix };
    }

    window.QrEncoder = { encode: encode };
})();
