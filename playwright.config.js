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
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.CHROMIUM || undefined,
      // WebGL without a GPU: SwiftShader, which headless Chromium no longer picks by itself.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: [
    { command: 'npx vite preview --port 4173 --strictPort', url: PREVIEW, reuseExistingServer: !process.env.CI },
    { command: 'npx vite --port 5174 --strictPort', url: DEV, reuseExistingServer: !process.env.CI },
  ],
});
