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
