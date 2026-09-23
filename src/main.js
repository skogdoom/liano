import { Application, Container, Graphics } from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT, SIM_DT, MAX_FRAME_DT } from './config.js';
import { createFixedStepLoop } from './loop.js';
import { createInput } from './input.js';
import { Game } from './sim/game.js';
import { Overlays } from './render/overlays.js';
import { LianaView } from './render/lianaView.js';
import { MonkeyView } from './render/monkeyView.js';
import { Camera } from './render/camera.js';
import { ObstacleViews } from './render/obstacleViews.js';
import { Hud } from './render/hud.js';
import { DebugOverlay } from './render/debugOverlay.js';
import { Background } from './render/background.js';

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
const background = new Background();
root.addChild(background.back);

const worldLayer = new Container();
const lianaView = new LianaView();
const monkeyView = new MonkeyView();
const obstacleViews = new ObstacleViews();
const debugOverlay = new DebugOverlay();
worldLayer.addChild(obstacleViews.view, lianaView.view, monkeyView.view);
root.addChild(worldLayer, background.front);

// The debug overlay goes over everything in the world, including the floor band.
const debugWorldLayer = new Container();
debugWorldLayer.addChild(debugOverlay.worldView);
root.addChild(debugWorldLayer, debugOverlay.screenView);

const hud = new Hud();
root.addChild(hud.view);

const overlays = new Overlays();
root.addChild(overlays.view);

const game = new Game();
const input = createInput(window);
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
  const frameDt = Math.min(ticker.deltaMS / 1000, MAX_FRAME_DT);
  loop.advance(frameDt);
  worldLayer.x = -camera.x;
  debugWorldLayer.x = -camera.x;
  background.update(camera.x);
  lianaView.update(game.world.lianas.values(), camera.x);
  monkeyView.update(game.world.monkey, frameDt);
  obstacleViews.update(game.world.obstacles.values());
  hud.update(game);
  overlays.update(game, camera.x);
  debugOverlay.update(game);
});
