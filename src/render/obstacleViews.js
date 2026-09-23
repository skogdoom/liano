import { Graphics } from 'pixi.js';

// Placeholder: each obstacle is drawn as its hitbox shapes, coloured by type.
const COLORS = {
  branch: { fill: 0x6b4423, stroke: 0x3b2412 },
  thornBush: { fill: 0x1f4d2b, stroke: 0x0f2616 },
  rock: { fill: 0x8a8f94, stroke: 0x4a4e52 },
};

export class ObstacleViews {
  constructor() {
    this.view = new Graphics();
  }

  update(obstacles) {
    const g = this.view.clear();
    for (const obstacle of obstacles) {
      if (!obstacle) continue;
      const { fill, stroke } = COLORS[obstacle.type];
      for (const s of obstacle.hitbox) {
        if (s.kind === 'rect') g.rect(obstacle.x + s.dx, obstacle.y + s.dy, s.w, s.h);
        else g.circle(obstacle.x + s.dx, obstacle.y + s.dy, s.r);
        g.fill(fill).stroke({ width: 2, color: stroke });
      }
    }
  }
}
