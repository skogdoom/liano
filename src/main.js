import { Application, Container, Graphics, Text } from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT, SIM_DT, MAX_FRAME_DT } from './config.js';
import { createFixedStepLoop } from './loop.js';
import { createInput } from './input.js';
import { Game, GameState } from './sim/game.js';
import { Overlays } from './render/overlays.js';

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

// Placeholder scene: sky, canopy strip, jungle floor band.
const scene = new Graphics()
  .rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
  .fill(0x2f6b4f)
  .rect(0, 0, SCREEN_WIDTH, 40)
  .fill(0x1c4430)
  .rect(0, SCREEN_HEIGHT - 60, SCREEN_WIDTH, 60)
  .fill(0x16241b);
root.addChild(scene);

const debugText = new Text({
  text: '',
  style: { fontFamily: 'monospace', fontSize: 18, fill: 0xffffff },
});
debugText.position.set(16, 56);
root.addChild(debugText);

const overlays = new Overlays();
root.addChild(overlays.view);

const game = new Game();
const input = createInput(window);
let simSteps = 0;

const loop = createFixedStepLoop({
  dt: SIM_DT,
  maxFrameDt: MAX_FRAME_DT,
  step(dt) {
    if (input.consumePress()) game.press();
    game.step(dt);
    simSteps++;
  },
});

app.ticker.add((ticker) => {
  loop.advance(ticker.deltaMS / 1000);
  overlays.update(game);
  debugText.visible = game.state === GameState.PLAYING;
  debugText.text = `${game.state}  t=${game.stateTime.toFixed(2)}s  steps=${simSteps}`;
});
