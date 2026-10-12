import { describe, it, expect } from 'vitest';
import { pixelRatio, safeAreaReader, watchScreen } from '../src/screen.js';
import { FULLSCREEN_HIT, MUTE_HIT, controlsPoint, inside } from '../src/controls.js';
import { layoutFor } from '../src/layout.js';

// A window with resize events, a visual viewport, frames run on demand, and a pixel
// ratio whose media query can be made to change.
function fakeWindow(ratio = 2) {
  const win = new EventTarget();
  win.devicePixelRatio = ratio;
  win.visualViewport = new EventTarget();
  const frames = [];
  win.requestAnimationFrame = (callback) => frames.push(callback);
  win.runFrames = () => frames.splice(0).forEach((callback) => callback());
  const queries = [];
  win.matchMedia = (query) => {
    const list = new EventTarget();
    list.query = query;
    queries.push(list);
    return list;
  };
  win.queries = queries;
  return win;
}

describe('the screen', () => {
  it('caps the pixel ratio, and takes 1 where the browser gives none', () => {
    expect(pixelRatio({ devicePixelRatio: 3 }, 2)).toBe(2);
    expect(pixelRatio({ devicePixelRatio: 1.5 }, 2)).toBe(1.5);
    expect(pixelRatio({}, 2)).toBe(1);
  });

  it('reports a change once per frame, however many events came', () => {
    const win = fakeWindow();
    let changes = 0;
    watchScreen(win, () => changes++);
    win.dispatchEvent(new Event('resize'));
    win.dispatchEvent(new Event('orientationchange'));
    win.visualViewport.dispatchEvent(new Event('resize'));
    expect(changes).toBe(0);
    win.runFrames();
    expect(changes).toBe(1);
    win.dispatchEvent(new Event('resize'));
    win.runFrames();
    expect(changes).toBe(2);
  });

  it('reports a pixel-ratio change, and keeps watching for the next one', () => {
    const win = fakeWindow(2);
    let changes = 0;
    watchScreen(win, () => changes++);
    expect(win.queries.at(-1).query).toBe('(resolution: 2dppx)');
    win.devicePixelRatio = 1;
    win.queries.at(-1).dispatchEvent(new Event('change'));
    win.runFrames();
    expect(changes).toBe(1);
    expect(win.queries.at(-1).query).toBe('(resolution: 1dppx)');
  });

  it('can be asked for a change itself', () => {
    const win = fakeWindow();
    let changes = 0;
    const queue = watchScreen(win, () => changes++);
    queue();
    queue();
    win.runFrames();
    expect(changes).toBe(1);
  });

  it('reads the safe-area insets from a probe, as numbers', () => {
    const appended = [];
    const styles = { paddingTop: '44px', paddingRight: '0px', paddingBottom: '34px', paddingLeft: '' };
    const doc = {
      createElement: () => ({ style: {} }),
      body: { appendChild: (el) => appended.push(el) },
      defaultView: { getComputedStyle: () => styles },
    };
    const read = safeAreaReader(doc);
    expect(appended).toHaveLength(1);
    expect(appended[0].style.cssText).toContain('env(safe-area-inset-top)');
    expect(read()).toEqual({ top: 44, right: 0, bottom: 34, left: 0 });
  });
});

describe('the on-screen buttons', () => {
  it('finds a pointer in the buttons’ coordinates, past the bars, insets and ui scale', () => {
    // Portrait: the ui scale is above 1; with a notch inset.
    const layout = layoutFor(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    const rect = { left: 10, top: 20 };
    const at = (x, y) => [rect.left + layout.x + (layout.insets.left + x * layout.ui) * layout.scale, rect.top + layout.y + (layout.insets.top + y * layout.ui) * layout.scale];
    const p = controlsPoint(layout, rect, ...at(120, 45));
    expect(p.x).toBeCloseTo(120, 9);
    expect(p.y).toBeCloseTo(45, 9);
    expect(inside(FULLSCREEN_HIT, p)).toBe(true);
    expect(inside(MUTE_HIT, p)).toBe(false);
    expect(inside(MUTE_HIT, controlsPoint(layout, rect, ...at(30, 30)))).toBe(true);
  });
});
