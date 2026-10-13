import { buildMovingRig, MOVING_RIGS } from './moving.js';
import { mixSeed, mulberry32 } from '../../sim/rng.js';
import { Builder, makeContainer } from './build.js';
import { buildStaticRig, STATIC_RIGS } from './obstacles.js';
import { templeRig } from './temple.js';

// The obstacles of a world in the Phaser version (as the Pixi ObstacleViews): a rig per
// obstacle, built when it first shows and dropped when the world lets it go.
export class ObstacleLayer {
  constructor(scene, art) {
    this.scene = scene;
    this.art = art;
    this.view = makeContainer(scene);
    this.rigs = new Map(); // obstacle -> { view, update } (null: not drawn yet)
  }

  // Builds the rig for `o` (null for a kind with no rig).
  build(o) {
    if (o.moving && MOVING_RIGS[o.type]) return buildMovingRig(this.scene, this.art, o);
    if (STATIC_RIGS[o.type]) return buildStaticRig(this.scene, this.art, o);
    if (o.type === 'temple') return templeRig(new Builder(this.scene, this.art), o, mulberry32(mixSeed(0x0b57, o.gap)));
    return null;
  }

  // `time` is the interpolated drawing time (s), or each model's own time when
  // omitted (the standalone parity fixtures); `tint` the background's,
  // which the temple takes (but not its fire).
  update(obstacles, time = null, tint = 0xffffff) {
    const seen = new Set();
    for (const o of obstacles) {
      if (!o) continue;
      seen.add(o);
      let rig = this.rigs.get(o);
      if (rig === undefined) {
        rig = this.build(o);
        this.rigs.set(o, rig);
        globalThis.__frameNote?.(`new ${o.type}${o.decoration ? ` ${o.decoration}` : ''}`); // ?frames=1 (frameStats.js)
        if (rig) this.view.add(rig.view);
      }
      rig?.update?.(time ?? o.time, tint);
    }
    for (const [o, rig] of this.rigs) {
      if (seen.has(o)) continue;
      rig?.view.destroy();
      this.rigs.delete(o);
    }
  }
}
