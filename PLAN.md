# Liano — Implementation Plan

A one-button browser game. A monkey swings on lianas through a jungle; pressing Space lets go. The monkey flies ballistically and auto-grabs the next liana it touches. Static obstacles sit in the gaps between lianas. Each obstacle passed scores a point. Hitting an obstacle or falling off the bottom ends the run.

## Tech stack

- JavaScript (ES modules, no TypeScript), PixiJS (current major, v8), Vite for dev/build.
- Vitest for unit tests of simulation logic.
- No other runtime dependencies. No backend. No persistence (best score lives in memory for the page session).

## Core rules (fixed by design)

| Area | Rule |
|---|---|
| Progress | Camera follows the monkey horizontally. No auto-scroll. Distance comes only from release momentum. |
| Input | Space, or a tap/click on the game (one press per new finger or primary mouse button). Press while hanging = release. Press while airborne = ignored. Ignore key auto-repeat (`event.repeat`). Presses while paused, or within 250 ms of resuming, are ignored. |
| Swing | Idle lianas hang still. When grabbed, the liana swings with a **fixed amplitude and period**, independent of how the monkey arrived. |
| Grab | Automatic on contact anywhere along the liana, while airborne. The liana just released cannot be regrabbed until a different liana has been grabbed. |
| Backward | Releasing on the backswing is allowed; the monkey may fly backward and grab the previous liana. |
| Layout | Lianas have identical length and identical horizontal spacing. |
| Obstacles | Static only: branch, thorn bush, rock. One per gap, horizontally centered in the gap, at a random height. A liana never sweeps over an obstacle: obstacles stay clear of the area either neighbouring liana (rope and hanging monkey) can swing through. |
| Difficulty | Constant. No ramp. |
| Fail | Collision with an obstacle, or monkey falls below the bottom edge of the screen. Going above the top is not a fail. |
| Scoring | +1 for an obstacle when the monkey, moving forward, grabs the liana on the far side of its gap. Swinging or flying past it without reaching that liana does not score. Each obstacle scores at most once (flying backward and forward again does not re-score). |
| HUD | Top-right corner: current score and best score for this session. |

## Decisions filled in (not specified by the user — confirm or change)

1. **Grip slides to a fixed point.** After grabbing at the contact point, the monkey slides along the liana to a fixed grip radius (90% of length) over ~150 ms. This makes every swing identical, so each gap's difficulty depends only on the obstacle height, and feasibility can be precomputed. Alternative: hold where grabbed (more skill variance, harder to guarantee fairness).
2. **Swing starts at vertical, in the direction of travel.** On grab the liana is vertical (θ = 0); the swing begins moving in the direction of the monkey's horizontal velocity: θ(t) = dir · A · sin(ω·t).
3. **Released lianas settle** back to vertical with a damped cosmetic sway (no gameplay effect).
4. **First gap has no obstacle** so the player learns the release timing. The gap behind the start liana is empty too, since the title-screen swing passes over it.
5. **Every generated gap is guaranteed passable** with a minimum human-reasonable release window (see Feasibility).
6. **Camera is horizontal-only.** Vertical view is fixed (canopy at top, jungle floor at bottom). If the monkey goes above the top edge, show a small arrow indicator at its x.
7. **Game flow:** first load shows a title overlay with the monkey swinging on the first liana; Space starts the run. On game over, input is locked for 400 ms, then Space starts a new run immediately.
8. **Fixed logical resolution 1280×720**, scaled to fit the window with letterboxing.

## Simulation model

Keep all simulation in pure functions/classes with no Pixi imports so it can be unit-tested. Rendering reads simulation state each frame.

**Loop.** Fixed timestep (1/120 s) with an accumulator; render interpolation optional. Clamp frame delta to 100 ms (tab switches).

**Liana.** Anchor at (x, ANCHOR_Y) above the top edge, length L. State: `idle | swinging | settling`. When swinging, θ(t) = dir · A · sin(ω·t), ω = 2π / SWING_PERIOD. Angular velocity θ'(t) = dir · A · ω · cos(ω·t).

**Hanging monkey.** Position = anchor + r·(sin θ, cos θ), where r is the grip radius (animated from contact radius to GRIP_RADIUS on grab).

**Release.** Velocity = tangential velocity at release: v = r·θ' · (cos θ, −sin θ). Then ballistic: vy += GRAVITY·dt, position += v·dt. No air control, no drag.

**Grab detection.** Monkey hitbox is a circle. Each liana is a line segment from anchor to tip. Grab when circle intersects segment, monkey is airborne, and the liana is not the excluded (just-released) one. On grab, compute contact radius = distance from anchor to closest point on segment.

**Obstacle collision.** Each obstacle type has a simple hitbox (circle, or a small set of circles/rects). Check every step, in both hanging and airborne states. If a grab and an obstacle hit happen in the same step, the obstacle hit wins.

**Fall.** Monkey center y > SCREEN_HEIGHT + monkey radius → game over.

**Generation.** Seeded RNG (e.g. mulberry32; random seed per run, fixed seed in tests). Generate lianas and obstacles lazily ahead of the camera (≥ 2 screens), and discard those more than 2 screens behind. Liana i sits at x = i · LIANA_SPACING.

**Feasibility.** Because every swing is identical (decision 1), a gap is defined only by its obstacle's type and height. Releases can only happen on sim steps, so the solver sweeps release steps rather than milliseconds, over the first quarter period after a forward grab (while the swing still moves forward). A step is valid when the monkey survives hanging until then, misses the obstacle in flight and grabs the next liana. Because the grip slide makes the first 150 ms depend on where the liana was caught, a step must be valid for every arrival radius (anchor to tip, sampled every 10 px); after the slide the swing is the same for all of them, so it is simulated once. The obstacle must also be clear of both neighbouring lianas' swept sectors by MONKEY_RADIUS + LIANA_CLEARANCE, so the monkey can never hit it while hanging. Accept only if the longest run of valid steps is at least MIN_RELEASE_WINDOW_MS (11 steps). Otherwise reroll the height (20 tries, then fall back to the lowest passable height). Results are memoized per (type, whole-pixel height). Implemented in `src/sim/feasibility.js`.

## Tunables (`src/config.js`)

Starting values, all expected to change during tuning.

| Constant | Start value | Notes |
|---|---|---|
| SCREEN_WIDTH × SCREEN_HEIGHT | 1280 × 720 | Logical resolution |
| ANCHOR_Y | −20 | Liana anchors just above the top edge |
| LIANA_LENGTH | 420 | Tips hang around y = 400 |
| GRIP_RADIUS | 0.9 × LIANA_LENGTH | |
| LIANA_SPACING | 700 | Was 380. Wide enough that the swings (reach ≈ 322) leave the middle of each gap free |
| SWING_AMPLITUDE | 50° | |
| SWING_PERIOD | 2.6 s | Was 1.8 s (slower swing) |
| GRAVITY | 600 px/s² | Was 1800. Low, for ~0.8 s flights across the wide gaps; 400 felt too floaty |
| MONKEY_RADIUS | 22 | Hitbox |
| OBSTACLE_Y_RANGE | [140, 375] | Heights ~[195, 315] are rejected (the swing tips reach there). Above: fly under the obstacle; below: fly over it |
| LIANA_CLEARANCE | 6 | Extra gap between an obstacle and a liana's swept area, beyond MONKEY_RADIUS |
| MIN_RELEASE_WINDOW_MS | 90 | Fairness floor |
| CAMERA_TARGET_X | 0.35 × width | Monkey's screen position |
| CAMERA_LERP | 8 /s | Smoothing |
| GAMEOVER_INPUT_LOCK_MS | 400 | |

## Project structure

```
liano/
  index.html
  package.json
  vite.config.js
  src/
    main.js              # Pixi app bootstrap, scaling/letterbox, fixed-step loop
    config.js            # all tunables
    sim/
      rng.js             # seeded RNG
      physics.js         # pendulum, ballistic step, circle–segment and hitbox tests
      liana.js           # liana state machine
      monkey.js          # hanging/airborne state, grab/release
      generator.js       # liana + obstacle generation, feasibility check
      world.js           # owns entities, step(dt), events (grab, score, death)
      game.js            # READY / PLAYING / GAME_OVER, score + best score
    render/
      background.js      # parallax jungle layers
      lianaView.js
      monkeyView.js
      obstacleViews.js   # branch, thorn bush, rock
      hud.js             # top-right score / best
      overlays.js        # title, game over, off-screen indicator
      camera.js
    input.js             # Space handling, repeat filtering
  tests/
    physics.test.js
    generator.test.js
    feasibility.test.js
    scoring.test.js
    game.test.js
```

## Visual style

Simple stylized vector art drawn in code with Pixi `Graphics`. No image assets.

- **Monkey:** round brown body and head, lighter face and belly, round ears, curled tail, one arm reaching up to the grip point. Pose changes: hanging (arm up, legs dangling, slight lag behind swing), airborne (arms spread, tumble rotation following velocity), dead (falls with spin).
- **Lianas:** green line with a gentle curve and a few leaves; drawn as a polyline so it can bend slightly while settling.
- **Obstacles:** branch (brown horizontal limb with a leaf tuft, drawn from a trunk stub), thorn bush (dark green blob with triangular thorns), rock (grey angular polygon on a small ledge or vine). Hitboxes should visually match.
- **Background:** 3 parallax layers (far canopy silhouettes, mid tree trunks, near foliage) plus a dark jungle floor band at the bottom that reads as "don't fall here". Canopy strip across the top where lianas hang from.
- **HUD:** top-right, readable text with a subtle shadow, e.g. `12  BEST 31`.

## Milestones

Implement in order. Each milestone ends in a runnable, testable state.

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

## Phase 2: sound, touch devices, performance, release

Four additions: synthesized sound effects, phone and iPad support (tap instead of Space), performance tuning and hardening, and a public release on GitHub Pages.

### Decisions (not specified by the user — confirm or change)

9. **Test locally first, deploy after hardening.** Until the Pages pipeline exists, phones and iPads test against the dev server on the local network (`npm run dev:host`, then open the printed network address on the device). The pipeline follows performance and hardening, and the versioned release (v1.0.0) is last.
10. **Any pointer press counts as Space.** A tap, or a mouse click on desktop, is one press, handled by the same code as Space. One `pointerdown` is one press; extra fingers are extra presses, `pointercancel` is ignored.
11. **Landscape only** (superseded by phase 4). The game stays 16:9. On a portrait screen a "rotate your device" overlay pauses the game instead of shrinking it into a letterbox.
12. **Sound is on by default**, starting at the first press (browsers block audio before a user gesture). `M` or an on-screen speaker button toggles mute. The mute setting lives in memory only, consistent with no persistence.
13. **Sound only for the two deaths.** A "swish" on each pass through the bottom of the swing and a "wheee" on release were built and then dropped at the user's request, after several versions of the "wheee" ("ooweeee", "iiii", "eeee", "ooaaooaa") did not work out.
14. **Reduced motion is respected:** with `prefers-reduced-motion` the death shake is off.

### Sound design

All sounds are synthesized with the Web Audio API at runtime; no audio files.

| Event | Sim trigger | Synthesis |
|---|---|---|
| "Bong" | `death` with cause `obstacle` | Bell-like decaying sines at inharmonic ratios (1, 2.76, 5.4) with a fast attack and about 1 s decay. Base pitch by obstacle type: rock low, branch mid, bush higher. |
| "Crash" | `death` with cause `fall` | A low-passed noise burst plus a falling low sine thud, about 0.8 s. |

- **Structure:** each sound is a pure "recipe" function that returns oscillators, filters and envelopes as data. These are unit-tested in Node. A thin player turns recipes into Web Audio nodes. It is the only code that touches `AudioContext`.
- **Game events for sound:** `Game` keeps the world events it drains each step and passes them on to a per-frame consumer, so sounds are driven by the sim and stay testable.
- **Pause:** the `AudioContext` is suspended with the game (window blur, hidden tab, portrait prompt) and resumed after.
- **iOS:** Web Audio follows the ring/silent switch, so sound is muted when the phone is on silent. This is platform behaviour, noted in the README rather than worked around.

### Touch and mobile

- **Input:** `pointerdown` on the canvas feeds the same press queue as Space. The page sets `touch-action: none`, prevents double-tap zoom and text selection, and the viewport meta tag disables pinch zoom and uses `viewport-fit=cover`.
- **Resume without a press:** the press that brings focus back after a pause resumes the game but is not also used as a press. That avoids an unwanted release when tapping or clicking to resume.
- **Prompts:** say "Tap" or "Press Space" depending on the last input type used. They start from `(pointer: coarse)`.
- **Layout:** handles orientation changes and the iOS address bar showing and hiding (`visualViewport` resize). Canvas resolution is capped at 2× device pixels, since 3× phones cost fill rate for no visible gain.
- **Home screen app:** a web app manifest (`display: fullscreen`, landscape) and an `apple-touch-icon`. "Add to Home Screen" then gives a full-screen game without browser chrome. iPhone Safari has no Fullscreen API for web pages, so this is the only way to get full screen there.

### Performance and hardening

Measured at the start of this phase in headless Chromium:
- **Per-frame work** (updates plus render submission): 1.0 ms median at full speed; 3.7 ms median and 9.5 ms worst at 4× CPU throttling.
- **Generating a gap** whose (type, height) is not yet cached costs up to 12.4 ms of solver time in one sim step, unthrottled. On a phone that would be a visible stutter whenever a new gap appears.

Performance:
- **Precomputed windows:** compute the release-window table (3 types × each whole-pixel height) at build time and ship it as a small JSON module. Generation becomes a table lookup. A unit test checks the shipped table against the live solver, so a changed tunable fails CI until the table is rebuilt.
- **Lianas:** redraw a liana's `Graphics` only when its angle changes. Idle lianas are static. (Done: about 1.5 redraws per frame during play.)
- **Background:** the parallax layers are render groups, so moving them only changes a transform instead of re-packing every vertex each frame. The 16:9 clip is black letterbox bars instead of a mask (no stencil pass). Draw calls went from about 28 to 24 per frame. `cacheAsTexture` was not used: tile-sized textures at 2× would cost hundreds of MB.
- **Budget:** at 4× CPU throttling, per-frame work under 6 ms at p95 and no frame over 16 ms during generation, restarts or deaths. Then check on real devices via the local dev server.

Hardening:
- **Renderer:** force WebGL (`preference: 'webgl'`). WebGPU support is still uneven on mobile browsers.
- **Lost GPU context** (common when a phone backgrounds a tab): pause on `webglcontextlost` and restore on `webglcontextrestored`, or show a "tap to reload" overlay if restoring fails.
- **Errors:** a global error handler shows a friendly "Something went wrong — tap to reload" overlay instead of a frozen canvas.
- **Long sessions:**
  - A soak test plays 5,000 gaps with the fairness bot. Entity counts and the event queue must stay bounded, and the heap must stay flat across restarts.
  - Rendering must stay precise at large world x (millions of pixels): check for jitter and, if it appears, shift the world origin.
- **Input edge cases:** Space held across a restart; taps during the game-over lock; multi-touch; a key or pointer held while the window loses focus. (Unit tested.)
- **Also done:** screen shake off with `prefers-reduced-motion`; the canvas follows pixel-ratio changes (a window moved to another screen).

### Release

- **Vite:** `base: '/liano/'` so the build works at `https://skogdoom.github.io/liano/`.
- **CI** (GitHub Actions): run `npm ci`, `npm test` and `npm run build` on every PR and on pushes to `master`.
- **Deploy:** a second job publishes `dist/` to GitHub Pages on every push to `master` (`actions/upload-pages-artifact` and `actions/deploy-pages`). This needs a one-time repository setting from the owner: Settings → Pages → Source: GitHub Actions.
- **Release:** a README with how to play, controls and local development; a real favicon (small SVG) and page description; the version from `package.json` shown small on the title screen; tag `v1.0.0` and a GitHub release with notes.

### Milestones

Order: 9 → 10 → 11 → 8 → 12 (numbers kept from the original plan).

**9. Touch and mobile.** Pointer input, viewport and gesture handling, landscape-only overlay, input-dependent prompts, resolution cap, manifest and icon.
- [ ] Tap starts, releases and restarts on phone and iPad (Playwright touch emulation, then real devices via `npm run dev:host`) — emulation passes; real devices still to check
- [ ] No zoom, scroll or text selection from taps; the portrait overlay pauses the game — emulation passes; real devices still to check
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

**8. Deploy pipeline.** CI on PRs and pushes, Pages deploy on `master`, `base` path. (`.github/workflows/ci.yml`; `base: '/liano/'` for build and preview in `vite.config.js`; the production build checked under `/liano/` with `vite preview`.)
- [x] PRs show a passing test and build check (first run on skogdoom/liano#3: tests and build pass in about 20 s; the deploy job is skipped on PRs)
- [x] The game loads and plays at `https://skogdoom.github.io/liano/` (first deploy from the master run for skogdoom/liano#4; checked by the owner)

**12. Release v1.0.0.** README, favicon and meta, version on the title screen, tag and GitHub release.
- [x] v1.0.0 is live on Pages and tagged, with release notes (tag `v1.0.0` on the #4 merge commit; release at https://github.com/skogdoom/liano/releases/tag/v1.0.0)

## Phase 3: fullscreen

A button and a key that put the game in full screen, on browsers that allow it.

### Decisions (not specified by the user — confirm or change)

15. **Controls:** a fullscreen button top-left next to the speaker, and `F` on the keyboard. Both toggle. Neither counts as a press, the same as the mute button.
16. **The whole page goes full screen** (`document.documentElement`), not the canvas. The rotate, notice and error overlays are page elements and stay visible.
17. **Hidden where it can't work.** iPhone Safari has no Fullscreen API for pages, so the button is hidden there, and the home-screen app stays the way to get full screen. The button is also hidden when already running as the home-screen app (`display-mode: fullscreen` or `standalone`).
18. **No orientation lock.** Portrait play is planned (phase 4), so full screen doesn't lock to landscape. Until then, the rotate overlay covers portrait.
19. **Leaving full screen** (Esc, a system gesture or the button) doesn't pause the game. The layout already follows resizes.
20. **Ships as v1.1.0.**

### Design

- **Module:** `src/fullscreen.js` wraps the API (with the `webkit`-prefixed fallback for older Safari) behind `supported`, `active`, `toggle()` and a change callback. It takes `document` as a parameter so it can be unit-tested with a fake.
- **State:** the button icon (expand or collapse arrows) follows `fullscreenchange`, so it stays right when full screen ends outside the game. A rejected request is ignored and the button keeps working.
- **Input:** the button goes through the same `intercept()` path as the mute button. `F` is read like `M` and `D`.
- **Docs:** README controls, and the title panel's control line if it fits.

### Milestone

**13. Fullscreen.** Button, `F` key, state sync, hidden where unsupported.
- [ ] The button and `F` enter and leave full screen in desktop Chrome, Firefox and Safari, in Android Chrome and on iPad. The icon follows the state, including after Esc
- [ ] Neither the button nor `F` releases the monkey or starts a run (unit tested)
- [ ] The button is hidden on iPhone Safari and in the home-screen app
- [ ] The game fills the screen after entering and leaving full screen, and after rotating while in full screen
- [ ] v1.1.0 is live on Pages and tagged, with release notes

## Phase 4: portrait mode and a flexible frame

Play with the phone or iPad held upright, instead of being asked to rotate it. Also, in landscape, a short screen (a phone with the browser's address and tab bars showing) fills the screen with a larger game instead of shrinking the 16:9 frame between black bars.

### Decisions (not specified by the user — confirm or change)

21. **Same game, taller frame.** The simulation, tunables and fairness guarantees stay as they are, so scores in both orientations are comparable. Portrait shows a narrower slice of the same world, and fills the extra height with canopy above and undergrowth below. Portrait-specific tunables (for example shorter gaps) would be a different game, with its own window table; they are out of scope.
22. **Portrait shows about 1,100 px of world width** (landscape shows 1,280). While the monkey hangs, the camera holds the liana's anchor at 30 % from the left, instead of following the monkey. In flight, it eases back to following the monkey. The whole swing (the monkey reaches 290 px either side of the anchor) and the next liana 700 px ahead then stay on screen, and the view doesn't pan back and forth with each swing. Both values are tunables.
23. **Size trade-off.** On a phone the world is drawn about two-thirds as large as in landscape on the same phone: the monkey is roughly 16 CSS px across instead of 24. On an iPad the difference is small. If real phones show it's too small to play, stop and reconsider; don't scale the monkey's art away from its hitbox.
24. **Layout follows the aspect ratio, not the device.** Any screen taller than wide gets the portrait layout, including a narrow desktop window. Wider than tall gets the landscape layout (decision 27).
25. **Rotating mid-run doesn't pause.** The layout switches in place and the run continues, the same as a desktop window resize. The rotate overlay and the `portrait` pause reason are removed. The manifest's `orientation` becomes `any`.
26. **Ships as v1.2.0** (after milestone 13's v1.1.0).
27. **Landscape frame flexes instead of letterboxing.** Nothing but falling happens in the bottom of the world band: the lowest grab and the lowest obstacle are around y 410, and the fall line is at 720. So on a screen wider than 16:9, the view first crops up to 150 px off the bottom, keeping y 570 and above visible and scaling the game up to fit the height. If the screen is still wider than that, it shows more world to the side, up to 1,600 px wide. Black bars remain only beyond that.
    - Example: a phone showing 844 × 340 CSS px of page. Today the game is drawn at 0.47× with 120 px bars on each side. With the flexible frame, it is drawn at 0.60× (27 % larger), showing 1,416 px of world, with no bars.
    - Cost: a falling monkey leaves the view up to about 0.3 s before the crash sounds. The undergrowth is drawn at the bottom edge, so it drops into the leaves rather than off a cut edge.
    - Taller-than-16:9 landscape screens (4:3 iPads) show extra canopy above and undergrowth below, like portrait, instead of bars at the top and bottom.
    - The simulation doesn't change.

### Design

- **World versus screen:** the sim uses `SCREEN_HEIGHT` as the fall line and `SCREEN_WIDTH` for generation margins. These become world constants (`WORLD_HEIGHT` and the margin), so nothing in the sim depends on the screen shape.
- **Layout:** a pure `layoutFor(width, height)` returns the orientation, logical view size, scale, where the 720 px world band sits, and where the HUD, the buttons and the panels go. It is unit-tested for common phone, tablet and desktop sizes. `main.js`, the camera and the views read from it instead of `SCREEN_WIDTH` and `SCREEN_HEIGHT`.
- **Vertical space:** the world band sits low enough that the sky above it shows high flights, so the off-screen arrow is rarer. The canopy tiles repeat upward, and a dark undergrowth layer continues below the fall line, so falling still reads as falling.
- **Background:** the parallax layers extend vertically in portrait. The pixel count is about the same as landscape, so the frame budget doesn't change; check it again on a phone.
- **HUD and panels:** the score sits at the top; the mute and fullscreen buttons stay top-left, clear of the notch (`safe-area-inset`). The title and game-over panels go in the space below the world band, stacked, with text sized to the screen width.

### Milestone

**14. Portrait mode and a flexible frame.** World/screen split, layout module (portrait and flexible landscape), anchor-following portrait camera, extended background, HUD and panel layouts, rotate overlay removed.
- [ ] Held upright, a phone and an iPad play a full run: start, release, die, restart (Playwright emulation, then real devices)
- [ ] The whole swing and the next liana are on screen while the monkey hangs, in portrait on the narrowest supported phone (unit tested against the layout and camera)
- [ ] Rotating mid-run switches layout without pausing, losing the run or dropping a press
- [ ] Landscape at exactly 16:9 looks and plays as before (screenshots compared)
- [ ] A landscape phone with the browser bars showing fills the screen with no black bars, with the game drawn larger than a 16:9 letterbox would allow (unit tested against the layout, then on a real phone)
- [ ] The monkey is readable on a real phone in portrait (see decision 23)
- [ ] v1.2.0 is live on Pages and tagged, with release notes

## Out of scope

Persistent high scores, difficulty ramp, moving obstacles, power-ups, menus beyond title/game over, music.
