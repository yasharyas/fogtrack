# Fogtrack

A 90-second booth game that trains one pro skill: knowing where an enemy is after you lose sight of them.

Watch the dots. The fog drops. Tap where they are now.

Entry for Cloud9 x JetBrains: Sky's The Limit, Category 3 (Event Mini Game).

## How it plays
1. **Watch.** Orange opponent dots cross a top-down site plan for 2.5 seconds.
2. **Fog.** Fog falls and the clock jumps ahead 1.5 to 3 seconds.
3. **Tap.** Place a pin where each dot is now. Dots only turn, stop or double back at the posts on the map, so a sharp read beats a guess.

Eight rounds get harder: runner, turner, stopper, two dots, a dot that doubles back. The score screen shows a total out of 8,000, a Track score (how close your pins were) and a Read score (did you beat a straight-line guess), a bar per round and your rank today. Enter three initials, or skip, and the game resets itself for the next player.

## Booth setup (offline)
- One laptop, one mouse or touch screen, an optional second monitor.
- `npm install` then `npm run build` then `npm run preview`.
- Monitor 1: open `http://localhost:4173/` full screen (Chrome `--kiosk` recommended).
- Monitor 2: open `http://localhost:4173/board.html` full screen. It shows today's and all-time top 10 and a live "now playing" strip, updated through `BroadcastChannel` with no network.
- Scores live in the browser's local storage on that laptop. No Wi-Fi, account or server is needed.
- Everyone gets the same eight rounds on a given day (rounds are generated from the date), so the daily board is fair.
- Operator panel on the board: `Ctrl+Shift+O` exports CSV, removes the last entry or clears scores, each with a confirm step.

## Development
- `npm run dev` for development. `npm test` runs unit tests (Vitest). `npm run e2e` runs browser tests (Playwright, installed Chrome). `SOAK=1 npx playwright test tests/soak` runs 150 sessions back to back.
- Test-only URL parameters `?seed=N` and `?fast=1` work only in dev or in builds made with `VITE_TEST=1`.

## Structure
- `src/core` round generation (seeded PRNG), path maths, scoring with optimal pin matching.
- `src/game` the game: one render loop, one set of listeners, state machine.
- `src/board` second-monitor leaderboard and operator panel.
- `src/shared` types contract and the validated score store.

## Built with
TypeScript, Vite, Canvas 2D. No runtime dependencies. See SUBMISSION.md for which JetBrains tools were used and for what.

## Licence
MIT for the code. JetBrains Mono (SIL OFL) is bundled in `public/fonts`. Satoshi is under the ITF Free Font License, which forbids redistribution, so it is not in this repo: `npm run build` fetches it from Fontshare automatically (scripts/fetch-font.mjs). Without network access the game falls back to a plain sans-serif.
