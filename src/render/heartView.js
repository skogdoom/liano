import { Container, Graphics, Text } from 'pixi.js';
import { RED_DARK, drawHeart, heartsFor } from '../views/hearts.js';

// The parts both versions share (pure: no Pixi) are in views/hearts.js.
export * from '../views/hearts.js';

// A row of hearts, right-aligned at its position.
export class HeartRow {
  constructor(size = 11) {
    this.size = size;
    this.view = new Container();
    this.hearts = new Container();
    this.count = new Text({
      text: '',
      style: {
        fontFamily: 'sans-serif',
        fontSize: Math.round(size * 1.05),
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: RED_DARK, width: 3 },
      },
    });
    this.count.anchor.set(0.5);
    this.view.addChild(this.hearts, this.count);
    this.shown = null;
  }

  update(lives) {
    if (lives === this.shown) return;
    this.shown = lives;
    const { filled, empty, count } = heartsFor(lives);
    const spacing = this.size * 2.3;
    const total = filled + empty;
    for (const old of this.hearts.removeChildren()) old.destroy();
    for (let i = 0; i < total; i++) {
      const x = -(total - 1 - i) * spacing;
      const heart = new Graphics();
      drawHeart(heart, this.size, i < filled);
      heart.position.set(x, 0);
      this.hearts.addChild(heart);
    }
    this.count.visible = count > 0;
    if (count > 0) {
      this.count.text = String(count);
      // At the top left corner of the leftmost heart.
      this.count.position.set(-(total - 1) * spacing - this.size * 0.95, -this.size * 0.85);
    }
  }
}
