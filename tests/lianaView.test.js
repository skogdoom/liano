import { describe, it, expect } from 'vitest';
import { LianaView } from '../src/render/lianaView.js';
import { Liana, LianaState } from '../src/sim/liana.js';
import { SIM_DT } from '../src/config.js';

describe('liana views', () => {
  const swinging = () => {
    const liana = new Liana(2, 1400);
    liana.grab(1);
    return liana;
  };

  it('draw a swinging liana once, and turn it about its anchor as it swings', () => {
    const liana = swinging();
    const view = new LianaView();
    view.update([liana], 1000);
    expect(view.redraws).toBe(1);
    const g = view.entries.get(liana).g;
    expect(g.position.x).toBe(liana.x);
    expect(g.position.y).toBe(liana.anchorY);
    for (let i = 0; i < 240; i++) {
      liana.step(SIM_DT);
      view.update([liana], 1000);
      expect(g.rotation).toBe(-liana.angle);
    }
    // A full swing and back, and it was never redrawn.
    expect(view.redraws).toBe(1);
    expect(Math.abs(g.rotation)).toBeGreaterThan(0.1);
  });

  it('puts the end of a turned liana where the old drawing put it: along its angle from the anchor', () => {
    const liana = swinging();
    const view = new LianaView();
    for (let i = 0; i < 90; i++) liana.step(SIM_DT);
    view.update([liana], 1000);
    const g = view.entries.get(liana).g;
    // The drawing hangs straight down from the origin; turned by -angle about the anchor it
    // ends at anchor + length · (sin angle, cos angle), where the liana's tip is.
    const tip = g.toGlobal({ x: 0, y: liana.length });
    expect(tip.x).toBeCloseTo(liana.x + liana.length * Math.sin(liana.angle), 6);
    expect(tip.y).toBeCloseTo(liana.anchorY + liana.length * Math.cos(liana.angle), 6);
  });

  it('redraw only when the look changes: not at rest, once swinging, each frame while settling', () => {
    const liana = new Liana(2, 1400);
    const view = new LianaView();
    view.update([liana], 1000);
    view.update([liana], 1000);
    expect(view.redraws).toBe(1); // at rest
    liana.grab(1);
    for (let i = 0; i < 60; i++) {
      liana.step(SIM_DT);
      view.update([liana], 1000);
    }
    expect(view.redraws).toBe(2); // swinging: one more
    liana.release();
    expect(liana.state).toBe(LianaState.SETTLING);
    const before = view.redraws;
    for (let i = 0; i < 20; i++) {
      liana.step(SIM_DT);
      view.update([liana], 1000);
    }
    expect(view.redraws).toBe(before + 20); // settling bends: redrawn as it moves
    const g = view.entries.get(liana).g;
    expect(g.rotation).toBe(0);
    expect(g.position.x).toBe(0);
  });

  it('light the tip by redrawing, only when it starts and stops flashing', () => {
    const liana = swinging();
    const view = new LianaView();
    const monkey = { liana, tipTime: 10 };
    view.update([liana], 1000, 1280, [monkey]);
    const first = view.redraws;
    monkey.tipTime = 0.1; // within the warning
    view.update([liana], 1000, 1280, [monkey]);
    view.update([liana], 1000, 1280, [monkey]);
    expect(view.redraws).toBeLessThanOrEqual(first + 1);
    monkey.tipTime = 10;
    view.update([liana], 1000, 1280, [monkey]);
    expect(view.redraws).toBeLessThanOrEqual(first + 2);
  });
});
