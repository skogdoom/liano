import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

const manifest = JSON.parse(readFileSync(new URL('./references/manifest.json', import.meta.url), 'utf8'));

test('the renderer matches the references saved before Pixi removal', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await page.goto(`${DEV}reference.html`);
  await page.waitForFunction(() => document.documentElement.dataset.references, null, { timeout: 150_000 });
  await expect(page.locator('html')).toHaveAttribute('data-references', 'done');
  const results = await page.evaluate(() => window.__references);
  expect(results.map((r) => r.id)).toEqual(manifest.references.map((r) => r.id));
  expect(results.filter((r) => !r.pass)).toEqual([]);
  expect(errors).toEqual([]);
});
