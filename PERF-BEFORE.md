# Performance baseline — before optimization

Captured: 2026-10-04 (Africa/Tunis)

## Measurement environment

- Repository: `archive-04`
- Build: `npm run build` completed successfully.
- Dev server: `http://127.0.0.1:4185/` responded with HTTP 200 during capture.
- Playwright/Chromium: unavailable in the repository and workspace (`playwright`, `@playwright/test`, `puppeteer`, and Chromium executables were not present). Browser-only measurements below are therefore marked unavailable rather than estimated.

## Static baseline

| Metric | Value | Method / note |
|---|---:|---|
| Source/static app files | 543,040 bytes | `src`, `public`, entry/config/package files; excludes `node_modules`, `dist`, `.npm-cache` |
| Production JS/CSS output | 1,178,688 bytes | uncompressed files in `dist/assets` |
| Largest output chunk | 907,217 bytes | `react-three-DK2YrjE2.js` |
| Largest application asset | 121,726 bytes | `public/milky-way.jpg` |
| Locally declared initial load points | 8 | HTML scripts/links/iframe plus CSS imports; actual browser request count unavailable without Chromium |
| `requestAnimationFrame` occurrences | 28 | repository search, excluding dependencies/build output |
| Files containing animation loops | 9 | `ArchiveAirlock.jsx`, `vault.html`, `archive-airlock.html`, `deep-ocean.js`, `deck.js`, `symbiote-swim.js`, `symbiote-pupil.html`, `deep-ocean.html`, `lab-galaxy.html` |
| Observer constructors | 6 | Intersection/Resize/Mutation observer search |
| Timer call sites | 20 | `setTimeout`/`setInterval` search |

Production output from the baseline build:

| Asset | Bytes |
|---|---:|
| `react-three-DK2YrjE2.js` | 907,217 |
| `react-1HyPLV13.js` | 221,982 |
| `index-Bolx1KO7.css` | 78,326 |
| `index-BnOtiuDe.js` | 44,453 |
| `symbiote-swim.js` | 22,012 |
| `deep-ocean.js` | 6,301 |
| `rolldown-runtime-hePW80VL.js` | 716 |

## Runtime inventory

- Main React page mounts React Three Fiber scenes for the architecture, lens, and symbiote object.
- `/deep-ocean.html` is loaded as the full-screen background iframe and has its own ocean and creature animation loops.
- `/lab-galaxy.html`, `/archive-airlock.html`, and `/vault.html` are additional iframe/document runtimes loaded only for their views.
- `public/deck.js` owns the command-deck cursor, hold controls, living text, particles, HUD, and related loops.
- `src/ArchiveAirlock.jsx` owns the React airlock renderer and its animation loop.
- The main page has pointer, resize, scroll, interval, timeout, and observer activity in addition to the visual loops.
- Three.js is loaded in the main bundle and also from CDN in several standalone HTML documents; this is a candidate for review, but changing it may alter load order or view behavior.

## Browser-only metrics — not captured

| Metric | Before value | Reason |
|---|---|---|
| Lighthouse LCP / TBT / CLS / INP | unavailable | No Playwright/Chromium runner installed |
| Request count and transferred bytes | unavailable | Requires browser network capture |
| Average/worst frame time over 10 seconds | unavailable | Requires browser Performance API/trace |
| Long tasks over 50 ms | unavailable | Requires browser PerformanceObserver capture |
| JS heap after 60 seconds | unavailable | Requires Chromium heap measurement |
| Before screenshots: hero, lab, vault idle/selected/modal | unavailable | No Chromium screenshot runner installed |

## Candidate causes for the next controlled step

1. Multiple independent animation loops across the main page, iframe pages, and deck runtime.
2. Multiple Three.js copies/contexts across the main bundle and standalone views.
3. Full-screen background rendering and several full-screen CSS effects running concurrently.
4. Duplicate/overlapping Google Fonts declarations in `index.html`, `src/styles.css`, and standalone documents.
5. `public/vault.html` contains a legacy in-document background renderer even though the stand-in canvas was removed; this must be verified before removal because its drawing functions may still be referenced by the vault loop.

No files other than this baseline report were changed during baseline capture.
