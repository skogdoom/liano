import { expect } from '@playwright/test';
import { PREVIEW } from '../playwright.config.js';
import { collectErrors, started, test } from './helpers.js';

// The production build as GitHub Pages serves it, at /liano/, ready to play: only the
// selected pack's art, the obstacle worker generating ahead, and a run on a key press.
// The build has no test hooks, so this watches requests, the worker and the picture.
for (const art of ['cartoon', 'classic']) {
  test(`the ${art} production build at /liano/ is ready to play with its own art and the worker`, async ({ page }) => {
    const errors = collectErrors(page);
    const requests = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    const workerStarted = page.waitForEvent('worker');
    await page.goto(art === 'cartoon' ? PREVIEW : `${PREVIEW}?art=classic`);
    await started(page, errors);
    await expect(page.locator('#loading')).toBeHidden();

    // Only this pack's catalog, boot and main sets, under /liano/.
    const artRequests = requests.filter((path) => path.includes('/art/'));
    expect(artRequests.every((path) => path.startsWith(`/liano/art/${art}/`)), artRequests.join('\n')).toBe(true);
    for (const part of [/\/pieces\.json$/, /\/boot@\dx\.json$/, /\/main@\dx\.json$/, /\/main@\dx-0\.png$/]) {
      expect(artRequests.some((path) => part.test(path)), `${part}: ${artRequests.join('\n')}`).toBe(true);
    }

    // The worker is the built one, and answers what the game asks for once a run starts.
    const worker = await workerStarted;
    expect(new URL(worker.url()).pathname).toMatch(/^\/liano\/assets\/obstacleWorker-[\w-]+\.js$/);
    await worker.evaluate(() => {
      self.asked = 0;
      self.answered = 0;
      self.addEventListener('message', () => self.asked++);
      const post = self.postMessage.bind(self);
      self.postMessage = (...args) => {
        self.answered++;
        return post(...args);
      };
    });
    // The title's world is ready: nothing more is asked for until a run starts it anew.
    await page.waitForTimeout(1000);
    expect(await worker.evaluate(() => self.asked)).toBe(0);
    await page.keyboard.press('Space');
    await expect.poll(() => worker.evaluate(() => [self.asked > 0, self.answered > 0]), { timeout: 30_000 }).toEqual([true, true]);
    await expect(page.locator('#fatal')).not.toHaveClass(/shown/);
    expect(errors).toEqual([]);
  });
}
