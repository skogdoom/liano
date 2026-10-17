import { describe, expect, it } from 'vitest';
import { ConfigMenu } from '../src/render/configMenu.js';

const key = (code, extras = {}) => Object.assign(new Event('keydown', { cancelable: true }), { code, ...extras });
const title = () => ({ state: 'TITLE', mode: 'shared' });

describe('Phaser title config input', () => {
  it('opens on C and scopes 1/2/3 to graphics without changing the match mode', () => {
    for (const [code, choice] of [['Digit1', '1'], ['Digit2', '1.5'], ['Digit3', '2'], ['KeyA', 'auto']]) {
      const selected = [], game = title();
      const menu = new ConfigMenu('custom', { apply: (value) => selected.push(value) });
      expect(menu.interceptKey(key('Digit2'), game, true)).toBe(false);
      expect(menu.interceptKey(key('KeyC'), game, true)).toBe(true);
      expect(menu.open).toBe(true);
      expect(menu.interceptKey(key(code), game, true)).toBe(true);
      expect(selected).toEqual([choice]);
      expect(game.mode).toBe('shared');
    }
  });

  it('swallows start, game settings and unrelated keys while open', () => {
    const menu = new ConfigMenu('auto', { apply() {} });
    const game = title();
    menu.show(game);
    for (const code of ['Space', 'KeyG', 'KeyH', 'KeyS', 'KeyP', 'KeyD']) {
      const event = key(code);
      expect(menu.interceptKey(event, game, true)).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(menu.open).toBe(true);
    }
  });

  it('clears queued game input on entry/exit and ignores held or duplicate selections', () => {
    let cleared = 0;
    const selected = [], game = title();
    const menu = new ConfigMenu('auto', { apply: (value) => selected.push(value), clear: () => cleared++ });
    menu.interceptKey(key('KeyC'), game, true);
    menu.interceptKey(key('KeyC', { repeat: true }), game, true);
    expect(menu.open).toBe(true);
    menu.interceptKey(key('Digit1', { repeat: true }), game, true);
    expect(selected).toEqual([]);
    menu.interceptKey(key('Escape'), game, true);
    expect(menu.open).toBe(false);
    expect(cleared).toBe(2);
    menu.show(game);
    menu.interceptKey(key('Digit1'), game, true);
    menu.interceptKey(key('Digit2'), game, true);
    expect(selected).toEqual(['1']);
  });

  it('does not open in gameplay, results or the resume grace period', () => {
    const menu = new ConfigMenu('auto', { apply() {} });
    for (const state of ['PLAYING', 'RESULTS']) {
      expect(menu.interceptKey(key('KeyC'), { state }, true)).toBe(false);
      expect(menu.open).toBe(false);
    }
    menu.interceptKey(key('KeyC'), title(), false);
    expect(menu.open).toBe(false);
    menu.show(title());
    menu.sync({ state: 'PLAYING' });
    expect(menu.open).toBe(false);
  });

  it('returns to the title without reloading an already selected graphics choice', () => {
    let applied = 0;
    const saved = [];
    const menu = new ConfigMenu('1.5', { apply() { applied++; }, remember: (choice) => saved.push(choice) });
    menu.show(title());
    menu.choose('1.5');
    expect(menu.open).toBe(false);
    expect(applied).toBe(0);
    expect(saved).toEqual(['1.5']);
  });

  it('preserves browser shortcuts without forwarding them to game input', () => {
    const menu = new ConfigMenu('auto', { apply() {} });
    menu.show(title());
    const event = key('KeyR', { metaKey: true });
    expect(menu.interceptKey(event, title(), true)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  it('scopes X to the submenu and consumes a single art navigation', () => {
    const selected = [], game = title();
    let cleared = 0;
    const menu = new ConfigMenu('1.5', { art: 'classic', applyArt: (choice) => selected.push(choice), clear: () => cleared++ });
    expect(menu.interceptKey(key('KeyX'), game, true)).toBe(false);
    menu.show(game);
    menu.interceptKey(key('KeyX', { repeat: true }), game, true);
    expect(selected).toEqual([]);
    const event = key('KeyX');
    expect(menu.interceptKey(event, game, true)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    menu.interceptKey(key('KeyX'), game, true);
    menu.choose('1');
    expect(selected).toEqual(['cartoon']);
    expect(cleared).toBe(2);
  });

  it('does not reload an already selected art pack', () => {
    const selected = [], remembered = [];
    const menu = new ConfigMenu('auto', { art: 'cartoon', applyArt: (choice) => selected.push(choice), rememberArt: (choice) => remembered.push(choice) });
    menu.show(title()); menu.chooseArt('cartoon');
    expect(selected).toEqual([]);
    expect(remembered).toEqual(['cartoon']);
    expect(menu.open).toBe(false);
  });
});
