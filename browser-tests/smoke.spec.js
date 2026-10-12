import { test, expect } from '@playwright/test';
import { DEV, PREVIEW } from '../playwright.config.js';
import { collectErrors, started } from './helpers.js';

for (const [label, query, engine] of [
  ['default', '', 'pixi'],
  ['Pixi', '?engine=pixi', 'pixi'],
  ['Phaser', '?engine=phaser', 'phaser'],
]) {
  test(`the ${label} version of the production build starts without errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(PREVIEW + query);
    await started(page, errors);
    await expect(page.locator('html')).toHaveAttribute('data-engine', engine);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.locator('#fatal')).not.toHaveClass(/shown/);
    expect(errors).toEqual([]);
  });
}

test('the Pixi version plays: Space starts a run', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=pixi`);
  await started(page, errors);
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  // Presses count only while running and not just after resuming (pause.js).
  await page.waitForFunction(() => window.__liano.pause.acceptsInput());
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
  expect(errors).toEqual([]);
});

// Both versions run on the same software WebGL here, so the agreed meaning of identical
// (PHASER_PLAN.md, section 1) holds for every scenario. Needs `npm run art:atlas` first.
test('the parity page draws its scenarios identically with both versions', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await page.goto(`${DEV}parity.html`);
  await page.waitForFunction(() => document.documentElement.dataset.parity, null, { timeout: 120_000 });
  expect(errors).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('data-parity', 'done');
  const results = await page.evaluate(() => window.__parity);
  console.log('parity:', JSON.stringify(results));
  expect(results.length).toBeGreaterThan(0);
  for (const result of results) {
    expect(result.pixels).toBeGreaterThan(0);
    expect(result.share).toBeGreaterThanOrEqual(0);
    expect(result.share).toBeLessThanOrEqual(1);
  }
  expect(results.filter((result) => !result.pass).map((result) => result.id)).toEqual([]);
  expect(errors).toEqual([]);
});
