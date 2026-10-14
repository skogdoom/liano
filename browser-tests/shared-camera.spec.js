import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

test('Phaser shared camera eases leader loss and interpolates fast pans at 60/90/144 Hz', async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${DEV}?mode=shared`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const results = await page.evaluate(async () => {
    const { app, platform } = window.__liano;
    const { Game } = await import('/src/sim/game.js');
    const { World } = await import('/src/sim/world.js');
    const { SharedView } = await import('/src/sim/sharedView.js');
    const { createDriver } = await import('/src/driver.js');
    const { blend } = await import('/src/render/interpolate.js');
    const { CAMERA_LERP, LIANA_SPACING, START_GRIP } = await import('/src/config.js');
    const sharedFactory = platform.game.createSharedView;
    const selected = platform.game.sharedView.camera;
    if (selected.lags !== 2 || selected.rate !== CAMERA_LERP * 2) throw new Error('Phaser did not select the smoother shared camera');
    app.loop.sleep();
    app.events.removeAllListeners('step');
    const transformer = app.renderer.renderNodes.getNode('TransformerImage');
    const original = transformer.run;
    let midImage = null, midCenter = null;
    transformer.run = function (...args) {
      const result = original.apply(this, args);
      if (args[1].artKey === 'backdrop.mid') {
        midImage ??= args[1];
        if (args[1] === midImage) {
          const q = this.quad;
          midCenter = (q[0] + q[2] + q[4] + q[6]) / 4;
        }
      }
      return result;
    };
    const results = [];
    try {
      for (const hz of [60, 90, 144]) for (const smooth of [false, true]) {
        const game = new Game({ slip: false,
          createWorld: (options) => new World({ ...options, seed: 4242, makeObstacle: () => null, makeBanana: () => null }),
          createSharedView: smooth ? sharedFactory : (world) => new SharedView(world),
        });
        game.selectMode('shared');
        game.press('start');
        // The leader has reached the next liana and its camera has settled there.
        // Losing that leader then pans back one full gap to the remaining player.
        const leader = game.world.monkeys[1];
        leader.grab(game.world.lianaSets[1].get(1), START_GRIP);
        game.sharedView.camera.reset(LIANA_SPACING);
        platform.game = game;
        const play = platform.world;
        play.sync();
        const pane = play.panes[0], camera = pane.camera;
        if (camera !== game.sharedView.camera) throw new Error('Drawing and rules use different cameras');
        const driver = createDriver({ game, clock: { frame: (ms) => ms },
          input: new Proxy({}, { get: () => () => false }), pause: { paused: false },
          sound: { setPaused() {}, play() {} }, prefetch: { update() {} },
          onStep: (dt) => play.stepCameras(dt),
        });
        const step = (time, delta) => { platform.frame = driver.frame(delta); };
        app.events.on('step', step);
        try {
          midImage = midCenter = null;
          app.step(0, 0);
          if (midCenter === null) throw new Error('No submitted mid-layer quad');
          const firstMid = midCenter, firstCamera = pane.cameraX;
          const cssRatio = app.canvas.width / app.canvas.getBoundingClientRect().width;
          const scale = pane.layout.scale * play.paneCameras[0].zoom / cssRatio;
          game.world.eliminate(1, 'fall');
          let time = 0, previous = firstCamera, previousMove = 0;
          let maximumMove = 0, maximumSpeedChange = 0, interpolationError = 0, midError = 0, worldError = 0, fastSamples = 0;
          for (let i = 0; i < Math.ceil(hz * 0.6); i++) {
            midCenter = null;
            app.step(time += 1000 / hz, 1000 / hz);
            if (midCenter === null) throw new Error('Mid-layer quad disappeared during the pan');
            const alpha = platform.frame.alpha;
            const interpolated = camera.prevX + (camera.x - camera.prevX) * alpha;
            interpolationError = Math.max(interpolationError, Math.abs(pane.cameraX - interpolated));
            worldError = Math.max(worldError, Math.abs(pane.worldLayer.x + pane.cameraX), Math.abs(pane.overlay.x + pane.cameraX));
            midError = Math.max(midError, Math.abs((midCenter - firstMid) / cssRatio + (pane.cameraX - firstCamera) * 0.12 * scale));
            if (Math.abs(camera.x - camera.prevX) > 30) fastSamples++;
            // Reconstruct the previous drawing's 30-unit interpolation cutoff
            // for the original response; the new response uses submitted motion.
            const drawn = smooth ? pane.cameraX : blend(camera.prevX, camera.x, alpha);
            const move = (drawn - previous) * scale;
            maximumMove = Math.max(maximumMove, Math.abs(move));
            maximumSpeedChange = Math.max(maximumSpeedChange, Math.abs(move - previousMove));
            previous = drawn;
            previousMove = move;
          }
          results.push({ hz, smooth, maximumMove, maximumSpeedChange, interpolationError, midError, worldError,
            fastSamples, leader: game.sharedView.leader, finalTargetError: Math.abs(camera.x + camera.screenX) });
        } finally { app.events.off('step', step); }
      }
    } finally { transformer.run = original; }
    return results;
  });
  for (const hz of [60, 90, 144]) {
    const before = results.find((r) => r.hz === hz && !r.smooth);
    const after = results.find((r) => r.hz === hz && r.smooth);
    expect(after.maximumSpeedChange, JSON.stringify({ before, after })).toBeLessThan(before.maximumSpeedChange * 0.5);
    expect(after.maximumMove).toBeLessThan(before.maximumMove);
    expect(after.interpolationError).toBeLessThan(1e-9);
    expect(after.midError).toBeLessThan(0.001); // submitted Float32 transforms
    expect(after.worldError).toBe(0);
    expect(after.fastSamples).toBeGreaterThan(0); // exercises the former interpolation cutoff
    expect(after.leader).toBe(0);
    expect(after.finalTargetError).toBeLessThan(1);
  }
  console.log('shared-camera leader-loss motion:', JSON.stringify(results));
  expect(errors).toEqual([]);
});
