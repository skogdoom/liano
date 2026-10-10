import { describe, it, expect } from 'vitest';
import { FpsMeter, SLOW_MS, heapMB } from '../src/render/fpsMeter.js';

describe('frame rate meter', () => {
  it('reads nothing before there are two frames', () => {
    const meter = new FpsMeter();
    expect(meter.fps).toBe(0);
    expect(meter.describe()).toBe('fps …');
    meter.tick(1000);
    expect(meter.fps).toBe(0);
  });

  it('reads the frame rate and mean frame time over the window', () => {
    const meter = new FpsMeter();
    for (let i = 0; i <= 120; i++) meter.tick(i * (1000 / 60));
    expect(meter.fps).toBeCloseTo(60, 6);
    expect(meter.frameMs).toBeCloseTo(16.667, 2);
    expect(meter.worst).toBeCloseTo(16.667, 2);
    expect(meter.describe()).toBe('60 fps  16.7 ms  worst 17 ms  slow 0');
  });

  it('forgets frames older than the window, so it follows a change', () => {
    const meter = new FpsMeter(1000);
    let t = 0;
    for (let i = 0; i < 120; i++) meter.tick((t += 1000 / 60));
    for (let i = 0; i < 40; i++) meter.tick((t += 1000 / 20)); // two seconds at 20 fps
    expect(meter.fps).toBeCloseTo(20, 0);
    expect(meter.times.length).toBeLessThan(25);
  });

  it('keeps the worst frame of the window, and counts the hitches since the start', () => {
    const meter = new FpsMeter(1000);
    let t = 0;
    for (let i = 0; i < 30; i++) meter.tick((t += 16));
    meter.tick((t += 120)); // a hitch
    meter.tick((t += 16));
    expect(meter.worst).toBe(120);
    expect(meter.slow).toBe(1);
    expect(120).toBeGreaterThan(SLOW_MS);
    // It leaves the window; the count does not.
    for (let i = 0; i < 100; i++) meter.tick((t += 16));
    expect(meter.worst).toBe(16);
    expect(meter.slow).toBe(1);
  });

  it('reads the JS heap where the browser has it, and null elsewhere', () => {
    expect(heapMB({ memory: { usedJSHeapSize: 5 * 1024 * 1024 } })).toBe(5);
    expect(heapMB({})).toBeNull();
    expect(heapMB(undefined)).toBeNull();
  });
});
