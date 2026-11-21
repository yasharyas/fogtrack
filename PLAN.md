# PLAN - Fogtrack (working name)

## Arena result
Three candidates (scratchpad/arena): A Cloudline (aim sky run), B Lastseen (fog prediction), C Two-Up (head-to-head booth system).
- **Base: B.** Highest Quality of Idea: it is not another aim trainer (the brief's own example, so the crowded lane). Trains a real pro skill (tracking enemies you can no longer see), yet a non-gamer gets it in ten seconds. Lowest scope risk.
- **Grafted from C:** the booth system is part of the product: daily seed challenge, crowd screen on a second monitor, offline everything, a scripted soak test as proof of "responsive during sustained use".
- **Grafted from A:** end screen "skill print" (bars per sub-skill) so a player leaves with something to show.
- **Rejected:** C's two-station WebSocket host (hardware and sync risk for one builder, needs two mice); A's three mechanics (three things to polish, weaker idea); Tauri/Electron and SQLite (a second browser window on the same origin does the job with zero install).
- Name is unchecked against stores. Yash checks Steam and itch.io before locking; fallbacks Deadreck, Lastseen.

## Concept (10-second pitch)
"Watch the dots. The fog drops. Tap where they are now."
Orange opponent dots move across a top-down site plan for 2.5 s. Fog falls, the clock jumps ahead 1.5 to 3 s (shown as a ticking dial), and the player taps where each dot is now. Pins score by distance. Eight rounds in about 90 s, each harder: straight runner, corner turner, stopper that holds an angle, two dots, a dot that doubles back. End screen: score, two sub-scores (Track: where it went; Read: did you predict the stop or turn), skill print, initials (3 letters, on-screen keys), then idle reset to attract mode after 15 s.

**Category 3 (Event Mini Game).** Odds are best (no esports domain specialists to beat), the brief's checkboxes are concrete, and it plays to design and motion. It hits the brief's own "next level" items: a real competitive skill and an offline live leaderboard on a separate monitor.

## Scope
Must (by 20 Dec): game loop, 8 round types, scoring, attract/play/score/initials/reset, board window, daily seed, offline, tests, soak.
Should (by 3 Jan): reveal replay on score screen (true paths drawn over pins), sound, board "now playing" live feed, operator panel (reset board, export CSV) behind a key combo.
Cut first: touch-specific polish, heat map of misses, multiple map layouts (one map, mirrored, is enough), any network play.

## Architecture
Vite + TypeScript, no UI framework, Canvas 2D for the play field, DOM for screens. Static build, runs from `npm run preview` or any static server on the booth laptop, no internet needed.
- `index.html` -> game. `board.html` -> leaderboard for monitor two.
- Game and board talk via `BroadcastChannel('fogtrack')`; scores persist in `localStorage` (key `fogtrack.v1.scores`), capped at 5,000 entries.
- Determinism: all round generation from a seeded PRNG (mulberry32); daily seed = YYYYMMDD local date, so everyone gets the same rounds that day.

## Contract
All shared types live in `src/shared/types.ts` (owned by lead, read-only for agents). Ownership:
| Owner | Files |
|---|---|
| core agent | `src/core/rng.ts`, `src/core/rounds.ts`, `src/core/scoring.ts`, `tests/unit/*` for these |
| game agent | `src/game/*`, `index.html`, `src/styles/game.css` |
| board agent | `src/board/*`, `board.html`, `src/shared/store.ts`, `src/styles/board.css` |
| test agent | `tests/e2e/*`, `playwright.config.ts`, `tests/soak/*` |
| lead | `src/shared/types.ts`, configs, docs |

Interfaces (see types.ts): `makeRng(seed) -> () => number`; `generateSession(seed) -> Round[]`; `positionAt(path, tMs) -> Vec`; `scoreRound(round, pins) -> RoundScore`; `scoreSession(RoundScore[]) -> SessionResult`; store: `addScore(entry)`, `topScores(scope, n)`, `clearScores()`; channel messages `BoardMsg`.

Field coordinates are normalised 0..1 in both axes; render maps to the canvas.

## Security rules (up front)
- No network calls at runtime, no third-party scripts or fonts from CDNs (Satoshi self-hosted under its free licence, JetBrains Mono OFL, files in `public/fonts`).
- Initials: only A-Z, exactly 3 chars, validated on write and on read; rendered with `textContent`, never `innerHTML`.
- Everything read from localStorage or BroadcastChannel is untrusted: schema-checked, bad entries dropped, never crashes.
- Strict CSP meta tag: `default-src 'self'`.
- No eval, no dynamic import from strings. No personal data stored beyond initials.
- Operator actions (clear board) need a key chord plus confirm.

## Test plan
- Unit (Vitest): rng determinism, every round type generates in-bounds paths, `positionAt` interpolation, scoring monotonic with distance, optimal pin matching, session totals, store validation rejects bad data.
- E2E (Playwright with installed Chrome): attract -> play 8 rounds -> score -> initials -> board window shows the entry -> idle reset returns to attract with clean state.
- Soak: scripted 300 sessions back to back; assert no console errors, frame time p95 under 20 ms, heap stable, store capped.
- Persona QA: booth visitor cold (understands in 10 s?) and judge cold (finds the brief items in 2 min?).
- Security review (Opus) on the whole repo.

## JetBrains (honest use)
Built first here with Claude Code. To meet the rule for real, Yash installs WebStorm (free non-commercial) and does real, visible work there: open the repo, run tests and the build from WebStorm, and build the Should items (replay, sound, operator panel) with Junie or JetBrains Air inside the IDE. Commit `.idea` and `.junie` folders. The description states exactly which parts were done where. `AI_SHOWCASE.md` records the real workflow for the bonus prize.

## Schedule
- 21-23 Nov: core game, board, tests (this session).
- by 30 Nov: Yash installs WebStorm, registers, gets codes.
- 1-20 Dec: Should items in WebStorm with Junie/Air; QA passes.
- 21 Dec-3 Jan: polish, sound, persona QA round 2.
- 4-8 Jan: demo video recorded and edited.
- **10 Jan: working submission entered on Devpost** (two days early). 12 Jan 11:00 PT hard deadline.
