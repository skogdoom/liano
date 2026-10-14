import { describe, it, expect } from 'vitest';
import { GRAVITY, SIM_DT } from '../src/config.js';
import { World } from '../src/sim/world.js';
import { WorldMotion } from '../src/phaser/world/motion.js';
import { LianaState } from '../src/sim/liana.js';
import { MonkeyPose } from '../src/views/monkey.js';
import { createFixedStepLoop } from '../src/loop.js';

const world = () => new World({ seed: 1, makeObstacle: () => null, makeBanana: () => null });
const step = (w, motion) => { w.step(SIM_DT); motion.capture(); };

const approaching = () => {
  const w = world(), m = w.monkey, next = w.lianas.get(1);
  m.release();
  m.x = m.prevX = next.x - 23;
  m.y = m.prevY = next.anchorY + 200;
  m.vx = 240;
  m.vy = 10;
  return { w, m, next, motion: new WorldMotion(w) };
};

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

  it('finishes the flight step and converges onto the caught rope without changing physics', () => {
    const { w, m, next, motion } = approaching();
    const x = m.x, y = m.y;
    step(w, motion);
    expect(m.liana).toBe(next);
    expect(m.x).toBe(next.x); // simulation still snaps instantly
    const model = { ...m }, pose = new MonkeyPose();
    for (const alpha of [0, 0.25, 0.75, 1]) {
      const drawn = pose.update(motion.monkey(m, alpha), 0, false, alpha);
      expect(drawn.x).toBeCloseTo(x + 240 * SIM_DT * alpha, 10);
      expect(drawn.y).toBeCloseTo(y + (10 + GRAVITY * SIM_DT) * SIM_DT * alpha, 10);
    }
    expect({ ...m }).toEqual(model);
    for (let i = 0; i < 12; i++) step(w, motion);
    const drawn = motion.monkey(m, 0.5);
    expect(drawn.x).toBe(m.x);
    expect(drawn.prevX).toBe(m.prevX);
    expect(drawn.catchOffsetX).toBe(0);
  });

  it('has the same catch pose at the same drawing time, including after several sim steps', () => {
    const a = approaching(), b = approaching();
    step(a.w, a.motion);
    const endpoint = { ...a.motion.monkey(a.m, 1) };
    step(b.w, b.motion);
    step(b.w, b.motion);
    const nextStart = b.motion.monkey(b.m, 0);
    expect(nextStart.x).toBeCloseTo(endpoint.x, 10);
    expect(nextStart.y).toBeCloseTo(endpoint.y, 10);
    const before = [nextStart.x, nextStart.y];
    b.motion.capture();
    expect([b.motion.monkey(b.m, 0).x, b.motion.monkey(b.m, 0).y]).toEqual(before);
  });

  it('reduces the submitted catch jump at 60/90/144 Hz without repeating active poses', () => {
    for (const hz of [60, 90, 144]) {
      const { w, m, motion } = approaching();
      const pose = new MonkeyPose(), native = new MonkeyPose();
      const loop = createFixedStepLoop({ dt: SIM_DT, maxFrameDt: 0.1,
        step() { step(w, motion); },
      });
      let previous = { x: m.x, y: m.y }, previousNative = { ...previous };
      let maximum = 0, nativeMaximum = 0, repeated = 0;
      for (let i = 0; i < Math.ceil(0.15 * hz); i++) {
        const alpha = loop.advance(1 / hz);
        const drawn = pose.update(motion.monkey(m, alpha), 1 / hz, false, alpha);
        const unsmoothed = native.update(m, 1 / hz, false, alpha);
        maximum = Math.max(maximum, Math.hypot(drawn.x - previous.x, drawn.y - previous.y));
        nativeMaximum = Math.max(nativeMaximum, Math.hypot(unsmoothed.x - previousNative.x, unsmoothed.y - previousNative.y));
        if (i > 1 && drawn.x === previous.x && drawn.y === previous.y) repeated++;
        previous = drawn;
        previousNative = unsmoothed;
      }
      expect(maximum, `catch movement at ${hz} Hz`).toBeLessThan(nativeMaximum * 0.8);
      expect(repeated).toBe(0);
    }
  });

  it('keeps the correction continuous on an immediate release and discards it on a respawn', () => {
    const { w, m, motion } = approaching();
    step(w, motion);
    const before = { ...motion.monkey(m, 1) };
    m.release();
    step(w, motion);
    expect(motion.monkey(m, 0).x).toBeCloseTo(before.x, 10);
    expect(motion.monkey(m, 0).y).toBeCloseTo(before.y, 10);
    m.kill();
    step(w, motion);
    m.grab(w.lianas.get(2), 200);
    step(w, motion);
    expect(motion.monkey(m, 0.5).catchOffsetX).toBe(0);
    expect(motion.monkey(m, 0.5).x).toBe(m.x);
  });

  it('snaps a teleport and a fresh drawing world instead of animating a false catch', () => {
    const { w, m, motion } = approaching();
    m.grab(w.lianas.get(3), 200);
    step(w, motion);
    expect(motion.monkey(m, 0.5).catchOffsetX).toBe(0);
    expect(motion.monkey(m, 0.5).x).toBe(m.x);
    const fresh = approaching();
    step(fresh.w, fresh.motion);
    const reset = new WorldMotion(fresh.w);
    expect(reset.monkey(fresh.m, 0.5).catchOffsetX).toBe(0);
  });
});
