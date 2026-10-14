// Drawing calls recorded in Pixi's terms (art/recorder.js) replayed on a Phaser Graphics.
// Only for the debug view (dev only): Phaser rebuilds a Graphics' geometry every frame,
// and it has no round caps or joins (PHASER_PLAN.md, M1), which hitboxes and paths can do
// without. Curves are drawn as lines between points along them.
const CURVE_STEPS = 12;

function subpathPoints({ start, segments }) {
  const points = [{ x: start[0], y: start[1] }];
  let [x, y] = start;
  for (const [kind, ...v] of segments) {
    if (kind === 'L') [x, y] = v;
    else if (kind === 'Q' || kind === 'C') {
      const [x0, y0] = [x, y];
      for (let i = 1; i <= CURVE_STEPS; i++) {
        const t = i / CURVE_STEPS;
        const u = 1 - t;
        if (kind === 'Q') {
          const [cx, cy, ex, ey] = v;
          points.push({ x: u * u * x0 + 2 * u * t * cx + t * t * ex, y: u * u * y0 + 2 * u * t * cy + t * t * ey });
        } else {
          const [c1x, c1y, c2x, c2y, ex, ey] = v;
          points.push({ x: u ** 3 * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * ex, y: u ** 3 * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * ey });
        }
      }
      [x, y] = kind === 'Q' ? v.slice(2) : v.slice(4);
      continue;
    } else if (kind === 'A') {
      const [cx, cy, r, a0, a1, anticlockwise] = v;
      let sweep = a1 - a0;
      if (anticlockwise && sweep > 0) sweep -= 2 * Math.PI;
      if (!anticlockwise && sweep < 0) sweep += 2 * Math.PI;
      for (let i = 0; i <= CURVE_STEPS; i++) {
        const a = a0 + (sweep * i) / CURVE_STEPS;
        points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      [x, y] = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      continue;
    }
    points.push({ x, y });
  }
  return points;
}

function pointsOf(shape) {
  if (shape.type === 'poly') return Array.from({ length: shape.points.length / 2 }, (_, i) => ({ x: shape.points[2 * i], y: shape.points[2 * i + 1] }));
  return subpathPoints(shape);
}

// Replays `instructions` (a RecordingGraphics' `instructions`) on `g`, cleared first.
export function replay(g, instructions) {
  g.clear();
  for (const { action, style, path } of instructions) {
    const fill = action === 'fill';
    if (fill) g.fillStyle(style.color, style.alpha);
    else g.lineStyle(style.width, style.color, style.alpha);
    for (const shape of path) {
      switch (shape.type) {
        case 'rect':
          if (fill) g.fillRect(shape.x, shape.y, shape.w, shape.h);
          else g.strokeRect(shape.x, shape.y, shape.w, shape.h);
          break;
        case 'roundRect':
          if (fill) g.fillRoundedRect(shape.x, shape.y, shape.w, shape.h, shape.r);
          else g.strokeRoundedRect(shape.x, shape.y, shape.w, shape.h, shape.r);
          break;
        case 'circle':
          if (fill) g.fillCircle(shape.x, shape.y, shape.r);
          else g.strokeCircle(shape.x, shape.y, shape.r);
          break;
        case 'ellipse':
          if (fill) g.fillEllipse(shape.x, shape.y, 2 * shape.rx, 2 * shape.ry);
          else g.strokeEllipse(shape.x, shape.y, 2 * shape.rx, 2 * shape.ry);
          break;
        default: {
          const points = pointsOf(shape);
          if (points.length < 2) break;
          if (fill) g.fillPoints(points, true);
          else g.strokePoints(points, shape.closed);
        }
      }
    }
  }
  return g;
}
