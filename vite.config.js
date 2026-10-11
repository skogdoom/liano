import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the game at https://skogdoom.github.io/liano/; the build
  // and `vite preview` use that path. The dev server stays at the root.
  base: command === 'build' || isPreview ? '/liano/' : '/',
  build: {
    // The Phaser version's chunk is Phaser itself, about 1.4 MB before gzip (see
    // PHASER_PLAN.md, M0: a custom build trims it, in M7).
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    // The heaviest tests take 3–5 s here; CI runners are slower.
    testTimeout: 30000,
  },
}));
