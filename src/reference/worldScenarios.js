import { LIANA_SPACING, SIM_DT } from '../config.js';
import { CANOPY_BOTTOM, FLOOR_Y } from '../views/backdrop.js';
import { Art, CATALOG, queueArt } from '../render/art.js';
import { LianaSetRig } from '../render/world/lianas.js';
import { MonkeyRig } from '../render/world/monkey.js';
import { ShadowRig } from '../render/world/shadow.js';
import { Liana } from '../sim/liana.js';
import { MonkeyState } from '../sim/monkey.js';
import { BRANCH_DECORATIONS, MOVING_TYPES, Obstacle } from '../sim/obstacle.js';
import { createObstacle } from '../sim/generator.js';
import { Game } from '../sim/game.js';
import { World } from '../sim/world.js';
import { layoutFor, paneLayouts } from '../layout.js';
import { WorldPane } from '../render/world/pane.js';
import { BananaLayer } from '../render/world/bananas.js';
import { ObstacleLayer } from '../render/world/obstacleLayer.js';

// Deterministic rendering fixtures retained from the last two-engine build.

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
    draw(scene, zoom) {
      const layer = new ObstacleLayer(scene, artFor(scene, zoom));
      layer.update(obstacleRow(type, decoration), t);
      scene.add.existing(layer.view);
    },
  });

// The `k`th obstacle of a moving kind the generator makes (over seeds and gaps), at a few
// times, each in a view round it.
function movingObstacle(type, k) {
  let found = 0;
  for (let seed = 1; seed < 60; seed++) {
    for (let gap = 1; gap < 300; gap++) {
      const o = createObstacle(seed, gap);
      if (o?.type === type && found++ === k) return o;
    }
  }
  throw new Error(`No ${type}`);
}
const MOVING_TIMES = [0.4, 1.37, 2.9];
const movingScenario = (type, k) => {
  const width = 360;
  const at = (o, t) => {
    o.setTime(t);
    return o;
  };
  // Side by side at each time: each copy moved along x so they do not overlap.
  const copies = () =>
    MOVING_TIMES.map((t, i) => {
      const o = at(movingObstacle(type, k), t);
      o.baseX += i * width - o.x + width / 2;
      return at(o, t);
    });
  return withArt({
    id: `world.moving.${type}${k ? `.${k}` : ''}`,
    title: `A ${type} at three moments`,
    width: MOVING_TIMES.length * width,
    scroll: [0, CANOPY_BOTTOM],
    height: FLOOR_Y - CANOPY_BOTTOM,
    draw(scene, zoom) {
      const layer = new ObstacleLayer(scene, artFor(scene, zoom));
      layer.update(copies());
      scene.add.existing(layer.view);
    },
  });
};

// Bananas and a heart still to take, bobbing, and the "+1" and "+1 ♥" rising from two
// just taken.
function bananaWorld() {
  const bananas = new Map(
    [
      [1, 80, 120, false],
      [2, 200, 160, false],
      [3, 320, 110, true],
      [4, 440, 150, false],
      [5, 560, 130, true],
    ].map(([gap, x, y, heart]) => [gap, { gap, x, y, heart }]),
  );
  const world = { time: 1.1, bananas, bananaAt: (gap) => gap !== 4 && gap !== 5 };
  const events = [
    { type: 'banana', gap: 4 },
    { type: 'heart', gap: 5 },
  ];
  return { world, events };
}
const bananaScenario = () =>
  withArt({
    id: 'world.bananas',
    // Half a view (the game has a banana in about every other gap): still far more bananas
    // and pops in it than the game ever shows.
    title: 'Bananas and a heart to take, and the +1 and +1 ♥ rising from two taken',
    width: 1280,
    height: 360,
    draw(scene, zoom) {
      const layer = new BananaLayer(scene, artFor(scene, zoom));
      layer.setTextResolution(zoom);
      const { world: w, events } = bananaWorld();
      layer.update(w, events, 0.25);
      scene.add.existing(layer.view);
    },
  });

// A whole pane, the backdrop included: a run on a fixed level, a second in, drawn at
// stage `stage` (its tint settled), the camera `ahead` px further on.
function sceneWorld(stage, temple = null) {
  const game = new Game({ slip: false, createWorld: (options) => new World({ ...options, seed: 4242 }) });
  game.press('start');
  for (let i = 0; i < Math.round(1 / SIM_DT); i++) game.step(SIM_DT);
  const world = game.worlds[0];
  world.stages = world.stages.map(() => stage);
  // A temple in one of its looks in the second gap (where the game would have one).
  if (temple !== null) world.obstacles.set(1, new Obstacle(1, 'temple', LIANA_SPACING * 1.5, 330, null, 1.3, null, temple));
  return world;
}
const SCENE = { width: 1280, height: 720 };
const sceneScenario = (id, title, stage, ahead = 0, temple = null, makeWorld = () => sceneWorld(stage, temple)) =>
  withArt({
    id,
    title: `${title}`,
    ...SCENE,
    background: 0x000000,
    draw(scene, zoom) {
      const pane = new WorldPane(scene, artFor(scene, zoom));
      pane.setWorld(makeWorld(), [0]);
      pane.resize(paneLayouts(layoutFor(SCENE.width, SCENE.height), 1, 1)[0], zoom);
      pane.camera.x = pane.camera.prevX = pane.camera.x + ahead;
      pane.update([], 10, false, null, 1);
    },
  });

// Readability at actual game size, with the same scenery and rigs as gameplay.
function obstacleReadabilityWorld(stage) {
  const world = sceneWorld(stage);
  world.obstacles.clear();
  for (const [i, x] of [80, 620].entries()) {
    const spider = movingObstacle('spider', i);
    spider.baseX = x;
    world.obstacles.set(i, spider);
    world.obstacles.set(i + 2, new Obstacle(i + 2, 'rock', x + 240, i ? 220 : 470, null, 1.2));
  }
  return world;
}

function flyingReadabilityWorld(stage) {
  const world = sceneWorld(stage);
  world.obstacles.clear();
  for (const [i, type] of ['bird', 'blueBird', 'purpleBird', 'bat', 'circleBat'].entries()) {
    const actor = movingObstacle(type, 0);
    // Preserve its generated animation, with an uncluttered review placement.
    actor.baseX = 60 + i * 190;
    actor.baseY = i < 3 ? 210 : 420;
    world.obstacles.set(i, actor);
  }
  return world;
}

export const WORLD_SCENARIOS = [
  withArt({
    id: 'world.monkeys',
    title: 'Monkeys hanging, flying and fallen, in both furs',
    width: 640,
    height: 220,
    scroll: [0, 20],
    draw(scene, zoom) {
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
    draw(scene, zoom) {
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
    draw(scene, zoom) {
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
    draw(scene, zoom) {
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
  ...MOVING_TYPES.flatMap((type) => [0, 1].map((k) => movingScenario(type, k))),
  bananaScenario(),
  sceneScenario('scene.day', 'A run by day, the whole pane', 1),
  sceneScenario('scene.ahead', 'The same run further on, by day', 1, 1500),
  sceneScenario('scene.dusk', 'The same run at dusk (tinted)', 3, 700),
  sceneScenario('scene.night', 'The same run at night', 4, 2200),
  ...[[1, 'day'], [4, 'night']].map(([stage, light]) => sceneScenario(
    `scene.obstacles.${light}`, `Spiders and rocks against the jungle by ${light}`, stage, 0, null, () => obstacleReadabilityWorld(stage))),
  ...[[1, 'day'], [4, 'night']].map(([stage, light]) => sceneScenario(
    `scene.flying.${light}`, `Birds and bats against the jungle by ${light}`, stage, 0, null, () => flyingReadabilityWorld(stage))),
  // The temple in each look, in the view as the game shows it (its foot buried in the
  // floor, the canopy over the lianas), by day and at night; the one with the fire at dusk.
  ...[0, 1, 2, 3].flatMap((look) => [
    sceneScenario(`scene.temple.${look}.day`, `A temple, look ${look}, by day`, 1, 500, look),
    sceneScenario(`scene.temple.${look}.night`, `A temple, look ${look}, at night`, 4, 500, look),
  ]),
  sceneScenario('scene.temple.3.dusk', 'A temple, look 3, at dusk: the fire lit', 3, 500, 3),
];
