import { Container, Graphics } from 'pixi.js';
import { FULLSCREEN_HIT, inside } from '../controls.js';

const CREAM = 0xf4e7c5;
const OUTLINE = 0x2a1a0c;
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
function icon(inward) {
  const view = new Container();
  view.addChild(...FULLSCREEN_STROKES.map((style) => drawCorners(new Graphics(), inward, style)));
  return view;
}

// Full-screen toggle next to the speaker; hidden where full screen is unavailable.
export class FullscreenButton {
  constructor() {
    this.view = new Container();
    this.view.position.set(98, 17);
    this.enter = icon(false);
    this.leave = icon(true);
    this.view.addChild(this.enter, this.leave);
    this.update(false);
  }

  contains(x, y) {
    return this.view.visible && inside(FULLSCREEN_HIT, { x, y });
  }

  update(active) {
    this.enter.visible = !active;
    this.leave.visible = active;
  }
}
