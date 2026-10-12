import { PNG_MIN_DENSITY } from './custom.js';

// The art guide (art/README.md), written from the manifest by `npm run art`: how to
// replace a piece of the game's art, and every piece's contract.

const ORDER = ['backdrop', 'monkey', 'liana', 'banana', 'heart', 'ui', 'support', 'branch', 'panther'];
const fmt = (n) => String(Math.round(n * 100) / 100);

function row(piece) {
  const frames = piece.frames.length;
  const files = frames === 1 ? `\`${piece.key}\`` : `\`${piece.key}.0\` … \`.${frames - 1}\``;
  const traits = [
    piece.kind !== 'sprite' && piece.kind,
    piece.tint && 'tinted',
    piece.alpha !== undefined && `see-through (${Math.round(piece.alpha * 100)} %)`,
    piece.fps && `${piece.fps} fps`,
    piece.attach && `joins: ${Object.keys(piece.attach).join(', ')}`,
    piece.hitbox && 'hitbox',
  ].filter(Boolean);
  const cell = (text) => String(text).replace(/\|/g, '\\|');
  return `| ${files} | ${fmt(piece.box.w)} × ${fmt(piece.box.h)} | ${fmt(piece.scale)} | ${traits.join(', ')} | ${cell(piece.purpose)} |`;
}

export function artGuide(manifestJson) {
  const { pieces } = JSON.parse(manifestJson);
  const groups = new Map();
  for (const piece of pieces) {
    const group = piece.key.split('.')[0];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(piece);
  }
  const rank = (g) => (ORDER.includes(g) ? ORDER.indexOf(g) : ORDER.length);
  const names = [...groups.keys()].sort((a, b) => rank(a) - rank(b));
  const frames = pieces.reduce((n, p) => n + p.frames.length, 0);
  return `<!-- Written by \`npm run art\` from the pieces in src/art/pieces/: do not edit by hand. -->

# The game's art

Every picture in the game is a **piece**: a part of an object (a monkey's arm, a bird's
wing, a temple's base) drawn by the game's own code. \`npm run art\` writes each piece's
pictures into \`generated/\` as SVG, and the build turns them into the textures the game
loads. There are ${pieces.length} pieces, ${frames} pictures in all.

## Replacing a piece

Put your picture in \`custom/\`, named after the piece: \`custom/<key>.svg\` or
\`custom/<key>.png\`. A piece with several frames (a flipbook: a wing beating, a flame
flickering) needs one file per frame, \`custom/<key>.<frame>.svg\`, numbered from 0. The
build then uses yours instead of the generated one; nothing else changes.

- **Start from the generated SVG.** Open \`generated/<key>.svg\` (or \`<key>.<frame>.svg\`) in
  your editor. Its size is the piece's **box**, in the game's units; draw inside it. A
  hidden layer, *Guides*, shows the box, the **origin** (the magenta cross: the point the
  game places, turns and scales the piece about), the obstacle's **hitbox** (green: what
  actually hits a player), the **joins** where other pieces attach (orange) and, for a
  panel, the **slices**. Show it while you draw; it is never rendered.
- **Keep the box's proportions.** Your picture is stretched over the box, so its aspect
  must be the box's (within 2 %).
- **A PNG must be at least ${PNG_MIN_DENSITY}× the box** in pixels (a 40 × 20 box needs 80 × 40 or more):
  the game draws pieces larger than their units on sharp screens. SVG has no such limit.
- **Keep the origin where it is**, or say where yours is: a file \`custom/<key>.json\`
  beside it may set \`"pivot": [x, y]\` (in the box's units) and, for a flipbook that plays
  at a rate, \`"fps"\`.
- **Tinted** pieces (the backdrop, the temple) are multiplied by the time of day's colour:
  draw them as they look by day.
- **See-through** pieces (the shadow monkey and its lianas) are drawn as they show: each
  shape at the given share of its opacity, so the shapes behind show through.
- **Strips** (ropes, vines, necks) are bent along a curve: draw them straight along +x.
  **Tiles** (the backdrop layers) repeat sideways: their left and right edges must meet.
  **Slices** (panels) keep their corners and stretch their edges and middle.
- A **hitbox** is the game's: art that strays far from it misleads players about what
  hits them. \`npm run art:check\` warns about that.

Check your work with \`npm run art:check\` (it says what is wrong with a file), then
\`npm run dev\` and the gallery at \`/art.html\`, which shows every piece next to the
game's drawing of it.

## The pieces

Sizes are the box in game units; *scale* is the largest the game draws the piece at
(before the screen's own density).

${names
  .map(
    (name) => `### ${name}

| Files | Box | Scale | | What it is |
| --- | --- | --- | --- | --- |
${groups.get(name).map(row).join('\n')}
`,
  )
  .join('\n')}`;
}
