import { createFatalOverlay } from './fatal.js';

// Load the game behind an error boundary, including a failed script download.
document.documentElement.dataset.engine = 'phaser';
try {
  const { startup } = await import('./main.js');
  // Import completion precedes art/setup. Wait for the first prepared frame.
  const ready = await startup.ready;
  // `?frames=1`: a frame-time readout, for checking smoothness on a device (frameStats.js).
  // Started after the game's frame loop, so its frame callback runs after the game's.
  if (ready && new URLSearchParams(location.search).get('frames') === '1') (await import('./frameStats.js')).showFrameStats();
} catch (error) {
  // A chunk that fails to load, before the version could set up its own error screen.
  createFatalOverlay(document).show(error);
}
