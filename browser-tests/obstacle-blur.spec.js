import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

test('obstacle blur is opt-in and toggles without starting/restarting the game', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => !!window.__liano.app.renderer.renderNodes.getNode('ObjectExposureBatch'))).toBe(false);
  await expect(page.locator('#obstacle-blur-toggle')).toHaveCount(0);
  await page.goto(`${DEV}?engine=phaser&obstacleblur=on&frames=1`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const button = page.locator('#obstacle-blur-toggle');
  await expect(button).toContainText('ON');
  const world = await page.evaluate(() => window.__liano.game.world.seed);
  await page.keyboard.press('KeyB');
  await expect(button).toContainText('OFF');
  await button.click();
  await expect(button).toContainText('ON');
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  expect(await page.evaluate(() => window.__liano.game.world.seed)).toBe(world);
  await expect.poll(() => page.evaluate(() => window.__phaserFrameTrace.snapshot().frames.at(-1).panes[0].obstacleBlur.enabled)).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
  expect(await page.evaluate(() => window.__liano.platform.obstacleBlur.enabled)).toBe(true);
  expect(errors).toEqual([]);
});

for (const ratio of [1, 2]) test(`blurred WebGL pixels match five translated poses at ${ratio}×, without atlas bleed or a stationary smear`, async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: ratio });
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const results = await page.evaluate(async (ratio) => {
    const { ObjectExposure } = await import('/src/phaser/world/objectExposure.js');
    const { exposeImages, exposureNodes } = await import('/src/phaser/world/objectExposureShader.js');
    const { app, platform } = window.__liano;
    app.loop.sleep();
    app.scene.getScene('ui').cameras.main.setVisible(false);
    const scene = platform.world;
    scene.panes.forEach((pane) => pane.view.setVisible(false));
    scene.paneCameras.forEach((camera) => camera.setVisible(false));
    scene.cameras.main.setVisible(true).setViewport(0, 0, app.canvas.width, app.canvas.height).setOrigin(0, 0).setZoom(1).setScroll(0, 0);
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(22, 22, 20, 20);
    // A bright adjacent frame must never be pulled into the expanded sprite.
    ctx.fillStyle = '#ff00ff'; ctx.fillRect(48, 16, 32, 32);
    const texture = scene.textures.addCanvas('blur.pixel.test', canvas);
    texture.add('piece', 0, 16, 16, 32, 32);
    // The reference has identical frame pixels and transparent surrounding space.
    // Ordinary atlas sampling itself can bleed a neighbour into a fractional edge;
    // it must not become part of the expected exposure.
    const isolated = document.createElement('canvas'); isolated.width = 96; isolated.height = 64;
    isolated.getContext('2d').drawImage(canvas, 0, 0);
    isolated.getContext('2d').clearRect(48, 16, 32, 32);
    const referenceTexture = scene.textures.addCanvas('blur.pixel.reference', isolated);
    referenceTexture.add('piece', 0, 16, 16, 32, 32);
    const plain = scene.add.image(140, 170, referenceTexture.key, 'piece').setOrigin(0.3, 0.7);
    const exposed = scene.add.image(140, 170, texture.key, 'piece').setOrigin(0.3, 0.7);
    const state = new ObjectExposure(), nodes = exposureNodes(scene);
    exposeImages(exposed, state, nodes);
    const gl = app.renderer.gl;
    const read = (image, x, y) => {
      plain.setVisible(image === plain); exposed.setVisible(image === exposed);
      image.setPosition(x, y);
      app.renderer.preRender(); app.scene.render(app.renderer); app.renderer.postRender();
      const pixels = new Uint8Array(160 * 160 * 4);
      gl.readPixels(80, app.canvas.height - 240, 160, 160, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const error = (a, b) => {
      let largest = 0, mean = 0;
      for (let i = 0; i < a.length; i++) { const n = Math.abs(a[i] - b[i]); largest = Math.max(largest, n); mean += n; }
      return { largest, mean: mean / a.length };
    };
    const results = [];
    for (const rotation of [0, 0.7, -1.2]) for (const crop of [false, true]) {
      for (const image of [plain, exposed]) {
        image.setRotation(rotation).setScale(2, 1.5).setAlpha(0.7).setTint(0x80efaa);
        if (crop) image.setCrop(4, 3, 24, 25); else image.setCrop();
      }
      const originalFrame = JSON.stringify(exposed.frame.data);
      state.reset(); state.begin(1 / 60, ratio); read(exposed, 130, 166);
      state.begin(1 / 60, ratio);
      const blurred = read(exposed, 142, 170);
      const data = state.history.get(exposed), dx = data.dx, dy = data.dy;
      const reference = new Float32Array(blurred.length);
      for (const offset of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const pixels = read(plain, 142 + dx * offset, 170 + dy * offset);
        for (let i = 0; i < pixels.length; i++) reference[i] += pixels[i] / 5;
      }
      const moving = error(blurred, reference);
      state.begin(1 / 60, ratio);
      // At zero motion use the ordinary shader on the very same atlas, including
      // its own edge filtering; exact equality verifies no residual softening.
      plain.setTexture(texture.key, 'piece');
      const stationary = error(read(exposed, 142, 170), read(plain, 142, 170));
      plain.setTexture(referenceTexture.key, 'piece');
      if (originalFrame !== JSON.stringify(exposed.frame.data)) throw new Error('Native frame cache was changed');
      let bleed = 0;
      for (let i = 0; i < blurred.length; i += 4) if (blurred[i] > 5 && blurred[i + 1] < 3) bleed++;
      results.push({ rotation, crop, moving, stationary, bleed, exposureCSS: Math.hypot(dx, dy) / ratio });
    }
    return { results, programs: Object.keys(nodes.batch.programManager.programs) };
  }, ratio);
  console.log(`object exposure pixels ${ratio}×:`, JSON.stringify(results));
  for (const row of results.results) {
    expect(row.moving.mean, JSON.stringify(row)).toBeLessThan(0.05);
    expect(row.moving.largest, JSON.stringify(row)).toBeLessThanOrEqual(3);
    expect(row.stationary.largest).toBe(0);
    expect(row.bleed).toBe(0);
    expect(row.exposureCSS).toBeCloseTo(3);
  }
  expect(results.programs).toHaveLength(1);
  expect(errors).toEqual([]);
  await page.close();
});

test('different velocities share one batch, without framebuffer or texture allocation during motion', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const result = await page.evaluate(async () => {
    const { ObjectExposure } = await import('/src/phaser/world/objectExposure.js');
    const { exposeImages, exposureNodes } = await import('/src/phaser/world/objectExposureShader.js');
    const { app, platform } = window.__liano;
    app.loop.sleep();
    // Count only the test images, excluding every UI camera.
    app.scene.getScene('ui').sys.setVisible(false);
    const scene = platform.world;
    scene.panes.forEach((p) => p.view.setVisible(false)); scene.paneCameras.forEach((c) => c.setVisible(false));
    scene.cameras.main.setVisible(true).setViewport(0, 0, app.canvas.width, app.canvas.height).setOrigin(0, 0).setZoom(1).setScroll(0, 0);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
    canvas.getContext('2d').fillRect(2, 2, 12, 12);
    const texture = scene.textures.addCanvas('blur.batch.test', canvas);
    const images = Array.from({ length: 64 }, (_, i) => scene.add.image(40 + i % 8 * 30, 40 + Math.floor(i / 8) * 30, texture.key));
    const state = new ObjectExposure(), nodes = exposureNodes(scene);
    const render = () => { app.renderer.preRender(); app.scene.render(app.renderer); app.renderer.postRender(); };
    render();
    const gl = app.renderer.gl;
    let calls = 0, allocations = 0;
    const draw = gl.drawElements, upload = gl.texImage2D, sub = gl.texSubImage2D, framebuffer = gl.createFramebuffer;
    gl.drawElements = function (...args) { calls++; return draw.apply(this, args); };
    gl.texImage2D = function (...args) { allocations++; return upload.apply(this, args); };
    gl.texSubImage2D = function (...args) { allocations++; return sub.apply(this, args); };
    gl.createFramebuffer = function (...args) { allocations++; return framebuffer.apply(this, args); };
    try {
      render(); const ordinaryCalls = calls; calls = 0;
      images.forEach((image) => exposeImages(image, state, nodes));
      state.begin(1 / 60, 1); render(); calls = 0;
      state.begin(1 / 60, 1);
      images.forEach((image, i) => { image.x += (i % 4 + 1) * 2; image.y += i % 3; });
      render();
      const blurredCalls = calls;
      const metrics = { ordinaryCalls, blurredCalls, allocations, images: state.images, maximumCSS: state.maximumCSS, programs: Object.keys(nodes.batch.programManager.programs) };
      return metrics;
    } finally { gl.drawElements = draw; gl.texImage2D = upload; gl.texSubImage2D = sub; gl.createFramebuffer = framebuffer; }
  });
  console.log('object exposure batching:', JSON.stringify(result));
  expect(result.ordinaryCalls).toBe(1);
  expect(result.blurredCalls).toBe(result.ordinaryCalls);
  expect(result.allocations).toBe(0);
  expect(result.images).toBe(64);
  expect(result.maximumCSS).toBe(3);
  expect(result.programs).toHaveLength(1);
  expect(errors).toEqual([]);
});
