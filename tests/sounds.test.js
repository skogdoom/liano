import { describe, it, expect } from 'vitest';
import { soundsFor } from '../src/audio/sounds.js';
import { Game } from '../src/sim/game.js';
import { Obstacle } from '../src/sim/obstacle.js';
import { SIM_DT } from '../src/config.js';
import { FORWARD_RELEASE_STEP, FALL_RELEASE_STEP, lowRockWorld, worldWith, emptyWorld, releaseAfter, releaseStepForGrab } from './helpers.js';
import { MonkeyState } from '../src/sim/monkey.js';

const names = (sounds) => sounds.map((s) => s.name);

describe('sound for events', () => {
  it('bongs for an obstacle hit and crashes for a fall', () => {
    expect(names(soundsFor([{ type: 'death', cause: 'obstacle', obstacle: 'rock' }]))).toEqual(['bong']);
    expect(names(soundsFor([{ type: 'death', cause: 'fall' }]))).toEqual(['crash']);
  });

  it('is silent for everything else: release, grab, score', () => {
    expect(
      soundsFor([
        { type: 'release', liana: 0 },
        { type: 'grab', liana: 1 },
        { type: 'score', gap: 1, score: 1 },
      ]),
    ).toEqual([]);
  });

  it('pitches the bong by the obstacle hit', () => {
    const freq = (type) => soundsFor([{ type: 'death', cause: 'obstacle', obstacle: type }])[0].voices[0].source.freq[0].v;
    expect(freq('rock')).toBeLessThan(freq('thornBush'));
  });
});

describe('sound in a real run', () => {
  // Runs the game step by step, taking events every step like the frame loop does.
  function run(game, steps, sounds) {
    for (let i = 0; i < steps; i++) {
      game.step(SIM_DT);
      sounds.push(...soundsFor(game.takeEvents()));
    }
  }

  it('is silent while hopping and swinging', () => {
    const game = new Game({ createWorld: lowRockWorld });
    const sounds = [];
    game.press();
    for (let hop = 0; hop < 4; hop++) {
      run(game, releaseStepForGrab(game.world), sounds);
      game.press();
      while (game.world.monkey.state === MonkeyState.AIRBORNE) run(game, 1, sounds);
    }
    run(game, 400, sounds);
    expect(sounds).toEqual([]);
  });

  it('plays a crash, once, for a fall', () => {
    const game = new Game({ createWorld: emptyWorld });
    const sounds = [];
    game.press();
    run(game, FALL_RELEASE_STEP, sounds);
    game.press();
    run(game, 900, sounds);
    expect(names(sounds)).toEqual(['crash']);
  });

  it('plays a bong, once, for an obstacle hit', () => {
    // A rock across the forward flight from liana 0.
    const probe = emptyWorld();
    releaseAfter(probe, FORWARD_RELEASE_STEP);
    const path = [];
    while (probe.monkey.state === MonkeyState.AIRBORNE) {
      probe.step(SIM_DT);
      path.push({ x: probe.monkey.x, y: probe.monkey.y });
    }
    const mid = path[Math.floor(path.length / 2)];
    const game = new Game({ createWorld: () => worldWith({ 0: new Obstacle(0, 'rock', mid.x, mid.y) }) });
    const sounds = [];
    game.press();
    run(game, FORWARD_RELEASE_STEP, sounds);
    game.press();
    run(game, 900, sounds);
    expect(names(sounds)).toEqual(['bong']);
  });
});
