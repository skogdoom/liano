import { describe, expect, it } from 'vitest';
import { ObjectExposure, expandExposure } from '../src/render/world/objectExposure.js';

const quad = (x, y = 0) => new Float32Array([x, y, x, y + 10, x + 20, y + 10, x + 20, y]);
const frame = () => ({ u0: 0.2, v0: 0.3, u1: 0.4, v1: 0.5 });

describe('obstacle screen exposure', () => {
  it('uses screen travel in either direction, with a half-frame shutter and CSS cap', () => {
    for (const ratio of [1, 2]) for (const direction of [-1, 1]) {
      const state = new ObjectExposure(), image = {};
      state.begin(1 / 60, ratio); state.sample(image, quad(0));
      state.begin(1 / 60, ratio);
      let data = state.sample(image, quad(direction * 2 * ratio));
      expect(data.dx / ratio).toBe(direction);
      state.begin(1 / 60, ratio);
      data = state.sample(image, quad(direction * 12 * ratio));
      expect(data.dx / ratio).toBe(direction * 3);
    }
  });

  it('preserves diagonal direction', () => {
    const state = new ObjectExposure(), image = {};
    state.begin(1 / 60, 1); state.sample(image, quad(0));
    state.begin(1 / 60, 1);
    const data = state.sample(image, quad(6, 8));
    expect(data.dx).toBeCloseTo(1.8); expect(data.dy).toBeCloseTo(2.4);
  });

  it('keeps new/still/paused/stalled/reset/skipped/teleported/flipped poses sharp', () => {
    const state = new ObjectExposure(), image = {};
    const sample = (q, dt = 1 / 60) => { state.begin(dt, 1); return state.sample(image, q).dx; };
    expect(sample(quad(0))).toBe(0);
    expect(sample(quad(0))).toBe(0);
    expect(sample(quad(10), 0)).toBe(0);
    expect(sample(quad(20), 0.1)).toBe(0);
    state.reset(); expect(sample(quad(30))).toBe(0);
    state.begin(1 / 60, 1); expect(sample(quad(40))).toBe(0);
    expect(sample(quad(400))).toBe(0);
    const flipped = quad(410); [flipped[0], flipped[2], flipped[4], flipped[6]] = [430, 430, 410, 410];
    expect(sample(flipped)).toBe(0);
    state.config.enabled = false; expect(sample(quad(420))).toBe(0);
  });

  it('does not consume history on duplicate rendering of a frame', () => {
    const state = new ObjectExposure(), image = {};
    state.begin(1 / 60, 1); state.sample(image, quad(0));
    state.begin(1 / 60, 1);
    expect(state.sample(image, quad(10)).dx).toBe(3);
    expect(state.sample(image, quad(10)).dx).toBe(3);
  });

  it('expands silhouettes, retaining the original atlas frame boundary', () => {
    const q = quad(20), uv = frame(), attributes = new Float32Array(6);
    expandExposure(q, uv, 6, 0, attributes);
    expect([...q]).toEqual([17, 0, 17, 10, 43, 10, 43, 0]);
    expect(attributes[0]).toBeCloseTo(0.06);
    expect([...attributes.slice(2)]).toEqual([expect.closeTo(0.2), expect.closeTo(0.3), expect.closeTo(0.4), expect.closeTo(0.5)]);
    expect(uv.u0).toBeCloseTo(0.17); expect(uv.u1).toBeCloseTo(0.43);
  });

  it('inverts a rotated and scaled screen basis', () => {
    // 90-degree rotation, with 2× scale in x and 3× in y.
    const q = new Float32Array([0, 0, -30, 0, -30, 40, 0, 40]);
    const uv = frame(), attributes = new Float32Array(6);
    expandExposure(q, uv, 0, 6, attributes);
    expect(attributes[0]).toBeCloseTo(0.03);
    expect(attributes[1]).toBe(0);
    expect([...q]).toEqual([0, -3, -30, -3, -30, 43, 0, 43]);
  });

  it('orders inverted canvas UV boundaries while preserving motion direction', () => {
    const uv = { u0: 0.2, u1: 0.4, v0: 0.8, v1: 0.3 }, attributes = new Float32Array(6);
    expandExposure(quad(0), uv, 0, 2, attributes);
    expect(attributes[1]).toBeCloseTo(-0.1);
    expect(attributes[3]).toBeCloseTo(0.3); expect(attributes[5]).toBeCloseTo(0.8);
  });
});
