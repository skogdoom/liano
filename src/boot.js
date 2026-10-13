import { engineFrom } from './engine.js';
import { createFatalOverlay } from './fatal.js';

// The page's entry: starts the version of the game the URL asks for (see engine.js).
// Each version is its own chunk, so a page downloads only its own library.
const engine = engineFrom(location.search);
document.documentElement.dataset.engine = engine;
try {
  if (engine === 'phaser') await import('./phaser/main.js');
  else await import('./main.js');
  // For the browser tests: the version has started.
  document.documentElement.dataset.ready = 'true';
  // `?frames=1`: a frame-time readout, for checking smoothness on a device (frameStats.js).
  // Started after the game's frame loop, so its frame callback runs after the game's.
  if (new URLSearchParams(location.search).get('frames') === '1') (await import('./frameStats.js')).showFrameStats();
} catch (error) {
  // A chunk that fails to load, before the version could set up its own error screen.
  createFatalOverlay(document).show(error);
}
