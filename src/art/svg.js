// Writes what a RecordingGraphics recorded as SVG: one element per shape, the way Pixi
// draws each shape of a fill or stroke on its own, with the same colours, alphas, line
// widths, caps, joins and miter limit. The vectors are exact (curves stay curves).

const num = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};
const hex = (color) => `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;

// SVG arcs (`A`) for an arc of the circle (cx, cy, r) from angle a0 to a1, split in two
// when it is a full turn (which one SVG arc cannot draw).
function arcCommands(cx, cy, r, a0, a1, anticlockwise) {
  let sweep = a1 - a0;
  if (!anticlockwise && sweep < 0) sweep += Math.PI * 2 * Math.ceil(-sweep / (Math.PI * 2));
  if (anticlockwise && sweep > 0) sweep -= Math.PI * 2 * Math.ceil(sweep / (Math.PI * 2));
  if (Math.abs(sweep) > Math.PI * 2) sweep = Math.sign(sweep) * Math.PI * 2;
  const parts = Math.abs(sweep) > Math.PI * 1.999 ? 2 : 1;
  const out = [];
  for (let i = 1; i <= parts; i++) {
    const a = a0 + (sweep * i) / parts;
    const large = Math.abs(sweep / parts) > Math.PI ? 1 : 0;
    out.push(`A${num(r)} ${num(r)} 0 ${large} ${sweep > 0 ? 1 : 0} ${num(cx + r * Math.cos(a))} ${num(cy + r * Math.sin(a))}`);
  }
  return out.join(' ');
}

const ellipseD = (x, y, rx, ry) =>
  `M${num(x + rx)} ${num(y)} A${num(rx)} ${num(ry)} 0 1 1 ${num(x - rx)} ${num(y)} A${num(rx)} ${num(ry)} 0 1 1 ${num(x + rx)} ${num(y)} Z`;

// The `d` attribute of one shape.
export function shapeD(shape) {
  switch (shape.type) {
    case 'rect': {
      const { x, y, w, h } = shape;
      return `M${num(x)} ${num(y)} H${num(x + w)} V${num(y + h)} H${num(x)} Z`;
    }
    case 'roundRect': {
      const { x, y, w, h } = shape;
      const r = Math.max(0, Math.min(shape.r, w / 2, h / 2));
      if (r === 0) return shapeD({ type: 'rect', x, y, w, h });
      const a = (ex, ey) => `A${num(r)} ${num(r)} 0 0 1 ${num(ex)} ${num(ey)}`;
      return [
        `M${num(x + r)} ${num(y)}`,
        `H${num(x + w - r)}`,
        a(x + w, y + r),
        `V${num(y + h - r)}`,
        a(x + w - r, y + h),
        `H${num(x + r)}`,
        a(x, y + h - r),
        `V${num(y + r)}`,
        a(x + r, y),
        'Z',
      ].join(' ');
    }
    case 'circle':
      return ellipseD(shape.x, shape.y, shape.r, shape.r);
    case 'ellipse':
      return ellipseD(shape.x, shape.y, shape.rx, shape.ry);
    case 'poly': {
      const p = shape.points;
      const parts = [`M${num(p[0])} ${num(p[1])}`];
      for (let i = 2; i < p.length; i += 2) parts.push(`L${num(p[i])} ${num(p[i + 1])}`);
      if (shape.closed) parts.push('Z');
      return parts.join(' ');
    }
    case 'subpath': {
      const parts = [`M${num(shape.start[0])} ${num(shape.start[1])}`];
      for (const s of shape.segments) {
        if (s[0] === 'A') parts.push(arcCommands(...s.slice(1)));
        else parts.push(s[0] + s.slice(1).map(num).join(' '));
      }
      if (shape.closed) parts.push('Z');
      return parts.join(' ');
    }
    default:
      throw new Error(`svg: unknown shape ${shape.type}`);
  }
}

// The SVG elements for a list of recorded instructions.
export function elements(instructions) {
  const out = [];
  for (const { action, style, path } of instructions) {
    for (const shape of path) {
      // A subpath of a single point draws nothing (Pixi skips it too).
      if (shape.type === 'subpath' && shape.segments.length === 0) continue;
      const d = shapeD(shape);
      if (action === 'fill') {
        const alpha = style.alpha === 1 ? '' : ` fill-opacity="${num(style.alpha)}"`;
        out.push(`<path d="${d}" fill="${hex(style.color)}"${alpha}/>`);
      } else {
        const alpha = style.alpha === 1 ? '' : ` stroke-opacity="${num(style.alpha)}"`;
        out.push(
          `<path d="${d}" fill="none" stroke="${hex(style.color)}"${alpha} stroke-width="${num(style.width)}"` +
            ` stroke-linecap="${style.cap}" stroke-linejoin="${style.join}" stroke-miterlimit="${num(style.miterLimit)}"/>`,
        );
      }
    }
  }
  return out;
}

// A complete SVG document of `box` = { x, y, w, h } (in the drawing's own units: the
// piece's origin is at (-x, -y) in the picture), from recorded instructions, with a
// hidden layer of `guides` (see guideLayer) for whoever replaces the art.
export function toSvg(instructions, box, guides = '') {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${num(box.w)}" height="${num(box.h)}" viewBox="${num(box.x)} ${num(box.y)} ${num(box.w)} ${num(box.h)}">` +
    elements(instructions).join('') +
    guides +
    '</svg>\n'
  );
}

// A hidden layer (a hidden group, and a hidden layer in Inkscape) showing what a
// replacement has to keep: the piece's box, its origin (where the game places it), its
// attachment points (where other pieces join it), the hitbox (for obstacles: gameplay,
// which the art does not change) and, for a 9-slice panel, the slice lines. Thin lines
// that keep their width at any zoom.
export function guideLayer({ box, attach = {}, hitbox = [], slices = null }) {
  const thin = 'fill="none" vector-effect="non-scaling-stroke" stroke-width="1"';
  const parts = [
    `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}" ${thin} stroke="#00b7ff" stroke-dasharray="4 3"><title>box</title></rect>`,
    `<path d="M-4 0 H4 M0 -4 V4" ${thin} stroke="#ff00ff"><title>origin</title></path>`,
  ];
  for (const shape of hitbox) {
    const d = shape.r !== undefined ? ellipseD(shape.dx, shape.dy, shape.r, shape.r) : `M${num(shape.dx)} ${num(shape.dy)} h${num(shape.w)} v${num(shape.h)} h${num(-shape.w)} Z`;
    parts.push(`<path d="${d}" ${thin} stroke="#33dd33"><title>hitbox</title></path>`);
  }
  for (const [name, [x, y]] of Object.entries(attach)) {
    parts.push(`<circle cx="${num(x)}" cy="${num(y)}" r="2" ${thin} stroke="#ff9900"><title>attach: ${name}</title></circle>`);
  }
  if (slices) {
    const { left, right, top, bottom } = slices;
    const xs = [box.x + left, box.x + box.w - right];
    const ys = [box.y + top, box.y + box.h - bottom];
    const d = [...xs.map((x) => `M${num(x)} ${num(box.y)} V${num(box.y + box.h)}`), ...ys.map((y) => `M${num(box.x)} ${num(y)} H${num(box.x + box.w)}`)].join(' ');
    parts.push(`<path d="${d}" ${thin} stroke="#ffd000" stroke-dasharray="2 2"><title>slices</title></path>`);
  }
  return `<g id="guides" inkscape:groupmode="layer" inkscape:label="Guides" display="none" style="display:none">${parts.join('')}</g>`;
}

// A box around everything recorded: shapes, curve control points (which bound the
// curves) and half the line width plus a little for strokes, rounded out to whole units.
export function bounds(instructions, pad = 1) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (x, y, r = 0) => {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
  };
  for (const { action, style, path } of instructions) {
    // Round caps and miter joins reach past the line by up to half the width times the
    // miter limit; that is a lot for sharp joins, so this keeps to the common case.
    const reach = action === 'stroke' ? style.width / 2 + (style.join === 'miter' ? style.width : 0) : 0;
    for (const s of path) {
      if (s.type === 'rect' || s.type === 'roundRect') {
        add(s.x, s.y, reach);
        add(s.x + s.w, s.y + s.h, reach);
      } else if (s.type === 'circle') {
        add(s.x, s.y, s.r + reach);
      } else if (s.type === 'ellipse') {
        add(s.x - s.rx, s.y - s.ry, reach);
        add(s.x + s.rx, s.y + s.ry, reach);
      } else if (s.type === 'poly') {
        for (let i = 0; i < s.points.length; i += 2) add(s.points[i], s.points[i + 1], reach);
      } else if (s.type === 'subpath') {
        add(...s.start, reach);
        for (const seg of s.segments) {
          if (seg[0] === 'A') {
            const [, cx, cy, r] = seg;
            add(cx, cy, r + reach);
          } else {
            for (let i = 1; i < seg.length; i += 2) add(seg[i], seg[i + 1], reach);
          }
        }
      }
    }
  }
  if (x0 === Infinity) return { x: 0, y: 0, w: 1, h: 1 };
  const x = Math.floor(x0 - pad);
  const y = Math.floor(y0 - pad);
  return { x, y, w: Math.ceil(x1 + pad) - x, h: Math.ceil(y1 + pad) - y };
}

// The smallest box holding all of `boxes` (for the frames of one piece).
export function unionBox(boxes) {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}
