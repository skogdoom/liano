import { engineFrom } from './engine.js';
import { createFatalOverlay } from './fatal.js';

// The page's entry: starts the version of the game the URL asks for (see engine.js).
// Each version is its own chunk, so a page downloads only its own library.
const engine = engineFrom(location.search);
document.documentElement.dataset.engine = engine;
// `?frames=1`: a frame-time readout, for checking smoothness on a device (frameStats.js).
if (new URLSearchParams(location.search).get('frames') === '1') import('./frameStats.js').then(({ showFrameStats }) => showFrameStats());
try {
  if (engine === 'phaser') await import('./phaser/main.js');
  else await import('./main.js');
  // For the browser tests: the version has started.
  document.documentElement.dataset.ready = 'true';
} catch (error) {
  // A chunk that fails to load, before the version could set up its own error screen.
  createFatalOverlay(document).show(error);
}
