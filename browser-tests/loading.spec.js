import { test, expect } from '@playwright/test';
import { DEV, PREVIEW } from '../playwright.config.js';
import { collectErrors, started } from './helpers.js';

function gate() {
  let open, reached;
  const waiting = new Promise(resolve => { open = resolve; });
  const requested = new Promise(resolve => { reached = resolve; });
  return { requested, open, hold: async route => { reached(); await waiting; await route.continue(); } };
}

test('production loading feedback appears before the large game download and clears at actual readiness', async ({ page }) => {
  const errors = collectErrors(page), bundle = gate();
  await page.route('**/assets/main-*.js', bundle.hold);
  try {
    await page.goto(PREVIEW, { waitUntil: 'commit' });
    await bundle.requested;
    await expect(page.getByRole('status')).toHaveText('Loading…');
    await expect(page.locator('#loading')).toBeVisible();
    const spinner = page.locator('.loading-spinner');
    const initialRotation = await spinner.evaluate(el => getComputedStyle(el).transform);
    await expect.poll(() => spinner.evaluate(el => getComputedStyle(el).transform)).not.toBe(initialRotation);
    await expect(page.locator('html')).not.toHaveAttribute('data-ready');
    await page.keyboard.press('Space');
    await page.locator('#loading').click();
    bundle.open();
    await started(page, errors);
    await expect(page.locator('#loading')).toBeHidden();
    expect(await page.evaluate(() => window.__loadingErrorController)).toBeUndefined();
    expect(errors).toEqual([]);
  } finally { bundle.open(); }
});

test('classic loading covers art and setup, discards early input and preserves normal play', async ({ page }) => {
  const errors = collectErrors(page), art = gate();
  await page.addInitScript(() => {
    const proto = (window.OfflineAudioContext || window.webkitOfflineAudioContext).prototype;
    const render = proto.startRendering;
    let first = true;
    const ready = new Promise(resolve => { window.__releaseSound = resolve; });
    proto.startRendering = function (...args) {
      const rendered = render.apply(this, args);
      if (!first) return rendered;
      first = false;
      return rendered.then(buffer => ready.then(() => buffer));
    };
  });
  await page.route('**/art/classic/main@*x.json', art.hold);
  try {
    await page.goto(`${DEV}?art=classic`, { waitUntil: 'commit' });
    await art.requested;
    await page.waitForFunction(() => window.__liano?.input);
    await expect(page.locator('#loading')).toBeVisible();
    await page.keyboard.press('Space');
    await page.locator('#loading').click();
    art.open();
    await page.waitForFunction(() => window.__liano.platform.artLoad.sets.some(s => s.set === 'main'));
    await expect(page.locator('#loading')).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-ready');
    expect(await page.evaluate(() => window.__liano.platform.world)).toBeUndefined();
    await page.evaluate(() => window.__releaseSound());
    await started(page, errors);
    expect(await page.evaluate(() => ({ state: window.__liano.game.state,
      rigs: window.__liano.platform.prepared.rigs, ready: window.__liano.platform.startup.complete })))
      .toEqual({ state: 'TITLE', rigs: 37, ready: true });
    await expect(page.locator('#loading')).toBeHidden();
    await page.waitForFunction(() => window.__liano.pause.acceptsInput());
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.__liano.game.state)).toBe('PLAYING');
    expect(errors).toEqual([]);
  } finally {
    art.open();
    await page.evaluate(() => window.__releaseSound?.()).catch(() => {});
  }
});

test('the initial shell delays display, avoids a fast-load flash and respects reduced motion', async ({ page }) => {
  // Isolate the real HTML/CSS shell and its controller from engine/download time.
  await page.route(DEV, async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<script type="module"[^>]*src="\/src\/boot\.js"[^>]*><\/script>/, '');
    await route.fulfill({ response, body: html });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV);
  const spinner = page.locator('.loading-spinner');
  const initialOpacity = await spinner.evaluate(el => getComputedStyle(el).opacity);
  await expect.poll(() => spinner.evaluate(el => getComputedStyle(el).opacity)).not.toBe(initialOpacity);
  const result = await page.evaluate(async () => {
    const { createStartup } = await import('/src/startup.js');
    const loading = document.getElementById('loading');
    const animation = loading.getAnimations().find(a => a.animationName === 'loading-show');
    animation.pause(); animation.currentTime = 249;
    const beforeDelay = getComputedStyle(loading).visibility;
    animation.currentTime = 250;
    const afterDelay = getComputedStyle(loading).visibility;
    const spinner = loading.querySelector('.loading-spinner');
    const reducedMotion = getComputedStyle(spinner).animationName;
    const pulse = spinner.getAnimations().find(a => a.animationName === 'loading-pulse');
    pulse.pause(); pulse.currentTime = 0;
    const dim = getComputedStyle(spinner).opacity;
    pulse.currentTime = 800;
    const bright = getComputedStyle(spinner).opacity;
    const rotation = getComputedStyle(spinner).transform;
    // A subsequent fast/cached startup completes before its display deadline.
    animation.currentTime = 0;
    const startup = createStartup(document);
    startup.finish();
    animation.currentTime = 1000;
    return { beforeDelay, afterDelay, reducedMotion, dim, bright, rotation, ready: await startup.ready,
      hidden: loading.hidden, display: getComputedStyle(loading).display,
      cleaned: window.__loadingErrorController === undefined };
  });
  expect(result).toEqual({ beforeDelay: 'hidden', afterDelay: 'visible', reducedMotion: 'loading-pulse',
    dim: '0.4', bright: '1', rotation: 'none',
    ready: true, hidden: true, display: 'none', cleaned: true });
});

for (const [name, pattern] of [
  ['entry script', '**/assets/index-*.js'],
  ['game script', '**/assets/main-*.js'],
  ['art catalog', '**/art/cartoon/pieces.json'],
  ['main atlas', '**/art/cartoon/main@*x-*.png'],
]) {
  test(`a failed ${name} hands loading over to the production reload screen`, async ({ page }) => {
    await page.route(pattern, route => route.abort());
    await page.goto(PREVIEW, { waitUntil: 'commit' });
    await expect(page.locator('#fatal')).toBeVisible();
    await expect(page.locator('#fatal button')).toBeVisible();
    await expect(page.locator('#loading')).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-ready');
  });
}

test('a setup error removes loading without marking the game ready', async ({ page }) => {
  await page.route('**/src/render/warmup.js*', route => route.fulfill({ contentType: 'application/javascript',
    body: 'export async function warmObstacleRigs() { throw new Error("setup failure"); }' }));
  await page.goto(DEV, { waitUntil: 'commit' });
  await expect(page.locator('#fatal')).toBeVisible();
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('html')).not.toHaveAttribute('data-ready');
});
