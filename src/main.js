import { Application, Container, Graphics } from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT, SIM_DT, MAX_FRAME_DT, DEATH_SHAKE_PX, DEATH_SHAKE_TIME } from './config.js';
import { createFixedStepLoop } from './loop.js';
import { createInput } from './input.js';
import { Game, GameState } from './sim/game.js';
import { createFocusPause } from './pause.js';
import { Overlays } from './render/overlays.js';
import { LianaView } from './render/lianaView.js';
import { MonkeyView } from './render/monkeyView.js';
import { Camera } from './render/camera.js';
import { ObstacleViews } from './render/obstacleViews.js';
import { Hud } from './render/hud.js';
import { DebugOverlay } from './render/debugOverlay.js';
import { Background } from './render/background.js';
import { Shake } from './render/shake.js';

const app = new Application();
await app.init({
  background: 0x000000,
  antialias: true,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
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
window.addEventListener('resize', layout);
layout();

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
root.addChild(hud.view);

const overlays = new Overlays();
root.addChild(overlays.view);

const game = new Game();
const input = createInput(window);
const pause = createFocusPause(window, document);
const shake = new Shake();
let lastState = game.state;
if (import.meta.env.DEV) window.__liano = { app, get game() { return game; } };
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
  // While paused nothing moves: the sim, the monkey's spin, the shake and the pulsing prompts.
  const paused = pause.paused;
  const frameDt = paused ? 0 : Math.min(ticker.deltaMS / 1000, MAX_FRAME_DT);
  loop.advance(frameDt);
  if (lastState === GameState.PLAYING && game.state === GameState.GAME_OVER) {
    shake.trigger(DEATH_SHAKE_PX, DEATH_SHAKE_TIME);
  }
  lastState = game.state;
  shake.update(frameDt);
  scene.position.set(shake.x, shake.y);
  worldLayer.x = -camera.x;
  debugWorldLayer.x = -camera.x;
  background.update(camera.x);
  lianaView.update(game.world.lianas.values(), camera.x);
  monkeyView.update(game.world.monkey, frameDt);
  obstacleViews.update(game.world.obstacles.values());
  hud.update(game);
  overlays.update(game, camera.x, { paused, dt: frameDt });
  debugOverlay.update(game);
});
