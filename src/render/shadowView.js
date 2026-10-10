import { Container, Graphics } from 'pixi.js';
import { MonkeyView } from './monkeyView.js';
import { drawLiana, leafLayout } from './lianaView.js';

// The shadow monkey (see Game.shadowFrame): a grey, see-through monkey on lianas of its
// own, grey and see-through too, as it swung on them in the best earlier game: the one it
// hangs on and those it let go of that still sway.
export const SHADOW_FUR = { fur: 0xb8bfc4, furDark: 0x8b949a, skin: 0xd5dadd };
export const SHADOW_LIANA = { ropeDark: 0x4d565b, rope: 0x929ca1, leaf: 0x7c868c, leafDark: 0x626c72 };
export const SHADOW_ALPHA = 0.36;

export class ShadowView {
  constructor() {
    this.view = new Container();
    this.view.alpha = SHADOW_ALPHA;
    this.view.visible = false;
    // A layer for the lianas, behind the monkey: one Graphics for each that sways at once.
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
      const liana = frame.lianas[i];
      g.visible = liana !== undefined;
      if (!liana) return;
      if (!this.layouts.has(liana.index)) this.layouts.set(liana.index, leafLayout(liana.index));
      drawLiana(g.clear(), liana, this.layouts.get(liana.index), false, SHADOW_LIANA);
    });
  }

  destroy() {
    this.view.destroy({ children: true });
  }
}
