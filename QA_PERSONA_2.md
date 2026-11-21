# Persona QA round 2, Fogtrack (21 Nov 2026)
Build: `VITE_TEST=1 npx vite build` ok. Driven at 1920x1080 and 1366x768 in installed Chrome, normal speed, ?seed=20261121, game and board in one context. Script: scratchpad/persona2/run.mjs (+cd.mjs).
Screenshots dir: C:/Users/YASHAR~1/AppData/Local/Temp/claude/5ccec8e0799aa9ad/955c13f6-330f-483a-a29d-559343e6e933/scratchpad/persona2
Files per width (1920_ / 1366_): 01attract, 02countdown, 03show_r2/r3/r7, 04fog_r2/r7 (1920_04fog_r2, 1366_04fog_r7 viewed), 05pin_r2_timer, 06reveal_r2/r7, 07score, 08initials, 09nextplayer, 10attract_after_save, 11board, 12operator_confirm, plus 1920_02countdown_late.

Fonts: document.fonts shows "Satoshi:loaded" and "JetBrains Mono:loaded", check() true for both, at both widths. Visual rules: no purple/violet/indigo, no emoji, no em dashes in page text (regex on innerText clean), no page or console errors, nothing clipped. Operator overlay opens with Ctrl+Shift+O, first click on Remove last entry arms the orange "Confirm: remove last entry" state, Esc closes it (verified).

## Round 1 findings: status
1 Fonts missing: FIXED (both loaded, Satoshi headings, mono labels render correctly).
2 Posts invisible: FIXED (paper halo, dashed ring, ink block, orange flag, clearly readable in r2/r3/r7 show, fog and reveal; 1920_03show_r3.png).
3 Score screen dead end: MOSTLY FIXED (OUT OF 8,000, "1st today" rank chip, Track/Read "x / 100" bars with a plain explainer, R1-R8 labelled with round kind, skill line). Residual: see Minor 3, 4.
4 Reset silent: FIXED (Next player card "Step up. Watch. Fog. Tap." appears about 8.5 s into idle on initials; Done/Enter saves and returns to attract; 1920_09nextplayer.png). Residual: Major 1.
5 Attract pitch: FIXED (Watch / Fog / Tap row with 1-2-3 chips, "Tap to start", skill line). 1920_01attract.png.
6 Pin timer thin: FIXED (teal bar plus seconds in HUD: "Tap where it is now (1 left) - 4s"). Bar is still only about 12 px; acceptable.
7 Fog dial label: FIXED (large +1.2s, +2.0s on dial).
8 Countdown numeral hiding dot: PARTLY (dots now clear, but see Minor 1).
9 Board empty state hint: NOT FIXED (see Minor 5).
10 Board 1692 crowding bars: FIXED (1920_11board, 1366_11board: score, bars and initials clear).
11 Initials keyboard Del orphan: FIXED (7x4 grid, Del spans the last row). 1920_08initials.png.
New since round 1 and verified: operator overlay, board stale-state and kiosk guards.

## Blocker
None.

## Major
1. Next player card covers the Skip and Done buttons at 1366x768 (1366_09nextplayer.png): the dark card sits directly under the Del row and hides both action buttons for the last 1.5 s, so a player mid-confirm cannot see or hit Done; at 1920 it is fine (sits below buttons). Owner: src/styles/game.css (.handoff position; pin it to the top or move the keyboard up on short viewports) and index.html #handoff.
2. A good run is hard to read on the score bars: the R1-R8 strip is 90 px tall for 1000 pts, bars at 0-290 pts read as thin flat lines, and R1 to R4 are all 0 for my sloppy taps (0 shows as a 2 px line with "0" under it, which looks broken, not "missed"). 1920_07score.png, 1366_07score.png. Owner: src/game/main.ts finish() (scale bars to a fixed max like 300 or colour by kind) and game.css .strip. Needs a real-player run to confirm how it looks at 500+ per round.

## Minor
1. Countdown numeral sits in a bordered paper box at the top of the stage, straddling the map frame edge and not centred on screen (1920_02countdown_late.png, 1366_02countdown.png); during the card crossfade the box looks like a leftover panel. Centre it and drop the box or the border. Owner: game.css .count (align-self:start; margin-top:4vh).
2. "1 entries stored." grammar in the operator overlay (1920_12operator_confirm.png). Owner: src/board/main.ts openOp().
3. Score screen is top-heavy: panel starts at y 245 at 1080 with large empty bands above and below at 1920 (1920_07score.png); it reads like a prototype layout on a 1080p booth monitor. Owner: game.css .panel.
4. Score "Skill trained" line and sub copy are 16 px grey (about 3:1), hard to read from booth distance. Owner: game.css .hint, .sub.
5. Board idle state still shows ten dash rows with no "how to play" line under Next player up (1920_11board.png). Owner: board.html / board.css.
6. Board bottom: row 10 sits flush against the bottom edge at 1080 and 768 with no margin; row 10 bottom divider is cut at 1366_11board.png. Owner: src/styles/board.css .stage padding-bottom.
7. Operator overlay "Close (Esc)" button is grey on paper, low contrast (1920_12operator_confirm.png). Owner: board.css .op-close.

## Persona 1: booth visitor, 16, noisy line (10-second test): PASS
Attract: headline, plain sentence, Watch / Fog / Tap with icons and a big black "Tap to start". The orange dot and fog demo behind the card sell it. In play: HUD says what to do each phase ("Watch the orange", "Time jumps ahead", "Tap where it is now (1 left) - 4s"), pin is a bold teal ring, reveal draws a red line from pin to truth with +points. Posts now readable. End: giant total, rank chip, initials, back to start. Understood without help.

## Persona 2: Cloud9/JetBrains judge (2 minutes): PASS, reads as a finished product
Real fonts, consistent paper/ink/orange/teal palette, offline, board second screen with live now-playing, Today vs All time, highlight on new row, operator tools (export, remove last, clear with confirm). Skill (tracking what you can no longer see) is now stated on attract and score. Fix Major 1 and 2 and the polish items and it is submission-ready.
