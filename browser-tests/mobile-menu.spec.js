import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors, menuLabelPoint, panelPoint } from './helpers.js';

const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function phone(browser, viewport, visibleHeight, query = '') {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: safari });
  // Model Safari's toolbar reducing its visible area without resizing the canvas.
  await page.addInitScript((height) => {
    window.menuTestHeight = height;
    window.menuTestOffset = 0;
    Object.defineProperties(window.visualViewport, {
      height: { get: () => Math.min(window.innerHeight, window.menuTestHeight) },
      offsetTop: { get: () => window.menuTestOffset },
    });
  }, visibleHeight);
  const errors = collectErrors(page);
  await page.goto(`${DEV}${query ? `?${query.slice(1)}` : ''}`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  return { page, errors };
}

async function tapMenu(page, group, index) {
  const at = await page.evaluate(({ group, index }) => {
    const item = window.__liano.app.scene.getScene('ui').overlays.titleGeometry[group][index];
    return { x: item.x, y: item.y };
  }, { group, index });
  const point = await panelPoint(page, 'title', at.x, at.y);
  await page.touchscreen.tap(point.x, point.y);
}

async function checkPanel(page, name) {
  const result = await page.evaluate((name) => {
    const { app, layout, platform } = window.__liano;
    const ui = app.scene.getScene('ui'), o = ui.overlays;
    const geometry = o[`${name}Geometry`], root = o[name];
    const cssScale = root.scaleX * layout.scale;
    const x = layout.x + root.x * layout.scale, y = layout.y + root.y * layout.scale;
    const hits = name === 'title' ? [...geometry.modes, ...geometry.settings].map((item) => item.hit)
      .concat([geometry.startHit, geometry.configHit]) : name === 'gameOver' ? [geometry.replayHit, geometry.menuHit]
      : geometry.items.map((item) => item.hit).concat([geometry.backHit]);
    const labels = name === 'title' ? [o.titleName, o.tagline, o.titleControl, o.titlePrompt, o.configEntry, o.titleVersion,
      ...(platform.mobile ? [] : o.modes.map((item) => item.label)), o.livesLine, o.slipLine, o.shadowLine]
      : name === 'gameOver' ? [o.gameOverTitle, o.scoreText, o.bestText, o.bananasText, o.gameOverPrompt, o.gameOverMenu]
      : [o.configHeading, o.configSubtitle, o.configBack, ...o.graphicsItems.map((item) => item.label)];
    return { area: platform.menuArea, cameraVisible: ui.menuCamera.visible,
      bounds: { left: x - geometry.width * cssScale / 2, right: x + geometry.width * cssScale / 2,
        top: y - geometry.height * cssScale / 2, bottom: y + geometry.height * cssScale / 2 },
      hits: hits.map((hit) => ({ width: hit.w * cssScale, height: hit.h * cssScale })),
      labels: labels.map((label) => {
        const b = label.text.getBounds();
        return { text: label.text.text, visible: label.text.visible,
          left: layout.x + b.left * layout.scale, right: layout.x + b.right * layout.scale,
          top: layout.y + b.top * layout.scale, bottom: layout.y + b.bottom * layout.scale };
      }) };
  }, name);
  expect(result.cameraVisible).toBe(true);
  const { bounds, area } = result;
  expect(bounds.left).toBeGreaterThanOrEqual(area.x - 1);
  expect(bounds.right).toBeLessThanOrEqual(area.x + area.width + 1);
  expect(bounds.top).toBeGreaterThanOrEqual(area.y - 1);
  expect(bounds.bottom).toBeLessThanOrEqual(area.y + area.height + 1);
  for (const hit of result.hits) {
    expect(hit.width).toBeGreaterThanOrEqual(44);
    expect(hit.height).toBeGreaterThanOrEqual(44);
  }
  for (const label of result.labels) {
    expect(label.visible, label.text).toBe(true);
    expect(label.left, label.text).toBeGreaterThanOrEqual(bounds.left - 1);
    expect(label.right, label.text).toBeLessThanOrEqual(bounds.right + 1);
    expect(label.top, label.text).toBeGreaterThanOrEqual(bounds.top - 1);
    expect(label.bottom, label.text).toBeLessThanOrEqual(bounds.bottom + 1);
  }
}

for (const [orientation, viewport, visibleHeight] of [
  ['portrait', { width: 375, height: 812 }, 600],
  ['landscape', { width: 812, height: 375 }, 250],
]) test(`small-screen ${orientation} menus fit Safari's visible area and support touch settings`, async ({ browser }) => {
  const { page, errors } = await phone(browser, viewport, visibleHeight);
  await checkPanel(page, 'title');
  expect(await page.evaluate(() => window.__liano.game.shadowOn)).toBe(true);
  expect(await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.shadowLine.text.text)).toBe('Shadow\nOn');
  expect(await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.titleVersion.text.visible)).toBe(true);
  for (const [index, setting, initial] of [[0, 'lives', false], [1, 'slip', false], [2, 'shadow', true]]) {
    await tapMenu(page, 'settings', index);
    await expect.poll(() => page.evaluate((setting) => window.__liano.game[setting], setting)).toBe(!initial);
    expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
    await tapMenu(page, 'settings', index);
    await expect.poll(() => page.evaluate((setting) => window.__liano.game[setting], setting)).toBe(initial);
  }
  await page.screenshot({ path: `/tmp/liano-mobile-title-${orientation}.png` });
  const entry = await menuLabelPoint(page, 'title', 'configEntry');
  await page.touchscreen.tap(entry.x, entry.y);
  await expect.poll(() => page.evaluate(() => window.__liano.platform.configMenu.open)).toBe(true);
  await checkPanel(page, 'config');
  await page.screenshot({ path: `/tmp/liano-mobile-config-${orientation}.png` });
  const back = await menuLabelPoint(page, 'config', 'configBack');
  await page.touchscreen.tap(back.x, back.y);
  await expect.poll(() => page.evaluate(() => window.__liano.platform.configMenu.open)).toBe(false);
  // Safari can change its visible height/offset without a window resize.
  await page.evaluate(() => {
    window.menuTestHeight -= 30;
    window.menuTestOffset = 15;
    window.visualViewport.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => page.evaluate(() => window.__liano.platform.menuArea.y)).toBe(23);
  await checkPanel(page, 'title');
  expect(errors).toEqual([]);
  await page.close();
});

test('mobile stays single-player and preserves settings through graphics reloads', async ({ browser }) => {
  const { page, errors } = await phone(browser, { width: 375, height: 812 }, 600, '&mode=split');
  expect(await page.evaluate(() => window.__liano.game.mode)).toBe('solo');
  expect(await page.evaluate(() => window.__liano.game.shadowOn)).toBe(true);
  expect(await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.modePicker.visible)).toBe(false);
  for (const key of ['Digit2', 'Digit3']) await page.keyboard.press(key);
  expect(await page.evaluate(() => window.__liano.game.mode)).toBe('solo');
  await checkPanel(page, 'title');
  // The same settings survive the resolution submenu's reload.
  for (const i of [0, 1, 2]) await tapMenu(page, 'settings', i);
  const entry = await menuLabelPoint(page, 'title', 'configEntry');
  await page.touchscreen.tap(entry.x, entry.y);
  await expect.poll(() => page.evaluate(() => window.__liano.platform.configMenu.open)).toBe(true);
  const sharpAt = await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.configGeometry.items[2]);
  const sharp = await panelPoint(page, 'config', sharpAt.x, sharpAt.y);
  await page.touchscreen.tap(sharp.x, sharp.y);
  await page.waitForURL((url) => url.searchParams.get('resolution') === '2');
  await page.waitForFunction(() => window.__liano?.platform.world);
  expect(await page.evaluate(() => ({ lives: window.__liano.game.lives, slip: window.__liano.game.slip,
    shadow: window.__liano.game.shadow }))).toEqual({ lives: true, slip: true, shadow: false });
  expect(await page.evaluate(() => window.__liano.game.mode)).toBe('solo');
  const start = await menuLabelPoint(page, 'title', 'titlePrompt');
  await page.touchscreen.tap(start.x, start.y);
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
  expect(await page.evaluate(() => window.__liano.app.scene.getScene('ui').menuCamera.visible)).toBe(false);
  expect(errors).toEqual([]);
  await page.close();
});

test('desktop player-mode choices and settings respond to clicks without starting a run', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  for (const [index, mode] of [[1, 'shared'], [2, 'split'], [0, 'solo']]) {
    const at = await page.evaluate((index) => window.__liano.app.scene.getScene('ui').overlays.titleGeometry.modes[index], index);
    const point = await panelPoint(page, 'title', at.x, at.y);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate(() => window.__liano.game.mode)).toBe(mode);
    expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  }
  for (const [index, setting, expected] of [[0, 'lives', true], [1, 'slip', true], [2, 'shadow', false]]) {
    const at = await page.evaluate((index) => window.__liano.app.scene.getScene('ui').overlays.titleGeometry.settings[index], index);
    const point = await panelPoint(page, 'title', at.x, at.y);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate((setting) => window.__liano.game[setting], setting)).toBe(expected);
    expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  }
  expect(errors).toEqual([]);
});

for (const [orientation, viewport, visibleHeight] of [
  ['portrait', { width: 375, height: 812 }, 600],
  ['landscape', { width: 812, height: 375 }, 250],
]) test(`mobile game-over ${orientation} offers distinct replay and title-menu taps`, async ({ browser }) => {
  const { page, errors } = await phone(browser, viewport, visibleHeight);
  const finishRun = async () => {
    const start = await menuLabelPoint(page, 'title', 'titlePrompt');
    await page.touchscreen.tap(start.x, start.y);
    await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
    await page.touchscreen.tap(20, visibleHeight / 2);
    await expect.poll(() => page.evaluate(() => window.__liano.game.world.monkey.state)).toBe('AIRBORNE');
    await page.evaluate(() => { window.__liano.game.world.monkey.y = 5000; });
    await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('RESULTS');
    await expect.poll(() => page.evaluate(() => window.__liano.game.canRestart())).toBe(true);
  };
  await finishRun();
  await checkPanel(page, 'gameOver');
  expect(await page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.gameOverPrompt.text.text)).toBe('Tap to play again');
  await page.screenshot({ path: `/tmp/liano-mobile-results-${orientation}.png` });
  const menu = await menuLabelPoint(page, 'gameOver', 'gameOverMenu');
  await page.touchscreen.tap(menu.x, menu.y);
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  expect(await page.evaluate(() => window.__liano.game.shadowOn)).toBe(true);
  await checkPanel(page, 'title');
  await finishRun();
  const replay = await menuLabelPoint(page, 'gameOver', 'gameOverPrompt');
  await page.touchscreen.tap(replay.x, replay.y);
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
  expect(errors).toEqual([]);
  await page.close();
});

test('the game-over title-menu option also responds to a desktop click', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.game.world.monkey.state)).toBe('AIRBORNE');
  await page.evaluate(() => { window.__liano.game.world.monkey.y = 5000; });
  await expect.poll(() => page.evaluate(() => window.__liano.game.canRestart())).toBe(true);
  await checkPanel(page, 'gameOver');
  const menu = await menuLabelPoint(page, 'gameOver', 'gameOverMenu');
  await page.mouse.click(menu.x, menu.y);
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  expect(errors).toEqual([]);
});
