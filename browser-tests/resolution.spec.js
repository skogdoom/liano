import { expect } from '@playwright/test';
import { DEV, PREVIEW } from '../playwright.config.js';
import { layoutFor } from '../src/layout.js';
import { viewCamera } from '../src/platform/view.js';
import { collectErrors, menuLabelPoint, openConfig, panelPoint, started, test } from './helpers.js';

const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.5.2 Safari/605.1.15';

for (const [query, ratio] of [['', 2], ['&resolution=1.5', 1.5], ['&resolution=1', 1]]) {
  test(`Phaser resolution ${ratio}× preserves CSS layout, controls and trace measurements`, async ({ browserPages: browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 823 }, deviceScaleFactor: 2 });
    const errors = collectErrors(page);
    await page.goto(`${DEV}?frames=1${query}`);
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
  await page.goto(`${DEV}?resolution=1.5`);
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

test('the production trace identifies the reduced resolution', async ({ browserPages: browser }) => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 });
  const errors = collectErrors(page);
  await page.goto(`${PREVIEW}?resolution=1.5&frames=1`);
  await page.waitForFunction(() => window.__phaserFrameTrace?.snapshot().frames.length);
  const trace = await page.evaluate(() => window.__phaserFrameTrace.snapshot());
  expect(trace.info.resolutionLimit).toBe(1.5);
  expect(trace.frames.at(-1).renderPixelRatio).toBe(1.5);
  expect(trace.frames.at(-1).canvas).toEqual([1500, 900]);
  expect(trace.info.artScale).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.close();
});


test('Safari Auto and all manual choices persist without changing explicit test overrides', async ({ browserPages: browser }) => {
  // Emulate browser identity to test selection policy; rendering still uses
  // Chromium and does not predict actual Safari GPU performance.
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2, userAgent: SAFARI_MAC });
  const errors = collectErrors(page);
  await page.goto(`${DEV}?frames=1`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.platform.configMenu.choice)).toBe('auto');
  await expect(page.locator('#graphics-quality')).toHaveCount(0);
  expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(1500);

  // Selecting graphics must not start a run or send keyboard actions to it.
  await openConfig(page);
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');

  for (const [choice, width] of [['2', 2000], ['1', 1000], ['1.5', 1500], ['auto', 1500]]) {
    await openConfig(page);
    await page.keyboard.press({ '1': 'Digit1', '1.5': 'Digit2', '2': 'Digit3', auto: 'KeyA' }[choice]);
    await page.waitForURL((url) => url.searchParams.get('resolution') === choice);
    await page.waitForFunction(() => window.__liano?.platform.world && window.__phaserFrameTrace?.snapshot().frames.length);
    expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(width);
    const trace = await page.evaluate(() => window.__phaserFrameTrace.snapshot());
    expect(trace.info.resolutionMode).toBe(choice);
    await page.goto(`${DEV}?frames=1`);
    await page.waitForFunction(() => window.__liano?.platform.world);
    expect(await page.evaluate(() => window.__liano.platform.configMenu.choice)).toBe(choice);
    expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(width);
  }
  // An A/B URL temporarily overrides the stored choice; it does not save itself.
  await page.goto(`${DEV}?resolution=1`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.platform.configMenu.choice)).toBe('1');
  await page.goto(`${DEV}`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.platform.configMenu.choice)).toBe('auto');
  expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(1500);

  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
  expect(await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.config.visible)).toBe(false);
  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => window.__liano.pause.reason)).toBe('manual');
  await page.keyboard.press('KeyC');
  expect(await page.evaluate(() => window.__liano.platform.configMenu.open)).toBe(false);
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__liano.pause.acceptsInput());
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  await openConfig(page);
  expect(errors).toEqual([]);
  await page.close();
});

test('Safari Auto caps a high-density phone and graphics taps do not start play', async ({ browserPages: browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const errors = collectErrors(page);
  await page.goto(`${DEV}`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(563);
  const entry = await menuLabelPoint(page, 'title', 'configEntry');
  await page.touchscreen.tap(entry.x, entry.y);
  await expect.poll(() => page.evaluate(() => window.__liano.platform.configMenu.open)).toBe(true);
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  const point = await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.configGeometry.items[2]);
  const sharp = await panelPoint(page, 'config', point.x, point.y);
  await page.touchscreen.tap(sharp.x, sharp.y);
  await page.waitForURL((url) => url.searchParams.get('resolution') === '2');
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(750);
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  expect(errors).toEqual([]);
  await page.close();
});

test('blocked preference storage keeps Safari Auto and manual selection functional', async ({ browserPages: browser }) => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2, userAgent: SAFARI_MAC });
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto(`${DEV}`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(1500);
  await openConfig(page);
  await page.keyboard.press('Digit3');
  await page.waitForURL((url) => url.searchParams.get('resolution') === '2');
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(2000);
  expect(errors).toEqual([]);
  await page.close();
});
