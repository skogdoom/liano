import { describe, it, expect } from 'vitest';
import { Camera } from '../src/render/camera.js';
import { CAMERA_LERP, CAMERA_TARGET_X } from '../src/config.js';

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

describe('the smoother shared camera', () => {
  const smooth = () => new Camera(0, 0, { lags: 2, rate: CAMERA_LERP * 2 });

  it('eases into a target change in either direction without overshooting', () => {
    for (const direction of [-1, 1]) {
      const camera = smooth();
      const moves = [];
      for (let i = 0; i < 120; i++) {
        const previous = camera.x;
        camera.update(direction * 700, 1 / 120);
        moves.push(direction * (camera.x - previous));
        expect(direction * camera.x).toBeGreaterThanOrEqual(0);
        expect(direction * camera.x).toBeLessThanOrEqual(700);
      }
      expect(moves[0]).toBeLessThan(6);
      expect(moves[1]).toBeGreaterThan(moves[0]);
      expect(direction * camera.x).toBeGreaterThan(699.9);
    }
  });

  it('keeps the original shared-camera delay during steady forward travel', () => {
    const original = new Camera(0, 0, { lags: 1 });
    const camera = smooth();
    for (let i = 1; i <= 1200; i++) {
      original.update(i * 1000 / 120, 1 / 120);
      camera.update(i * 1000 / 120, 1 / 120);
    }
    expect(Math.abs(camera.x - original.x)).toBeLessThan(0.1);
  });

  it('keeps the configured response independent of simulation step size', () => {
    const a = smooth(), b = smooth();
    a.update(700, 0.1);
    for (let i = 0; i < 12; i++) b.update(700, 0.1 / 12);
    expect(a.x).toBeCloseTo(b.x, 9);
  });
});

describe('the swing target (what a landscape pane follows)', () => {
  const liana = { x: 1000 };
  const hang = (x) => ({ state: 'HANGING', liana, x });
  const fly = (x) => ({ state: 'AIRBORNE', liana: null, x });

  it('follows a share of the swing about the anchor', async () => {
    const { SwingTarget } = await import('../src/render/camera.js');
    const target = new SwingTarget(0.75);
    expect(target.of(hang(1000), 'monkey', 1 / 120)).toBe(1000);
    for (let i = 0; i < 600; i++) target.of(hang(1100), 'monkey', 1 / 120);
    expect(target.of(hang(1100), 'monkey', 1 / 120)).toBeCloseTo(1075, 6);
    expect(new SwingTarget(1).of(hang(1100), 'monkey', 0)).toBe(1100);
  });

  it('never jumps at a release or a catch, and closes in on what it follows', async () => {
    const { SwingTarget } = await import('../src/render/camera.js');
    const target = new SwingTarget(0.5);
    let last = target.of(hang(1200), 'monkey', 1 / 120); // 1100
    const steps = [...Array(60).fill(fly(1250)), ...Array(240).fill(hang(1300))];
    for (const monkey of steps) {
      const next = target.of(monkey, 'monkey', 1 / 120);
      expect(Math.abs(next - last)).toBeLessThan(3);
      last = next;
    }
    expect(last).toBeCloseTo(1150, 0); // the anchor plus half the swing
  });

  it('follows the anchor in portrait', async () => {
    const { SwingTarget } = await import('../src/render/camera.js');
    expect(new SwingTarget(0.75).of(hang(1100), 'anchor', 1 / 120)).toBe(1000);
  });
});
