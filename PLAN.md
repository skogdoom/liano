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
| 1 Player | Space, or a tap/click on the game | 1 | Score; session best shown |
| 2P Shared screen | P1 `A`, P2 `L` | 3 each | Higher total score after both are out of lives; equal = draw |
| 2P Split screen | P1 `A`, P2 `L` | 3 each | Same as shared |

- **Title screen.** A mode picker: keys `1` / `2` / `3` select a mode, and Space or Enter starts it. On a touch device the picker is hidden and a tap starts 1P: the 2P modes are keyboard-only. The title shows the controls for the selected mode ("SPACE · let go", or "P1 A · P2 L · let go") and "P pause · Esc menu · G slipping" with a keyboard.
- **During a run:** `P` pauses and resumes; `Esc` ends the run and goes back to the title screen (in 1P the run's score still counts for the best).
- **Results:** after a 400 ms input lock, Space or Enter plays again in the same mode, `Esc` goes to the title screen, and `1` / `2` / `3` go to it with that mode selected.
- **Other keys:**
  - `M` or the on-screen speaker mutes the sound.
  - `F` or the on-screen button toggles full screen.
  - `D` toggles the debug overlay.
  - `G` turns slipping off and on (see Trying without slipping).
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
| Obstacles | One per gap (none in the first gap, nor in the gap behind the start liana). Static types: branch, thorn bush, rock. Moving types (spider, snake, bird) from obstacle 6. No liana ever sweeps over an obstacle: static and moving obstacles alike stay clear of the area either neighbouring liana can swing through, with the rope and a hanging monkey at any grip radius. |
| Bananas | Collected on touch, and counted per player against the bananas passed. They change neither the score nor the swing. |
| Difficulty | Stages keyed on obstacle index. Levers: shorter release windows, a larger share of moving obstacles, bigger obstacles. Swing speed and slip speed do not ramp. |
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

**Static:** branch, thorn bush, rock. A random height in OBSTACLE_Y_RANGE, horizontally centred, rerolled until the gap is passable and clear of both neighbouring lianas' swept areas.

**Moving** (from obstacle MOVING_FROM, in each stage's share). Each has a deterministic position with period P (MOVING_PERIOD_RANGE), driven by world time (counted in whole sim steps) plus a seeded phase, so the solver matches the world exactly. It stays in its own gap and its whole path stays clear of both swings, so a hanging monkey is never hit:
- **Spider:** drops and climbs on a thread from the canopy at the gap centre.
- **Snake:** climbs up and down a stalk standing in the gap centre.
- **Bird:** patrols across the gap with a slight bob, between the widest bounds that stay clear of the swings (asserted by the generator).
- Room for them: at the gap centre a moving hitbox stays clear of the swings only above y ≈ 213 or below y ≈ 288, while valid flights cross the centre at y ≈ 189–361. So spiders work the high band (lowest point 175–212), snakes the low band (highest point 290–320), and birds patrol low (y 330–390, ±35 to ±117 px). They block about 10–20 % of otherwise valid releases.

## Bananas

- Whether a gap has a banana depends only on (seed, gap): each gap from obstacle 1 is a candidate with BANANA_CHANCE, and a candidate is dropped if either of the two gaps before it is one. That gives bananas in about 14 % of gaps, at least 3 apart.
- A banana sits on a flight that clears the obstacle but is not the safest: a release one or two steps inside either end of a release window.
- Collected on touch, in the air or while hanging; only once, even if its gap is culled and regenerated.
- They are an extra challenge only: a banana counts for the player who took it, and changes neither the score nor the swing. In shared screen it goes to the first monkey to reach it, and is gone for the other.
- The tally is "taken / passed". Passed is the most there was to take: the bananas in the gaps passed so far (scored by any monkey of the world), plus any taken. In shared screen it is the same for both players; in split screen each world counts its own. Deaths don't reset it.
- The HUD shows only how many each player has taken, under their score (a banana icon and "3"). The results show the tally after a banana icon: "3 / 5", or "P1 3 / 5 · P2 2 / 5" in two-player.
- Feedback: a "+1" rises where a banana was taken. No sound.

## Difficulty stages

Stages are keyed on **obstacle index**, not score, so banana points don't speed up difficulty and in shared screen both players meet the same level. A stage starts when a monkey grabs the liana before the stage's first obstacle (obstacle #i is in gap i). A banner ("Stage 2 · Late afternoon") fades in low in the band, and the background tint eases over 2.5 s (day → late afternoon → dusk → night). A new run starts over at day.

The day goes on past Stage 4: the stage number and the time of day keep counting every STAGE_LENGTH_AFTER (20) obstacles, from obstacle 51 on: Night 51–70, Dawn 71–90, then Day again, Late afternoon, Dusk, Night, Dawn, and so on, for as long as the run lasts ("Stage 6 · Day"). Difficulty goes on rising subtly each of these stages too, up to a limit: the shortest release window shrinks by LATER_WINDOW_STEP_MS (2 ms) per stage, from 60 ms down to LATER_MIN_WINDOW_MS (40 ms, about 5 sim steps, reached at Stage 14, obstacle 251), and the moving share rises by LATER_MOVING_STEP (4 points) per stage, from 70 % up to LATER_MOVING_MAX (90 %, Stage 9, obstacle 151). Obstacle scale stays at 1.3: at that size a branch already fits at only one height range. From Stage 14 on only the sky goes on. Both levers are checked at generation like any stage's, so every gap stays passable; the window table is unchanged, since the stage's minimum is applied at lookup.

| Stage | Obstacles | Min release window | Moving share | Obstacle scale |
|---|---|---|---|---|
| 1 | 1–15 | 90 ms | 0% for 1–5, then 15% | 1.00 |
| 2 | 16–30 | 80 ms | 25% | 1.10 |
| 3 | 31–50 | 70 ms | 50% | 1.20 |
| 4 | 51+ | 60 ms | 70% | 1.30 |

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
| "Bong" | `death` with cause `obstacle` | Bell-like decaying sines at inharmonic ratios (1, 2.76, 5.4) with a fast attack and about 1 s decay. Base pitch by obstacle type: rock 110 Hz, snake 131, branch 165, thorn bush 247, spider 294, bird 392. |
| "Crash" | `death` from a fall, or from being left behind | A low-passed noise burst plus a falling low sine thud, about 0.8 s. |

- **Recipes and player:** each sound is a pure recipe function (data, unit-tested in Node). A thin player is the only code that touches `AudioContext`.
- **When sound plays:** on by default from the first press. Mute is toggled with `M` or the speaker button, and kept in memory only. The `AudioContext` is suspended while paused.
- **Sound set:** only deaths have sounds. Release sounds (a "swish", several "wheee"s) were tried and dropped; bananas, stages, respawns and results are silent.

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
  - Lianas are redrawn only when their state changes.
  - The parallax layers are render groups.
  - The frame is clipped with black bars instead of a mask; only split-screen panes use masks.
- **Budget:** at 4× CPU throttling, per-frame work stays under 6 ms at p95. No frame goes over 16 ms during generation, restarts or deaths.
- **Soak test:** 5,000 gaps (with moving obstacles and bananas), with entity counts and the event queue staying bounded. Rendering stays precise at large world x.
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
| STAGE_LENGTH_AFTER | 20 obstacles | After the last stage, the stage number (the time of day) counts on this often |
| LATER_WINDOW_STEP_MS, LATER_MIN_WINDOW_MS | 2 ms per stage, down to 40 ms | The shortest release window of the stages after the last: 60 ms at Stage 4, 40 ms from Stage 14 (about 5 steps) |
| LATER_MOVING_STEP, LATER_MOVING_MAX | +4 points per stage, up to 90 % | The moving share of those stages: 70 % at Stage 4, 90 % from Stage 9 |
| MOVING_FROM | 6 | Obstacles 1–5 are always static |
| MOVING_PERIOD_RANGE | 1.5–3.0 s | |
| SPIDER_LOW_RANGE, SPIDER_TRAVEL_RANGE | 175–212, 80–150 px | Lowest point and climb |
| SNAKE_HIGH_RANGE, SNAKE_TRAVEL_RANGE | 290–320, 90–160 px | Highest point and slide |
| BIRD_Y_RANGE, BIRD_BOB | 330–390, 8 px | Patrol bounds are derived from the swings |
| BANANA_CHANCE | 0.25 per gap, as a candidate | About 14 % of gaps get a banana, at least 3 apart |
| BANANA_RADIUS | 14 | Drawn at 1.4× |
| LIVES_2P | 3 | |
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
      obstacleViews.js      # static art, animated spider, snake and bird
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
  - Branch: brown limb with a leaf tuft.
  - Thorn bush: dark blob with thorns.
  - Rock: grey polygon on a small ledge.
  - High ones hang from the canopy on vines; low ones stand on a trunk or pole.
- **Moving obstacles.**
  - Spider: dark body with a red mark and wriggling legs, on a thin thread.
  - Snake: green coils on a leafy stalk, its head pointing the way it climbs.
  - Bird: red body with a yellow belly and flapping wings, facing the way it flies.
- **Banana.** A yellow crescent with a gentle bob and a glint.
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
- [x] Each such stage has a 2 ms shorter shortest window (down to 40 ms) and 4 points more moving obstacles (up to 90 %), at Stage 4's obstacle scale; stages up to well past the limit are checked passable, boosted swings included (tested)
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
17. **Single player has 1 life.** Lives exist only in 2P.
18. **2P keys A and L**, avoiding Shift because of Windows Sticky Keys. They don't clash with `M`, `F`, `D` or `P`.
19. **2P modes are keyboard-only and use the 16:9 frame.** Portrait and the flexible frame are for 1P.
20. **Bananas are a side challenge,** counted per player against the bananas passed, without points or a boost, so they never change the pacing or the score.
21. **Shared screen: each monkey has its own lianas** at the same places, and the monkeys don't collide. The leader camera is part of the rules.
22. **The fairness guarantee is sampled, not proven**, and doesn't cover respawn edge cases.
23. **Split-screen panes render at 0.5 scale** with a wider horizontal view.

## Out of scope

Persistent high scores, online multiplayer, more than 2 players, touch controls for 2P, swing-speed or slip-speed ramps, a separate per-liana countdown timer, menus beyond the title and results screens, music.
