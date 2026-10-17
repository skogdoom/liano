import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

const root = new URL('./references/cartoon/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));

test('cartoon rigs, day/night scenes and small-screen menus match the accepted references', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page), requests = [];
  page.on('request', request => requests.push(request.url()));
  for (const reference of manifest.references) {
    expect(createHash('sha256').update(readFileSync(new URL(`${reference.id}.png`, root))).digest('hex'), reference.id).toBe(reference.sha256);
  }
  await page.goto(`${DEV}cartoon-reference.html`);
  await page.waitForFunction(() => document.documentElement.dataset.references, null, { timeout: 150_000 });
  await expect(page.locator('html')).toHaveAttribute('data-references', 'done');
  const results = await page.evaluate(() => window.__cartoonReferences);
  console.log('accepted cartoon reference comparisons:', JSON.stringify(results));
  expect(results.map(r => r.id)).toEqual(manifest.references.map(r => r.id));
  expect(results.filter(r => !r.pass)).toEqual([]);
  expect(requests.some(url => url.includes('/art/classic/'))).toBe(false);
  expect(errors).toEqual([]);
});

test('cartoon reference comparison rejects an incorrect scene image', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('**/browser-tests/references/cartoon/scene.day.png', route => route.fulfill({
    contentType: 'image/png', body: readFileSync(new URL('./references/scene.day.png', import.meta.url)),
  }));
  await page.goto(`${DEV}cartoon-reference.html?only=scene.day`);
  await page.waitForFunction(() => document.documentElement.dataset.references);
  await expect(page.locator('html')).toHaveAttribute('data-references', 'done');
  const [result] = await page.evaluate(() => window.__cartoonReferences);
  expect(result.id).toBe('scene.day');
  expect(result.pass).toBe(false);
  expect(result.share).toBeGreaterThan(0.01);
  expect(result.solid / result.pixels * 1e6).toBeGreaterThan(25);
  expect(errors).toEqual([]);
});
