// Measures drawn monkey/liana displacement in device pixels, independently of GPU
// timing. Start the dev server first. CHROMIUM and URL work as in background-motion.mjs.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = new URL(process.env.URL ?? 'http://localhost:5174/');
  url.searchParams.set('engine', 'phaser');
  await page.goto(url.href);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const results = await page.evaluate(async () => {
    const { app, platform } = window.__liano;
    app.loop.sleep();
    const { Game } = await import('/src/sim/game.js');
    const { World } = await import('/src/sim/world.js');
    const { createDriver } = await import('/src/driver.js');
    const results = [];
    for (const hz of [60, 90, 144]) {
      const game = new Game({ slip: false, createWorld: (options) => new World({ ...options, seed: 1, makeObstacle: () => null, makeBanana: () => null }) });
      platform.game = game;
      platform.world.sync();
      const driver = createDriver({ game,
        input: new Proxy({}, { get: () => () => false }), pause: { paused: false },
        sound: { setPaused() {}, play() {} }, prefetch: { update() {} },
        onStep: (dt) => platform.world.stepCameras(dt),
      });
      // An uninterrupted title-screen swing has a fixed grip, with no catch/reset.
      // Ignore the first three seconds so the camera has reached its repeating motion.
      const positions = [];
      let positionError = 0, angleError = 0;
      for (let i = 0; i < hz * 8; i++) {
        platform.frame = driver.frame(1000 / hz);
        platform.world.update();
        const pane = platform.world.panes[0];
        const monkey = game.world.monkey, liana = monkey.liana, alpha = platform.frame.alpha;
        const rig = pane.monkeys[0].view;
        const rope = pane.lianaSets[0].entries.get(liana).rope;
        const body = rig.getWorldTransformMatrix();
        // Rope points are in atlas pixels; invert its scale to select the physical tip.
        const tip = rope.getWorldTransformMatrix().transformPoint(0, liana.length / rope.scaleY);
        const zoom = platform.camera.zoom;
        if (i >= hz * 3) positions.push({ monkey: [body.tx * zoom, body.ty * zoom], tip: [tip.x * zoom, tip.y * zoom] });
        positionError = Math.max(positionError,
          Math.abs(rig.x - (monkey.prevX + (monkey.x - monkey.prevX) * alpha)),
          Math.abs(rig.y - (monkey.prevY + (monkey.y - monkey.prevY) * alpha)));
        angleError = Math.max(angleError, Math.abs(rope.rotation + liana.prevAngle + (liana.angle - liana.prevAngle) * alpha));
      }
      const peak = {};
      let repeated = 0;
      for (const key of ['monkey', 'tip']) {
        const steps = positions.slice(1).map((p, i) => Math.hypot(p[key][0] - positions[i][key][0], p[key][1] - positions[i][key][1]));
        peak[key] = Math.max(...steps);
        repeated += steps.filter((step) => step === 0).length;
      }
      if (positionError > 1e-9 || angleError > 1e-9 || repeated) throw new Error(`Interpolation failed at ${hz} Hz`);
      results.push({ hz, devicePixelsPerFrame: peak, repeatedPoses: repeated, maxPositionInterpolationError: positionError, maxAngleInterpolationError: angleError });
    }
    return results;
  });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
