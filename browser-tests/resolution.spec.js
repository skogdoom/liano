import { test, expect } from '@playwright/test';
import { DEV, PREVIEW } from '../playwright.config.js';
import { layoutFor } from '../src/layout.js';
import { viewCamera } from '../src/phaser/view.js';
import { collectErrors, started } from './helpers.js';

for (const [query, ratio] of [['', 2], ['&resolution=1.5', 1.5], ['&resolution=1', 1]]) {
  test(`Phaser resolution ${ratio}× preserves CSS layout, controls and trace measurements`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 823 }, deviceScaleFactor: 2 });
    const errors = collectErrors(page);
    await page.goto(`${DEV}?engine=phaser&frames=1${query}`);
    await page.waitForFunction(() => window.__liano?.platform.world && window.__phaserFrameTrace?.snapshot().frames.length);
    const inspect = () => page.evaluate(() => {
      const { app, platform, layout, camera } = window.__liano;
      const trace = window.__phaserFrameTrace.snapshot();
      const bounds = app.canvas.getBoundingClientRect();
      return {
        canvas: [app.canvas.width, app.canvas.height], css: [bounds.width, bounds.height],
        ratio: 1 / app.scale.zoom, layout, camera, limit: trace.info.resolutionLimit,
        recordedRatio: trace.frames.at(-1).renderPixelRatio,
        artScale: platform.art.scale, recordedArtScale: trace.info.artScale,
        blur: trace.frames.at(-1).panes[0].obstacleBlur,
      };
    });
    const initial = await inspect();
    expect(initial.canvas).toEqual([Math.round(1440 * ratio), Math.round(823 * ratio)]);
    expect(initial.css).toEqual([1440, 823]);
    expect(initial.layout).toEqual(layoutFor(1440, 823));
    expect(initial.camera).toEqual(viewCamera(layoutFor(1440, 823), ratio));
    expect(initial.ratio).toBe(ratio);
    expect(initial.recordedRatio).toBe(ratio);
    expect(initial.limit).toBe(ratio);
    expect(initial.recordedArtScale).toBe(initial.artScale);
    expect(initial.blur).toBe(null);

    // Fractional dimensions must still fill the window after resizing.
    await page.setViewportSize({ width: 1001, height: 601 });
    await expect.poll(async () => (await inspect()).canvas).toEqual([Math.round(1001 * ratio), Math.round(601 * ratio)]);
    const resized = await inspect();
    expect(resized.css).toEqual([1001, 601]);
    expect(resized.camera).toEqual(viewCamera(layoutFor(1001, 601), ratio));

    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
    // The canvas still receives controls at their original CSS positions.
    const mute = await page.evaluate(() => {
      const { layout } = window.__liano;
      return { x: layout.x + (layout.insets.left + 45 * layout.ui) * layout.scale,
        y: layout.y + (layout.insets.top + 45 * layout.ui) * layout.scale };
    });
    await page.mouse.click(mute.x, mute.y);
    await expect.poll(() => page.evaluate(() => window.__liano.sound.muted)).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  });
}

test('the resolution cap follows screen density without upscaling or restarting the world', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(`${DEV}?engine=phaser&resolution=1.5`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  await page.evaluate(() => { window.testResolutionWorld = window.__liano.game.world; });
  expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(1000);
  const cdp = await page.context().newCDPSession(page);
  for (const [density, width] of [[3, 1500], [1, 1000], [2, 1500]]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 600, deviceScaleFactor: density, mobile: false });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await expect.poll(() => page.evaluate(() => window.__liano.app.canvas.width)).toBe(width);
    expect(await page.evaluate(() => window.__liano.game.world === window.testResolutionWorld)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('the production trace identifies the reduced resolution', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 });
  const errors = collectErrors(page);
  await page.goto(`${PREVIEW}?engine=phaser&resolution=1.5&frames=1`);
  await page.waitForFunction(() => window.__phaserFrameTrace?.snapshot().frames.length);
  const trace = await page.evaluate(() => window.__phaserFrameTrace.snapshot());
  expect(trace.info.resolutionLimit).toBe(1.5);
  expect(trace.frames.at(-1).renderPixelRatio).toBe(1.5);
  expect(trace.frames.at(-1).canvas).toEqual([1500, 900]);
  expect(trace.info.artScale).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.close();
});

test('the resolution experiment leaves Pixi at its ordinary screen density', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 });
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=pixi&resolution=1`);
  await started(page, errors);
  expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(2000);
  expect(errors).toEqual([]);
  await page.close();
});
