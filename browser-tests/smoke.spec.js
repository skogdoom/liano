import { test, expect } from '@playwright/test';
import { DEV, PREVIEW } from '../playwright.config.js';

// Errors the page reports: uncaught ones, console errors, and responses that failed
// (with their URL, which the console message leaves out).
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

// Waits until the page has started a version or shown its error screen, then reports
// any errors before checking that it started (so a failure says why).
async function started(page, errors) {
  await page.waitForFunction(() => document.documentElement.dataset.ready || document.querySelector('#fatal.shown'), null, { timeout: 30_000 });
  expect(errors).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}

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
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
  expect(errors).toEqual([]);
});

test('the parity page draws its scenarios with both versions', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}parity.html`);
  await page.waitForFunction(() => document.documentElement.dataset.parity, null, { timeout: 30_000 });
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
  expect(errors).toEqual([]);
});
