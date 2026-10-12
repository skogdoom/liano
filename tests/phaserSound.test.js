import { describe, it, expect, vi } from 'vitest';
import { crash } from '../src/audio/recipes.js';
import { createPhaserSoundPlayer, ignoreRefusals } from '../src/phaser/sound.js';
import { FakeAudioContext } from './fakeAudio.js';

// Phaser's WebAudioSoundManager, as far as the player uses it: its context, its master
// mute node as the destination, setMute, setAudioContext and the lost-focus flag.
function fakeManager() {
  const manager = {
    context: new FakeAudioContext(),
    muted: false,
    gameLostFocus: false,
    swaps: 0,
    setMute(muted) {
      manager.muted = muted;
    },
    setAudioContext(ctx) {
      manager.context.close();
      manager.context = ctx;
      manager.destination = ctx.createGain();
      manager.swaps++;
    },
  };
  manager.destination = manager.context.createGain();
  return manager;
}

describe('the sound player on Phaser', () => {
  it('plays the recipes through Phaser’s context and master nodes', () => {
    const manager = fakeManager();
    const player = createPhaserSoundPlayer(manager);
    expect(player.play(crash())).toBe(false); // nothing before the first gesture
    player.unlock();
    expect(player.play(crash())).toBe(true);
    // Recipe → player's gain → compressor → Phaser's destination.
    const compressor = manager.context.nodes.find((n) => n.kind === 'compressor');
    expect(compressor.outputs).toEqual([manager.destination]);
    expect(manager.context.sources().length).toBeGreaterThan(0);
  });

  it('mutes with Phaser’s mute, and stops what is playing', () => {
    const manager = fakeManager();
    const player = createPhaserSoundPlayer(manager);
    player.unlock();
    player.play(crash());
    player.setMuted(true);
    expect(manager.muted).toBe(true);
    expect(player.play(crash())).toBe(false);
    player.setMuted(false);
    expect(manager.muted).toBe(false);
  });

  it('keeps Phaser from resuming the context while paused or muted', () => {
    const manager = fakeManager();
    const player = createPhaserSoundPlayer(manager);
    player.unlock();
    expect(manager.gameLostFocus).toBe(false);
    player.setPaused(true);
    expect(manager.gameLostFocus).toBe(true);
    expect(manager.context.state).toBe('suspended');
    player.setPaused(false);
    expect(manager.gameLostFocus).toBe(false);
    player.setMuted(true);
    expect(manager.gameLostFocus).toBe(true);
  });

  it('replaces a context that stays stuck through Phaser, at the next gesture', () => {
    const manager = fakeManager();
    let time = 0;
    const replacement = new FakeAudioContext();
    const player = createPhaserSoundPlayer(manager, { createContext: () => replacement, now: () => time });
    player.unlock();
    const first = manager.context;
    // Running, but its clock stands still.
    player.setPaused(false);
    time = 2000;
    player.setPaused(false);
    player.unlock();
    expect(manager.swaps).toBe(1);
    expect(manager.context).toBe(replacement);
    expect(first.state).toBe('closed');
    expect(player.status).toBe('running (rebuilt 1x)');
    // The new context gets the mute state again.
    player.setMuted(true);
    expect(manager.muted).toBe(true);
  });
});

describe('a refused resume or suspend', () => {
  it('is marked as handled, and still reaches the caller', async () => {
    const ctx = { resume: () => Promise.reject(new Error('not allowed')) };
    ignoreRefusals(ctx);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const result = ctx.resume();
    await expect(result).rejects.toThrow('not allowed');
    ctx.resume();
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
