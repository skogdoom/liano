import Phaser from 'phaser';
import { MAX_RESOLUTION } from '../config.js';
import { FULLSCREEN_HIT, MUTE_HIT, controlsPoint, inside } from '../controls.js';
import { createDriver } from '../driver.js';
import { PhaserFrameClock } from './frameClock.js';
import { createFatalOverlay, createNotice, isOwnError } from '../fatal.js';
import { bindFullscreenControls } from '../fullscreen.js';
import { createInput } from '../input.js';
import { layoutFor } from '../layout.js';
import { ObstaclePrefetch } from '../obstaclePrefetch.js';
import { createPause } from '../pause.js';
import { blockBrowserGestures, isHomeScreenApp, pixelRatio, safeAreaReader, watchScreen } from '../screen.js';
import { Game } from '../sim/game.js';
import { MODES } from '../sim/match.js';
import { World } from '../sim/world.js';
import { FpsMeter } from '../render/fpsMeter.js';
import { createPhaserFullscreen } from './fullscreen.js';
import { phaserKeys, phaserPointers } from './input.js';
import { BootScene, PlayScene, UiScene } from './scenes.js';
import { createPhaserSoundPlayer } from './sound.js';
import { canvasSize, viewCamera } from './view.js';
import { oneTexturePerBatch } from './shaders.js';
import { installObstacleBlur } from './obstacleBlur.js';

// The Phaser version of the game (see PHASER_PLAN.md). The platform holds the layout,
// pause, full screen, input and sound for the scenes (scenes.js); the game runs as in
// the Pixi version (driver.js). The play scene draws the worlds; the UI scene the buttons,
// the HUD, the panels and the debug view.

let game = null;
// Anything that breaks from here on, startup included, shows a reload message instead
// of a frozen canvas, and stops the game's loop rather than failing every frame.
const fatal = createFatalOverlay(document);
let sound = null;
const fail = (error) => {
  game?.loop.sleep();
  sound?.setPaused(true);
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
  // Several fingers each count as a press (2P on one screen), as in the Pixi version.
  input: { activePointers: 4 },
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
oneTexturePerBatch(game.renderer);

const platform = new Phaser.Events.EventEmitter();
game.registry.set('platform', platform);
installObstacleBlur(platform);
blockBrowserGestures(game.canvas);

// Obstacles ahead are generated in a worker (see ObstaclePrefetch).
function createObstacleWorker() {
  try {
    return new Worker(new URL('../obstacleWorker.js', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}
const prefetch = new ObstaclePrefetch(createObstacleWorker());
// The game starts without slipping (G turns it on).
const theGame = new Game({
  slip: false,
  // Split screen's worlds share the match seed, and so the prefetched gaps.
  createWorld: (options) => {
    if (options.seed !== prefetch.seed) prefetch.reset(options.seed);
    return new World({ ...options, makeObstacle: prefetch.makeObstacle, makeBanana: prefetch.makeBanana });
  },
});
platform.game = theGame;

// The layout for the window (layout.js) and the camera that shows the view on the
// canvas (view.js); scenes follow the 'layout' event. The two-player modes use the
// 16:9 frame.
const safeAreaInsets = safeAreaReader(document);
let layoutMode = theGame.mode;
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
  layoutMode = theGame.mode;
  platform.layout = layoutFor(w, h, safeAreaInsets(), { fixed: MODES[theGame.mode].players > 1 });
  platform.camera = viewCamera(platform.layout, r);
  platform.emit('layout', platform.layout, platform.camera);
}
const queueLayout = watchScreen(window, layout);
layout();

// Paused while the window is unfocused or hidden, the graphics context is lost, or the
// player pressed P during a run (pause.js, as in the Pixi version). Phaser itself stops
// its loop while the page is hidden.
const pause = createPause(window, document);
platform.pause = pause;

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

// Sound: the recipes through Phaser's sound manager (sound.js). It starts at the first
// user gesture (browsers block audio before one); later gestures resume it if the
// browser suspended it, or replace a context that stays stuck.
sound = createPhaserSoundPlayer(game.sound);
platform.sound = sound;
// Rendering does not need a gesture; audible playback still waits for unlock().
platform.soundReady = sound.prepare();
for (const type of ['keydown', 'pointerdown', 'pointerup', 'touchend']) {
  window.addEventListener(type, () => sound.unlock(), { capture: true });
}
function toggleMute() {
  sound.setMuted(!sound.muted);
  platform.emit('mute', sound.muted);
}

// The game's input on Phaser's keyboard and pointers (input.js), read through the UI
// scene, which is always running. Presses count only while running, and not just after
// resuming (see pause.js). A tap on the mute button toggles sound instead, and one on
// the full-screen button is handled by its own controls.
const ui = await new Promise((resolve) => platform.once('ui', resolve));
const buttonAt = (hit, event) =>
  inside(hit, controlsPoint(platform.layout, game.canvas.getBoundingClientRect(), event.clientX, event.clientY));
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const input = createInput(phaserKeys(ui.input.keyboard), phaserPointers(ui.input), {
  initialType: coarsePointer ? 'touch' : 'keyboard',
  accepts: () => pause.acceptsInput(),
  intercept: (event) => {
    if (platform.fullscreenButton && buttonAt(FULLSCREEN_HIT, event)) return true;
    if (!buttonAt(MUTE_HIT, event)) return false;
    toggleMute();
    return true;
  },
});
platform.input = input;

// The game, as in the Pixi version (driver.js), once per Phaser step. The two-player
// modes change the frame. D shows the debug view.
const fpsMeter = new FpsMeter();
platform.fpsMeter = fpsMeter;
platform.debug = false;
const frameClock = new PhaserFrameClock();
platform.frameClock = frameClock;
const driver = createDriver({
  game: theGame,
  clock: frameClock,
  input,
  pause,
  sound,
  prefetch,
  // Presses wait for main art, cached sound and resource preparation.
  ready: () => platform.world !== undefined,
  onStep(dt) {
    platform.world?.sync();
    if (theGame.mode !== layoutMode) layout();
    platform.world?.stepCameras(dt);
  },
  onDebugToggle: () => (platform.debug = !platform.debug),
  onMuteToggle: toggleMute,
});
game.events.on(Phaser.Core.Events.STEP, (time, delta) => {
  fpsMeter.tick(performance.now());
  platform.frame = driver.frame(delta);
});

// Hooks for inspecting and driving the game from the browser console and tests.
if (import.meta.env.DEV) {
  window.__liano = {
    app: game, engine: 'phaser', platform, pause, fullscreen, fatal, sound, input, driver,
    get layout() { return platform.layout; },
    get camera() { return platform.camera; },
    get game() { return theGame; },
  };
}

// Record the real update/render loop on devices with the frame readout enabled.
// Kept out of normal play and out of the Pixi version.
if (new URLSearchParams(location.search).get('frames') === '1') {
  const { installFrameTrace } = await import('./frameTrace.js');
  installFrameTrace(game, platform);
}
