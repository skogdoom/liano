import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Phaser built from its source, without what the game does not use
// (docs/plans/history/phaser-migration.md, M0 and M7): no physics (its no-physics entry) and
// WebGL only. Phaser's code tests its feature flags as `if (typeof CANVAS_RENDERER)`, which
// its own webpack build replaces; here a transform does, in the build and in the dev server's
// pre-bundling alike.
const PHASER_ENTRY = fileURLToPath(new URL('./node_modules/phaser/src/phaser-no-physics.js', import.meta.url));
const PHASER_SOURCE = /[\\/]node_modules[\\/]phaser[\\/]src[\\/].*\.js$/;
const PHASER_FLAGS = {
  WEBGL_RENDERER: true,
  CANVAS_RENDERER: false,
  WEBGL_DEBUG: false,
  FEATURE_SOUND: true,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
};
const flagPattern = new RegExp(`typeof (${Object.keys(PHASER_FLAGS).join('|')})\\b`, 'g');
const withFlags = (code) => code.replace(flagPattern, (_, flag) => String(PHASER_FLAGS[flag]));

const phaserFlags = {
  name: 'phaser-flags',
  enforce: 'pre',
  transform(code, id) {
    if (PHASER_SOURCE.test(id)) return { code: withFlags(code), map: null };
  },
};

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the game at https://skogdoom.github.io/liano/; the build
  // and `vite preview` use that path. The dev server stays at the root.
  base: command === 'build' || isPreview ? '/liano/' : '/',
  resolve: { alias: [{ find: /^phaser$/, replacement: PHASER_ENTRY }] },
  // Phaser's source sets `global.Phaser`.
  define: { global: 'globalThis' },
  plugins: [phaserFlags],
  optimizeDeps: { rolldownOptions: { plugins: [phaserFlags] } },
  build: {
    // The Phaser version's chunk is Phaser itself, about 1.2 MB before gzip.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    // Run the modules as Node imports them, not through Vite's module runner, whose
    // rewritten imports made the solver-heavy tests about three times slower (M9b.1).
    // So source imports JSON with `with { type: 'json' }` and nothing mocks modules.
    experimental: { viteModuleRunner: false },
    // `npm run coverage`: Node line and branch coverage of every module under src/,
    // those no unit test imports included (they count as uncovered). Browser checks and
    // real devices cover more; see docs/plans/testing.md.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      // Floors where Node tests are the guarantee (M9b.1, a little under the measured
      // coverage): the rules, the sound, and the pure modules the game is driven by.
      // Rendering and the platform are covered by the browser checks instead.
      thresholds: {
        'src/sim/**': { lines: 98, branches: 94 },
        'src/audio/**': { lines: 95, branches: 88 },
        'src/{driver,input,layout,loop,pause,startup,frameClock,obstaclePrefetch}.js': { lines: 97, branches: 87 },
      },
    },
    // The heaviest tests take 3–5 s here; CI runners are slower. Coverage instrumentation
    // (npm run coverage) makes the solver-heavy ones several times slower again.
    testTimeout: process.env.COVERAGE ? 120000 : 30000,
  },
}));
