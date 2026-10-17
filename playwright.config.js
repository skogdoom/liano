import { defineConfig } from '@playwright/test';

// Browser tests (`npm run test:browser`, after `npm run build`): smoke tests of both
// versions of the game and of the parity page, in Chromium. They run the production
// build (`vite preview`, at /liano/ as on GitHub Pages) and, for what needs the dev
// hooks or the dev-only parity page, the dev server.
//
// CI installs the Chromium this Playwright expects. Elsewhere `CHROMIUM` can point at
// another Chromium binary to use instead.
export const PREVIEW = 'http://localhost:4173/liano/';
export const DEV = 'http://localhost:5174/';

export default defineConfig({
  testDir: 'browser-tests',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  // One test at a time in CI: the pages draw in software WebGL, and two at once starve
  // each other on the runner (the Pixi title scene alone takes a few hundred ms a frame).
  workers: process.env.CI ? 1 : undefined,
  // Chromium can lose a context during setup on the shared CI runner, before
  // the test body starts. One retry starts a fresh worker; assertions and
  // timeouts stay unchanged, and persistent failures still fail the job.
  retries: process.env.CI ? 1 : 0,
  // On GitHub the failures also become annotations on the check run.
  reporter: process.env.CI ? [['github'], ['list']] : 'line',
  use: {
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.CHROMIUM || undefined,
      // WebGL without a GPU: SwiftShader, which headless Chromium no longer picks by itself.
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: [
    { command: 'npx vite preview --port 4173 --strictPort', url: PREVIEW, reuseExistingServer: !process.env.CI },
    { command: 'npx vite --port 5174 --strictPort', url: DEV, reuseExistingServer: !process.env.CI },
  ],
});
