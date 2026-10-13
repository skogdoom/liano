import { test, expect } from '@playwright/test';
import { PREVIEW } from '../playwright.config.js';
import { collectErrors, started } from './helpers.js';
import { readFile } from 'node:fs/promises';

test('the production Phaser readout exports actual update/render frames', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${PREVIEW}?engine=phaser&frames=1`);
  await started(page, errors);
  await page.waitForFunction(() => window.__phaserFrameTrace?.snapshot().frames.length > 10);
  const recorded = await page.evaluate(() => window.__phaserFrameTrace.snapshot());
  expect(recorded.info.presentationMeasured).toBe(false);
  expect(recorded.info.gpuTimingMeasured).toBe(false);
  const frame = recorded.frames.at(-1);
  expect(frame.cpuMs).toBeGreaterThanOrEqual(0);
  expect(frame.updateMs + frame.renderSubmitMs).toBeCloseTo(frame.cpuMs, 5);
  expect(frame.alpha).toBeGreaterThanOrEqual(0);
  expect(frame.alpha).toBeLessThanOrEqual(1);
  expect(frame.panes[0].monkeyScreen.x).toBeDefined();
  expect(frame.panes[0].ropeTipScreen.x).toBeDefined();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save frame trace' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('liano-phaser-frame-trace.json');
  const data = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(data.frames.length).toBeGreaterThan(10);
  expect(data.frames.at(-1).panes[0].monkeyState).toBe('HANGING');
  expect(errors).toEqual([]);
});

test('normal Phaser play and the Pixi readout do not install the recorder', async ({ page }) => {
  const errors = collectErrors(page);
  for (const query of ['engine=phaser', 'engine=pixi&frames=1']) {
    await page.goto(`${PREVIEW}?${query}`);
    await started(page, errors);
    expect(await page.evaluate(() => window.__phaserFrameTrace)).toBeUndefined();
    await expect(page.getByRole('button', { name: 'Save frame trace' })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
