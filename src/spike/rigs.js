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
import { BARK_LINE_LENGTH, FLASH_LENGTH, LEAF_REFERENCE, TRUNK_REFERENCE, tailFrameFor } from '../art/spike.js';
import { LIANA_LENGTH } from '../config.js';

// M1 spike (PHASER_PLAN.md): the three objects as rigs of pre-rendered pieces in Phaser,
// placed exactly as the Pixi views draw them. Dev only.

export const ATLAS = 'art';

// The atlas for a screen with `density` pixels per world unit: the 1× one on 1× screens,
// the 2× one (scaled down where needed) on anything denser.
export const atlasScaleFor = (density) => (density > 1 ? 2 : 1);

// Loads the atlas for a screen of `density`, the backdrop and the pieces' anchors.
export function preloadArt(scene, density) {
  const atlasScale = atlasScaleFor(density);
  const dir = `${import.meta.env.BASE_URL}art/build/`;
  scene.load.atlas(ATLAS, `${dir}atlas@${atlasScale}x.png`, `${dir}atlas@${atlasScale}x.json`);
  scene.load.image('backdrop.far', `${dir}backdrop.far@1x.png`);
  scene.load.json('pieces', `${dir}pieces.json`);
}

// The piece table for a screen of `density`: frames, anchor and zoom per key.
export const piecesFor = (scene, density) => scene.cache.json.get('pieces')[atlasScaleFor(density)];

// A piece as an Image in the piece's own units (its origin where the drawing's was).
export function piece(scene, pieces, key, frame = 0) {
  const p = pieces[key];
  const image = scene.make.image({ key: ATLAS, frame: p.frames[frame] }, false);
  image.setOrigin(p.anchor[0], p.anchor[1]);
  image.setScale(1 / p.zoom);
  return image;
}

// A branch on a trunk (a low one), with a panther if it carries one; as the Pixi view
// draws it at world time `t` (see update).
export class BranchRig {
  constructor(scene, pieces, o) {
    this.view = scene.add.container(o.x, o.y).setScale(o.scale);
    const unit = (key) => 1 / pieces[key].zoom;
    const rand = mulberry32(mixSeed(0x0b57, o.gap));
    const trunk = piece(scene, pieces, 'branch.trunk').setPosition(BRANCH_TRUNK_X, 0);
    trunk.scaleY = (unit('branch.trunk') * trunkBottom(o)) / TRUNK_REFERENCE;
    const body = piece(scene, pieces, 'branch.body');
    this.view.add([trunk, body]);
    for (const { x0, y0, x1, y1 } of branchBarkLines(rand)) {
      const line = piece(scene, pieces, 'branch.barkLine').setPosition(x0, y0);
      line.rotation = Math.atan2(y1 - y0, x1 - x0);
      line.scaleX = (unit('branch.barkLine') * Math.hypot(x1 - x0, y1 - y0)) / BARK_LINE_LENGTH;
      this.view.add(line);
    }
    this.panther = null;
    if (o.decoration === 'panther') {
      const { facing, cx, phase } = pantherPlacement(mulberry32(mixSeed(0xa11a, o.gap)));
      const panther = scene.make.container({ x: cx, y: branchTop(cx) }, false).setScale(facing, 1);
      const tail = piece(scene, pieces, 'panther.tail');
      const pantherBody = scene.make.container({}, false);
      const ear = piece(scene, pieces, 'panther.ear').setPosition(35.5, -22);
      const eyes = piece(scene, pieces, 'panther.eyes');
      pantherBody.add([piece(scene, pieces, 'panther.body'), ear, eyes]);
      panther.add([tail, pantherBody]);
      this.view.add(panther);
      this.panther = { phase, tail, body: pantherBody, ear, eyes, earScale: unit('panther.ear'), pieces };
    }
  }

  update(t) {
    if (!this.panther) return;
    const { phase, tail, body, ear, eyes, earScale, pieces } = this.panther;
    body.scaleY = 1 + 0.03 * Math.sin(t * 1.7 + phase);
    tail.setFrame(pieces['panther.tail'].frames[tailFrameFor(pantherSwish(t, phase))]);
    eyes.setFrame(pieces['panther.eyes'].frames[pantherBlinks(t, phase) ? 1 : 0]);
    ear.scaleY = earScale * (1 - 0.55 * Math.max(0, Math.sin(t * 1.3 + phase * 2)) ** 14);
  }
}

// Bends a strip piece (straight along +x, `length` units from its origin) along `points`,
// on a Rope made from it. The points are extended past each end by the piece's margins,
// and the strip is laid along them by distance: a Rope spreads its texture evenly over
// its points instead, which would squash the round caps into the short end segments.
export function bendStrip(rope, info, points, length) {
  const { zoom, anchor } = info;
  const frameUnits = rope.frame.width / zoom;
  const before = anchor[0] * frameUnits;
  const after = frameUnits - before - length;
  const ext = (a, b, by) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: a.x + ((a.x - b.x) / len) * by, y: a.y + ((a.y - b.y) / len) * by };
  };
  const all = [ext(points[0], points[1], before), ...points, ext(points[points.length - 1], points[points.length - 2], after)];
  rope.setPoints(all.map((p) => ({ x: p.x * zoom, y: p.y * zoom })));
  // Along the path the strip's own length is spread over the path's (a bowed rope is a
  // little longer than straight); the margins keep their size.
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = along[along.length - 1];
  const shares = [0, ...along.map((d) => (before + (length * d) / total) / frameUnits), 1];
  const { u0, u1 } = rope.frame;
  shares.forEach((share, i) => {
    rope.uv[i * 4] = rope.uv[i * 4 + 2] = u0 + (u1 - u0) * share;
  });
}

// A liana (palette 0) with its leaves, as the Pixi view draws it (see update).
export class LianaRig {
  constructor(scene, pieces, layout) {
    this.pieces = pieces;
    this.layout = layout;
    this.view = scene.add.container(0, 0);
    const rope = pieces['liana.rope'];
    const flash = pieces['liana.flash'];
    // A Rope's strip is as wide as its frame is tall, in atlas pixels: it is drawn at 1/zoom.
    this.rope = scene.make.rope({ key: ATLAS, frame: rope.frames[0], points: 2 }, false).setScale(1 / rope.zoom);
    this.flash = scene.make.rope({ key: ATLAS, frame: flash.frames[0], points: 2 }, false).setScale(1 / flash.zoom);
    this.leaves = layout.leaves.map((leaf) => piece(scene, pieces, 'liana.leaf', leaf.dark ? 1 : 0));
    this.view.add([this.rope, ...this.leaves, this.flash]);
  }

  update(liana, flashing) {
    const { points, leaves, flash } = lianaShape(liana, this.layout);
    bendStrip(this.rope, this.pieces['liana.rope'], points, LIANA_LENGTH);
    this.flash.visible = flashing;
    if (flashing) bendStrip(this.flash, this.pieces['liana.flash'], flash, FLASH_LENGTH);
    const unit = 1 / this.pieces['liana.leaf'].zoom;
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
  constructor(scene, pieces, width) {
    const { anchor } = pieces['backdrop.far'];
    const source = scene.textures.get('backdrop.far').getSourceImage();
    this.view = scene.add.tileSprite(0, -anchor[1] * source.height, width, source.height, 'backdrop.far').setOrigin(0, 0);
  }

  update(cameraX, tint = 0xffffff) {
    this.view.tilePositionX = ((((cameraX * FAR_FACTOR) % TILE) + TILE) % TILE);
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
