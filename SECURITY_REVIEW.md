# Fogtrack security review (21 Nov 2026)

Scope: index.html, board.html, src/**, vite.config.ts, package.json, built dist/. Read-only; no source edited.
Checked: `npx vite build` (ok, 7 files, no inline script/style, no external URLs in dist), `npm audit --omit=dev` (0), `npm audit` (6: 2 critical, 1 high, 3 moderate, all dev-only).

## Rule check (PLAN.md "Security rules")
| Rule | Status |
|---|---|
| No runtime network / CDN | Met. No fetch/XHR/WebSocket/dynamic import; fonts are local `/fonts/...` URLs. But `public/fonts/` is empty, so both fonts 404 and fall back to system fonts (see L1). |
| Initials A-Z x3, write and read, textContent only | Met. `typeKey` (src/game/main.ts:219-222), `isValidEntry` (src/shared/store.ts:12), board renders via `textContent` (src/board/main.ts:11-16). No innerHTML/insertAdjacentHTML/outerHTML/eval/new Function/string setTimeout anywhere. |
| Untrusted storage/channel data | Met. JSON.parse in try, Array.isArray, per-entry schema filter; channel messages type-checked. `__proto__` keys from JSON.parse become own props and nothing merges them, so no pollution. |
| CSP `default-src 'self'` | Met in source and dist for production. Gaps in M3. |
| No eval / no personal data | Met. Only initials, scores, seed, timestamp stored. |
| Operator clear needs chord + confirm | NOT met. See H1. |

## High
**H1. Operator clear action does not exist.** `clearScores()` (src/shared/store.ts:48) is never called; there is no chord, no confirm, no way to reset the board between days or after a rude entry except devtools.
Fix: in src/game/main.ts keydown handler add e.g. `Ctrl+Shift+Alt+K` held, then a confirm screen that needs a second distinct chord (no `window.confirm`, which a visitor could answer); call `clearScores()` and `post({type:'idle'})`. Optionally a "remove last entry" action for offensive initials (three letters can still spell slurs).

**H2. ?seed lets a run post to "All time" from any seed.** src/game/main.ts:11-12 accepts any non-negative integer. A seed that is not 8 digits (e.g. `?seed=1`, `?seed=1e21`) makes `isValidEntry` fail (store.ts:15), so `addScore` silently drops the score while the game still says it was saved, and posts a `score` message the board rejects. An 8-digit practice seed (e.g. a known easy one) is accepted and counts on "All time".
Fix: only honour `?seed` and `?fast` when `import.meta.env.DEV` (or a test flag), or clamp to the YYYYMMDD shape and never write scores from a non-daily seed. Show "not saved" if `addScore` returns false.

## Medium
**M1. Kiosk escape and break-out via keyboard/mouse.** No `contextmenu` block (right-click gives Back/Reload/Inspect/Save as), no guard on Alt+Left / mouse back button, Ctrl+W, Ctrl+P, Ctrl+F, Ctrl+/-/wheel zoom (breaks the canvas layout until resize), F11, middle-click autoscroll. `user-scalable=no` is ignored by desktop Chrome.
Fix: run Chrome with `--kiosk --disable-pinch --overscroll-history-navigation=0 --disable-features=TranslateUI` and an OS keyboard lock; in page add `addEventListener('contextmenu', e => e.preventDefault())`, `history.pushState` plus a `popstate` handler that re-pushes, and `preventDefault` on `ctrlKey`/`altKey` combos and `wheel` with ctrlKey.

**M2. No idle reset on attract-less states mid-game for the board message.** If the tab is reloaded or closed mid-round the board stays on "Now playing - round N" until the next `idle` (src/board/main.ts:83-87). Cosmetic but it is a stuck state on the public screen.
Fix: board treats `playing` as stale after ~15 s without another message; game posts `idle` on `pagehide`.

**M3. CSP gaps.** Meta CSP cannot set `frame-ancestors`, so the game can be framed by another local page; `base-uri` and `form-action` are not in default-src fallback. In `vite dev`, game CSS is injected as `<style>` by JS (src/game/main.ts:1), which `default-src 'self'` blocks, so dev and prod differ.
Fix: add `; base-uri 'none'; form-action 'none'; object-src 'none'` to both metas; serve with a header CSP including `frame-ancestors 'none'` if served by anything other than file/preview; for game, link the CSS in index.html like board.html does so dev matches prod.

**M4. Dev dependency vulnerabilities.** `npm audit`: tinypool <=2.1.1 (critical, prototype pollution to RCE, via vitest 2), @vitest/mocker, vite/esbuild <=0.24.2 (moderate, dev server lets any website read responses). Prod audit is clean since there are no runtime deps.
Fix: bump vitest to current major and vite to a patched line; never run `vite dev` on the booth network, use the built `dist/` with `vite preview` bound to localhost.

## Low
**L1. Fonts missing.** `public/fonts/` and `dist/fonts/` are empty; Satoshi/JetBrains Mono requests 404 (still same-origin, no leak). Fix: add the woff2 files and their licences.

**L2. Validation looseness.** `at` may be any finite number (negative/future), `track`/`read` are not cross-checked with `total`, ids are not deduped. Only exploitable through devtools/storage, so low. Fix: `at` within [2026-01-01, now+1 day], dedupe by id in `loadScores`.

**L3. Cost per render.** Board parses and sorts up to 5000 entries twice per render, on every storage event, channel score and minute; fine at 5000 (about 750 KB) but a same-origin flood of `score` messages queues one timeout pair per id (src/board/main.ts:24-28). Fix: compute once per render, cap `hot` size.

**L4. ?fast=1 in production.** 10x speed is reachable by a URL edit and changes difficulty. Same fix as H2.

**L5. Text selection and drag.** `user-select:none` on body covers text; canvas/image drag is not blocked. Fix: `draggable=false` on canvas and `-webkit-user-drag:none`.

Not issues: hidden screens use `visibility:hidden` so Tab cannot reach their buttons; all actions are state-guarded so double clicks on Done/Start are harmless; Backspace does not navigate in current Chrome; BroadcastChannel is same-origin only.
