import { Application, Container, Graphics } from 'pixi.js';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  SIM_DT,
  MAX_FRAME_DT,
  MAX_RESOLUTION,
  DEATH_SHAKE_PX,
  DEATH_SHAKE_TIME,
} from './config.js';
import { createFixedStepLoop } from './loop.js';
import { createInput } from './input.js';
import { Game, GameState } from './sim/game.js';
import { createPause } from './pause.js';
import { createFullscreen, bindFullscreenControls } from './fullscreen.js';
import { Overlays } from './render/overlays.js';
import { LianaView } from './render/lianaView.js';
import { MonkeyView } from './render/monkeyView.js';
import { Camera } from './render/camera.js';
import { ObstacleViews } from './render/obstacleViews.js';
import { Hud } from './render/hud.js';
import { DebugOverlay } from './render/debugOverlay.js';
import { Background } from './render/background.js';
import { Shake } from './render/shake.js';
import { MuteButton } from './render/muteButton.js';
import { FullscreenButton } from './render/fullscreenButton.js';
import { SoundPlayer } from './audio/player.js';
import { soundsFor } from './audio/sounds.js';
import { createFatalOverlay, createNotice, isOwnError } from './fatal.js';

// Anything that breaks from here on, startup included, shows a reload message
// instead of a frozen canvas.
const fatal = createFatalOverlay(document);
window.addEventListener('error', (event) => {
  if (isOwnError(event, location.origin)) fatal.show(event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => fatal.show(event.reason));

const pixelRatio = () => Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION);

const app = new Application();
await app.init({
  // WebGPU support is still uneven on mobile browsers.
  preference: 'webgl',
  background: 0x000000,
  antialias: true,
  autoDensity: true,
  resolution: pixelRatio(),
  width: window.innerWidth,
  height: window.innerHeight,
});
document.body.appendChild(app.canvas);

// Everything is drawn in 1280x720 logical space inside `root`, which is scaled
// to fit the window and centered. Black bars on top cover whatever is drawn outside
// it (cheaper than a mask, which costs a stencil pass and breaks batching).
const root = new Container();
const letterbox = new Graphics();
app.stage.addChild(root, letterbox);

function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  app.renderer.resize(w, h, pixelRatio());
  const scale = Math.min(w / SCREEN_WIDTH, h / SCREEN_HEIGHT);
  const x = (w - SCREEN_WIDTH * scale) / 2;
  const y = (h - SCREEN_HEIGHT * scale) / 2;
  root.scale.set(scale);
  root.position.set(x, y);
  const right = x + SCREEN_WIDTH * scale;
  const bottom = y + SCREEN_HEIGHT * scale;
  letterbox
    .clear()
    .rect(0, 0, w, y)
    .rect(0, bottom, w, h - bottom)
    .rect(0, y, x, bottom - y)
    .rect(right, y, w - right, bottom - y)
    .fill(0x000000);
}
// Re-layout on window resizes, rotation, and the iOS address bar showing or hiding,
// at most once per frame.
let layoutQueued = false;
function queueLayout() {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => {
    layoutQueued = false;
    layout();
  });
}
window.addEventListener('resize', queueLayout);
window.addEventListener('orientationchange', queueLayout);
window.visualViewport?.addEventListener('resize', queueLayout);
// The pixel ratio can change without a resize (a window moved to another screen).
function watchPixelRatio() {
  window
    .matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    .addEventListener('change', () => (queueLayout(), watchPixelRatio()), { once: true });
}
watchPixelRatio();
layout();

// Block browser gestures on the game: double-tap zoom, iOS pinch, and the
// long-press menu.
for (const type of ['dblclick', 'gesturestart', 'contextmenu']) {
  app.canvas.addEventListener(type, (event) => event.preventDefault());
}

// Back to front: sky and parallax layers, the world (scrolled by the camera), the
// canopy strip and floor band, then HUD and overlays.
// Everything but the HUD and overlays sits in `scene`, which the death shake moves.
const scene = new Container();
root.addChild(scene);
const background = new Background();
scene.addChild(background.back);

const worldLayer = new Container();
const lianaView = new LianaView();
const monkeyView = new MonkeyView();
const obstacleViews = new ObstacleViews();
const debugOverlay = new DebugOverlay();
worldLayer.addChild(obstacleViews.view, lianaView.view, monkeyView.view);
scene.addChild(worldLayer, background.front);

// The debug overlay goes over everything in the world, including the floor band.
const debugWorldLayer = new Container();
debugWorldLayer.addChild(debugOverlay.worldView);
scene.addChild(debugWorldLayer);
root.addChild(debugOverlay.screenView);

const hud = new Hud();
const muteButton = new MuteButton();
const fullscreenButton = new FullscreenButton();
root.addChild(hud.view, muteButton.view, fullscreenButton.view);

const overlays = new Overlays();
root.addChild(overlays.view);

const game = new Game();
const pause = createPause(window, document, {
  portrait: window.matchMedia('(orientation: portrait) and (pointer: coarse)'),
});
// A lost graphics context (common when a phone backgrounds the page) pauses the game
// until Pixi restores it; if it does not come back, offer a reload.
const CONTEXT_RESTORE_TIMEOUT_MS = 5000;
const notice = createNotice(document);
let restoreTimer = null;
app.canvas.addEventListener('webglcontextlost', () => {
  pause.hold('graphics', true);
  notice.show('Restoring graphics…');
  restoreTimer = setTimeout(() => fatal.show(new Error('The graphics context was not restored')), CONTEXT_RESTORE_TIMEOUT_MS);
});
app.canvas.addEventListener('webglcontextrestored', () => {
  clearTimeout(restoreTimer);
  notice.hide();
  pause.hold('graphics', false);
});

// Screen shake is off for players who ask for reduced motion.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Sound starts at the first user gesture (browsers block audio before one); later
// gestures resume it if the browser suspended it.
const sound = new SoundPlayer();
for (const type of ['keydown', 'pointerdown', 'pointerup', 'touchend']) {
  window.addEventListener(type, () => sound.unlock(), { capture: true });
}
function toggleMute() {
  sound.setMuted(!sound.muted);
  muteButton.update(sound.muted);
}

// Position of a pointer event in the 1280×720 logical space.
function logicalPoint(event) {
  const rect = app.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - root.x) / root.scale.x,
    y: (event.clientY - rect.top - root.y) / root.scale.y,
  };
}

// Full screen via the button or F, where the browser allows it for pages. The
// home-screen app is already full screen, so it gets neither.
const homeScreenApp =
  window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
  navigator.standalone === true;
const fullscreen = createFullscreen(document, {
  onChange: (active) => {
    fullscreenButton.update(active);
    queueLayout();
  },
});
fullscreenButton.view.visible = fullscreen.supported && !homeScreenApp;
const onFullscreenButton = (event) => {
  const p = logicalPoint(event);
  return fullscreenButton.contains(p.x, p.y);
};
if (fullscreenButton.view.visible) {
  bindFullscreenControls(window, app.canvas, fullscreen, { hit: onFullscreenButton });
}

// Presses count only while running, and not just after resuming (see pause.js). A
// tap on the mute button toggles sound instead, and one on the fullscreen button is
// handled by its own controls.
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const input = createInput(window, app.canvas, {
  initialType: coarsePointer ? 'touch' : 'keyboard',
  accepts: () => pause.acceptsInput(),
  intercept: (event) => {
    if (onFullscreenButton(event)) return true;
    const p = logicalPoint(event);
    if (!muteButton.contains(p.x, p.y)) return false;
    toggleMute();
    return true;
  },
});
const shake = new Shake();
let lastState = game.state;
const camera = new Camera(game.world.monkey.x);
let cameraWorld = game.world;

const loop = createFixedStepLoop({
  dt: SIM_DT,
  maxFrameDt: MAX_FRAME_DT,
  step(dt) {
    if (input.consumePress()) game.press();
    game.step(dt);
    if (game.world !== cameraWorld) {
      cameraWorld = game.world;
      camera.reset(game.world.monkey.x);
    }
    // Hold the camera still once the run is over.
    if (game.world.alive) camera.update(game.world.monkey.x, dt);
  },
});

function frame(ticker) {
  if (input.consumeDebugToggle()) debugOverlay.toggle();
  if (input.consumeMuteToggle()) toggleMute();
  // While paused nothing moves: the sim, the monkey's spin, the shake and the pulsing prompts.
  const paused = pause.paused;
  if (paused) input.consumePress(); // a press made just before pausing must not act on resume
  const frameDt = paused ? 0 : Math.min(ticker.deltaMS / 1000, MAX_FRAME_DT);
  loop.advance(frameDt);
  if (lastState === GameState.PLAYING && game.state === GameState.GAME_OVER && !reducedMotion.matches) {
    shake.trigger(DEATH_SHAKE_PX, DEATH_SHAKE_TIME);
  }
  lastState = game.state;
  sound.setPaused(paused);
  for (const recipe of soundsFor(game.takeEvents())) sound.play(recipe);
  shake.update(frameDt);
  scene.position.set(shake.x, shake.y);
  worldLayer.x = -camera.x;
  debugWorldLayer.x = -camera.x;
  background.update(camera.x);
  lianaView.update(game.world.lianas.values(), camera.x);
  monkeyView.update(game.world.monkey, frameDt);
  obstacleViews.update(game.world.obstacles.values());
  hud.update(game);
  overlays.update(game, camera.x, { pauseReason: pause.reason, inputType: input.lastType, dt: frameDt });
  debugOverlay.update(game);
}

// Stop at the first error rather than failing every frame.
app.ticker.add((ticker) => {
  try {
    frame(ticker);
  } catch (error) {
    app.ticker.stop();
    sound.setPaused(true);
    fatal.show(error);
  }
});

// Hooks for inspecting and driving the game from the browser console and tests.
if (import.meta.env.DEV) {
  const views = { lianaView, obstacleViews, monkeyView, background, overlays, hud, debugOverlay, loop };
  window.__liano = { app, pause, input, sound, fullscreen, fullscreenButton, lianaView, fatal, views, get game() { return game; } };
}
