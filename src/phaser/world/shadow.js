import { LianaSetRig } from './lianas.js';
import { MonkeyRig } from './monkey.js';

// The shadow monkey in the Phaser version (as the Pixi ShadowView): the grey monkey on
// its own grey lianas, each liana fading in and out. They are see-through: the Pixi view
// blends each shape on its own at SHADOW_ALPHA, and so are the shadow's pieces drawn, so
// they show at full opacity here.
export class ShadowRig {
  constructor(scene, art) {
    this.view = scene.make.container({}, false).setVisible(false);
    this.lianas = new LianaSetRig(scene, art, 'shadow');
    this.monkey = new MonkeyRig(scene, art, 'shadow');
    this.view.add([this.lianas.view, this.monkey.view]);
  }

  // `frame`: the shadow's frame (from ShadowRun.frame), or null when there is none.
  update(frame, dt) {
    const wasVisible = this.view.visible;
    this.view.visible = frame !== null;
    if (!frame) return;
    // A new run starts from where the shadow is, not easing from the last one.
    if (!wasVisible) this.monkey.pose.monkey = null;
    this.monkey.update(frame, dt);
    const seen = new Set();
    for (const { liana, alpha } of frame.lianas) {
      seen.add(liana);
      const entry = this.lianas.entry(liana);
      // Drawn where it is each frame, as the Pixi view does.
      this.lianas.lay(entry, liana, false);
      this.lianas.setVisible(entry, true);
      this.lianas.setAlpha(entry, alpha);
    }
    this.lianas.prune(seen);
  }
}
