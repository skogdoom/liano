import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { layoutFor } from '../src/layout.js';
import { canvasSize, viewCamera } from '../src/platform/view.js';
import { collectErrors, started } from './helpers.js';

// The platform (docs/plans/history/phaser-migration.md, M2): layouts, full screen, a lost
// graphics context and pause, on the dev server (for the `window.__liano` hooks).

// The Phaser canvas's RGBA at device-pixel points, from a snapshot of the next frame.
function pixelsAt(page, points) {
  return page.evaluate(
    (points) =>
      new Promise((resolve) => {
        window.__liano.app.renderer.snapshot((image) => {
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
    await page.goto(`${DEV}`);
    await started(page, errors);
    const r = Math.min(ratio, 2);
    const layout = layoutFor(width, height);
    const expected = viewCamera(layout, r);
    await expect.poll(() => page.evaluate(() => window.__liano.camera)).toEqual(expected);
    // The world is drawn once the main art set is in (until then the view is black).
    await page.waitForFunction(() => window.__liano.platform.world?.panes.length > 0);
    const canvas = await page.evaluate(() => {
      const { canvas: c } = window.__liano.app;
      return { width: c.width, height: c.height, css: [c.style.width, c.style.height] };
    });
    expect(canvas).toEqual({ ...canvasSize(width, height, r), css: [`${width}px`, `${height}px`] });
    // Inside the view: the world (the sky at the top, the floor at the bottom, the jungle
    // in the band), never black; outside it: black bars.
    const { x, y, width: w, height: h, zoom } = expected;
    const band = Math.round(y + (layout.bandTop + 360) * zoom);
    const points = [
      [x + 2, y + 2],
      [x + w - 3, y + h - 3],
      [x + 4, band],
    ];
    const bars = [];
    if (x > 2) bars.push([1, y + 2], [canvas.width - 2, y + 2]);
    if (y > 2) bars.push([x + 2, 1], [x + 2, canvas.height - 2]);
    const pixels = await pixelsAt(page, [...points, ...bars]);
    points.forEach((point, i) => {
      expect(pixels[i][3], `view at ${point}`).toBe(255);
      expect(pixels[i], `view at ${point}`).not.toEqual(BLACK);
    });
    bars.forEach((point, i) => expect(pixels[points.length + i], `bar at ${point}`).toEqual(BLACK));
    expect(errors).toEqual([]);
    await page.close();
  });
}

test('the Phaser version follows the window when it changes shape', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${DEV}`);
  await started(page, errors);
  await page.setViewportSize({ width: 600, height: 900 });
  await expect.poll(() => page.evaluate(() => window.__liano.layout.orientation)).toBe('portrait');
  expect(await page.evaluate(() => window.__liano.camera)).toEqual(viewCamera(layoutFor(600, 900), 1));
  expect(errors).toEqual([]);
});

test(`the Phaser version goes full screen with F and back`, async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}`);
  await started(page, errors);
  expect(await page.evaluate(() => window.__liano.fullscreen.supported)).toBe(true);
  // A refused request would show up here rather than as a timeout.
  await page.evaluate(() => document.addEventListener('fullscreenerror', () => console.error('fullscreenerror')));
  // Going full screen resizes the page; drawing is slow in software WebGL
  // on a busy CI runner: allow it time.
  const inFullscreen = () => page.evaluate(() => document.fullscreenElement === document.documentElement);
  await page.keyboard.press('KeyF');
  await expect.poll(inFullscreen, { timeout: 20_000 }).toBe(true);
  await page.keyboard.press('KeyF');
  await expect.poll(inFullscreen, { timeout: 20_000 }).toBe(false);
  expect(errors).toEqual([]);
});

test(`the Phaser version pauses while the graphics context is lost, and carries on when it is back`, async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}`);
  await started(page, errors);
  const gl = 'window.__liano.app.renderer.gl';
  await page.evaluate(`window.__lose = ${gl}.getExtension('WEBGL_lose_context'); window.__lose.loseContext()`);
  await expect(page.locator('#notice')).toHaveClass(/shown/);
  expect(await page.evaluate(() => window.__liano.pause.reason)).toBe('graphics');
  await page.evaluate(() => window.__lose.restoreContext());
  await expect(page.locator('#notice')).not.toHaveClass(/shown/);
  await expect.poll(() => page.evaluate(() => window.__liano.pause.paused)).toBe(false);
  await expect(page.locator('#fatal')).not.toHaveClass(/shown/);
  expect(errors).toEqual([]);
});

test('the Phaser version goes full screen from a tap on its button, on release', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}`);
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

test('the Phaser version pauses a run on P and resumes on P', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}`);
  await started(page, errors);
  await page.waitForFunction(() => window.__liano.input && window.__liano.pause.acceptsInput());
  // Not on the title screen: only a run pauses.
  await page.keyboard.press('KeyP');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
  expect(await page.evaluate(() => window.__liano.pause.paused)).toBe(false);
  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => window.__liano.pause.reason)).toBe('manual');
  await expect.poll(() => page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.paused.visible)).toBe(true);
  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => window.__liano.pause.paused)).toBe(false);
  expect(errors).toEqual([]);
});

test('the Phaser version follows a change of pixel ratio (a window moved to another screen)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(`${DEV}`);
  await started(page, errors);
  expect(await page.evaluate(() => window.__liano.app.canvas.width)).toBe(1000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 600, deviceScaleFactor: 2, mobile: false });
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
  // In CI's Chromium the emulated change did not reach the layout through the ratio's
  // media query, so a resize event stands in for it here; watching the query is unit
  // tested (tests/screen.test.js).
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect.poll(() => page.evaluate(() => window.__liano.app.canvas.width)).toBe(2000);
  expect(await page.evaluate(() => window.__liano.camera)).toEqual(viewCamera(layoutFor(1000, 600), 2));
  expect(await page.evaluate(() => window.__liano.app.canvas.style.width)).toBe('1000px');
  expect(errors).toEqual([]);
});

for (const [ratio, scale] of [
  [1, 1],
  [2, 2],
]) {
  test(`the Phaser version loads its art at ${scale}× on a ${ratio}× screen: the boot set, then the main set`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: ratio });
    const errors = collectErrors(page);
    await page.goto(`${DEV}`);
    await started(page, errors);
    await expect.poll(() => page.evaluate(() => window.__liano.platform.artLoad?.sets.map((s) => s.set))).toEqual(['boot', 'main']);
    expect(await page.evaluate(() => window.__liano.platform.art.scale)).toBe(scale);
    // A piece from each set is in Phaser's textures.
    expect(await page.evaluate(() => ['liana.green.rope', 'panther.body'].map((key) => window.__liano.app.textures.get(`art.${window.__liano.platform.art.piece(key).set}`).has(key)))).toEqual([true, true]);
    expect(errors).toEqual([]);
    await page.close();
  });
}

// A TileSprite wraps its texture up and down too, so a backdrop tile's edge could show its
// opposite row: a dark line along the top of the floor, at some window sizes (these four
// showed it). The tile images carry copies of their edge rows (TILE_EDGE in catalog.js).
for (const [width, ratio] of [
  [1092, 1],
  [1598, 1],
  [1368, 2],
  [1460, 2],
]) {
  test(`the Phaser version's backdrop tiles show no line at their edges at ${width} px, ${ratio}×`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: Math.round((width * 9) / 16) }, deviceScaleFactor: ratio });
    const errors = collectErrors(page);
    await page.goto(`${DEV}`);
    await started(page, errors);
    await page.waitForFunction(() => window.__liano.platform.artLoad?.sets.length === 2);
    // The world alone: the buttons and panels have edges of their own.
    await page.evaluate(() => window.__liano.app.scene.getScene('ui').cameras.main.setVisible(false));
    // Each tile edge in the band: the floor's top, the ferns' top, the clumps' bottom and
    // the canopy strip's bottom (world y); the mean of each pixel row about it, on the left.
    const rows = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const { app, camera, layout } = window.__liano;
          app.renderer.snapshot((image) => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);
            resolve(
              [626, 560, 100, 58].map((edge) => {
                const y = Math.floor(camera.y + (layout.bandTop + edge) * camera.zoom);
                return [y - 2, y - 1, y, y + 1, y + 2].map((row) => {
                  const data = context.getImageData(0, row, Math.floor(canvas.width / 3), 1).data;
                  let sum = 0;
                  for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
                  return sum / (data.length / 4);
                });
              }),
            );
          });
        }),
    );
    // A line is a row much darker (or lighter) than both rows beside it.
    for (const means of rows) {
      for (let i = 1; i < means.length - 1; i++) {
        const apart = Math.sign(means[i] - means[i - 1]) === Math.sign(means[i] - means[i + 1]);
        expect(apart && Math.abs(means[i] - (means[i - 1] + means[i + 1]) / 2) > 20, `rows ${means.map(Math.round)}`).toBe(false);
      }
    }
    expect(errors).toEqual([]);
    await page.close();
  });
}
