import { Container, Graphics } from 'pixi.js';
import { MUTE_HIT, inside } from '../controls.js';

const CREAM = 0xf4e7c5;
const OUTLINE = 0x2a1a0c;
// Speaker icon in the top-left corner; tap or click it (or press M) to mute.
export class MuteButton {
  constructor() {
    this.view = new Container();
    this.view.position.set(20, 16);
    const speaker = new Graphics()
      .poly([0, 12, 10, 12, 22, 2, 22, 38, 10, 28, 0, 28])
      .fill(CREAM)
      .stroke({ width: 2, color: OUTLINE, join: 'round' });
    this.waves = new Graphics()
      .arc(24, 20, 8, -0.8, 0.8)
      .stroke({ width: 3, color: CREAM, cap: 'round' })
      .arc(24, 20, 15, -0.8, 0.8)
      .stroke({ width: 3, color: CREAM, cap: 'round' });
    this.cross = new Graphics()
      .moveTo(28, 12)
      .lineTo(42, 28)
      .moveTo(42, 12)
      .lineTo(28, 28)
      .stroke({ width: 3.5, color: CREAM, cap: 'round' });
    this.view.addChild(speaker, this.waves, this.cross);
    this.update(false);
  }

  contains(x, y) {
    return inside(MUTE_HIT, { x, y });
  }

  update(muted) {
    this.waves.visible = !muted;
    this.cross.visible = muted;
  }
}
