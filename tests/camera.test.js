import { describe, it, expect } from 'vitest';
import { Camera } from '../src/render/camera.js';
import { CAMERA_TARGET_X } from '../src/config.js';

describe('camera', () => {
  it('reset puts the target at CAMERA_TARGET_X on screen', () => {
    const camera = new Camera(1000);
    expect(1000 - camera.x).toBe(CAMERA_TARGET_X);
  });

  it('eases towards the target without overshooting', () => {
    const camera = new Camera(0);
    let previous = camera.x;
    for (let i = 0; i < 240; i++) {
      camera.update(500, 1 / 120);
      expect(camera.x).toBeGreaterThan(previous);
      expect(camera.x).toBeLessThanOrEqual(500 - CAMERA_TARGET_X);
      previous = camera.x;
    }
    expect(camera.x).toBeCloseTo(500 - CAMERA_TARGET_X, 3);
  });

  it('is independent of the step size', () => {
    const a = new Camera(0);
    const b = new Camera(0);
    a.update(800, 0.1);
    for (let i = 0; i < 12; i++) b.update(800, 0.1 / 12);
    expect(a.x).toBeCloseTo(b.x, 9);
  });

  it('follows backward too', () => {
    const camera = new Camera(0);
    for (let i = 0; i < 240; i++) camera.update(-900, 1 / 120);
    expect(camera.x).toBeCloseTo(-900 - CAMERA_TARGET_X, 3);
  });
});

describe('the pane camera (two lags) and the shared screen camera (one)', () => {
  // The camera's move in each of `steps` steps of `dt` after the target jumps by 300.
  const moves = (camera, steps = 6, dt = 1 / 120) => {
    const out = [];
    for (let i = 0; i < steps; i++) {
      const before = camera.x;
      camera.update(300, dt);
      out.push(camera.x - before);
    }
    return out;
  };

  it('a pane camera picks up speed gradually when its target jumps', () => {
    const steps = moves(new Camera(0));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(steps[0]).toBeLessThan(2);
  });

  it('the shared screen camera keeps one lag: fastest at once', () => {
    const steps = moves(new Camera(0, CAMERA_TARGET_X, { lags: 1 }));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
    expect(steps[0]).toBeGreaterThan(15);
  });

  it('is independent of the step size with one lag too', () => {
    const a = new Camera(0, CAMERA_TARGET_X, { lags: 1 });
    const b = new Camera(0, CAMERA_TARGET_X, { lags: 1 });
    a.update(800, 0.1);
    for (let i = 0; i < 12; i++) b.update(800, 0.1 / 12);
    expect(a.x).toBeCloseTo(b.x, 9);
  });
});
