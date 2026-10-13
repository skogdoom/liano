import { buildMovingRig, MOVING_RIGS } from './moving.js';
import { mixSeed, mulberry32 } from '../../sim/rng.js';
import { Builder, makeContainer } from './build.js';
import { buildStaticRig, STATIC_RIGS } from './obstacles.js';
import { templeRig } from './temple.js';
import { exposeImages, exposureNodes } from './objectExposureShader.js';

// The obstacles of a world in the Phaser version (as the Pixi ObstacleViews): a rig per
// obstacle, built when it first shows and dropped when the world lets it go.
export class ObstacleLayer {
  constructor(scene, art, exposure = null) {
    this.scene = scene;
    this.art = art;
    this.view = makeContainer(scene);
    this.rigs = new Map(); // obstacle -> { view, update } (null: not drawn yet)
    this.exposure = exposure;
    this.exposureNodes = exposure ? exposureNodes(scene) : null;
  }

  // Builds the rig for `o` (null for a kind with no rig).
  build(o) {
    let rig = null;
    if (o.moving && MOVING_RIGS[o.type]) rig = buildMovingRig(this.scene, this.art, o);
    else if (STATIC_RIGS[o.type]) rig = buildStaticRig(this.scene, this.art, o);
    else if (o.type === 'temple') rig = templeRig(new Builder(this.scene, this.art), o, mulberry32(mixSeed(0x0b57, o.gap)));
    if (rig && this.exposure) exposeImages(rig.view, this.exposure, this.exposureNodes);
    return rig;
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
