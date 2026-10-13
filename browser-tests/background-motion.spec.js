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
        // mid-layer wrap at ±5120; canopy/floor wrap at 2048.
        for (const cameraX of [0, 0.125, -0.125, 2048, 5119.875, 5120.125, -5120.125]) {
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
