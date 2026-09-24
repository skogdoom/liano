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
import { SoundPlayer } from './audio/player.js';
import { soundActions } from './audio/sounds.js';

const app = new Application();
await app.init({
  background: 0x000000,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
  width: window.innerWidth,
  height: window.innerHeight,
});
document.body.appendChild(app.canvas);

// Everything is drawn in 1280x720 logical space inside `root`, which is scaled
// to fit the window and centered; the uncovered area is the letterbox.
const root = new Container();
const clip = new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(0xffffff);
root.addChild(clip);
root.mask = clip;
app.stage.addChild(root);

function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  app.renderer.resize(w, h);
  const scale = Math.min(w / SCREEN_WIDTH, h / SCREEN_HEIGHT);
  root.scale.set(scale);
  root.position.set((w - SCREEN_WIDTH * scale) / 2, (h - SCREEN_HEIGHT * scale) / 2);
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
root.addChild(hud.view, muteButton.view);

const overlays = new Overlays();
root.addChild(overlays.view);

const game = new Game();
const pause = createPause(window, document, {
  portrait: window.matchMedia('(orientation: portrait) and (pointer: coarse)'),
});
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

// Presses count only while running, and not just after resuming (see pause.js). A
// tap on the mute button toggles sound instead.
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const input = createInput(window, app.canvas, {
  initialType: coarsePointer ? 'touch' : 'keyboard',
  accepts: () => pause.acceptsInput(),
  intercept: (event) => {
    const p = logicalPoint(event);
    if (!muteButton.contains(p.x, p.y)) return false;
    toggleMute();
    return true;
  },
});
const shake = new Shake();
let lastState = game.state;
if (import.meta.env.DEV) window.__liano = { app, pause, input, sound, get game() { return game; } };
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

app.ticker.add((ticker) => {
  if (input.consumeDebugToggle()) debugOverlay.toggle();
  if (input.consumeMuteToggle()) toggleMute();
  // While paused nothing moves: the sim, the monkey's spin, the shake and the pulsing prompts.
  const paused = pause.paused;
  if (paused) input.consumePress(); // a press made just before pausing must not act on resume
  const frameDt = paused ? 0 : Math.min(ticker.deltaMS / 1000, MAX_FRAME_DT);
  loop.advance(frameDt);
  if (lastState === GameState.PLAYING && game.state === GameState.GAME_OVER) {
    shake.trigger(DEATH_SHAKE_PX, DEATH_SHAKE_TIME);
  }
  lastState = game.state;
  sound.setPaused(paused);
  for (const action of soundActions(game.takeEvents())) {
    if (action.play) sound.play(action.play);
    else sound.stop(action.stop);
  }
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
});
