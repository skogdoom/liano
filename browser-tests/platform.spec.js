import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { layoutFor } from '../src/layout.js';
import { canvasSize, viewCamera } from '../src/phaser/view.js';
import { collectErrors, started } from './helpers.js';

// The platform (PHASER_PLAN.md, M2): layouts, full screen, a lost graphics context and
// pause, on the dev server (for the `window.__liano` hooks).

// The Phaser canvas's RGBA at device-pixel points, from a snapshot of the next frame.
function pixelsAt(page, points) {
  return page.evaluate(
    (points) =>
      new Promise((resolve) => {
        window.__liano.game.renderer.snapshot((image) => {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          resolve(points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]));
        });
      }),
    points,
  );
}

const BLACK = [0, 0, 0, 255];
const VIEW = [0x10, 0x26, 0x1a, 255];
const BAND = [0x4a, 0x80, 0x60, 255];

// Window shapes: 16:9, wider (a phone in landscape), much wider (bars at the sides),
// 4:3 (an iPad), portrait phones; at the pixel ratios the game uses (3 is capped at 2).
const SHAPES = [
  [1280, 720, 1],
  [844, 390, 3],
  [2560, 900, 1],
  [1024, 768, 2],
  [390, 844, 3],
  [375, 812, 2],
  [1001, 601, 1.5],
];

for (const [width, height, ratio] of SHAPES) {
  test(`the Phaser version draws the letterboxed view at ${width} × ${height}, ${ratio}×`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: ratio });
    const errors = collectErrors(page);
    await page.goto(`${DEV}?engine=phaser`);
    await started(page, errors);
    const r = Math.min(ratio, 2);
    const layout = layoutFor(width, height);
    const expected = viewCamera(layout, r);
    await expect.poll(() => page.evaluate(() => window.__liano.camera)).toEqual(expected);
    const canvas = await page.evaluate(() => {
      const { canvas: c } = window.__liano.game;
      return { width: c.width, height: c.height, css: [c.style.width, c.style.height] };
    });
    expect(canvas).toEqual({ ...canvasSize(width, height, r), css: [`${width}px`, `${height}px`] });
    // Inside the view: the frame, and the world band; outside it: black bars.
    const { x, y, width: w, height: h, zoom } = expected;
    const band = Math.round(y + (layout.bandTop + 360) * zoom);
    const points = [
      [x + 2, y + 2],
      [x + w - 3, y + h - 3],
      [x + Math.round(w / 2), band],
    ];
    const bars = [];
    if (x > 2) bars.push([1, y + 2], [canvas.width - 2, y + 2]);
    if (y > 2) bars.push([x + 2, 1], [x + 2, canvas.height - 2]);
    const pixels = await pixelsAt(page, [...points, ...bars]);
    const inBand = (py) => py >= y + layout.bandTop * zoom && py < y + (layout.bandTop + 720) * zoom;
    points.forEach(([, py], i) => expect(pixels[i], `view at ${points[i]}`).toEqual(inBand(py) ? BAND : VIEW));
    bars.forEach((point, i) => expect(pixels[points.length + i], `bar at ${point}`).toEqual(BLACK));
    expect(errors).toEqual([]);
    await page.close();
  });
}

test('the Phaser version follows the window when it changes shape', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${DEV}?engine=phaser`);
  await started(page, errors);
  await page.setViewportSize({ width: 600, height: 900 });
  await expect.poll(() => page.evaluate(() => window.__liano.layout.orientation)).toBe('portrait');
  expect(await page.evaluate(() => window.__liano.camera)).toEqual(viewCamera(layoutFor(600, 900), 1));
  expect(errors).toEqual([]);
});

for (const engine of ['pixi', 'phaser']) {
  test(`the ${engine} version goes full screen with F and back`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${DEV}?engine=${engine}`);
    await started(page, errors);
    expect(await page.evaluate(() => window.__liano.fullscreen.supported)).toBe(true);
    // A refused request would show up here rather than as a timeout.
    await page.evaluate(() => document.addEventListener('fullscreenerror', () => console.error('fullscreenerror')));
    // Going full screen resizes the page, and the Pixi version's title scene draws
    // slowly in software WebGL on a busy CI runner: allow it time.
    const inFullscreen = () => page.evaluate(() => document.fullscreenElement === document.documentElement);
    await page.keyboard.press('KeyF');
    await expect.poll(inFullscreen, { timeout: 20_000 }).toBe(true);
    await page.keyboard.press('KeyF');
    await expect.poll(inFullscreen, { timeout: 20_000 }).toBe(false);
    expect(errors).toEqual([]);
  });

  test(`the ${engine} version pauses while the graphics context is lost, and carries on when it is back`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${DEV}?engine=${engine}`);
    await started(page, errors);
    const gl = engine === 'pixi' ? 'window.__liano.app.renderer.gl' : 'window.__liano.game.renderer.gl';
    await page.evaluate(`window.__lose = ${gl}.getExtension('WEBGL_lose_context'); window.__lose.loseContext()`);
    await expect(page.locator('#notice')).toHaveClass(/shown/);
    expect(await page.evaluate(() => window.__liano.pause.reason)).toBe('graphics');
    await page.evaluate(() => window.__lose.restoreContext());
    await expect(page.locator('#notice')).not.toHaveClass(/shown/);
    await expect.poll(() => page.evaluate(() => window.__liano.pause.paused)).toBe(false);
    await expect(page.locator('#fatal')).not.toHaveClass(/shown/);
    expect(errors).toEqual([]);
  });
}

test('the Phaser version goes full screen from a tap on its button, on release', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser`);
  await started(page, errors);
  // The button's tap target (controls.js), in CSS pixels.
  const { x, y } = await page.evaluate(() => {
    const { layout } = window.__liano;
    return { x: layout.x + (layout.insets.left + 135 * layout.ui) * layout.scale, y: layout.y + (layout.insets.top + 45 * layout.ui) * layout.scale };
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  expect(await page.evaluate(() => document.fullscreenElement)).toBe(null);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  expect(errors).toEqual([]);
});

test('the Phaser version pauses on P and resumes on P', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser`);
  await started(page, errors);
  await page.keyboard.press('KeyP');
  expect(await page.evaluate(() => window.__liano.pause.reason)).toBe('manual');
  await expect.poll(() => page.evaluate(() => window.__liano.game.scene.getScene('ui').paused.visible)).toBe(true);
  await page.keyboard.press('KeyP');
  expect(await page.evaluate(() => window.__liano.pause.paused)).toBe(false);
  expect(errors).toEqual([]);
});

test('the Phaser version follows a change of pixel ratio (a window moved to another screen)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(`${DEV}?engine=phaser`);
  await started(page, errors);
  expect(await page.evaluate(() => window.__liano.game.canvas.width)).toBe(1000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 600, deviceScaleFactor: 2, mobile: false });
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
  // In CI's Chromium the emulated change did not reach the layout through the ratio's
  // media query, so a resize event stands in for it here; watching the query is unit
  // tested (tests/screen.test.js).
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect.poll(() => page.evaluate(() => window.__liano.game.canvas.width)).toBe(2000);
  expect(await page.evaluate(() => window.__liano.camera)).toEqual(viewCamera(layoutFor(1000, 600), 2));
  expect(await page.evaluate(() => window.__liano.game.canvas.style.width)).toBe('1000px');
  expect(errors).toEqual([]);
});
