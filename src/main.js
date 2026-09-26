import { Application, Container, Graphics } from 'pixi.js';
import {
  SIM_DT,
  MAX_FRAME_DT,
  MAX_RESOLUTION,
  DEATH_SHAKE_PX,
  DEATH_SHAKE_TIME,
} from './config.js';
import { createFixedStepLoop } from './loop.js';
import { createInput } from './input.js';
import { Game, GameState } from './sim/game.js';
import { World } from './sim/world.js';
import { ObstaclePrefetch } from './obstaclePrefetch.js';
import { createPause } from './pause.js';
import { layoutFor, paneLayouts } from './layout.js';
import { MODES, MODE_ORDER } from './sim/match.js';
import { createFullscreen, bindFullscreenControls } from './fullscreen.js';
import { Overlays } from './render/overlays.js';
import { Pane } from './render/pane.js';
import { Hud } from './render/hud.js';
import { DebugOverlay } from './render/debugOverlay.js';
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

// Everything is drawn in the logical view inside `root`, which is scaled to fit the
// window (see layout.js). Black bars on top cover whatever is drawn outside it, when
// the window is too wide even for the widest view (cheaper than a mask, which costs a
// stencil pass and breaks batching).
const root = new Container();
const letterbox = new Graphics();
app.stage.addChild(root, letterbox);

// Safe-area insets (notch, home indicator) in CSS pixels, read from a hidden probe.
const safeAreaProbe = document.createElement('div');
safeAreaProbe.style.cssText =
  'position:fixed;visibility:hidden;pointer-events:none;' +
  'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
document.body.appendChild(safeAreaProbe);
function safeAreaInsets() {
  const style = getComputedStyle(safeAreaProbe);
  const px = (value) => parseFloat(value) || 0;
  return { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) };
}

let current = null; // the current layout
let layoutMode = null; // the mode it was made for
function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  app.renderer.resize(w, h, pixelRatio());
  // The two-player modes use the 16:9 frame.
  current = layoutFor(w, h, safeAreaInsets(), { fixed: MODES[game.mode].players > 1 });
  layoutMode = game.mode;
  const { x, y, scale } = current;
  root.scale.set(scale);
  root.position.set(x, y);
  const right = x + current.view.width * scale;
  const bottom = y + current.view.height * scale;
  letterbox
    .clear()
    .rect(0, 0, w, y)
    .rect(0, bottom, w, h - bottom)
    .rect(0, y, x, bottom - y)
    .rect(right, y, w - right, bottom - y)
    .fill(0x000000);
  paneLayouts(current, panes.length).forEach((pane, i) => panes[i].resize(pane));
  hud.resize(current);
  overlays.resize(current);
  controls.position.set(current.insets.left, current.insets.top);
  controls.scale.set(current.ui);
  debugOverlay.screenView.position.set(current.insets.left, current.insets.top);
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

// Block browser gestures on the game: double-tap zoom, iOS pinch, and the
// long-press menu.
for (const type of ['dblclick', 'gesturestart', 'contextmenu']) {
  app.canvas.addEventListener(type, (event) => event.preventDefault());
}
// iOS Safari still acts on quick taps (in landscape it briefly shifts the page under
// the tab bar) unless the touch events themselves are cancelled; pointer events,
// which the game reads, arrive before them and are unaffected.
for (const type of ['touchstart', 'touchmove', 'touchend']) {
  app.canvas.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}

// Back to front: the panes (one per world: the sky and parallax layers, the world,
// the canopy strip and floor band), then HUD and overlays.
const paneLayer = new Container();
root.addChild(paneLayer);
const panes = [];
const debugOverlay = new DebugOverlay();
root.addChild(debugOverlay.screenView);

const hud = new Hud();
// The buttons, top-left inside the safe area; enlarged with the layout's `ui` scale.
const controls = new Container();
const muteButton = new MuteButton();
const fullscreenButton = new FullscreenButton();
controls.addChild(muteButton.view, fullscreenButton.view);
root.addChild(hud.view, controls);

const overlays = new Overlays();
root.addChild(overlays.view);

// Obstacles ahead are generated in a worker (see ObstaclePrefetch).
function createObstacleWorker() {
  try {
    return new Worker(new URL('./obstacleWorker.js', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}
const prefetch = new ObstaclePrefetch(createObstacleWorker());
const game = new Game({
  // Split screen's worlds share the match seed, and so the prefetched gaps.
  createWorld: (options) => {
    if (options.seed !== prefetch.seed) prefetch.reset(options.seed);
    return new World({ ...options, makeObstacle: prefetch.makeObstacle, makeBanana: prefetch.makeBanana });
  },
});
const pause = createPause(window, document);
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

// Position of a pointer event in the buttons' coordinates (see `controls`).
function controlsPoint(event) {
  const rect = app.canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left - root.x) / root.scale.x;
  const y = (event.clientY - rect.top - root.y) / root.scale.y;
  return { x: (x - controls.x) / controls.scale.x, y: (y - controls.y) / controls.scale.y };
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
  const p = controlsPoint(event);
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
    const p = controlsPoint(event);
    if (!muteButton.contains(p.x, p.y)) return false;
    toggleMute();
    return true;
  },
});
const shake = new Shake();
let lastState = game.state;

// A pane per world; rebuilt when the mode or match changes the worlds. In split screen
// pane p shows player p; otherwise the one pane shows every player.
let paneWorlds = null;
function syncPanes() {
  if (paneWorlds && paneWorlds.length === game.worlds.length && paneWorlds.every((w, i) => w === game.worlds[i])) return;
  const relayout = !paneWorlds || paneWorlds.length !== game.worlds.length;
  while (panes.length < game.worlds.length) {
    const pane = new Pane();
    panes.push(pane);
    paneLayer.addChild(pane.view);
  }
  for (const pane of panes.splice(game.worlds.length)) pane.view.destroy({ children: true });
  game.worlds.forEach((world, i) => {
    const players = game.worlds.length > 1 ? [i] : world.monkeys.map((_, m) => m);
    panes[i].setWorld(world, players);
  });
  // The debug overlay draws over player 1's world.
  panes[0].overlay.addChild(debugOverlay.worldView);
  paneWorlds = [...game.worlds];
  if (relayout) layout();
}
syncPanes();

// Action roles, in the order the loop applies them within a step (see KEYS).
const ROLES = ['start', 'primary', 'p1', 'p2'];

const loop = createFixedStepLoop({
  dt: SIM_DT,
  maxFrameDt: MAX_FRAME_DT,
  step(dt) {
    const pick = input.consumeModePick();
    if (pick) game.selectMode(MODE_ORDER[pick - 1]);
    for (const role of ROLES) {
      // A press that changes the state (starts or restarts a run) is the step's last.
      if (input.consumePress(role) && game.press(role)) {
        input.clear();
        break;
      }
    }
    game.step(dt);
    syncPanes();
    // The two-player modes use a different frame.
    if (game.mode !== layoutMode) {
      layoutMode = game.mode;
      layout();
    }
    for (const pane of panes) pane.stepCamera(dt);
  },
});

function frame(ticker) {
  if (input.consumeDebugToggle()) debugOverlay.toggle();
  if (input.consumeMuteToggle()) toggleMute();
  // While paused nothing moves: the sim, the monkey's spin, the shake and the pulsing prompts.
  const paused = pause.paused;
  if (paused) input.clear(); // a press made just before pausing must not act on resume
  const frameDt = paused ? 0 : Math.min(ticker.deltaMS / 1000, MAX_FRAME_DT);
  loop.advance(frameDt);
  prefetch.update(game.worlds.map((w) => w.obstacles));
  if (lastState === GameState.PLAYING && game.state === GameState.RESULTS && !reducedMotion.matches) {
    shake.trigger(DEATH_SHAKE_PX, DEATH_SHAKE_TIME);
  }
  lastState = game.state;
  sound.setPaused(paused);
  const events = game.takeEvents();
  for (const recipe of soundsFor(events)) sound.play(recipe);
  shake.update(frameDt);
  panes.forEach((pane, i) => pane.update(events.filter((e) => e.pane === i), frameDt, shake));
  hud.update(game);
  overlays.update(game, panes[0].camera.x, { pauseReason: pause.reason, inputType: input.lastType, dt: frameDt });
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
  const views = { panes, overlays, hud, debugOverlay, loop };
  window.__liano = {
    app, pause, input, sound, fullscreen, fullscreenButton, fatal, views,
    get lianaView() { return panes[0].lianaView; },
    get camera() { return panes[0].camera; },
    get layout() { return current; },
    get game() { return game; },
  };
}
