// Dumps what the Pixi views draw, for checking that a refactor of the drawing code
// changes nothing (PHASER_PLAN.md, M4): every obstacle kind, decoration, look and support
// at a few times and tints, the panes in each mode and state, the HUD and the overlays.
// Writes the dump to the file given (default: dump-views.json in the working folder) and
// prints a hash per section; run before and after a change and compare.
//   node --import ./scripts/lib/json.mjs scripts/dev/dump-views.mjs [out.json]
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { BrowserAdapter, DOMAdapter, Graphics, Text } from 'pixi.js';
import { SIM_DT } from '../../src/config.js';
import { layoutFor, paneLayouts } from '../../src/layout.js';
import { ObstacleViews } from '../../src/render/obstacleViews.js';
import { Pane } from '../../src/render/pane.js';
import { Hud } from '../../src/render/hud.js';
import { Overlays } from '../../src/render/overlays.js';
import { STAGE_TINTS } from '../../src/render/background.js';
import { createObstacle } from '../../src/sim/generator.js';
import { BRANCH_DECORATIONS, MOVING_TYPES, Obstacle } from '../../src/sim/obstacle.js';
import { Game } from '../../src/sim/game.js';

// Node has no canvas to measure text with: a stand-in measures by the number of
// characters, which is enough to compare the layout before and after a change.
const fakeContext = () => ({
  font: '10px sans-serif',
  measureText(text) {
    const size = parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
    return { width: text.length * size * 0.55, actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.2, fontBoundingBoxAscent: size * 0.8, fontBoundingBoxDescent: size * 0.2 };
  },
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  fillText() {},
  strokeText() {},
  clearRect() {},
  fillRect() {},
  save() {},
  restore() {},
  scale() {},
  setTransform() {},
});
DOMAdapter.set({
  ...BrowserAdapter,
  createCanvas: (width = 1, height = 1) => ({ width, height, style: {}, getContext: fakeContext }),
  getCanvasRenderingContext2D: () => function CanvasRenderingContext2D() {},
});

// Deterministic randomness for anything the views draw at random.
let seed = 1;
Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const round = (v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);
const numbers = (value) => JSON.parse(JSON.stringify(value, (_, v) => round(v)));

function graphics(g) {
  return g.context.instructions.map(({ action, data }) => {
    const { color, alpha, width, cap, join, alignment } = data.style;
    return {
      action,
      style: numbers({ color, alpha, width, cap, join, alignment }),
      path: numbers(data.path.instructions.map((i) => [i.action, ...i.data.filter((d) => typeof d === 'number' || Array.isArray(d))])),
    };
  });
}

function node(n) {
  const out = numbers({
    kind: n.constructor.name,
    x: n.x,
    y: n.y,
    sx: n.scale.x,
    sy: n.scale.y,
    r: n.rotation,
    a: n.alpha,
    visible: n.visible,
    tint: n.tint,
    blend: n.blendMode,
  });
  if (n instanceof Graphics) out.g = graphics(n);
  if (n instanceof Text) {
    const { fill, fontSize, fontWeight, stroke, dropShadow } = n.style;
    out.text = numbers({ text: n.text, fill, fontSize, fontWeight, stroke: stroke?.color ?? stroke, shadow: Boolean(dropShadow) });
  }
  out.children = n.children.map(node);
  return out;
}

const sections = {};

// Obstacles: every kind and decoration, hanging and standing, at two scales and a few
// gaps; temples in each look by day and by night; moving ones at a few times.
const statics = [];
for (const scale of [1, 1.3]) {
  for (const gap of [1, 2, 3, 7, 11, 19]) {
    for (const y of [200, 320]) {
      for (const decoration of [null, ...BRANCH_DECORATIONS]) statics.push(new Obstacle(gap, 'branch', 640, y, null, scale, decoration));
      for (const type of ['thornBush', 'rock', 'beehive']) statics.push(new Obstacle(gap, type, 640, y, null, scale));
    }
  }
  for (let variant = 0; variant < 4; variant++) statics.push(new Obstacle(5, 'temple', 640, 330, null, scale, null, variant));
}
const moving = [];
for (const type of MOVING_TYPES) {
  let found = 0;
  for (let s = 1; s < 40 && found < 3; s++) {
    for (let gap = 1; gap < 300 && found < 3; gap++) {
      const o = createObstacle(s, gap);
      if (o?.type === type) {
        moving.push(o);
        found++;
      }
    }
  }
}
for (const [name, list] of [['obstacles.static', statics], ['obstacles.moving', moving]]) {
  const frames = [];
  for (const tint of [STAGE_TINTS[0], STAGE_TINTS[3]]) {
    for (const t of [0, 1.37, 3.91]) {
      for (const o of list) o.setTime?.(t);
      const views = new ObstacleViews();
      views.update(list, t, tint);
      frames.push(node(views.view));
    }
  }
  sections[name] = frames;
}

// The panes, HUD and overlays through a game in each mode: the title, a run, a fall and
// the results.
function scene(mode, width, height) {
  seed = 7;
  const game = new Game({ slip: false });
  game.selectMode(mode);
  const layout = layoutFor(width, height, undefined, { fixed: mode !== 'solo' });
  const hud = new Hud();
  const overlays = new Overlays();
  hud.resize(layout);
  overlays.resize(layout);
  const panes = [];
  const frames = [];
  const sync = () => {
    while (panes.length < game.worlds.length) panes.push(new Pane());
    panes.length = game.worlds.length;
    game.worlds.forEach((world, i) => panes[i].setWorld(world, game.worlds.length > 1 ? [i] : world.monkeys.map((_, m) => m), game.sharedView?.camera));
    paneLayouts(layout, panes.length, mode === 'shared' ? 0.75 : 1).forEach((p, i) => panes[i].resize(p));
  };
  const run = (steps, press = null) => {
    if (press) game.press(press);
    for (let i = 0; i < steps; i++) {
      game.step(SIM_DT);
      sync();
      for (const pane of panes) pane.stepCamera(SIM_DT);
    }
    const events = game.takeEvents();
    panes.forEach((pane, i) => pane.update(events.filter((e) => e.pane === i), 1 / 60, true, i === 0 ? game.shadowFrame() : null, 0.5));
    hud.update(game);
    overlays.update(game, panes[0].camera.x, { pauseReason: null, inputType: 'keyboard', dt: 1 / 60 });
    frames.push({ state: game.state, panes: panes.map((p) => node(p.view)), hud: node(hud.view), overlays: node(overlays.view) });
  };
  sync();
  run(30);
  run(90, mode === 'solo' ? 'primary' : 'start');
  run(60, mode === 'solo' ? 'primary' : 'p1');
  run(600);
  return frames;
}
sections['scene.solo'] = scene('solo', 1280, 720);
sections['scene.solo.portrait'] = scene('solo', 390, 844);
sections['scene.shared'] = scene('shared', 1280, 720);
sections['scene.split'] = scene('split', 1280, 720);

const out = process.argv[2] ?? 'dump-views.json';
writeFileSync(out, JSON.stringify(sections));
for (const [name, value] of Object.entries(sections)) {
  console.log(name.padEnd(22), createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16));
}
