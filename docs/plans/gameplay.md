# Gameplay, controls and screens

Part of the [Liano plan](../../PLAN.md). The rules of the game, its modes and controls, sound, touch, the screen layouts and the design decisions behind them. Everything here holds for both art packs. The tunables these rules refer to are listed in [architecture.md](architecture.md#tunables-srcconfigjs); the look of the game is in [art-pipeline.md](art-pipeline.md).

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
  - `D` toggles the debug overlay (frame rate and heap on its first line). In split screen each pane gets its own hitboxes, flight path and release window, and its player's numbers (`P1`, `P2`) at the top of the pane; the first pane's text sits below the shared lines (frame rate, state, score, slipping, sound). In shared screen it follows player 1's monkey.
  - `G` turns slipping off and on (see Trying without slipping).
  - `H` (for hearts) turns lives on and off for 1P, on the title screen only (see Lives and hearts).
  - `S` (for shadow) turns the shadow monkey on and off for 1P, on the title screen only (see Shadow monkey).
  - None of these ever counts as a game press.
- **Key rules.** Keys are defined in `config.js` (`KEYS`). Shift is avoided: on Windows, pressing it five times opens the Sticky Keys dialog. Key auto-repeat (`event.repeat`) is ignored for every key.
- **Presses and pause.** Presses while paused, or within 250 ms of resuming, are ignored.
- **Taps.** Each new finger or primary mouse button is one press.
- **Config** (title screen, `C`): rendering quality (`1` Performance, `2` Balanced, `3` Sharp, `A` Auto: canvas pixels per CSS pixel of 1, 1.5, 2 or automatic) and **Classic graphics: On/Off** (`X` while Config is open; Off, the cartoon pack, is the default). Both persist and reload the game when changed, keeping the match settings; see [art-pipeline.md](art-pipeline.md#art-packs-and-the-classic-graphics-setting).

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
| Scoring | +1 per obstacle gap crossed: the gap scores when the monkey, moving forward, grabs the liana on its far side. Swinging or flying past without reaching that liana does not score. Each gap scores once per monkey (flying back and forth does not re-score). Bananas add no points. |
| HUD | Top-right. 1P shows the score and session best. 2P shows each player's score and hearts (OUT when none are left): in split screen at the top of each pane, in shared screen side by side. The speaker and fullscreen buttons sit top-left. All of these stay inside the safe area (notch). |

## Grip and slip

- On grab the liana is vertical (θ = 0). The swing starts in the direction of the monkey's horizontal velocity: θ(t) = dir · A · sin(ω·t), where ω = 2π / period.
- The grip starts at the contact radius r₀ (at most MAX_ENTRY_RADIUS, so catching the very tip still leaves a forward swing).
- A release reaches the next liana only from about 290–310 px down the rope. So a catch higher than FLOW_GRIP first slides quickly down to it at QUICK_SLIP_SPEED. Every catch then has a release window on its first forward swing (about 0.2 s after the grab). The quick slide does not add to the release velocity.
- Then the grip slips at a steady speed s: r(t) = min(r_flow + s·t, L). Each grip gets its own s, so that it reaches the tip at SLIP_OFF_PHASE (0.08 of a period after the bottom): on the upswing to the right, near the start of the forward release window (which opens at 0.04–0.07 and closes at about 0.165). A held grip (slipping off, G) is forced off at HOLD_OFF_PHASE (0.11), the middle of the window. s is the fastest speed up to MAX_SLIP_SPEED that lands on that phase, so it varies with where the liana was caught (about 7–38 px/s).
- The forced release is therefore a hop to the next liana over a clear gap, and an obstacle in the way stops it. An idle player is carried forward over clear gaps, but not far: at SLIP_OFF_PHASE 0.08 a player who never presses falls after a median of 15 obstacles (at most 30 in 100 seeds). At the middle of the window (0.11, as it was) it was a median of 53 and up to 82, because the flights released there all cross the gap at much the same height and only the hardest obstacles (grade 4, all of them low, from Stage 4) stop them; at 0.09, 0.10, 0.13 and 0.15 the median was 31, 41, 69 and 97. Held, a passive monkey falls after a median of 12, at the middle phase; at 0.08 it got 113, so a held grip keeps HOLD_OFF_PHASE. About one seed in eight ends within the first three obstacles for such a player; the first gaps are not kept safe for it.
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

The day goes on past Stage 4: the stage number and the time of day keep counting every STAGE_LENGTH_AFTER (20) obstacles, from obstacle 51 on: Night 51–70, Dawn 71–90, then Day again, Late afternoon, Dusk, Night, Dawn, and so on, for as long as the run lasts ("Stage 6 · Day"). Difficulty goes on rising subtly each of these stages too, up to a limit: the shortest release window shrinks by LATER_WINDOW_STEP_MS (3 ms) per stage, from 54 ms down to LATER_MIN_WINDOW_MS (40 ms, about 5 sim steps, reached at Stage 9, obstacle 151), and the moving share rises by LATER_MOVING_STEP (5 points) per stage, from 60 % up to LATER_MOVING_MAX (80 %, Stage 8, obstacle 131). Obstacle scale stays at 1.3: at that size a branch already fits at only one height range. From Stage 10 on only the sky goes on. Both levers are checked at generation like any stage's, so every gap stays passable; the window table is unchanged, since the stage's minimum is applied at lookup.

| Stage | Obstacles | Min release window | Moving share | Obstacle scale |
|---|---|---|---|---|
| 1 | 1–15 | 90 ms | 0% for 1–5, then 12% | 1.00 |
| 2 | 16–30 | 76 ms | 26% | 1.10 |
| 3 | 31–50 | 64 ms | 46% | 1.20 |
| 4 | 51+ | 54 ms | 60% | 1.30 |

**Steeper.** Stages 2 to 4 ask a little more than they did (shortest window 80 / 70 / 60 ms became 76 / 64 / 54, moving share 20 / 40 / 55 % became 26 / 46 / 60 %, harder grade odds), and the stages after the last climb faster (3 ms and 5 points a stage instead of 2 and 4; the hardest grades likelier sooner). What a player meets (40 seeds, the mean grade of the obstacles made, after the grade bounds were recalibrated): gaps 16–30 1.96 → 2.13, 31–50 2.13 → 2.27, 51–70 2.48 → 2.73, 71–130 2.5–2.6 → 2.75–2.8, 151–210 2.7 → 2.8. The moving share that is actually made follows the stage's a little below, and in the last stages less so than before (about 58 % against 65 %): a gap aiming for grade 4 seldom finds a moving obstacle that hard and takes a static one. The odds for grade 4 stay at 0 until Stage 4.

### Obstacle grades

Every obstacle has a **grade** from 1 (easiest) to 4: how much of the release timing it takes away. It is measured, not set per type: the share of the empty gap's release steps (those whose flight reaches the next liana) that the obstacle blocks, averaged over the entry radii. A moving obstacle's share is also averaged over sampled arrival times (every GRADE_ARRIVAL_STEP-th of the solver's twelve, and every GRADE_RADIUS_STEP-th radius; grading it costs about 0.8 ms). GRADE_BOUNDS = [0.15, 0.23, 0.28] are the shares where grades 2, 3 and 4 start. They were [0.12, 0.19, 0.27] before the forced release moved from phase 0.11 to 0.08: the share counts the release steps up to the forced one, so the earlier release shifted every obstacle's share, and the bounds were moved to keep each grade's share of the legal placements as it was (9 / 11 / 19 / 61 % for grades 1 / 2 / 3 / 4). So a branch is mostly a 2, a spider or a purple bird a 1, a snake or a bird a 2, and a rock, thorn bush or beehive low in the gap a 3 or 4; the same type gets a different grade at a different height or scale. The grade is on `Obstacle.grade` (carried to and from the worker) and shown in the debug view for the gap the monkey is in. For static obstacles the shares are in the window table (`blocked`, per scale, type and height), so play still never runs the solver for them.

Each stage lists the odds (`grades` in STAGES) of a gap *aiming* for each grade, drawn from a random stream of its own, so the same for a seed every time. A grade with no odds in a stage never appears in it, which keeps the hard obstacles out of the early stages:

| Stage | Obstacles | Odds for grade 1 / 2 / 3 / 4 |
|---|---|---|
| 1 | 1–15 | 65 / 35 / 0 / 0 |
| 2 | 16–30 | 25 / 35 / 40 / 0 |
| 3 | 31–50 | 10 / 25 / 65 / 0 |
| 4 | 51–70 | 12 / 25 / 33 / 30 |
| 5 and on | 71+ | towards 8 / 20 / 32 / 40, reached after LATER_GRADE_STAGES (6) more stages (Stage 10) |

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
- **Wider landscape** (a phone showing its browser bars) first crops the empty bottom of the world band, down to MIN_VISIBLE_WORLD_HEIGHT. Then it shows more world to the side, up to MAX_VIEW_WIDTH, and only then adds bars. The floor stays at its world height; where the view ends above the ground line, the ground foliage is hidden (see the M9a framing below).
- **4:3** shows extra canopy above the band and undergrowth below it.
- **Portrait** shows PORTRAIT_VIEW_WIDTH of world, with the spare height split around the band. The title and results panels and the stage banner go below the band, with text and buttons enlarged. While the monkey hangs, the camera holds its liana's anchor at PORTRAIT_ANCHOR_X, so the whole swing and the next liana stay on screen. Rotating mid-run changes the layout without pausing.
- **Panes.** The world is drawn in panes (`src/render/world/pane.js`), each with its own Phaser camera: one for the whole view, or two stacked, clipped strips in split screen. Each has its own background, entity views, camera and death shake.
- **Framing above the world (M9a).** Portrait browser views put `PORTRAIT_SPARE_ABOVE` (20 %) of the spare height above the band; portrait full screen and the home-screen app half of that (10 %). 1P landscape full screen and the home-screen app put the band at the top, so no sky shows above the canopy. The floor fill reaches the visible bottom plus the shake margin. On short landscape views whose bottom is above the ground line (world y = 660) the floor and the near ground ferns are hidden rather than lifted. The fixed 2P frame is unchanged: sky above the canopy is accepted in 2P shared.

## Full screen

- **Controls:** a button next to the speaker, and `F`. The whole page goes full screen, using the Fullscreen API or its `webkit` fallback.
- **Touch:** a tap on the button toggles on `pointerup`, because touch browsers don't grant full screen from a touch `pointerdown`.
- **Button state:** the icon follows `fullscreenchange`, so it stays right after the browser's own Esc.
- **Where it's hidden:** where the API is missing (iPhone Safari), and in the home-screen app.
- **No orientation lock.** Leaving full screen doesn't pause.

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
