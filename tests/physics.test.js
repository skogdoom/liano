import { describe, it, expect } from 'vitest';
import {
  pendulumAngle,
  pendulumAngularVelocity,
  pendulumPosition,
  tangentialVelocity,
  ballisticStep,
  closestPointOnSegment,
  circleIntersectsSegment,
  circleIntersectsCircle,
  circleIntersectsRect,
} from '../src/sim/physics.js';

const A = 0.8;
const OMEGA = 3;
const R = 350;

describe('pendulum', () => {
  it('angle follows dir · A · sin(ωt)', () => {
    expect(pendulumAngle(0, 1, A, OMEGA)).toBe(0);
    expect(pendulumAngle(Math.PI / (2 * OMEGA), 1, A, OMEGA)).toBeCloseTo(A);
    expect(pendulumAngle(Math.PI / (2 * OMEGA), -1, A, OMEGA)).toBeCloseTo(-A);
  });

  it('angular velocity is the derivative of the angle', () => {
    const h = 1e-6;
    for (const t of [0, 0.2, 0.5, 1.1]) {
      const numeric = (pendulumAngle(t + h, -1, A, OMEGA) - pendulumAngle(t - h, -1, A, OMEGA)) / (2 * h);
      expect(pendulumAngularVelocity(t, -1, A, OMEGA)).toBeCloseTo(numeric, 5);
    }
  });

  it('position hangs straight down at angle 0 and swings towards +x for positive angles', () => {
    expect(pendulumPosition(100, -20, R, 0)).toEqual({ x: 100, y: -20 + R });
    const p = pendulumPosition(100, -20, R, 0.5);
    expect(p.x).toBeGreaterThan(100);
  });

  it('tangential velocity is the derivative of the hanging position', () => {
    const h = 1e-6;
    for (const dir of [1, -1]) {
      for (const t of [0, 0.15, 0.4, 0.9, 1.3]) {
        const pos = (time) => pendulumPosition(0, 0, R, pendulumAngle(time, dir, A, OMEGA));
        const p0 = pos(t - h);
        const p1 = pos(t + h);
        const v = tangentialVelocity(R, pendulumAngle(t, dir, A, OMEGA), pendulumAngularVelocity(t, dir, A, OMEGA));
        expect(v.vx).toBeCloseTo((p1.x - p0.x) / (2 * h), 3);
        expect(v.vy).toBeCloseTo((p1.y - p0.y) / (2 * h), 3);
      }
    }
  });

  it('tangential velocity is perpendicular to the rope', () => {
    const angle = 0.6;
    const v = tangentialVelocity(R, angle, 2);
    expect(v.vx * Math.sin(angle) + v.vy * Math.cos(angle)).toBeCloseTo(0);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(R * 2);
  });
});

describe('ballisticStep', () => {
  it('applies gravity to velocity before moving', () => {
    const body = { x: 0, y: 0, vx: 100, vy: -50 };
    ballisticStep(body, 0.1, 1000);
    expect(body).toEqual({ x: 10, y: 5, vx: 100, vy: 50 });
  });
});

describe('segment tests', () => {
  it('finds the closest point and clamps to the ends', () => {
    expect(closestPointOnSegment(5, 3, 0, 0, 0, 10)).toEqual({ x: 0, y: 3, t: 0.3 });
    expect(closestPointOnSegment(5, -4, 0, 0, 0, 10)).toEqual({ x: 0, y: 0, t: 0 });
    expect(closestPointOnSegment(5, 14, 0, 0, 0, 10)).toEqual({ x: 0, y: 10, t: 1 });
  });

  it('handles a degenerate segment', () => {
    expect(closestPointOnSegment(3, 4, 1, 1, 1, 1)).toEqual({ x: 1, y: 1, t: 0 });
  });

  it('detects circle–segment intersection', () => {
    expect(circleIntersectsSegment(20, 50, 22, 0, 0, 0, 100)).toBe(true);
    expect(circleIntersectsSegment(23, 50, 22, 0, 0, 0, 100)).toBe(false);
    // Near the tip: distance to the end point, not to the infinite line.
    expect(circleIntersectsSegment(15, 115, 22, 0, 0, 0, 100)).toBe(true);
    expect(circleIntersectsSegment(15, 120, 22, 0, 0, 0, 100)).toBe(false);
  });
});

describe('circle tests', () => {
  it('detects circle–circle overlap, touching counts', () => {
    expect(circleIntersectsCircle(0, 0, 10, 25, 0, 15)).toBe(true);
    expect(circleIntersectsCircle(0, 0, 10, 25.01, 0, 15)).toBe(false);
  });

  it('detects circle–rect overlap on edges and corners', () => {
    // Rect from (0, 0) to (100, 20).
    expect(circleIntersectsRect(50, 10, 5, 0, 0, 100, 20)).toBe(true); // inside
    expect(circleIntersectsRect(50, -9, 10, 0, 0, 100, 20)).toBe(true); // above the top edge
    expect(circleIntersectsRect(50, -11, 10, 0, 0, 100, 20)).toBe(false);
    expect(circleIntersectsRect(107, 27, 10, 0, 0, 100, 20)).toBe(true); // near the corner: 7√2 < 10
    expect(circleIntersectsRect(108, 28, 10, 0, 0, 100, 20)).toBe(false); // 8√2 > 10
  });
});
