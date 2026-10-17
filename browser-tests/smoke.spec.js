import { test, expect } from '@playwright/test';
import { DEV, PREVIEW } from '../playwright.config.js';
import { collectErrors, started } from './helpers.js';

// The production build's start, art, worker and first run: production.spec.js.

// Retired engine URLs must still open the game rather than a removed script.
test('an old engine URL still starts the Phaser game', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${PREVIEW}?engine=pixi`);
  await started(page, errors);
  await expect(page.locator('html')).toHaveAttribute('data-engine', 'phaser');
  expect(errors).toEqual([]);
});

test('the frame-time readout counts frames without starting the game on a tap', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?frames=1`);
  await started(page, errors);
  const readout = page.locator('#frame-stats');
  await expect(readout).toContainText(/frames/);
  await page.waitForFunction(() => window.__liano.pause.acceptsInput());
  await readout.click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__liano.game.state)).toBe('TITLE');
  expect(errors).toEqual([]);
});
