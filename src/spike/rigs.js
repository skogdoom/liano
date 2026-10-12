import { RecordingGraphics } from '../art/recorder.js';
import { FAR_FACTOR, TILE, drawFarLayer } from '../render/background.js';
import { LIANA_PALETTES, drawLiana, lianaShape } from '../render/lianaView.js';
import {
  BRANCH_TRUNK_WIDTH,
  BRANCH_TRUNK_X,
  branchBarkLines,
  branchTop,
  drawBranchBody,
  drawPantherBody,
  drawPantherEar,
  drawPantherEyes,
  drawPantherTail,
  drawTrunk,
  pantherBlinks,
  pantherPlacement,
  pantherSwish,
  trunkBottom,
} from '../render/obstacleViews.js';
import { mixSeed, mulberry32 } from '../sim/rng.js';
import { BARK_LINE_LENGTH, TRUNK_REFERENCE, tailFrameFor } from '../art/pieces/branch.js';
import { LEAF_REFERENCE } from '../art/pieces/liana.js';

// M1 spike (PHASER_PLAN.md): the three objects as rigs of pre-rendered pieces in Phaser,
// placed exactly as the Pixi views draw them, from the art (phaser/art.js). Dev only; the
// game's rigs come in M5.

// A branch on a trunk (a low one), with a panther if it carries one; as the Pixi view
// draws it at world time `t` (see update).
export class BranchRig {
  constructor(scene, art, o) {
    this.view = scene.add.container(o.x, o.y).setScale(o.scale);
    const unit = (key) => art.unit(key);
    const rand = mulberry32(mixSeed(0x0b57, o.gap));
    const trunk = art.image(scene, 'branch.trunk').setPosition(BRANCH_TRUNK_X, 0);
    trunk.scaleY = (unit('branch.trunk') * trunkBottom(o)) / TRUNK_REFERENCE;
    const body = art.image(scene, 'branch.body');
    this.view.add([trunk, body]);
    for (const { x0, y0, x1, y1 } of branchBarkLines(rand)) {
      const line = art.image(scene, 'branch.barkLine').setPosition(x0, y0);
      line.rotation = Math.atan2(y1 - y0, x1 - x0);
      line.scaleX = (unit('branch.barkLine') * Math.hypot(x1 - x0, y1 - y0)) / BARK_LINE_LENGTH;
      this.view.add(line);
    }
    this.panther = null;
    if (o.decoration === 'panther') {
      const { facing, cx, phase } = pantherPlacement(mulberry32(mixSeed(0xa11a, o.gap)));
      const panther = scene.make.container({ x: cx, y: branchTop(cx) }, false).setScale(facing, 1);
      const tail = art.image(scene, 'panther.tail');
      const pantherBody = scene.make.container({}, false);
      const ear = art.image(scene, 'panther.ear').setPosition(35.5, -22);
      const eyes = art.image(scene, 'panther.eyes');
      pantherBody.add([art.image(scene, 'panther.body'), ear, eyes]);
      panther.add([tail, pantherBody]);
      this.view.add(panther);
      this.panther = { phase, tail, body: pantherBody, ear, eyes, earScale: unit('panther.ear'), art };
    }
  }

  update(t) {
    if (!this.panther) return;
    const { phase, tail, body, ear, eyes, earScale, art } = this.panther;
    body.scaleY = 1 + 0.03 * Math.sin(t * 1.7 + phase);
    art.setFrame(tail, 'panther.tail', tailFrameFor(pantherSwish(t, phase)));
    art.setFrame(eyes, 'panther.eyes', pantherBlinks(t, phase) ? 1 : 0);
    ear.scaleY = earScale * (1 - 0.55 * Math.max(0, Math.sin(t * 1.3 + phase * 2)) ** 14);
  }
}

// A liana (palette 0) with its leaves, as the Pixi view draws it (see update).
export class LianaRig {
  constructor(scene, art, layout) {
    this.art = art;
    this.layout = layout;
    this.view = scene.add.container(0, 0);
    this.rope = art.rope(scene, 'liana.green.rope');
    this.flash = art.rope(scene, 'liana.flash');
    this.leaves = layout.leaves.map((leaf) => art.image(scene, 'liana.green.leaf', leaf.dark ? 1 : 0));
    this.view.add([this.rope, ...this.leaves, this.flash]);
  }

  update(liana, flashing) {
    const { points, leaves, flash } = lianaShape(liana, this.layout);
    this.art.bend(this.rope, 'liana.green.rope', points);
    this.flash.visible = flashing;
    if (flashing) this.art.bend(this.flash, 'liana.flash', flash);
    const unit = this.art.unit('liana.green.leaf');
    leaves.forEach((leaf, i) => {
      this.leaves[i].setPosition(leaf.x, leaf.y);
      this.leaves[i].rotation = leaf.angle;
      this.leaves[i].setScale((unit * leaf.length) / LEAF_REFERENCE);
    });
  }
}

// The far backdrop layer: its tile, repeating, `width` wide from x = 0, scrolled for a
// camera at `cameraX` as the Pixi layer is.
export class BackdropRig {
  constructor(scene, art, width) {
    this.art = art;
    this.view = scene.add.existing(art.tile(scene, 'backdrop.far', width));
  }

  update(cameraX, tint = 0xffffff) {
    this.art.setTile(this.view, 'backdrop.far', { x: (((cameraX * FAR_FACTOR) % TILE) + TILE) % TILE });
    this.view.setTint(tint);
  }
}

// --- The other way: Phaser's own Graphics, replaying the recorded drawing (no curves,
// caps or joins: curves are sampled; for comparison only).

const CURVE_STEPS = 12;

// The points of a recorded shape, for Phaser's fillPoints/strokePoints.
function shapePoints(shape) {
  if (shape.type === 'poly') {
    const pts = [];
    for (let i = 0; i < shape.points.length; i += 2) pts.push({ x: shape.points[i], y: shape.points[i + 1] });
    return pts;
  }
  const pts = [{ x: shape.start[0], y: shape.start[1] }];
  let [x, y] = shape.start;
  for (const s of shape.segments) {
    if (s[0] === 'L') [, x, y] = s;
    else if (s[0] === 'Q' || s[0] === 'C') {
      const [cx1, cy1, cx2, cy2, ex, ey] = s[0] === 'Q' ? [s[1], s[2], s[1], s[2], s[3], s[4]] : s.slice(1);
      const q = s[0] === 'Q';
      for (let k = 1; k <= CURVE_STEPS; k++) {
        const u = k / CURVE_STEPS;
        const v = 1 - u;
        pts.push(
          q
            ? { x: v * v * x + 2 * v * u * cx1 + u * u * ex, y: v * v * y + 2 * v * u * cy1 + u * u * ey }
            : {
                x: v ** 3 * x + 3 * v * v * u * cx1 + 3 * v * u * u * cx2 + u ** 3 * ex,
                y: v ** 3 * y + 3 * v * v * u * cy1 + 3 * v * u * u * cy2 + u ** 3 * ey,
              },
        );
      }
      [x, y] = [ex, ey];
      continue;
    } else if (s[0] === 'A') {
      const [, cx, cy, r, a0, a1] = s;
      for (let k = 1; k <= CURVE_STEPS; k++) pts.push({ x: cx + r * Math.cos(a0 + ((a1 - a0) * k) / CURVE_STEPS), y: cy + r * Math.sin(a0 + ((a1 - a0) * k) / CURVE_STEPS) });
      x = pts[pts.length - 1].x;
      y = pts[pts.length - 1].y;
      continue;
    }
    pts.push({ x, y });
  }
  return pts;
}

export function replayIntoPhaser(graphics, instructions) {
  for (const { action, style, path } of instructions) {
    if (action === 'fill') graphics.fillStyle(style.color, style.alpha);
    else graphics.lineStyle(style.width, style.color, style.alpha);
    for (const s of path) {
      const fill = action === 'fill';
      if (s.type === 'rect' || s.type === 'roundRect') fill ? graphics.fillRect(s.x, s.y, s.w, s.h) : graphics.strokeRect(s.x, s.y, s.w, s.h);
      else if (s.type === 'circle') fill ? graphics.fillCircle(s.x, s.y, s.r) : graphics.strokeCircle(s.x, s.y, s.r);
      else if (s.type === 'ellipse') fill ? graphics.fillEllipse(s.x, s.y, s.rx * 2, s.ry * 2) : graphics.strokeEllipse(s.x, s.y, s.rx * 2, s.ry * 2);
      else {
        const pts = shapePoints(s);
        if (pts.length < 2) continue;
        if (fill) graphics.fillPoints(pts, true);
        else graphics.strokePoints(pts, s.closed || s.type === 'poly' ? s.closed !== false : false);
      }
    }
  }
  return graphics;
}

// The same three objects in Phaser's own Graphics, redrawn as the Pixi views do (for
// comparison: looks and frame time).

const recorded = (draw) => {
  const g = new RecordingGraphics();
  draw(g);
  return g.instructions;
};
const nativeGraphics = (scene, draw) => replayIntoPhaser(scene.make.graphics({}, false), recorded(draw));

export class NativeBranchRig {
  constructor(scene, o) {
    this.view = scene.add.container(o.x, o.y).setScale(o.scale);
    const rand = mulberry32(mixSeed(0x0b57, o.gap));
    const lines = branchBarkLines(rand);
    this.view.add(
      nativeGraphics(scene, (g) => {
        drawTrunk(g, BRANCH_TRUNK_X, 0, trunkBottom(o), BRANCH_TRUNK_WIDTH);
        drawBranchBody(g, lines);
      }),
    );
    this.panther = null;
    if (o.decoration === 'panther') {
      const { facing, cx, phase } = pantherPlacement(mulberry32(mixSeed(0xa11a, o.gap)));
      const panther = scene.make.container({ x: cx, y: branchTop(cx) }, false).setScale(facing, 1);
      const tail = scene.make.graphics({}, false);
      const body = scene.make.container({}, false);
      const ear = nativeGraphics(scene, drawPantherEar).setPosition(35.5, -22);
      const eyes = scene.make.graphics({}, false);
      body.add([nativeGraphics(scene, drawPantherBody), ear, eyes]);
      panther.add([tail, body]);
      this.view.add(panther);
      this.panther = { phase, tail, body, ear, eyes };
    }
  }

  update(t) {
    if (!this.panther) return;
    const { phase, tail, body, ear, eyes } = this.panther;
    body.scaleY = 1 + 0.03 * Math.sin(t * 1.7 + phase);
    replayIntoPhaser(tail.clear(), recorded((g) => drawPantherTail(g, pantherSwish(t, phase))));
    replayIntoPhaser(eyes.clear(), recorded((g) => drawPantherEyes(g, pantherBlinks(t, phase))));
    ear.scaleY = 1 - 0.55 * Math.max(0, Math.sin(t * 1.3 + phase * 2)) ** 14;
  }
}

export class NativeLianaRig {
  constructor(scene, layout) {
    this.layout = layout;
    this.view = scene.add.graphics();
  }

  update(liana, flashing) {
    replayIntoPhaser(this.view.clear(), recorded((g) => drawLiana(g, liana, this.layout, flashing, LIANA_PALETTES[0])));
  }
}

export class NativeBackdropRig {
  constructor(scene) {
    this.view = scene.add.container(0, 0);
    const tile = recorded(drawFarLayer);
    for (let i = 0; i < 2; i++) this.view.add(replayIntoPhaser(scene.make.graphics({ x: i * TILE }, false), tile));
  }

  update(cameraX) {
    this.view.x = -((((cameraX * FAR_FACTOR) % TILE) + TILE) % TILE);
  }
}
