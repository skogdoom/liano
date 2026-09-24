import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the game at https://skogdoom.github.io/liano/; the build
  // and `vite preview` use that path. The dev server stays at the root.
  base: command === 'build' || isPreview ? '/liano/' : '/',
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
}));
