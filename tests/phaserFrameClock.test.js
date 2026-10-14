import { describe, expect, it } from 'vitest';
import { FrameClock } from '../src/frameClock.js';
import { PhaserFrameClock } from '../src/phaser/frameClock.js';
import { createFixedStepLoop } from '../src/loop.js';

const warm = (clock, hz = 60) => {
  for (let i = 0; i < 600; i++) clock.frame(1000 / hz);
  return clock;
};
const sum = (values) => values.reduce((a, b) => a + b, 0);

describe('Phaser callback-phase handling', () => {
  for (const gaps of [[27, 14, 8], [30, 11, 9]]) {
    it(`keeps the Safari trace's ${gaps.join('/')} ms callbacks moving evenly`, () => {
      const previous = warm(new FrameClock());
      const clock = warm(new PhaserFrameClock());
      const oldSteps = gaps.map((gap) => previous.frame(gap));
      expect(oldSteps[0]).toBeGreaterThan(30);
      expect(oldSteps[2]).toBeLessThan(10);
      const steps = gaps.map((gap) => clock.frame(gap));
      for (const step of steps) expect(Math.abs(step - 1000 / 60)).toBeLessThan(0.15);
      expect(Math.abs(sum(steps) - sum(gaps))).toBeLessThan(3);
      // Verify actual fixed-step interpolation, not just the normalized deltas:
      // a 600-unit/s mover should draw about 10 units farther every callback.
      let x = 0, previousX = 0;
      const loop = createFixedStepLoop({ dt: 1 / 120, maxFrameDt: 0.1,
        step(dt) { previousX = x; x += 600 * dt; },
      });
      loop.advance(1 / 60);
      let drawn = previousX;
      for (const step of steps) {
        const alpha = loop.advance(step / 1000);
        const next = previousX + (x - previousX) * alpha;
        expect(Math.abs(next - drawn - 10)).toBeLessThan(0.1);
        drawn = next;
      }
    });
  }

  it('preserves actual missed refreshes and long stalls', () => {
    for (const hz of [60, 90, 120, 144]) {
      const clock = warm(new PhaserFrameClock(), hz);
      const interval = 1000 / hz;
      expect(clock.frame(interval * 2)).toBeCloseTo(interval * 2, 6);
      expect(clock.frame(interval)).toBeCloseTo(interval, 6);
      expect(clock.frame(200)).toBeCloseTo(200, 6);
    }
  });

  it('keeps the recorded delayed callback smooth when pre-existing debt crosses one interval', () => {
    const clock = warm(new PhaserFrameClock());
    // Timing-only excerpt before the blur-on trace's 28/10/8 ms disturbance.
    // The previous implementation relearned on the 28 ms callback and drew
    // 28.1/10.1/8.1 ms instead of three approximately equal advances.
    clock.owed = 3.7022;
    const raw = [17, 16, 17, 16, 17, 17, 16, 17, 16, 20, 14, 18, 16, 19, 28, 10, 8, 18, 16, 17];
    const steps = raw.map((gap) => clock.frame(gap));
    for (const step of steps) expect(Math.abs(step - 1000 / 60)).toBeLessThan(0.2);
    expect(clock.refresh.interval).not.toBeNull();
    expect(Math.abs(sum(raw) - sum(steps) - clock.owed + 3.7022)).toBeLessThan(1e-9);
  });

  it('draws a constant-speed mover evenly through the debt-triggering disturbance', () => {
    const clock = warm(new PhaserFrameClock());
    clock.owed = 6.1892;
    let x = 0, previousX = 0;
    const loop = createFixedStepLoop({ dt: 1 / 120, maxFrameDt: 0.1,
      step(dt) { previousX = x; x += 600 * dt; },
    });
    loop.advance(1 / 60);
    let previousDrawn = previousX;
    for (const raw of [28, 10, 8, 18, 16, 17]) {
      const alpha = loop.advance(clock.frame(raw) / 1000);
      const drawn = previousX + (x - previousX) * alpha;
      expect(Math.abs(drawn - previousDrawn - 10)).toBeLessThan(0.15);
      previousDrawn = drawn;
    }
  });

  it('does not mistake a sustained callback phase offset for a refresh-rate change', () => {
    const clock = warm(new PhaserFrameClock());
    clock.owed = 6.1892;
    const gaps = [28, 17, 17, 17, 17, 10, 8];
    for (const gap of gaps) {
      expect(Math.abs(clock.frame(gap) - 1000 / 60)).toBeLessThan(0.2);
      expect(clock.refresh.interval).not.toBeNull();
    }
  });

  it('keeps rounded-clock time close to real time over a minute with both disturbances', () => {
    const clock = warm(new PhaserFrameClock());
    const raw = Array.from({ length: 3600 }, (_, i) => Math.round((i + 1) * 1000 / 60) - Math.round(i * 1000 / 60));
    raw.splice(300, 3, 27, 14, 8);
    raw.splice(1500, 3, 30, 11, 9);
    const out = raw.map((gap) => clock.frame(gap));
    expect(Math.abs(sum(out) - sum(raw))).toBeLessThan(4);
    expect(Math.max(...out) - Math.min(...out)).toBeLessThan(0.3);
  });

  it('holds zero-delta callbacks and adapts to refresh-rate changes', () => {
    for (const hz of [30, 50, 75, 90, 120, 144]) {
      const clock = warm(new PhaserFrameClock());
      expect(clock.frame(0)).toBe(0);
      expect(clock.frame(0.001)).toBe(0.001);
      const out = Array.from({ length: hz * 10 }, () => clock.frame(1000 / hz));
      for (const step of out) expect(step).toBeGreaterThanOrEqual(0);
      for (const step of out.slice(-60)) expect(step).toBeCloseTo(1000 / hz, 0);
      expect(Math.abs(sum(out) - 10000)).toBeLessThan(4);
    }
  });
});


it('never reverses time when a stall follows a switch from 30 to 240 Hz', () => {
  const clock = warm(new PhaserFrameClock(), 30);
  const gaps = [...Array(10).fill(1000 / 240), 4000 / 240, ...Array(2400).fill(1000 / 240)];
  const steps = gaps.map((gap) => clock.frame(gap));
  for (const step of steps) expect(step).toBeGreaterThanOrEqual(0);
  expect(Math.abs(sum(steps) - sum(gaps))).toBeLessThan(4);
});
