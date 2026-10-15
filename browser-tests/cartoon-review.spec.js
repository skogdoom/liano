import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DEV } from '../playwright.config.js';
import { collectErrors } from './helpers.js';

const review = JSON.parse(readFileSync(new URL('../art/packs/cartoon/review/manifest.json', import.meta.url), 'utf8'));

test('cartoon style review shows all samples and switches game-scale views without loading the game', async ({ page }) => {
  const errors = collectErrors(page);
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(`${DEV}cartoon.html`);
  await page.waitForFunction(() => document.documentElement.dataset.cartoonReview === 'ready');
  await expect(page.locator('#cards article')).toHaveCount(9);
  await expect(page.locator('#coverage')).toContainText('175 pieces / 594 required frames');
  await expect(page.locator('#coverage')).toContainText('594 painted');
  await expect(page.locator('#scale')).toContainText('1280 × 720');
  await page.selectOption('#viewport', 'portrait');
  await page.selectOption('#light', 'night');
  await page.selectOption('#display', 'actual');
  await expect(page.locator('#scale')).toContainText('375 × 812');
  expect(await page.locator('#scene').evaluate((c) => c.style.width)).toBe('375px');
  await page.selectOption('#viewport', 'landscape');
  await expect(page.locator('#scale')).toContainText('812 × 375');
  expect(requests.some((url) => /\/art\/(?:boot|main)@/.test(url))).toBe(false);
  expect(await page.evaluate(() => window.__liano)).toBeUndefined();
  // The exported sprites must composite without the colored matte found in the
  // first sample. These points are empty spaces, outside the illustrated objects.
  const alpha = await page.evaluate(async ({ image, transparentChecks }) => {
    const bitmap = new Image(); bitmap.src = `/art/packs/cartoon/${image}`; await bitmap.decode();
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
    return transparentChecks.map(({ x, y }) => ctx.getImageData(x, y, 1, 1).data[3]);
  }, review);
  expect(alpha).toEqual(review.transparentChecks.map(() => 0));
  expect(errors).toEqual([]);
});
