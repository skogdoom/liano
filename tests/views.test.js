import { describe, it, expect } from 'vitest';
import { MonkeyPose, POSES, DEAD_SPIN, INVULNERABLE_BLINK } from '../src/views/monkey.js';
import { LIANA_MARGIN, drawnState, flashingLianas, lianaPlacement, lianaVisible } from '../src/views/liana.js';
import { POP_TIME, bananaPose, popAlpha, popLook } from '../src/views/banana.js';
import { FLOOR_Y, SKY_MARGIN, STAGE_TINTS, StageTint, TILE, TINT_TIME, layerShift, skyLayout } from '../src/views/backdrop.js';
import { GLOW_LAYERS, TEMPLE_GLOW_RADIUS, templeFlame, templeGlowLayers } from '../src/views/obstacles.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { Liana, LianaState } from '../src/sim/liana.js';
import { SIM_DT, WORLD_HEIGHT } from '../src/config.js';

// The view-models both versions draw from (PHASER_PLAN.md, M5): plain data, no Pixi or Phaser.

describe('the monkey pose', () => {
  const hanging = (liana) => ({ state: MonkeyState.HANGING, liana, x: 100, y: 200, vx: 0, vy: 0 });

  it('faces the way its liana swings and turns its body with the rope', () => {
    const liana = new Liana(0, 100);
    liana.grab(-1);
    for (let i = 0; i < 30; i++) liana.step(SIM_DT);
    const pose = new MonkeyPose().update(hanging(liana), SIM_DT);
    expect(pose.facing).toBe(liana.swingDir);
    expect(pose.limbs).toBe(POSES.hanging);
    // A new monkey snaps to its target turn instead of easing from 0.
    expect(pose.rotation).not.toBe(0);
    expect(pose.dead).toBe(false);
  });

  it('eases the turn towards its target, faces where it flies and spins when dead', () => {
    const view = new MonkeyPose();
    const monkey = { state: MonkeyState.AIRBORNE, x: 0, y: 0, vx: -300, vy: 0 };
    expect(view.update(monkey, SIM_DT).facing).toBe(-1);
    monkey.vy = 400;
    const target = 0.5 * Math.atan2(400, 300);
    const first = view.update(monkey, SIM_DT).rotation;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(target);
    for (let i = 0; i < 600; i++) view.update(monkey, SIM_DT);
    expect(view.update(monkey, SIM_DT).rotation).toBeCloseTo(target, 6);
    monkey.state = MonkeyState.DEAD;
    const dead = view.update(monkey, 0.1);
    expect(dead.rotation).toBeCloseTo(target + DEAD_SPIN * 0.1, 9);
    expect(dead).toMatchObject({ dead: true, limbs: POSES.dead });
  });

  it('draws between the previous step and this one, and blinks while invulnerable', () => {
    const view = new MonkeyPose();
    const monkey = { state: MonkeyState.AIRBORNE, x: 10, y: 20, prevX: 0, prevY: 0, vx: 1, vy: 0 };
    expect(view.update(monkey, 0, false, 0.5)).toMatchObject({ x: 5, y: 10 });
    expect(view.update(monkey, 0, false, 1)).toMatchObject({ x: 10, y: 20 });
    const half = 1 / (INVULNERABLE_BLINK * 2);
    const alphas = [];
    for (let i = 0; i < 4; i++) alphas.push(view.update(monkey, half, true).alpha);
    expect(alphas).toEqual([0.3, 1, 0.3, 1]);
    expect(view.update(monkey, half, false).alpha).toBe(1);
  });
});

describe('the liana placement', () => {
  it('turns a swinging liana about its anchor, between steps, and draws the others where they are', () => {
    const liana = new Liana(1, 300);
    expect(lianaPlacement(liana)).toEqual({ x: 0, y: 0, rotation: 0, drawn: liana });
    liana.grab(1);
    for (let i = 0; i < 20; i++) liana.step(SIM_DT);
    const now = lianaPlacement(liana, 1);
    expect(now).toMatchObject({ x: liana.x, y: liana.anchorY, rotation: -liana.angle });
    expect(now.drawn).not.toBe(liana);
    const between = lianaPlacement(liana, 0.5).rotation;
    expect(between).toBeCloseTo(-(liana.prevAngle + liana.angle) / 2, 9);
  });

  it('redraws only when the look changes, culls far off the view and lights the lianas slipped along', () => {
    const liana = new Liana(1, 300);
    expect(drawnState(liana, false)).toBe('idle');
    liana.grab(1);
    expect(drawnState(liana, true)).toBe('swinging:true');
    liana.state = LianaState.SETTLING;
    expect(drawnState(liana, false)).toContain('SETTLING');
    expect(lianaVisible(liana, 300 + LIANA_MARGIN, 100)).toBe(true);
    expect(lianaVisible(liana, 301 + LIANA_MARGIN, 100)).toBe(false);
    expect(lianaVisible(liana, 300 - 100 - LIANA_MARGIN, 100)).toBe(true);
    expect(lianaVisible(liana, 299 - 100 - LIANA_MARGIN, 100)).toBe(false);
    const other = new Liana(2, 500);
    expect([...flashingLianas([{ liana, tipTime: 0 }, { liana: other, tipTime: Infinity }])]).toEqual([liana]);
  });
});

describe('the bananas', () => {
  it('bob, rock and glint, each at its own phase', () => {
    const a = bananaPose({ gap: 1, x: 50, y: 300 }, 2);
    const b = bananaPose({ gap: 2, x: 50, y: 300 }, 2);
    expect(a.x).toBe(50);
    expect(Math.abs(a.y - 300)).toBeLessThanOrEqual(3);
    expect(a.glint).toBeGreaterThanOrEqual(0);
    expect(a.glint).toBeLessThanOrEqual(1);
    expect(a).not.toEqual(b);
  });

  it('pop "+1" or "+1 ♥" and fade it out', () => {
    expect(popLook(false).text).toBe('+1');
    expect(popLook(true).text).toBe('+1 ♥');
    expect(popAlpha(0)).toBe(1);
    expect(popAlpha(POP_TIME / 2)).toBeCloseTo(0.5, 9);
    expect(popAlpha(POP_TIME * 2)).toBe(0);
  });
});

describe('the backdrop', () => {
  it('eases its tint from stage to stage, and snaps for a new world', () => {
    const tint = new StageTint();
    const world = {};
    expect(tint.update(1, world, 0)).toBe(STAGE_TINTS[0]);
    tint.update(2, world, 0);
    expect(tint.color).toBe(STAGE_TINTS[0]);
    const midway = tint.update(2, world, TINT_TIME / 2);
    expect(midway).not.toBe(STAGE_TINTS[0]);
    expect(midway).not.toBe(STAGE_TINTS[1]);
    expect(tint.update(2, world, TINT_TIME)).toBe(STAGE_TINTS[1]);
    expect(tint.update(4, {}, 0)).toBe(STAGE_TINTS[3]);
  });

  it('lays the sky from the top of the view (or the band) to past the bottom, wider than the view', () => {
    expect(skyLayout(0, 1280, WORLD_HEIGHT)).toEqual({
      x: -SKY_MARGIN,
      w: 1280 + 2 * SKY_MARGIN,
      bands: { y: 0, h: FLOOR_Y },
      above: { y: -SKY_MARGIN, h: SKY_MARGIN },
      below: { y: FLOOR_Y, h: WORLD_HEIGHT - FLOOR_Y + SKY_MARGIN },
    });
    const tall = skyLayout(-300, 600, 1200);
    expect(tall.bands).toEqual({ y: -300, h: FLOOR_Y + 300 });
    expect(tall.below.h).toBe(1200 - FLOOR_Y + SKY_MARGIN);
    expect(skyLayout(50, 600, 700).bands.y).toBe(0);
  });

  it('scrolls each layer by its factor, within one tile', () => {
    expect(layerShift(1000, 0.5)).toBe(500);
    expect(layerShift(TILE * 3 + 10, 1)).toBe(10);
    expect(layerShift(-10, 1)).toBe(TILE - 10);
  });
});

describe('the temple fire', () => {
  it('glows in layers, smallest first, as large as the glow piece at full reach', () => {
    const layers = templeGlowLayers(1);
    expect(layers).toHaveLength(GLOW_LAYERS);
    expect(layers.at(-1).radius).toBeCloseTo(TEMPLE_GLOW_RADIUS, 9);
    for (let j = 1; j < layers.length; j++) {
      expect(layers[j].radius).toBeGreaterThan(layers[j - 1].radius);
      expect(layers[j].alpha).toBeLessThan(layers[j - 1].alpha);
    }
    expect(templeGlowLayers(0.5, 0.9)[3]).toEqual({ radius: layers[3].radius * 0.9, alpha: layers[3].alpha / 2 });
  });

  it('leaps with its glow: the flame, flicker and reach follow how high it leaps', () => {
    for (let t = 0; t < 2; t += 0.1) {
      const { k, top, flicker, reach } = templeFlame(t, 0.3, 1);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
      expect(flicker).toBeCloseTo(0.85 + 0.15 * k, 9);
      expect(reach).toBeCloseTo(0.95 + 0.05 * k, 9);
      expect(templeFlame(t, 0.3, 1).top).toBe(top);
    }
  });
});
