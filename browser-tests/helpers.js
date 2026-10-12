import { expect } from '@playwright/test';

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
