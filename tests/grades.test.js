import { describe, it, expect } from 'vitest';
import { GRADES, aimsHigh, gradeOf, isHigh, maxGradeFor, targetGradeFor } from '../src/sim/grades.js';
import { createObstacle } from '../src/sim/generator.js';
import { stageFor } from '../src/sim/stages.js';
import { blockedShare } from '../src/sim/windowTable.js';
import table from '../src/sim/windowTable.json';
import { isClearOfLianas, movingBlockedShare, releaseWindow } from '../src/sim/feasibility.js';
import { Obstacle, ObstacleType } from '../src/sim/obstacle.js';
import { GRADE_BOUNDS, HIGH_BELOW_Y, LATER_GRADE_ODDS, LIANA_SPACING, LATER_GRADE_STAGES, STAGES, STAGE_LENGTH_AFTER } from '../src/config.js';

const SEEDS = [1, 2, 3, 4, 5, 6];
const MANY_SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const firstOfStage = (n) => (n <= STAGES.length ? STAGES[n - 1].first : STAGES.at(-1).first + (n - STAGES.length) * STAGE_LENGTH_AFTER);

// Every obstacle of the gaps from..to for each of SEEDS.
function obstacles(from, to, seeds = SEEDS) {
  const list = [];
  for (const seed of seeds) {
    for (let gap = from; gap <= to; gap++) {
      const o = createObstacle(seed, gap);
      if (o) list.push({ seed, gap, o });
    }
  }
  return list;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('obstacle grades', () => {
  it('grade by the share of release steps an obstacle blocks, from 1 to 4', () => {
    expect(GRADES).toEqual([1, 2, 3, 4]);
    expect(GRADE_BOUNDS).toHaveLength(3);
    expect([...GRADE_BOUNDS].sort((a, b) => a - b)).toEqual(GRADE_BOUNDS);
    expect(gradeOf(0)).toBe(1);
    expect(gradeOf(GRADE_BOUNDS[0] - 1e-9)).toBe(1);
    expect(gradeOf(GRADE_BOUNDS[0])).toBe(2);
    expect(gradeOf(GRADE_BOUNDS[1])).toBe(3);
    expect(gradeOf(GRADE_BOUNDS[2])).toBe(4);
    expect(gradeOf(1)).toBe(4);
  });

  it('measures a static obstacle by the steps it blocks: a bigger blocker is a higher grade', () => {
    // A rock low in the gap blocks far more flights than a branch up in the canopy.
    const rock = releaseWindow(ObstacleType.ROCK, 330, 1).blocked;
    const branch = releaseWindow(ObstacleType.BRANCH, 150, 1).blocked;
    expect(rock).toBeGreaterThan(branch);
    expect(releaseWindow(null, 0).blocked).toBe(0);
    expect(blockedShare(ObstacleType.ROCK, 330, 1)).toBeCloseTo(rock, 3);
  });

  it('keeps the table of blocked shares in step with the solver', () => {
    // Where the obstacle is clear of the lianas (the table has 0 where it is not).
    let checked = 0;
    for (const [type, y] of [[ObstacleType.ROCK, 330], [ObstacleType.THORN_BUSH, 350], [ObstacleType.BEEHIVE, 360], [ObstacleType.BRANCH, 372]]) {
      for (const scale of [1, 1.3]) {
        const clear = isClearOfLianas(new Obstacle(0, type, LIANA_SPACING / 2, y, null, scale), 0);
        if (!clear) continue;
        checked++;
        expect(blockedShare(type, y, scale)).toBeCloseTo(releaseWindow(type, y, scale).blocked, 3);
      }
    }
    expect(checked).toBeGreaterThan(3);
    expect(Object.keys(table.blocked)).toEqual(Object.keys(table.windows));
  });

  it('measures a moving obstacle by the same share, over sampled arrivals', () => {
    const motion = { period: 2.4, phase: 0, ax: 0, ay: 60, bob: 0 };
    const low = new Obstacle(0, ObstacleType.SNAKE, 350, 330, motion, 1);
    const high = new Obstacle(0, ObstacleType.SPIDER, 350, 120, { ...motion, ay: 20 }, 1);
    const share = movingBlockedShare(low);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
    expect(movingBlockedShare(high)).toBeLessThan(share);
  });

  it('gives every generated obstacle its grade, in the data sent to the worker too', () => {
    for (const { o } of obstacles(1, 120)) {
      expect(GRADES).toContain(o.grade);
      expect(Obstacle.fromData(o.toData()).grade).toBe(o.grade);
      expect(o.inGap(7).grade).toBe(o.grade);
    }
  });

  it('records the grade the solver measures', () => {
    for (const { o } of obstacles(1, 80)) {
      const share = o.moving ? movingBlockedShare(o.inGap(0)) : blockedShare(o.type, o.baseY, o.scale);
      expect(o.grade).toBe(gradeOf(share));
    }
  });
});

describe('grades by stage', () => {
  it('lists odds for the grades of every stage, the hardest only in the later ones', () => {
    for (const stage of STAGES) expect(stage.grades).toHaveLength(4);
    const highest = STAGES.map((s) => GRADES.filter((g) => s.grades[g - 1] > 0).at(-1));
    for (let i = 1; i < highest.length; i++) expect(highest[i]).toBeGreaterThanOrEqual(highest[i - 1]);
    expect(highest[0]).toBeLessThanOrEqual(2);
    expect(highest.at(-1)).toBe(4);
    // Grade 4 waits for the last stage.
    expect(STAGES.slice(0, -1).every((s) => s.grades[3] === 0)).toBe(true);
    expect(maxGradeFor(1)).toBe(2);
    expect(maxGradeFor(STAGES.at(-1).first)).toBe(4);
  });

  it('moves on towards LATER_GRADE_ODDS after the last stage, keeping all four grades in play', () => {
    const last = STAGES.at(-1);
    const at = (stage) => stageFor(last.first + (stage - STAGES.length) * STAGE_LENGTH_AFTER).grades;
    expect(at(STAGES.length)).toEqual(last.grades);
    expect(at(STAGES.length + LATER_GRADE_STAGES)).toEqual(LATER_GRADE_ODDS);
    expect(at(STAGES.length + 100)).toEqual(LATER_GRADE_ODDS);
    for (let stage = STAGES.length; stage < STAGES.length + LATER_GRADE_STAGES; stage++) {
      expect(at(stage + 1)[3]).toBeGreaterThan(at(stage)[3]);
      expect(at(stage + 1)[0]).toBeLessThan(at(stage)[0]);
      for (const odds of at(stage)) expect(odds).toBeGreaterThan(0);
    }
  });

  it('draws the grade a gap aims for from its stage’s odds, the same for a seed every time', () => {
    for (let gap = 1; gap < 400; gap++) {
      const { grades } = stageFor(gap);
      for (const seed of SEEDS) {
        const target = targetGradeFor(seed, gap);
        expect(grades[target - 1]).toBeGreaterThan(0);
        expect(targetGradeFor(seed, gap)).toBe(target);
      }
    }
    // About as often as the odds say.
    const count = [0, 0, 0, 0];
    for (let gap = 1; gap <= 15; gap++) for (let seed = 1; seed <= 400; seed++) count[targetGradeFor(seed, gap) - 1]++;
    const share = count.map((c) => c / (15 * 400));
    expect(share[0]).toBeGreaterThan(0.6);
    expect(share[0]).toBeLessThan(0.7);
    expect(share[2] + share[3]).toBe(0);
  });

  it('never lets an obstacle through above its stage’s highest grade', () => {
    for (const { gap, o } of obstacles(1, 400)) expect(o.grade).toBeLessThanOrEqual(maxGradeFor(gap));
  });

  it('keeps the hardest grades out of the early stages', () => {
    for (const { o } of obstacles(1, STAGES[1].first - 1)) expect(o.grade).toBeLessThanOrEqual(2);
    for (const { o } of obstacles(1, STAGES.at(-1).first - 1)) expect(o.grade).toBeLessThanOrEqual(3);
    const late = obstacles(STAGES.at(-1).first, STAGES.at(-1).first + 100).map(({ o }) => o.grade);
    expect(late).toContain(4);
  });

  it('raises the difficulty gradually, stage by stage', () => {
    const meanGrade = (stage) => mean(obstacles(firstOfStage(stage), firstOfStage(stage + 1) - 1).map(({ o }) => o.grade));
    const means = [1, 2, 3, 4].map(meanGrade);
    for (let i = 1; i < means.length; i++) expect(means[i]).toBeGreaterThan(means[i - 1]);
    // And on after the last stage, up to the limit.
    const later = [4, 8, 12, 16].map(meanGrade);
    expect(later[3]).toBeGreaterThan(later[0]);
    expect(later[3]).toBeGreaterThan(means[0] + 1);
  });

  it('keeps all four grades in play in the late levels, of both kinds of obstacle', () => {
    const late = obstacles(300, 700);
    for (const g of GRADES) expect(late.filter(({ o }) => o.grade === g).length).toBeGreaterThan(late.length * 0.05);
    expect(late.some(({ o }) => o.moving)).toBe(true);
    expect(late.some(({ o }) => !o.moving)).toBe(true);
    // Both kinds come in more than one grade.
    for (const moving of [true, false]) {
      expect(new Set(late.filter(({ o }) => o.moving === moving).map(({ o }) => o.grade)).size).toBeGreaterThan(1);
    }
  });

  it('mostly gets the grade it aims for, and never more than a grade off unless nothing else exists', () => {
    let exact = 0;
    let near = 0;
    const all = obstacles(6, 400);
    for (const { seed, gap, o } of all) {
      const diff = Math.abs(o.grade - targetGradeFor(seed, gap));
      if (diff === 0) exact++;
      if (diff <= 1) near++;
    }
    expect(exact / all.length).toBeGreaterThan(0.55);
    expect(near / all.length).toBeGreaterThan(0.95);
  });

  it('puts the temple under the same cap', () => {
    for (const { gap, o } of obstacles(1, 600).filter(({ o }) => o.type === ObstacleType.TEMPLE)) {
      expect(o.grade).toBeLessThanOrEqual(maxGradeFor(gap));
    }
  });
});

describe('high and low obstacles', () => {
  const share = (list) => list.filter(({ o }) => isHigh(o.baseY)).length / list.length;

  it('calls an obstacle high when it hangs from the canopy, above HIGH_BELOW_Y', () => {
    expect(isHigh(HIGH_BELOW_Y - 1)).toBe(true);
    expect(isHigh(HIGH_BELOW_Y)).toBe(false);
  });

  it('has the lower stages aim for high or low at their own share, the same for a seed every time', () => {
    for (let gap = 1; gap < 400; gap++) {
      const { high } = stageFor(gap);
      for (const seed of SEEDS) {
        const aim = aimsHigh(seed, gap);
        expect(aim).toBe(high === null ? null : aim);
        expect(aimsHigh(seed, gap)).toBe(aim);
        if (high === null) expect(aim).toBeNull();
      }
    }
    expect(STAGES.slice(0, 3).every((s) => s.high === 0.5)).toBe(true);
    expect(STAGES.at(-1).high).toBeNull();
    let highAims = 0;
    for (let seed = 1; seed <= 600; seed++) if (aimsHigh(seed, 10)) highAims++;
    expect(highAims / 600).toBeGreaterThan(0.44);
    expect(highAims / 600).toBeLessThan(0.56);
  });

  it('keeps high and low about even in the lower stages, for all obstacles and for the static ones', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const list = obstacles(firstOfStage(stage), firstOfStage(stage + 1) - 1, MANY_SEEDS);
      expect(share(list)).toBeGreaterThan(0.42);
      expect(share(list)).toBeLessThan(0.58);
      const statics = list.filter(({ o }) => !o.moving);
      expect(share(statics)).toBeGreaterThan(0.38);
      expect(share(statics)).toBeLessThan(0.62);
    }
  });

  it('still has both heights in every stage, whatever the aim', () => {
    for (const { from, to } of [{ from: 6, to: 15 }, { from: 100, to: 400 }]) {
      const list = obstacles(from, to);
      expect(share(list)).toBeGreaterThan(0.2);
      expect(share(list)).toBeLessThan(0.8);
    }
  });
});
