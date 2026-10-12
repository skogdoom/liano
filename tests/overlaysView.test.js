import { describe, it, expect } from 'vitest';
import {
  CONTROL_2P,
  GOLD,
  CREAM,
  StageBannerState,
  arrowState,
  bannerPlacement,
  centredRow,
  modeLook,
  outNote,
  panelsShown,
  pausePrompt,
  prompts,
  resultsBananas,
  resultsState,
  titleState,
} from '../src/views/overlays.js';
import { layoutFor, paneLayouts } from '../src/layout.js';
import { GameState } from '../src/sim/game.js';
import { MONKEY_RADIUS } from '../src/config.js';

// The overlays' view-model (PHASER_PLAN.md, M6): both versions draw them from these.

const game = (over = {}) => ({
  mode: 'solo',
  players: 1,
  worlds: [{ stages: [1] }],
  state: GameState.TITLE,
  stateTime: 1,
  lives: false,
  slip: false,
  shadow: false,
  score: 0,
  best: 0,
  newBest: false,
  winners: [0],
  playerScore: () => 0,
  playerBananas: () => ({ taken: 0, passed: 0 }),
  playerOut: () => false,
  ...over,
});

describe('the overlays', () => {
  it('show the title, results or pause panel for the state, the first two not while paused', () => {
    expect(panelsShown(game(), null)).toEqual({ title: true, gameOver: false, paused: false });
    expect(panelsShown(game({ state: GameState.RESULTS }), null)).toEqual({ title: false, gameOver: true, paused: false });
    expect(panelsShown(game({ state: GameState.RESULTS }), 'manual')).toEqual({ title: false, gameOver: false, paused: true });
    // Held for the graphics context: paused, with no panel (the notice says why).
    expect(panelsShown(game({ state: GameState.PLAYING }), 'graphics').paused).toBe(false);
  });

  it('word the prompts for the input in use, and name both players’ keys in two-player modes', () => {
    expect(prompts('touch', 1)).toMatchObject({ start: 'Tap to start', control: 'TAP  ·  let go' });
    expect(prompts('other', 1).start).toBe('Press Space to start');
    expect(prompts('other', 2).control).toBe(CONTROL_2P);
    expect(pausePrompt('manual', 'touch')).toBe('Press P to resume');
    expect(pausePrompt('unfocused', 'touch')).toBe('Tap to resume');
  });

  it('show the settings on the title, gold when on; two-player modes always have lives and no shadow', () => {
    const solo = titleState(game({ lives: true, shadow: false }), true);
    expect(solo.lives).toEqual({ text: 'H · Lives: on', color: GOLD, alpha: 1 });
    expect(solo.shadow).toEqual({ text: 'S · Shadow: off', color: CREAM, alpha: 0.8 });
    const shared = titleState(game({ mode: 'shared', lives: false, shadow: true }), true);
    expect(shared.lives).toEqual({ text: 'Lives: on', color: CREAM, alpha: 0.55 });
    expect(shared.shadow.text).toBe('Shadow: off');
    // With a keyboard the lines above the modes and settings move up to make room.
    expect(titleState(game(), false)).toMatchObject({ taglineY: 10, controlY: 70, promptY: 125 });
    expect(titleState(game(), true)).toMatchObject({ taglineY: 0, controlY: 58, promptY: 156 });
    expect(modeLook('solo', 'solo').color).toBe(GOLD);
    expect(modeLook('split', 'solo')).toEqual({ color: CREAM, alpha: 0.8 });
  });

  it('centre a row of items together', () => {
    expect(centredRow([10, 20], 10)).toEqual([-15, 10]);
    expect(centredRow([30], 22)).toEqual([0]);
  });

  it('say who won, by totals, or a draw, and the bananas per player', () => {
    const solo = resultsState(game({ state: GameState.RESULTS, score: 9, best: 12, playerBananas: () => ({ taken: 3, passed: 5 }) }));
    expect(solo).toMatchObject({ title: 'GAME OVER', score: 'Score 9', best: 'Best 12', bananas: '3 / 5', bananasY: 42, newBest: false });
    const two = { players: 2, mode: 'split', playerScore: (p) => [4, 6][p], playerBananas: (p) => ({ taken: p, passed: 2 }) };
    expect(resultsState(game({ ...two, winners: [1] }))).toMatchObject({ title: 'P2 WINS', score: 'P1 4  ·  P2 6', best: '', bananas: 'P1 0 / 2  ·  P2 1 / 2', bananasY: 10 });
    expect(resultsState(game({ ...two, winners: [0, 1] })).title).toBe('DRAW');
    // The key changes with what is shown.
    expect(resultsState(game({ score: 1 })).key).not.toBe(resultsState(game({ score: 2 })).key);
    const at = resultsBananas(50);
    expect(at.textX - at.iconX).toBe(13 + 10 + 25);
  });

  it('bring up a banner on each new stage, but not for a new world', () => {
    const banner = new StageBannerState();
    const world = { stages: [1] };
    const playing = game({ state: GameState.PLAYING });
    expect(banner.update(playing, world, 0.1).alpha).toBe(0);
    world.stages = [2];
    expect(banner.update(playing, world, 1)).toEqual({ alpha: 1, title: 'Stage 2', subtitle: 'Late afternoon' });
    expect(banner.update(playing, world, 5).alpha).toBe(0);
    expect(banner.update(playing, { stages: [3] }, 0.5).alpha).toBe(0);
    // Hidden off the run.
    world.stages = [4];
    expect(banner.update(game({ state: GameState.RESULTS }), { stages: [6] }, 0).alpha).toBe(0);
  });

  it('place a banner and an out note in each split pane', () => {
    const layout = layoutFor(1280, 720, undefined, { fixed: true });
    const panes = paneLayouts(layout, 2);
    expect(bannerPlacement(layout, 1, 0)).toEqual({ ...layout.panels.banner, scale: layout.ui });
    expect(bannerPlacement(layout, 2, 1)).toEqual({ x: panes[1].width / 2, y: panes[1].y + panes[1].height * 0.72, scale: 0.6 });
    const g = game({ state: GameState.PLAYING, playerOut: (p) => p === 0 });
    expect(outNote(g, layout, 2, 0)).toEqual({ text: 'P1 is out', x: panes[0].width / 2, y: panes[0].y + panes[0].height / 2 });
    expect(outNote(g, layout, 2, 1)).toBeNull();
    expect(outNote(g, layout, 1, 0)).toBeNull();
  });

  it('point the arrow at a monkey above the view, kept inside it, in single player only', () => {
    const layout = layoutFor(1280, 720);
    const above = { x: 5000, y: -MONKEY_RADIUS - 1 - layout.bandTop };
    expect(arrowState(game(), above, 0, layout)).toEqual({ visible: true, x: layout.view.width - 16 });
    expect(arrowState(game(), { x: 300, y: 100 }, 100, layout)).toEqual({ visible: false, x: 200 });
    expect(arrowState(game({ players: 2 }), above, 0, layout)).toEqual({ visible: false, x: null });
  });
});
