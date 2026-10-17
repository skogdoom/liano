import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { layoutFor } from '../src/layout.js';
import { collectErrors } from './helpers.js';

async function fitted(page, fullscreen, fixed = false) {
  const { width, height } = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await expect.poll(() => page.evaluate(() => window.__liano.layout)).toEqual(
    layoutFor(width, height, undefined, { fullscreen, fixed }),
  );
  // Layout events precede the scene's next frame and camera render-list update.
  await page.evaluate(() => new Promise(resolve => window.__liano.app.events.once('postrender', resolve)));
}

// Put a bright marker behind the canopy/floor, hiding the rest of the world.
// Check the canopy at the world's top and the floor at the screen's bottom,
// including shake. Portrait's restored space above the canopy stays visible.
async function edgeCoverage(page) {
  return page.evaluate(() => {
    const { app, platform } = window.__liano;
    const ui = app.scene.getScene('ui');
    const pane = platform.world.panes[0];
    const { backdrop, scene, worldLayer } = pane;
    const { view, bandTop } = pane.layout;
    const marker = new window.Phaser.GameObjects.Rectangle(platform.world, -50, -bandTop - 50,
      view.width + 100, view.height + 100, 0xff00ff).setOrigin(0);
    backdrop.back.add(marker);
    const originalY = scene.y;
    const visible = [ui.sys.settings.visible, worldLayer.visible, pane.overlay.visible];
    app.loop.sleep();
    ui.sys.setVisible(false); worldLayer.setVisible(false); pane.overlay.setVisible(false);
    const { gl } = app.renderer;
    const draw = () => { app.renderer.preRender(); app.scene.render(app.renderer); app.renderer.postRender(); };
    const row = (fromTop) => {
      const { x, y, width, height } = platform.camera;
      const pixels = new Uint8Array((width - 4) * 4);
      const offset = fromTop === 'sky' ? 3 : fromTop ? 3 + Math.round(bandTop * platform.camera.zoom) : height - 3;
      gl.readPixels(x + 2, app.canvas.height - y - offset - 1,
        width - 4, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let markerPixels = 0, transparent = 0, black = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 255) markerPixels++;
        if (pixels[i + 3] !== 255) transparent++;
        if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0) black++;
      }
      return { markerPixels, transparent, black, samples: width - 4, firstPixel: [...pixels.slice(0, 4)] };
    };
    try {
      const results = [];
      for (const shake of [-9, 0, 9]) {
        scene.y = originalY + shake; draw();
        results.push({ shake, top: row(true), bottom: row(false), above: row('sky') });
      }
      scene.y = originalY;
      backdrop.front.setVisible(false); draw();
      return { results, uncovered: row(true) };
    } finally {
      backdrop.front.setVisible(true); scene.y = originalY; marker.destroy();
      ui.sys.setVisible(visible[0]); worldLayer.setVisible(visible[1]); pane.overlay.setVisible(visible[2]);
      app.loop.wake();
    }
  });
}

async function covered(page, portrait = false) {
  const { results, uncovered } = await edgeCoverage(page);
  // Negative control: without foreground coverage the row really is the marker.
  expect(uncovered.markerPixels, JSON.stringify({ results, uncovered })).toBe(uncovered.samples);
  for (const { top, bottom } of results) for (const edge of [top, bottom]) {
    expect(edge.markerPixels).toBe(0);
    expect(edge.transparent).toBe(0);
    expect(edge.black).toBe(0);
  }
  if (portrait) for (const { above } of results) expect(above.markerPixels).toBe(above.samples);
}

for (const art of ['classic', 'cartoon']) {
  test(`${art} canopy covers 1P fullscreen after resize and rotation while 2P keeps its framing`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${DEV}?art=${art}`);
    await page.waitForFunction(() => window.__liano?.platform.world?.panes.length);
    await fitted(page, false);
    expect(await page.evaluate(() => window.__liano.layout.bandTop)).toBe(120);
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => !!document.fullscreenElement);
    await fitted(page, true);
    await covered(page);

    for (const [width, height] of [[390, 844], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await fitted(page, true);
      await covered(page, width < height);
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await fitted(page, true);
    await page.keyboard.press('Digit2');
    await page.waitForFunction(() => window.__liano.game.mode === 'shared');
    await fitted(page, true, true);
    await expect.poll(() => page.evaluate(() => window.__liano.platform.world.panes[0].layout.bandTop)).toBeGreaterThan(0);
    await page.keyboard.press('Digit3');
    await page.waitForFunction(() => window.__liano.platform.world.panes.length === 2);
    await fitted(page, true, true);
    expect(await page.evaluate(() => window.__liano.platform.world.panes.map(p => p.layout.bandTop))).toEqual([0, 0]);
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.__liano.game.mode === 'solo');
    await fitted(page, true);
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => !document.fullscreenElement);
    await fitted(page, false);
    expect(errors).toEqual([]);
  });
}

test('home-screen 1P keeps half the former portrait space above the canopy from startup', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${DEV}?art=cartoon`);
  await page.waitForFunction(() => window.__liano?.platform.world?.panes.length);
  await fitted(page, true);
  expect(await page.evaluate(() => window.__liano.platform.fullscreenButton)).toBe(false);
  await covered(page, true);
  expect(errors).toEqual([]);
});
