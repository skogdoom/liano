# Phaser background movement

Investigated on `phaser-m7-codex`, starting at `phaser-m7` commit `c9a4c31`, on 2026-10-13.

## Current Phaser behavior

The owner found the moving-image version a little better in Safari, but still saw occasional stutters and felt the background moved slightly too fast. The supplied `?frames=1` screenshot shows 3,482 frames, five late frames (about 0.14%), a worst gap of 109 ms, and CPU work of 1/2/4 ms in the last ten seconds. That last interval had no late frames. Some listed delays coincide with score-text uploads; this correlation alone does not establish their cause. The readout measures callbacks and CPU submission, not GPU/display presentation. Its "59 Hz" is the rounded estimate from a median 17 ms callback interval.

The follow-up changes only Phaser's decorative scenery:

- Far trees: factor 0.15 → 0.12; mid trunks: 0.4 → 0.32; near foliage: 0.7 → 0.56. All are **20% slower**.
- A critically damped follower advances at the fixed simulation rate and is interpolated for display. It retains velocity across changes in camera speed instead of passing each catch's speed jump directly into the scenery. Its steady-motion lag is about 83 ms.
- Canopy and floor retain factor 1 and the original gameplay camera, keeping their attachment to lianas, obstacles and collision geometry.
- Pause and game-over hold the follower; new worlds and resize reset its position and discard momentum. Shared screen uses the same scenery follower without changing its rules-owned camera.

No Pixi renderer, shared camera, simulation or frame-clock code changed. These changes address how Phaser moves the scenery; they cannot reconstruct frames the browser did not present.

On the controlled uninterrupted swing at 60 Hz and 2×, the mid layer's peak movement fell from **9.22 to 7.26 device pixels/frame**. For 20-second bot runs with the default gameplay camera, peak mid-layer acceleration changed as follows (world units/second², rounded):

| Slipping | Refresh rate | Previous scenery | Slower, eased scenery | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Off | 60 Hz | 3,950 | 902 | 77% |
| Off | 90 Hz | 4,431 | 1,000 | 77% |
| Off | 144 Hz | 9,561 | 1,077 | 89% |
| On | 60 Hz | 3,672 | 766 | 79% |
| On | 90 Hz | 5,535 | 847 | 85% |
| On | 144 Hz | 8,508 | 916 | 89% |

These are movement measurements with regular synthetic frame times, not claims that Safari's rare missed frames have been eliminated. Both drawing paths pass 24 runs (47,040 frames), with no repeated scenery frames and subpixel pixel changes in every check.

## Initial findings

There is a reproducible camera jerk at a catch, independent of frame timing or rendering cost. The background's fractional scrolling itself works in Chromium. This establishes a contribution to the catch effect, not the root cause of all the reported stutter.

The owner reports the symptom in Safari on a MacBook Air M1 and an iPhone 13 mini, with current testing focused on the Mac. `?camera=smooth` helps a little but does not solve it. The follow-up therefore focuses on the background's movement implementation: scrolling texture coordinates inside a stationary TileSprite versus moving repeated images through the scene.

The relevant chain is:

1. `src/sim/world.js` detects a catch within the monkey's reach of a liana.
2. `Monkey.grab()` in `src/sim/monkey.js` immediately moves the monkey onto the rope, starts its swing, and replaces its airborne velocity with the hanging velocity. This is a deliberate gameplay discontinuity. It also resets the monkey's previous position so the visual catch is immediate.
3. `Camera.update()` in `src/render/camera.js` follows that position through one exponential lag (`CAMERA_LERP = 8`). This eases camera position but does not preserve camera speed when the target jumps.
4. `WorldPane.update()` in `src/phaser/world/pane.js` interpolates the camera between fixed simulation steps. This removes repeated simulation poses at other refresh rates; it does not remove the change in camera speed.
5. Before scenery tuning, `BackdropRig.update()` in `src/phaser/world/backdrop.js` used that same interpolated camera for every layer. The dark green trunks in the mid layer scrolled at 40% of camera speed, compared with 15% for the hazier far layer. The near foliage scrolled at 70%. The darker, faster edges make changes in motion easier to see.

On an obstacle-free run with slipping off (the default), at 60 Hz, the first catch changed camera speed from **534 to 617 to 697 world units/second**. The mid-layer trees on a 2× screen consequently changed from about **7.1 to 8.2 to 9.3 device pixels/frame**. This happens with perfectly regular input frame times, without GPU drawing, score text, audio, or obstacle construction.

## Controlled comparison

`scripts/dev/background-motion.mjs` runs the real game, driver, camera and Phaser pane with a deterministic, obstacle-free world. It advances each frame by exactly 1/60, 1/90 or 1/144 second for 20 seconds, with slipping both off and on. It compares the default camera with the existing `?camera=smooth` option, through both backdrop implementations. The bot's input is sampled once per frame, so runs at different refresh rates can release at different simulation steps; camera profiles at the same rate follow identical gameplay.

Initial gameplay-camera measurements: maximum catch-window acceleration (world units/second², rounded; catch frame and the next two frames):

| Slipping | Refresh rate | Default camera | `camera=smooth` | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Off | 60 Hz | 9,875 | 2,413 | 76% |
| Off | 90 Hz | 11,079 | 2,472 | 78% |
| Off | 144 Hz | 23,903 | 3,356 | 86% |
| On | 60 Hz | 9,180 | 2,558 | 72% |
| On | 90 Hz | 13,837 | 2,876 | 79% |
| On | 144 Hz | 21,270 | 2,987 | 86% |

All 24 runs through the two backdrop implementations had **zero repeated camera frames** (47,040 frames total). The script also verifies that each background layer's scroll uses the interpolated camera each frame. Changing the backdrop implementation leaves the camera trajectory identical for a given camera mode, slipping setting and refresh rate. These are synthetic refresh intervals, not measurements from physical 90/144 Hz displays.

The second lag in `camera=smooth` spreads the catch's speed change over more frames. It adds tracking delay: roughly 42 ms more than the default for steady motion (two 1/12-second lags versus one 1/8-second lag). It does not freeze the camera through a swing.

An uninterrupted 2.6-second swing with a fixed grip changed the default camera's direction twice and reached **9.22 device pixels/frame** in the mid layer at 60 Hz and 2×. The smooth option reached **9.24**. Thus it helps the catches substantially while leaving the fast, reversing motion of the background during a swing. High-contrast edges moving that far between refreshes can look stepped; these measurements alone cannot identify that as the user's remaining symptom.

## Renderer check

A separate WebGL check hides the world, UI and other background layers, then renders the dark green mid-layer trunks over the static sky. Ten successive camera moves of 0.1 world units each **all change the rendered pixels** (originally 0.08 device pixels in the mid layer at this screen size, now 0.064 with the slower factor).

The camera has `roundPixels = false`, the source texture uses linear filtering, and Phaser 4.2.1's TileSprite WebGL texturer retains fractional texture coordinates. The tile does not hold until the next whole texture or device pixel. The mid-layer source image is 1× even on a 2× screen, which affects edge softness, but does not prevent fractional scrolling.

The branch already contains fixes for score-text redraws, rounded Safari frame times, and shader compilation during play. The isolated catch jerk survives removal of all those workloads. This does not rule out a separate performance hitch on real hardware.

## Reproduce

```sh
npm ci
npm run dev -- --port 5174
# In another terminal, from the repository root:
CHROMIUM=/usr/bin/chromium URL=http://localhost:5174/ \
  node scripts/dev/background-motion.mjs > background-motion.json
```

`CHROMIUM` is optional if Playwright's Chromium is installed. The script outputs one JSON array with both camera profiles and backdrop implementations, frame counts, catch samples, acceleration measurements, the uninterrupted swing and pixel checks. It fails if the bot dies, a layer diverges from the camera, a subpixel move leaves the sampled tree row unchanged, or the browser reports an uncaught error. It uses Chromium's software WebGL renderer; its timings must not be treated as GPU performance results.

## Phaser implementation change

Phaser now draws the background as repeated Images in moving containers by default. Each frame moves a layer's container by `-layerShift(interpolatedSceneryX, factor)` for decorative scenery, or the original gameplay camera for the canopy and floor. This uses the same container movement model as the Pixi background, with Phaser-specific scenery easing and speed. Texture coordinates remain fixed. The former implementation left each TileSprite stationary and changed its texture coordinates every frame, sending the motion through Phaser's wrapping shader instead of the scene transform.

The image copies share the existing textures; resizing creates only the copies needed for coverage, including the death-shake margin and a full tile of wrapping. They preserve the edge-row crop, day/night tint and pane cameras' clipping. New copies receive the current tint after resize. The Pixi renderer and all shared camera/simulation modules are untouched.

Chromium verifies the resulting movement and appearance, but this environment cannot run Safari on the MacBook Air M1 or iPhone 13 mini. The Safari symptom's resolution therefore still requires a visual check on those devices; the code change should not be described as a confirmed Safari fix before that check.

## Safari comparison

Compare these URLs on the Mac's Safari, keeping the camera setting the same:

- `?engine=phaser`: the new default, repeated Images with moving parent containers.
- `?engine=phaser&backdrop=tiles`: the previous stationary TileSprites, their texture coordinates scrolling each frame.

Both drawing paths use the slower, eased scenery motion, the same textures, fractional positions, parallax factors, tint, vertical cropping and pane clipping. `backdrop=tiles` selects only the previous drawing technique; it does not undo the newer scenery tuning. The gameplay camera is unchanged. The new scenery easing is enabled by default, with no extra URL parameter required.

Browser pixel checks compare the two paths in landscape at 1×, a wide view at 2× and iPhone-sized portrait at 2×. They include both directions, fractional positions, tile-wrap boundaries and day/night tints. At most 0.0039% of pixels differ by more than three channel values in the measured comparisons. This verifies the same picture in Chromium; it does not prove the paths animate identically in Safari.

The owner reports that moving Images helped a little. The earlier catch-speed measurements should not be treated as a complete diagnosis of the remaining Safari symptom.

Camera behavior is unchanged. Changing the catch snap would change gameplay, and making the smooth option the default should follow a visual check of its added camera lag.

## Validation

- Investigation script: all 24 motion runs and four subpixel rendering checks passed.
- New browser pixel comparisons: landscape, wide and portrait all passed through both paths, including fractional movement, negative scrolling, wraps and tint.
- Latest focused unit checks: 8 files, 76 tests passed, covering scenery motion, camera/interpolation, Phaser imports, view/layout, pause, stages and the frame clock.
- `npm run build`: passed.
- Full browser suite: all 44 passed, including the new movement/lifecycle comparisons, gameplay, resize/split-screen clipping, backdrop edges, single-shader batching and full Pixi/Phaser visual parity checks.

Scenery-tuning validation additionally covers the follower's response, steady pan, step-size stability and reset behavior in five unit tests, plus a browser check of fixed-step scenery easing, foreground alignment, pause, resize and reset. Static Pixi/Phaser art comparisons explicitly use the reference scenery speed and disable the new follower, so intentional movement differences do not mask drawing regressions; the new motion is checked separately.

The initial image-path change also passed the full 665-test unit suite, including an isolated rerun of `prefetch.test.js` after its 16 ms timing assertion failed under concurrent software-WebGL browser load. No timing limit or generation code was changed.
