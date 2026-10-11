import { rendererFrom } from './renderer.js';
import { createFatalOverlay } from './fatal.js';

// The page's entry: starts the version of the game the URL asks for (see renderer.js).
// Each version is its own chunk, so a page downloads only its own library.
const renderer = rendererFrom(location.search);
document.documentElement.dataset.renderer = renderer;
try {
  if (renderer === 'phaser') await import('./phaser/main.js');
  else await import('./main.js');
  // For the browser tests: the version has started.
  document.documentElement.dataset.ready = 'true';
} catch (error) {
  // A chunk that fails to load, before the version could set up its own error screen.
  createFatalOverlay(document).show(error);
}
