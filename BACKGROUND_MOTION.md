# Phaser background movement

Investigated on `phaser-m7-codex`, starting at `phaser-m7` commit `c9a4c31`, on 2026-10-13.

## Findings

There is a reproducible camera jerk at a catch, independent of frame timing or rendering cost. The background's fractional scrolling itself works in Chromium. This establishes a contribution to the catch effect, not the root cause of all the reported stutter.

The owner reports the symptom in Safari on a MacBook Air M1 and an iPhone 13 mini, with current testing focused on the Mac. `?camera=smooth` helps a little but does not solve it. The follow-up therefore focuses on the background's movement implementation: scrolling texture coordinates inside a stationary TileSprite versus moving repeated images through the scene.

The relevant chain is:

1. `src/sim/world.js` detects a catch within the monkey's reach of a liana.
2. `Monkey.grab()` in `src/sim/monkey.js` immediately moves the monkey onto the rope, starts its swing, and replaces its airborne velocity with the hanging velocity. This is a deliberate gameplay discontinuity. It also resets the monkey's previous position so the visual catch is immediate.
3. `Camera.update()` in `src/render/camera.js` follows that position through one exponential lag (`CAMERA_LERP = 8`). This eases camera position but does not preserve camera speed when the target jumps.
4. `WorldPane.update()` in `src/phaser/world/pane.js` interpolates the camera between fixed simulation steps. This removes repeated simulation poses at other refresh rates; it does not remove the change in camera speed.
5. `BackdropRig.update()` in `src/phaser/world/backdrop.js` uses that same interpolated camera for every layer. The dark green trunks in the mid layer scroll at 40% of camera speed, compared with 15% for the hazier far layer. The near foliage scrolls at 70%. The darker, faster edges make changes in motion easier to see.

On an obstacle-free run with slipping off (the default), at 60 Hz, the first catch changed camera speed from **534 to 617 to 697 world units/second**. The mid-layer trees on a 2× screen consequently changed from about **7.1 to 8.2 to 9.3 device pixels/frame**. This happens with perfectly regular input frame times, without GPU drawing, score text, audio, or obstacle construction.

## Controlled comparison

`scripts/dev/background-motion.mjs` runs the real game, driver, camera and Phaser pane with a deterministic, obstacle-free world. It advances each frame by exactly 1/60, 1/90 or 1/144 second for 20 seconds, with slipping both off and on. It compares the default camera with the existing `?camera=smooth` option, through both backdrop implementations. The bot's input is sampled once per frame, so runs at different refresh rates can release at different simulation steps; camera profiles at the same rate follow identical gameplay.

Maximum catch-window acceleration (world units/second², rounded; catch frame and the next two frames):

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

A separate WebGL check hides the world, UI and other background layers, then renders the dark green mid-layer trunks over the static sky. Ten successive camera moves of 0.1 world units each (0.08 device pixels in the mid layer at this screen size) **all change the rendered pixels**.

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

Phaser now draws the background as repeated Images in moving containers by default. Each frame moves a layer's container by `-layerShift(interpolatedCameraX, factor)`, the same movement model used by the Pixi background. Its texture coordinates remain fixed. The former implementation left each TileSprite stationary and changed its texture coordinates every frame, sending the motion through Phaser's wrapping shader instead of the scene transform.

The image copies share the existing textures; resizing creates only the copies needed for coverage, including the death-shake margin and a full tile of wrapping. They preserve the edge-row crop, day/night tint and pane cameras' clipping. New copies receive the current tint after resize. This is a change to the Phaser movement implementation, not a change to physics, camera smoothing or frame timing. The Pixi renderer and all shared camera/simulation modules are untouched.

Chromium verifies the resulting movement and appearance, but this environment cannot run Safari on the MacBook Air M1 or iPhone 13 mini. The Safari symptom's resolution therefore still requires a visual check on those devices; the code change should not be described as a confirmed Safari fix before that check.

## Safari comparison

Compare these URLs on the Mac's Safari, keeping the camera setting the same:

- `?engine=phaser`: the new default, repeated Images with moving parent containers.
- `?engine=phaser&backdrop=tiles`: the previous stationary TileSprites, their texture coordinates scrolling each frame.

The paths share the same textures, fractional camera positions, parallax factors, tint, vertical cropping and pane clipping. The new default does not change the simulation or slow the camera. Add `&camera=smooth` to both URLs only for a separate camera comparison.

Browser pixel checks compare the two paths in landscape at 1×, a wide view at 2× and iPhone-sized portrait at 2×. They include both directions, fractional positions, tile-wrap boundaries and day/night tints. At most 0.0039% of pixels differ by more than three channel values in the measured comparisons. This verifies the same picture in Chromium; it does not prove the paths animate identically in Safari.

If the new default improves the remaining swing symptom, the TileSprite scrolling/sampling path becomes the primary suspect. If both look the same, trace the Phaser pane's camera-to-render transforms and interpolation next. The earlier catch-speed measurements alone should not be treated as a complete diagnosis.

Camera behavior is unchanged. Changing the catch snap would change gameplay, and making the smooth option the default should follow a visual check of its added camera lag.

## Validation

- Investigation script: all 24 motion runs and four subpixel rendering checks passed.
- New browser pixel comparisons: landscape, wide and portrait all passed through both paths, including fractional movement, negative scrolling, wraps and tint.
- Unit checks: 60 files, 665 tests passed, including an isolated rerun of `prefetch.test.js`. Its 16 ms timing assertion failed at 20.9 ms when the full unit suite ran alongside software-WebGL browser tests; all four prefetch tests passed when rerun separately after the browser run. No timing limit or generation code was changed.
- `npm run build`: passed.
- Full browser suite: all 43 passed, including the new movement comparisons, gameplay, resize/split-screen clipping, backdrop edges, single-shader batching and full Pixi/Phaser visual parity checks.
