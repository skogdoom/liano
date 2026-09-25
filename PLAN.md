# Liano — Implementation Plan (v2)

A one-button browser game. A monkey swings on lianas through a jungle. It grabs a liana anywhere along its length, slowly slips toward the tip, and the player presses a key to let go. The monkey flies ballistically and auto-grabs the next liana it touches. Obstacles sit in the gaps between lianas: static ones first, moving ones later. Bananas speed up the next few swings and give bonus points. Difficulty ramps in stages. Modes: single player, two-player shared screen, two-player split screen.

## Tech stack

- JavaScript (ES modules, no TypeScript), PixiJS (current major, v8), Vite for dev/build.
- Vitest for unit tests of simulation logic.
- A Web Worker for the feasibility solver.
- No other runtime dependencies. No backend. No persistence (the best score lives in memory for the page session).

## Modes and controls

| Mode | Keys | Lives | Result |
|---|---|---|---|
| 1 Player | Space | 1 | Score; session best shown |
| 2P Shared screen | P1 `A`, P2 `L` | 3 each | Higher total score after both are out of lives; equal = draw |
| 2P Split screen | P1 `A`, P2 `L` | 3 each | Same as shared |

The title screen has a mode picker: keys `1` / `2` / `3` select a mode, and Space or Enter starts it. Keys are defined in `config.js`. Avoid Shift: on Windows, pressing it five times opens the Sticky Keys dialog. For every action key, ignore key auto-repeat (`event.repeat`).

## Core rules

| Area | Rule |
|---|---|
| Progress | Camera follows horizontally. No auto-scroll. Distance comes only from release momentum. |
| Action key | While hanging: release. While airborne: ignored. |
| Swing | Idle lianas hang still. When grabbed, a liana swings with a fixed angular amplitude and period. The period is shorter while the monkey is boosted by a banana. |
| Grip | The monkey grabs at the contact point, anywhere along the liana. The grip then slips toward the tip at a constant speed. At the tip the monkey is **forced off** with its current velocity. This is a forced release, not a death. |
| Release power | Linear speed scales with grip radius. A high grip gives a weak jump; waiting (slipping lower) gives a stronger one. |
| Regrab | The liana just released cannot be regrabbed until a different liana has been grabbed. |
| Backward | Releasing on the backswing is allowed. The monkey may fly backward and grab the previous liana. |
| Layout | Lianas have identical length and identical horizontal spacing. |
| Obstacles | One per gap (none in the first gap). Static types: branch, thorn bush, rock, at a random height in the gap. Moving types (spider, snake, bird) start after 15 obstacles. |
| Bananas | Collected on touch. Give +BANANA_POINTS and a boost: the next BOOST_GRABS lianas swing faster. |
| Difficulty | Stages keyed on obstacle index. Levers: tighter release windows, larger share of moving obstacles, bigger obstacles. Swing speed and slip speed do not ramp. |
| Death | Collision with an obstacle, falling below the bottom edge of the screen, or (shared screen only) being pushed off the left edge. Going above the top edge is not a death. |
| Scoring | +1 per obstacle gap crossed. A gap counts as crossed when the monkey grabs the liana at its far end, or passes that liana's x mid-air, whichever comes first. Each gap scores once per monkey. Plus banana points. |
| HUD | Top-right. 1P shows score and session best. 2P shows each player's score and remaining lives. |

## Grip and slip

- On grab the liana is vertical (θ = 0). The swing starts in the direction of the monkey's horizontal velocity: θ(t) = dir · A · sin(ω·t), where ω = 2π / period.
- The grip radius starts at the contact radius r₀ and grows at SLIP_SPEED: r(t) = min(r₀ + SLIP_SPEED·t, L).
- Hanging position = anchor + r·(sin θ, cos θ).
- Release velocity combines the tangential and radial components: v = r·θ'·(cos θ, −sin θ) + r'·(sin θ, cos θ).
- A forced release at r = L uses the same formula.
- Time on a liana is bounded: at most (L − r₀) / SLIP_SPEED. This bound is what keeps moving obstacles fair (see Feasibility).
- Visual: the monkey's hand visibly slides down the vine. Near the tip, the vine end flashes as a warning.

## Obstacles

**Static** (from obstacle #1): branch, thorn bush, rock. Random height in the gap, horizontally centered.

**Moving** (from obstacle #16, share set by the stage). Each moving obstacle has a deterministic `position(t)` and `hitbox(t)` with period P, driven by world time since it spawned, and stays confined to its own gap:
- **Spider:** descends and ascends on a thread from the canopy. Vertical oscillation between two heights.
- **Snake:** climbs up and down a vine standing in the gap, moving vertically along it.
- **Bird:** patrols horizontally between two x bounds inside the gap, with a slight bob. The patrol bounds must stay outside every liana's swing arc, so a hanging monkey can never be hit with no way out.

## Bananas

- Placed in some gaps (BANANA_CHANCE), on a trajectory riskier than the easiest safe one. The generator picks a point along a valid but non-minimal-risk flight.
- Collected on touch, in the air or while hanging.
- Effect: +BANANA_POINTS, and the boost counter is set to BOOST_GRABS. Picking up another banana while boosted resets the counter to BOOST_GRABS; boosts do not stack in strength.
- While the counter is above zero, each new grab swings with period SWING_PERIOD / BOOST_FACTOR, and the counter decreases by 1 per grab.
- The boost is cleared on death.
- HUD: a banana icon near the monkey showing the remaining boosted grabs.

## Difficulty stages

Stages are keyed on **obstacle index**, not score. This way banana points don't accelerate difficulty, and in shared-screen mode both players meet the same level. On entering a new stage, a banner ("Stage 2") appears and the background tint shifts (day → late afternoon → dusk → night).

| Stage | Obstacles | Min release window | Moving share | Obstacle scale |
|---|---|---|---|---|
| 1 | 1–15 | 90 ms | 0% | 1.00 |
| 2 | 16–30 | 80 ms | 25% | 1.10 |
| 3 | 31–50 | 70 ms | 50% | 1.20 |
| 4 | 51+ | 60 ms | 70% | 1.30 |

All of these values are starting points for tuning.

## Two-player rules

**Common to both 2P modes.** Both modes use the same seed, so both players face the same level. Scores accumulate across all lives. After a death, the player respawns hanging on a liana at RESPAWN_GRIP, already swinging, and is invulnerable for RESPAWN_INVULN_MS (blinking; passes through obstacles; can still score). A player with no lives left is removed; the other player continues alone until they are also out of lives. A results screen then shows both totals and the winner.

**Split screen.**
- Two independent worlds with the same seed: top pane for P1, bottom pane for P2.
- Each pane is 1280×360 and renders its world at 0.5 scale, which gives a wider horizontal view than single player.
- Respawn on the last liana that player grabbed.
- There is no interaction between the players.

**Shared screen.**
- One world containing both monkeys.
- The camera follows the leader: the alive, non-invulnerable monkey with the largest x. If the leader dies, the camera switches smoothly to the other monkey.
- The trailing monkey loses a life when it goes fully off the left edge.
- Respawn on the leftmost liana that is fully on screen.
- Monkeys do not collide with each other.
- A liana can hold both monkeys at once. A monkey grabbing a liana that is already swinging joins the current swing phase, at its own grip radius.

## Feasibility (fairness guarantee)

The generator only emits gaps the solver accepts. For a gap, the solver must find a valid release window, lasting at least the stage's minimum, **before the forced release**. It checks this for every combination of:
- entry radius r₀ ∈ ENTRY_RADII (sampled fractions of L),
- obstacle phase at arrival, sampled at 12 points over P (moving obstacles only),
- swing variant: normal, plus boosted for any gap within BOOST_GRABS gaps after a banana. The solver can't know whether the player took the banana, so both variants must pass.

"Valid" means the flight reaches the next liana without touching the obstacle or falling out. If a candidate fails, the generator rerolls the obstacle height, type and motion parameters (max N tries), then falls back to a safe static obstacle.

A useful design constraint: if the time on a liana from the lowest sampled entry radius is at least P, every arrival phase gets to see the obstacle's full cycle before the forced release.

Implementation notes:
- Flight simulation uses a fixed step (1/240 s) with simple hitboxes.
- Run the solver in a Web Worker, generating a buffer of at least 5 gaps ahead of the furthest monkey. Budget: at most 20 ms per gap.
- Known gaps in the guarantee: it is sampled, not a proof. A monkey joining an already-swinging liana in shared mode is not covered, and neither are respawn edge cases. This is acceptable for versus play.

## Simulation model

- All simulation is pure logic with no Pixi imports. Rendering reads simulation state each frame.
- The world holds **N monkeys** from the start; single player uses N = 1.
- Loop: fixed timestep (1/120 s) with an accumulator. Clamp frame delta to 100 ms. Pause on window blur.
- Grab detection: circle (monkey) against segment (liana), while airborne, excluding the just-released liana.
- Collision is checked every step in both hanging and airborne states. If an obstacle hit and a grab happen in the same step, the obstacle hit wins.
- Generation uses a seeded RNG (mulberry32) with a random seed per match and a fixed seed in tests. Entities are generated lazily ahead of the furthest monkey and culled 2 screens behind the rearmost monkey or camera.

## Tunables (`src/config.js`)

| Constant | Start value |
|---|---|
| SCREEN | 1280 × 720 logical, letterboxed |
| ANCHOR_Y | −20 |
| LIANA_LENGTH (L) | 420 |
| LIANA_SPACING | 380 |
| SWING_AMPLITUDE | 50° |
| SWING_PERIOD | 1.8 s |
| SLIP_SPEED | 60 px/s |
| ENTRY_RADII | [0.35, 0.5, 0.65, 0.8, 0.95] × L |
| GRAVITY | 1800 px/s² |
| MONKEY_RADIUS | 22 |
| OBSTACLE_Y_RANGE | [140, 620] |
| MOVING_PERIOD_RANGE | 1.5–3.0 s |
| BANANA_CHANCE | 0.15 per gap (not within 2 gaps of the previous banana) |
| BANANA_POINTS | 3 |
| BOOST_GRABS | 3 |
| BOOST_FACTOR | 1.35 |
| LIVES_2P | 3 |
| RESPAWN_GRIP | 0.7 × L |
| RESPAWN_INVULN_MS | 1500 |
| CAMERA_TARGET_X | 0.35 × width |
| CAMERA_LERP | 8 /s |
| GAMEOVER_INPUT_LOCK_MS | 400 |
| KEYS | 1P: Space; P1: KeyA; P2: KeyL |

## Project structure

```
liano/
  index.html
  package.json
  vite.config.js
  src/
    main.js
    config.js
    input.js                # per-player key mapping, repeat filtering
    sim/
      rng.js
      physics.js            # pendulum with slip, ballistic step, hit tests
      liana.js
      monkey.js             # hanging/airborne, grip/slip, boost, invulnerability
      obstacles/
        static.js           # branch, thorn bush, rock
        spider.js
        snake.js
        bird.js
      banana.js
      difficulty.js         # stage table lookup by obstacle index
      generator.js          # layout, obstacle/banana placement, reroll loop
      solver.js             # pure feasibility check (also used in tests)
      world.js              # N monkeys, step(dt), events: grab, score, banana, death
      match.js              # mode rules: 1P, shared, split; lives, respawn, results
      game.js               # TITLE, PLAYING, RESULTS
    workers/
      solverWorker.js
    render/
      background.js         # parallax layers, stage tint
      lianaView.js
      monkeyView.js         # per-player color variant
      obstacleViews.js
      bananaView.js
      camera.js             # single-target and leader modes
      viewports.js          # full screen / split panes
      hud.js                # 1P and 2P variants
      overlays.js           # title + mode picker, stage banner, results, off-screen indicator
  tests/
    physics.test.js
    slip.test.js
    solver.test.js
    generator.test.js
    scoring.test.js
    banana.test.js
    match.test.js
```

## Visual style

Simple stylized vector art drawn in code with Pixi `Graphics`. No image assets.

- **Monkeys.**
  - Look: round body and head, lighter face and belly, curled tail, one arm reaching up to the grip point.
  - Player colors: P1 brown, P2 a distinct color (e.g. golden).
  - Poses: hanging, airborne tumble, dead fall.
- **Lianas.** A green polyline with leaves, which bends slightly while settling. The grip slide is visible, and the tip flashes when the monkey is near it.
- **Static obstacles.**
  - Branch: brown limb with a leaf tuft.
  - Thorn bush: dark blob with thorns.
  - Rock: grey polygon on a small ledge.
- **Moving obstacles.**
  - Spider: black body with 8 legs, on a thin thread.
  - Snake: green segmented body wrapped on a vine.
  - Bird: bright body with flapping wings.
- **Banana.** A yellow crescent with a gentle bob and sparkle.
- **Background.** Three parallax layers, a canopy strip at the top, and a dark jungle floor band at the bottom. The tint shifts per stage.
- **Readability.** Hitboxes must visually match the drawings. Check this with the debug overlay.

## Milestones

Implement in order. Each milestone must end in a runnable, tested state.

**1. Scaffold.** Vite + Pixi setup, letterboxing, fixed-step loop, TITLE/PLAYING/RESULTS states, title mode picker (only 1P enabled for now), input module with per-player keys.
- [ ] Canvas scales correctly; held keys don't repeat; `npm test` runs

**2. Swing, grip, slip.** Liana and monkey simulation for N monkeys, with placeholder rendering.
- [ ] Grab at the contact radius; slip reaches the tip and forces a release
- [ ] Release velocity includes the radial component (unit tested)
- [ ] The just-released liana cannot be regrabbed; backward flight can land on the previous liana

**3. World, camera, scoring (1P).** Lazy generation and culling, camera follow, fall death, gap-based scoring, restart, session best.
- [ ] Each gap scores once, including when the monkey flies back and forth across it

**4. Static obstacles.** Types, hitboxes, collision.
- [ ] Obstacle hits kill both while hanging and while airborne

**5. Solver.** Pure solver plus worker, reroll loop, debug overlay (`D` toggles hitboxes, predicted trajectory and the valid release window).
- [ ] 1,000 seeded gaps: all feasible for every entry radius

**6. Base art.** Monkey, lianas, static obstacles, background, HUD, title screen.
- [ ] Stable 60 fps; hitboxes match visuals

**7. Moving obstacles.** Spider, snake, bird with periodic motion; the solver gains the phase dimension; art for all three.
- [ ] 1,000 seeded gaps from stage 2+: all feasible for every entry radius × phase
- [ ] Bird patrol bounds never intersect a swing arc (asserted in the generator)

**8. Difficulty stages.** Stage table, stage banner, background tint, obstacle scaling.
- [ ] Stage is derived from obstacle index; banana points don't affect it (unit tested)

**9. Bananas.** Placement, pickup, boost counter, bonus points, HUD indicator; the solver gains the boosted variant.
- [ ] Gaps within BOOST_GRABS after a banana pass both normal and boosted checks
- [ ] Boost resets to BOOST_GRABS on repeat pickup and clears on death

**10. 2P split screen.** Two worlds with one seed, two viewports, lives, respawn with invulnerability, per-pane HUD, results screen.
- [ ] A player with no lives left stops; the other continues; the winner is decided by totals

**11. 2P shared screen.** Leader camera, left-edge elimination, respawn on the leftmost fully visible liana, shared lianas.
- [ ] Two monkeys can hang on the same liana, each at its own grip radius, in the same swing phase
- [ ] The camera handles a leader death without snapping

**12. Polish.** Death feedback (tumble, brief screen shake), pause on blur, key-binding hints on the title screen.
- [ ] Full loop in every mode: title → play → results → title, with no reload

## Decisions filled in (confirm or change)

1. **Forced release at the tip, not death.** A slipped-off monkey can still reach the next liana.
2. **Scoring per gap crossed.** A bird's x isn't fixed, so "passing an obstacle" is measured at the gap boundary.
3. **Difficulty keyed on obstacle index**, not score (see Difficulty stages for the reasons).
4. **Stages rather than a smooth ramp.** Stages line up with the "moving from 15" rule and are easier to tune. The thresholds in the table are guesses.
5. **Shared screen: monkeys can share a liana** and don't collide with each other.
6. **Single player keeps 1 life.** Lives exist only in 2P.
7. **Respawn locations:** the last grabbed liana (split) or the leftmost fully visible liana (shared), with 1.5 s invulnerability.
8. **2P keys A and L**, avoiding Shift because of Windows Sticky Keys.
9. **Boost resets rather than stacks**, and is lost on death.
10. **The fairness guarantee is sampled, not proven**, and doesn't cover joining a liana mid-swing.
11. **Split-screen panes render at 0.5 scale** with a wider horizontal view.
12. Carried over from v1: the swing starts at vertical in the direction of travel; released lianas settle back to vertical; the first gap is empty; the camera is horizontal-only, with an off-screen indicator above the top edge; a 400 ms input lock on game over; 1280×720 logical resolution.

## Out of scope

Mobile/touch input, sound, persistent high scores, online multiplayer, more than 2 players, swing-speed or slip-speed ramps, a separate per-liana countdown timer, menus beyond title/results.
