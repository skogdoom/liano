import { describe, it, expect } from 'vitest';
import { SoundPlayer, schedule } from '../src/audio/player.js';
import { wheee, bong, crash } from '../src/audio/recipes.js';
import { FakeAudioContext } from './fakeAudio.js';

function setup() {
  const contexts = [];
  const player = new SoundPlayer({
    createContext: () => {
      const ctx = new FakeAudioContext();
      contexts.push(ctx);
      return ctx;
    },
  });
  return { player, contexts };
}

describe('sound player', () => {
  it('creates no audio context and plays nothing before the first gesture', () => {
    const { player, contexts } = setup();
    expect(player.play(wheee())).toBe(false);
    player.setPaused(true);
    player.setPaused(false);
    player.setMuted(true);
    player.setMuted(false);
    expect(contexts).toHaveLength(0);
    expect(player.unlocked).toBe(false);
  });

  it('creates the context once, on unlock', () => {
    const { player, contexts } = setup();
    player.unlock();
    player.unlock();
    expect(contexts).toHaveLength(1);
    expect(player.unlocked).toBe(true);
  });

  it('plays every recipe, starting and stopping each source', () => {
    const { player, contexts } = setup();
    player.unlock();
    const ctx = contexts[0];
    ctx.currentTime = 3;
    for (const recipe of [wheee(), bong('branch'), crash()]) {
      const before = ctx.sources().length;
      expect(player.play(recipe)).toBe(true);
      const added = ctx.sources().slice(before);
      expect(added.length).toBeGreaterThanOrEqual(recipe.voices.length);
      for (const s of added) {
        expect(s.started).toBe(3);
        expect(s.stops).toEqual([3 + recipe.duration]);
      }
    }
  });

  it('connects every voice to the output', () => {
    const { player, contexts } = setup();
    player.unlock();
    player.play(wheee());
    const ctx = contexts[0];
    // Follow connections from each source; all must reach the destination.
    const reaches = (node, seen = new Set()) => {
      if (node === ctx.destination) return true;
      if (seen.has(node)) return false;
      seen.add(node);
      return node.outputs.some((next) => reaches(next, seen));
    };
    const osc = ctx.sources().find((s) => s.kind === 'oscillator' && s.outputs.some((o) => o.kind === 'biquad'));
    expect(reaches(osc)).toBe(true);
  });

  it('disconnects a sound when its sources end', () => {
    const { player, contexts } = setup();
    player.unlock();
    player.play(crash());
    expect(player.active.size).toBe(1);
    for (const s of contexts[0].sources()) s.end();
    expect(player.active.size).toBe(0);
    const outputs = contexts[0].nodes.filter((n) => n.kind === 'gain' && n.outputs.includes(player.master));
    expect(outputs.every((n) => n.disconnected)).toBe(true);
  });

  it('suspends while paused and resumes after', () => {
    const { player, contexts } = setup();
    player.unlock();
    const ctx = contexts[0];
    player.setPaused(true);
    expect(ctx.state).toBe('suspended');
    expect(player.play(crash())).toBe(false);
    player.setPaused(false);
    expect(ctx.state).toBe('running');
    expect(player.play(crash())).toBe(true);
  });

  it('mutes: silences the output, stops playing sounds and suspends', () => {
    const { player, contexts } = setup();
    player.unlock();
    const ctx = contexts[0];
    player.play(wheee());
    player.setMuted(true);
    expect(player.master.gain.value).toBe(0);
    expect(ctx.state).toBe('suspended');
    expect(ctx.sources().every((s) => s.stops.length === 2)).toBe(true);
    expect(player.play(crash())).toBe(false);
    player.setMuted(false);
    expect(player.master.gain.value).toBeGreaterThan(0);
    expect(ctx.state).toBe('running');
  });

  it('keeps a mute set before the first gesture', () => {
    const { player, contexts } = setup();
    player.setMuted(true);
    player.unlock();
    expect(player.master.gain.value).toBe(0);
    expect(contexts[0].state).toBe('suspended');
  });

  it('stays suspended if unlocked while paused, and resumes on unpause', () => {
    const { player, contexts } = setup();
    player.setPaused(true);
    player.unlock();
    expect(contexts[0].state).toBe('suspended');
    player.setPaused(false);
    expect(contexts[0].state).toBe('running');
  });

  it('resumes a context the browser suspended on the next gesture', () => {
    const { player, contexts } = setup();
    player.unlock();
    contexts[0].state = 'suspended'; // e.g. iOS after a phone call
    player.unlock();
    expect(contexts[0].state).toBe('running');
  });

  it('stops only the named sound, fading it out', () => {
    const { player, contexts } = setup();
    player.unlock();
    const ctx = contexts[0];
    ctx.currentTime = 1;
    player.play(wheee());
    const wheeeSources = ctx.sources().slice();
    player.play(bong('rock'));
    const bongSources = ctx.sources().slice(wheeeSources.length);
    ctx.currentTime = 1.2;
    player.stop('wheee');
    for (const s of wheeeSources) expect(s.stops.at(-1)).toBeCloseTo(1.25);
    for (const s of bongSources) expect(s.stops).toHaveLength(1);
  });

  it('survives a browser that throws on a second stop()', () => {
    const { player, contexts } = setup();
    player.unlock();
    player.play(wheee());
    for (const s of contexts[0].sources()) {
      s.stop = () => {
        throw new Error('InvalidStateError');
      };
    }
    expect(() => player.stop('wheee')).not.toThrow();
  });
});

describe('schedule', () => {
  it('applies set, linear and exponential points at t0 + t', () => {
    const calls = [];
    const param = {
      setValueAtTime: (v, t) => calls.push(['set', v, t]),
      linearRampToValueAtTime: (v, t) => calls.push(['linear', v, t]),
      exponentialRampToValueAtTime: (v, t) => calls.push(['exp', v, t]),
    };
    schedule(param, [{ t: 0, v: 1, ramp: 'set' }, { t: 0.5, v: 2, ramp: 'linear' }, { t: 1, v: 3, ramp: 'exp' }], 10);
    expect(calls).toEqual([['set', 1, 10], ['linear', 2, 10.5], ['exp', 3, 11]]);
  });
});
