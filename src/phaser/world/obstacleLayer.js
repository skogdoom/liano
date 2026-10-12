import { buildStaticRig, STATIC_RIGS } from './obstacles.js';

// The obstacles of a world in the Phaser version (as the Pixi ObstacleViews): a rig per
// obstacle, built when it first shows and dropped when the world lets it go.
export class ObstacleLayer {
  constructor(scene, art) {
    this.scene = scene;
    this.art = art;
    this.view = scene.make.container({}, false);
    this.rigs = new Map(); // obstacle -> { view, update } (null: not drawn yet)
  }

  // Builds the rig for `o`, or null for the kinds the Phaser version does not draw yet.
  build(o) {
    if (STATIC_RIGS[o.type]) return buildStaticRig(this.scene, this.art, o);
    return null;
  }

  // `time` is the world time (s), for what moves on its own.
  update(obstacles, time = 0) {
    const seen = new Set();
    for (const o of obstacles) {
      if (!o) continue;
      seen.add(o);
      let rig = this.rigs.get(o);
      if (rig === undefined) {
        rig = this.build(o);
        this.rigs.set(o, rig);
        if (rig) this.view.add(rig.view);
      }
      rig?.update?.(time);
    }
    for (const [o, rig] of this.rigs) {
      if (seen.has(o)) continue;
      rig?.view.destroy();
      this.rigs.delete(o);
    }
  }
}
