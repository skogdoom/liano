import { frameName } from './piece.js';

// The atlas scales the build makes. The game picks the smallest that is sharp enough
// for the screen: device pixels per world unit, which is the layout's scale times the
// pixel ratio (a 1× set on a phone in landscape, 2× on most laptops, 4× on large HiDPI
// screens), allowing a little upscaling.
export const ATLAS_SCALES = [1, 2, 4];
export const UPSCALE_ALLOWED = 1.25;
export const atlasScaleFor = (density) => ATLAS_SCALES.find((s) => s * UPSCALE_ALLOWED >= density) ?? ATLAS_SCALES.at(-1);

// The size of a frame's cell in an atlas of `atlasScale`: the piece's box at its scale
// times the atlas scale (at least its `density`), rounded up (the view box grows with it,
// nothing is stretched). A tile is an image of its own at the atlas scale, up to its
// scale: the soft layers at 1× only (M1), the sharp ones in front up to 2×.
export const tileZoom = (piece, atlasScale) => Math.min(atlasScale, piece.scale);
export function cellOf(piece, atlasScale) {
  const zoom = piece.kind === 'tile' ? tileZoom(piece, atlasScale) : piece.scale * Math.max(atlasScale, piece.density ?? 1);
  return { zoom, w: Math.ceil(piece.box.w * zoom), h: Math.ceil(piece.box.h * zoom) };
}

// What the game needs to place a piece from an atlas of `atlasScale`: its frames' names,
// the anchor (the pivot, by default the drawing's origin, as a share of the cell) and how
// many atlas pixels make one unit.
export function placement(piece, atlasScale, pivot = [0, 0]) {
  const { zoom, w, h } = cellOf(piece, atlasScale);
  return {
    ...(piece.kind === 'tile' && { image: tileImage(piece, atlasScale) }),
    frames: piece.frames.map((_, i) => frameName(piece, i)),
    anchor: [((pivot[0] - piece.box.x) * zoom) / w, ((pivot[1] - piece.box.y) * zoom) / h],
    zoom,
    size: [w, h],
  };
}

// A tile's image file (under public/art/) at an atlas scale. It has TILE_EDGE more rows
// above and below the tile, copies of its first and last: a TileSprite wraps its texture
// up and down as well as sideways, so its top edge would otherwise blend in the bottom
// row (and the reverse); the game shows only the rows between.
export const TILE_EDGE = 1;
export const tileImage = (piece, atlasScale) => `tiles/${piece.key}@${tileZoom(piece, atlasScale)}x.png`;
