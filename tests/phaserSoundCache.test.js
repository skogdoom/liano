import { describe, it, expect } from 'vitest';
import { SoundCache } from '../src/audio/cache.js';
import { BONG_PITCH, bong, crash, lifeUp, pling } from '../src/audio/recipes.js';
import { SoundPlayer } from '../src/audio/player.js';
import { FakeAudioContext } from './fakeAudio.js';

function offline(rate, length) {
  const ctx = new FakeAudioContext();
  ctx.sampleRate = rate;
  ctx.startRendering = async () => ({ length, numberOfChannels: 1, sampleRate: rate });
  return ctx;
}

describe('Phaser startup sound cache', () => {
  it('prepares all fifteen sounds once and distinguishes obstacle pitches', async () => {
    const ctx = new FakeAudioContext();
    let calls = 0;
    const cache = new SoundCache(ctx, { createOffline: (...args) => { calls++; return offline(...args); } });
    await cache.prepare();
    await cache.prepare();
    expect(calls).toBe(15);
    for (const recipe of [...Object.keys(BONG_PITCH).map(bong), crash(), pling(), lifeUp()]) expect(cache.get(recipe).length).toBe(Math.ceil(ctx.sampleRate * recipe.duration));
    expect(cache.get(bong('temple'))).not.toBe(cache.get(bong('bird')));
  });

  it('plays cached voices through the live master with one source, preserving fades', async () => {
    const ctx = new FakeAudioContext(), cache = new SoundCache(ctx, { createOffline: offline });
    await cache.prepare();
    const player = new SoundPlayer({ createContext: () => ctx, noiseFor: () => cache.noise, bufferFor: (r) => cache.get(r) });
    expect(player.play(lifeUp())).toBe(false);
    player.unlock();
    player.play(lifeUp());
    expect(ctx.sources()).toHaveLength(1);
    expect(ctx.sources()[0].buffer).toBe(cache.get(lifeUp()));
    expect(ctx.nodes.filter((n) => n.kind === 'oscillator' || n.kind === 'biquad')).toHaveLength(0);
    player.setPaused(true);
    expect(player.play(crash())).toBe(false);
    player.setMuted(true);
    expect(ctx.sources()[0].stops.at(-1)).toBe(0.05);
    ctx.sources()[0].end();
    expect(player.active.size).toBe(0);
  });

  it('falls back to synthesis if offline rendering fails', async () => {
    const ctx = new FakeAudioContext();
    let calls = 0;
    const cache = new SoundCache(ctx, { createOffline: () => {
      if (calls++ > 0) throw new Error('offline unavailable');
      return offline(ctx.sampleRate, 100);
    } });
    expect(await cache.prepare()).toBe(0);
    expect(cache.get(bong('temple'))).toBe(null);
    const player = new SoundPlayer({ createContext: () => ctx, noiseFor: () => cache.noise, bufferFor: (r) => cache.get(r) });
    player.unlock();
    player.play(lifeUp());
    expect(ctx.sources()).toHaveLength(8);
  });
});
