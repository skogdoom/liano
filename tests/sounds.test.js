import { describe, it, expect } from 'vitest';
import { soundActions } from '../src/audio/sounds.js';
import { Game } from '../src/sim/game.js';
import { Obstacle } from '../src/sim/obstacle.js';
import { SIM_DT, LIANA_SPACING } from '../src/config.js';
import { FORWARD_RELEASE_STEP, FALL_RELEASE_STEP, lowRockWorld, worldWith, emptyWorld, stepN, releaseAfter } from './helpers.js';
import { MonkeyState } from '../src/sim/monkey.js';

const played = (actions) => actions.filter((a) => a.play).map((a) => a.play.name);

describe('sound for events', () => {
  it('maps each event to its sound', () => {
    expect(played(soundActions([{ type: 'release', liana: 0 }]))).toEqual(['wheee']);
    expect(played(soundActions([{ type: 'swish', liana: 0 }]))).toEqual(['swish']);
    expect(played(soundActions([{ type: 'death', cause: 'obstacle', obstacle: 'rock' }]))).toEqual(['bong']);
    expect(played(soundActions([{ type: 'death', cause: 'fall' }]))).toEqual(['crash']);
  });

  it('is silent for other events', () => {
    expect(soundActions([{ type: 'grab', liana: 1 }, { type: 'score', gap: 1, score: 1 }])).toEqual([]);
  });

  it('pitches the bong by the obstacle hit', () => {
    const freq = (type) => soundActions([{ type: 'death', cause: 'obstacle', obstacle: type }])[1].play.voices[0].source.freq[0].v;
    expect(freq('rock')).toBeLessThan(freq('thornBush'));
  });

  it('cuts the wheee on death, before the death sound', () => {
    const actions = soundActions([{ type: 'death', cause: 'fall' }]);
    expect(actions[0]).toEqual({ stop: 'wheee' });
    expect(actions[1].play.name).toBe('crash');
  });

  it('plays one sound per event, in order', () => {
    const events = [
      { type: 'swish', liana: 0 },
      { type: 'release', liana: 0 },
      { type: 'grab', liana: 1 },
      { type: 'swish', liana: 1 },
    ];
    expect(played(soundActions(events))).toEqual(['swish', 'wheee', 'swish']);
  });
});

describe('sound in a real run', () => {
  // Runs the game step by step, taking events every step like the frame loop does.
  function run(game, steps, actions) {
    for (let i = 0; i < steps; i++) {
      game.step(SIM_DT);
      actions.push(...soundActions(game.takeEvents()));
    }
  }

  it('plays one wheee per release and one swish per pass through the bottom', () => {
    const game = new Game({ createWorld: lowRockWorld });
    const actions = [];
    game.press();
    for (let hop = 0; hop < 4; hop++) {
      run(game, FORWARD_RELEASE_STEP, actions);
      game.press();
      while (game.world.monkey.state === MonkeyState.AIRBORNE) run(game, 1, actions);
    }
    run(game, 400, actions); // hang on for a while
    const names = played(actions);
    expect(names.filter((n) => n === 'wheee')).toHaveLength(4);
    // 400 steps of swinging after the last grab: 2 passes per 312-step period.
    expect(names.filter((n) => n === 'swish').length).toBeGreaterThanOrEqual(2);
    expect(names).not.toContain('bong');
    expect(names).not.toContain('crash');
  });

  it('plays a crash, once, for a fall', () => {
    const game = new Game({ createWorld: emptyWorld });
    const actions = [];
    game.press();
    run(game, FALL_RELEASE_STEP, actions);
    game.press();
    run(game, 900, actions);
    expect(played(actions).filter((n) => n === 'crash')).toHaveLength(1);
    expect(played(actions)).not.toContain('bong');
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
    const actions = [];
    game.press();
    run(game, FORWARD_RELEASE_STEP, actions);
    game.press();
    run(game, 900, actions);
    expect(played(actions).filter((n) => n === 'bong')).toHaveLength(1);
    expect(played(actions)).not.toContain('crash');
  });
});
