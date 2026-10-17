import { test as base, expect } from '@playwright/test';

// The tests, with `browserPages`: browser.newPage and newContext whose pages and contexts
// are closed after the test, whether it passed or failed (M9b.1).
export const test = base.extend({
  browserPages: async ({ browser }, use) => {
    const opened = [];
    const track = (made) => {
      opened.push(made);
      return made;
    };
    await use({
      newPage: (options) => browser.newPage(options).then(track),
      newContext: (options) => browser.newContext(options).then(track),
    });
    for (const made of opened.reverse()) await made.close().catch(() => {});
  },
});

// Errors the page reports: uncaught ones, console errors, and responses that failed
// (with their URL, which the console message leaves out).
export function collectErrors(page) {
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
export async function started(page, errors) {
  await page.waitForFunction(() => document.documentElement.dataset.ready || document.querySelector('#fatal.shown'), null, { timeout: 30_000 });
  expect(errors).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}

// A point in a Phaser overlay panel, converted through the actual CSS/UI layout.
export async function panelPoint(page, name, x, y) {
  return page.evaluate(({ name, x, y }) => {
    const { app, layout } = window.__liano;
    const view = app.scene.getScene('ui').overlays[name];
    const rect = app.canvas.getBoundingClientRect();
    return { x: rect.left + layout.x + (view.x + x * view.scaleX) * layout.scale,
      y: rect.top + layout.y + (view.y + y * view.scaleY) * layout.scale };
  }, { name, x, y });
}

export async function openConfig(page) {
  await page.keyboard.press('KeyC');
  await expect.poll(() => page.evaluate(() => window.__liano.app.scene.getScene('ui').overlays.config.visible)).toBe(true);
}

export async function menuLabelPoint(page, panel, name) {
  const point = await page.evaluate((name) => {
    const text = window.__liano.app.scene.getScene('ui').overlays[name].text;
    return { x: text.x, y: text.y };
  }, name);
  return panelPoint(page, panel, point.x, point.y);
}
