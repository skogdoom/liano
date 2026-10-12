import { RecordingGraphics } from './recorder.js';
import { bounds, toSvg, unionBox } from './svg.js';

// The pre-rendered art's sources (PHASER_PLAN.md, section 5): each piece's drawing code
// run through a RecordingGraphics, its frames as SVG documents. Returns the files (name
// under art/generated/ -> SVG) and the manifest describing them. Written by
// `npm run art` (scripts/art.mjs); a test checks the committed files match.
export function generateArt(pieces) {
  const files = {};
  const manifest = [];
  for (const piece of pieces) {
    const recorded = piece.frames.map((draw) => {
      const g = new RecordingGraphics();
      draw(g);
      return g.instructions;
    });
    const box = piece.box ?? unionBox(recorded.map((instructions) => bounds(instructions)));
    const frames = recorded.map((instructions, i) => {
      const file = piece.frames.length === 1 ? `${piece.key}.svg` : `${piece.key}.${i}.svg`;
      files[file] = toSvg(instructions, box);
      return `generated/${file}`;
    });
    manifest.push({
      key: piece.key,
      frames,
      // In the piece's own units: its origin is at (-box.x, -box.y) in the picture.
      box,
      scale: piece.scale,
      tint: piece.tint,
    });
  }
  return { files, manifest: `${JSON.stringify({ pieces: manifest }, null, 2)}\n` };
}
