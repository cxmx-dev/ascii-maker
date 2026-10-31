'use strict';

/**
 * PETSCII mode for ascii-maker: C64 40x25 hi-res text screen.
 * Glyph bitmaps below are hand-defined 8x8 look-alikes (no ROM data).
 * Palette: Pepto (PAL) C64 colours.
 * Works in the browser (window.PETSCII) and in Node (module.exports) for tests.
 */
var PETSCII = (function () {
  var PALETTE = [
    '#000000', '#ffffff', '#68372b', '#70a4b2', '#6f3d86', '#588d43', '#352879', '#b8c76f',
    '#6f4f25', '#433900', '#9a6759', '#444444', '#6c6c6c', '#9ad284', '#6c5eb5', '#959595'
  ];
  var NAMES = ['Black', 'White', 'Red', 'Cyan', 'Purple', 'Green', 'Blue', 'Yellow',
    'Orange', 'Brown', 'Light red', 'Dark grey', 'Grey', 'Light green', 'Light blue', 'Light grey'];
  var RGB = PALETTE.map(function (h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; });

  function hx(s) { return s.split(' ').map(function (b) { return parseInt(b, 16); }); }
  // Shared screen codes 32-63 (space, punctuation, digits)
  var PUNCT = {
    32: '00 00 00 00 00 00 00 00', 33: '18 18 18 18 00 00 18 00', 34: '66 66 66 00 00 00 00 00',
    35: '66 66 FF 66 FF 66 66 00', 36: '18 3E 60 3C 06 7C 18 00', 37: '62 66 0C 18 30 66 46 00',
    38: '3C 66 3C 38 67 66 3F 00', 39: '06 0C 18 00 00 00 00 00', 40: '0C 18 30 30 30 18 0C 00',
    41: '30 18 0C 0C 0C 18 30 00', 42: '00 66 3C FF 3C 66 00 00', 43: '00 18 18 7E 18 18 00 00',
    44: '00 00 00 00 00 18 18 30', 45: '00 00 00 7E 00 00 00 00', 46: '00 00 00 00 00 18 18 00',
    47: '00 03 06 0C 18 30 60 00', 48: '3C 66 6E 76 66 66 3C 00', 49: '18 18 38 18 18 18 7E 00',
    50: '3C 66 06 0C 30 60 7E 00', 51: '3C 66 06 1C 06 66 3C 00', 52: '06 0E 1E 66 7F 06 06 00',
    53: '7E 60 7C 06 06 66 3C 00', 54: '3C 66 60 7C 66 66 3C 00', 55: '7E 66 0C 18 18 18 18 00',
    56: '3C 66 66 3C 66 66 3C 00', 57: '3C 66 66 3E 06 66 3C 00', 58: '00 00 18 00 00 18 00 00',
    59: '00 00 18 00 00 18 18 30', 60: '0E 18 30 60 30 18 0E 00', 61: '00 00 7E 00 7E 00 00 00',
    62: '70 18 0C 06 0C 18 70 00', 63: '3C 66 06 0C 18 00 18 00',
    0: '3C 66 6E 6E 60 62 3C 00', 27: '3C 30 30 30 30 30 3C 00', 28: '0C 12 30 7C 30 62 FC 00',
    29: '3C 0C 0C 0C 0C 0C 3C 00', 30: '00 18 3C 7E 18 18 18 18', 31: '00 10 30 7F 7F 30 10 00'
  };
  var UPPER = ['18 3C 66 7E 66 66 66 00', '7C 66 66 7C 66 66 7C 00', '3C 66 60 60 60 66 3C 00',
    '78 6C 66 66 66 6C 78 00', '7E 60 60 78 60 60 7E 00', '7E 60 60 78 60 60 60 00', '3C 66 60 6E 66 66 3C 00',
    '66 66 66 7E 66 66 66 00', '3C 18 18 18 18 18 3C 00', '1E 0C 0C 0C 0C 6C 38 00', '66 6C 78 70 78 6C 66 00',
    '60 60 60 60 60 60 7E 00', '63 77 7F 6B 63 63 63 00', '66 76 7E 7E 6E 66 66 00', '3C 66 66 66 66 66 3C 00',
    '7C 66 66 7C 60 60 60 00', '3C 66 66 66 66 3C 0E 00', '7C 66 66 7C 78 6C 66 00', '3C 66 60 3C 06 66 3C 00',
    '7E 18 18 18 18 18 18 00', '66 66 66 66 66 66 3C 00', '66 66 66 66 66 3C 18 00', '63 63 63 6B 7F 77 63 00',
    '66 66 3C 18 3C 66 66 00', '66 66 66 3C 18 18 18 00', '7E 06 0C 18 30 60 7E 00'];
  var LOWER = ['00 00 3C 06 3E 66 3E 00', '00 60 60 7C 66 66 7C 00', '00 00 3C 60 60 60 3C 00',
    '00 06 06 3E 66 66 3E 00', '00 00 3C 66 7E 60 3C 00', '00 0E 18 3E 18 18 18 00', '00 00 3E 66 66 3E 06 7C',
    '00 60 60 7C 66 66 66 00', '00 18 00 38 18 18 3C 00', '00 06 00 06 06 06 3C 00', '00 60 60 6C 78 6C 66 00',
    '00 38 18 18 18 18 3C 00', '00 00 66 7F 7F 6B 63 00', '00 00 7C 66 66 66 66 00', '00 00 3C 66 66 66 3C 00',
    '00 00 7C 66 66 7C 60 60', '00 00 3E 66 66 3E 06 06', '00 00 7C 66 60 60 60 00', '00 00 3E 60 3C 06 7C 00',
    '00 18 7E 18 18 18 0E 00', '00 00 66 66 66 66 3E 00', '00 00 66 66 66 3C 18 00', '00 00 63 6B 7F 3E 36 00',
    '00 00 66 3C 18 3C 66 00', '00 00 66 66 66 3E 0C 78', '00 00 7E 0C 18 30 7E 00'];

  // Geometric graphics built from rules (rows of 8 bits, MSB = left pixel)
  function rect(x0, y0, x1, y1) { // inclusive-exclusive cell rect
    var b = [], y, x, r;
    for (y = 0; y < 8; y++) { r = 0; for (x = 0; x < 8; x++) if (x >= x0 && x < x1 && y >= y0 && y < y1) r |= 0x80 >> x; b.push(r); }
    return b;
  }
  function or() { var o = [0, 0, 0, 0, 0, 0, 0, 0]; for (var a = 0; a < arguments.length; a++) for (var i = 0; i < 8; i++) o[i] |= arguments[a][i]; return o; }
  function fn(f) { var b = [], y, x, r; for (y = 0; y < 8; y++) { r = 0; for (x = 0; x < 8; x++) if (f(x, y)) r |= 0x80 >> x; b.push(r); } return b; }
  var HL = rect(0, 3, 8, 5), VL = rect(3, 0, 5, 8);
  var GFX = { // screen codes 96-127 (same in both charsets except 105/122)
    96: rect(0, 0, 0, 0), 97: rect(0, 0, 4, 8), 98: rect(0, 4, 8, 8), 99: rect(0, 0, 8, 1), 100: rect(0, 7, 8, 8),
    101: rect(0, 0, 1, 8), 102: fn(function (x, y) { return ((x >> 0) + y) % 2 === 0; }), 103: rect(7, 0, 8, 8),
    104: fn(function (x, y) { return y >= 4 && (x + y) % 2 === 0; }), 105: fn(function (x, y) { return x + y < 8; }),
    106: rect(6, 0, 8, 8), 107: or(VL, rect(3, 3, 8, 5)), 108: rect(4, 4, 8, 8), 109: or(rect(3, 0, 5, 5), rect(3, 3, 8, 5)),
    110: or(rect(0, 3, 5, 5), rect(3, 3, 5, 8)), 111: rect(0, 6, 8, 8), 112: or(rect(3, 3, 8, 5), rect(3, 3, 5, 8)),
    113: or(HL, rect(3, 0, 5, 5)), 114: or(HL, rect(3, 3, 5, 8)), 115: or(VL, rect(0, 3, 5, 5)), 116: rect(0, 0, 2, 8),
    117: rect(0, 0, 3, 8), 118: rect(5, 0, 8, 8), 119: rect(0, 0, 8, 2), 120: rect(0, 0, 8, 3), 121: rect(0, 5, 8, 8),
    122: fn(function (x, y) { return x + y >= 7; }), 123: rect(0, 4, 4, 8), 124: rect(4, 0, 8, 4),
    125: or(rect(0, 3, 5, 5), rect(3, 0, 5, 5)), 126: rect(0, 0, 4, 4), 127: or(rect(0, 0, 4, 4), rect(4, 4, 8, 8))
  };
  var GFX_UP = { // 64-95 in the uppercase/graphics set (subset)
    64: HL, 66: VL, 67: HL, 91: or(HL, VL),
    77: fn(function (x, y) { return Math.abs(x - y) < 1.5; }), 78: fn(function (x, y) { return Math.abs(x + y - 7) < 1.5; }),
    86: fn(function (x, y) { return Math.abs(x - y) < 1.5 || Math.abs(x + y - 7) < 1.5; }),
    81: fn(function (x, y) { var d = (x - 3.5) * (x - 3.5) + (y - 3.5) * (y - 3.5); return d < 10; }),
    87: fn(function (x, y) { var d = (x - 3.5) * (x - 3.5) + (y - 3.5) * (y - 3.5); return d < 12 && d > 4; }),
    83: hx('36 7F 7F 7F 3E 1C 08 00'), 90: hx('08 1C 3E 7F 3E 1C 08 00'), 65: hx('08 1C 3E 7F 7F 1C 3E 00'),
    88: hx('18 18 66 66 18 18 3C 00'), 94: hx('00 03 3E 76 36 36 00 00'),
    95: fn(function (x, y) { return x >= y; }), 105: GFX[105]
  };
  var GFX_LO = { 64: HL, 91: or(HL, VL), 93: VL, 94: fn(function (x, y) { return (x + y) % 2 === 0 && y < 4; }),
    95: fn(function (x, y) { return x < y; }), 105: fn(function (x, y) { return (x + y) % 2 === 0 || x + y < 4; }),
    122: hx('00 01 03 06 6C 78 70 00') };

  // Unicode stand-ins for Copy / .txt
  var UNI = { 96: ' ', 97: '\u258c', 98: '\u2584', 99: '\u2594', 100: '\u2581', 101: '\u258f', 102: '\u2592', 103: '\u2595',
    104: '\u2592', 105: '\u25e4', 106: '\u2590', 107: '\u251c', 108: '\u2597', 109: '\u2514', 110: '\u2510', 111: '\u2582',
    112: '\u250c', 113: '\u2534', 114: '\u252c', 115: '\u2524', 116: '\u258e', 117: '\u258d', 118: '\u2590', 119: '\u2580',
    120: '\u2580', 121: '\u2583', 122: '\u25e2', 123: '\u2596', 124: '\u259d', 125: '\u2518', 126: '\u2598', 127: '\u259a',
    64: '\u2500', 66: '\u2502', 67: '\u2500', 91: '\u253c', 77: '\u2572', 78: '\u2571', 86: '\u2573', 81: '\u25cf', 87: '\u25cb',
    83: '\u2665', 90: '\u2666', 65: '\u2660', 88: '\u2663', 94: '\u03c0', 95: '\u25e5', 93: '\u2502', 0: '@', 28: '\u00a3', 30: '\u2191', 31: '\u2190', 27: '[', 29: ']' };

  /** Build {code: [8 bytes]} for 'upper' (graphics) or 'lower' charset, incl. reverse 128-255. */
  function buildSet(name) {
    var set = {}, k, i;
    for (k in PUNCT) set[k] = hx(PUNCT[k]);
    for (k in GFX) set[k] = GFX[k];
    var g2 = name === 'lower' ? GFX_LO : GFX_UP;
    for (k in g2) set[k] = g2[k];
    for (i = 0; i < 26; i++) {
      if (name === 'lower') { set[i + 1] = hx(LOWER[i]); set[i + 65] = hx(UPPER[i]); }
      else set[i + 1] = hx(UPPER[i]);
    }
    var codes = Object.keys(set).map(Number);
    codes.forEach(function (c) { set[c + 128] = set[c].map(function (b) { return (~b) & 255; }); });
    return set;
  }
  var SETS = { upper: buildSet('upper'), lower: buildSet('lower') };

  function uniFor(code, cs) {
    var rev = code >= 128, c = code & 127, ch;
    if (c >= 1 && c <= 26) ch = String.fromCharCode((cs === 'lower' ? 96 : 64) + c);
    else if (cs === 'lower' && c >= 65 && c <= 90) ch = String.fromCharCode(c);
    else if (c >= 32 && c <= 63) ch = String.fromCharCode(c);
    else ch = UNI[c] || '?';
    if (rev) ch = ch === ' ' ? '\u2588' : ch; // reverse video: best effort in plain text
    return ch;
  }

  /** Text -> screen codes (unmapped chars become space). */
  function charToCode(ch, cs) {
    var k = ch.charCodeAt(0);
    if (ch === '@') return 0;
    if (k >= 32 && k <= 63) return k;
    if (k >= 65 && k <= 90) return cs === 'lower' ? k : k - 64;
    if (k >= 97 && k <= 122) return k - 96; // lowercase letter (or uppercase glyph in upper set)
    var m = { '[': 27, '\u00a3': 28, ']': 29, '^': 30, '_': 100, '\u2588': 160, '\u2592': 102, '\u2580': 226, '\u2584': 98, '\u258c': 97, '\u2590': 225 };
    return m[ch] != null ? m[ch] : 32;
  }
  function textToScreen(text, cols, rows, cs, fg) {
    var codes = new Uint8Array(cols * rows).fill(32), colors = new Uint8Array(cols * rows).fill(fg);
    var lines = String(text).replace(/\r/g, '').split('\n'), r = 0, i, line;
    for (i = 0; i < lines.length && r < rows; i++) {
      line = Array.from(lines[i]);
      do {
        for (var c = 0; c < cols && c < line.length; c++) codes[r * cols + c] = charToCode(line[c], cs);
        line = line.slice(cols); r++;
      } while (line.length && r < rows);
    }
    return { cols: cols, rows: rows, codes: codes, colors: colors };
  }

  function dist2(r, g, b, p) { var dr = r - p[0], dg = g - p[1], db = b - p[2]; return 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db; }

  /** Pick the palette index most pixels are nearest to (auto background). */
  function autoBg(px) {
    var h = new Array(16).fill(0), i, c, best, bd, d;
    for (i = 0; i < px.length; i += 4) {
      best = 0; bd = Infinity;
      for (c = 0; c < 16; c++) { d = dist2(px[i], px[i + 1], px[i + 2], RGB[c]); if (d < bd) { bd = d; best = c; } }
      h[best]++;
    }
    return h.indexOf(Math.max.apply(null, h));
  }

  /**
   * Image -> screen. px = RGBA of (cols*8)x(rows*8). For each cell try every glyph x fg colour
   * and keep the lowest squared error against the source pixels (bg fixed per screen).
   */
  function imageToScreen(px, cols, rows, cs, bg) {
    var set = SETS[cs] || SETS.upper, W = cols * 8;
    if (bg == null || bg < 0) bg = autoBg(px);
    var glyphs = Object.keys(set).map(Number).map(function (code) {
      var bits = [], y, x;
      for (y = 0; y < 8; y++) for (x = 0; x < 8; x++) if (set[code][y] & (0x80 >> x)) bits.push(y * 8 + x);
      return { code: code, bits: bits };
    }).filter(function (g) { return g.bits.length > 0; });
    var codes = new Uint8Array(cols * rows), colors = new Uint8Array(cols * rows);
    var dBg = new Float64Array(64), delta = new Float64Array(64), r, c, p, f, gi, i, k;
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var base = 0, cellR = [], cellG = [], cellB = [];
      for (p = 0; p < 64; p++) {
        k = ((r * 8 + (p >> 3)) * W + c * 8 + (p & 7)) * 4;
        cellR[p] = px[k]; cellG[p] = px[k + 1]; cellB[p] = px[k + 2];
        dBg[p] = dist2(px[k], px[k + 1], px[k + 2], RGB[bg]); base += dBg[p];
      }
      var bestE = base, bestCode = 32, bestF = bg === 1 ? 0 : 1;
      for (f = 0; f < 16; f++) {
        if (f === bg) continue;
        var useful = false;
        for (p = 0; p < 64; p++) { delta[p] = dist2(cellR[p], cellG[p], cellB[p], RGB[f]) - dBg[p]; if (delta[p] < 0) useful = true; }
        if (!useful) continue;
        for (gi = 0; gi < glyphs.length; gi++) {
          var bits = glyphs[gi].bits, e = base;
          for (i = 0; i < bits.length; i++) e += delta[bits[i]];
          if (e < bestE) { bestE = e; bestCode = glyphs[gi].code; bestF = f; }
        }
      }
      codes[r * cols + c] = bestCode; colors[r * cols + c] = bestF;
    }
    return { cols: cols, rows: rows, codes: codes, colors: colors, bg: bg };
  }

  /** Paint screen at scale s px per C64 pixel onto ctx (with optional border in pixels). */
  function paint(ctx, scr, cs, bg, s, border) {
    var set = SETS[cs] || SETS.upper, b = border || 0, r, c, y, x;
    ctx.fillStyle = PALETTE[bg]; ctx.fillRect(0, 0, (scr.cols * 8 + b * 2) * s, (scr.rows * 8 + b * 2) * s);
    for (r = 0; r < scr.rows; r++) for (c = 0; c < scr.cols; c++) {
      var g = set[scr.codes[r * scr.cols + c]] || set[32];
      ctx.fillStyle = PALETTE[scr.colors[r * scr.cols + c]];
      for (y = 0; y < 8; y++) for (x = 0; x < 8; x++) if (g[y] & (0x80 >> x)) ctx.fillRect((b + c * 8 + x) * s, (b + r * 8 + y) * s, s, s);
    }
  }

  function toText(scr, cs) {
    var out = [], r, c, l;
    for (r = 0; r < scr.rows; r++) { l = ''; for (c = 0; c < scr.cols; c++) l += uniFor(scr.codes[r * scr.cols + c], cs); out.push(l); }
    return out.join('\n');
  }
  /** Screen RAM + colour RAM, padded to a full 40x25 screen (1000 + 1000 bytes). */
  function toBin(scr, bg) {
    var out = new Uint8Array(2000).fill(32), r, c;
    out.fill(bg & 15, 1000);
    for (r = 0; r < Math.min(25, scr.rows); r++) for (c = 0; c < Math.min(40, scr.cols); c++) {
      out[r * 40 + c] = scr.codes[r * scr.cols + c]; out[1000 + r * 40 + c] = scr.colors[r * scr.cols + c];
    }
    return out;
  }
  function toAsm(scr, bg, cs) {
    var bin = toBin(scr, bg), s = '; PETSCII screen 40x25, charset ' + (cs === 'lower' ? 'lower/upper ($d018=$17)' : 'upper/graphics ($d018=$15)') +
      '\n; background colour ' + bg + ' (' + NAMES[bg] + ')\nbgcolor !byte ' + bg + '\nscreen\n', i, j;
    for (i = 0; i < 2000; i += 40) {
      if (i === 1000) s += 'colours\n';
      var row = [];
      for (j = 0; j < 40; j++) row.push('$' + ('0' + bin[i + j].toString(16)).slice(-2));
      s += '  !byte ' + row.join(',') + '\n';
    }
    return s;
  }

  return { PALETTE: PALETTE, NAMES: NAMES, SETS: SETS, imageToScreen: imageToScreen, textToScreen: textToScreen,
    paint: paint, toText: toText, toBin: toBin, toAsm: toAsm, autoBg: autoBg, charToCode: charToCode };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PETSCII;
