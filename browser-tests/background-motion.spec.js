import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors, started } from './helpers.js';

// A Safari comparison should keep the picture, parallax, tint and wrapping intact.
// Compare actual WebGL pixels through both paths, including fractional shifts and
// wrap boundaries, in landscape, a wide view and an iPhone-sized portrait view.
for (const [width, height, ratio] of [[1280, 720, 1], [1920, 800, 2], [375, 812, 2]]) {
  test(`the image backdrop matches the tiles at ${width} × ${height}, ${ratio}×`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: ratio });
    const errors = collectErrors(page);
    await page.goto(`${DEV}?engine=phaser`);
    await started(page, errors);
    await page.waitForFunction(() => window.__liano?.platform.world);
    const results = await page.evaluate(async () => {
      const { BackdropRig } = await import('/src/phaser/world/backdrop.js');
      const { app, platform } = window.__liano;
      app.loop.sleep();
      app.scene.getScene('ui').cameras.main.setVisible(false);
      const pane = platform.world.panes[0];
      pane.worldLayer.setVisible(false);
      pane.overlay.setVisible(false);
      const images = pane.backdrop;
      if (!images.layers.every((l) => l.copies && !l.tile)) throw new Error('Image mode was not selected');
      const tiles = new BackdropRig(platform.world, platform.art, { images: false });
      tiles.resize(pane.layout);
      pane.scene.add([tiles.back, tiles.front]);
      const gl = app.renderer.gl;
      const draw = (rig, cameraX) => {
        images.back.setVisible(rig === images); images.front.setVisible(rig === images);
        tiles.back.setVisible(rig === tiles); tiles.front.setVisible(rig === tiles);
        rig.update(cameraX);
        app.renderer.preRender(); app.scene.render(app.renderer); app.renderer.postRender();
        const pixels = new Uint8Array(app.canvas.width * app.canvas.height * 4);
        gl.readPixels(0, 0, app.canvas.width, app.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      };
      const results = [];
      for (const tint of [0xffffff, 0x506878]) {
        platform.art.tint([images.back, images.front, tiles.back, tiles.front], tint);
        const midWrap = 2048 / images.layers.find((l) => l.key === 'backdrop.mid').factor;
        // Mid-layer and foreground wrap boundaries, including backwards movement.
        for (const cameraX of [0, 0.125, -0.125, 2048, midWrap - 0.125, midWrap + 0.125, -midWrap - 0.125]) {
          const a = draw(images, cameraX), b = draw(tiles, cameraX);
          let different = 0, largest = 0;
          for (let i = 0; i < a.length; i += 4) {
            const delta = Math.max(...[0, 1, 2, 3].map((c) => Math.abs(a[i + c] - b[i + c])));
            if (delta > 3) different++;
            largest = Math.max(largest, delta);
          }
          results.push({ cameraX, tint, different: different / (a.length / 4), largest });
        }
      }
      return results;
    });
    console.log('image/tiles pixel differences:', JSON.stringify(results));
    for (const result of results) expect(result.different, JSON.stringify(result)).toBeLessThan(0.002);
    expect(errors).toEqual([]);
    await page.close();
  });
}

test('Phaser eases only distant scenery at fixed steps and resets it with the pane', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser`);
  await started(page, errors);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const result = await page.evaluate(() => {
    const { app, platform } = window.__liano;
    app.loop.sleep();
    const pane = platform.world.panes[0];
    // Use an externally stepped camera, as in shared screen, to isolate the scenery.
    const camera = { x: 0, prevX: 0 };
    pane.setWorld(pane.world, [0], camera);
    camera.x = camera.prevX = 100;
    pane.stepCamera(1 / 120);
    pane.update([], 1 / 60, false, null, 0.5);
    const drawn = pane.backdropCameraX;
    const layer = (key) => pane.backdrop.layers.find((l) => l.key === `backdrop.${key}`);
    const first = { sceneryX: drawn, worldX: pane.worldLayer.x,
      midX: layer('mid').view.x, canopyX: layer('canopy').view.x, floorX: layer('floor').view.x,
      factors: ['far', 'mid', 'near', 'nearTop', 'canopy', 'floor'].map((key) => layer(key).factor),
    };
    // Rendering/pausing does not advance the spring: only simulation steps do.
    pane.update([], 0, false, null, 0.5);
    const pausedX = pane.backdropCameraX;
    pane.update([], 1 / 60, false, null, 0.5);
    const renderOnlyX = pane.backdropCameraX;
    camera.x = camera.prevX = 1000;
    pane.resize(pane.layout, platform.camera.zoom);
    pane.update([], 0, false, null, 0.5);
    const resized = [pane.backdropCameraX, pane.backdropMotion.velocity];
    camera.x = camera.prevX = -1000;
    pane.setWorld(pane.world, [0], camera);
    pane.update([], 0, false, null, 0.5);
    return { first, pausedX, renderOnlyX, resized, reset: [pane.backdropCameraX, pane.backdropMotion.velocity] };
  });
  expect(result.first.sceneryX).toBeGreaterThan(0);
  expect(result.first.sceneryX).toBeLessThan(1);
  expect(result.first.worldX).toBe(-100);
  expect(result.first.midX).toBeCloseTo(-result.first.sceneryX * 0.32, 9);
  expect(result.first.canopyX).toBe(-100);
  expect(result.first.floorX).toBe(-100);
  result.first.factors.forEach((factor, i) => expect(factor).toBeCloseTo([0.12, 0.32, 0.56, 0.56, 1, 1][i], 9));
  expect(result.pausedX).toBe(result.first.sceneryX);
  expect(result.renderOnlyX).toBe(result.first.sceneryX);
  expect(result.resized).toEqual([1000, 0]);
  expect(result.reset).toEqual([-1000, 0]);
  expect(errors).toEqual([]);
});

test('moving trees average their exposure without darkening, seams or shader recompiles', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser`);
  await started(page, errors);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const results = await page.evaluate(() => {
    const { app, platform } = window.__liano;
    app.loop.sleep();
    app.scene.getScene('ui').cameras.main.setVisible(false);
    const pane = platform.world.panes[0], rig = pane.backdrop;
    pane.worldLayer.setVisible(false); pane.overlay.setVisible(false); rig.front.setVisible(false);
    for (const { key, view } of rig.layers) view.setVisible(key === 'backdrop.mid');
    const mid = rig.layers.find((l) => l.key === 'backdrop.mid');
    const gl = app.renderer.gl;
    const row = () => {
      app.renderer.preRender(); app.scene.render(app.renderer); app.renderer.postRender();
      const pixels = new Uint8Array(app.canvas.width * 4);
      gl.readPixels(0, Math.floor(app.canvas.height / 2), app.canvas.width, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const gradient = (pixels) => {
      let largest = 0;
      for (let i = 4; i < pixels.length; i += 4) {
        largest = Math.max(largest, ...[0, 1, 2].map((c) => Math.abs(pixels[i + c] - pixels[i - 4 + c])));
      }
      return largest;
    };
    const results = [];
    const width = 3; // world units of exposure, six device pixels at this density
    for (const tint of [0xffffff, 0x506878]) for (const center of [1000, 2048 / mid.factor]) {
      platform.art.tint([rig.back], tint);
      rig.resetMotion(); rig.update(center, center, 0);
      const sharp = row();
      rig.update(center - width / mid.factor, center - width / mid.factor, 0);
      rig.update(center, center, 1 / 60);
      const blurred = row();
      const expected = new Float64Array(sharp.length);
      // Ground truth: average nine sharp rendered poses through the same travel.
      for (let sample = 0; sample < 9; sample++) {
        const offset = (sample - 4) / 8;
        const cameraX = center + (width * offset) / mid.factor;
        rig.update(cameraX, cameraX, 0);
        const pixels = row();
        pixels.forEach((value, i) => (expected[i] += value / 9));
      }
      const error = Math.max(...Array.from(blurred, (value, i) => Math.abs(value - expected[i])));
      rig.update(center, center, 0);
      const stopped = row();
      results.push({ tint, center, error, sharpGradient: gradient(sharp), blurredGradient: gradient(blurred), stopError: Math.max(...stopped.map((value, i) => Math.abs(value - sharp[i]))) });
    }
    // Different speeds/directions are uniform values, with the shader already cached.
    const batch = app.renderer.renderNodes.getNode('BackdropExposureBatch');
    const programs = Object.keys(batch.programManager.programs);
    for (const position of [600, 599, 600, 601, 600]) { rig.update(position, position, 1 / 60); row(); }
    return { rows: results, programs, after: Object.keys(batch.programManager.programs) };
  });
  console.log('tree exposure:', JSON.stringify(results));
  for (const result of results.rows) {
    expect(result.error).toBeLessThanOrEqual(3);
    expect(result.blurredGradient).toBeLessThan(result.sharpGradient * 0.65);
    expect(result.stopError).toBe(0);
  }
  expect(results.programs).toHaveLength(1);
  expect(results.after).toEqual(results.programs);
  expect(errors).toEqual([]);
  await page.close();
});

test('the scenery motion-blur comparison can be disabled', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser&motionblur=off`);
  await started(page, errors);
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => {
    const { app, platform } = window.__liano;
    const copies = platform.world.panes[0].backdrop.layers.filter((l) => l.scenery).flatMap((l) => l.view.list);
    return copies.every((image) => !image.customRenderNodes.BatchHandler) && app.renderer.renderNodes.getNode('BackdropExposureBatch') === null;
  })).toBe(true);
  expect(errors).toEqual([]);
});
