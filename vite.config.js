import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Phaser built from its source, without what the game does not use (PHASER_PLAN.md, M0
// and M7): no physics (its no-physics entry) and WebGL only. Phaser's code tests its
// feature flags as `if (typeof CANVAS_RENDERER)`, which its own webpack build replaces;
// here a transform does, in the build and in the dev server's pre-bundling alike.
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
    // The heaviest tests take 3–5 s here; CI runners are slower.
    testTimeout: 30000,
  },
}));
