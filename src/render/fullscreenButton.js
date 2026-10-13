import { Container, Graphics } from 'pixi.js';
import { FULLSCREEN_HIT, inside } from '../controls.js';
import { FULLSCREEN_ICON, FULLSCREEN_STROKES, drawCorners } from '../views/buttons.js';

// The parts both versions share (pure: no Pixi) are in views/buttons.js.
export { FULLSCREEN_STROKES, drawCorners } from '../views/buttons.js';

function icon(inward) {
  const view = new Container();
  view.addChild(...FULLSCREEN_STROKES.map((style) => drawCorners(new Graphics(), inward, style)));
  return view;
}

// Full-screen toggle next to the speaker; hidden where full screen is unavailable.
export class FullscreenButton {
  constructor() {
    this.view = new Container();
    this.view.position.set(FULLSCREEN_ICON.x, FULLSCREEN_ICON.y);
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
