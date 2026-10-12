// Custom art (PHASER_PLAN.md, section 5): art/custom/<key>.svg or .png replaces a piece
// (<key>.<frame>.svg or .png one frame of a flipbook), and an optional <key>.json beside
// it may change the pivot and, for a flipbook, the frame rate. Pure: the scripts read the
// files and pass them in (name -> Buffer).

export const IMAGE_TYPES = ['svg', 'png'];
// How far a picture's aspect may stray from its piece's box.
const ASPECT_TOLERANCE = 0.02;
// A PNG must be at least this many pixels per unit of the piece (twice its logical size).
export const PNG_MIN_DENSITY = 2;

// A picture's size: a PNG's from its header, an SVG's from its viewBox (or its width and
// height). Null if it cannot be read.
export function imageSize(name, data) {
  if (name.endsWith('.png')) {
    const signature = '89504e470d0a1a0a';
    if (data.length < 24 || data.subarray(0, 8).toString('hex') !== signature) return null;
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  const svg = data.toString('utf8');
  const tag = /<svg\b[^>]*>/.exec(svg)?.[0];
  if (!tag) return null;
  const viewBox = /viewBox\s*=\s*"([^"]+)"/.exec(tag)?.[1].trim().split(/[\s,]+/).map(Number);
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) return { width: viewBox[2], height: viewBox[3] };
  const attr = (n) => parseFloat(new RegExp(`\\b${n}\\s*=\\s*"([\\d.]+)`).exec(tag)?.[1]);
  const [width, height] = [attr('width'), attr('height')];
  return width > 0 && height > 0 ? { width, height } : null;
}

const frameNames = (piece) => (piece.frames.length === 1 ? [piece.key] : piece.frames.map((_, i) => `${piece.key}.${i}`));

// Which custom file replaces each frame of each piece, and what each sidecar changes,
// with every mistake found: { replace: { frameName: fileName }, sidecars: { key: {...} },
// errors: [...] }. `files` maps the names in art/custom to their contents.
export function readCustom(manifest, files) {
  const byKey = new Map(manifest.pieces.map((p) => [p.key, p]));
  const byFrame = new Map(manifest.pieces.flatMap((p) => frameNames(p).map((name, i) => [name, { piece: p, i }])));
  const replace = {};
  const sidecars = {};
  const errors = [];
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith('.') || name === 'README.md') continue;
    const ext = name.split('.').pop();
    const base = name.slice(0, -ext.length - 1);
    if (ext === 'json') {
      const piece = byKey.get(base);
      if (!piece) {
        errors.push(`${name}: no piece is called ${base}`);
        continue;
      }
      let sidecar;
      try {
        sidecar = JSON.parse(data.toString('utf8'));
      } catch {
        errors.push(`${name}: not valid JSON`);
        continue;
      }
      const problems = checkSidecar(piece, sidecar);
      errors.push(...problems.map((p) => `${name}: ${p}`));
      if (problems.length === 0) sidecars[base] = sidecar;
      continue;
    }
    if (!IMAGE_TYPES.includes(ext)) {
      errors.push(`${name}: not an SVG or a PNG`);
      continue;
    }
    const target = byFrame.get(base);
    if (!target) {
      const piece = byKey.get(base);
      errors.push(piece ? `${name}: ${base} has ${piece.frames.length} frames: give each its own file (${base}.0.${ext}, …)` : `${name}: no piece or frame is called ${base}`);
      continue;
    }
    if (replace[base]) {
      errors.push(`${name}: ${base} is replaced twice (${replace[base]} too)`);
      continue;
    }
    const problems = checkPicture(target.piece, name, data);
    errors.push(...problems.map((p) => `${name}: ${p}`));
    if (problems.length === 0) replace[base] = name;
  }
  return { replace, sidecars, errors };
}

// What is wrong with a picture for `piece`, if anything.
export function checkPicture(piece, name, data) {
  const size = imageSize(name, data);
  if (!size) return ['cannot read its size'];
  const { w, h } = piece.box;
  const problems = [];
  const aspect = size.width / size.height;
  if (Math.abs(aspect / (w / h) - 1) > ASPECT_TOLERANCE) {
    problems.push(`its aspect is ${size.width} × ${size.height}; the piece's box is ${w} × ${h} (draw it in that box)`);
  }
  if (name.endsWith('.png') && (size.width < w * PNG_MIN_DENSITY || size.height < h * PNG_MIN_DENSITY)) {
    problems.push(`a PNG must be at least ${w * PNG_MIN_DENSITY} × ${h * PNG_MIN_DENSITY} (twice the piece's ${w} × ${h})`);
  }
  return problems;
}

// What is wrong with a sidecar for `piece`, if anything: it may set `pivot` (a point in
// the piece's box, in its units) and, for a flipbook that plays at a rate, `fps`.
export function checkSidecar(piece, sidecar) {
  const problems = [];
  for (const key of Object.keys(sidecar)) if (!['pivot', 'fps'].includes(key)) problems.push(`${key} cannot be changed (only pivot and fps)`);
  if (sidecar.pivot !== undefined) {
    const [x, y] = Array.isArray(sidecar.pivot) ? sidecar.pivot : [];
    const { box } = piece;
    if (!Number.isFinite(x) || !Number.isFinite(y)) problems.push('pivot must be [x, y]');
    else if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) problems.push(`pivot [${x}, ${y}] is outside the box`);
  }
  if (sidecar.fps !== undefined) {
    if (piece.fps === undefined) problems.push('fps is for flipbooks that play at a rate; this piece is picked frame by frame');
    else if (!(sidecar.fps > 0 && sidecar.fps <= 60)) problems.push('fps must be between 0 and 60');
  }
  return problems;
}

// For a warning: how far a picture's drawn area (its opaque bounds, in the piece's units)
// strays from the obstacle's hitbox. Returns a message, or null when it is near enough:
// within `slack` (a share of the hitbox's size) on every side, and covering most of it.
export function hitboxStray(drawn, hitbox, slack = 0.5) {
  const xs = hitbox.flatMap((s) => (s.r !== undefined ? [s.dx - s.r, s.dx + s.r] : [s.dx, s.dx + s.w]));
  const ys = hitbox.flatMap((s) => (s.r !== undefined ? [s.dy - s.r, s.dy + s.r] : [s.dy, s.dy + s.h]));
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const [w, h] = [box.x1 - box.x0, box.y1 - box.y0];
  const out = Math.max(box.x0 - drawn.x0, drawn.x1 - box.x1, 0) / w + Math.max(box.y0 - drawn.y0, drawn.y1 - box.y1, 0) / h;
  const covered = (Math.max(0, Math.min(box.x1, drawn.x1) - Math.max(box.x0, drawn.x0)) * Math.max(0, Math.min(box.y1, drawn.y1) - Math.max(box.y0, drawn.y0))) / (w * h);
  if (out > slack) return `the art reaches well past the hitbox (players are hit only by the hitbox)`;
  if (covered < 0.5) return `the art covers only ${Math.round(covered * 100)} % of the hitbox (players can be hit where nothing shows)`;
  return null;
}
