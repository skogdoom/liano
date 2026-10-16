import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

for (const touch of [false, true]) test(`${touch ? 'touch' : 'desktop'} pause accepts resume controls and Escape without releasing the monkey`, async ({ browser }) => {
  const page = await browser.newPage(touch ? { viewport: { width: 375, height: 600 }, isMobile: true, hasTouch: true } : {});
  const errors = collectErrors(page);
  await page.goto(`${DEV}?art=cartoon`);
  await page.waitForFunction(() => window.__liano?.platform.world);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => __liano.game.state)).toBe('PLAYING');
  for (const control of touch ? ['tap', 'Space'] : ['Space', 'click', 'Enter']) {
    await page.keyboard.press('KeyP');
    await expect.poll(() => page.evaluate(() => __liano.pause.paused)).toBe(true);
    if (control === 'tap') await page.touchscreen.tap(180, 300);
    else if (control === 'click') await page.mouse.click(600, 350);
    else await page.keyboard.press(control);
    await expect.poll(() => page.evaluate(() => __liano.pause.paused)).toBe(false);
    expect(await page.evaluate(() => ({ state: __liano.game.state, monkey: __liano.game.world.monkey.state })))
      .toEqual({ state: 'PLAYING', monkey: 'HANGING' });
  }
  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => __liano.pause.paused)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => ({ state: __liano.game.state, paused: __liano.pause.paused })))
    .toEqual({ state: 'TITLE', paused: false });
  expect(errors).toEqual([]);
  await page.close();
});
