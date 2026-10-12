// What a piece of art is (PHASER_PLAN.md, section 5): its contract, from which the
// generator draws it, the build packs it and the game places it.
//
//   key       stable name: `object.part` or `object.part.variant` (lower camel case
//             words, dots between); custom art goes in art/custom/<key>.svg or .png
//   purpose   what it is, for the art guide (art/README.md)
//   frames    drawing functions (g) => void, one per frame (a flipbook has several);
//             each draws the piece about its origin, as the game's drawing code does
//   kind      'sprite' (in an atlas), 'strip' (a sprite bent along a rope: straight
//             along +x from its origin), 'slice' (a 9-slice panel), 'tile' (an image
//             of its own that repeats sideways: the backdrop layers)
//   set       'boot' (loaded before the title shows) or 'main'
//   scale     the largest scale the game draws it at (before the screen's), so it is
//             rasterized sharp enough
//   tint      whether the stage tint applies
//   box       the picture's box in the piece's own units (default: around the drawing)
//   fps       a flipbook's frame rate, if it plays at one (most are picked by the code)
//   attach    named points where other pieces join it: { name: [x, y] }
//   hitbox    the obstacle's hitbox shapes (OBSTACLE_HITBOXES), as a guide
//   slices    for 'slice': { left, right, top, bottom } in units
//   length    for 'strip': the length of the strip from its origin along +x

export const KINDS = ['sprite', 'strip', 'slice', 'tile'];
export const SETS = ['boot', 'main'];
const KEY = /^[a-z][a-zA-Z0-9]*(\.[a-z0-9][a-zA-Z0-9]*)+$/;

// Checks a piece definition and fills in the defaults. Throws on a mistake.
export function definePiece(piece) {
  const p = { kind: 'sprite', set: 'main', scale: 1, tint: false, ...piece };
  const fail = (message) => {
    throw new Error(`piece ${p.key ?? '(no key)'}: ${message}`);
  };
  if (!KEY.test(p.key ?? '')) fail('the key must be dotted lower camel case words, e.g. monkey.p1.arm');
  if (!p.purpose) fail('it needs a purpose, for the art guide');
  if (!Array.isArray(p.frames) || p.frames.length === 0 || !p.frames.every((f) => typeof f === 'function')) fail('frames must be drawing functions');
  if (!KINDS.includes(p.kind)) fail(`kind must be one of ${KINDS.join(', ')}`);
  if (!SETS.includes(p.set)) fail(`set must be one of ${SETS.join(', ')}`);
  if (!(p.scale > 0)) fail('scale must be positive');
  if (p.kind === 'slice' && !p.slices) fail('a slice piece needs its slices');
  if (p.kind === 'strip' && !(p.length > 0)) fail('a strip needs its length');
  if (p.kind === 'tile' && !p.box) fail('a tile needs its box (one repeat)');
  if (p.fps !== undefined && !(p.fps > 0 && p.frames.length > 1)) fail('fps is for flipbooks of several frames');
  return p;
}

// Checks a whole set of pieces: each defined well, and no key twice.
export function definePieces(pieces) {
  const seen = new Set();
  return pieces.map((piece) => {
    const p = definePiece(piece);
    if (seen.has(p.key)) throw new Error(`piece ${p.key}: defined twice`);
    seen.add(p.key);
    return p;
  });
}

// The name of frame `i` of a piece, as in the atlases and art/custom: the key alone for a
// piece of one frame, else key.i.
export const frameName = (piece, i) => (piece.frames.length === 1 ? piece.key : `${piece.key}.${i}`);
