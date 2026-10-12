import { LIANA_SPACING, SIM_DT } from '../config.js';
import { Art, CATALOG, queueArt } from '../phaser/art.js';
import { LianaSetRig } from '../phaser/world/lianas.js';
import { MonkeyRig } from '../phaser/world/monkey.js';
import { ShadowRig } from '../phaser/world/shadow.js';
import { LIANA_PALETTES, LianaView } from '../render/lianaView.js';
import { MonkeyView, PALETTES } from '../render/monkeyView.js';
import { ShadowView } from '../render/shadowView.js';
import { Liana } from '../sim/liana.js';
import { MonkeyState } from '../sim/monkey.js';

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
];
