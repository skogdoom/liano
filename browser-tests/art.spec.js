import { test, expect } from '@playwright/test';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

// The art gallery (art.html): every piece as built into the atlases matches the game's
// own drawing of it. Needs the art built (`npm run art:build`, part of the build).
test('every piece of art is built as the game draws it', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  await page.goto(`${DEV}art.html?scale=2`);
  await page.waitForFunction(() => document.documentElement.dataset.gallery, null, { timeout: 200_000 });
  const gallery = await page.evaluate(() => window.__gallery);
  console.log(`gallery at 2x: ${gallery.frames.length} frames, ${(gallery.share * 100).toFixed(2)} % differing`);
  expect(gallery.frames.filter((f) => !f.pass).map((f) => f.name)).toEqual([]);
  expect(gallery.share).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});
