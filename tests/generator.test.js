import { describe, it, expect } from 'vitest';
import {
  createLiana,
  createObstacle,
  templeGapFor,
  branchDecorationFor,
  rulesFor,
  birdPatrolBounds,
  movingCandidate,
  movingTypesFor,
  gapIndexRange,
  lianaIndexRange,
  updateLianas,
  updateObstacles,
} from '../src/sim/generator.js';
import { mulberry32, mixSeed } from '../src/sim/rng.js';
import {
  BRANCH_DECORATIONS,
  DAY_DECORATIONS,
  NIGHT_DECORATIONS,
  Obstacle,
  ObstacleType,
  STATIC_TYPES,
  MOVING_TYPES,
} from '../src/sim/obstacle.js';
import { dayCycleFor, dayCycleRange, timeOfDayFor, TimeOfDay } from '../src/sim/stages.js';
import { isPassable } from '../src/sim/windowTable.js';
import { isPathClearOfLianas } from '../src/sim/feasibility.js';
import { World } from '../src/sim/world.js';
import {
  LIANA_SPACING,
  SCREEN_WIDTH,
  CAMERA_TARGET_X,
  WORLD_MARGIN,
  OBSTACLE_Y_RANGE,
  OBSTACLE_HITBOXES,
  STAGES,
  MOVING_FROM,
  BIRD_Y_RANGE,
  BIRD_BOB,
  BLUE_BIRD_HIGH,
  BLUE_BIRD_LOW,
  BLUE_BIRD_BOB,
  PURPLE_BIRD_RADIUS,
  PURPLE_BIRD_TOP,
  BRANCH_DECORATION_CHANCE,
  BRANCH_DECORATION_CHANCE_NIGHT,
  NIGHT_DECORATION_SHARE,
  BEEHIVE_SHARE,
  TEMPLE_MIN_GAP,
  TEMPLE_VARIANTS,
} from '../src/config.js';

describe('liana generation', () => {
  it('places liana i at i · LIANA_SPACING', () => {
    expect(createLiana(0).x).toBe(0);
    expect(createLiana(7).x).toBe(7 * LIANA_SPACING);
    expect(createLiana(-3).x).toBe(-3 * LIANA_SPACING);
  });

  it.each([0, 123.4, -5000, 250000])('covers the view plus the margin on both sides (x = %d)', (x) => {
    const { first, last } = lianaIndexRange(x);
    const viewLeft = x - CAMERA_TARGET_X;
    const viewRight = viewLeft + SCREEN_WIDTH;
    expect(first * LIANA_SPACING).toBeGreaterThanOrEqual(viewLeft - WORLD_MARGIN);
    expect((first - 1) * LIANA_SPACING).toBeLessThan(viewLeft - WORLD_MARGIN);
    expect(last * LIANA_SPACING).toBeLessThanOrEqual(viewRight + WORLD_MARGIN);
    expect((last + 1) * LIANA_SPACING).toBeGreaterThan(viewRight + WORLD_MARGIN);
  });

  it('adds lianas that come into range and removes those far out of range', () => {
    const lianas = new Map();
    updateLianas(lianas, 0, null);
    const initial = lianaIndexRange(0);
    expect([...lianas.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: initial.last - initial.first + 1 }, (_, k) => initial.first + k),
    );

    const far = 50 * SCREEN_WIDTH;
    updateLianas(lianas, far, null);
    const range = lianaIndexRange(far);
    for (const i of lianas.keys()) {
      expect(i).toBeGreaterThanOrEqual(range.first);
      expect(i).toBeLessThanOrEqual(range.last);
    }
    expect(lianas.size).toBe(range.last - range.first + 1);
  });

  it('keeps lianas one spacing past the edge of the range (hysteresis)', () => {
    const lianas = new Map();
    updateLianas(lianas, 0, null);
    const leftmost = lianaIndexRange(0).first;
    const kept = lianas.get(leftmost);
    // Move right just enough for the leftmost liana to leave the generation range.
    const x = leftmost * LIANA_SPACING + CAMERA_TARGET_X + WORLD_MARGIN + 1;
    expect(lianaIndexRange(x).first).toBe(leftmost + 1);
    updateLianas(lianas, x, null);
    expect(lianas.get(leftmost)).toBe(kept);
    // One more spacing and it goes.
    updateLianas(lianas, x + LIANA_SPACING, null);
    expect(lianas.has(leftmost)).toBe(false);
  });

  it('never removes the liana being held', () => {
    const lianas = new Map();
    updateLianas(lianas, 0, null);
    const held = lianas.get(0);
    updateLianas(lianas, 100 * SCREEN_WIDTH, held);
    expect(lianas.get(0)).toBe(held);
  });
});

describe('rng', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('mixes seed and index into distinct seeds', () => {
    const seeds = new Set();
    for (let i = -500; i < 500; i++) seeds.add(mixSeed(7, i));
    expect(seeds.size).toBe(1000);
    expect(mixSeed(7, 3)).not.toBe(mixSeed(8, 3));
  });
});

describe('obstacle generation', () => {
  const SEED = 12345;

  it('leaves the gaps on both sides of the start liana empty', () => {
    expect(createObstacle(SEED, -1)).toBeNull();
    expect(createObstacle(SEED, 0)).toBeNull();
  });

  it('puts one obstacle, horizontally centred, in every other gap', () => {
    for (let gap = -50; gap < 300; gap++) {
      if (gap === -1 || gap === 0) continue;
      const o = createObstacle(SEED, gap);
      expect(o.gap).toBe(gap);
      // Moving obstacles move around the gap centre (birds within half a pixel of it).
      expect(Math.abs(o.baseX - (gap + 0.5) * LIANA_SPACING)).toBeLessThanOrEqual(0.5);
      if (o.moving) continue;
      expect(o.x).toBe((gap + 0.5) * LIANA_SPACING);
      expect(o.y).toBeGreaterThanOrEqual(OBSTACLE_Y_RANGE[0]);
      expect(o.y).toBeLessThanOrEqual(OBSTACLE_Y_RANGE[1]);
    }
  });

  it('uses all types, roughly evenly', () => {
    const counts = Object.fromEntries([...STATIC_TYPES, ...MOVING_TYPES].map((t) => [t, 0]));
    for (let gap = 1; gap <= 3000; gap++) counts[createObstacle(SEED, gap).type]++;
    // Late stages are 80 % moving and half their static gaps aim for the hardest grade, which
    // the branch (mostly an easy obstacle) seldom has; beehives are rarer than the rest, and
    // temples much rarer (one a day/night cycle: see below).
    const rare = [ObstacleType.BEEHIVE, ObstacleType.TEMPLE];
    for (const t of STATIC_TYPES) expect(counts[t]).toBeGreaterThan(rare.includes(t) ? 10 : 25);
    const statics = STATIC_TYPES.reduce((sum, t) => sum + counts[t], 0) - counts[ObstacleType.TEMPLE];
    // The grade a gap aims for favours the beehive a little (it is mostly a hard obstacle),
    // but it stays one of the rarest.
    expect(counts[ObstacleType.BEEHIVE] / statics).toBeGreaterThan(BEEHIVE_SHARE / 2);
    expect(counts[ObstacleType.BEEHIVE] / statics).toBeLessThan(BEEHIVE_SHARE * 2.5);
    // The bat only flies at night, one stage in five.
    // The aimed grade favours some types a little (blue birds, the easiest to dodge, come least).
    const nightOnly = [ObstacleType.BAT, ObstacleType.CIRCLE_BAT];
    for (const t of MOVING_TYPES) expect(counts[t]).toBeGreaterThan(nightOnly.includes(t) ? 50 : 150);
  });

  it('carries a decoration on some branches, for show, and never on anything else', () => {
    let branches = 0;
    let decorated = 0;
    for (const seed of [1, 2, 3, 12345]) {
      for (let gap = 1; gap <= 1000; gap++) {
        const o = createObstacle(seed, gap);
        if (o.type !== ObstacleType.BRANCH) {
          expect(o.decoration).toBeNull();
          continue;
        }
        expect(o.decoration).toBe(branchDecorationFor(seed, gap)); // deterministic in (seed, gap)
        branches++;
        if (!o.decoration) continue;
        decorated++;
        expect(BRANCH_DECORATIONS).toContain(o.decoration);
        // Not part of the hitbox: the branch is the branch.
        expect(o.hitbox).toBe(new Obstacle(gap, ObstacleType.BRANCH, o.baseX, o.baseY, null, o.scale).hitbox);
        expect(isPassable(o.type, o.y, o.scale, rulesFor(gap).minSteps)).toBe(true);
      }
    }
    expect(branches).toBeGreaterThan(100);
    expect(decorated).toBeGreaterThan(5);
  });

  describe('the temple', () => {
    const cycles = 8;
    const lastGap = dayCycleRange(cycles - 1)[1];

    it('comes once in each day/night cycle, at a random gap in it, and nowhere else', () => {
      for (const seed of [1, 2, 3]) {
        const found = {};
        for (let gap = 1; gap <= lastGap; gap++) {
          if (createObstacle(seed, gap).type !== ObstacleType.TEMPLE) continue;
          const cycle = dayCycleFor(gap);
          (found[cycle] ??= []).push(gap);
        }
        for (let cycle = 0; cycle < cycles; cycle++) {
          const [first, last] = dayCycleRange(cycle);
          expect(found[cycle]).toEqual([templeGapFor(seed, cycle)]);
          expect(found[cycle][0]).toBeGreaterThanOrEqual(Math.max(first, TEMPLE_MIN_GAP));
          expect(found[cycle][0]).toBeLessThanOrEqual(last);
        }
      }
    });

    it('is anywhere in its cycle, so it differs from one cycle and seed to the next', () => {
      const offsets = new Set();
      for (let seed = 1; seed <= 20; seed++) {
        for (let cycle = 1; cycle < 6; cycle++) offsets.add(templeGapFor(seed, cycle) - dayCycleRange(cycle)[0]);
      }
      expect(offsets.size).toBeGreaterThan(60);
      const early = [];
      const late = [];
      for (let seed = 1; seed <= 200; seed++) {
        const o = templeGapFor(seed, 3) - dayCycleRange(3)[0];
        (o < 50 ? early : late).push(o);
      }
      expect(early.length).toBeGreaterThan(60);
      expect(late.length).toBeGreaterThan(60);
    });

    it('is a static obstacle in the lower region, at a height that can be passed, with a look of its own', () => {
      const variants = new Set();
      for (let seed = 1; seed <= 30; seed++) {
        for (let cycle = 0; cycle < 6; cycle++) {
          const gap = templeGapFor(seed, cycle);
          const o = createObstacle(seed, gap);
          expect(o.type).toBe(ObstacleType.TEMPLE);
          expect(o.moving).toBe(false);
          expect(o.decoration).toBeNull();
          expect(o.x).toBe((gap + 0.5) * LIANA_SPACING);
          expect(o.y).toBeGreaterThanOrEqual(305);
          expect(o.y).toBeLessThanOrEqual(OBSTACLE_Y_RANGE[1]);
          expect(isPassable(o.type, o.y, o.scale, rulesFor(gap).minSteps)).toBe(true);
          expect(o.variant).toBeGreaterThanOrEqual(0);
          expect(o.variant).toBeLessThan(TEMPLE_VARIANTS);
          variants.add(o.variant);
          // The same hitbox whatever the look: what differs is only the art.
          expect(o.hitbox).toBe(new Obstacle(gap, ObstacleType.TEMPLE, 0, 0, null, o.scale, null, 3 - o.variant).hitbox);
          // Deterministic in (seed, gap).
          expect(createObstacle(seed, gap).toData()).toEqual(o.toData());
        }
      }
      expect([...variants].sort()).toEqual([0, 1, 2, 3]);
    });

    it('goes to the worker and back with its look', () => {
      const o = createObstacle(5, templeGapFor(5, 1));
      const back = Obstacle.fromData(JSON.parse(JSON.stringify(o.toData())));
      expect(back.variant).toBe(o.variant);
      expect(back.inGap(0).variant).toBe(o.variant);
      expect(new Obstacle(0, ObstacleType.ROCK, 0, 0).variant).toBeNull();
    });
  });

  it('keeps the night decorations for the night, and shows more decorations then', () => {
    expect(NIGHT_DECORATIONS.length).toBeGreaterThan(0);
    expect([...DAY_DECORATIONS, ...NIGHT_DECORATIONS].sort()).toEqual([...BRANCH_DECORATIONS].sort());
    const total = { night: 0, day: 0 };
    const decorated = { night: 0, day: 0 };
    const seen = { night: new Set(), day: new Set() };
    let nightKind = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (let gap = 1; gap <= 1500; gap++) {
        const d = branchDecorationFor(seed, gap);
        const when = timeOfDayFor(gap) === TimeOfDay.NIGHT ? 'night' : 'day';
        total[when]++;
        if (!d) continue;
        decorated[when]++;
        seen[when].add(d);
        if (NIGHT_DECORATIONS.includes(d)) {
          expect(when).toBe('night');
          nightKind++;
        }
      }
    }
    // By day, the usual odds and none of the night ones; by night, more branches carry one
    // and a share of those carry a night one.
    expect(decorated.day / total.day).toBeCloseTo(BRANCH_DECORATION_CHANCE, 1);
    expect(Math.abs(decorated.day / total.day - BRANCH_DECORATION_CHANCE)).toBeLessThan(0.02);
    expect(Math.abs(decorated.night / total.night - BRANCH_DECORATION_CHANCE_NIGHT)).toBeLessThan(0.04);
    expect(Math.abs(nightKind / decorated.night - NIGHT_DECORATION_SHARE)).toBeLessThan(0.05);
    // All of them at night, but the perched bird: there are no birds then.
    expect([...seen.night].sort()).toEqual(BRANCH_DECORATIONS.filter((d) => d !== 'bird').sort());
    expect([...seen.day].sort()).toEqual([...DAY_DECORATIONS].sort());
  });

  it('hangs beehives among the static obstacles, at heights that can be passed', () => {
    let hives = 0;
    for (let gap = 1; gap <= 800; gap++) {
      const o = createObstacle(SEED, gap);
      if (o.type !== ObstacleType.BEEHIVE) continue;
      hives++;
      expect(o.moving).toBe(false);
      expect(isPassable(o.type, o.y, o.scale, rulesFor(gap).minSteps)).toBe(true);
    }
    expect(hives).toBeGreaterThan(8);
  });

  it('has no birds at night: bats instead, the circling one for the purple bird', () => {
    const birds = [ObstacleType.BIRD, ObstacleType.BLUE_BIRD, ObstacleType.PURPLE_BIRD];
    const seen = new Set();
    for (let gap = 1; gap <= 900; gap++) {
      const night = timeOfDayFor(gap) === TimeOfDay.NIGHT;
      const types = movingTypesFor(gap);
      for (const bird of birds) expect(types.includes(bird)).toBe(!night && (bird !== ObstacleType.BLUE_BIRD || timeOfDayFor(gap) !== TimeOfDay.DUSK));
      expect(types.includes(ObstacleType.CIRCLE_BAT)).toBe(night);
      const o = createObstacle(SEED, gap);
      if (night && o.moving) seen.add(o.type);
      if (night) expect(birds).not.toContain(o.type);
      // And no perched bird on a branch at night.
      if (night) expect(o.decoration).not.toBe('bird');
    }
    expect(seen).toEqual(new Set([ObstacleType.SPIDER, ObstacleType.SNAKE, ObstacleType.BAT, ObstacleType.CIRCLE_BAT]));
  });

  it('flies the circling bat as the purple bird does, in the same place and way', () => {
    expect(OBSTACLE_HITBOXES.circleBat).toEqual(OBSTACLE_HITBOXES.purpleBird);
    for (let seed = 1; seed <= 20; seed++) {
      const rand = () => mulberry32(seed);
      const bat = movingCandidate(ObstacleType.CIRCLE_BAT, 60, rand());
      const bird = movingCandidate(ObstacleType.PURPLE_BIRD, 60, rand());
      expect({ ...bat.toData(), type: 'purpleBird' }).toEqual(bird.toData());
      expect(Math.abs(bat.motion.ax)).toBe(bat.motion.ay);
    }
  });

  it('replaces the bird with a bat at night, and only then', () => {
    let night = 0;
    let other = 0;
    for (let gap = 1; gap <= 600; gap++) {
      const phase = timeOfDayFor(gap);
      const types = movingTypesFor(gap);
      expect(types.includes(ObstacleType.BAT)).toBe(phase === TimeOfDay.NIGHT);
      expect(types.includes(ObstacleType.BIRD)).toBe(phase !== TimeOfDay.NIGHT);
      const o = createObstacle(SEED, gap);
      if (!o.moving) continue;
      if (phase === TimeOfDay.NIGHT) {
        night++;
        expect(o.type).not.toBe(ObstacleType.BIRD);
      } else {
        other++;
        expect(o.type).not.toBe(ObstacleType.BAT);
      }
    }
    expect(night).toBeGreaterThan(50);
    expect(other).toBeGreaterThan(100);
  });

  it('flies blue birds by day only, not at dusk or night', () => {
    const phases = new Set();
    for (let gap = 1; gap <= 600; gap++) {
      const phase = timeOfDayFor(gap);
      const day = phase !== TimeOfDay.DUSK && phase !== TimeOfDay.NIGHT;
      expect(movingTypesFor(gap).includes(ObstacleType.BLUE_BIRD)).toBe(day);
      const o = createObstacle(SEED, gap);
      if (o.type === ObstacleType.BLUE_BIRD) phases.add(phase);
    }
    expect(phases).toEqual(new Set([TimeOfDay.DAY, TimeOfDay.LATE_AFTERNOON, TimeOfDay.DAWN]));
  });

  it('flies purple birds at any time of day but night', () => {
    const phases = new Set();
    for (let gap = 1; gap <= 600; gap++) {
      const night = timeOfDayFor(gap) === TimeOfDay.NIGHT;
      expect(movingTypesFor(gap).includes(ObstacleType.PURPLE_BIRD)).toBe(!night);
      const o = createObstacle(SEED, gap);
      if (o?.type === ObstacleType.PURPLE_BIRD) phases.add(timeOfDayFor(gap));
    }
    // Every time of day but night (when a bat takes its place).
    expect(phases).toEqual(new Set([TimeOfDay.DAY, TimeOfDay.LATE_AFTERNOON, TimeOfDay.DUSK, TimeOfDay.DAWN]));
  });

  it('flies a purple bird in a circle in the middle, either way round', () => {
    const rand = mulberry32(8);
    const ways = { cw: 0, ccw: 0 };
    for (let i = 0; i < 200; i++) {
      const o = movingCandidate(ObstacleType.PURPLE_BIRD, 5, rand, 1 + (i % 4) * 0.1);
      const { ax, ay, bob } = o.motion;
      expect(Math.abs(ax)).toBe(ay);
      expect(bob).toBe(0);
      expect(ay).toBeGreaterThanOrEqual(PURPLE_BIRD_RADIUS[0]);
      expect(ay).toBeLessThanOrEqual(PURPLE_BIRD_RADIUS[1]);
      expect(o.baseY - ay).toBeGreaterThanOrEqual(PURPLE_BIRD_TOP[0] - 1e-9);
      expect(o.baseY - ay).toBeLessThanOrEqual(PURPLE_BIRD_TOP[1] + 1e-9);
      expect(o.baseX).toBe(5 * LIANA_SPACING + LIANA_SPACING / 2);
      // A true circle: constant distance from the centre.
      for (const t of [0, 0.4, 1.3, 2.9]) {
        const p = o.positionAt(t);
        expect(Math.hypot(p.x - o.baseX, p.y - o.baseY)).toBeCloseTo(ay, 6);
      }
      // Bounds cover the circle whichever way round it goes.
      const b = o.bounds;
      expect(b.minX).toBeLessThanOrEqual(o.baseX - ay);
      expect(b.maxX).toBeGreaterThanOrEqual(o.baseX + ay);
      if (ax > 0) ways.cw++;
      else ways.ccw++;
    }
    expect(ways.cw).toBeGreaterThan(50);
    expect(ways.ccw).toBeGreaterThan(50);
  });

  it('flies a blue bird up and down in the free air above or below the gap centre', () => {
    const rand = mulberry32(5);
    const seen = { high: 0, low: 0 };
    for (let i = 0; i < 200; i++) {
      const o = movingCandidate(ObstacleType.BLUE_BIRD, 5, rand, 1 + (i % 4) * 0.1);
      expect(o.motion).toMatchObject({ ax: 0, bob: BLUE_BIRD_BOB });
      expect(o.baseX).toBe(5 * LIANA_SPACING + LIANA_SPACING / 2);
      const ys = o.pathPoints(72).map((p) => p.y);
      const [top, bottom] = [Math.min(...ys), Math.max(...ys)];
      if (bottom < 250) {
        seen.high++;
        // The swoop can keep it up to BLUE_BIRD_BOB short of its nominal lowest point.
        expect(bottom).toBeLessThanOrEqual(BLUE_BIRD_HIGH[1] + 1e-9);
        expect(bottom).toBeGreaterThanOrEqual(BLUE_BIRD_HIGH[0] - BLUE_BIRD_BOB - 1e-9);
      } else {
        seen.low++;
        expect(top).toBeGreaterThanOrEqual(BLUE_BIRD_LOW[0] - 1e-9);
        expect(top).toBeLessThanOrEqual(BLUE_BIRD_LOW[1] + BLUE_BIRD_BOB + 1e-9);
      }
      // A real flight up and down, not a hover.
      expect(bottom - top).toBeGreaterThan(60);
    }
    expect(seen.high).toBeGreaterThan(50);
    expect(seen.low).toBeGreaterThan(50);
  });

  it('gives a night gap the obstacle a bird would have had, with a bat patrolling instead', () => {
    // Same hitbox and the same random stream, so a bat's patrol is a bird's.
    expect(OBSTACLE_HITBOXES.bat).toEqual(OBSTACLE_HITBOXES.bird);
    for (const y of [BIRD_Y_RANGE[0], 360, BIRD_Y_RANGE[1]]) {
      expect(birdPatrolBounds(y, 1, ObstacleType.BAT)).toEqual(birdPatrolBounds(y, 1, ObstacleType.BIRD));
      expect(birdPatrolBounds(y, 1.3, ObstacleType.BAT)).toEqual(birdPatrolBounds(y, 1.3, ObstacleType.BIRD));
    }
    const rand = (seed) => mulberry32(seed);
    for (let seed = 1; seed <= 20; seed++) {
      const bat = movingCandidate(ObstacleType.BAT, 60, rand(seed));
      const bird = movingCandidate(ObstacleType.BIRD, 60, rand(seed));
      expect(bat === null).toBe(bird === null);
      if (bat) expect({ ...bat.toData(), type: 'bird' }).toEqual(bird.toData());
    }
  });

  it('adds moving obstacles from obstacle MOVING_FROM, in each stage’s share', () => {
    const share = (from, to) => {
      let moving = 0;
      let total = 0;
      for (let seed = 1; seed <= 24; seed++) {
        for (let gap = from; gap <= to; gap++, total++) if (createObstacle(seed, gap).moving) moving++;
      }
      return moving / total;
    };
    expect(MOVING_FROM).toBe(6);
    expect(share(1, MOVING_FROM - 1)).toBe(0);
    for (const stage of STAGES) {
      const first = Math.max(stage.first, MOVING_FROM);
      const s = share(first, first + 9);
      // A little under the stage's share is normal: a gap aiming for the hardest grade seldom
      // finds a moving obstacle that hard, and takes a static one.
      expect(s).toBeGreaterThan(stage.movingShare - 0.2);
      expect(s).toBeLessThan(stage.movingShare + 0.12);
    }
    // Obstacles behind the start stay static.
    for (let gap = -200; gap < 0; gap++) if (gap !== -1) expect(createObstacle(SEED, gap).moving).toBe(false);
  });

  it('sets bird patrols to the widest range clear of the swings', () => {
    for (const y of [BIRD_Y_RANGE[0], 360, BIRD_Y_RANGE[1]]) {
      const [lo, hi] = birdPatrolBounds(y);
      expect(lo + hi).toBeCloseTo(LIANA_SPACING, 0);
      const bird = (x) => new Obstacle(0, ObstacleType.BIRD, x, y, { period: 2, phase: 0, ax: 0, ay: 0, bob: BIRD_BOB });
      expect(isPathClearOfLianas(bird(lo), 0) && isPathClearOfLianas(bird(hi), 0)).toBe(true);
      expect(isPathClearOfLianas(bird(lo - 3), 0) || isPathClearOfLianas(bird(hi + 3), 0)).toBe(false);
    }
    // Lower patrols are wider.
    const width = (y) => birdPatrolBounds(y)[1] - birdPatrolBounds(y)[0];
    expect(width(BIRD_Y_RANGE[1])).toBeGreaterThan(width(BIRD_Y_RANGE[0]));
  });

  it('is deterministic per seed and gap, and differs between seeds', () => {
    const same = (a, b) => a.type === b.type && a.y === b.y && JSON.stringify(a.motion) === JSON.stringify(b.motion);
    for (let gap = 1; gap < 80; gap++) expect(same(createObstacle(SEED, gap), createObstacle(SEED, gap))).toBe(true);
    let differing = 0;
    for (let gap = 1; gap < 50; gap++) if (!same(createObstacle(SEED, gap), createObstacle(SEED + 1, gap))) differing++;
    expect(differing).toBeGreaterThan(40);
  });

  it('keeps obstacles in the gap range and culls far ones, empty gaps included', () => {
    const obstacles = new Map();
    const make = (gap) => createObstacle(SEED, gap);
    updateObstacles(obstacles, 0, make);
    expect(obstacles.has(-1)).toBe(true);
    expect(obstacles.get(0)).toBeNull();

    const far = 40 * SCREEN_WIDTH;
    updateObstacles(obstacles, far, make);
    const range = gapIndexRange(far);
    expect([...obstacles.keys()].every((g) => g >= range.first && g <= range.last)).toBe(true);
    expect(obstacles.size).toBe(range.last - range.first + 1);
  });

  it('regenerates the same obstacle in a world after it is culled', () => {
    const world = new World({ seed: SEED });
    const before = world.obstacles.get(3);
    world.obstacles.delete(3);
    world.step(1 / 120);
    const again = world.obstacles.get(3);
    expect(again).not.toBe(before);
    expect({ type: again.type, x: again.x, y: again.y }).toEqual({ type: before.type, x: before.x, y: before.y });
  });
});
