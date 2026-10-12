import { Container, Graphics } from 'pixi.js';
import { MonkeyView } from './monkeyView.js';
import { drawLiana, leafLayout } from './lianaView.js';
import { SHADOW_FUR, SHADOW_LIANA, SHADOW_ALPHA } from '../views/shadow.js';

// The parts both versions share (pure: no Pixi) are in views/shadow.js.
export * from '../views/shadow.js';

export class ShadowView {
  constructor() {
    this.view = new Container();
    this.view.alpha = SHADOW_ALPHA;
    this.view.visible = false;
    // A layer for the lianas behind the monkey: a Graphics for each liana to draw at once.
    this.lianaLayer = new Container();
    this.lianas = [];
    this.layouts = new Map(); // liana index -> leaf layout
    this.monkey = new MonkeyView(SHADOW_FUR);
    this.view.addChild(this.lianaLayer, this.monkey.view);
  }

  // `frame`: the shadow's frame (from ShadowRun.frame), or null when there is none.
  update(frame, dt) {
    const wasVisible = this.view.visible;
    this.view.visible = frame !== null;
    if (!frame) return;
    // A new run starts from where the shadow is, not easing from the last one.
    if (!wasVisible) this.monkey.monkey = null;
    this.monkey.update(frame, dt);
    while (this.lianas.length < frame.lianas.length) {
      const g = new Graphics();
      this.lianas.push(g);
      this.lianaLayer.addChild(g);
    }
    this.lianas.forEach((g, i) => {
      const entry = frame.lianas[i];
      g.visible = entry !== undefined;
      if (!entry) return;
      const { liana } = entry;
      if (!this.layouts.has(liana.index)) this.layouts.set(liana.index, leafLayout(liana.index));
      drawLiana(g.clear(), liana, this.layouts.get(liana.index), false, SHADOW_LIANA);
      g.alpha = entry.alpha;
    });
  }

  destroy() {
    this.view.destroy({ children: true });
  }
}
