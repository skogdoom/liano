import { describe, it, expect } from 'vitest';
import { layoutFor } from '../src/layout.js';
import { Camera, cameraTarget } from '../src/render/camera.js';
import { World } from '../src/sim/world.js';
import { lianaIndexRange } from '../src/sim/generator.js';
import {
  CAMERA_TARGET_X,
  LIANA_SPACING,
  MONKEY_RADIUS,
  WORLD_HEIGHT,
  MIN_VISIBLE_WORLD_HEIGHT,
  MAX_VIEW_WIDTH,
  MIN_UI_CSS_SCALE,
  MAX_UI_SCALE,
  SIM_DT,
  SWING_PERIOD,
} from '../src/config.js';

// Portrait phones from the narrowest (iPhone SE, first generation) up, and iPads.
const PORTRAIT = [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
  [412, 915],
  [768, 1024],
  [834, 1194],
];
// Landscape phones with the browser's bars showing, from mild to very wide.
const WIDE = [
  [844, 340],
  [932, 360],
  [667, 320],
  [740, 300],
];
const ALL = [...PORTRAIT, ...WIDE, [1280, 720], [1920, 1080], [1024, 768], [1366, 1024], [1500, 500], [2560, 1080]];

describe('layout', () => {
  it('keeps the designed 1280 × 720 frame at exactly 16:9', () => {
    for (const [w, h] of [
      [1280, 720],
      [1920, 1080],
      [640, 360],
    ]) {
      const l = layoutFor(w, h);
      expect(l.orientation).toBe('landscape');
      expect(l.view).toEqual({ width: 1280, height: 720 });
      expect(l.scale).toBeCloseTo(w / 1280, 9);
      expect([l.x, l.y, l.bandTop, l.floorShift, l.ui]).toEqual([0, 0, 0, 0, 1]);
      expect(l.camera).toEqual({ follow: 'monkey', screenX: CAMERA_TARGET_X });
      // The panel spots from before the layout existed.
      expect(l.panels).toEqual({ title: { x: 990, y: 340 }, gameOver: { x: 640, y: 340 }, paused: { x: 640, y: 360 } });
    }
  });

  it('crops the bottom of the band before widening, on a landscape phone with browser bars', () => {
    const l = layoutFor(844, 340);
    expect(l.view.height).toBe(MIN_VISIBLE_WORLD_HEIGHT);
    expect(l.view.width).toBeCloseTo((844 / 340) * MIN_VISIBLE_WORLD_HEIGHT, 6);
    expect([l.x, l.y]).toEqual([0, 0]); // no bars
    expect(l.scale).toBeCloseTo(340 / MIN_VISIBLE_WORLD_HEIGHT, 9);
    // 26 % larger than the 16:9 frame letterboxed into the same screen.
    expect(l.scale / (340 / 720)).toBeCloseTo(720 / 570, 9);
    expect(l.floorShift).toBe(MIN_VISIBLE_WORLD_HEIGHT - WORLD_HEIGHT);
  });

  it('only crops a slightly wide screen, keeping the 1280 width', () => {
    const l = layoutFor(1900, 1000);
    expect(l.view.width).toBeCloseTo(1280, 9);
    expect(l.view.height).toBeCloseTo(1280 / 1.9, 9);
    expect(l.floorShift).toBeCloseTo(1280 / 1.9 - WORLD_HEIGHT, 9);
    expect(l.x).toBeCloseTo(0, 9);
    expect(l.y).toBeCloseTo(0, 9);
  });

  it('shows side bars only beyond the widest view', () => {
    const l = layoutFor(1500, 450);
    expect(l.view).toEqual({ width: MAX_VIEW_WIDTH, height: MIN_VISIBLE_WORLD_HEIGHT });
    expect(l.x).toBeGreaterThan(0);
    expect(l.y).toBe(0);
  });

  it('shows extra canopy and undergrowth on a 4:3 screen', () => {
    const l = layoutFor(1024, 768);
    expect(l.view.width).toBe(1280);
    expect(l.view.height).toBeCloseTo(960, 9);
    expect(l.bandTop).toBeCloseTo(120, 9);
    expect(l.panels.title.y).toBeCloseTo(120 + 340, 9);
    expect(l.floorShift).toBe(0);
  });

  it('fills every screen without bars up to the widest view', () => {
    for (const [w, h] of ALL) {
      const l = layoutFor(w, h);
      if (l.view.width < MAX_VIEW_WIDTH) {
        expect(l.x, `${w}×${h}`).toBeCloseTo(0, 9);
        expect(l.y, `${w}×${h}`).toBeCloseTo(0, 9);
      }
      // At least MIN_VISIBLE_WORLD_HEIGHT of the band is always on screen.
      expect(l.view.height - l.bandTop, `${w}×${h}`).toBeGreaterThanOrEqual(MIN_VISIBLE_WORLD_HEIGHT - 1e-9);
    }
  });

  it('lays out every portrait screen with the panels below the swing and on screen', () => {
    for (const [w, h] of PORTRAIT) {
      const l = layoutFor(w, h);
      const name = `${w}×${h}`;
      expect(l.orientation, name).toBe('portrait');
      expect(l.view.width, name).toBe(1100);
      expect(l.camera.follow, name).toBe('anchor');
      // Text and buttons draw at a readable size, or at the largest allowed.
      expect(l.ui * l.scale >= MIN_UI_CSS_SCALE - 1e-9 || l.ui === MAX_UI_SCALE, name).toBe(true);
      for (const [panel, half] of [
        ['title', 165],
        ['gameOver', 170],
      ]) {
        const { y } = l.panels[panel];
        // Clear of the hanging monkey (anchor −20, grip 378, radius 22) and on screen.
        expect(y - half * l.ui, `${name} ${panel}`).toBeGreaterThanOrEqual(l.bandTop + 380);
        expect(y + half * l.ui, `${name} ${panel}`).toBeLessThanOrEqual(l.view.height);
      }
    }
  });

  it('turns safe-area insets into logical pixels, less what the bars cover', () => {
    const l = layoutFor(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    expect(l.insets.top).toBeCloseTo(47 / l.scale, 9);
    expect(l.insets.bottom).toBeCloseTo(34 / l.scale, 9);
    const barred = layoutFor(1500, 450, { top: 0, right: 0, bottom: 0, left: 59 });
    expect(barred.insets.left).toBe(Math.max(59 - barred.x, 0) / barred.scale);
  });

  it('keeps the whole swing and the next liana on screen while hanging, in portrait', () => {
    for (const [w, h] of PORTRAIT) {
      const l = layoutFor(w, h);
      const world = new World({ seed: 7, makeObstacle: () => null });
      const camera = new Camera(0, l.camera.screenX);
      camera.reset(cameraTarget(world.monkey, l.camera.follow));
      for (let t = 0; t < 2 * SWING_PERIOD; t += SIM_DT) {
        world.step(SIM_DT);
        camera.update(cameraTarget(world.monkey, l.camera.follow), SIM_DT);
        const { x } = world.monkey;
        const next = world.monkey.liana.x + LIANA_SPACING;
        expect(x - MONKEY_RADIUS, `${w}×${h}`).toBeGreaterThanOrEqual(camera.x);
        expect(x + MONKEY_RADIUS, `${w}×${h}`).toBeLessThanOrEqual(camera.x + l.view.width);
        expect(next + 20, `${w}×${h}`).toBeLessThanOrEqual(camera.x + l.view.width);
      }
    }
  });

  it('generates the world across every view', () => {
    for (const [w, h] of ALL) {
      const l = layoutFor(w, h);
      // The monkey can be up to a swing (about 290 px) from the anchor the camera holds.
      for (const offset of l.camera.follow === 'anchor' ? [-300, 0, 300] : [0]) {
        const monkeyX = 5000;
        const left = monkeyX + offset - l.camera.screenX;
        const { first, last } = lianaIndexRange(monkeyX);
        expect(first * LIANA_SPACING, `${w}×${h}`).toBeLessThanOrEqual(left - LIANA_SPACING);
        expect(last * LIANA_SPACING, `${w}×${h}`).toBeGreaterThanOrEqual(left + l.view.width + LIANA_SPACING);
      }
    }
  });
});

describe('camera target', () => {
  it('follows the monkey, or in anchor mode the liana it hangs on', () => {
    const world = new World({ seed: 1, makeObstacle: () => null });
    for (let i = 0; i < 50; i++) world.step(SIM_DT);
    const { monkey } = world;
    expect(cameraTarget(monkey, 'monkey')).toBe(monkey.x);
    expect(cameraTarget(monkey, 'anchor')).toBe(monkey.liana.x);
    expect(monkey.x).not.toBe(monkey.liana.x);
    world.release();
    expect(cameraTarget(monkey, 'anchor')).toBe(monkey.x); // in flight
  });

  it('keeps the target at the screen position it is given', () => {
    const camera = new Camera(1000, 330);
    expect(1000 - camera.x).toBe(330);
    camera.screenX = 448;
    for (let i = 0; i < 600; i++) camera.update(1000, SIM_DT);
    expect(1000 - camera.x).toBeCloseTo(448, 3);
  });
});
