# Devpost submission pack

Ready to paste into Devpost's fields. Every statement below is true of the build as of commit a828a59, **except the lines marked [DO FIRST]**. Those describe the WebStorm / Junie work planned in PLAN.md. They become true only once you actually do that work; edit them to match what really happened before you submit. Judges can check the `.idea` / `.junie` folders and the git history.

---

## Project name
Fogtrack

## Tagline (Devpost "elevator pitch", 200 chars)
A 90-second booth game that trains the skill aim trainers skip: knowing where an enemy is after you lose sight of them. Watch the dots. The fog drops. Tap where they are now.

## Category
Category 3: Event Mini Game

## Built with (tags)
typescript, vite, canvas, html5, broadcastchannel-api, localstorage, vitest, playwright, webstorm [DO FIRST], junie [DO FIRST]

---

## Inspiration
Every booth game we have seen at an esports event tests the same thing: click the target you can see. Aim matters, but a lot of pro rounds turn on the moment after: the enemy steps behind a wall, the minimap goes dark, and the player who keeps an accurate picture of where they went wins the fight. Coaches call it tracking or keeping a read. Almost nothing trains it, and nothing at a booth lets a fan feel it in 90 seconds.

The brief asked for a game anyone can pick up in a line, that resets cleanly for hundreds of players and ideally shows off a real competitive skill. Fogtrack is our answer: no aiming, no game knowledge, one idea a 12-year-old gets in ten seconds and a pro can still chase a perfect score on.

## What it does
**Watch. Fog. Tap.**
1. **Watch.** Orange opponent dots cross a top-down site plan for 2.5 seconds.
2. **Fog.** Fog drops and a dial shows the clock jumping ahead 1.5 to 3 seconds.
3. **Tap.** Place a pin where each dot is *now*. The truth is revealed with a line from your pin to the real spot and the points you earned.

Dots only turn, stop or double back at the posts drawn on the map, and a turning dot always turns toward open space. So the answer can be *read*, not guessed: watch the speed, spot the post, and predict.

Eight rounds ramp up in about 90 seconds: a straight runner, a turner, a stopper, a pair of dots, a dot that doubles back.

**The score screen tells you what kind of player you are:**
- **Total** out of 8,000 and your **rank today**.
- **Track** (out of 100): how close your pins landed.
- **Read** (out of 100): how often you beat a naive straight-line guess, which is the prediction skill itself.
- A bar for every round, labelled with its type, so you can see where you lost points.

Enter three initials (or skip) and the game resets itself for the next person.

**Built for a real booth, not a demo:**
- **Live second-monitor leaderboard.** Today's top 10 and all-time top 10 side by side, a "now playing, round 4 of 8" strip, and new scores animating in. It runs **fully offline**: the game and board windows talk over the browser's BroadcastChannel and scores live on the booth laptop. No Wi-Fi, server or account.
- **Daily challenge.** Rounds come from a seed made from the date, so every fan that day plays the exact same eight rounds and the daily board is a fair fight.
- **Clean reset for every player.** Idle timers return to the attract screen, a "Next player" bar hands over, and the whole state is rebuilt from scratch each run.
- **Kiosk hardened.** No right-click menu, no back navigation, no zoom, no text selection, so a curious visitor cannot break the booth.
- **Operator panel** for staff (Ctrl+Shift+O on the board): export scores to CSV, remove the last entry (for rude initials) or clear the board, each behind a confirm step.
- **Mouse or touch only.** No tutorial needed: the attract screen teaches the loop in three words.

## How we built it
- **TypeScript + Vite + Canvas 2D, zero runtime dependencies.** One render loop and one set of input listeners for the life of the page, a single state machine (attract, countdown, show, fog, pin, reveal, score, initials), DPR-aware canvas for crisp lines on any booth screen.
- **Deterministic rounds.** A seeded PRNG (mulberry32) builds every path. Paths are generated so each hidden change happens exactly at a visible post, turners always turn toward the side with more room, and everything stays on the map.
- **Fair scoring.** Pins are matched to dots by trying every pairing, so the order you tap in never matters. Track gives full marks at the exact spot and falls to zero past about a third of the map. Read compares your pin to a straight-line extrapolation of the dot's last seen velocity. Each round is 75 percent Track and 25 percent Read, up to 1,000 points.
- **Validated storage.** Every score read from local storage or received over the channel is schema-checked; malformed data is dropped, never crashes the board. Initials are A to Z only, rendered as text, never as HTML. A strict Content Security Policy blocks anything not shipped with the game.
- **Tested like booth hardware:**
  - 24 unit tests (Vitest) cover the PRNG, round generation over 50 seeds, the post rule, scoring and storage validation.
  - 4 browser tests (Playwright on Chrome) cover the full loop through to the second monitor, the skip path, and junk data in storage and on the channel.
  - **A soak test that plays 150 complete sessions back to back** with no console errors and memory held under 2x the baseline, as evidence for "responsive during sustained use".
- **JetBrains tooling** (see the tooling section below).

## JetBrains tools used and what each did (required field)
- **WebStorm** [DO FIRST]: the project is set up as a WebStorm project (`.idea` committed). Used to run and debug the Vitest and Playwright suites with the IDE test runner, profile the canvas render loop, and build [list the real features, e.g. the reveal replay and sound].
- **Junie, AI Coding Agent** [DO FIRST]: inside WebStorm, Junie [built feature X from prompt Y, wrote tests Z]. Guidelines are in `.junie/guidelines.md`, committed as evidence.
- **JetBrains Air** [optional, DO FIRST if used]: [what it did].
- Supporting tools: Vite, Vitest, Playwright, and Claude Code as an additional coding assistant.

## Methodology write-up (required field)
**Problem.** Booth games must teach themselves in seconds, survive hundreds of players and still feel like esports. Most fall back on aim trainers, which test only the moment the target is visible.

**Approach.** We isolated one pro skill, keeping track of an enemy after losing sight of them, and stripped everything else away: no aiming precision, no game knowledge, one tap per dot. Three design rules made it work:
1. **Readable, not random.** Every hidden change is telegraphed by a visible post, so a good player can always reason to the answer. This makes the Read score a skill measure, not luck.
2. **Same test for everyone.** A date-based seed gives every visitor the same eight rounds that day, so the leaderboard compares like with like and the line has a reason to come back.
3. **Booth first.** Offline second-screen leaderboard, automatic reset, kiosk hardening and an operator panel were designed in from day one, then proven with a 150-session soak test.

**How it solves the category's problem.** A session is about 90 seconds, controls are one tap, the loop runs start to play to a clear score screen and back to attract without staff, and the leaderboard on a second monitor drives the "beat today's top score" competition the brief asks for, all without Wi-Fi.

## Challenges we ran into
- **Making prediction fair.** Our first round generator let dots turn at random moments under the fog, which made the Read score luck. We rebuilt it so every turn, stop and reversal happens at a visible post and turns always go toward open space, and added a 50-seed test that proves it.
- **Cold-player testing.** We walked the game through as a first-time booth visitor and as a judge with two minutes. That pass found an unscaled score screen, faint posts and a slow handover; all were fixed and re-checked in a second walkthrough.
- **Booth abuse.** A security review found visitors could escape the kiosk through right-click, back navigation or zoom, and that staff had no way to clear rude initials. Both are fixed.

## Accomplishments that we're proud of
- A booth game that teaches itself in three words and still has a real skill ceiling.
- A leaderboard that works with the Wi-Fi unplugged.
- 150 back-to-back sessions without an error.

## What we learned
Fairness is a design problem before it is a scoring problem: the moment players can see *why* a dot turned, the game stops feeling like a guess and starts feeling like a read.

## What's next for Fogtrack
- Real map layouts drawn from tactical shooter site shapes (original art), and a "pro mode" with three dots.
- Head-to-head mode on two stations for booth stage moments.
- Optional replay export so a fan can share their best read.

---

## Testing instructions for judges
1. Play online: [hosted demo URL, after you approve a deploy].
2. Or run locally: `npm install`, `npm run build`, `npm run preview`, then open `http://localhost:4173/` (game) and `http://localhost:4173/board.html` (leaderboard) in two windows. Put the board on a second monitor for the booth setup.
3. On the board, press Ctrl+Shift+O for the operator panel.
4. Tests: `npm test` (unit), `npm run e2e` (browser), `SOAK=1 npx playwright test tests/soak` (150-session soak, about 17 minutes).

## Bonus prize: Best AI-Powered Workflow Story
Link: `AI_SHOWCASE.md` in the repo [DO FIRST: write it after the JetBrains work]. Outline to fill with what really happened:
1. Plan: three competing concepts generated in parallel, judged against the five criteria, the best grafted together.
2. Build: parallel agents, each owning its own files under one shared types contract.
3. Gates: unit, browser and soak tests; two cold walkthroughs; a security review; every finding fixed.
4. JetBrains: what Junie / Air did inside WebStorm, with prompts, diffs and screenshots.
5. What AI got wrong and how we caught it (the random-turn fairness bug).

## Links
- Public repo with LICENSE shown in About: [you create the repo; I push on your go-ahead]
- Working build: [hosted demo, on your go-ahead]
- YouTube video, public, under 3 minutes: [from VIDEO_SCRIPT.md]
