'use strict';

/**
 * ascii-maker — Braille (2×4) + Unicode block / shade converters
 * BUILD: am-v4
 */

var BUILD = 'am-v4';

var MONO_STACK = '"Cascadia Code", "Consolas", "Segoe UI Symbol", "Noto Sans Symbols 2", ui-monospace, monospace';
// Browser canvas soft cap (edge px). Stay under Chrome/Edge practical limits.
var PNG_MAX_EDGE = 8192;
var PNG_MAX_AREA = 4096 * 4096;

/** Cached glyph width/height for aspect-correct row counts (per mode). */
var glyphAspectCache = {};

// ── Braille dots (Unicode U+2800): bit → position in 2×4 cell ──
//   0 3
//   1 4
//   2 5
//   6 7
var BRAILLE_BITS = [0x01, 0x02, 0x04, 0x40, 0x08, 0x10, 0x20, 0x80];

// Shade ramps (dark → light when image is dark-on-light intent; we invert via option)
var RAMP_BLOCKS = '  ░▒▓█';
var RAMP_BLOCKS_DENSE = ' ▁▂▃▄▅▆▇█';
var RAMP_ASCII = ' .:-=+*#%@';
var RAMP_ASCII_DENSE = ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';

// Half-block glyphs for 2×2 cells (bitmask topL, topR, botL, botR)
// Prefer common block elements
var HALF_MAP = {
  0: ' ',
  1: '▘',
  2: '▝',
  3: '▀',
  4: '▖',
  5: '▌',
  6: '▞',
  7: '▛',
  8: '▗',
  9: '▚',
  10: '▐',
  11: '▜',
  12: '▄',
  13: '▙',
  14: '▟',
  15: '█'
};

var state = {
  image: null,
  imageName: '',
  canvas: null,
  ctx: null,
  lastText: '',
  lastGridInfo: null,
  convertTimer: null,
  fitTimer: null,
  lastMode: 'braille'
};

function $(id) {
  return document.getElementById(id);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function luminance(r, g, b) {
  // relative luminance, 0–255 scale
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getSettings() {
  return {
    mode: $('mode').value,
    width: parseInt($('width').value, 10) || 60,
    invert: $('invert').checked,
    threshold: parseInt($('threshold').value, 10) || 128,
    contrast: parseFloat($('contrast').value) || 1,
    brightness: parseInt($('brightness').value, 10) || 0,
    dither: $('dither').checked,
    fontSize: parseInt($('fontSize').value, 10) || 10,
    exportPx: parseInt($('exportPx').value, 10) || 14,
    fitView: $('fitView') ? $('fitView').checked : true,
    darkBg: $('darkBg').checked
  };
}

function sampleGray(data, w, h, x, y, contrast, brightness) {
  x = clamp(Math.floor(x), 0, w - 1);
  y = clamp(Math.floor(y), 0, h - 1);
  var i = (y * w + x) * 4;
  var r = data[i];
  var g = data[i + 1];
  var b = data[i + 2];
  var a = data[i + 3];
  if (a < 16) return 255; // transparent → white (empty)
  var L = luminance(r, g, b);
  L = (L - 128) * contrast + 128 + brightness;
  return clamp(L, 0, 255);
}

/** Floyd–Steinberg dither helper: mutate float gray buffer */
function ditherBuffer(buf, w, h) {
  var x, y, i, old, err, neu;
  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      i = y * w + x;
      old = buf[i];
      neu = old < 128 ? 0 : 255;
      err = old - neu;
      buf[i] = neu;
      if (x + 1 < w) buf[i + 1] += err * 7 / 16;
      if (y + 1 < h) {
        if (x > 0) buf[i + w - 1] += err * 3 / 16;
        buf[i + w] += err * 5 / 16;
        if (x + 1 < w) buf[i + w + 1] += err * 1 / 16;
      }
    }
  }
}

function buildGrayGrid(imgData, srcW, srcH, outW, outH, contrast, brightness, dither) {
  var data = imgData.data;
  var grid = new Float32Array(outW * outH);
  var x, y, sx, sy;
  for (y = 0; y < outH; y++) {
    for (x = 0; x < outW; x++) {
      sx = (x + 0.5) * srcW / outW;
      sy = (y + 0.5) * srcH / outH;
      grid[y * outW + x] = sampleGray(data, srcW, srcH, sx, sy, contrast, brightness);
    }
  }
  if (dither) ditherBuffer(grid, outW, outH);
  return grid;
}

function grayAt(grid, w, h, x, y, invert) {
  if (x < 0 || y < 0 || x >= w || y >= h) return invert ? 0 : 255;
  var v = grid[y * w + x];
  return invert ? 255 - v : v;
}

function toBraille(grid, gw, gh, threshold, invert) {
  // cell 2×4 → one char; output cols = floor(gw/2), rows = floor(gh/4)
  var cols = Math.floor(gw / 2);
  var rows = Math.floor(gh / 4);
  var lines = [];
  var r, c, bits, dy, dx, px, py, g, bitIndex;
  for (r = 0; r < rows; r++) {
    var line = '';
    for (c = 0; c < cols; c++) {
      bits = 0;
      for (dy = 0; dy < 4; dy++) {
        for (dx = 0; dx < 2; dx++) {
          px = c * 2 + dx;
          py = r * 4 + dy;
          g = grayAt(grid, gw, gh, px, py, invert);
          // dark pixels → raised dots (when not inverted intent: low gray = dark)
          if (g < threshold) {
            bitIndex = dx * 4 + dy;
            bits |= BRAILLE_BITS[bitIndex];
          }
        }
      }
      line += String.fromCharCode(0x2800 + bits);
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function toHalfBlocks(grid, gw, gh, threshold, invert) {
  var cols = Math.floor(gw / 2);
  var rows = Math.floor(gh / 2);
  var lines = [];
  var r, c, mask, dx, dy, g;
  for (r = 0; r < rows; r++) {
    var line = '';
    for (c = 0; c < cols; c++) {
      mask = 0;
      // bits: 1=TL 2=TR 4=BL 8=BR
      g = grayAt(grid, gw, gh, c * 2, r * 2, invert);
      if (g < threshold) mask |= 1;
      g = grayAt(grid, gw, gh, c * 2 + 1, r * 2, invert);
      if (g < threshold) mask |= 2;
      g = grayAt(grid, gw, gh, c * 2, r * 2 + 1, invert);
      if (g < threshold) mask |= 4;
      g = grayAt(grid, gw, gh, c * 2 + 1, r * 2 + 1, invert);
      if (g < threshold) mask |= 8;
      line += HALF_MAP[mask] || ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function toRamp(grid, gw, gh, ramp, invert) {
  var lines = [];
  var y, x, g, idx, n;
  n = ramp.length;
  for (y = 0; y < gh; y++) {
    var line = '';
    for (x = 0; x < gw; x++) {
      g = grayAt(grid, gw, gh, x, y, invert);
      // low gray (dark) → denser char (end of ramp)
      idx = Math.floor((1 - g / 255) * (n - 1));
      idx = clamp(idx, 0, n - 1);
      line += ramp.charAt(idx);
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function cellAspect(mode) {
  // Source samples packed per output character (not display aspect).
  switch (mode) {
    case 'braille':
      return { cw: 2, ch: 4 };
    case 'half':
      return { cw: 2, ch: 2 };
    case 'blocks':
    case 'blocks_dense':
    case 'ascii':
    case 'ascii_dense':
      return { cw: 1, ch: 1 };
    default:
      return { cw: 2, ch: 4 };
  }
}

/**
 * Display width/height of one character in the mono stack.
 * Used so charRows keeps on-screen (and PNG) aspect = source image aspect.
 * Braille cells are 2×4 samples; mono glyphs are ~half as wide as tall → ~0.5.
 */
function measureGlyphAspect(mode) {
  if (glyphAspectCache[mode]) return glyphAspectCache[mode];

  var fontSize = 100;
  var lineMul = mode === 'braille' ? 1.05 : 1.0;
  var sample = 'M';
  if (mode === 'braille') sample = '⣿';
  else if (mode === 'half') sample = '█';
  else if (mode === 'blocks' || mode === 'blocks_dense') sample = '█';

  var fallback = 0.55;
  try {
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    if (!ctx) {
      glyphAspectCache[mode] = fallback;
      return fallback;
    }
    ctx.font = fontSize + 'px ' + MONO_STACK;
    var w = ctx.measureText(sample).width;
    var h = fontSize * lineMul;
    var a = w / h;
    // Sane clamp — broken fonts sometimes report 0 or huge
    if (!(a > 0.2 && a < 1.2)) a = fallback;
    glyphAspectCache[mode] = a;
    return a;
  } catch (e) {
    glyphAspectCache[mode] = fallback;
    return fallback;
  }
}

/**
 * Choose character grid so rendered art matches source image aspect ratio.
 *
 * displayW / displayH ≈ (charCols * glyphW) / (charRows * glyphH) = imgW / imgH
 * ⇒ charRows = charCols * (glyphW/glyphH) * (imgH/imgW)
 *
 * Sampling grid is charCols*cw by charRows*ch (image stretched into that for sampling).
 */
function computeCharGrid(mode, charCols, imgW, imgH) {
  var cells = cellAspect(mode);
  var glyphAsp = measureGlyphAspect(mode); // width / height of one glyph
  var imgAspect = imgH / Math.max(1, imgW); // height / width

  charCols = Math.max(1, charCols | 0);
  var charRows = Math.round(charCols * glyphAsp * imgAspect);
  charRows = Math.max(1, charRows);

  var gridW = charCols * cells.cw;
  var gridH = charRows * cells.ch;

  // Keep sampling grid aspect as close as possible to the image while
  // staying on whole character cells (prefer adjusting rows).
  // Ideal gridH for square samples: gridW * imgAspect
  var idealH = gridW * imgAspect;
  var snappedH = Math.max(cells.ch, Math.round(idealH / cells.ch) * cells.ch);
  // Prefer cell-aligned height that matches image; re-derive rows from that
  // when it stays consistent with glyph display aspect (±15%).
  var rowsFromSample = snappedH / cells.ch;
  var rowsFromGlyph = charRows;
  // Blend: use sample-aligned rows when close to glyph-correct rows; else glyph
  if (Math.abs(rowsFromSample - rowsFromGlyph) / Math.max(rowsFromGlyph, 1) <= 0.15) {
    charRows = rowsFromSample;
    gridH = snappedH;
  } else {
    // Trust display aspect (what User sees) — primary goal
    gridH = charRows * cells.ch;
  }

  return {
    charCols: charCols,
    charRows: charRows,
    gridW: gridW,
    gridH: gridH,
    glyphAsp: glyphAsp,
    imgAspect: imgAspect
  };
}

function convert() {
  if (!state.image || !state.canvas) {
    $('output').textContent = '';
    state.lastText = '';
    updateMeta();
    return;
  }

  var s = getSettings();
  var img = state.image;
  var charCols = clamp(s.width, 8, 300);
  var gridInfo = computeCharGrid(s.mode, charCols, img.width, img.height);
  charCols = gridInfo.charCols;
  var charRows = gridInfo.charRows;
  var gridW = gridInfo.gridW;
  var gridH = gridInfo.gridH;
  state.lastGridInfo = gridInfo;

  // Draw source scaled for sampling — cover full image into grid (no crop)
  var c = state.canvas;
  c.width = gridW;
  c.height = gridH;
  var ctx = state.ctx;
  ctx.clearRect(0, 0, gridW, gridH);
  // drawImage stretches the full source into the grid; dimensions already
  // chosen so character layout matches source aspect on screen.
  ctx.drawImage(img, 0, 0, gridW, gridH);
  var imgData = ctx.getImageData(0, 0, gridW, gridH);

  // For ramp modes with dither, dither on final char grid (1 sample per char)
  // For braille/half, dither on pixel grid
  var useDither = s.dither;
  var grid = buildGrayGrid(
    imgData, gridW, gridH, gridW, gridH,
    s.contrast, s.brightness, useDither && (s.mode === 'braille' || s.mode === 'half')
  );

  var text;
  switch (s.mode) {
    case 'braille':
      text = toBraille(grid, gridW, gridH, s.threshold, s.invert);
      break;
    case 'half':
      text = toHalfBlocks(grid, gridW, gridH, s.threshold, s.invert);
      break;
    case 'blocks':
      if (useDither) {
        var g1 = buildGrayGrid(imgData, gridW, gridH, charCols, charRows, s.contrast, s.brightness, true);
        text = toRamp(g1, charCols, charRows, RAMP_BLOCKS, s.invert);
      } else {
        var g2 = buildGrayGrid(imgData, gridW, gridH, charCols, charRows, s.contrast, s.brightness, false);
        text = toRamp(g2, charCols, charRows, RAMP_BLOCKS, s.invert);
      }
      break;
    case 'blocks_dense':
      {
        var gd = buildGrayGrid(imgData, gridW, gridH, charCols, charRows, s.contrast, s.brightness, useDither);
        text = toRamp(gd, charCols, charRows, RAMP_BLOCKS_DENSE, s.invert);
      }
      break;
    case 'ascii':
      {
        var ga = buildGrayGrid(imgData, gridW, gridH, charCols, charRows, s.contrast, s.brightness, useDither);
        text = toRamp(ga, charCols, charRows, RAMP_ASCII, s.invert);
      }
      break;
    case 'ascii_dense':
      {
        var gad = buildGrayGrid(imgData, gridW, gridH, charCols, charRows, s.contrast, s.brightness, useDither);
        text = toRamp(gad, charCols, charRows, RAMP_ASCII_DENSE, s.invert);
      }
      break;
    default:
      text = toBraille(grid, gridW, gridH, s.threshold, s.invert);
  }

  state.lastText = text;
  state.lastMode = s.mode;
  var out = $('output');
  out.textContent = text;
  out.style.lineHeight = (s.mode === 'braille' ? 1.05 : 1.0);
  // Fit mode uses a fixed measure size then scales; free mode uses slider
  if (s.fitView) {
    out.style.fontSize = '12px';
  } else {
    out.style.fontSize = s.fontSize + 'px';
  }
  document.body.classList.toggle('theme-light', !s.darkBg);
  document.body.classList.toggle('theme-dark', s.darkBg);
  document.body.classList.toggle('fit-on', s.fitView);
  updateMeta();
  updateThresholdVisibility();
  updatePreviewSizeVisibility();
  scheduleFit();
}

/** Scale the art so the whole image fits in the stage (contain). */
function fitOutputToStage() {
  var viewport = $('stageViewport');
  var wrap = $('scaleWrap');
  var out = $('output');
  if (!viewport || !wrap || !out) return;

  var fit = $('fitView') && $('fitView').checked;

  if (!fit || !state.lastText) {
    out.style.transform = '';
    wrap.style.width = '';
    wrap.style.height = '';
    viewport.classList.toggle('is-fit', false);
    return;
  }

  viewport.classList.toggle('is-fit', true);
  out.style.transform = 'none';
  wrap.style.width = 'auto';
  wrap.style.height = 'auto';

  // Natural glyph size at measure font
  var nw = out.scrollWidth;
  var nh = out.scrollHeight;
  if (nw < 1 || nh < 1) return;

  var pad = 12;
  var availW = Math.max(40, viewport.clientWidth - pad * 2);
  var availH = Math.max(40, viewport.clientHeight - pad * 2);
  var scale = Math.min(availW / nw, availH / nh);
  // Cap absurd upscale on tiny demos; allow grow so art can fill stage
  scale = clamp(scale, 0.05, 8);

  wrap.style.width = Math.ceil(nw * scale) + 'px';
  wrap.style.height = Math.ceil(nh * scale) + 'px';
  out.style.transformOrigin = 'top left';
  out.style.transform = 'scale(' + scale + ')';
}

function scheduleFit() {
  if (state.fitTimer) clearTimeout(state.fitTimer);
  state.fitTimer = setTimeout(function () {
    state.fitTimer = null;
    // double-rAF so layout settles after text/font changes
    requestAnimationFrame(function () {
      requestAnimationFrame(fitOutputToStage);
    });
  }, 30);
}

function updatePreviewSizeVisibility() {
  var row = $('previewSizeRow');
  if (!row) return;
  var fit = $('fitView') && $('fitView').checked;
  row.hidden = !!fit;
}

function scheduleConvert() {
  if (state.convertTimer) clearTimeout(state.convertTimer);
  state.convertTimer = setTimeout(function () {
    state.convertTimer = null;
    convert();
  }, 40);
}

function updateMeta() {
  var lines = state.lastText ? state.lastText.split('\n').length : 0;
  var cols = state.lastText ? (state.lastText.split('\n')[0] || '').length : 0;
  var chars = state.lastText ? state.lastText.replace(/\n/g, '').length : 0;
  var name = state.imageName || 'no image';
  var aspectNote = '';
  if (state.image && state.lastGridInfo) {
    var srcA = state.image.width / Math.max(1, state.image.height);
    // Approximate display aspect using measured glyph aspect
    var g = state.lastGridInfo.glyphAsp || 0.55;
    var outA = (cols * g) / Math.max(1, lines);
    aspectNote = ' · src ' + srcA.toFixed(2) + ' · out~' + outA.toFixed(2);
  }
  $('meta').textContent =
    BUILD + ' · ' + name + ' · ' + cols + '×' + lines + ' · ' + chars + ' chars' + aspectNote;
  $('fp').textContent = BUILD;
}

function updateThresholdVisibility() {
  var mode = $('mode').value;
  var need = mode === 'braille' || mode === 'half';
  $('thresholdRow').hidden = !need;
  $('ditherHint').textContent = need
    ? 'Dither before threshold (Braille / half-blocks)'
    : 'Dither on gray ramp';
}

function loadImageFile(file) {
  if (!file || !file.type || file.type.indexOf('image/') !== 0) {
    setStatus('Need an image file (png, jpg, webp, gif…)', true);
    return;
  }
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function () {
    URL.revokeObjectURL(url);
    state.image = img;
    state.imageName = file.name || 'image';
    setStatus('Loaded ' + state.imageName + ' (' + img.width + '×' + img.height + ')');
    $('drop').classList.add('has-image');
    convert();
  };
  img.onerror = function () {
    URL.revokeObjectURL(url);
    setStatus('Could not decode image', true);
  };
  img.src = url;
}

function setStatus(msg, isErr) {
  var el = $('status');
  el.textContent = msg || '';
  el.classList.toggle('err', !!isErr);
}

function copyOutput() {
  if (!state.lastText) {
    setStatus('Nothing to copy', true);
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(state.lastText).then(function () {
      setStatus('Copied ' + state.lastText.length + ' characters');
      flashBtn($('btnCopy'));
    }).catch(function () {
      fallbackCopy();
    });
  } else {
    fallbackCopy();
  }
}

function fallbackCopy() {
  var ta = document.createElement('textarea');
  ta.value = state.lastText;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    setStatus('Copied (fallback)');
    flashBtn($('btnCopy'));
  } catch (e) {
    setStatus('Copy failed — select text manually', true);
  }
  document.body.removeChild(ta);
}

function downloadTxt() {
  if (!state.lastText) {
    setStatus('Nothing to download', true);
    return;
  }
  var base = (state.imageName || 'ascii').replace(/\.[^.]+$/, '');
  var blob = new Blob([state.lastText], { type: 'text/plain;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = base + '-' + $('mode').value + '.txt';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
  }, 0);
  setStatus('Downloaded ' + a.download);
  flashBtn($('btnDownload'));
}

function triggerBlobDownload(blob, filename) {
  var a = document.createElement('a');
  var url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  // Sync click in the same user-gesture turn when possible
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(url);
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 1500);
}

/**
 * Rasterize full-resolution art to PNG (export size = px per character row height).
 * Preview may be scaled to fit; this always uses the full character grid.
 * Retries at lower size if the canvas is over browser limits (was silent-failing on large Braille).
 */
function downloadPng() {
  if (!state.lastText) {
    setStatus('Nothing to export', true);
    return;
  }

  var s = getSettings();
  var lines = state.lastText.split('\n');
  var rows = lines.length;
  var cols = 0;
  var i;
  for (i = 0; i < rows; i++) {
    if (lines[i].length > cols) cols = lines[i].length;
  }
  if (cols < 1 || rows < 1) {
    setStatus('Empty output', true);
    return;
  }

  var base = (state.imageName || 'ascii').replace(/\.[^.]+$/, '');
  var name = base + '-' + s.mode + '-' + cols + 'x' + rows + '.png';
  var isBraille = s.mode === 'braille' || state.lastMode === 'braille';
  var wantPx = clamp(s.exportPx, 4, 64);

  setStatus('Building PNG… (' + cols + '×' + rows + ')');
  flashBtn($('btnPng'));

  // Defer so status paints, then build (heavy)
  setTimeout(function () {
    try {
      var result = rasterizeArtToCanvas(lines, cols, rows, wantPx, isBraille, s.darkBg);
      if (!result || !result.canvas) {
        setStatus('PNG failed: canvas too large — lower Width or PNG export size', true);
        return;
      }
      var c = result.canvas;
      var note = result.note || '';

      function ok(blob) {
        if (!blob || !blob.size) {
          // dataURL fallback
          try {
            var dataUrl = c.toDataURL('image/png');
            if (!dataUrl || dataUrl === 'data:,') {
              setStatus('PNG failed: empty image', true);
              return;
            }
            var a = document.createElement('a');
            a.href = dataUrl;
            a.download = name;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setStatus('PNG saved ' + c.width + '×' + c.height + ' px' + note);
            flashBtn($('btnPng'));
          } catch (e2) {
            setStatus('PNG failed: ' + (e2 && e2.message ? e2.message : 'encode error'), true);
          }
          return;
        }
        triggerBlobDownload(blob, name);
        setStatus('PNG saved ' + c.width + '×' + c.height + ' px · ' + cols + '×' + rows + ' chars' + note);
        flashBtn($('btnPng'));
      }

      if (typeof c.toBlob === 'function') {
        c.toBlob(function (blob) {
          ok(blob);
        }, 'image/png');
      } else {
        ok(null);
      }
    } catch (err) {
      setStatus('PNG failed: ' + (err && err.message ? err.message : 'unknown error'), true);
    }
  }, 30);
}

/**
 * Build a canvas of the art. Shrinks font/scale until within browser limits.
 * @returns {{ canvas: HTMLCanvasElement, note: string } | null}
 */
function rasterizeArtToCanvas(lines, cols, rows, fontPxWant, isBraille, darkBg) {
  var attempts = [
    fontPxWant,
    Math.max(4, Math.floor(fontPxWant * 0.75)),
    Math.max(4, Math.floor(fontPxWant * 0.5)),
    Math.max(4, Math.floor(fontPxWant * 0.35)),
    6,
    4
  ];
  // unique descending
  var seen = {};
  var fonts = [];
  var a, f;
  for (a = 0; a < attempts.length; a++) {
    f = attempts[a];
    if (!seen[f]) {
      seen[f] = true;
      fonts.push(f);
    }
  }

  var measure = document.createElement('canvas');
  var mctx = measure.getContext('2d');
  if (!mctx) return null;

  var t;
  for (t = 0; t < fonts.length; t++) {
    var fontPx = fonts[t];
    var lineH = isBraille ? fontPx * 1.05 : fontPx * 1.0;
    var pad = Math.max(4, Math.round(fontPx * 0.4));

    mctx.font = fontPx + 'px ' + MONO_STACK;
    // Measure one glyph only (full-line measure is slow on 200-char Braille)
    var sample = '⣿';
    if (lines[0] && lines[0].length) {
      sample = lines[0].charAt(0);
    }
    var cellW = mctx.measureText(sample).width;
    if (!(cellW > 0.5)) cellW = fontPx * (isBraille ? 0.55 : 0.6);

    var cssW = Math.ceil(cols * cellW + pad * 2);
    var cssH = Math.ceil(rows * lineH + pad * 2);

    // Fit into max edge + area (no extra DPR — export 1:1 CSS pixels)
    var scale = 1;
    if (cssW > PNG_MAX_EDGE || cssH > PNG_MAX_EDGE) {
      scale = Math.min(PNG_MAX_EDGE / cssW, PNG_MAX_EDGE / cssH);
    }
    if (cssW * cssH * scale * scale > PNG_MAX_AREA) {
      scale = Math.min(scale, Math.sqrt(PNG_MAX_AREA / (cssW * cssH)));
    }
    if (!(scale > 0)) continue;

    var outW = Math.max(1, Math.floor(cssW * scale));
    var outH = Math.max(1, Math.floor(cssH * scale));
    if (outW > PNG_MAX_EDGE || outH > PNG_MAX_EDGE) continue;
    if (outW * outH > PNG_MAX_AREA) continue;

    var c = document.createElement('canvas');
    try {
      c.width = outW;
      c.height = outH;
    } catch (eSet) {
      continue;
    }
    // Browser may clamp silently to 0
    if (c.width !== outW || c.height !== outH || c.width < 1 || c.height < 1) {
      continue;
    }

    var ctx = c.getContext('2d');
    if (!ctx) continue;

    try {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = darkBg ? '#0d0f12' : '#f4f6f8';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = darkBg ? '#e8edf4' : '#12161c';
      ctx.font = fontPx + 'px ' + MONO_STACK;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      // Slight letter-spacing fix: draw per line
      var i;
      for (i = 0; i < rows; i++) {
        ctx.fillText(lines[i], pad, pad + i * lineH);
      }
    } catch (eDraw) {
      continue;
    }

    var note = '';
    if (fontPx < fontPxWant || scale < 0.999) {
      note = ' · auto-scaled (export ' + fontPx + 'px' +
        (scale < 0.999 ? ', ×' + scale.toFixed(2) : '') + ')';
    }
    return { canvas: c, note: note };
  }

  return null;
}

function flashBtn(btn) {
  if (!btn) return;
  btn.classList.add('flash');
  setTimeout(function () { btn.classList.remove('flash'); }, 400);
}

function bindDrop() {
  var zone = $('drop');
  var fileInput = $('file');

  zone.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button, input, label, select, a')) return;
    // only open picker if clicking empty zone (not when dragging)
  });

  zone.addEventListener('dragenter', function (e) {
    e.preventDefault();
    zone.classList.add('drag');
  });
  zone.addEventListener('dragover', function (e) {
    e.preventDefault();
    zone.classList.add('drag');
  });
  zone.addEventListener('dragleave', function (e) {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag');
  });
  zone.addEventListener('drop', function (e) {
    e.preventDefault();
    zone.classList.remove('drag');
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadImageFile(f);
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) loadImageFile(fileInput.files[0]);
    fileInput.value = '';
  });

  // Paste image from clipboard
  window.addEventListener('paste', function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') === 0) {
        e.preventDefault();
        var f = items[i].getAsFile();
        if (f) loadImageFile(f);
        return;
      }
    }
  });
}

function bindControls() {
  var ids = [
    'mode', 'width', 'invert', 'threshold', 'contrast',
    'brightness', 'dither', 'fontSize', 'darkBg'
  ];
  ids.forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', scheduleConvert);
    el.addEventListener('change', scheduleConvert);
  });

  // live labels
  function bindLabel(id, labelId, fmt) {
    var el = $(id);
    var lab = $(labelId);
    if (!el || !lab) return;
    var sync = function () { lab.textContent = fmt(el.value); };
    el.addEventListener('input', sync);
    sync();
  }
  bindLabel('width', 'widthVal', function (v) { return v; });
  bindLabel('threshold', 'thresholdVal', function (v) { return v; });
  bindLabel('contrast', 'contrastVal', function (v) { return Number(v).toFixed(2); });
  bindLabel('brightness', 'brightnessVal', function (v) { return v; });
  bindLabel('fontSize', 'fontSizeVal', function (v) { return v + 'px'; });
  bindLabel('exportPx', 'exportPxVal', function (v) { return v + 'px'; });

  // Fit only reflows preview (same character grid)
  if ($('fitView')) {
    $('fitView').addEventListener('change', function () {
      var s = getSettings();
      document.body.classList.toggle('fit-on', s.fitView);
      updatePreviewSizeVisibility();
      var out = $('output');
      if (out && state.lastText) {
        if (s.fitView) out.style.fontSize = '12px';
        else out.style.fontSize = s.fontSize + 'px';
      }
      scheduleFit();
    });
  }

  if ($('exportPx')) {
    $('exportPx').addEventListener('input', function () {
      // label only — does not reconvert
    });
  }

  $('btnCopy').addEventListener('click', copyOutput);
  $('btnDownload').addEventListener('click', downloadTxt);
  if ($('btnPng')) $('btnPng').addEventListener('click', downloadPng);
  $('btnClear').addEventListener('click', function () {
    state.image = null;
    state.imageName = '';
    state.lastText = '';
    $('output').textContent = '';
    $('drop').classList.remove('has-image');
    var wrap = $('scaleWrap');
    if (wrap) {
      wrap.style.width = '';
      wrap.style.height = '';
    }
    if ($('output')) $('output').style.transform = '';
    setStatus('Cleared');
    updateMeta();
    scheduleFit();
  });

  $('mode').addEventListener('change', updateThresholdVisibility);

  window.addEventListener('resize', scheduleFit);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleFit);
  }
  DEVICE.onChange(function () {
    scheduleFit();
  });
}

function fillDemo() {
  // tiny procedural demo so first open isn't empty
  var c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  var ctx = c.getContext('2d');
  var g = ctx.createLinearGradient(0, 0, 64, 64);
  g.addColorStop(0, '#111');
  g.addColorStop(0.5, '#888');
  g.addColorStop(1, '#fff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(32, 32, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(26, 28, 4, 0, Math.PI * 2);
  ctx.fill();
  var img = new Image();
  img.onload = function () {
    state.image = img;
    state.imageName = 'demo';
    $('drop').classList.add('has-image');
    convert();
    setStatus('Demo loaded — drop your own image anytime');
  };
  img.src = c.toDataURL('image/png');
}

function init() {
  DEVICE.apply();

  state.canvas = document.createElement('canvas');
  state.ctx = state.canvas.getContext('2d', { willReadFrequently: true });

  bindDrop();
  bindControls();
  updateThresholdVisibility();
  updatePreviewSizeVisibility();
  updateMeta();
  fillDemo();

  document.title = 'ascii-maker · ' + BUILD;
  document.body.classList.toggle('fit-on', !($('fitView') && !$('fitView').checked));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
