import { LIANA_SPACING, SIM_DT } from '../config.js';
import { CANOPY_BOTTOM, FLOOR_Y } from '../views/backdrop.js';
import { Art, CATALOG, queueArt } from '../phaser/art.js';
import { LianaSetRig } from '../phaser/world/lianas.js';
import { MonkeyRig } from '../phaser/world/monkey.js';
import { ShadowRig } from '../phaser/world/shadow.js';
import { LIANA_PALETTES, LianaView } from '../render/lianaView.js';
import { MonkeyView, PALETTES } from '../render/monkeyView.js';
import { ShadowView } from '../render/shadowView.js';
import { Liana } from '../sim/liana.js';
import { MonkeyState } from '../sim/monkey.js';
import { BRANCH_DECORATIONS, Obstacle } from '../sim/obstacle.js';
import { ObstacleLayer } from '../phaser/world/obstacleLayer.js';
import { ObstacleViews } from '../render/obstacleViews.js';

// M5 scenarios (PHASER_PLAN.md): the world as the Pixi views draw it and as the Phaser
// rigs draw it from the pre-rendered pieces, part by part.

const SKY = 0x4a8060;
const artFor = (scene, zoom) => new Art(scene.cache.json.get(CATALOG), Art.scaleFor(zoom));
const withArt = (scenario) => ({ zooms: [1, 2], background: SKY, preload: (scene, zoom) => queueArt(scene.load, Art.scaleFor(zoom)), ...scenario });

// Lianas in each state: at rest, swinging, settling after a release, and swinging with
// the tip lit; `dx` apart from x0.
function lianas(x0 = 100, dx = 200, offset = 0) {
  const rest = new Liana(offset, x0);
  const swinging = new Liana(offset + 1, x0 + dx);
  swinging.grab(1);
  for (let i = 0; i < 40; i++) swinging.step(SIM_DT);
  const settling = new Liana(offset + 2, x0 + 2 * dx);
  settling.grab(-1);
  for (let i = 0; i < 70; i++) settling.step(SIM_DT);
  settling.release();
  for (let i = 0; i < 25; i++) settling.step(SIM_DT);
  const lit = new Liana(offset + 3, x0 + 3 * dx);
  lit.grab(1);
  for (let i = 0; i < 100; i++) lit.step(SIM_DT);
  return { all: [rest, swinging, settling, lit], lit, swinging };
}

// Monkeys in each pose: hanging (facing either way), flying up and down, and fallen (its
// body spun), in both furs.
function monkeys() {
  const hangingOn = (dir, angle, angularVelocity) => ({ swingDir: dir, angle, angularVelocity });
  return [
    { player: 0, monkey: { x: 80, y: 120, vx: 0, vy: 0, state: MonkeyState.HANGING, liana: hangingOn(1, 0.4, 1.2) } },
    { player: 1, monkey: { x: 200, y: 120, vx: 0, vy: 0, state: MonkeyState.HANGING, liana: hangingOn(-1, -0.6, -0.5) } },
    { player: 0, monkey: { x: 320, y: 120, vx: 300, vy: -200, state: MonkeyState.AIRBORNE } },
    { player: 1, monkey: { x: 440, y: 120, vx: -250, vy: 350, state: MonkeyState.AIRBORNE } },
    { player: 0, monkey: { x: 560, y: 120, vx: 0, vy: 0, state: MonkeyState.DEAD }, dt: 0.37 },
  ];
}

// Static obstacles of one kind (and decoration): hanging high from the canopy and
// standing low on the floor, at the first stage's scale and the largest, on different
// gaps (each picks its own variety), seen at world time `t`. Only what the game can show:
// below the canopy strip and above the floor, which are drawn over the world (the vines
// start under one and the trunks end under the other).
const OBSTACLE_SPACING = 300;
function obstacleRow(type, decoration = null) {
  const row = [];
  for (const [i, [y, scale]] of [[200, 1], [330, 1], [190, 1.3], [340, 1.3]].entries()) {
    row.push(new Obstacle(i + 3, type, 150 + i * OBSTACLE_SPACING, y, null, scale, decoration));
  }
  return row;
}
const obstacleScenario = (id, title, type, decoration, t = 1.37) =>
  withArt({
    id,
    title,
    width: 4 * OBSTACLE_SPACING,
    scroll: [0, CANOPY_BOTTOM],
    height: FLOOR_Y - CANOPY_BOTTOM,
    pixi(world) {
      const views = new ObstacleViews();
      views.update(obstacleRow(type, decoration), t);
      world.addChild(views.view);
    },
    phaser(scene, zoom) {
      const layer = new ObstacleLayer(scene, artFor(scene, zoom));
      layer.update(obstacleRow(type, decoration), t);
      scene.add.existing(layer.view);
    },
  });

export const WORLD_SCENARIOS = [
  withArt({
    id: 'world.monkeys',
    title: 'Monkeys hanging, flying and fallen, in both furs',
    width: 640,
    height: 220,
    scroll: [0, 20],
    pixi(world) {
      for (const { player, monkey, dt = 0 } of monkeys()) {
        const view = new MonkeyView(PALETTES[player]);
        view.update(monkey, 0);
        view.update(monkey, dt);
        world.addChild(view.view);
      }
    },
    phaser(scene, zoom) {
      const art = artFor(scene, zoom);
      for (const { player, monkey, dt = 0 } of monkeys()) {
        const rig = new MonkeyRig(scene, art, ['p1', 'p2'][player]);
        rig.update(monkey, 0);
        rig.update(monkey, dt);
        scene.add.existing(rig.view);
      }
    },
  }),
  withArt({
    id: 'world.lianas',
    // As far apart as in the game (LIANA_SPACING): a set's lianas never cross, which the
    // rig relies on (its ropes and its leaves are drawn in a layer each).
    title: 'Lianas in shared screen: green and golden pairs bowing apart, swinging, settling and lit',
    width: 2300,
    height: 470,
    scroll: [0, -30],
    pixi(world) {
      const { all, lit } = lianas(100, LIANA_SPACING);
      LIANA_PALETTES.forEach((palette, i) => {
        const view = new LianaView(palette, i === 0 ? -1 : 1);
        view.update(all, 0, 2300, [{ liana: lit, tipTime: 0.05 }]);
        world.addChild(view.view);
      });
    },
    phaser(scene, zoom) {
      const { all, lit } = lianas(100, LIANA_SPACING);
      const art = artFor(scene, zoom);
      ['green', 'gold'].forEach((colouring, i) => {
        const set = new LianaSetRig(scene, art, colouring, i === 0 ? -1 : 1);
        set.update(all, 0, 2300, [{ liana: lit, tipTime: 0.05 }]);
        scene.add.existing(set.view);
      });
    },
  }),
  withArt({
    id: 'world.lianasBetween',
    title: 'A swinging liana drawn between two sim steps',
    width: 400,
    height: 470,
    scroll: [0, -30],
    pixi(world) {
      const { swinging } = lianas(200);
      swinging.prevAngle = swinging.angle - 0.08;
      const view = new LianaView();
      view.update([swinging], 0, 400, [], 0.4);
      world.addChild(view.view);
    },
    phaser(scene, zoom) {
      const { swinging } = lianas(200);
      swinging.prevAngle = swinging.angle - 0.08;
      const set = new LianaSetRig(scene, artFor(scene, zoom));
      set.update([swinging], 0, 400, [], 0.4);
      scene.add.existing(set.view);
    },
  }),
  withArt({
    id: 'world.shadow',
    title: 'The shadow monkey on its lianas, one fading in',
    width: 560,
    height: 470,
    scroll: [0, -30],
    pixi(world) {
      const { all, swinging } = lianas(100, 160);
      const view = new ShadowView();
      view.update({ x: swinging.x + 120, y: 330, vx: 0, vy: 0, state: MonkeyState.HANGING, liana: swinging, lianas: all.map((liana, i) => ({ liana, alpha: i === 3 ? 0.4 : 1 })) }, 0);
      world.addChild(view.view);
    },
    phaser(scene, zoom) {
      const { all, swinging } = lianas(100, 160);
      const rig = new ShadowRig(scene, artFor(scene, zoom));
      rig.update({ x: swinging.x + 120, y: 330, vx: 0, vy: 0, state: MonkeyState.HANGING, liana: swinging, lianas: all.map((liana, i) => ({ liana, alpha: i === 3 ? 0.4 : 1 })) }, 0);
      scene.add.existing(rig.view);
    },
  }),
  obstacleScenario('world.branches', 'Bare branches, hanging on vines and standing on trunks', 'branch', null),
  obstacleScenario('world.thornBushes', 'Thorn bushes, hanging and standing', 'thornBush', null),
  obstacleScenario('world.rocks', 'Rocks, hanging and standing', 'rock', null),
  obstacleScenario('world.beehives', 'Beehives with their bees, hanging and standing', 'beehive', null),
  ...BRANCH_DECORATIONS.map((decoration) => obstacleScenario(`world.decoration.${decoration}`, `Branches with a ${decoration}`, 'branch', decoration)),
];
