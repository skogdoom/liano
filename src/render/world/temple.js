import { OBSTACLE_HITBOXES } from '../../config.js';
import {
  TEMPLE_LEAF_REFERENCE,
  TEMPLE_LOOKS,
  TEMPLE_MOSS_REFERENCE,
  flameFrameFor,
} from '../../art/pieces/temple.js';
import { FLOOR_Y } from '../../views/backdrop.js';
import {
  TEMPLE_BRAZIERS,
  TEMPLE_GLOW_RADIUS,
  TEMPLE_GLOW_Y,
  TEMPLE_GREENS,
  TEMPLE_PANEL_ROW,
  TEMPLE_STAIRS,
  TEMPLE_STEP,
  darknessOf,
  templeFlame,
  templeFringe,
  templeGlowLayers,
  templeOvergrowth,
} from '../../views/obstacles.js';
import { quadraticPoints } from './build.js';

// The temple in the Phaser version (PHASER_PLAN.md, M5d), as the Pixi view draws it: the
// stone and greenery take the stage tint (Art.tint), the braziers' fire does not, and in
// the dark stages each brazier lights the stone round it with a glow added to what is
// behind it. `b` is a Builder; returns { view, update(t, tint) }.
const GREENS = Object.values(TEMPLE_GREENS);
const [, tierA, tierB, tierC, base] = OBSTACLE_HITBOXES.temple;

export function templeRig(b, o, rand) {
  const look = o.variant ?? 0;
  const key = (part) => `temple.${TEMPLE_LOOKS[look]}.${part}`;
  const floor = (FLOOR_Y + 20 - o.y) / o.scale;
  const art = b.art;
  const view = b.container(o.x, o.y).setScale(o.scale);
  const stone = b.container();
  const parts = [];

  // The base down to the floor: its first repeat, then the others stacked (the last one
  // cropped there).
  const baseTop = b.image(key('baseTop'));
  if (floor < base.dy + TEMPLE_PANEL_ROW) baseTop.setCrop(0, 0, baseTop.frame.width, Math.max(0, (floor - base.dy) * art.at(key('baseTop')).zoom));
  parts.push(baseTop);
  const repeatsFrom = base.dy + TEMPLE_PANEL_ROW;
  if (floor > repeatsFrom) parts.push(...art.column(b.scene, key('base'), floor - repeatsFrom).map((image) => image.setY(image.y + repeatsFrom)));
  // The stairs below the tiers, from the top of the step the tiers' picture ends in.
  const stairsFrom = TEMPLE_STAIRS.y + Math.floor((base.dy - TEMPLE_STAIRS.y) / TEMPLE_STEP) * TEMPLE_STEP;
  parts.push(...art.column(b.scene, key('stairs'), floor - stairsFrom).map((image) => image.setY(image.y + stairsFrom)));
  // The tiers, the stairs on them, the shrine and the look's details.
  parts.push(b.image(key('top')));

  // The fire's phase comes first in the random stream, as in the Pixi view.
  const phase = look === 3 ? rand() * 6.3 : 0;

  // Overgrowth: moss along the tiers, vines hanging from it, leaves on the corners.
  const leaf = (x, y, a, length, width, color) =>
    b
      .image('temple.leaf', GREENS.indexOf(color))
      .setPosition(x, y)
      .setRotation(a)
      .setScale((art.unit('temple.leaf') * length) / TEMPLE_LEAF_REFERENCE, (art.unit('temple.leaf') * width) / (TEMPLE_LEAF_REFERENCE / 2));
  const overgrowth = templeOvergrowth(rand);
  for (const [k, r] of [tierA, tierB, tierC].entries()) {
    for (const moss of overgrowth[k]) {
      const patch = b.image('temple.moss', moss.color === TEMPLE_GREENS.MOSS ? 0 : 1).setPosition(moss.x, moss.y).setAlpha(look === 2 ? 1 : 0.8);
      patch.scaleX = (art.unit('temple.moss') * moss.rx) / TEMPLE_MOSS_REFERENCE;
      parts.push(patch);
      if (moss.vine) parts.push(...b.curve('temple.vine', quadraticPoints([moss.vine.from, moss.vine.control, moss.vine.to]), false));
    }
    parts.push(leaf(r.dx + 4, r.dy + 6, -0.9, 26, 8, TEMPLE_GREENS.LEAF_DARK), leaf(r.dx + r.w - 4, r.dy + 6, -2.2, 26, 8, TEMPLE_GREENS.LEAF));
  }

  // The haze over its foot and the fringe of leaves along the floor.
  parts.push(b.image('temple.haze').setPosition(0, floor + 30));
  for (const l of templeFringe(rand)) parts.push(leaf(l.x, floor + 14, l.a, l.length, l.width, l.color));
  stone.add(parts);
  view.add(stone);

  // The fire (look 3): a glow under each flame (its layers, each added to what is behind
  // it, as Pixi adds them), then the flames.
  let fire = null;
  if (look === 3) {
    const glows = TEMPLE_BRAZIERS.map(() => templeGlowLayers(1).map(() => art.glow(b.scene, 'temple.glow')));
    const flames = TEMPLE_BRAZIERS.map(() => b.image('temple.flame'));
    view.add([...glows.flat(), ...flames]);
    fire = { glows, flames };
  }

  let shownTint = null;
  const glowUnit = art.unit('temple.glow');
  return {
    view,
    update(t, tint = 0xffffff) {
      if (tint !== shownTint) {
        art.tint([stone], tint);
        shownTint = tint;
      }
      if (!fire) return;
      const light = Math.max(darknessOf(tint), art.catalog.presentation?.templeFireDaylight ?? 0);
      TEMPLE_BRAZIERS.forEach((x, i) => {
        const flame = templeFlame(t, phase, i);
        art.setFrame(fire.flames[i], 'temple.flame', flameFrameFor(flame.sway, flame.k));
        fire.flames[i].setX(x);
        const layers = templeGlowLayers(light * flame.flicker, flame.reach);
        fire.glows[i].forEach((disc, j) => {
          disc.visible = light > 0;
          disc.setPosition(x, TEMPLE_GLOW_Y).setScale((glowUnit * layers[j].radius) / TEMPLE_GLOW_RADIUS).setAlpha(layers[j].alpha);
        });
      });
    },
  };
}
