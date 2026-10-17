// The mute and full-screen buttons: plain drawing and placement data. They sit
// in the top-left corner inside the safe area, scaled by the layout's `ui`; their tap
// targets are in controls.js.

const CREAM = 0xf4e7c5;
const OUTLINE = 0x2a1a0c;

// Where each icon's top-left corner is, in the buttons' coordinates.
export const MUTE_ICON = { x: 20, y: 16 };
export const FULLSCREEN_ICON = { x: 98, y: 17 };

// The speaker, its sound waves (on) and a cross (muted), from its top-left corner.
export function drawSpeaker(g) {
  return g.poly([0, 12, 10, 12, 22, 2, 22, 38, 10, 28, 0, 28]).fill(CREAM).stroke({ width: 2, color: OUTLINE, join: 'round' });
}

export function drawSpeakerWaves(g) {
  return g.arc(24, 20, 8, -0.8, 0.8).stroke({ width: 3, color: CREAM, cap: 'round' }).arc(24, 20, 15, -0.8, 0.8).stroke({ width: 3, color: CREAM, cap: 'round' });
}

export function drawSpeakerCross(g) {
  return g.moveTo(28, 12).lineTo(42, 28).moveTo(42, 12).lineTo(28, 28).stroke({ width: 3.5, color: CREAM, cap: 'round' });
}

const SIZE = 38;
const ARM = 12;

// Four corner brackets: in the corners pointing out to enter full screen, pulled in
// and pointing at the corners to leave it.
export function drawCorners(g, inward, style) {
  for (const [cx, cy, dx, dy] of [
    [0, 0, 1, 1],
    [SIZE, 0, -1, 1],
    [0, SIZE, 1, -1],
    [SIZE, SIZE, -1, -1],
  ]) {
    const x = inward ? cx + dx * ARM : cx;
    const y = inward ? cy + dy * ARM : cy;
    const sx = inward ? -dx : dx;
    const sy = inward ? -dy : dy;
    g.moveTo(x + sx * ARM, y).lineTo(x, y).lineTo(x, y + sy * ARM);
  }
  return g.stroke({ cap: 'round', join: 'round', ...style });
}

// A cream icon over a dark outline, like the speaker.
export const FULLSCREEN_STROKES = [
  { width: 7, color: OUTLINE },
  { width: 4, color: CREAM },
];
