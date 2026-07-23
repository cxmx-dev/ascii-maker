# ascii-maker

**Play:** https://cxmx-dev.github.io/ascii-maker/

Local, real-time **image → Braille / Unicode block / ASCII** converter. Drop an image, tweak controls, copy or download text/PNG. All processing is client-side (canvas) — nothing is uploaded.

**Fingerprint:** `am-v4` (page title, brand badge, meta line)

## What This Is

A small static web tool (no build step) for the same results as popular online “dot art” / block ASCII generators, with a cleaner local UX:

- Braille 2×4 cells (`U+2800`–`U+28FF`)
- Half-blocks, gray block ramps, classic ASCII ramps
- **Fit to view** — full art scales into the stage (contain); width still sets resolution
- **Source aspect preserved** — character rows follow image aspect × measured mono glyph aspect
- Live sliders, dither, invert
- **Copy**, **.txt**, and **PNG** export (PNG is full character grid at chosen px size)
- Device-aware layout (phone / tablet / desktop)

Inspired by public tools (Braille generators, block-mode image→ASCII sites) but owned as a single project tree you can open offline or over LAN.

## What Does What

| Piece | Role |
|-------|------|
| `index.html` | Shell, controls markup, stage viewport, viewport meta |
| `device.js` | Sets `device-phone\|tablet\|desktop` + `input-touch\|input-fine` on `<html>` |
| `app.js` | Convert pipeline, fit-to-stage scale, copy / `.txt` / PNG export |
| `styles.css` | Themes, stage fit layout, stacked phone layout, touch targets |

### Modes

| Mode | Notes |
|------|--------|
| **Braille (2×4)** | One Unicode Braille cell per 2×4 pixels; full field = `⣿` |
| **Half blocks (2×2)** | Quadrant blocks (`▀▄▌▐` family) |
| **Blocks ░▒▓█** | Gray shade blocks |
| **Blocks dense** | Vertical bar ramp `▁▂▃…█` |
| **ASCII simple / dense** | Classic character ramps |

### Controls

- **Width** — character columns (height auto so **output aspect ≈ original image**). This is the **resolution** of the art.
- **Threshold** — Braille / half-blocks only
- **Contrast / brightness** — pre-threshold tone
- **Dither** — Floyd–Steinberg (before threshold for Braille/half; on ramp for shade modes)
- **Fit to view** (default on) — scale the whole output into the stage so it fits the browser/monitor; does not change character count
- **Preview size** — only when Fit is off (manual zoom + scroll)
- **PNG export size** — font px per character for the big PNG raster
- **Invert / dark bg** — polarity + preview/export theme
- **Copy** / **.txt** / **PNG**
- **Paste** image from clipboard (where the browser allows)

### Preview vs export

| Surface | Behavior |
|---------|----------|
| On-screen stage | Fit scales for display; same character grid as export |
| **Copy** / **.txt** | Full-resolution text (all chars) |
| **PNG** | Full character grid rasterized at **PNG export size**; auto-scales px/canvas if over browser limits; status shows progress/errors |

### Input

- Drag-and-drop on the drop zone
- Tap / click to choose a file
- Paste image (desktop-friendly)

## Run

No install beyond a browser. From the project folder:

```bash
npx --yes serve .
# or
python -m http.server 8080
```

Or open `index.html` via `file://`. For phone testing over LAN, serve from the host and open `http://<host-lan-ip>:<port>/` — confirm the UI shows fingerprint **`am-v4`** (hard refresh if an older badge appears).

Local absolute path for this machine: see `USER-NOTES.md` (not published).

## Device-aware

- Viewport: `width=device-width`, `viewport-fit=cover`, `100dvh` + safe-area
- Early `device.js` load
- Touch: larger controls, full-width action buttons on narrow width
- Layout: controls above output on phone; side panel on wider screens
- Fit re-runs on resize / orientation / device profile change

## Privacy

Images stay in the browser. Do not commit personal sample images you do not want public.

## Files (public tree)

Only these ship to GitHub / Pages (whitelist — never `git add .`):

```
index.html
device.js
app.js
styles.css
README.md
.gitignore
.nojekyll
```

`USER-*.md`, local hub scripts, `pics/`, archives, and session notes stay off the publish set. This-machine paths: see `USER-NOTES.md` (not published).

## Deploy habit (anonymous)

| When | From the hub folder |
|------|---------------------|
| First Pages create | `.\scripts\push-pages.ps1 -Repo ascii-maker` |
| Later updates | `.\scripts\start.ps1 -Repo ascii-maker` |

Full walkthrough (wire scripts, whitelist, git identity, failure catalog): local **`USER-NOTES.md`**.

## Version History

72226 11:09:56:70 PM CST
• **First GitHub Pages live:** https://cxmx-dev.github.io/ascii-maker/
• Public whitelist: 7 files (html/js/css/readme/gitignore/nojekyll); dual-doc + hub start/push scripts local-only.
• Docs: deploy habit + pointer to machine tutorial in `USER-NOTES.md`.

72226 9:54:25:62 PM CST
• `am-v4`: **Aspect ratio** matches the original image (was too tall, especially Braille).
• Row count: `charRows ≈ charCols × measuredGlyphAspect × (imgH/imgW)` via `computeCharGrid` / `measureGlyphAspect`.
• Meta shows `src` vs `out~` aspect ratios for a quick check.
• Force-fresh fingerprint `am-v4`.

72226 5:10:46:45 AM CST
• `am-v3`: **PNG export fix** — large Braille grids (e.g. 200×394) no longer fail silently.
• Cap canvas edge/area correctly (no extra DPR blow-up); retry at lower export px until the browser accepts the canvas.
• Status feedback: `Building PNG…` → `PNG saved …` or a clear error; blob download path hardened.
• Force-fresh fingerprint `am-v3` (hard refresh if UI still shows v1/v2).

72226 2:27:04:97 AM CST
• `am-v2`: **Fit to view** — stage contain-scale so full art fits the browser panel; Width remains character resolution.
• **PNG** export button — full-grid raster at **PNG export size** (px/char); Copy/.txt unchanged full text.
• Stage layout: `stage-viewport` + `scale-wrap` transform; preview size slider hidden while Fit is on.
• Hard-refresh fingerprint `am-v2` for LAN/cache clarity.

72226 12:57:55:34 AM CST
• Initial ship: static Braille (2×4) + half-blocks + block/ASCII ramps converter (`am-v1`).
• Client-side canvas pipeline: resize, grayscale, optional Floyd–Steinberg dither, threshold or ramp.
• UX: drag-drop, file pick, paste, live sliders, copy, `.txt` download, demo image on first load.
• Device-aware: `device.js`, touch-friendly chrome, stacked phone layout, dark/light preview bg.
• Docs: README, AGENTS.md, SYNC.md; `USER-*.md` gitignored; dual-doc for local paths.
