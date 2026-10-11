# Performance measurement — after safe cleanup step

Captured: 2026-10-04 (Africa/Tunis)

## Controlled change

Removed only the provably unreachable legacy full-screen background renderer from `public/vault.html`:

- removed the detached `bgc`/`AU`/`VG` canvases and their drawing helpers;
- removed the unused `bgPulse()` trigger;
- removed the unused `#standin-bg` and `#bgc` CSS;
- kept the visible specimen canvas, vault ring, drawers, cursor, motion toggle, events, modal, and all project actions unchanged.

## Static before/after

| Metric | Before | After | Change |
|---|---:|---:|---:|
| Source/static app files | 543,040 bytes | 535,042 bytes | -7,998 bytes |
| `public/vault.html` | 54,374 bytes | 46,376 bytes | -7,998 bytes |
| Production JS/CSS output | 1,178,688 bytes | 1,178,688 bytes | unchanged |
| Largest output chunk | 907,217 bytes | 907,217 bytes | unchanged |
| Build result | pass | pass | unchanged |

The cleanup is not expected to change rendered pixels because the removed canvas was detached from the document and its paint function was not called by the active loop.

## Browser-only verification still unavailable

Playwright/Chromium is not installed in this repository or workspace. Therefore Lighthouse metrics, request counts from a browser network log, screenshots, frame-time averages/worst frame, long-task counts, JS heap after 60 seconds, and automated click-through verification remain unavailable. I did verify that `npm run build` succeeds after the change and that the edited vault document remains served by Vite.

## SUGGESTIONS NEEDING MY APPROVAL

These were intentionally not changed because they can alter timing, load order, resolution, or the visual result:

1. Merge the many independent `requestAnimationFrame` loops into one scheduler. Potential gain: lower callback overhead and fewer competing loops. Risk: animation phase/timing changes.
2. Cap WebGL pixel ratios or reduce full-screen blur/shadow work. Potential gain: lower GPU time, especially on mobile. Risk: visible quality changes.
3. Remove duplicate Three.js CDN loads or change view-level loading. Potential gain: less network/parse work. Risk: iframe load order and WebGL behavior changes.
4. Remove or narrow Google Font families/weights. Potential gain: fewer font requests and less CSS/font parsing. Risk: fallback or metric changes in text and layout.
5. Add real browser profiling and screenshot comparison. Required for trustworthy LCP/TBT/CLS/INP, frame-time, heap, and visual-diff numbers; needs Playwright/Chromium available.
