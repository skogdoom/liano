import { describe, it, expect } from 'vitest';
import { DebugOverlay } from '../src/render/debugOverlay.js';
import { Pane } from '../src/render/pane.js';
import { layoutFor, paneLayouts } from '../src/layout.js';
import { Game } from '../src/sim/game.js';
import { World } from '../src/sim/world.js';

const game = () => new Game({ createWorld: (options) => new World({ ...options, makeObstacle: () => null, makeBanana: () => null }) });

// Panes for `game`'s worlds, laid out as in main.js.
function panesFor(g) {
  const layout = layoutFor(1280, 720, undefined, { fixed: g.worlds.length > 1 });
  const panes = g.worlds.map(() => new Pane());
  paneLayouts(layout, panes.length).forEach((p, i) => panes[i].resize(p));
  panes.forEach((pane, i) => pane.setWorld(g.worlds[i], [i]));
  return panes;
}

describe('debug view', () => {
  it('draws over the one pane in single player', () => {
    const g = game();
    const panes = panesFor(g);
    const debug = new DebugOverlay();
    debug.attach(panes);
    debug.toggle();
    debug.update(g);
    expect(debug.views).toHaveLength(1);
    expect(panes[0].overlay.children).toContain(debug.views[0].worldView);
    expect(debug.views[0].text.text).not.toMatch(/^P1/);
  });

  it('draws over every pane in split screen, with each player\'s own numbers', () => {
    const g = game();
    g.selectMode('split');
    const panes = panesFor(g);
    const debug = new DebugOverlay();
    debug.attach(panes);
    debug.toggle();
    // Different worlds: give player 2's something to count.
    g.worlds[1].lianas.clear();
    debug.update(g);
    expect(debug.views).toHaveLength(2);
    panes.forEach((pane, i) => expect(pane.overlay.children).toContain(debug.views[i].worldView));
    expect(debug.views[0].text.text).toMatch(/^P1 /);
    expect(debug.views[1].text.text).toMatch(/^P2 /);
    expect(debug.views[1].text.text).toContain('lianas 0');
    expect(debug.views[0].text.text).not.toContain('lianas 0 ');
    // The second player's hitboxes are drawn too: its monkey's circle at least.
    expect(debug.views[1].worldView.bounds.width).toBeGreaterThan(0);
    // Each player's text sits in its own pane.
    expect(debug.views[1].text.y).toBe(panes[1].layout.y + 8);
    expect(debug.views[1].text.y).toBeGreaterThan(debug.views[0].text.y);
  });

  it('follows the panes back to one when the mode changes', () => {
    const g = game();
    g.selectMode('split');
    const debug = new DebugOverlay();
    debug.attach(panesFor(g));
    expect(debug.views).toHaveLength(2);
    g.selectMode('solo');
    const panes = panesFor(g);
    debug.attach(panes);
    debug.toggle();
    debug.update(g);
    expect(debug.views).toHaveLength(1);
    expect(panes[0].overlay.children).toContain(debug.views[0].worldView);
  });

  it('draws nothing while hidden', () => {
    const g = game();
    const debug = new DebugOverlay();
    debug.attach(panesFor(g));
    debug.update(g);
    expect(debug.screenView.visible).toBe(false);
    expect(debug.views[0].worldView.visible).toBe(false);
  });
});
