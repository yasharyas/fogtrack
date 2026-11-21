# Persona QA, Fogtrack (21 Nov 2026)
Build passes. Driven at 1920x1080 and 1366x768 in installed Chrome, real speed, seed 20261121. Screenshots in: C:/Users/YASHAR~1/AppData/Local/Temp/claude/5ccec8e0799aa9ad/955c13f6-330f-483a-a29d-559343e6e933/scratchpad/persona
(files: <width>_1attract, 2countdown, 3show, 4fog, 5pin (actually reveal, round 1 is one dot), 6reveal, 7score, 8initials, 9board; r4/r5_show, r5_pin, board_live, after_idle).
Visual rules: no purple, no emoji, no em dashes in visible text (grep clean). Nothing overlapping or clipped at either size.

## Blocker
1. Fonts missing. public/fonts is empty (Satoshi-Variable.woff2, JetBrainsMono-Variable.woff2 never added); build warns, document.fonts status "error" for both. Every screen renders in the Arial/Helvetica-style fallback (Fogtrack title, buttons, board names). Breaks the "not Arial/Helvetica" rule and the offline self-host claim. Owner: lead/game+board (add the two woff2 files to public/fonts; CSS in game.css and board.css already references them). See 1920_1attract.png, 1920_9board.png.

## Major
2. Posts are not visible. Attract copy says "Dots turn, stop or double back at the posts" but rounds 4 and 5 show no post at the turn point (the ink-and-orange mark from mark() never reads; the dot turns beside a plain crate). The visitor cannot learn what the posts do, so the Read score feels random. Owner: game (src/game/main.ts mark(), index.html copy), core if R.marks is empty for those kinds. See r4_show.png, r5_show.png.
3. Score screen is a dead-end for a 16-year-old: TOTAL 1692 next to Track 15 and Read 41 with no scale (out of what?), 8 unlabelled per-round bars, no rank or "you placed Nth today", and the top 40% of the screen is blank. Judge wants the loop to feel closed. Owner: game (index.html #s-score, game.css). See 1920_7score.png.
4. Reset is correct but silent and slow to read: score auto-advances to initials after about 7 s, then 15 s idle to attract (about 22 s total, verified). If the player skips or walks away, nothing says "next player" and the score is never saved or shown on the board. Owner: game (offer a visible countdown "Next player in 10" on initials; consider saving as "---" or keeping the score). 
5. "Click to start" on attract: the attract card sits on a live fogged map with a faint orange dot (1920_1attract.png), pleasant, but the card says "Click" while the brief is mouse-only and booth kiosks may be touch; the pitch needs a 3-step glance (Watch / Fog / Tap) rather than one sentence plus a 16 px sub line. At 1366 the 16 px sub line is the only explanation of posts. Owner: game.

## Minor
6. Pin phase timer is a 5 px teal line along the HUD bottom edge (r5_pin.png); in a noisy line it is easy to miss. Make it thicker or put a number in the HUD. Owner: game.css.
7. Fog dial is clear (+0.7s, +2.4s) but its label is 14 px mono at the pin corner position; enlarge. Owner: game.
8. Round 1 and the countdown: orange dot partly hidden behind the big "3" (1920_2countdown.png); move the numeral or shrink it. Owner: game.css.
9. Board while idle shows ten empty rows of dashes; fine as an empty state, but nothing tells the room how to play. Add one line under "Next player up" (e.g. "Watch. Fog. Tap."). Owner: board.
10. Board live feed works ("Now playing - round 1 of 8" with ticks, board_live.png) and new score row highlights on both Today and All time columns (1920_9board.png). Top row font sizes make "1692" at 1366 only just clear of the bars (1366_9board.png). Owner: board.css.
11. Initials keyboard is 9-wide with Del orphaned on its own row; Done is enabled and clear. Owner: game.css. See 1920_8initials.png.

## Persona 1: booth visitor, 16, noisy line
- 10 s test: partial pass. Attract headline and the big orange dot are understood; the loop "orange moves, fog falls, tap" is learned from play, not from text. Round 1 teaches it well (one dot, +268 with a line to the true spot).
- Readable: dots, fog, dial, pin (teal ring, high contrast). Not readable: posts (none), timer bar (thin).
- End is clear (big total, initials, back to attract). Reset is clean (all state cleared, board keeps entries), only slow.

## Persona 2: Cloud9/JetBrains judge, 2 minutes
- Complete loop visible: attract, countdown, show, fog, pin, reveal, score, initials, board. Board second monitor works offline with live "now playing", 10 rows, Today vs All time. Reset verified (22 s idle to attract, board shows Next player up).
- Real skill (tracking occluded enemies, predicting stops and turns) is not stated anywhere in the UI; add a one-line "trains: tracking and prediction" to attract or score. Track/Read names are decent but unexplained numerically.
- Finished product vs prototype: layout and palette feel designed; the fallback font, empty score screen and invisible posts read as prototype. Fix 1-3 and it reads as finished.
