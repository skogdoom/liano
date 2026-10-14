import { describe, it, expect, vi } from 'vitest';
import { layoutFor } from '../src/layout.js';
import { applyViewCamera, canvasSize, rectCamera, resolutionLimit, viewCamera } from '../src/platform/view.js';
import { paneLayouts } from '../src/layout.js';
import { ENTER_FULLSCREEN, LEAVE_FULLSCREEN, createPhaserFullscreen } from '../src/platform/fullscreen.js';

// Where a camera placed by viewCamera draws a view point, in canvas pixels.
const onCanvas = (camera, vx, vy) => [camera.x + (vx - camera.scrollX) * camera.zoom, camera.y + (vy - camera.scrollY) * camera.zoom];

describe('the Phaser view on the screen', () => {
  it('accepts a rendering-density cap without allowing invalid or oversized canvases', () => {
    expect(resolutionLimit('?resolution=1')).toBe(1);
    expect(resolutionLimit('?resolution=1.5')).toBe(1.5);
    expect(resolutionLimit('?resolution=2')).toBe(2);
    for (const search of ['', '?resolution=', '?resolution=0', '?resolution=-1',
      '?resolution=0.5', '?resolution=3', '?resolution=Infinity', '?resolution=oops']) {
      expect(resolutionLimit(search)).toBe(2);
    }
  });

  it('sizes the canvas in device pixels', () => {
    expect(canvasSize(375, 812, 2)).toEqual({ width: 750, height: 1624 });
    expect(canvasSize(1001, 601, 1.5)).toEqual({ width: 1502, height: 902 });
  });

  // Window shapes the layout tests cover, at the ratios the game uses.
  const shapes = [
    [1280, 720],
    [1920, 1080],
    [2560, 1080],
    [1024, 768],
    [844, 390],
    [390, 844],
    [375, 812],
    [1001, 601],
  ];
  for (const [w, h] of shapes) {
    for (const ratio of [1, 1.5, 2]) {
      it(`puts the view where the layout says, ${w} × ${h} at ${ratio}×`, () => {
        const layout = layoutFor(w, h);
        const camera = viewCamera(layout, ratio);
        // The view's corners land where the Pixi version draws them, in device pixels.
        const [x0, y0] = onCanvas(camera, 0, 0);
        expect(x0).toBeCloseTo(layout.x * ratio, 9);
        expect(y0).toBeCloseTo(layout.y * ratio, 9);
        const [x1, y1] = onCanvas(camera, layout.view.width, layout.view.height);
        expect(x1).toBeCloseTo((layout.x + layout.view.width * layout.scale) * ratio, 9);
        expect(y1).toBeCloseTo((layout.y + layout.view.height * layout.scale) * ratio, 9);
        // The viewport is whole pixels, inside the canvas, within half a pixel of the view.
        for (const value of [camera.x, camera.y, camera.width, camera.height]) expect(Number.isInteger(value)).toBe(true);
        const canvas = canvasSize(w, h, ratio);
        expect(camera.x).toBeGreaterThanOrEqual(0);
        expect(camera.y).toBeGreaterThanOrEqual(0);
        expect(camera.x + camera.width).toBeLessThanOrEqual(canvas.width + 1);
        expect(camera.y + camera.height).toBeLessThanOrEqual(canvas.height + 1);
        expect(Math.abs(camera.x - x0)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(Math.abs(camera.x + camera.width - x1)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(camera.zoom).toBeCloseTo(layout.scale * ratio, 12);
      });
    }
  }

  it('leaves bars only where the layout has them', () => {
    // 16:9 fills the screen; a very wide one has bars at the sides.
    const full = viewCamera(layoutFor(1280, 720), 2);
    expect(full).toMatchObject({ x: 0, y: 0, width: 2560, height: 1440 });
    const wide = viewCamera(layoutFor(3440, 1000), 1);
    expect(wide.y).toBe(0);
    expect(wide.x).toBeGreaterThan(0);
    expect(wide.x * 2 + wide.width).toBeCloseTo(3440, 0);
  });

  it('gives each split-screen pane a camera that clips to it and draws it where the view camera does', () => {
    for (const [w, h, ratio] of [
      [1280, 720, 2],
      [1001, 601, 1.5],
      [390, 844, 2],
    ]) {
      const layout = layoutFor(w, h);
      const view = viewCamera(layout, ratio);
      const panes = paneLayouts(layout, 2);
      const cameras = panes.map((pane) => rectCamera(view, pane));
      cameras.forEach((camera, i) => {
        const pane = panes[i];
        for (const [vx, vy] of [
          [pane.x, pane.y],
          [pane.x + pane.width, pane.y + pane.height],
          [37.5, pane.y + 10.25],
        ]) {
          const [x, y] = onCanvas(camera, vx, vy);
          const [ex, ey] = onCanvas(view, vx, vy);
          expect(x).toBeCloseTo(ex, 9);
          expect(y).toBeCloseTo(ey, 9);
        }
        for (const value of [camera.x, camera.y, camera.width, camera.height]) expect(Number.isInteger(value)).toBe(true);
        expect(camera.zoom).toBe(view.zoom);
      });
      // Together they cover the view's viewport, without overlapping.
      expect(cameras[0]).toMatchObject({ x: view.x, y: view.y, width: view.width });
      expect(cameras[1].y).toBe(cameras[0].y + cameras[0].height);
      expect(cameras[1].y + cameras[1].height).toBe(view.y + view.height);
    }
    // The whole view's rect is the view camera itself.
    const view = viewCamera(layoutFor(1001, 601), 1.5);
    const layout = layoutFor(1001, 601);
    expect(rectCamera(view, { x: 0, y: 0, width: layout.view.width, height: layout.view.height })).toEqual(view);
  });

  it('points a Phaser camera at it', () => {
    const calls = [];
    const camera = new Proxy({}, { get: (_, name) => (...args) => (calls.push([name, ...args]), camera) });
    const placement = viewCamera(layoutFor(1024, 768), 2);
    applyViewCamera(camera, placement);
    expect(calls).toEqual([
      ['setViewport', placement.x, placement.y, placement.width, placement.height],
      ['setOrigin', 0, 0],
      ['setZoom', placement.zoom],
      ['setScroll', placement.scrollX, placement.scrollY],
    ]);
  });
});

// A Scale Manager with Phaser's fullscreen capabilities, its target and its events.
function fakeScale({ available = true, rejects = false } = {}) {
  const listeners = new Map();
  const target = {
    requestFullscreen: vi.fn(() => {
      if (rejects) return Promise.reject(new Error('denied'));
      scale.fullscreen.active = true;
      scale.emit(ENTER_FULLSCREEN);
      return Promise.resolve();
    }),
  };
  const scale = {
    fullscreen: { available, active: false, request: 'requestFullscreen' },
    getFullscreenTarget: vi.fn(() => target),
    stopFullscreen: vi.fn(() => {
      scale.fullscreen.active = false;
      scale.emit(LEAVE_FULLSCREEN);
    }),
    on: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    off: (type, fn) => listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn)),
    emit: (type) => (listeners.get(type) ?? []).forEach((fn) => fn()),
    target,
  };
  return scale;
}

describe('full screen through the Scale Manager', () => {
  it('enters and leaves, telling each change', () => {
    const scale = fakeScale();
    const changes = [];
    const fullscreen = createPhaserFullscreen(scale, { onChange: (active) => changes.push(active) });
    expect(fullscreen.supported).toBe(true);
    fullscreen.toggle();
    expect(scale.target.requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
    expect(fullscreen.active).toBe(true);
    fullscreen.toggle();
    expect(scale.stopFullscreen).toHaveBeenCalled();
    expect(fullscreen.active).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('ignores a refused request (no gesture, or a browser policy)', async () => {
    const scale = fakeScale({ rejects: true });
    const fullscreen = createPhaserFullscreen(scale);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    fullscreen.toggle();
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(fullscreen.active).toBe(false);
  });

  it('does nothing where the browser has no Fullscreen API (iPhone)', () => {
    const scale = fakeScale({ available: false });
    const fullscreen = createPhaserFullscreen(scale);
    expect(fullscreen.supported).toBe(false);
    fullscreen.toggle();
    expect(scale.getFullscreenTarget).not.toHaveBeenCalled();
  });

  it('stops listening when destroyed', () => {
    const scale = fakeScale();
    const changes = [];
    createPhaserFullscreen(scale, { onChange: (active) => changes.push(active) }).destroy();
    scale.emit(ENTER_FULLSCREEN);
    expect(changes).toEqual([]);
  });
});
