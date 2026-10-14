import { describe, it, expect } from 'vitest';
import { blend, MAX_STEP_JUMP, MAX_STEP_TURN } from '../src/render/interpolate.js';
import { Camera } from '../src/render/camera.js';
import { Liana } from '../src/sim/liana.js';
import { Monkey, MonkeyState } from '../src/sim/monkey.js';
import { SIM_DT } from '../src/config.js';

describe('drawing between sim steps', () => {
  it('blend goes from the previous state to the current one', () => {
    expect(blend(10, 14, 0)).toBe(10);
    expect(blend(10, 14, 0.25)).toBe(11);
    expect(blend(10, 14, 1)).toBe(14);
  });

  it('blend draws a jump as it is, not as a slide', () => {
    expect(blend(0, MAX_STEP_JUMP + 1, 0.5)).toBe(MAX_STEP_JUMP + 1);
    expect(blend(0, MAX_STEP_JUMP, 0.5)).toBe(MAX_STEP_JUMP / 2);
    expect(blend(0, MAX_STEP_TURN + 0.01, 0.5, MAX_STEP_TURN)).toBe(MAX_STEP_TURN + 0.01);
  });

  it('the camera remembers where it was at the start of a step, and a reset forgets it', () => {
    const camera = new Camera(0);
    camera.mark();
    camera.update(500, SIM_DT);
    expect(camera.prevX).toBeLessThan(camera.x);
    camera.reset(2000);
    expect(camera.prevX).toBe(camera.x);
    camera.mark();
    expect(camera.prevX).toBe(camera.x);
  });

  it('a monkey remembers its position before the step, a liana its angle', () => {
    const monkey = new Monkey();
    monkey.x = 100;
    monkey.y = 50;
    monkey.vx = 120;
    monkey.step(SIM_DT);
    expect([monkey.prevX, monkey.prevY]).toEqual([100, 50]);
    expect(monkey.x).toBeGreaterThan(100);

    const liana = new Liana(2, 1400);
    liana.grab(1);
    for (let i = 0; i < 30; i++) liana.step(SIM_DT);
    const before = liana.angle;
    liana.step(SIM_DT);
    expect(liana.prevAngle).toBe(before);
    expect(liana.angle).not.toBe(before);
  });

  it('a catch is not slid to: the monkey and the new swing start from where they are', () => {
    const liana = new Liana(2, 1400);
    const monkey = new Monkey();
    monkey.x = 1380;
    monkey.y = 200;
    monkey.vx = 200;
    monkey.step(SIM_DT);
    monkey.grab(liana, 120);
    expect([monkey.prevX, monkey.prevY]).toEqual([monkey.x, monkey.y]);
    expect(liana.prevAngle).toBe(liana.angle);
  });

});
