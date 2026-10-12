import { frameName } from './piece.js';

// The atlas scales the build makes. The game picks the smallest that is sharp enough
// for the screen: device pixels per world unit, which is the layout's scale times the
// pixel ratio (a 1× set on a phone in landscape, 2× on most laptops, 4× on large HiDPI
// screens), allowing a little upscaling.
export const ATLAS_SCALES = [1, 2, 4];
export const UPSCALE_ALLOWED = 1.25;
export const atlasScaleFor = (density) => ATLAS_SCALES.find((s) => s * UPSCALE_ALLOWED >= density) ?? ATLAS_SCALES.at(-1);

// The size of a frame's cell in an atlas of `atlasScale`: the piece's box at its scale
// times the atlas scale, rounded up (the view box grows with it, nothing is stretched).
// Tiles are rasterized at 1× only (soft scenery, M1).
export function cellOf(piece, atlasScale) {
  const zoom = piece.kind === 'tile' ? 1 : piece.scale * atlasScale;
  return { zoom, w: Math.ceil(piece.box.w * zoom), h: Math.ceil(piece.box.h * zoom) };
}

// What the game needs to place a piece from an atlas of `atlasScale`: its frames' names,
// the anchor (the pivot, by default the drawing's origin, as a share of the cell) and how
// many atlas pixels make one unit.
export function placement(piece, atlasScale, pivot = [0, 0]) {
  const { zoom, w, h } = cellOf(piece, atlasScale);
  return {
    frames: piece.frames.map((_, i) => frameName(piece, i)),
    anchor: [((pivot[0] - piece.box.x) * zoom) / w, ((pivot[1] - piece.box.y) * zoom) / h],
    zoom,
    size: [w, h],
  };
}
