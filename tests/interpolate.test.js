import { describe, it, expect } from 'vitest';
import { blend, MAX_STEP_JUMP, MAX_STEP_TURN } from '../src/render/interpolate.js';
import { Camera } from '../src/render/camera.js';
import { Liana } from '../src/sim/liana.js';
import { Monkey, MonkeyState } from '../src/sim/monkey.js';
import { LianaView } from '../src/render/lianaView.js';
import { MonkeyView } from '../src/render/monkeyView.js';
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

  it('the liana turns half way between the steps at alpha 0.5', () => {
    const liana = new Liana(2, 1400);
    liana.grab(1);
    for (let i = 0; i < 40; i++) liana.step(SIM_DT);
    const view = new LianaView();
    view.update([liana], 1000, 1280, [], 0.5);
    const g = view.entries.get(liana).g;
    expect(g.rotation).toBeCloseTo(-(liana.prevAngle + liana.angle) / 2, 12);
    view.update([liana], 1000, 1280, [], 0);
    expect(g.rotation).toBeCloseTo(-liana.prevAngle, 12);
    view.update([liana], 1000);
    expect(g.rotation).toBe(-liana.angle);
  });

  it('the monkey is drawn between its two positions, and at the current one without alpha', () => {
    const monkey = new Monkey();
    monkey.state = MonkeyState.AIRBORNE;
    monkey.x = 100;
    monkey.y = 200;
    monkey.vx = 300;
    monkey.vy = -100;
    monkey.step(SIM_DT);
    const view = new MonkeyView({ fur: 1, furDark: 2, skin: 3 });
    view.update(monkey, SIM_DT, false, 0.5);
    expect(view.view.x).toBeCloseTo((monkey.prevX + monkey.x) / 2, 12);
    expect(view.view.y).toBeCloseTo((monkey.prevY + monkey.y) / 2, 12);
    view.update(monkey, SIM_DT);
    expect([view.view.x, view.view.y]).toEqual([monkey.x, monkey.y]);
  });

  it('a monkey that teleported (a respawn) is not slid across the screen', () => {
    const monkey = new Monkey();
    monkey.x = 100;
    monkey.step(SIM_DT);
    monkey.x = 900;
    const view = new MonkeyView({ fur: 1, furDark: 2, skin: 3 });
    view.update(monkey, SIM_DT, false, 0.5);
    expect(view.view.x).toBe(900);
  });

  it('frames without a previous position (the shadow) are drawn as they are', () => {
    const view = new MonkeyView({ fur: 1, furDark: 2, skin: 3 });
    view.update({ x: 40, y: 60, state: MonkeyState.AIRBORNE, vx: 0, vy: 0 }, SIM_DT, false, 0.5);
    expect([view.view.x, view.view.y]).toEqual([40, 60]);
  });
});
