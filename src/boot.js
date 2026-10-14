import { createFatalOverlay } from './fatal.js';

// Load the game behind an error boundary, including a failed script download.
document.documentElement.dataset.engine = 'phaser';
try {
  await import('./main.js');
  // For the browser tests: the game has started.
  document.documentElement.dataset.ready = 'true';
  // `?frames=1`: a frame-time readout, for checking smoothness on a device (frameStats.js).
  // Started after the game's frame loop, so its frame callback runs after the game's.
  if (new URLSearchParams(location.search).get('frames') === '1') (await import('./frameStats.js')).showFrameStats();
} catch (error) {
  // A chunk that fails to load, before the version could set up its own error screen.
  createFatalOverlay(document).show(error);
}
