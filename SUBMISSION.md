# Devpost submission pack (draft)

Fill the bracketed parts only with what is actually true at submit time.

## Tagline
Watch the dots. The fog drops. Tap where they are now.

## Category
Category 3: Event Mini Game.

## Text description
**Fogtrack** is a 90-second booth game built around one skill every competitive player needs and almost no trainer tests: tracking an enemy after you lose sight of them.

Orange dots cross a top-down map for 2.5 seconds. Fog falls, the clock jumps ahead, and you tap where each dot is now. Dots only change course at the posts you can see on the map, so reading the map beats guessing. Eight rounds ramp from a straight runner to two dots and a dot that doubles back.

**Who it is for:** fans in a Cloud9 booth line. Anyone gets it in ten seconds with no gaming knowledge, and competitive players find a real ceiling in the Read score.

**Built for the booth:**
- Mouse or touch only, no tutorial, one session in about 90 seconds.
- Complete loop: attract screen, countdown, eight rounds, score screen with total, Track and Read skill bars, per-round bars and today's rank, three-letter initials, automatic reset for the next player.
- Live leaderboard on a second monitor (today and all time, plus "now playing"), fully offline: the two windows talk over the browser's BroadcastChannel and scores stay on the booth laptop.
- Daily challenge: every visitor gets the same eight rounds that day, so the daily board is fair.
- Kiosk hardening (no context menu, no back navigation, no zoom), an operator panel to export, trim or clear scores, and validation of every stored score.
- Proof of sustained use: an automated soak test plays [150] sessions back to back with no errors and stable memory.

**Features list for the form:** [paste the bullets above]

## How we built it (tooling explanation)
- **Claude Code (AI coding agent, Anthropic):** planned the concept and wrote the first working version, its unit, browser and soak tests, and the security fixes.
- **[WebStorm]:** [only what was really done, e.g. "opened the project, ran and debugged the Vitest and Playwright suites, built X and Y with the IDE"]
- **[Junie / JetBrains Air]:** [only the features really built there, e.g. "the reveal replay and sound design were built by Junie inside WebStorm from these prompts..."]
- The `.idea` and `.junie` folders are committed as evidence.

Do not submit this section until the bracketed items are true and written from what happened.

## Methodology write-up
Aim trainers test the moment you can see the target. Pro players lose more fights to the moment after: the enemy drops out of view and you must hold where they are now. Fogtrack isolates that skill. Each round is generated from a seeded random generator, so a given day's challenge is identical for everyone. Paths are built so every hidden change (turn, stop, reversal) happens at a visible post, and a turner always turns toward open space, so the answer can be read, not guessed. Pins are matched to dots by trying every pairing, so pin order never matters. Track rewards closeness (full marks at the exact spot, zero beyond about a third of the map). Read compares your pin with a naive straight-line guess from the dot's last seen velocity, so it rewards prediction, not luck. Round score is 75 percent Track and 25 percent Read, up to 1,000 per round.

For booth use, everything runs offline from a static build, resets fully between players (one render loop, listeners registered once, idle timers return to the attract screen), and is checked by browser tests and a soak test.

## Bonus prize link
`AI_SHOWCASE.md` in the repo: an honest account of the workflow. Write it after the JetBrains work is done, describing what Junie or Air did and what Claude Code did.

## Links needed
- Public repo URL with LICENSE visible in About: [Yash]
- Working build link (hosted static demo or itch.io HTML page): [Yash, after go-ahead to deploy]
- YouTube video (public, under 3 min): [Yash]
