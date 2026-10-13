// Isolates background motion from browser frame pacing and obstacle generation.
// Start the dev server and build the art first. Usage:
// CHROMIUM=/usr/bin/chromium URL=http://localhost:5174/ node scripts/dev/background-motion.mjs
// Results are measurements, not a benchmark of the host GPU or display.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const results = [];
try {
  for (const backdrop of ['tiles', 'images']) for (const camera of ['', 'smooth']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = new URL(process.env.URL ?? 'http://localhost:5174/');
    url.searchParams.set('engine', 'phaser');
    url.searchParams.set('camera', camera);
    url.searchParams.set('backdrop', backdrop);
    await page.goto(url.href);
    await page.waitForFunction(() => window.__liano?.platform.world);
    const result = await page.evaluate(async () => {
      const { app, platform } = window.__liano;
      app.loop.sleep();
      const { Game } = await import('/src/sim/game.js');
      const { World } = await import('/src/sim/world.js');
      const { createDriver } = await import('/src/driver.js');
      const { longestRun, validReleaseSteps } = await import('/src/sim/feasibility.js');
      const { layerShift, SKY_MARGIN, MID_FACTOR } = await import('/src/views/backdrop.js');
      const { SIM_DT, SWING_PERIOD } = await import('/src/config.js');
      const play = platform.world;
      // A fresh driver per rate makes its accumulator/clock independent of page startup.
      // No obstacles, bananas, audio or UI changes: catches cannot incur those costs.
      const motion = [];
      for (const slip of [false, true]) for (const hz of [60, 90, 144]) {
        const game = new Game({ slip, createWorld: (options) => new World({ ...options, seed: 1, makeObstacle: () => null, makeBanana: () => null }) });
        platform.game = game;
        play.sync();
        const driver = createDriver({
          game,
          input: new Proxy({}, { get: () => () => false }),
          pause: { paused: false }, sound: { setPaused() {}, play() {} }, prefetch: { update() {} },
          onStep: (dt) => { play.sync(); play.stepCameras(dt); },
        });
        game.press('start');
        let key = null;
        let releaseStep = Infinity;
        const frames = [];
        for (let i = 0; i < hz * 20; i++) {
          const m = game.world.monkey;
          if (m.state === 'HANGING') {
            const next = `${m.liana.index}:${m.gripFrom}`;
            if (next !== key) {
              key = next;
              const run = longestRun(validReleaseSteps(null, m.gripFrom, m.liana.x, m.liana.swingDir, 0, m.holds).valid);
              releaseStep = run.start + Math.floor(run.length / 2) - 1;
            }
            if (m.gripTime / SIM_DT >= releaseStep) { game.press('primary'); releaseStep = Infinity; }
          }
          platform.frame = driver.frame(1000 / hz);
          play.update();
          const pane = play.panes[0];
          const cameraX = pane.cameraX;
          const caught = platform.frame.events.some((e) => e.type === 'grab');
          const monkey = game.world.monkey;
          frames.push({ cameraX, sceneryX: pane.backdropCameraX, monkeyX: monkey.x, caught, state: monkey.state });
          for (const { tile, copies, factor, scenery, key: artKey } of pane.backdrop.layers) {
            const shift = layerShift(scenery ? pane.backdropCameraX : cameraX, factor);
            const actual = copies ? copies.view.x : tile.tilePositionX;
            const expected = copies ? -shift : (shift - SKY_MARGIN) * platform.art.at(artKey).zoom;
            if (actual !== expected) throw new Error('Backdrop did not use the interpolated camera');
          }
          if (game.state !== 'PLAYING') throw new Error(`Bot stopped at frame ${i}, ${hz} Hz, slip=${slip}`);
        }
        const shifts = frames.slice(1).map((f, i) => f.cameraX - frames[i].cameraX);
        const acceleration = shifts.slice(1).map((dx, i) => (dx - shifts[i]) * hz * hz);
        const sceneryShifts = frames.slice(1).map((f, i) => f.sceneryX - frames[i].sceneryX);
        const sceneryAcceleration = sceneryShifts.slice(1).map((dx, i) => (dx - sceneryShifts[i]) * hz * hz);
        const midFactor = play.panes[0].backdrop.layers.find((l) => l.key === 'backdrop.mid').factor;
        // The catch and the next two frames: interpolation can split a catch across them.
        const grabs = frames.flatMap((f, i) => f.caught ? [{
          frame: i,
          cameraSpeedBefore: shifts[i - 2] * hz,
          cameraSpeedsAfter: shifts.slice(i - 1, i + 2).map((dx) => dx * hz),
          peakAcceleration: Math.max(...acceleration.slice(i - 2, i + 1).map(Math.abs)),
          monkeyStep: f.monkeyX - frames[i - 1].monkeyX,
        }] : []);
        motion.push({ slip, hz, frames: frames.length, grabs: grabs.length,
          repeatedCameraFrames: shifts.filter((dx) => dx === 0).length,
          repeatedSceneryFrames: sceneryShifts.filter((dx) => dx === 0).length,
          peakCatchAcceleration: Math.max(...grabs.map((g) => g.peakAcceleration)),
          peakAcceleration: Math.max(...acceleration.map(Math.abs)), firstCatch: grabs[0],
          peakPreviousMidAcceleration: Math.max(...acceleration.map(Math.abs)) * MID_FACTOR,
          peakMidAcceleration: Math.max(...sceneryAcceleration.map(Math.abs)) * midFactor,
          peakMidDevicePixelsPerFrame: Math.max(...sceneryShifts.map(Math.abs)) * midFactor * 2,
        });
      }
      // One uninterrupted swing on the title world's first liana. Holding its grip
      // fixed separates the pendulum/camera motion from catches and quick slides.
      const swingGame = new Game({ slip: false, createWorld: (options) => new World({ ...options, seed: 1, makeObstacle: () => null, makeBanana: () => null }) });
      platform.game = swingGame;
      play.sync();
      const swingFrames = [];
      for (let i = 0; i < Math.ceil(SWING_PERIOD * 60); i++) {
        swingGame.step(SIM_DT); play.stepCameras(SIM_DT);
        swingGame.step(SIM_DT); play.stepCameras(SIM_DT);
        platform.frame = { frameDt: 1 / 60, alpha: 1, events: [] };
        play.update();
        swingFrames.push(play.panes[0].backdropCameraX);
      }
      const swingShifts = swingFrames.slice(1).map((x, i) => x - swingFrames[i]);
      const swing = {
        hz: 60, frames: swingFrames.length,
        speedRange: [Math.min(...swingShifts) * 60, Math.max(...swingShifts) * 60],
        peakMidLayerDevicePixelsPerFrame: Math.max(...swingShifts.map(Math.abs)) * play.panes[0].backdrop.layers.find((l) => l.key === 'backdrop.mid').factor * 2,
        directionChanges: swingShifts.slice(1).filter((dx, i) => Math.sign(dx) !== Math.sign(swingShifts[i])).length,
      };
      // Actual GPU pixels, separately: isolate the mid (dark green trunks) layer over
      // the sky. Force small camera moves; no simulation, UI or other layers can move.
      const pane = play.panes[0];
      app.scene.getScene('ui').cameras.main.setVisible(false);
      pane.worldLayer.setVisible(false);
      pane.backdrop.front.setVisible(false);
      for (const { key, view } of pane.backdrop.layers) view.setVisible(key === 'backdrop.mid');
      const gl = app.renderer.gl;
      let previous = null;
      const pixelDiffs = [];
      for (let i = 0; i <= 10; i++) {
        pane.backdrop.update(i / 10);
        app.renderer.preRender(); app.scene.render(app.renderer); app.renderer.postRender();
        const row = new Uint8Array(app.canvas.width * 4);
        gl.readPixels(0, Math.floor(app.canvas.height / 2), app.canvas.width, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
        if (previous) pixelDiffs.push(row.reduce((sum, value, j) => sum + Math.abs(value - previous[j]), 0));
        previous = row;
      }
      if (pixelDiffs.some((d) => d === 0)) throw new Error('A subpixel scroll left the rendered tree row unchanged');
      return { motion, swing, subpixelScroll: { cameraStep: 0.1, midLayerDevicePixelStep: 0.1 * pane.backdrop.layers.find((l) => l.key === 'backdrop.mid').factor * 2, pixelDiffs } };
    });
    if (errors.length) throw new Error(errors.join('\n'));
    results.push({ backdrop, camera: camera || 'default', ...result });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
