import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors, started, openConfig, menuLabelPoint } from './helpers.js';

for (const art of ['classic', 'cartoon']) test(`${art} loads only its own pack and starts all desktop modes`, async ({ page }) => {
  const errors = collectErrors(page), requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(`${DEV}?art=${art}&frames=1&shadow=off`);
  await started(page, errors);
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.platform.artLoad.pack)).toBe(art);
  expect(requests.some((url) => url.includes(`/art/${art}/pieces.json`))).toBe(true);
  expect(requests.some((url) => url.includes(`/art/${art === 'classic' ? 'cartoon' : 'classic'}/`))).toBe(false);
  for (const [key, mode] of [['Digit1', 'solo'], ['Digit2', 'shared'], ['Digit3', 'split']]) {
    // An already-selected mode would satisfy the poll before its queued key was
    // consumed; selecting a mode intentionally clears other presses in that step.
    if (await page.evaluate(() => window.__liano.game.mode) !== mode) await page.keyboard.press(key);
    await expect.poll(() => page.evaluate(() => window.__liano.game.mode)).toBe(mode);
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
    await page.keyboard.press('KeyA');
    if (mode !== 'solo') await page.keyboard.press('KeyL');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  }
  expect(await page.evaluate(() => window.__liano.platform.artLoad.sets.map((s) => s.set))).toEqual(['boot', 'main']);
  expect(errors).toEqual([]);
});

test('cartoon textures survive context restore and rotation without restarting the world', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?art=cartoon`); await started(page, errors);
  await page.waitForFunction(() => window.__liano?.platform.world);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
  await page.evaluate(() => {
    window.originalCartoonWorld = window.__liano.game.world;
    window.loseCartoonContext = window.__liano.app.renderer.gl.getExtension('WEBGL_lose_context');
    window.loseCartoonContext.loseContext();
  });
  await expect.poll(() => page.evaluate(() => window.__liano.pause.reason)).toBe('graphics');
  await page.evaluate(() => window.loseCartoonContext.restoreContext());
  await expect.poll(() => page.evaluate(() => window.__liano.pause.paused)).toBe(false);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => window.__liano.app.canvas.width)).toBe(375);
  expect(await page.evaluate(() => window.__liano.game.world === window.originalCartoonWorld)).toBe(true);
  expect(await page.evaluate(() => window.__liano.platform.artPack)).toBe('cartoon');
  expect(errors).toEqual([]);
});

test('Config switches art once and retains title options, quality, diagnostics and hash', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?art=classic&resolution=1.5&frames=1#keep`);
  await started(page, errors); await page.waitForFunction(() => window.__liano?.platform.world);
  await page.keyboard.press('Digit3');
  await expect.poll(() => page.evaluate(() => window.__liano.game.mode)).toBe('split');
  await page.evaluate(() => { const g = window.__liano.game; g.lives = true; g.slip = true; g.shadow = false; window.__liano.sound.setMuted(true); });
  await openConfig(page);
  let navigations = 0;
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++; });
  await page.keyboard.press('KeyX');
  await page.waitForURL((url) => url.searchParams.get('art') === 'cartoon');
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(navigations).toBe(1);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ art: 'cartoon', resolution: '1.5', frames: '1', mode: 'split', lives: 'on', slip: 'on', shadow: 'off', mute: 'on' });
  expect(await page.evaluate(() => window.__liano.sound.muted)).toBe(true);
  expect(new URL(page.url()).hash).toBe('#keep');
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  await openConfig(page);
  const p = await menuLabelPoint(page, 'config', 'artItem');
  await page.mouse.click(p.x, p.y);
  await page.waitForURL((url) => url.searchParams.get('art') === 'classic');
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(navigations).toBe(2);
  expect(errors).toEqual([]);
});

for (const [width, height] of [[375, 600], [812, 250]]) test(`cartoon Config has usable touch controls at ${width}×${height}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage(), errors = collectErrors(page);
    await page.goto(`${DEV}?art=cartoon&mode=split`);
    await started(page, errors); await page.waitForFunction(() => window.__liano?.platform.world);
    expect(await page.evaluate(() => window.__liano.game.mode)).toBe('solo');
    const config = await menuLabelPoint(page, 'title', 'configEntry');
    await page.touchscreen.tap(config.x, config.y);
    await expect.poll(() => page.evaluate(() => window.__liano.platform.configMenu.open)).toBe(true);
    expect(await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.artItem.text.text)).toBe('Classic graphics: Off');
    const target = await page.evaluate(() => { const o = window.__liano.app.scene.getScene('ui').overlays; return o.configGeometry.artHit.h * o.configGeometry.cssScale; });
    expect(target).toBeGreaterThanOrEqual(44);
    const point = await menuLabelPoint(page, 'config', 'artItem');
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForURL((url) => url.searchParams.get('art') === 'classic');
    await page.waitForFunction(() => window.__liano?.platform.world);
    expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('a failed cartoon load offers an explicit recovery to classic', async ({ page }) => {
  await page.route('**/art/cartoon/main@*x.json', (route) => route.abort());
  await page.goto(`${DEV}?art=cartoon`);
  await expect(page.locator('#fatal')).toHaveClass(/shown/);
  await expect(page.locator('#fatal-message')).toHaveText('Cartoon graphics could not be loaded.');
  await expect(page.locator('#fatal button')).toHaveText('Reload classic graphics');
  await page.waitForFunction(() => window.__liano?.game);
  await page.evaluate(() => { window.__liano.game.selectMode('shared'); window.__liano.game.lives = true; window.__liano.sound.setMuted(true); });
  await page.locator('#fatal button').click();
  await page.waitForURL((url) => url.searchParams.get('art') === 'classic');
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.platform.artPack)).toBe('classic');
  expect(await page.evaluate(() => window.__liano.game.mode)).toBe('shared');
  expect(await page.evaluate(() => window.__liano.sound.muted)).toBe(true);
});

test('the cartoon frame gallery covers the complete pack and previews flipbooks', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  await page.goto(`${DEV}art.html?art=cartoon&scale=2`);
  await page.waitForFunction(() => document.documentElement.dataset.gallery === 'done', null, { timeout: 200_000 });
  const gallery = await page.evaluate(() => window.__gallery);
  expect(gallery.pack).toBe('cartoon'); expect(gallery.frames).toHaveLength(584);
  console.log(`cartoon gallery: ${(gallery.share * 100).toFixed(2)}% differing, ${gallery.frames.filter((f) => !f.pass).length} frames flagged`);
  const wing = page.locator('section').filter({ has: page.locator('h2', { hasText: /^bird\.red\.wing$/ }) });
  await wing.getByRole('slider').fill('32');
  await wing.getByRole('button', { name: 'Animate frames' }).click();
  await expect(wing.getByRole('button', { name: 'Stop animation' })).toBeVisible();
  await wing.getByRole('button', { name: 'Stop animation' }).click();
  expect(errors).toEqual([]);
});

test('cartoon monkey poses assemble in the real rigs without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}rigs.html?art=cartoon&only=world.monkeys`);
  await page.waitForFunction(() => document.documentElement.dataset.rigs === 'ready');
  expect(await page.evaluate(() => window.__rigGallery)).toEqual({ pack: 'cartoon', fixtures: ['world.monkeys'] });
  await expect(page.locator('#rigs canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
