import { Container, Graphics } from 'pixi.js';

const CREAM = 0xf4e7c5;
const OUTLINE = 0x2a1a0c;
// Tap target in logical pixels: larger than the icon, since a phone shows the game
// at about half size. The fullscreen button's starts where it ends.
const HIT = { x: 0, y: 0, w: 90, h: 90 };

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
    return x >= HIT.x && x <= HIT.x + HIT.w && y >= HIT.y && y <= HIT.y + HIT.h;
  }

  update(muted) {
    this.waves.visible = !muted;
    this.cross.visible = muted;
  }
}
