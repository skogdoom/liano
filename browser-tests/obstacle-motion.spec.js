import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

for (const blur of [false, true]) test(`native Phaser frames continuously draw temples, moving obstacles and settling vines at 60/90/144 Hz${blur ? ' with obstacle exposure' : ''}`, async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.goto(`${DEV}${blur ? '?obstacleblur=on' : ''}`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const results = await page.evaluate(async () => {
    const { app, platform } = window.__liano;
    app.loop.sleep();
    const { Game } = await import('/src/sim/game.js');
    const { World } = await import('/src/sim/world.js');
    const { Obstacle } = await import('/src/sim/obstacle.js');
    const { createDriver } = await import('/src/driver.js');
    const { PhaserFrameClock } = await import('/src/platform/frameClock.js');
    const { MAX_STEP_TURN, blend } = await import('/src/render/interpolate.js');
    const { ropePoints } = await import('/src/views/liana.js');
    app.events.removeAllListeners('step');
    const nodes = ['TransformerImage', 'ObjectExposureTransformer'].map((name) => app.renderer.renderNodes.getNode(name)).filter(Boolean);
    const originals = nodes.map((node) => node.run);
    const keys = ['temple.limestone.top', 'spider.body', 'monkey.p1.torso'];
    let quads = {};
    let centerError = 0;
    nodes.forEach((node, i) => {
      node.run = function (...args) {
        const result = originals[i].apply(this, args), image = args[1], key = image.artKey;
        if (keys.includes(key) && !quads[key]) quads[key] = [...this.quad];
        if (image.objectExposure) {
          const drawn = image.objectExposure.history.get(image);
          const q = this.quad;
          centerError = Math.max(centerError, Math.abs((q[0] + q[2] + q[4] + q[6]) / 4 - drawn.x),
            Math.abs((q[1] + q[3] + q[5] + q[7]) / 4 - drawn.y));
        }
        return result;
      };
    });
    try {
      const out = [];
      for (const hz of [60, 90, 144]) {
        const game = new Game({ slip: false, createWorld: (options) => {
          const world = new World({ ...options, seed: 1, makeBanana: () => null,
            makeObstacle: (seed, gap) => {
              let o = null;
              if (gap === 1) o = new Obstacle(gap, 'temple', 400, 100, null, 1, null, 0);
              if (gap === 2) o = new Obstacle(gap, 'spider', 240, 220, { period: 3, phase: 0, ax: 0, ay: 75, bob: 0 });
              if (o) { o.hitsCircle = () => false; o.hitsCircleAt = () => false; }
              return o;
            } });
          // A settling vine independent of the monkey's uninterrupted title swing.
          const liana = world.lianas.get(-1);
          liana.grab(1); liana.step(0.13); liana.release();
          return world;
        } });
        platform.game = game;
        const play = platform.world;
        play.sync();
        const clock = new PhaserFrameClock();
        const driver = createDriver({ game, clock,
          input: new Proxy({}, { get: () => () => false }), pause: { paused: false },
          sound: { setPaused() {}, play() {} }, prefetch: { update() {} },
          onStep: (dt) => play.stepCameras(dt),
        });
        const onStep = (time, delta) => { platform.frame = driver.frame(delta); };
        app.events.on('step', onStep);
        const pane = play.panes[0], spider = game.world.obstacles.get(2), settling = game.world.lianas.get(-1);
        const repeated = Object.fromEntries(keys.map((key) => [key, 0]));
        let previous = null, positionError = 0, settlingError = 0;
        let time = 0;
        for (let i = 0; i < 150; i++) {
          quads = {};
          app.step(time += 1000 / hz, 1000 / hz);
          const { alpha } = platform.frame, drawTime = pane.motion.at(alpha);
          const expected = spider.positionAt(drawTime), body = pane.obstacles.rigs.get(spider).body;
          positionError = Math.max(positionError, Math.abs(body.x - expected.x), Math.abs(body.y - expected.y));
          if (settling.state === 'SETTLING') {
            const sampled = pane.motion.liana(settling, alpha);
            const entry = pane.lianaSets[0].entries.get(settling);
            // Actual rope geometry, not just its model: the last point before the cap.
            const points = ropePoints(sampled, entry.layout.bow), tip = points.at(-1);
            const n = entry.rope.points.length - 2, point = entry.rope.points[n];
            settlingError = Math.max(settlingError, Math.abs(point.x * entry.rope.scaleX - tip.x), Math.abs(point.y * entry.rope.scaleY - tip.y));
            if (sampled.angle !== blend(settling.prevAngle, settling.angle, alpha, MAX_STEP_TURN)) throw new Error('Settling angle was not interpolated');
          }
          if (i >= 30 && previous) for (const key of keys) {
            if (!quads[key]) throw new Error(`Missing native quad: ${key}`);
            if (JSON.stringify(quads[key]) === JSON.stringify(previous[key])) repeated[key]++;
          }
          previous = quads;
        }
        app.events.off('step', onStep);
        out.push({ hz, frames: 150, positionError, settlingError, centerError, repeated });
      }
      return out;
    } finally { nodes.forEach((node, i) => { node.run = originals[i]; }); }
  });
  for (const result of results) {
    expect(result.positionError).toBeLessThan(1e-9);
    expect(result.settlingError).toBeLessThan(1e-4);
    expect(result.centerError).toBeLessThan(1e-4);
    expect(Object.values(result.repeated)).toEqual([0, 0, 0]);
  }
  console.log('native obstacle motion:', JSON.stringify(results));
  expect(errors).toEqual([]);
});
