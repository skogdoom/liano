# Liano — Design and Implementation Plan

A one-button browser game. A monkey swings on lianas through a jungle. It grabs a liana anywhere along its length, slowly slips toward the tip, and the player presses a key (or taps) to let go. The monkey flies ballistically and auto-grabs the next liana it touches. Obstacles sit in the gaps between lianas: static ones first, moving ones from the sixth. Bananas are an extra challenge: each player's are counted against the bananas they passed. Difficulty ramps in stages. Modes: single player, two-player shared screen, two-player split screen.

This document describes the game as released in v2.0.0 (https://skogdoom.github.io/liano/): the rules, the tunables, how it is built, and the milestones that got it there.

## Tech stack

- JavaScript (ES modules, no TypeScript), PixiJS v8, Vite for dev and build.
- Vitest for unit tests of the simulation, layout, input, sound recipes and more.
- A Web Worker that generates obstacles and bananas ahead of the world (the moving-obstacle solver runs there).
- Web Audio API for synthesized sound (no audio files).
- GitHub Actions: tests and build on every PR, deploy to GitHub Pages on `master`.
- No other runtime dependencies. No backend. No persistence (the best score, the mute setting and the slip and banana toggles live in memory for the page session).

## Modes and controls

| Mode | Keys | Lives | Result |
|---|---|---|---|
| 1 Player | Space, or a tap/click on the game | 1, or 3 with lives on (`H`) | Score; session best shown (one best with lives on, one with them off) |
| 2P Shared screen | P1 `A`, P2 `L` | 3 each | Higher total score after both are out of lives; equal = draw |
| 2P Split screen | P1 `A`, P2 `L` | 3 each | Same as shared |

- **Title screen.** A mode picker: keys `1` / `2` / `3` select a mode, and Space or Enter starts it. On a touch device the picker is hidden and a tap starts 1P: the 2P modes are keyboard-only. The title shows the controls for the selected mode ("SPACE · let go", or "P1 A · P2 L · let go") and "P pause · Esc menu" with a keyboard, and between them one line with the three settings, "H · Lives: off", "G · Slipping: off" and "S · Shadow: off" (gold when on; in the 2P modes "Lives: on" and "Shadow: off" dimmed). The panel has as much room below its last line as above its first (35 px).
- **During a run:** `P` pauses and resumes; `Esc` ends the run and goes back to the title screen (in 1P the run's score still counts for the best).
- **Results:** after a 400 ms input lock, Space or Enter plays again in the same mode, `Esc` goes to the title screen, and `1` / `2` / `3` go to it with that mode selected.
- **Other keys:**
  - `M` or the on-screen speaker mutes the sound.
  - `F` or the on-screen button toggles full screen.
  - `D` toggles the debug overlay (frame rate and heap on its first line).
  - `G` turns slipping off and on (see Trying without slipping).
  - `H` (for hearts) turns lives on and off for 1P, on the title screen only (see Lives and hearts).
  - `S` (for shadow) turns the shadow monkey on and off for 1P, on the title screen only (see Shadow monkey).
  - None of these ever counts as a game press.
- **Key rules.** Keys are defined in `config.js` (`KEYS`). Shift is avoided: on Windows, pressing it five times opens the Sticky Keys dialog. Key auto-repeat (`event.repeat`) is ignored for every key.
- **Presses and pause.** Presses while paused, or within 250 ms of resuming, are ignored.
- **Taps.** Each new finger or primary mouse button is one press.

## Core rules

| Area | Rule |
|---|---|
| Progress | Camera follows horizontally. No auto-scroll. Distance comes only from release momentum. |
| Action key | While hanging: release. While airborne: ignored. |
| Swing | Idle lianas hang still. When grabbed, a liana swings with a fixed angular amplitude and period, independent of how the monkey arrived. |
| Grip | The monkey grabs at the contact point, anywhere along the liana. A catch high on the rope first slides quickly down to FLOW_GRIP; then the grip slips toward the tip at a steady speed. At the tip the monkey is **forced off** with its current velocity. This is a forced release, not a death. |
| Release power | Linear speed scales with grip radius: a higher grip gives a weaker jump. |
| Regrab | The liana just released cannot be regrabbed until a different liana has been grabbed. |
| Backward | Releasing on the backswing is allowed. The monkey may fly backward and grab the previous liana. |
| Layout | Lianas have identical length and identical horizontal spacing. |
| Obstacles | One per gap (none in the first gap, nor in the gap behind the start liana). Static types: branch, thorn bush, rock, beehive, and a rare temple. Moving types (spider, snake, bird, bats at night, blue birds by day, and purple birds at any time) from obstacle 6. No liana ever sweeps over an obstacle: static and moving obstacles alike stay clear of the area either neighbouring liana can swing through, with the rope and a hanging monkey at any grip radius. |
| Bananas | Collected on touch, and counted per player against the bananas passed. They change neither the score nor the swing. |
| Difficulty | Stages keyed on obstacle index. Levers: shorter release windows, a larger share of moving obstacles, bigger obstacles, and the grade (1–4) of the obstacles a stage lets in. Swing speed and slip speed do not ramp. |
| Death | Collision with an obstacle, falling below the world band (world y WORLD_HEIGHT; the visible bottom edge can be higher when the flexible frame crops), or (shared screen only) being left behind the left edge. Going above the top edge is not a death. |
| Scoring | +1 per obstacle gap crossed: the gap scores when the monkey, moving forward, grabs the liana on its far side. Swinging or flying past without reaching that liana does not score. Each gap scores once per monkey (flying back and forth does not re-score). Plus banana points. |
| HUD | Top-right. 1P shows the score and session best. 2P shows each player's score and hearts (OUT when none are left): in split screen at the top of each pane, in shared screen side by side. The speaker and fullscreen buttons sit top-left. All of these stay inside the safe area (notch). |

## Grip and slip

- On grab the liana is vertical (θ = 0). The swing starts in the direction of the monkey's horizontal velocity: θ(t) = dir · A · sin(ω·t), where ω = 2π / period.
- The grip starts at the contact radius r₀ (at most MAX_ENTRY_RADIUS, so catching the very tip still leaves a forward swing).
- A release reaches the next liana only from about 290–310 px down the rope. So a catch higher than FLOW_GRIP first slides quickly down to it at QUICK_SLIP_SPEED. Every catch then has a release window on its first forward swing (about 0.2 s after the grab). The quick slide does not add to the release velocity.
- Then the grip slips at a steady speed s: r(t) = min(r_flow + s·t, L). Each grip gets its own s, so that it reaches the tip at SLIP_OFF_PHASE: on the upswing to the right, mid-way through the forward release window. s is the fastest speed up to MAX_SLIP_SPEED that lands on that phase, so it varies with where the liana was caught (about 7–38 px/s).
- The forced release is therefore a hop to the next liana unless an obstacle is in the way. An idle player is carried forward over clear gaps.
- Hanging position = anchor + r·(sin θ, cos θ).
- Release velocity combines the tangential and radial components: v = r·θ'·(cos θ, −sin θ) + r'·(sin θ, cos θ). A forced release at r = L uses the same formula.
- Time on a liana is bounded: at most (L − r₀) / MAX_SLIP_SPEED plus one swing period. This bound keeps moving obstacles fair (see Feasibility).
- On the title screen the monkeys hang at START_GRIP without slipping (in shared screen each on its own first liana); the slip starts with the run.
- Backward windows exist only for grips up to about 340 px before the forced release.
- Visual: the monkey's hand slides down the vine. In the last TIP_WARNING_TIME before the forced release the lower half of the vine blinks, faster at the end.

## Trying without slipping

To test whether slipping helps the pacing, `G` turns it off and on, anywhere (title, run, pause, results), for every monkey and world. The game starts with it off, on every device (touch devices have no G key); nothing is stored, so a reload turns it off again. In debug mode (`D`) the debug text shows the setting; otherwise nothing on screen does. Generation does not depend on it: a seed gives the same jungle.

- **Slipping off:** the grip holds still where the monkey caught the rope, but no higher than HOLD_GRIP. In play, catches land about 300–400 px down the rope, so about 40 % stay exactly where they land, and the grip never moves up. A catch above HOLD_GRIP slides down to it: the slide carries on the monkey's speed along the rope at the catch and brakes evenly to a stop, in at most HOLD_SLIDE_TIME (0.25 s), so it reads as a catch with friction rather than a correction. Before the run and on a respawn the monkey hangs at HOLD_GRIP, so its grip doesn't move when the run starts. The monkey tires and lets go on the step a slip from the catch (or from FLOW_GRIP, for a catch below it) would have reached the tip: the same forward hop, the same tip blink before it, and the same time bound on a liana. The change applies from each monkey's next grab.
- **HOLD_GRIP is 350 px, not FLOW_GRIP:** a slipping grip is lower on the rope by the time it lets go, and a still grip needs the same reach. Held at 0.7 L, about one gap in five fell short of its stage's window; from about 346 px down to the tip (checked at 350, 380 and 399 px) none do in a 40-seed sample. A test checks the held grip against generated gaps (static and moving), with the slowest slide (a catch with no speed along the rope).

## Obstacles

**Static:** branch, thorn bush, rock, beehive (BEEHIVE_SHARE, 8 % of the static gaps; the other three equally likely). A random height in OBSTACLE_Y_RANGE, horizontally centred, rerolled until the gap is passable and clear of both neighbouring lianas' swept areas.

**Temple.** A rare Mayan-style temple, a static obstacle in the lower region. Each day/night cycle (the five stages from Day to Dawn: obstacles 1–90, then 91–190, and so on) has at most one, at a random gap in it (not among the first TEMPLE_MIN_GAP, 6), so about one every five stages, and it is not drawn from the ordinary static pool. Which gap, its height and its look depend only on (seed, cycle) and (seed, gap). It comes in TEMPLE_VARIANTS (4) looks, which share one hitbox and differ only in the art. The hitbox is a stepped pyramid drawn from the top centre of the shrine down: a shrine 100 wide and 64 tall, three tiers 46 tall and each wider than the last (180, 272, 368), and a base 472 wide, tall enough to reach the floor at any height, so a flight has to pass over it. It is big on purpose: a door and a staircase bigger than the monkey, so it reads as the top of a temple far larger than the gap. It fits the free area under the swings, which widens downward like its steps; the shrine's width at the top is what limits how high it can stand, and the solver passes it from an apex height of about y 308 (320 at the largest scale) down to 375, the lowest region, with the same windows as any other static obstacle.

**Branch decorations.** By day about one branch in seven (BRANCH_DECORATION_CHANCE, 0.14) carries a decoration: a bird, a snake, a hanging monkey, a bird's nest, a panther, a cluster of flowers or a bunch of coconuts, picked at random, and at night also a hanging bat or an owl. A night decoration only appears on a branch in a Night stage (see Difficulty stages). Night stages are few and a branch is only about one gap in thirteen in them, so by day's odds the hanging bat and the owl would almost never show: at night about two branches in five carry a decoration (BRANCH_DECORATION_CHANCE_NIGHT, 0.4), and half of those (NIGHT_DECORATION_SHARE) carry a night one, which comes to about one night animal per three or four night stages. It is scenery: the obstacle is the same branch with the same hitbox, so nothing about passability or difficulty changes, and a flight can pass through the decoration unharmed. Whether a branch has one, and which, depends only on (seed, gap) with its own random stream, and rides along with the obstacle's data to the worker and back. A branch is about one gap in thirty, so a decoration shows about once or twice in a run.

**Moving** (from obstacle MOVING_FROM, in each stage's share). Each has a deterministic position with period P (MOVING_PERIOD_RANGE), driven by world time (counted in whole sim steps) plus a seeded phase, so the solver matches the world exactly. It stays in its own gap and its whole path stays clear of both swings, so a hanging monkey is never hit:
- **Spider:** drops and climbs on a thread from the canopy at the gap centre.
- **Snake:** climbs up and down a stalk standing in the gap centre.
- **Bird:** patrols across the gap with a slight bob, between the widest bounds that stay clear of the swings (asserted by the generator).
- **Bat:** at night (the Night time of day: Stage 4 and every fifth after, see Difficulty stages) all the birds are replaced by bats: there is no bird at night, on the wing or perched on a branch (the blue bird is a day bird anyway). A bat has a bird's hitbox and patrol, and takes its place in the list the generator picks from, so a night gap gets the obstacle a bird would have had and nothing about fairness changes. The purple bird's place is taken by a *circling bat* (`circleBat`, the same hitbox, circle and period; bong 277 Hz). Bats come in four slightly different looks (BAT_LOOKS: purple-grey, brown with a golden collar and amber eyes, grey with a longer wing, black with yellow eyes; they differ in colour, ear size and wing span), picked at random for each gap, and the hanging bat decoration has them too.
- **Purple bird:** by day, at dusk and at dawn (at night a circling bat takes its place) a moving type flies in a circle at the gap centre, either way round, with a radius of 42–72 (PURPLE_BIRD_RADIUS) and its highest point 322–345 (PURPLE_BIRD_TOP), once round in 2.4–3.6 s. Where it is when the monkey swings by decides what it is: high at the top of its circle, low at the bottom, wide at the sides. Motion is `ax = ±ay`, `bob = 0`. The solver checks it like every moving obstacle, and a candidate that fails is rerolled.
- **Blue bird:** by day (Day, Late afternoon and Dawn; not at Dusk or Night) a fourth moving type flies up and down at the gap centre, without a thread or a stalk. Like the spider and snake it can only use the free air the swings leave: either the high band (its lowest point 165–200, over a flight of 70–130) or the low band (its highest point 296–322, over 80–140), picked at random, with a slight swoop (BLUE_BIRD_BOB). The solver checks it like every moving obstacle, and a candidate that fails is rerolled.
- Room for them: at the gap centre a moving hitbox stays clear of the swings only above y ≈ 213 or below y ≈ 288, while valid flights cross the centre at y ≈ 189–361. So spiders work the high band (lowest point 175–212), snakes the low band (highest point 290–320), and birds patrol low (y 330–390, ±35 to ±117 px). They block about 10–20 % of otherwise valid releases.

## Bananas

- Whether a gap has a banana depends only on (seed, gap): each gap from obstacle 1 is a candidate with BANANA_CHANCE, and a candidate is dropped if either of the two gaps before it is one. That gives bananas in about 14 % of gaps, at least 3 apart.
- A banana sits on a flight that clears the obstacle but is not the safest: a release one or two steps inside either end of a release window.
- Collected on touch, in the air or while hanging; only once, even if its gap is culled and regenerated.
- They are an extra challenge only: a banana counts for the player who took it, and changes neither the score nor the swing. In shared screen it goes to the first monkey to reach it, and is gone for the other.
- The tally is "taken / passed". Passed is the most there was to take: the bananas in the gaps passed so far (scored by any monkey of the world), plus any taken. In shared screen it is the same for both players; in split screen each world counts its own. Deaths don't reset it.
- The HUD shows only how many each player has taken, under their score (a banana icon and "3"). The results show the tally after a banana icon: "3 / 5", or "P1 3 / 5 · P2 2 / 5" in two-player.
- Feedback: a "+1" rises where a banana was taken, with a "pling" (see Sound).

## Lives and hearts

Lives are always on in the two-player modes (3 each, see Two-player rules). In single player they are off by default and `H` turns them on and off on the title screen (the title panel shows "H · Lives: off" or "on", and "Lives: on" in the 2P modes). It is for the desktop: with touch only the line is not shown, so single player stays at one life. It applies to the next run and is kept until the page is reloaded; with lives on single player has LIVES_2P lives and works as a 2P game does (a lost life tumbles, then respawns, invulnerable for a moment; the run ends with the last). The session best is kept apart for the two settings, since a run with lives can score much more.

**Hearts.** In every game with lives, each BANANAS_PER_HEART (5) bananas a player takes turn the next banana in the game into a heart, the first banana after the one just taken that is still there (or, with none generated yet, the next one generated). Taking the heart gives that player an extra life, up to MAX_LIVES (99); it counts as no banana: not in the taken count, nor in the bananas passed on the results, and it does not count towards the next heart. In shared screen the bananas are shared, so the heart goes to whoever takes it. Hearts are runtime state of the world (like the bananas taken): generation does not change, so a seed gives the same bananas with or without lives. A heart has its own sound (a rising four-note arpeggio) and a "+1 ♥" pops where it was taken.

**HUD.** Under the banana count each player has a row of hearts: filled for the lives left, outlined for the lives lost of the three they start with (a player with 2 lives has two filled and one outlined). With more than five lives it shows five filled hearts and a small number at the top left of the leftmost heart with how many lives there are. A player who is out shows "OUT" and no hearts.

## Shadow monkey

A setting for single player (`S` on the title screen, off by default, desktop only like lives; always off in the 2P modes): the best previous game is replayed as a shadow beside the monkey, a grey, see-through monkey drawn behind it (SHADOW_ALPHA 0.36, grey fur), on a grey, see-through liana of its own, so you can race it. It needs every game to be on the same level.

- **The level.** With the shadow on, every game uses one seed: picked at random the first time the shadow is turned on and kept until the page is reloaded (also across turning it off and on again, and a visit to a 2P mode). With it off the seed is random for every game, as before. Obstacles, bananas and decorations are generated from the seed, so the level is the same; nothing about generation changes.
- **The same start.** The run's moving obstacles and swings follow the world's time, so a run starts from a fresh world at time zero (from the title screen, whose swing has been going for a while, the world is rebuilt as the run starts; after a results screen it already is). The same inputs then give the same run, step for step (a test plays one twice).
- **Recording.** Every sim step of a run with the shadow on records player 1's monkey (position, velocity, hanging, flying or dead, and the liana's swing direction, angle and angular velocity: what its view needs) as 25 bytes a step (x and y as doubles, velocity as singles, the state in a byte; about 0.9 MB for five minutes). The shadow's liana is not recorded: the run keeps only when the monkey grabbed or let go of which liana (a few events), and `ShadowReplay` swings a real `Liana` again from them with the same physics, so it swings exactly as it did (a test compares every frame of a run). When the run ends (a death, or Esc) it becomes the shadow if its score beats the one before it (a tie does not). Shadows are kept in memory for the page session, one per setting of lives and slipping (like the session bests), since the same level plays differently under other rules.
- **Replay.** In the next game the shadow's frame for the step the run is at is drawn, with the lianas it hangs on drawn as the real ones are but in grey: a liana fades in over SHADOW_LIANA_FADE (0.4 s) before the shadow grabs it, at rest, and fades out over the same time after it lets go, swaying back to rest meanwhile (the real lianas, which nobody swings on in this game, hang still beneath). It follows pause. It plays on after a game over, on the results screen: when its run is over (or the game's is) it falls on from where its run ended, tumbling like a lost monkey, until it is out of the world, so a shadow that is on the screen stays there until it has left it. It is only drawn: it touches nothing, picks up nothing and does not affect the sim. The first game has no shadow.

## Difficulty stages

Stages are keyed on **obstacle index**, not score, so banana points don't speed up difficulty and in shared screen both players meet the same level. A stage starts when a monkey grabs the liana before the stage's first obstacle (obstacle #i is in gap i). A banner ("Stage 2 · Late afternoon") fades in low in the band, and the background tint eases over 2.5 s (day → late afternoon → dusk → night). A new run starts over at day.

The day goes on past Stage 4: the stage number and the time of day keep counting every STAGE_LENGTH_AFTER (20) obstacles, from obstacle 51 on: Night 51–70, Dawn 71–90, then Day again, Late afternoon, Dusk, Night, Dawn, and so on, for as long as the run lasts ("Stage 6 · Day"). Difficulty goes on rising subtly each of these stages too, up to a limit: the shortest release window shrinks by LATER_WINDOW_STEP_MS (2 ms) per stage, from 60 ms down to LATER_MIN_WINDOW_MS (40 ms, about 5 sim steps, reached at Stage 14, obstacle 251), and the moving share rises by LATER_MOVING_STEP (4 points) per stage, from 55 % up to LATER_MOVING_MAX (75 %, Stage 9, obstacle 151). Obstacle scale stays at 1.3: at that size a branch already fits at only one height range. From Stage 14 on only the sky goes on. Both levers are checked at generation like any stage's, so every gap stays passable; the window table is unchanged, since the stage's minimum is applied at lookup.

| Stage | Obstacles | Min release window | Moving share | Obstacle scale |
|---|---|---|---|---|
| 1 | 1–15 | 90 ms | 0% for 1–5, then 12% | 1.00 |
| 2 | 16–30 | 80 ms | 20% | 1.10 |
| 3 | 31–50 | 70 ms | 40% | 1.20 |
| 4 | 51+ | 60 ms | 55% | 1.30 |

### Obstacle grades

Every obstacle has a **grade** from 1 (easiest) to 4: how much of the release timing it takes away. It is measured, not set per type: the share of the empty gap's release steps (those whose flight reaches the next liana) that the obstacle blocks, averaged over the entry radii. A moving obstacle's share is also averaged over sampled arrival times (every GRADE_ARRIVAL_STEP-th of the solver's twelve, and every GRADE_RADIUS_STEP-th radius; grading it costs about 0.8 ms). GRADE_BOUNDS = [0.12, 0.19, 0.27] are the shares where grades 2, 3 and 4 start, roughly the quartiles of every obstacle the game made before grades. So a branch is mostly a 2, a spider or a purple bird a 1, a snake or a bird a 2, and a rock, thorn bush or beehive low in the gap a 3 or 4; the same type gets a different grade at a different height or scale. The grade is on `Obstacle.grade` (carried to and from the worker) and shown in the debug view for the gap the monkey is in. For static obstacles the shares are in the window table (`blocked`, per scale, type and height), so play still never runs the solver for them.

Each stage lists the odds (`grades` in STAGES) of a gap *aiming* for each grade, drawn from a random stream of its own, so the same for a seed every time. A grade with no odds in a stage never appears in it, which keeps the hard obstacles out of the early stages:

| Stage | Obstacles | Odds for grade 1 / 2 / 3 / 4 |
|---|---|---|
| 1 | 1–15 | 65 / 35 / 0 / 0 |
| 2 | 16–30 | 40 / 40 / 20 / 0 |
| 3 | 31–50 | 25 / 35 / 40 / 0 |
| 4 | 51–70 | 20 / 30 / 30 / 20 |
| 5 and on | 71+ | towards 10 / 20 / 30 / 40, reached after LATER_GRADE_STAGES (8) more stages (Stage 12) |

**High and low.** Obstacles above HIGH_BELOW_Y (255) hang from the canopy ("high"), lower ones stand on the floor ("low"); swing clearance leaves no passable height around that line. The easy obstacles are mostly high (a low rock or beehive blocks far more flights), so with the grades alone Stage 1 came out about 70 % high, Stage 2 56 %, Stage 3 41 % and Stage 4 34 %. A stage's `high` (STAGES) is the share of its gaps that aim for a high obstacle, the rest for a low one, from a random stream of their own: 0.5 in Stages 1–3, so they come out about 47–49 % high, and null from Stage 4 on, which leaves the mix to the types and grades (about a third high: only the spider and the blue bird fly high). A static gap draws its height from the aimed side's part of the range, a moving gap its type from the ones that fly there (a high aim: spider or blue bird; a low aim: all but the spider), and the side counts before the grade when choosing between candidates.

After Stage 4 the odds only move gradually, so even the late levels still hold all four grades: easy obstacles for variation, the hardest ones more and more often. The generator tries the kind of obstacle the moving share asks for (still the same lever as before); an obstacle that is passable under the stage's rules, at or below the stage's highest grade and with the aimed grade is taken at once, else the closest one within a grade of the aim (a moving one: from the first MOVING_GRADED_TRIES candidates the solver accepts; a static one: from STATIC_TRIES random type and height draws). If the kind cannot find one within a grade of the aim it tries the other: at the bigger late scales few static obstacles are easy (no grade 1 at scale 1.3 except the temple), so the aim for an easy obstacle there is mostly met by a moving one, and the aim for a hard one by a static one. Measured over many seeds: the mean grade per stage rises 1.4, 1.9, 2.1, 2.6, then 2.7 (Stage 5–8) and 2.9 (9–12); about two obstacles in three get the aimed grade exactly, nearly all are within one. The temple is under the same cap.

Scaled obstacles must still pass the swing-clearance rule; heights that fail are rerolled. At scale 1.3 a branch fits only at y 371–375, so stage-4 branches almost always sit at the bottom. The tint multiplies the background only (sky, parallax, canopy and floor), so lianas, obstacles and the monkeys stay readable at night.

## Two-player rules

**Common to both 2P modes.**
- Both modes use one seed per match, so both players face the same level.
- The 16:9 frame (1280 × 720), with bars as needed. Portrait and the flexible frame are for 1P.
- Player 2's monkey is ginger.
- Scores accumulate across all lives.
- After a death the monkey tumbles for RESPAWN_DELAY_MS, then hangs again at RESPAWN_GRIP, swinging forward. It blinks and is invulnerable to obstacles for RESPAWN_INVULN_MS (it can still fall and still scores).
- A player with no lives left is out; the other plays on until they are out too. The results screen then shows both totals and the winner, or a draw. The session best is for 1P only.

**Split screen.**
- Two independent worlds with the same seed: P1's in the top pane, P2's in the bottom one.
- Each pane is 1280×360 and draws its world at 0.5 scale, a wider view than single player. Each pane clips its world and has its own camera, background tint and stage banner. "P1 is out" shows in a pane whose player is out.
- Respawn on the last liana that player grabbed.
- There is no interaction between the players.

**Shared screen.**
- One world containing both monkeys, drawn at SHARED_ZOOM in the 16:9 frame: a wider view (about 1707 px of world), with forest above and below the band.
- The leader camera (`src/sim/sharedView.js`, part of the rules since it decides who is left behind) follows the alive, non-invulnerable monkey furthest right, in the middle of the view (SHARED_LEADER_X), so the next liana is in view ahead; while the leader hangs it follows its liana rather than its swing. A change of leader pans with the usual easing. While no monkey is alive (one out, the other about to respawn) the camera holds still.
- A monkey is left behind, losing a life, when it goes fully off the left edge; a hanging one only once its liana is off the left edge too. A monkey over a liana behind the leader stays in view while the leader hangs; once the leader flies on, it has to follow.
- Respawn on the last liana grabbed if it is fully on screen, else on the leftmost liana that is.
- Monkeys do not collide with each other.
- **Each monkey has its own lianas:** two sets hanging from the same anchors as in single player, green for P1 and golden for P2, and a monkey only grabs its own. So each swings on its own timing, and each gets the same fairness guarantee as single player. At rest the two vines of a pair bow to opposite sides, so both show. Obstacles and bananas are shared.

## Feasibility (fairness guarantee)

The generator only emits gaps the solver accepts. For a gap, the solver must find a release window at least as long as the stage's minimum, **before the forced release**, for every combination of:
- entry radius r₀ ∈ ENTRY_RADII,
- obstacle phase at arrival, sampled at 12 points over P (moving obstacles only).

"Valid" means the flight reaches the next liana without touching the obstacle or falling out. The obstacle must also be clear of both neighbouring lianas' swept areas by MONKEY_RADIUS + LIANA_CLEARANCE. A static height is rerolled up to 20 times, then falls back to the lowest passable height; a moving obstacle is rerolled (type and motion) up to 20 times, then falls back to a static obstacle at its lowest passable height.

Implementation:
- **Step size.** The solver simulates releases at the sim step (1/120 s), so it agrees exactly with the real world. Tests check this for every release step, for static and moving obstacles.
- **Static gaps** use a build-time window table (`src/sim/windowTable.json`, fingerprinted by its inputs, rebuilt with `npm run windows` and checked in CI). It has a section per stage scale; the stage's minimum window is applied at lookup. Static generation is a table lookup, with no solver work during play.
- **Moving gaps** reuse the flights over an empty gap (cached per entry radius) and check them against the obstacle's position at each flight point's time: under 1 ms per candidate.
- **The worker** (`src/obstacleWorker.js`, driven by `src/obstaclePrefetch.js`) generates obstacles and bananas 5 gaps ahead of each world. Generation is deterministic in (seed, gap), so a gap the worker has not delivered yet is generated on the spot with the same result. No frame goes over 16 ms because of generation.
- **Known gaps in the guarantee.** It is sampled, not a proof, and doesn't cover respawn edge cases. This is acceptable for versus play.

## Simulation model

- All simulation is pure logic with no Pixi imports. Rendering reads simulation state each frame.
- `Game` owns the match: one world with every monkey (1P, shared screen), or one world per player (split screen). Its events carry the world (`pane`) and the match-wide `player`.
- **Loop:** a fixed timestep (1/120 s) with an accumulator. The frame delta is clamped to 100 ms.
- **Pause:** the game pauses on window blur, on a hidden page, while the graphics context is lost, and on `P` during a run.
- **Liana:** anchor at (x, ANCHOR_Y) above the top of the world band, length L. States: `idle | swinging | settling`. Released lianas settle back to vertical with a damped cosmetic sway. A world has one set of lianas, or with `ownLianas` (shared screen) one per monkey.
- **Grab detection:** circle (monkey) against the liana's vertical segment, while airborne, among the monkey's own lianas, excluding the just-released one.
- **Collisions:** checked every step in both hanging and airborne states, except while invulnerable. If an obstacle hit and a grab happen in the same step, the hit wins.
- **Generation:** a seeded RNG (mulberry32), with a random seed per match and fixed seeds in tests. Liana i sits at x = i · LIANA_SPACING. Entities are generated lazily around the monkeys (and a monkey's respawn liana) and culled 2 screens behind the rearmost, with hysteresis.
- **Events:** grab, release (forced or not), score, banana, stage, death, respawn. `Game` passes them on each frame to sound and effects.

## Sound

All sounds are synthesized with the Web Audio API at runtime; no audio files.

| Event | Sim trigger | Synthesis |
|---|---|---|
| "Bong" | `death` with cause `obstacle` | Bell-like decaying sines at inharmonic ratios (1, 2.76, 5.4) with a fast attack and about 1 s decay. Base pitch by obstacle type: rock 110 Hz, snake 131, branch 165, thorn bush 247, spider 294, purple bird 311, blue bird 349, bird 392, bat 466; beehive 196, temple 98. |
| "Crash" | `death` from a fall, or from being left behind | A low-passed noise burst plus a falling low sine thud, about 0.8 s. |

- **Recipes and player:** each sound is a pure recipe function (data, unit-tested in Node). A thin player is the only code that touches `AudioContext`.
- **When sound plays:** on by default from the first press. Mute is toggled with `M` or the speaker button, and kept in memory only. The `AudioContext` is suspended while paused, and resumed whenever it is not running while it should be (also on its `statechange`, and every frame, so a window switch that lands while a suspend is still settling does not leave it silent). One that is still not running 1.5 s later, or whose clock stands still, is replaced by a new one at the next key press or tap; the debug view (D) shows the state (`sound running`, `sound locked`, `(rebuilt 1x)`).
- **Sound set:** deaths, a rising four-note arpeggio (A5, D6, G6, C7, 70 ms apart, the pling's soft sine voice) for a heart taken, and a "pling" for a banana taken: two quick, soft sine notes a fifth apart (E6, then B6, 80 ms later), each with a faint octave, fading in about half a second, quieter than the deaths. Release sounds (a "swish", several "wheee"s) were tried and dropped; stages, respawns and results are silent.

## Touch, phones and tablets

- **Input:** `pointerdown` on the canvas feeds the same press queue as Space. The page sets `touch-action: none`, blocks double-tap zoom, pinch, the long-press menu and text selection, and cancels the canvas's touch events (iOS Safari otherwise shifts the page under the tab bar on quick taps). The viewport uses `viewport-fit=cover`.
- **Prompts:** say "Tap" or "Press Space" depending on the last input type used, starting from `(pointer: coarse)`.
- **Resolution and layout:** the canvas resolution is capped at 2× device pixels. The layout follows resizes, rotation, the iOS address bar (`visualViewport`) and pixel-ratio changes.
- **Home screen app:** a web app manifest (`display: fullscreen`, any orientation) and an `apple-touch-icon`. On iPhone this is the way to play without browser bars; its Safari has no Fullscreen API for pages.

## Screen layout

- **Layout module.** `layoutFor(width, height, insets, { fixed })` is a pure, unit-tested function. It decides the logical view, the scale, where the 720 px world band sits, and where the HUD, buttons, panels and stage banner go. `paneLayouts()` splits the view into the split-screen panes.
- **16:9** keeps the designed 1280 × 720 frame; the 2P modes always use it (`fixed`).
- **Wider landscape** (a phone showing its browser bars) first crops the empty bottom of the world band, down to MIN_VISIBLE_WORLD_HEIGHT. Then it shows more world to the side, up to MAX_VIEW_WIDTH, and only then adds bars. The floor is lifted to the bottom edge.
- **4:3** shows extra canopy above the band and undergrowth below it.
- **Portrait** shows PORTRAIT_VIEW_WIDTH of world, with the spare height split around the band. The title and results panels and the stage banner go below the band, with text and buttons enlarged. While the monkey hangs, the camera holds its liana's anchor at PORTRAIT_ANCHOR_X, so the whole swing and the next liana stay on screen. Rotating mid-run changes the layout without pausing.
- **Panes.** The world is drawn in panes (`src/render/pane.js`): one for the whole view, or two stacked, clipped strips in split screen. Each has its own background, entity views, camera and death shake.

## Full screen

- **Controls:** a button next to the speaker, and `F`. The whole page goes full screen, using the Fullscreen API or its `webkit` fallback.
- **Touch:** a tap on the button toggles on `pointerup`, because touch browsers don't grant full screen from a touch `pointerdown`.
- **Button state:** the icon follows `fullscreenchange`, so it stays right after the browser's own Esc.
- **Where it's hidden:** where the API is missing (iPhone Safari), and in the home-screen app.
- **No orientation lock.** Leaving full screen doesn't pause.

## Performance and hardening

- **Renderer:** WebGL is forced.
- **Graphics context loss:** a lost context pauses the game with a notice. If it isn't restored within 5 s, a "tap to reload" screen appears.
- **Errors:** a global handler for the game's own errors shows the reload screen instead of a frozen canvas.
- **Drawing cost:**
  - Lianas are redrawn only when their look changes: a swinging liana is straight, so it is drawn once hanging straight down from the origin and turned about its anchor each frame (no new geometry to build and upload); only a liana settling after a release, which bends, redraws every frame.
  - The parallax layers are render groups.
  - The frame is clipped with black bars instead of a mask; only split-screen panes use masks.
- **Budget:** at 4× CPU throttling, per-frame work stays under 6 ms at p95. No frame goes over 16 ms during generation, restarts or deaths.
- **Soak test:** 5,000 gaps (with moving obstacles and bananas), with entity counts and the event queue staying bounded. Rendering stays precise at large world x.
- **Frame rate in the debug view (D):** the first line shows the frame rate, mean and worst frame time over the last second, the number of frames over 34 ms since the start (`slow`) and, where the browser says (Chrome), the JS heap: `60 fps  16.7 ms  worst 21 ms  slow 3  heap 17 MB`.
- **Long-run check** (done once, repeatable with `scripts/longrun.mjs`, which needs `playwright-core` and the dev server and is not part of the suite): a bot that plays perfectly (it solves each grab's release window) drives the real game in headless Chromium, with the frame loop fed 33 ms of game time per frame as fast as it will go and `performance.now()` following that game time, so Pixi's time-based clean-up runs as it would in play; it renders every 90th frame (software GL is the slow part) and samples the heap after a forced GC. Four scenarios of 30 game-minutes (660–940 gaps): solo; solo with slipping, lives and shadow; shared screen; split screen.
  - **Leak found and fixed:** the flight cache (`emptyGapFlights`) kept a list for every exact entry radius it was asked for, about 70 flights of 80 points each. The generator only asks for the five radii of ENTRY_RADII, but the debug view (and the bot) ask for the exact radius of every grab, so with the debug view open the heap grew by 6 MB a game-minute. Only the ENTRY_RADII are cached now.
  - **After the fix:** the heap after a GC is flat: solo 43 → 46 MB over 30 game-minutes (0.1 MB a minute; Pixi's text cache gains a key for every distinct string it draws, such as each score, which is the likely source), shared 43 → 46 MB, solo with everything on 45 → 54 MB (0.4 MB a minute: the shadow's recording, 25 bytes a step, plus the best run kept). Lianas (at most 11), obstacles (at most 10) and scene nodes (160–200) stay bounded, as do the textures (16 → 25).
  - **No slowdown:** the JS side of a frame (sim and view updates, without the GPU) has a median of 0.1–0.2 ms and a p95 of 0.3–0.5 ms in all four, the same in each quarter of the run. A CPU profile of 8 game-minutes finds no hot spot of the game's own: the largest were the lianas' redraws (about 1 % of the samples, which is why they now turn instead), and `flightHits` of the bot's own solving.
  - **Memory:** the production build uses about 15–16 MB of JS heap at the title and after play (the 45 MB seen in the dev server is mostly its unminified source strings). The scripts are 750 kB, 190 kB gzipped, in chunks of which only the WebGL renderer is loaded.
  - **GPU work in a frame** (counted at the WebGL calls): about 28–34 draw calls, 15–18 shader switches and 5–7 buffer uploads. The uploads are the redrawn Graphics: the wings, legs and tails of moving obstacles and animated decorations (a `clear()` and redraw each frame). Turning each limb about a pivot instead would remove them, a bigger change left for later; likewise capping the frame rate on 120 Hz screens (`ticker.maxFPS`), which would halve the GPU work there at the price of smoothness.
  - **Draw calls by layer** (the stage rendered with one layer visible at a time, minute 1 and 5 of a run): sky 1, far/mid/near hills 2 each, canopy 2, floor 2, lianas 3–4, monkeys 3, bananas 0, HUD 1, buttons 3, obstacles and decorations 13–16 (the rest of the 33–37 is the letterbox). Pixi batches a Graphics only if it has under 200 points; the backdrop layers and the larger obstacles (panther, snake, temple, hive) are above that, so each is one draw of its own, which is also why the shader is switched 8–12 times by the obstacles. Forcing `context.batchMode = 'batch'` on every Graphics under 3000 or 20000 floats cut the draws by 3–10 but not the shader switches, and `renderer.render()` cost about 0.1 ms in all three (the browser's timer resolves 0.1 ms). So there is nothing to gain: about 30 draw calls is far below what makes a frame costly, and the static layers are already one draw each.
  - **Drawing between sim steps**: the sim steps at 120 Hz and a frame used to show the latest step, ignoring the fraction `loop.advance()` returns. On a screen that is not a multiple of 120 Hz some frames then got no step and repeated the last picture (with a simulated 144 Hz screen 17% of frames showed no movement of the camera or monkey). Now the camera, the monkeys and the swinging lianas keep the state from before the latest step (`prevX`/`prevY`, `prevAngle`, `Camera.mark()`) and are drawn that fraction of the way to the current one (`render/interpolate.js`); a catch, a respawn or a new run is drawn as it is, not slid to. With it no frame is static at 60, 90 or 144 Hz, and a hanging monkey stays within 2.5 px of the rope (only in the first 0.1 s of a grab, while the grip slides). The picture is on average half a step (4 ms) behind the sim. Obstacles, bananas, the shadow monkey and the debug overlay are still drawn at the step: they move slowly against the camera, but a bird or bat is a candidate if it shows.
- **The HUD asks the game for the bananas taken, not the tally** (`playerBananasTaken` is a lookup; `bananaTally` walks every banana of the run, which grew with it, and the HUD called it every frame).
- **Input edge cases** are unit-tested: keys held across a restart, taps during the results lock, multi-touch, and input held while focus is lost.
- **Reduced motion:** with `prefers-reduced-motion`, the death shake is off.

## Release and deploy

- Vite `base: '/liano/'` for build and preview; the game is served at `https://skogdoom.github.io/liano/`.
- CI runs `npm ci`, `npm test`, `npm run build` and the window-table check on every PR and on `master`. Every push to `master` deploys to Pages.
- The README covers how to play, the controls, local development and the disclaimer. The page has an SVG favicon and a description. The version from `package.json` is shown on the title screen.
- Releases are tagged `vX.Y.Z`, each with a GitHub release. The owner creates the tag and release, because this environment can't push tags.

## Tunables (`src/config.js`)

| Constant | Value | Notes |
|---|---|---|
| SCREEN_WIDTH × SCREEN_HEIGHT | 1280 × 720 | Landscape design frame; other screen shapes derive from it (see Screen layout) |
| WORLD_HEIGHT | 720 | The world band; falling below it is a death |
| ANCHOR_Y | −20 | |
| LIANA_LENGTH (L) | 420 | |
| LIANA_SPACING | 700 | Wide enough that the swings (reach ≈ 322) leave the middle of each gap free |
| SWING_AMPLITUDE | 50° | |
| SWING_PERIOD | 2.6 s | |
| GRAVITY | 600 px/s² | 400 felt too floaty |
| MAX_SLIP_SPEED | 40 px/s | At most (L − 310) / P ≈ 42 px/s, so every grip passes a forward swing low enough on the rope before it is forced off |
| FLOW_GRIP, QUICK_SLIP_SPEED | 0.7 × L, 1000 px/s | Catches above FLOW_GRIP slide quickly down to it |
| HOLD_GRIP | 350 px (about 0.83 × L) | With slipping off (G) the grip holds where it catches but no higher; the shallowest grip that keeps every sampled gap's window |
| HOLD_SLIDE_TIME | 0.25 s | Longest slide down to HOLD_GRIP; it starts at the catch speed along the rope and brakes evenly |
| TEMPLE_MIN_GAP, TEMPLE_VARIANTS | 6, 4 | The temple (one a day/night cycle, see Obstacles) is never among the first 6 obstacles, and has 4 looks |
| SLIP_OFF_PHASE | 0.11 × P after the bottom, swinging right | The forced release comes mid-way through the forward window (about 0.05–0.165 × P) |
| ENTRY_RADII | [0.35, 0.5, 0.65, 0.8, 0.95] × L | The entry radii the solver checks |
| MAX_ENTRY_RADIUS | 0.95 × L | Lower catches grip here |
| START_GRIP | 0.7 × L | The grip at the start of a run |
| TIP_WARNING_TIME | 1 s | The vine end blinks this long before the forced release, faster in the last half |
| MONKEY_RADIUS | 22 | |
| OBSTACLE_Y_RANGE | [140, 375] | Heights ~[195, 315] are rejected by swing clearance |
| LIANA_CLEARANCE | 6 | Extra gap between an obstacle and a swept area, beyond MONKEY_RADIUS |
| MIN_RELEASE_WINDOW_MS | 90 | Stage 1; later stages per STAGES |
| STAGES | see Difficulty stages | First obstacle, shortest window, moving share and obstacle scale per stage |
| HIGH_BELOW_Y, STAGES[].high | 255; 0.5 in Stages 1–3, null after | Obstacles above the line hang from the canopy (high); the share of a stage's gaps that aim for a high obstacle |
| GRADE_BOUNDS | 0.12, 0.19, 0.27 | Blocked shares where grades 2, 3 and 4 start |
| STAGES[].grades, LATER_GRADE_ODDS, LATER_GRADE_STAGES | see Obstacle grades | Odds of aiming for each grade per stage, and where they head after the last stage over 8 stages |
| MOVING_GRADED_TRIES, STATIC_TRIES | 3, 40 | Moving candidates graded, and static draws, per gap |
| GRADE_ARRIVAL_STEP, GRADE_RADIUS_STEP | 4, 2 | A moving obstacle's grade samples every 4th arrival and every 2nd entry radius |
| STAGE_LENGTH_AFTER | 20 obstacles | After the last stage, the stage number (the time of day) counts on this often |
| LATER_WINDOW_STEP_MS, LATER_MIN_WINDOW_MS | 2 ms per stage, down to 40 ms | The shortest release window of the stages after the last: 60 ms at Stage 4, 40 ms from Stage 14 (about 5 steps) |
| LATER_MOVING_STEP, LATER_MOVING_MAX | +4 points per stage, up to 75 % | The moving share of those stages: 55 % at Stage 4, 75 % from Stage 9 |
| MOVING_FROM | 6 | Obstacles 1–5 are always static |
| MOVING_PERIOD_RANGE | 1.5–3.0 s | |
| SPIDER_LOW_RANGE, SPIDER_TRAVEL_RANGE | 175–212, 80–150 px | Lowest point and climb |
| SNAKE_HIGH_RANGE, SNAKE_TRAVEL_RANGE | 290–320, 90–160 px | Highest point and slide |
| BIRD_Y_RANGE, BIRD_BOB | 330–390, 8 px | Patrol bounds are derived from the swings |
| BANANA_CHANCE | 0.25 per gap, as a candidate | About 14 % of gaps get a banana, at least 3 apart |
| BANANA_RADIUS | 14 | Drawn at 1.4× |
| LIVES_2P | 3 | Lives each player starts with in the 2P modes, and in 1P with lives on |
| KEYS.shadow | S | The shadow monkey toggle (see Shadow monkey) |
| BANANAS_PER_HEART, MAX_LIVES | 5, 99 | Bananas taken per heart; the most lives a player can have |
| RESPAWN_GRIP | 0.7 × L | |
| RESPAWN_DELAY_MS | 1000 | The dead monkey tumbles this long before respawning |
| RESPAWN_INVULN_MS | 1500 | |
| SHARED_ZOOM, SHARED_LEADER_X | 0.75, 0.5 × width | Shared screen's scale (a view of 1280 / 0.75 ≈ 1707 px of world) and leader position: the next liana is in view ahead, and over a liana behind |
| CAMERA_TARGET_X | 0.35 × width | Landscape 1P; split panes keep the same fraction |
| CAMERA_LERP | 8 /s | |
| GAMEOVER_INPUT_LOCK_MS | 400 | |
| DEATH_BOUNCE, DEATH_POP | 0.4, 260 px/s | Death feedback |
| DEATH_SHAKE_PX, DEATH_SHAKE_TIME | 9, 0.35 s | |
| MAX_RESOLUTION | 2 | Canvas pixels per CSS pixel |
| MIN_VISIBLE_WORLD_HEIGHT, MAX_VIEW_WIDTH | 570, 1600 | Flexible landscape frame |
| PORTRAIT_VIEW_WIDTH, PORTRAIT_ANCHOR_X | 1100, 0.3 | Portrait |
| KEYS | Space (1P); Enter (start); A, L (P1, P2); 1, 2, 3 (mode); Esc (menu); P (pause); M (mute); D (debug); G (slipping) | F (full screen) is bound in `fullscreen.js` |

## Project structure

```
liano/
  index.html                # viewport, notice and error overlays
  package.json
  vite.config.js            # base /liano/ for build and preview
  .github/workflows/ci.yml  # test, build, table check; Pages deploy on master
  public/                   # favicon.svg, manifest.webmanifest, icons/
  scripts/
    build-windows.mjs       # regenerates the window table (runs before build)
    make-icons.mjs          # favicon and app icons from one set of shapes
  src/
    main.js                 # app, layout, panes, loop and frame wiring
    config.js
    layout.js               # every screen shape: frame, scale, band, HUD, panels, panes
    loop.js                 # fixed-step loop
    input.js                # keys by role and taps; repeat filtering; toggles
    pause.js                # blur, hidden page, held reasons (graphics, manual), resume grace
    fullscreen.js
    fatal.js                # error and notice overlays
    obstacleWorker.js       # generates obstacles and bananas off the main thread
    obstaclePrefetch.js     # asks the worker for the gaps ahead; falls back to the same generation
    audio/
      recipes.js
      sounds.js             # sim events → recipes
      player.js
    sim/
      rng.js
      physics.js            # pendulum, ballistic step, hit tests
      liana.js              # swing, settle
      monkey.js             # hanging/airborne/dead, grip, quick slide and slip, held grip
      obstacle.js           # static and moving obstacles, scaled hitboxes, motion
      banana.js
      stages.js             # stage by obstacle index, moving share
      generator.js          # lianas, obstacles and bananas, reroll loop
      feasibility.js        # the solver (tests and table build too)
      windowTable.js/.json  # build-time windows for static gaps
      world.js              # N monkeys, lives and respawn, step(dt), events
      sharedView.js         # shared screen's leader camera, left edge, respawn liana
      match.js              # mode rules: players, lives, keys
      game.js               # TITLE, PLAYING, RESULTS; the match's worlds
    render/
      pane.js               # one world drawn in one rect: background, entities, camera, shake
      background.js         # parallax layers, taller views, stage tint
      lianaView.js          # vine, leaves, tip warning; green or golden
      monkeyView.js         # per-player palette, invulnerable blink
      obstacleViews.js      # static art, animated spider, snake, bird, bat, blue bird and purple bird
      bananaView.js         # bananas, "+1" pops
      camera.js             # easing camera, portrait anchor
      hud.js                # 1P and 2P variants
      overlays.js           # title and mode picker, stage banners, results, pause, "is out"
      debugOverlay.js
      muteButton.js
      fullscreenButton.js
      shake.js
      shapes.js
  tests/                    # unit tests for all of the above (Vitest)
```

## Visual style

Simple stylized vector art drawn in code with Pixi `Graphics`. No image assets.

- **Monkeys.**
  - Look: round body and head, lighter face and belly, curled tail, one arm reaching up to the grip point.
  - Player colors: P1 brown, P2 ginger.
  - Poses: hanging, airborne spread, dead tumble. A respawned monkey blinks while invulnerable.
- **Lianas.** A green polyline with leaves (P2's in shared screen golden), which bends slightly while settling. The grip slide is visible, and the lower vine blinks yellow near the forced release.
- **Static obstacles.**
  - Branch: brown limb with a leaf tuft, and sometimes a decoration (see Branch decorations):
    - Perched bird: a small bird in the colours of one of the flying birds (red, blue or purple, at random; not the owl; none at night), on top of the limb, facing left or right at random; every couple of seconds it dips its head to peck, and its tail flicks.
    - Snake: a green snake wrapped around the limb in three or four coils (on a standing branch, in about half the cases, vertically around the trunk it stands on instead), its tail hanging off one end and its head rising from the other, facing left or right at random; the neck sways and now and then the tongue flicks.
    - Bird's nest (a decoration, not an animal): a woven bowl of twigs on top of the limb, facing either way. What it holds is picked at random, in equal shares: nothing (a dry leaf), a speckled blue egg that rocks now and then, or a hatched egg: a yellow chick peeping from its cracked shell, bobbing, with the cap of the shell beside it.
    - Panther: a black panther lying along the top of the limb with its head up, watching, with yellow slit eyes. Its flanks rise and fall as it breathes, its tail hangs down off the end of the limb and swishes, an ear flicks now and then and it blinks. Faces either way.
    - Hanging bat (night only): a small bat (one of the BAT_LOOKS) roosting upside down from the underside of the limb, wrapped in its wings like a cloak with scalloped edges. It sways a little, an ear twitches now and then, and it opens its red eyes for a moment every few seconds.
    - Owl (night only): a round brown owl perched on top of the limb, with ear tufts, big yellow eyes in a pale face and a chevroned belly. Its face slides slowly from side to side as if the head were turning, the pupils lead the turn, its eyes close for a moment now and then, and it puffs a little as it breathes.
    - Flowers: a small cluster of three to five on stems with a leaf or two, growing from the top of the limb, each in a colour of its own (red, pink, yellow, purple, white, orange or blue), swaying in the breeze, each out of step with the others.
    - Coconuts: a bunch of two or three brown, hairy coconuts, each with its three dark "eyes", hanging from the underside of the limb on short stems under a small green frond, swaying a little, each out of step with the others.
    - Hanging monkey: a small grey monkey hanging from the underside of the limb by its hands, swaying like a pendulum, with its legs swinging, its tail curling out to one side and an occasional blink. It hangs below the limb, clear of the vines it hangs from.
  - Thorn bush: dark blob with thorns.
  - Rock: grey polygon on a small ledge.
  - Temple: a stepped pyramid with a shrine on top and a staircase up the middle of its front, on a platform of mouldings and recessed panels, drawn big (a door taller than the monkey) and buried: only the top shows, the lower part lost in a soft dark-green mist that thickens toward the ground (nested ellipses, so there is no edge to see) and a thick fringe of ferns and leaves wider than the temple, with moss, vines and ferns on every tier. The temple takes the stage tint like the background (it stands between the layers it is tinted on), and its fern fringe is in deep greens, so neither stands out in the dark stages. Four looks, one of which each temple has: limestone with a stepped-fret frieze round the shrine; sandstone with a roof comb over the shrine; mossy grey-green stone with serpent heads on the stairs, moss and ferns; and dark basalt with gold inlay and two braziers whose flames flicker. The flames are not tinted with the stone: they stay bright in the dark stages and there light up the stone round each brazier with a warm glow (sixteen thin additive circles, so no rings; strength from the stage's tint: none by day, a little in the late afternoon and at dawn, about half at dusk, full at night; it flickers with the flame).
  - Beehive: a teardrop paper nest in gold bands with a dark entrance, hanging from a vine, or from an arm off a trunk when it is low (its hitbox is three stacked circles, widest in the middle). A handful of bees buzz around it; they are scenery, and the animation takes the world time, so they stop while the game is paused.
  - High ones hang from the canopy on vines; low ones stand on a trunk or pole (the beehive hangs from an arm off the trunk).
- **Moving obstacles.**
  - Spider: dark body with a red mark and wriggling legs, on a thin thread.
  - Snake: green coils on a leafy stalk, its head pointing the way it climbs.
  - Bird: red body with a yellow belly and flapping wings, facing the way it flies.
  - Purple bird: a purple body with a pale belly, a crest and a tail feather, flapping, facing the way it is flying and pitched along the circle.
  - Blue bird: a blue body with a pale belly and a small crest, flapping and pitched along its climb or dive, facing left or right by gap.
  - Bat: a purple furry body with pointed ears and red eyes, and a scalloped membrane wing that flutters fast, facing the way it flies.
- **Banana.** A single tilted banana, tapering to both ends, with a lighter ridge, a stem and a dark tip, a gentle bob, and a glint near the stem that fades in and out while it waits to be taken. The same drawing is the icon in the HUD and on the results.
- **Background.** Three parallax layers, a canopy strip at the top, and a dark jungle floor band at the bottom. Taller views extend the forest upward and the undergrowth downward. The tint shifts per stage, through a five-step day (day, late afternoon, dusk, night, dawn) that repeats.
- **HUD and buttons.** Readable text with a subtle shadow, plus the speaker and fullscreen icons.
- **Readability.** Hitboxes visually match the drawings. Check this with the debug overlay.

## Milestones

### Done: v1 (milestones 1–14)

**1. Scaffold.** Vite + Pixi setup, letterboxed scaling, fixed-step loop, state machine with placeholder overlays, input module.
- [x] `npm run dev` shows a 1280×720 scaled canvas
- [x] Space transitions READY → PLAYING; held Space does not repeat
- [x] `npm test` runs

**2. Swing, release, grab.** Liana and monkey sim with placeholder rendering (lines and circles). Grip slide. Excluded-liana rule.
- [x] Monkey swings with fixed amplitude/period regardless of arrival speed
- [x] Release produces the correct tangential velocity (unit tested)
- [x] Monkey auto-grabs the next liana on contact; cannot regrab the one just released
- [x] Backward release can land on the previous liana

**3. World, camera, fall.** Lazy generation/culling of lianas, horizontal camera follow, fall detection, game over and restart.
- [x] Endless lianas in both directions as needed; entity count stays bounded
- [x] Falling below the screen ends the run; restart works after the input lock

**4. Obstacles and scoring.** Obstacle types with hitboxes, collision, per-obstacle scoring, HUD with session best.
- [x] Obstacle hit ends the run (including while hanging)
- [x] Each obstacle scores once; backward/forward re-crossing does not re-score (unit tested)
- [x] Best score survives restarts, resets on page reload

**5. Feasibility and tuning.** Release-window solver, generator rerolls, fairness tests. Tune constants.
- [x] Test: for 1,000 seeded gaps, every generated gap has a valid window ≥ MIN_RELEASE_WINDOW_MS
- [x] Debug overlay (toggle with `D`) draws hitboxes, the predicted trajectory, and the valid release window for the current gap

**6. Art.** Replace placeholders with vector art, parallax background, monkey poses, liana settle sway, off-screen indicator.
- [x] Hitboxes still match visuals (check with debug overlay)
- [ ] Stable 60 fps on a mid-range laptop (not yet checked on hardware; per-frame update + render submission measured at 1.0 ms median, 2.0 ms p95 in headless Chromium)

**7. Polish.** Title and game-over overlays with score, small death feedback (monkey tumble, brief screen shake), pause simulation on window blur.
- [x] Full loop: title → play → die → restart with no reload

**9. Touch and mobile.** Pointer input, viewport and gesture handling, landscape-only overlay (later removed by 14), input-dependent prompts, resolution cap, manifest and icon.
- [ ] Tap starts, releases and restarts on phone and iPad (Playwright touch emulation, then real devices via `npm run dev:host`) — emulation passes; works on an iPhone 13 mini in landscape and portrait (owner); an iPad still to check
- [x] No zoom, scroll or text selection from taps; the portrait overlay pauses the game (overlay later removed by 14) — on an iPhone 13 mini in landscape, a double tap or a tap in flight briefly shifted the page up under the tab bar; fixed in v1.2.1 by cancelling the canvas's touch events (confirmed on the phone by the owner)
- [x] The press that resumes from pause is not also used as a press (unit tested)

**10. Sound.** Recipes, player, mute toggle and button.
- [x] Each sound fires on its event and at most once per event (unit tested against sim events)
- [x] No audio before the first press; audio suspends while paused
- [x] Mute toggles with `M` and the on-screen button (top-left speaker)

**11. Performance and hardening.** Precomputed window table, liana redraw on change, renderer and GPU-context handling, error overlay, soak test, input edge cases.
- [x] No sim step spends time in the solver during play (table lookup only; unit tested)
- [x] No frame over 16 ms during generation: a sim step that generates new gaps now takes at most 0.6 ms (1 ms at 4× throttling), down from 12.4 ms
- [ ] At 4× CPU throttling: p95 frame work under 6 ms — our update is 1.3 ms median and 4 ms at p95; rendering in headless Chromium (software WebGL, fill-bound) is 3.1 ms median and 6.6 ms at p95 with rare frames over 16 ms. Still to check on a real device
- [x] Soak test: 5,000 gaps with bounded entities and events (unit tested)
- [ ] No heap growth across 20 restarts — heap after garbage collection is 14.33 MB after 5 restarts, 14.72 MB after 25, 14.90 MB after 45: small and slowing (warm-up rather than a leak), but not flat
- [x] Losing the GPU context pauses and recovers (simulated with `WEBGL_lose_context`); if it is not restored within 5 s, the reload message appears

**8. Deploy pipeline.** CI on PRs and pushes, Pages deploy on `master`, `base` path.
- [x] PRs show a passing test and build check (first run on skogdoom/liano#3)
- [x] The game loads and plays at `https://skogdoom.github.io/liano/` (first deploy from the master run for skogdoom/liano#4; checked by the owner)

**12. Release v1.0.0.** README, favicon and meta, version on the title screen, tag and GitHub release.
- [x] v1.0.0 is live on Pages and tagged, with release notes (https://github.com/skogdoom/liano/releases/tag/v1.0.0)

**13. Fullscreen.** Button, `F` key, state sync, hidden where unsupported.
- [ ] The button and `F` enter and leave full screen in desktop Chrome, Firefox and Safari, in Android Chrome and on iPad. The icon follows the state, including after Esc — passes in Chromium (mouse, `F`, and a touch tap in Android emulation; the icon follows an exit made outside the game); the other browsers and real devices still to check
- [x] Neither the button nor `F` releases the monkey or starts a run (unit tested; also checked in Chromium)
- [ ] The button is hidden on iPhone Safari and in the home-screen app — passes with the API removed and with `display-mode: standalone` faked in Chromium; real devices still to check
- [ ] The game fills the screen after entering and leaving full screen, and after rotating while in full screen
- [x] v1.1.0 is live on Pages and tagged, with release notes (tag `v1.1.0` on the #7 merge commit; release at https://github.com/skogdoom/liano/releases/tag/v1.1.0)

**14. Portrait mode and a flexible frame.** World/screen split, layout module (portrait and flexible landscape), anchor-following portrait camera, extended background, HUD and panel layouts, rotate overlay removed. (skogdoom/liano#8.)
- [ ] Held upright, a phone and an iPad play a full run: start, release, die, restart (Playwright emulation, then real devices) — passes in iPhone 13 and iPad emulation; real devices still to check
- [x] The whole swing and the next liana are on screen while the monkey hangs, in portrait on the narrowest supported phone (unit tested against the layout and camera, 320 × 568 up to iPads)
- [x] Rotating mid-run switches layout without pausing, losing the run or dropping a press (checked in iPhone emulation by resizing the viewport mid-run; the first tap after it releases the monkey)
- [x] Landscape at exactly 16:9 looks and plays as before (screenshots compared at 1280 × 720 and 1920 × 1080; the layout gives the old frame, camera and panel spots, unit tested)
- [ ] A landscape phone with the browser bars showing fills the screen with no black bars, with the game drawn larger than a 16:9 letterbox would allow (unit tested against the layout, then on a real phone) — unit tested and checked at 844 × 340 in emulation (drawn at 0.60× instead of 0.47×); a real phone still to check
- [ ] The monkey is readable on a real phone in portrait (see decision 11)
- [x] v1.2.0 is live on Pages and tagged, with release notes (tag `v1.2.0` on master after #8 and #9; release at https://github.com/skogdoom/liano/releases/tag/v1.2.0)

### Done: v2 (milestones 15–22)

Each milestone ended in a runnable, tested state, with every v1 feature still working: touch, sound, full screen, portrait, the flexible frame and hardening. Released as v2.0.0 (skogdoom/liano#13).

**15. Modes and N monkeys.** TITLE/PLAYING/RESULTS states, title mode picker (only 1P enabled for now), per-player keys in the input module, a world holding N monkeys (N = 1 for now), `match.js` for mode rules.
- [x] Held keys don't repeat for any action key; the mode picker works with keys and, for 1P, with a tap (unit tested; checked in Chromium, including touch, where the picker is hidden and a tap starts 1P)
- [x] 1P plays exactly as in v1 (existing tests pass; the only edits are the renamed states TITLE and RESULTS and the new `player` field on events)

**16. Slip and forced release.** Grip slip and forced release replace the fixed grip slide. Release velocity gains the radial part. The feasibility solver and the window table cover entry radii. The debug overlay shows the slip and the forced-release point.
- [x] Grab at the contact radius; slip reaches the tip and forces a release
- [x] Release velocity includes the radial component (unit tested)
- [x] The just-released liana cannot be regrabbed; backward flight can land on the previous liana
- [x] 1,000 seeded gaps: all feasible for every entry radius

**17. Moving obstacles.** Spider, snake, bird with periodic motion; the solver gains the phase dimension and runs in a worker; art for all three; a "bong" pitch for each.
- [x] 1,000 seeded gaps from stage 2+: all feasible for every entry radius × phase (tested from obstacle 6, where moving obstacles now start)
- [x] No moving obstacle's path intersects a swing arc; bird patrol bounds are asserted in the generator
- [x] No frame over 16 ms from generation
- [x] The moving solver agrees with the real world for every release step (sampled arrivals)
- Note: the stage table (STAGES) was added here for the moving share; M18 wires up the rest of it.

**18. Difficulty stages.** Stage table, stage banner, background tint, obstacle scaling.
- [x] Stage is derived from obstacle index; banana points don't affect it (unit tested)
- [x] Each stage's obstacles use its scale and shortest release window; 1,000 seeded gaps across all stages pass their stage's window (the window table has a section per scale)
- [x] Banner ("Stage 2 · Late afternoon") low in the band, clear of the swings; the background tint eases over 2.5 s and starts over at day on a new run
- Notes: a stage starts on grabbing the liana before its first obstacle (obstacle #i is in gap i). At scale 1.3 a branch fits only at y 371–375, so stage-4 branches almost always sit at the bottom.

**19. Bananas.** Placement, pickup, boost counter, bonus points, HUD indicator; the solver gains the boosted variant.
- [x] Gaps within BOOST_GRABS after a banana pass both normal and boosted checks
- [x] Boost resets to BOOST_GRABS on repeat pickup and clears on death
- Notes: whether a gap has a banana depends only on (seed, gap) (a candidate with BANANA_CHANCE 0.25, dropped if either of the two gaps before is a candidate: about 14 % of gaps, at least 3 apart), so an obstacle knows whether to pass the boosted check without generating bananas. A banana sits on a flight one or two release steps inside either end of a clearing release window. The boosted period is rounded to 250 steps (factor 1.248) for the slip timing. Bananas are generated in the worker with the obstacles. No pickup sound; a "+3" rises where one was taken.

**20. 2P split screen.** Two worlds with one seed, two viewports, lives, respawn with invulnerability, per-pane HUD, results screen.
- [x] A player with no lives left stops; the other continues; the winner is decided by totals
- [x] Two worlds with one seed in stacked 1280×360 panes at 0.5 scale (each clipped, with its own camera, background, tint and stage banner); P2's monkey is ginger
- [x] Lives: a lost life tumbles for RESPAWN_DELAY_MS, then respawns on the last liana grabbed at RESPAWN_GRIP, blinking and invulnerable to obstacles for RESPAWN_INVULN_MS; boosts are lost
- [x] Per-pane HUD (score and hearts, OUT), "P1 is out" in the pane, results panel with the winner or a draw; the session best is for 1P only
- Notes: the off-screen arrow is for single player only.

**21. 2P shared screen.** Leader camera, left-edge elimination, respawn on the leftmost fully visible liana, shared lianas.
- [x] Two monkeys can hang on the same liana, each at its own grip radius, in the same swing phase
- [x] The camera handles a leader death without snapping
- [x] A monkey left behind the left edge loses a life and respawns on the leftmost liana fully in view
- Notes: the leader sits at SHARED_LEADER_X (62 %) of the view, and while it hangs the camera follows its liana rather than its swing, so a monkey one liana behind stays in view. A hanging monkey is only left behind once its liana is off the left edge too (swinging back out of view is fine); a flying one by its position. A banana boosts both monkeys; a monkey joining a boosted swing uses one of its boosted grabs, so the two counts stay in step, and one joining an unboosted swing keeps its boost. The leader camera is part of the rules (src/sim/sharedView.js), since it decides who is left behind.

**22. Polish.** Key-binding hints on the title screen; death feedback and pause for 2P (both already exist for 1P).
- [x] Full loop in every mode: title → play → results → title, with no reload (Esc from a run or the results goes to the title, a quit 1P run still counting for the best; 1, 2, 3 from the results go to it with that mode)
- [x] P pauses and resumes a run in every mode ("Press P to resume"), not the title screen or the results; blur still pauses too
- [x] Title hints name each player's key in 2P ("P1 A · P2 L · let go"); the results prompt offers Esc for the menu
- [x] Death feedback per pane: every death shakes its pane (each lost life in 2P), off with reduced motion; pause covers every mode
- [x] Shared screen starts player 2 lower on the first liana (START_GRIP_STEP), so neither monkey hides the other

### After v2.0.0

**23. Own lianas in shared screen.** Shared lianas made shared screen almost impossible to play; each monkey now has its own set.
- [x] Two liana sets at the same anchors (green for P1, golden for P2); each monkey grabs only its own and swings it on its own (unit tested)
- [x] A banana boosts only its taker again; respawns use the monkey's own set
- [x] At rest the two vines of a pair bow to opposite sides, so both show
- [x] A wider view (SHARED_ZOOM 0.75) with the leader in the middle; both monkeys start at START_GRIP; bananas boost less (SHARED_BOOST_FACTOR 1.12), and the gaps after a banana pass that swing too

**24. Slip and banana toggles.** To test the pacing without them (the game starts without both): `G` turns slipping on and off, `B` bananas (see Trying without slip or bananas). Version 2.2.0-dev.0.
- [x] Slipping off: a quick slide to HOLD_GRIP, held still, and a tired forced release on the step a slip would have ended (unit tested)
- [x] Held grips keep every sampled generated gap's window; the jungle is the same with either setting
- [x] Bananas off: none shown or taken, boosts end; back on, the untaken ones return
- [x] Both apply to every world, carry over to later matches, and reset on reload; a title hint, and a settings note in the debug view

**25. The day goes on.** The stage number and the sky keep cycling after Stage 4: night, dawn, day, late afternoon, dusk, night, ... every 20 obstacles, and the difficulty keeps rising subtly up to a limit (see Difficulty stages).
- [x] `stageFor` counts on every STAGE_LENGTH_AFTER obstacles past the last stage; the world raises a `stage` event for each
- [x] Each such stage has a 2 ms shorter shortest window (down to 40 ms) and 4 points more moving obstacles (up to 75 %), at Stage 4's obstacle scale; stages up to well past the limit are checked passable, boosted swings included (tested)
- [x] A dawn tint and name; the tint and banner follow the stage number modulo the five times of day
- [x] The window table is unchanged; generation stays cheap (about 1.5 ms per obstacle on average in the late stages)

**26. Holding where caught.** With slipping off, the grip no longer snaps to one height on every catch.
- [x] A catch from HOLD_GRIP down holds where it caught; the grip never moves up (unit tested)
- [x] A catch above it slides down, carrying on the catch speed and braking to a stop within HOLD_SLIDE_TIME (unit tested)
- [x] Before the run and on a respawn the monkey hangs at HOLD_GRIP; switching G on the title screen moves it there
- [x] Every sampled generated gap keeps its windows with held grips (tested)

**27. Bananas as a challenge.** Bananas no longer speed up the swing or add points; each player's are counted against the bananas passed.
- [x] No boost: lianas always swing with SWING_PERIOD; the solver drops the boosted swing variants and the window table its boosted sections (rebuilt, so the jungle of a seed changes a little)
- [x] No points: the score is one per gap crossed; a "+1" pops where a banana is taken
- [x] A tally per player, "taken / passed", on the results (the HUD shows just the taken count under each score); in shared screen passed is the same for both and a banana goes to the first to reach it (unit tested)
- [x] B and the bananas-off setting are gone; the debug text shows the slipping setting

**28. Difficulty grades.** Every obstacle is graded 1–4 by how much release timing it blocks, each stage aims for grades by its own odds, no grade appears before its stage, and the late levels keep all four (see Obstacle grades).
- [x] The window table holds each static obstacle's blocked share; `Obstacle.grade` is carried to the worker and shown in the debug view
- [x] `createObstacle` aims for a grade per gap (own random stream), caps it by the stage, and falls back to the other kind of obstacle, then the closest static one
- [x] Tests: the grades match the solver; none above the stage's highest; grade 4 only from Stage 4; the mean grade rises stage by stage; all four stay in the late levels
- [x] High and low are about even in Stages 1–3 (`high` per stage; the aimed side picks the height range or the moving types)
- [x] The whole jungle changes for every seed (static types and heights are drawn by grade)

**29. Extra lives.** A lives toggle for single player (`H`) and hearts in every game with lives: see Lives and hearts.
- [x] `Game.toggleLives()` (title screen, 1P only), `World.setLives`, a best score per setting
- [x] `World` turns the next banana into a heart every BANANAS_PER_HEART bananas (pending when none is generated yet) and gives the life on pickup, capped at MAX_LIVES; hearts count as no banana
- [x] A heart row in the HUD (filled, outlined, five plus a count), the heart on the field, a "+1 ♥" pop and a sound of its own
- [x] The title shows the setting; `H` is a toggle key that never counts as a press

**30. Shadow monkey.** The best previous game replayed as a shadow, on a level fixed for the session (see Shadow monkey).
- [x] `S` toggle on the title screen (`Game.toggleShadow`, 1P only, off by default), shown on the settings line
- [x] A fixed seed while it is on, and a fresh world at the start of each run, so the same inputs give the same run
- [x] `ShadowRun` records the monkey every sim step; the best run per setting of lives and slipping is the next game's shadow
- [x] The pane draws the shadow behind the monkey: grey and see-through, on a grey liana of its own while it hangs on one (`ShadowView`)

## Design decisions

1. **Swing starts at vertical, in the direction of travel.** Released lianas settle back to vertical with a damped cosmetic sway.
2. **Empty start gaps.** The first gap has no obstacle, and neither does the gap behind the start liana, since the title-screen swing passes over it.
3. **Every generated gap is passable** with a minimum human-reasonable release window, sampled over entry radii, arrival phases and swing variants.
4. **The camera is horizontal-only.** In 1P an arrow above the top edge shows the monkey when it is out of view.
5. **Game flow:** the title screen shows the monkeys swinging on the first liana. On the results, input is locked for 400 ms. Esc and the mode keys lead back to the title screen.
6. **Taps are presses.** One `pointerdown` is one press, extra fingers are extra presses, and `pointercancel` is ignored.
7. **Sound** is on by default from the first press, and only deaths have sounds.
8. **Reduced motion** is respected (no death shake).
9. **Full screen:** a button and `F`, hidden where unsupported, with no orientation lock. Leaving full screen doesn't pause.
10. **Portrait and the flexible frame** follow the aspect ratio, not the device. Same game in every shape, so scores are comparable. Rotating mid-run doesn't pause.
11. **Size trade-off in portrait:** the monkey is about 16 CSS px across on a phone. If that's too small on real phones, reconsider; don't scale the art away from the hitbox.
12. **Forced release at the tip, not death,** timed to be a hop to the next liana over a clear gap.
13. **A quick slide to a flowing grip:** a catch high on the rope slides down to where the next forward swing can reach the next liana, so the jumps keep flowing.
14. **Scoring per gap crossed,** on a forward grab of its far liana (a bird's x isn't fixed, so "passing an obstacle" is measured at the gap boundary). Flying past without reaching the liana doesn't score.
15. **Difficulty keyed on obstacle index**, not score, in four stages. The day cycle goes on after them (dawn, then day again), and the difficulty keeps rising a little each stage up to a limit (shorter windows, more moving obstacles).
16. **Moving obstacles never reach into a swing,** which confines them to the few bands the swings leave free.
17. **Single player has 1 life,** unless lives are turned on (`H` on the title screen, off by default and not available on touch devices). The 2P modes always have them.
18. **2P keys A and L**, avoiding Shift because of Windows Sticky Keys. They don't clash with `M`, `F`, `D` or `P`.
19. **2P modes are keyboard-only and use the 16:9 frame.** Portrait and the flexible frame are for 1P.
20. **Bananas are a side challenge,** counted per player against the bananas passed, without points or a boost, so they never change the pacing or the score.
21. **Shared screen: each monkey has its own lianas** at the same places, and the monkeys don't collide. The leader camera is part of the rules.
22. **The fairness guarantee is sampled, not proven**, and doesn't cover respawn edge cases.
23. **Split-screen panes render at 0.5 scale** with a wider horizontal view.

## Out of scope

Persistent high scores, online multiplayer, more than 2 players, touch controls for 2P, swing-speed or slip-speed ramps, a separate per-liana countdown timer, menus beyond the title and results screens, music.
