import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

test('native Phaser quads ease real catches in both directions at 60/90/144 Hz', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser&frames=1`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const results = await page.evaluate(async () => {
    const { app, platform } = window.__liano;
    const { Game } = await import('/src/sim/game.js');
    const { World } = await import('/src/sim/world.js');
    const { createDriver } = await import('/src/driver.js');
    const { PhaserFrameClock } = await import('/src/phaser/frameClock.js');
    const { ARM, LIMBS, POSES, MonkeyPose } = await import('/src/views/monkey.js');
    app.loop.sleep();
    app.events.removeAllListeners('step');
    const transformer = app.renderer.renderNodes.getNode('TransformerImage');
    const original = transformer.run;
    let center;
    transformer.run = function (...args) {
      const result = original.apply(this, args);
      if (args[1].artKey === 'monkey.p1.torso') {
        const q = this.quad;
        center = { x: (q[0] + q[2] + q[4] + q[6]) / 4,
          y: (q[1] + q[3] + q[5] + q[7]) / 4 };
      }
      return result;
    };
    const results = [];
    try {
      for (const hz of [60, 90, 144]) for (const direction of [1, -1]) {
        const game = new Game({ slip: false, createWorld: (options) => new World({
          ...options, seed: 1, makeObstacle: () => null, makeBanana: () => null,
        }) });
        game.state = 'PLAYING';
        const m = game.world.monkey, next = game.world.lianas.get(direction);
        m.release();
        m.x = m.prevX = next.x - direction * 23;
        m.y = m.prevY = next.anchorY + 200;
        m.vx = direction * 240;
        m.vy = 10;
        platform.game = game;
        const play = platform.world;
        play.sync();
        const pane = play.panes[0];
        // Isolate the catch from camera movement, using the real renderer/driver.
        pane.camera.reset(m.x);
        const cameraUpdate = pane.camera.update;
        pane.camera.update = () => {};
        const clock = new PhaserFrameClock();
        for (let i = 0; i < 600; i++) clock.frame(1000 / hz);
        const driver = createDriver({ game, clock,
          input: new Proxy({}, { get: () => () => false }), pause: { paused: false },
          sound: { setPaused() {}, play() {} }, prefetch: { update() {} },
          onStep: (dt) => play.stepCameras(dt),
        });
        const onStep = (time, delta) => { platform.frame = driver.frame(delta); };
        app.events.on('step', onStep);
        try {
          let time = 0;
          app.step(time, 0);
          let previous = center, previousNative = center;
          let maximumCSS = 0, nativeMaximumCSS = 0, positionError = 0, gripError = 0, repeated = 0;
          const nativePose = new MonkeyPose(), ratio = 1 / app.scale.zoom;
          for (let i = 0; i < Math.ceil(0.15 * hz); i++) {
            center = null;
            app.step(time += 1000 / hz, 1000 / hz);
            if (!center) throw new Error('No submitted monkey torso quad');
            const rig = pane.monkeys[0], alpha = platform.frame.alpha;
            const sampled = pane.motion.monkey(m, alpha);
            const expected = nativePose.update(sampled, 0, false, alpha);
            positionError = Math.max(positionError, Math.abs(rig.view.x - expected.x), Math.abs(rig.view.y - expected.y));
            const native = nativePose.update(m, 0, false, alpha);
            if (m.state === 'HANGING') {
              const target = rig.body.getWorldTransformMatrix().transformPoint(
                LIMBS.armFront.x - Math.sin(POSES.hanging.armFront) * ARM.length,
                LIMBS.armFront.y + Math.cos(POSES.hanging.armFront) * ARM.length);
              target.x -= rig.catchOffsetX;
              target.y -= rig.catchOffsetY;
              const hand = rig.armFront.getWorldTransformMatrix().transformPoint(0, ARM.length / rig.armFrontUnit);
              gripError = Math.max(gripError, Math.abs(hand.x - target.x), Math.abs(hand.y - target.y));
            }
            const zoom = play.paneCameras[0].zoom;
            // Same submitted body rotation/art; restore only the old root position
            // to measure the center jump the previous drawing path would produce.
            const nativeCenter = { x: center.x + (native.x - rig.view.x) * zoom,
              y: center.y + (native.y - rig.view.y) * zoom };
            maximumCSS = Math.max(maximumCSS, Math.hypot(center.x - previous.x, center.y - previous.y) / ratio);
            nativeMaximumCSS = Math.max(nativeMaximumCSS, Math.hypot(nativeCenter.x - previousNative.x, nativeCenter.y - previousNative.y) / ratio);
            if (i > 1 && center.x === previous.x && center.y === previous.y) repeated++;
            previous = center;
            previousNative = nativeCenter;
          }
          const trace = window.__phaserFrameTrace.snapshot().frames.at(-1).panes[0];
          results.push({ hz, direction, maximumCSS, nativeMaximumCSS, positionError, gripError, repeated,
            caught: m.liana === next, finalOffset: trace.monkeyCatchOffset });
        } finally {
          pane.camera.update = cameraUpdate;
          app.events.off('step', onStep);
        }
      }
    } finally { transformer.run = original; }
    return results;
  });
  for (const result of results) {
    expect(result.caught, JSON.stringify(result)).toBe(true);
    expect(result.maximumCSS, JSON.stringify(result)).toBeLessThan(result.nativeMaximumCSS * 0.8);
    expect(result.positionError).toBeLessThan(1e-9);
    // Phaser stores composed transform matrices as Float32, including the
    // translated world coordinates. Allow less than 1/10,000 of a world pixel.
    expect(result.gripError, JSON.stringify(result)).toBeLessThan(1e-4);
    expect(result.repeated).toBe(0);
    expect(result.finalOffset).toEqual({ x: 0, y: 0 });
  }
  console.log('native catch motion:', JSON.stringify(results));
  expect(errors).toEqual([]);
});
