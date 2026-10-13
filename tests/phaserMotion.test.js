import { describe, it, expect } from 'vitest';
import { SIM_DT } from '../src/config.js';
import { World } from '../src/sim/world.js';
import { WorldMotion } from '../src/phaser/world/motion.js';
import { LianaState } from '../src/sim/liana.js';

const world = () => new World({ seed: 1, makeObstacle: () => null, makeBanana: () => null });
const step = (w, motion) => { w.step(SIM_DT); motion.capture(); };

describe('Phaser drawing samples', () => {
  it('uses the latest adjacent steps, even after several steps in a frame', () => {
    const w = world(), motion = new WorldMotion(w);
    for (let i = 0; i < 5; i++) step(w, motion);
    for (const alpha of [0, 0.2, 0.75, 1]) expect(motion.at(alpha)).toBeCloseTo((4 + alpha) * SIM_DT, 12);
  });

  it('interpolates settling angle and bend velocity without altering the liana', () => {
    const w = world(), motion = new WorldMotion(w), l = w.monkey.liana;
    for (let i = 0; i < 20; i++) step(w, motion);
    w.monkey.release();
    const velocity = l.angularVelocity;
    step(w, motion);
    const before = { ...l };
    const drawn = motion.liana(l, 0.4);
    expect(drawn.state).toBe(LianaState.SETTLING);
    expect(drawn.angle).toBeCloseTo(l.prevAngle + (l.angle - l.prevAngle) * 0.4, 12);
    expect(drawn.angularVelocity).toBeCloseTo(velocity + (l.angularVelocity - velocity) * 0.4, 12);
    expect({ ...l }).toEqual(before);
  });

  it('holds its samples when capture is called without another simulation step', () => {
    const w = world(), motion = new WorldMotion(w);
    step(w, motion);
    const l = w.monkey.liana;
    const before = [motion.at(0.3), motion.liana(l, 0.3).angularVelocity];
    motion.capture();
    expect([motion.at(0.3), motion.liana(l, 0.3).angularVelocity]).toEqual(before);
  });

  it('starts a caught liana at its new swing rather than interpolating its old sway', () => {
    const w = world(), motion = new WorldMotion(w), l = w.monkey.liana;
    for (let i = 0; i < 20; i++) step(w, motion);
    w.monkey.release();
    step(w, motion);
    w.monkey.grab(l, 200);
    step(w, motion);
    expect(motion.liana(l, 0).angle).toBe(0);
    expect(motion.liana(l, 0).angularVelocity).toBe(l.angularVelocity);
  });

  it('keeps monkey position interpolation and supplies continuous tilt inputs', () => {
    const w = world(), motion = new WorldMotion(w), m = w.monkey;
    step(w, motion);
    m.release();
    step(w, motion);
    const vy = m.vy;
    step(w, motion);
    const drawn = motion.monkey(m, 0.25);
    expect(drawn.prevX).toBe(m.prevX);
    expect(drawn.x).toBe(m.x);
    expect(drawn.vy).toBeCloseTo(vy + (m.vy - vy) * 0.25, 12);
    expect(m.vy).not.toBe(drawn.vy);
    expect(motion.monkey(m, 0.8)).toBe(drawn); // stable identity for MonkeyPose easing
  });

  it('resets velocity samples when an idle liana is caught at its zero angle', () => {
    const w = world(), motion = new WorldMotion(w), next = w.lianas.get(1);
    w.monkey.release();
    w.monkey.grab(next, 200);
    step(w, motion);
    expect(next.prevAngle).toBe(0);
    expect(motion.liana(next, 0).angularVelocity).toBe(next.angularVelocity);
  });
});
