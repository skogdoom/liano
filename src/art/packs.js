import { frameName } from './piece.js';
import { SPIDER_LEG_FRAMES } from './spiderPose.js';

const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

// The painted ghost needs more opacity against detailed scenery. Keep its vines
// and the classic pack at their original alpha; geometry/animation stay shared.
export const packAlpha = (id, piece) => id === 'cartoon' && piece.key.startsWith('monkey.shadow.') ? 0.56 : piece.alpha;

// Static variation is pack-specific; animation and attachment contracts stay fixed.
export const packFrameCount = (id, piece) => id === 'cartoon' && piece.key === 'rock.body' ? 6 : piece.frames.length;

// The green branch snake shares every placement/animation contract with copper.
const greenSnakeParts = new Set(['perchedSnake.head', 'perchedSnake.neck', 'perchedSnake.neckEnd', 'perchedSnake.band', 'perchedSnake.tail']);
export function packPieces(id, pieces) {
  if (id !== 'cartoon') return pieces;
  return [...pieces, ...pieces.filter(p => greenSnakeParts.has(p.key)).map(piece => {
    const p = structuredClone(piece);
    p.key = p.key.replace('perchedSnake.', 'perchedSnake.green.');
    p.purpose = `Green palette of ${piece.key}; identical geometry and attachment points.`;
    p.frames = p.frames.map((_, i) => `generated/${frameName(p, i)}.svg`);
    return p;
  }), {
    key: 'spider.legs',
    purpose: 'The painted spider\'s eight legs, antialiased as complete poses rather than rotated strips.',
    kind: 'sprite', set: 'main', scale: pieces.find(p => p.key === 'spider.body').scale, tint: false,
    box: { x: -32, y: -22, w: 64, h: 54 },
    frames: Array.from({ length: SPIDER_LEG_FRAMES }, (_, i) => `generated/spider.legs.${i}.svg`),
  }];
}

// Coverage is strict: a partial cartoon pack must never be shipped with an
// implicit classic fallback. The baseline also fixes all rig/animation contracts.
export function validatePack(baseline, manifest, id, sidecars = {}) {
  const errors = [];
  const seen = new Set();
  const byKey = new Map(packPieces(id, baseline.pieces).map((p) => [p.key, p]));
  for (const piece of manifest.pieces) {
    if (seen.has(piece.key)) errors.push(`Duplicate piece: ${piece.key}`);
    seen.add(piece.key);
    const expected = byKey.get(piece.key);
    if (!expected) {
      if (piece.key !== 'ui.wordmark' || id !== 'cartoon') errors.push(`Unexpected piece: ${piece.key}`);
      else if (piece.kind !== 'sprite' || piece.set !== 'boot' || piece.frames.length !== 1 || piece.scale !== 1 || piece.tint !== false || !same(piece.box, { x: -160, y: -40, w: 320, h: 80 })) errors.push('ui.wordmark: incompatible presentation contract');
    } else {
      for (const key of ['kind', 'set', 'box', 'scale', 'tint', 'alpha', 'density', 'soften', 'attach', 'slices', 'length', 'fps', 'hitbox']) {
        if (!same(piece[key], key === 'alpha' ? packAlpha(id, expected) : expected[key])) errors.push(`${piece.key}: incompatible ${key}`);
      }
      if (piece.frames.length !== packFrameCount(id, expected)) errors.push(`${piece.key}: wrong frame count`);
    }
    const frames = new Set();
    for (let i = 0; i < piece.frames.length; i++) {
      const key = frameName(piece, i);
      if (frames.has(piece.frames[i])) errors.push(`${key}: duplicate source`);
      frames.add(piece.frames[i]);
      if (typeof piece.frames[i] !== 'string' || !/^generated\/[\w.-]+\.svg$/.test(piece.frames[i])) errors.push(`${key}: invalid source`);
      else if (piece.frames[i] !== `generated/${key}.svg`) errors.push(`${key}: wrong frame source order`);
    }
  }
  for (const key of byKey.keys()) if (!seen.has(key)) errors.push(`Missing piece: ${key}`);
  if (id === 'cartoon' && (manifest.presentation?.title !== 'ui.wordmark' || !seen.has('ui.wordmark'))) errors.push('Missing cartoon title presentation');
  if (id === 'cartoon') for (const [key, sidecar] of Object.entries(sidecars)) {
    if (sidecar.pivot && (sidecar.pivot[0] !== 0 || sidecar.pivot[1] !== 0)) errors.push(`${key}: incompatible pivot`);
    if (sidecar.fps !== undefined && sidecar.fps !== byKey.get(key)?.fps) errors.push(`${key}: incompatible fps`);
  }
  return errors;
}
