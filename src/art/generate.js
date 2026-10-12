import { frameName } from './piece.js';
import { RecordingGraphics } from './recorder.js';
import { bounds, guideLayer, toSvg, unionBox } from './svg.js';

// The pre-rendered art's sources (PHASER_PLAN.md, section 5): each piece's drawing code
// run through a RecordingGraphics, its frames as SVG documents with the piece's guides in
// a hidden layer. Returns the files (name under art/generated/ -> SVG) and the manifest:
// each piece's contract, which the build, the validator, the game and the art guide read.
// Written by `npm run art` (scripts/art.mjs); a test checks the committed files match.
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
    const contract = {
      key: piece.key,
      purpose: piece.purpose,
      kind: piece.kind,
      set: piece.set,
      // In the piece's own units: its origin is at (-box.x, -box.y) in the picture.
      box,
      scale: piece.scale,
      tint: piece.tint,
      ...(piece.fps !== undefined && { fps: piece.fps }),
      ...(piece.attach && { attach: piece.attach }),
      ...(piece.hitbox && { hitbox: piece.hitbox }),
      ...(piece.slices && { slices: piece.slices }),
      ...(piece.length !== undefined && { length: piece.length }),
    };
    const guides = guideLayer(contract);
    const frames = recorded.map((instructions, i) => {
      const file = `${frameName(piece, i)}.svg`;
      files[file] = toSvg(instructions, box, guides);
      return `generated/${file}`;
    });
    manifest.push({ ...contract, frames });
  }
  return { files, manifest: `${JSON.stringify({ pieces: manifest }, null, 2)}\n` };
}
