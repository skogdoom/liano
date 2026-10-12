import { Background } from '../render/background.js';
import { LianaView, leafLayout } from '../render/lianaView.js';
import { ObstacleViews, pantherBlinks, pantherPlacement } from '../render/obstacleViews.js';
import { HIGH_BELOW_Y, SIM_DT } from '../config.js';
import { createObstacle } from '../sim/generator.js';
import { Liana } from '../sim/liana.js';
import { mixSeed, mulberry32 } from '../sim/rng.js';
import { Art, CATALOG, queueArt } from '../phaser/art.js';
import { BackdropRig, BranchRig, LianaRig } from '../spike/rigs.js';

// M1 spike scenarios (PHASER_PLAN.md, M1): the far backdrop, a branch with a panther and
// some lianas, drawn by today's Pixi views and by the Phaser rigs of pre-rendered pieces.

const SKY = 0x4a8060;

const artFor = (scene, zoom) => new Art(scene.cache.json.get(CATALOG), Art.scaleFor(zoom));

// The first low branch (on a trunk) carrying a panther, over a few seeds.
function pantherBranch() {
  for (let seed = 1; seed < 200; seed++) {
    for (let gap = 1; gap < 200; gap++) {
      const o = createObstacle(seed, gap);
      if (o?.type === 'branch' && o.decoration === 'panther' && o.y >= HIGH_BELOW_Y) return o;
    }
  }
  throw new Error('No low branch with a panther');
}

// A world time when the panther's eyes are shut, and one when they are open.
function pantherTimes(o) {
  const { phase } = pantherPlacement(mulberry32(mixSeed(0xa11a, o.gap)));
  let shut = 0;
  while (!pantherBlinks(shut, phase)) shut += 0.01;
  return { open: 2.3, shut };
}

// Four lianas: at rest, swinging, settling after a release, and swinging with the tip lit.
function lianas() {
  const rest = new Liana(0, 100);
  const swinging = new Liana(1, 300);
  swinging.grab(1);
  for (let i = 0; i < 40; i++) swinging.step(SIM_DT);
  const settling = new Liana(2, 500);
  settling.grab(-1);
  for (let i = 0; i < 70; i++) settling.step(SIM_DT);
  settling.release();
  for (let i = 0; i < 25; i++) settling.step(SIM_DT);
  const lit = new Liana(3, 700);
  lit.grab(1);
  for (let i = 0; i < 100; i++) lit.step(SIM_DT);
  return { all: [rest, swinging, settling, lit], lit };
}

const branchScenario = (id, title, when) => {
  const o = pantherBranch();
  const t = pantherTimes(o)[when];
  return {
    id,
    title,
    width: 360,
    height: 420,
    zooms: [1, 1.5, 2],
    scroll: [o.x - 160, o.y - 100],
    background: SKY,
    pixi(world) {
      const views = new ObstacleViews();
      views.update([o], t, 0xffffff);
      world.addChild(views.view);
    },
    preload: (scene, zoom) => queueArt(scene.load, Art.scaleFor(zoom)),
    phaser(scene, zoom) {
      new BranchRig(scene, artFor(scene, zoom), o).update(t);
    },
  };
};

export const SPIKE_SCENARIOS = [
  {
    id: 'spike.backdrop',
    title: 'The far backdrop layer, by day',
    width: 1280,
    height: 720,
    zooms: [1, 2],
    scroll: [0, -60],
    background: SKY,
    pixi(world) {
      const background = new Background();
      background.far.update(1234);
      world.addChild(background.far.view);
    },
    preload: (scene, zoom) => queueArt(scene.load, Art.scaleFor(zoom)),
    phaser(scene, zoom) {
      new BackdropRig(scene, artFor(scene, zoom), 1280).update(1234);
    },
  },
  {
    id: 'spike.backdropDusk',
    title: 'The far backdrop layer at dusk (tinted)',
    width: 1280,
    height: 720,
    scroll: [0, -60],
    background: SKY,
    pixi(world) {
      const background = new Background();
      background.far.update(4321);
      background.far.view.tint = 0xc88cb4;
      world.addChild(background.far.view);
    },
    preload: (scene, zoom) => queueArt(scene.load, Art.scaleFor(zoom)),
    phaser(scene, zoom) {
      new BackdropRig(scene, artFor(scene, zoom), 1280).update(4321, 0xc88cb4);
    },
  },
  branchScenario('spike.panther', 'A branch on a trunk with a panther', 'open'),
  branchScenario('spike.pantherBlink', 'The same panther blinking', 'shut'),
  {
    id: 'spike.lianas',
    title: 'Lianas at rest, swinging, settling, and with the tip lit',
    width: 800,
    height: 460,
    zooms: [1, 1.5, 2],
    scroll: [0, -30],
    background: SKY,
    pixi(world) {
      const { all, lit } = lianas();
      const view = new LianaView();
      view.update(all, 0, 800, [{ liana: lit, tipTime: 0.05 }]);
      world.addChild(view.view);
    },
    preload: (scene, zoom) => queueArt(scene.load, Art.scaleFor(zoom)),
    phaser(scene, zoom) {
      const { all, lit } = lianas();
      const pieces = artFor(scene, zoom);
      for (const liana of all) new LianaRig(scene, pieces, leafLayout(liana.index)).update(liana, liana === lit);
    },
  },
];
