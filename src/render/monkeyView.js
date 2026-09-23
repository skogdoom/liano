import { Graphics } from 'pixi.js';
import { MONKEY_RADIUS } from '../config.js';

// Placeholder: the monkey is its hitbox circle.
export class MonkeyView {
  constructor() {
    this.view = new Graphics().circle(0, 0, MONKEY_RADIUS).fill(0x8b5a2b).stroke({ width: 2, color: 0x3d2512 });
  }

  update(monkey) {
    this.view.position.set(monkey.x, monkey.y);
  }
}
