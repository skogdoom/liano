import Phaser from 'phaser';
import { MAX_RESOLUTION } from '../config.js';
import { FULLSCREEN_HIT, controlsPoint, inside } from '../controls.js';
import { createFatalOverlay, createNotice, isOwnError } from '../fatal.js';
import { bindFullscreenControls } from '../fullscreen.js';
import { layoutFor } from '../layout.js';
import { createPause } from '../pause.js';
import { blockBrowserGestures, isHomeScreenApp, pixelRatio, safeAreaReader, watchScreen } from '../screen.js';
import { createPhaserFullscreen } from './fullscreen.js';
import { BootScene, PlayScene, UiScene } from './scenes.js';
import { canvasSize, viewCamera } from './view.js';

// The Phaser version of the game (see PHASER_PLAN.md). M2: the platform, which holds
// the layout, pause and full screen for the scenes (scenes.js); they draw an empty frame
// so far. The game itself comes in the later milestones.

let game = null;
// Anything that breaks from here on, startup included, shows a reload message instead
// of a frozen canvas, and stops the game's loop rather than failing every frame.
const fatal = createFatalOverlay(document);
const fail = (error) => {
  game?.loop.sleep();
  fatal.show(error);
};
window.addEventListener('error', (event) => {
  if (isOwnError(event, location.origin)) fail(event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => fail(event.reason));

const ratio = () => pixelRatio(window, MAX_RESOLUTION);
const initial = canvasSize(window.innerWidth, window.innerHeight, ratio());

game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: document.body,
  backgroundColor: '#000000',
  banner: false,
  render: { antialias: true },
  // Sound comes with M3; until then Phaser must not open an audio context of its own.
  audio: { noAudio: true },
  // The game's own fixed-step loop needs the real frame times.
  fps: { smoothStep: false },
  // The canvas has `ratio` device pixels per CSS pixel and is shown at its CSS size
  // (see view.js); the platform sizes it. Full screen takes the whole page, so the HTML
  // overlays stay visible.
  scale: {
    mode: Phaser.Scale.NONE,
    width: initial.width,
    height: initial.height,
    zoom: 1 / ratio(),
    fullscreenTarget: document.documentElement,
  },
  scene: [BootScene, PlayScene, UiScene],
});
await new Promise((resolve) => game.events.once(Phaser.Core.Events.READY, resolve));

const platform = new Phaser.Events.EventEmitter();
game.registry.set('platform', platform);
blockBrowserGestures(game.canvas);

// The layout for the window (layout.js) and the camera that shows the view on the
// canvas (view.js); scenes follow the 'layout' event. The two-player frame comes with
// the modes (M6).
const safeAreaInsets = safeAreaReader(document);
function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = ratio();
  const size = canvasSize(w, h, r);
  game.scale.setZoom(1 / r);
  game.scale.resize(size.width, size.height);
  // Exactly the window's CSS size (the zoom alone can be a fraction of a pixel off, and
  // Phaser leaves the style alone when the zoom is 1).
  game.canvas.style.width = `${w}px`;
  game.canvas.style.height = `${h}px`;
  platform.layout = layoutFor(w, h, safeAreaInsets());
  platform.camera = viewCamera(platform.layout, r);
  platform.emit('layout', platform.layout, platform.camera);
}
const queueLayout = watchScreen(window, layout);
layout();

// Paused while the window is unfocused or hidden, the graphics context is lost, or the
// player pressed P (pause.js, as in the Pixi version). Phaser itself stops its loop
// while the page is hidden.
//
// P is read from the DOM: Phaser 4.2.1's keyboard plugin hands a scene every key event
// of the frame again with each new one, so two presses in one frame toggle twice (see
// the M2 report). The game's input, which M3 moves onto Phaser, has to deal with that;
// then P pauses only a run, as in the Pixi version.
const pause = createPause(window, document);
platform.pause = pause;
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyP' && !event.repeat) pause.toggle('manual');
});

// A lost graphics context (common when a phone backgrounds the page) pauses the game
// until Phaser restores it, with its textures; if it does not come back, offer a reload.
const CONTEXT_RESTORE_TIMEOUT_MS = 5000;
const notice = createNotice(document);
let restoreTimer = null;
game.renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, () => {
  pause.hold('graphics', true);
  notice.show('Restoring graphics…');
  restoreTimer = setTimeout(() => fail(new Error('The graphics context was not restored')), CONTEXT_RESTORE_TIMEOUT_MS);
});
game.renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => {
  clearTimeout(restoreTimer);
  notice.hide();
  pause.hold('graphics', false);
});

// Full screen via the button or F, through the Scale Manager, where the browser allows
// it for pages. The home-screen app is already full screen, so it gets neither.
const fullscreen = createPhaserFullscreen(game.scale, {
  onChange: (active) => {
    platform.emit('fullscreen', active);
    queueLayout();
  },
});
platform.fullscreen = fullscreen;
platform.fullscreenButton = fullscreen.supported && !isHomeScreenApp(window);
if (platform.fullscreenButton) {
  const onButton = (event) =>
    inside(FULLSCREEN_HIT, controlsPoint(platform.layout, game.canvas.getBoundingClientRect(), event.clientX, event.clientY));
  bindFullscreenControls(window, game.canvas, fullscreen, { hit: onButton });
}

// Hooks for inspecting and driving the game from the browser console and tests.
if (import.meta.env.DEV) {
  window.__liano = {
    game, engine: 'phaser', platform, pause, fullscreen, fatal,
    get layout() { return platform.layout; },
    get camera() { return platform.camera; },
  };
}
