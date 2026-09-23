import { Graphics } from 'pixi.js';

// Placeholder: each liana is a straight line at its current (possibly cosmetic) angle.
export class LianaView {
  constructor() {
    this.view = new Graphics();
  }

  update(lianas) {
    const g = this.view.clear();
    for (const liana of lianas) {
      g.moveTo(liana.x, liana.anchorY).lineTo(
        liana.x + liana.length * Math.sin(liana.angle),
        liana.anchorY + liana.length * Math.cos(liana.angle),
      );
    }
    g.stroke({ width: 5, color: 0x7fb843, cap: 'round' });
  }
}
