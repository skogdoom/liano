import { describe, it, expect } from 'vitest';
import { SoundPlayer, schedule } from '../src/audio/player.js';
import { bong, crash } from '../src/audio/recipes.js';
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
    expect(player.play(crash())).toBe(false);
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
    for (const recipe of [bong('rock'), bong('branch'), bong('thornBush'), crash()]) {
      const before = ctx.sources().length;
      expect(player.play(recipe)).toBe(true);
      const added = ctx.sources().slice(before);
      expect(added).toHaveLength(recipe.voices.length);
      for (const s of added) {
        expect(s.started).toBe(3);
        expect(s.stops).toEqual([3 + recipe.duration]);
      }
    }
  });

  it('connects every voice to the output', () => {
    const { player, contexts } = setup();
    player.unlock();
    player.play(crash());
    const ctx = contexts[0];
    // Follow connections from each source; all must reach the destination.
    const reaches = (node, seen = new Set()) => {
      if (node === ctx.destination) return true;
      if (seen.has(node)) return false;
      seen.add(node);
      return node.outputs.some((next) => reaches(next, seen));
    };
    expect(ctx.sources().length).toBeGreaterThan(0);
    for (const source of ctx.sources()) expect(reaches(source)).toBe(true);
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
    player.play(crash());
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

  it('resumes when the game resumes while the suspend is still settling', () => {
    const { player, contexts } = setup();
    player.unlock();
    const ctx = contexts[0];
    ctx.deferred = true;
    player.setPaused(true); // tabbing away
    player.setPaused(false); // and straight back: the context still says 'running'
    ctx.settle(); // the suspend lands; the state change asks for a resume
    ctx.settle();
    expect(ctx.state).toBe('running');
    expect(player.play(crash())).toBe(true);
  });

  it('brings back a context the browser interrupted or suspended, on the next frame', () => {
    const { player, contexts } = setup();
    player.unlock();
    for (const state of ['interrupted', 'suspended']) {
      contexts[0].state = state;
      player.setPaused(false);
      expect(contexts[0].state).toBe('running');
    }
  });

  it('keeps a context the browser stopped quiet while the game is paused', () => {
    const { player, contexts } = setup();
    player.unlock();
    player.setPaused(true);
    contexts[0].log.length = 0;
    contexts[0].state = 'suspended';
    player.setPaused(true);
    expect(contexts[0].log).toEqual([]);
  });

  describe('a context that does not come back', () => {
    function stuckSetup() {
      let time = 0;
      const contexts = [];
      const player = new SoundPlayer({
        now: () => time,
        createContext: () => {
          const ctx = new FakeAudioContext();
          contexts.push(ctx);
          return ctx;
        },
      });
      // One frame: the clock of a context that runs advances.
      const frame = (ms = 16) => {
        time += ms;
        if (contexts.at(-1)?.state === 'running') contexts.at(-1).currentTime += ms / 1000;
        player.setPaused(false);
      };
      return { player, contexts, frame, advance: (ms) => (time += ms) };
    }

    it('is replaced at the next gesture once it has been stuck for a while', () => {
      const { player, contexts, frame } = stuckSetup();
      player.unlock();
      for (let i = 0; i < 10; i++) frame();
      // The window switch leaves it suspended, and the browser will not resume it.
      contexts[0].resume = () => Promise.reject(new Error('not allowed'));
      contexts[0].state = 'suspended';
      for (let i = 0; i < 30; i++) frame(100);
      // Frames alone do not replace it (a new context needs a gesture) ...
      expect(contexts).toHaveLength(1);
      expect(player.play(crash())).toBe(true);
      // ... the next key press does.
      player.unlock();
      expect(contexts).toHaveLength(2);
      expect(contexts[0].log).toContain('close');
      expect(contexts[1].state).toBe('running');
      expect(player.rebuilds).toBe(1);
      expect(player.status).toBe('running (rebuilt 1x)');
      expect(player.play(crash())).toBe(true);
      expect(contexts[1].sources().length).toBeGreaterThan(0);
    });

    it('is replaced when it says it runs but its clock stands still', () => {
      const { player, contexts, advance } = stuckSetup();
      player.unlock();
      for (let i = 0; i < 40; i++) {
        advance(100);
        player.setPaused(false); // the clock never moves
      }
      player.unlock();
      expect(contexts).toHaveLength(2);
    });

    it('keeps a context that comes back in time, and one that is paused or muted', () => {
      const { player, contexts, frame, advance } = stuckSetup();
      player.unlock();
      for (let i = 0; i < 10; i++) frame();
      contexts[0].state = 'suspended';
      frame(1000); // not stuck for long yet
      frame(); // resume() brings it back
      expect(contexts[0].state).toBe('running');
      for (let i = 0; i < 20; i++) frame(200);
      player.unlock();
      expect(contexts).toHaveLength(1);
      // Paused: a suspended context is what is wanted, however long it lasts.
      player.setPaused(true);
      for (let i = 0; i < 40; i++) {
        advance(500);
        player.setPaused(true);
      }
      player.unlock();
      player.setMuted(true);
      advance(60000);
      player.unlock();
      expect(contexts).toHaveLength(1);
    });
  });

  it('describes itself for the debug view: locked, then running with its clock and plays', () => {
    const { player } = setup();
    expect(player.details).toBe('locked');
    player.unlock();
    expect(player.details).toMatch(/^running, clock 0\.0 s, 0 played, gain 0\.6, 8000 Hz/);
    player.play(crash());
    player.setPaused(true);
    player.play(crash()); // refused while paused: not counted
    expect(player.details).toMatch(/1 played/);
  });

  it('fades out playing sounds when muted', () => {
    const { player, contexts } = setup();
    player.unlock();
    const ctx = contexts[0];
    ctx.currentTime = 1;
    player.play(bong('rock'));
    ctx.currentTime = 1.2;
    player.setMuted(true);
    for (const s of ctx.sources()) expect(s.stops.at(-1)).toBeCloseTo(1.25);
  });

  it('survives a browser that throws on a second stop()', () => {
    const { player, contexts } = setup();
    player.unlock();
    player.play(crash());
    for (const s of contexts[0].sources()) {
      s.stop = () => {
        throw new Error('InvalidStateError');
      };
    }
    expect(() => player.setMuted(true)).not.toThrow();
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
