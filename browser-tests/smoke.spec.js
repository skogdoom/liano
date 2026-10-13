import { test, expect } from '@playwright/test';
import { DEV, PREVIEW } from '../playwright.config.js';
import { collectErrors, started } from './helpers.js';

for (const [label, query, engine] of [
  ['default', '', 'phaser'],
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

// The frame-time readout (?frames=1) for checking smoothness on a device: it counts the
// frames, and a tap on it is not a press in the game.
for (const engine of ['phaser', 'pixi']) {
  test(`the ${engine === 'phaser' ? 'Phaser' : 'Pixi'} version shows the frame-time readout with ?frames=1`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${DEV}?engine=${engine}&frames=1`);
    await started(page, errors);
    const readout = page.locator('#frame-stats');
    await expect(readout).toContainText(/Hz · since reset: \d+ frames/, { timeout: 10_000 });
    await page.waitForFunction(() => window.__liano.pause.acceptsInput());
    await readout.click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
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

// The parity page's results for the scenarios whose ids start with `only` (comma-separated).
async function parity(page, only, timeout) {
  const errors = collectErrors(page);
  await page.goto(`${DEV}parity.html?only=${only}`);
  await page.waitForFunction(() => document.documentElement.dataset.parity, null, { timeout });
  expect(errors).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('data-parity', 'done');
  const results = await page.evaluate(() => window.__parity);
  console.log(`parity (${only}):`, JSON.stringify(results));
  expect(results.length).toBeGreaterThan(0);
  for (const result of results) {
    expect(result.pixels).toBeGreaterThan(0);
    expect(result.share).toBeGreaterThanOrEqual(0);
    expect(result.share).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
  return results;
}

// Both versions run on the same software WebGL here, so the agreed meaning of identical
// (PHASER_PLAN.md, section 1) holds for every scenario. Needs the art built (`npm run art:build`, part of the build).
test('the parity page draws every object, the HUD and the overlays identically with both versions', async ({ page }) => {
  test.setTimeout(240_000);
  const results = await parity(page, 'shapes,spike.,world.,ui.', 200_000);
  expect(results.filter((result) => !result.pass).map((result) => result.id)).toEqual([]);
});

// The whole panes by day are the exceptions of M5's report (PHASER_PLAN.md), accepted by
// the owner: on 2× screens the far and mid layers' trunks are soft (their tiles are
// 1×), and at 1× the temple's stone edges spread a little (rims only). They must stay no
// worse than measured; every other scene must pass.
const SCENE_EXCEPTIONS = [
  'scene.day@2x',
  'scene.ahead@2x',
  ...[0, 1, 2, 3].flatMap((look) => [`scene.temple.${look}.day`, `scene.temple.${look}.day@2x`]),
];
test('the parity page draws the whole panes identically with both versions, but for the exceptions', async ({ page }) => {
  test.setTimeout(240_000);
  const results = await parity(page, 'scene.', 200_000);
  expect(results.filter((result) => !result.pass && !SCENE_EXCEPTIONS.includes(result.id)).map((result) => result.id)).toEqual([]);
  for (const result of results.filter((r) => SCENE_EXCEPTIONS.includes(r.id))) {
    expect(result.share, result.id).toBeLessThan(0.015);
    expect((result.solid / result.pixels) * 1e6, result.id).toBeLessThan(160);
  }
});
