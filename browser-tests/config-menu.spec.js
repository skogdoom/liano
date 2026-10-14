import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors, menuLabelPoint, openConfig, panelPoint } from './helpers.js';

test('C opens the title submenu, isolates its keys and preserves the selected match mode on reload', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  await expect(page.locator('#graphics-quality')).toHaveCount(0);
  await page.keyboard.press('Digit2');
  await expect.poll(() => page.evaluate(() => window.__liano.game.mode)).toBe('shared');
  await openConfig(page);
  expect(await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.title.visible)).toBe(false);
  for (const code of ['Space', 'KeyP', 'KeyG', 'KeyH', 'KeyS']) await page.keyboard.press(code);
  expect(await page.evaluate(() => ({ state: window.__liano.game.state, mode: window.__liano.game.mode,
    pause: window.__liano.pause.paused, slip: window.__liano.game.slip }))).toEqual({ state: 'TITLE', mode: 'shared', pause: false, slip: false });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.title.visible)).toBe(true);
  await page.keyboard.press('Digit3');
  await expect.poll(() => page.evaluate(() => window.__liano.game.mode)).toBe('split');
  await openConfig(page);
  await page.keyboard.press('Digit2');
  await page.waitForURL((url) => url.searchParams.get('resolution') === '1.5');
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.game.mode)).toBe('split');
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  expect(errors).toEqual([]);
});

test('config uses the title artwork and shows the selected graphics choice', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${DEV}?engine=phaser&resolution=1.5`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  await page.screenshot({ path: '/tmp/liano-title-config.png' });
  await openConfig(page);
  const look = await page.evaluate(() => {
    const ui = window.__liano.app.scene.getScene('ui').overlays;
    return { panel: ui.config.list[0].artKey, titlePanel: ui.title.list[0].artKey,
      rows: ui.graphicsItems.map((item) => [item.label.text.text, item.label.text.style.color]),
      font: ui.graphicsItems[0].label.text.style.fontFamily,
      titleFont: ui.titlePrompt.text.style.fontFamily };
  });
  expect(look.panel).toBe(look.titlePanel);
  expect(look.rows).toEqual([['1 · Performance', '#f4e7c5'], ['2 · Balanced', '#ffcf4a'],
    ['3 · Sharp', '#f4e7c5'], ['A · Auto', '#f4e7c5']]);
  expect(look.font).toBe(look.titleFont);
  await page.screenshot({ path: '/tmp/liano-config-landscape.png' });
  await page.screenshot({ path: '/tmp/liano-config-panel.png', clip: { x: 755, y: 65, width: 470, height: 550 } });
  // Re-selecting the active graphics mode closes the submenu without a reload.
  const seed = await page.evaluate(() => window.__liano.game.world.seed);
  await page.keyboard.press('Digit2');
  await expect.poll(() => page.evaluate(() => window.__liano.platform.configMenu.open)).toBe(false);
  expect(await page.evaluate(() => window.__liano.game.world.seed)).toBe(seed);
  expect(await page.evaluate(() => localStorage.getItem('liano.phaser.resolution'))).toBe('1.5');
  expect(errors).toEqual([]);
});

test('portrait config taps stay inside the game and the panel fits after resizing', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  const entry = await menuLabelPoint(page, 'title', 'configEntry');
  await page.touchscreen.tap(entry.x, entry.y);
  await expect.poll(() => page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.config.visible)).toBe(true);
  const top = await panelPoint(page, 'config', 0, -260), bottom = await panelPoint(page, 'config', 0, 260);
  expect(top.y).toBeGreaterThanOrEqual(0);
  expect(bottom.y).toBeLessThanOrEqual(812);
  await page.screenshot({ path: '/tmp/liano-config-portrait.png' });
  await page.touchscreen.tap(10, 450); // outside the modal
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  const back = await menuLabelPoint(page, 'config', 'configBack');
  await page.touchscreen.tap(back.x, back.y);
  await expect.poll(() => page.evaluate(() => window.__liano.platform.configMenu.open)).toBe(false);
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__liano.layout.orientation === 'landscape');
  const landscapeEntry = await menuLabelPoint(page, 'title', 'configEntry');
  await page.touchscreen.tap(landscapeEntry.x, landscapeEntry.y);
  await expect.poll(() => page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.config.visible)).toBe(true);
  const sharpAt = await page.evaluate(() => {
    const label = window.__liano.app.scene.getScene('ui').overlays.graphicsItems.find((item) => item.choice === '2').label.text;
    return { x: label.x, y: label.y };
  });
  const sharp = await panelPoint(page, 'config', sharpAt.x, sharpAt.y);
  await page.touchscreen.tap(sharp.x, sharp.y);
  await page.waitForURL((url) => url.searchParams.get('resolution') === '2');
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  expect(errors).toEqual([]);
  await page.close();
});
