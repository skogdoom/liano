// A stand-in for a Pixi `Graphics` (or `GraphicsContext`) that records the drawing calls
// the game's art uses, so the same drawing functions that draw the Pixi version can also
// write the pre-rendered art (see svg.js and PHASER_PLAN.md, section 5).
//
// It follows Pixi 8's rules for paths: shape calls add to the current path; `fill` and
// `stroke` take a copy of it and start a new one from its last point; a `stroke` right
// after a `fill` (or a `fill` right after a `stroke`) uses the same path again. A style
// given as an object takes the default for whatever it leaves out, not the previous one.

export const DEFAULT_FILL = Object.freeze({ color: 0xffffff, alpha: 1 });
export const DEFAULT_STROKE = Object.freeze({
  width: 1,
  color: 0xffffff,
  alpha: 1,
  alignment: 0.5,
  miterLimit: 10,
  cap: 'butt',
  join: 'miter',
});

const toFill = (style, alpha) => {
  if (typeof style === 'number') return { ...DEFAULT_FILL, color: style, alpha: alpha ?? 1 };
  return { ...DEFAULT_FILL, ...style };
};
const toStroke = (style) => (typeof style === 'number' ? { ...DEFAULT_STROKE, color: style } : { ...DEFAULT_STROKE, ...style });

// A path is a list of shapes. Each shape is drawn on its own (as Pixi does), so where
// two shapes of one fill overlap, a see-through fill shows twice.
//   { type: 'rect', x, y, w, h }
//   { type: 'roundRect', x, y, w, h, r }
//   { type: 'circle', x, y, r }
//   { type: 'ellipse', x, y, rx, ry }
//   { type: 'poly', points: [x0, y0, x1, y1, ...], closed }
//   { type: 'subpath', start: [x, y], segments: [...], closed }, segments being
//     ['L', x, y], ['Q', cx, cy, x, y], ['C', c1x, c1y, c2x, c2y, x, y] or
//     ['A', cx, cy, r, startAngle, endAngle, anticlockwise]
export class RecordingGraphics {
  constructor() {
    this.instructions = [];
    this.clear();
  }

  clear() {
    this.instructions = [];
    this.path = [];
    this.subpath = null;
    this.cursor = [0, 0];
    this.tick = 0;
    this.fillStyle = { ...DEFAULT_FILL };
    this.strokeStyle = { ...DEFAULT_STROKE };
    return this;
  }

  // --- shapes

  rect(x, y, w, h) {
    return this.#shape({ type: 'rect', x, y, w, h });
  }

  roundRect(x, y, w, h, r = 0) {
    return this.#shape({ type: 'roundRect', x, y, w, h, r });
  }

  circle(x, y, r) {
    return this.#shape({ type: 'circle', x, y, r });
  }

  ellipse(x, y, rx, ry) {
    return this.#shape({ type: 'ellipse', x, y, rx, ry });
  }

  poly(points, closed = true) {
    const flat = typeof points[0] === 'number' ? [...points] : points.flatMap((p) => [p.x, p.y]);
    return this.#shape({ type: 'poly', points: flat, closed });
  }

  // --- paths

  moveTo(x, y) {
    this.tick++;
    // Pixi replaces a moveTo that nothing has followed yet.
    if (this.subpath && this.subpath.segments.length === 0) {
      this.subpath.start = [x, y];
    } else {
      this.subpath = { type: 'subpath', start: [x, y], segments: [], closed: false };
      this.path.push(this.subpath);
    }
    this.cursor = [x, y];
    return this;
  }

  lineTo(x, y) {
    return this.#segment(['L', x, y], [x, y]);
  }

  quadraticCurveTo(cx, cy, x, y) {
    return this.#segment(['Q', cx, cy, x, y], [x, y]);
  }

  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    return this.#segment(['C', c1x, c1y, c2x, c2y, x, y], [x, y]);
  }

  arc(cx, cy, r, startAngle, endAngle, anticlockwise = false) {
    // As on a canvas: a line from the current point to the arc's start, then the arc.
    const start = [cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle)];
    if (!this.subpath) this.moveTo(...start);
    else this.#segment(['L', ...start], start);
    return this.#segment(['A', cx, cy, r, startAngle, endAngle, anticlockwise], [cx + r * Math.cos(endAngle), cy + r * Math.sin(endAngle)]);
  }

  closePath() {
    this.tick++;
    if (this.subpath) {
      this.subpath.closed = true;
      this.cursor = [...this.subpath.start];
      this.subpath = null;
    }
    return this;
  }

  beginPath() {
    this.path = [];
    this.subpath = null;
    return this;
  }

  // --- fill and stroke

  fill(style, alpha) {
    const path = this.#pathFor('stroke');
    if (style != null) this.fillStyle = toFill(style, alpha);
    this.instructions.push({ action: 'fill', style: { ...this.fillStyle }, path });
    return this.#nextPath();
  }

  stroke(style) {
    const path = this.#pathFor('fill');
    if (style != null) this.strokeStyle = toStroke(style);
    if (this.strokeStyle.alignment !== 0.5) throw new Error('RecordingGraphics: only centred strokes (alignment 0.5) are supported');
    this.instructions.push({ action: 'stroke', style: { ...this.strokeStyle }, path });
    return this.#nextPath();
  }

  // The path a fill or stroke applies to: the previous instruction's, if it was the other
  // action and nothing has been drawn since (Pixi's `_tick`), else the current one.
  #pathFor(other) {
    const last = this.instructions[this.instructions.length - 1];
    if (this.tick === 0 && last?.action === other) return last.path;
    return this.path.map((shape) => structuredClone(shape));
  }

  #nextPath() {
    this.path = [];
    this.subpath = null;
    this.tick = 0;
    return this;
  }

  #shape(shape) {
    this.tick++;
    this.path.push(shape);
    this.subpath = null;
    return this;
  }

  #segment(segment, end) {
    this.tick++;
    if (!this.subpath) {
      this.subpath = { type: 'subpath', start: [...this.cursor], segments: [], closed: false };
      this.path.push(this.subpath);
    }
    this.subpath.segments.push(segment);
    this.cursor = end;
    return this;
  }
}
