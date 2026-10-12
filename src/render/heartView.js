import { Container, Graphics, Text } from 'pixi.js';
import { RED_DARK, drawHeart } from '../views/hearts.js';
import { HUD_HEART_SIZE, heartCountFont, heartRow } from '../views/hud.js';

// The parts both versions share (pure: no Pixi) are in views/hearts.js.
export * from '../views/hearts.js';

// A row of hearts, right-aligned at its position.
export class HeartRow {
  constructor(size = HUD_HEART_SIZE) {
    this.size = size;
    this.view = new Container();
    this.hearts = new Container();
    const font = heartCountFont(size);
    this.count = new Text({
      text: '',
      style: {
        fontFamily: font.family,
        fontSize: font.size,
        fontWeight: font.weight,
        fill: 0xffffff,
        // Round joins, as the Phaser version strokes all text.
        stroke: { color: RED_DARK, width: font.stroke, join: 'round' },
      },
    });
    this.count.anchor.set(0.5);
    this.view.addChild(this.hearts, this.count);
    this.shown = null;
  }

  update(lives) {
    if (lives === this.shown) return;
    this.shown = lives;
    const row = heartRow(lives, this.size);
    for (const old of this.hearts.removeChildren()) old.destroy();
    for (const { x, filled } of row.hearts) {
      const heart = new Graphics();
      drawHeart(heart, this.size, filled);
      heart.position.set(x, 0);
      this.hearts.addChild(heart);
    }
    this.count.visible = row.count !== null;
    if (row.count) {
      this.count.text = row.count.text;
      this.count.position.set(row.count.x, row.count.y);
    }
  }
}
