import { HIGH_BELOW_Y, OBSTACLE_HITBOXES } from '../../config.js';
import { BARK_LINE_LENGTH, TRUNK_REFERENCE } from '../../art/pieces/branch.js';
import { HIVE_TRUNK_REFERENCE, STEM_REFERENCE } from '../../art/pieces/obstacles.js';
import { mixSeed, mulberry32 } from '../../sim/rng.js';
import { timeOfDayFor, TimeOfDay } from '../../sim/stages.js';
import {
  BEE_WING_MAX,
  BRANCH_TRUNK_X,
  HIVE_TRUNK,
  THORN_VINE_END,
  beeAt,
  beeSwarm,
  branchBarkLines,
  canopyY,
  hiveTop,
  rockVariant,
  thornBushThorns,
  trunkBottom,
  vineCurve,
} from '../../views/obstacles.js';
import { Builder, cubicPoints } from './build.js';
import { DECORATION_RIGS } from './decorations.js';
import { branchPoleDetails } from './branchPole.js';

// The static obstacles in the Phaser version (PHASER_PLAN.md, M5b), as the Pixi
// ObstacleViews draw them: built once per obstacle from its pieces, in the local frame the
// drawing code uses (scaled with the hitbox), in the same order; animate(t) moves what
// moves with the world time.

// A vine from the canopy (`fromY`) down to `toY`, swaying by `sway`: a strip along the
// curve and its round ends.
function vine(b, x, fromY, toY, sway) {
  return b.curve('support.vine', cubicPoints(vineCurve(x, fromY, toY, sway)));
}

function branch(b, o, rand, hangs, view) {
  const [box] = OBSTACLE_HITBOXES.branch;
  const decoration = o.decoration ? DECORATION_RIGS[o.decoration](b, mulberry32(mixSeed(0xa11a, o.gap)), { hangs, gap: o.gap }) : null;
  const join = !hangs && b.art.catalog.presentation?.standingBranchJoin;
  const trunk = hangs ? null : b.stretched('branch.trunk', BRANCH_TRUNK_X, join?.top ?? 0, trunkBottom(o), TRUNK_REFERENCE);
  const parts = hangs
    ? [...vine(b, box.dx + 30, canopyY(o), box.dy + 2, 8), ...vine(b, box.dx + box.w - 45, canopyY(o), box.dy + 4, -8)]
    : join ? [] : [trunk];
  const wood = b.image('branch.body');
  if (join) {
    // Hide the sawn end under the foreground pole; keep the same branch pivot.
    const at = b.art.at('branch.body');
    const left = (BRANCH_TRUNK_X - b.art.piece('branch.body').box.x) * at.zoom;
    wood.setCrop(left, 0, at.size[0] - left, at.size[1]);
  }
  parts.push(wood);
  for (const { x0, y0, x1, y1 } of branchBarkLines(rand)) {
    const line = b.image('branch.barkLine').setPosition(x0, y0).setRotation(Math.atan2(y1 - y0, x1 - x0));
    line.scaleX = (b.art.unit('branch.barkLine') * Math.hypot(x1 - x0, y1 - y0)) / BARK_LINE_LENGTH;
    parts.push(line);
  }
  if (join) {
    const details = join.details ? branchPoleDetails(b, o, decoration?.poleClearance) : { behind: [], front: [] };
    parts.push(...details.behind, trunk, ...details.front);
  }
  if (decoration?.rearPart) parts.unshift(decoration.rearPart);
  view.add(parts);
  if (!decoration) return null;
  const { part, animate, behindBranch } = decoration;
  if (behindBranch) view.addAt(part, parts.indexOf(wood));
  else view.add(part);
  return animate;
}

function thornBush(b, o, rand, hangs, view) {
  const parts = hangs ? vine(b, 0, canopyY(o), THORN_VINE_END, 10) : [b.stretched('support.stem', 0, 20, trunkBottom(o), STEM_REFERENCE), b.image('thornBush.mound')];
  for (const t of thornBushThorns(rand)) parts.push(b.image('thornBush.thorn').setPosition(t.x, t.y).setRotation(t.a));
  parts.push(b.image('thornBush.body'));
  view.add(parts);
  return null;
}

function rock(b, o, rand, hangs, view) {
  const [{ r }] = OBSTACLE_HITBOXES.rock;
  const variant = rockVariant(o.gap, b.art.at('rock.body').frames.length);
  const vineEnd = b.art.catalog.presentation?.hangingRockVineY?.[variant] ?? -r + 4;
  const parts = hangs
    ? vine(b, 0, canopyY(o), vineEnd, 9)
    : [b.stretched('support.stem', 0, r - 4, trunkBottom(o), STEM_REFERENCE), b.image('rock.ledge')];
  if (hangs && b.art.catalog.presentation?.hangingRockSling !== false) parts.push(b.image('rock.sling'));
  const stone = b.image('rock.body', variant);
  if (!hangs) stone.setY(b.art.catalog.presentation?.standingRockY?.[variant] ?? 0);
  parts.push(stone);
  view.add(parts);
  return null;
}

function beehive(b, o, rand, hangs, view) {
  const top = hiveTop();
  const armY = top - 12;
  const parts = hangs
    ? vine(b, 0, canopyY(o), top + 2, 7)
    : [b.stretched('support.hiveTrunk', HIVE_TRUNK.x, armY - 6, trunkBottom(o), HIVE_TRUNK_REFERENCE), b.image('beehive.arm')];
  parts.push(b.image('beehive.nest'));
  view.add(parts);
  // Like the other creatures, activity follows the obstacle's stage. Keep the
  // hive and its collision shape, but don't create a swarm at night.
  if (timeOfDayFor(o.gap) === TimeOfDay.NIGHT) return null;
  // The bees: two wings that beat (squeezed) and the body, each on its own loop.
  const wingUnit = b.art.unit('bee.wing');
  const bees = beeSwarm(rand).map((bee) => ({ bee, wings: [b.image('bee.wing'), b.image('bee.wing')], body: b.image('bee.body') }));
  view.add(bees.flatMap(({ wings, body }) => [...wings, body]));
  return (t) => {
    for (const { bee, wings, body } of bees) {
      const { x, y, wing } = beeAt(bee, t);
      wings[0].setPosition(x - 2.5, y - 3);
      wings[1].setPosition(x + 2.5, y - 3);
      for (const w of wings) w.scaleY = (wingUnit * wing) / BEE_WING_MAX;
      body.setPosition(x, y);
    }
  };
}

export const STATIC_RIGS = { branch, thornBush, rock, beehive };

// A static obstacle's view: `view` to add to the layer, and `update(t)` (null if nothing
// moves). Its art is in the obstacle's units, scaled with the hitbox.
export function buildStaticRig(scene, art, o, build = STATIC_RIGS[o.type]) {
  const b = new Builder(scene, art);
  const view = b.container(o.x, o.y).setScale(o.scale);
  const animate = build(b, o, mulberry32(mixSeed(0x0b57, o.gap)), o.y < HIGH_BELOW_Y, view);
  animate?.(0);
  return { view, update: animate };
}
