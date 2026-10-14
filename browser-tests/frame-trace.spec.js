import { test, expect } from '@playwright/test';
import { DEV, PREVIEW } from '../playwright.config.js';
import { collectErrors, started } from './helpers.js';
import { readFile } from 'node:fs/promises';

test('the production Phaser readout exports actual update/render frames', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${PREVIEW}?engine=phaser&frames=1`);
  await started(page, errors);
  await page.waitForFunction(() => window.__phaserFrameTrace?.snapshot().frames.length > 10);
  const recorded = await page.evaluate(() => window.__phaserFrameTrace.snapshot());
  expect(recorded.info.frameClock).toBe('phaser-callback-phase-v2');
  expect(recorded.info.monkeyMotion).toBe('phaser-catch-transition-v1');
  expect(recorded.info.presentationMeasured).toBe(false);
  expect(recorded.info.gpuTimingMeasured).toBe(false);
  const frame = recorded.frames.at(-1);
  expect(frame.cpuMs).toBeGreaterThanOrEqual(0);
  expect(frame.updateMs + frame.renderSubmitMs).toBeCloseTo(frame.cpuMs, 5);
  expect(frame.alpha).toBeGreaterThanOrEqual(0);
  expect(frame.alpha).toBeLessThanOrEqual(1);
  expect(frame.panes[0].monkeyScreen.x).toBeDefined();
  expect(frame.panes[0].ropeTipScreen.x).toBeDefined();
  expect(frame.panes[0].cameraLags).toBe(2);
  expect(frame.panes[0].cameraRate).toBe(12);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save frame trace' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('liano-phaser-frame-trace.json');
  const data = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(data.frames.length).toBeGreaterThan(10);
  expect(data.frames.at(-1).panes[0].monkeyState).toBe('HANGING');
  expect(errors).toEqual([]);
});

test('the production shared-mode trace identifies the smoother camera response', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${PREVIEW}?engine=phaser&mode=shared&frames=1`);
  await started(page, errors);
  await page.waitForFunction(() => window.__phaserFrameTrace?.snapshot().frames.length > 10);
  const frame = await page.evaluate(() => window.__phaserFrameTrace.snapshot().frames.at(-1));
  expect(frame.mode).toBe('shared');
  expect(frame.panes[0].cameraLags).toBe(2);
  expect(frame.panes[0].cameraRate).toBe(16);
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


test('the real Phaser loop normalizes the Safari trace disturbances before drawing', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${DEV}?engine=phaser&frames=1`);
  await started(page, errors);
  await page.waitForFunction(() => window.__liano?.platform.world && window.__phaserFrameTrace);
  const result = await page.evaluate(() => {
    const { app, platform } = window.__liano;
    app.loop.sleep();
    platform.frameClock.refresh.relearn();
    platform.frameClock.owed = 0;
    let time = app.loop.lastTime;
    // The supplied trace starts 19 seconds into the session. Exercise the
    // disturbance with a settled estimate, after ten seconds of real rendering.
    for (let i = 0; i < 600; i++) app.loop.step(time += 1000 / 60);
    const out = [];
    for (const gap of [27, 14, 8, 17, 17, 30, 11, 9]) {
      app.loop.step(time += gap);
      const frame = window.__phaserFrameTrace.snapshot().frames.at(-1);
      out.push({ rawMs: frame.rawMs, stepMs: frame.stepMs,
        cameraX: frame.panes[0].cameraX, monkeyX: frame.panes[0].monkeyDrawnX,
        monkeyPreviousX: frame.panes[0].monkeyPreviousX, monkeyCurrentX: frame.panes[0].monkeyX,
        ropeRotation: frame.panes[0].ropeRotation, lianaAngle: frame.panes[0].lianaAngle,
        lianaPreviousAngle: frame.panes[0].lianaPreviousAngle, alpha: frame.alpha,
      });
    }
    // A phase disturbance with an existing balance must not trigger relearning.
    platform.frameClock.owed = 6.1892;
    for (const gap of [28, 10, 8, 17, 17]) {
      app.loop.step(time += gap);
      const frame = window.__phaserFrameTrace.snapshot().frames.at(-1);
      out.push({ rawMs: frame.rawMs, stepMs: frame.stepMs,
        cameraX: frame.panes[0].cameraX, monkeyX: frame.panes[0].monkeyDrawnX,
        monkeyPreviousX: frame.panes[0].monkeyPreviousX, monkeyCurrentX: frame.panes[0].monkeyX,
        ropeRotation: frame.panes[0].ropeRotation, lianaAngle: frame.panes[0].lianaAngle,
        lianaPreviousAngle: frame.panes[0].lianaPreviousAngle, alpha: frame.alpha,
      });
    }
    return out;
  });
  console.log('Phaser phase replay:', JSON.stringify(result));
  for (const frame of result) {
    expect(Math.abs(frame.stepMs - 1000 / 60)).toBeLessThan(0.2);
    expect(frame.monkeyX).toBeCloseTo(frame.monkeyPreviousX + (frame.monkeyCurrentX - frame.monkeyPreviousX) * frame.alpha, 8);
    expect(frame.ropeRotation).toBeCloseTo(-(frame.lianaPreviousAngle + (frame.lianaAngle - frame.lianaPreviousAngle) * frame.alpha), 8);
  }
  expect(errors).toEqual([]);
});
