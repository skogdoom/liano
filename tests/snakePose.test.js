import { describe, expect, it } from 'vitest';
import { paintedSnakePose } from '../src/render/world/snakePose.js';

const snake = { motion: { period: 4, phase: 0 } };

describe('painted climbing snake pose', () => {
  it('leads above/below the coils while keeping the face upright', () => {
    const up = paintedSnakePose(snake, 1).head, down = paintedSnakePose(snake, 3).head;
    expect(up.y).toBeLessThan(-15);
    expect(down.y).toBeGreaterThan(15);
    expect(up.rotation).toBeLessThan(0);
    expect(down.rotation).toBeGreaterThan(0);
    for (const head of [up, down]) expect(Math.abs(head.rotation)).toBeLessThan(Math.PI / 4);
  });

  it('turns continuously at both vertical reversals instead of flipping a face', () => {
    for (const time of [0, 2, 4]) {
      const before = paintedSnakePose(snake, time - .00001).head;
      const after = paintedSnakePose(snake, time + .00001).head;
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(.01);
      expect(Math.abs(after.rotation - before.rotation)).toBeLessThan(.001);
    }
  });

  it('completes most of the head turn within 80 ms of each reversal', () => {
    for (const time of [0, 2, 4]) {
      const before = paintedSnakePose(snake, time - .08).head;
      const after = paintedSnakePose(snake, time + .08).head;
      expect(Math.abs(before.y)).toBeGreaterThan(17);
      expect(Math.abs(after.y)).toBeGreaterThan(17);
      expect(Math.sign(before.y)).toBe(-Math.sign(after.y));
    }
  });

  it('keeps the neck attached inside the body and head throughout a cycle', () => {
    for (let time = 0; time <= 4; time += .025) {
      const { head, neck } = paintedSnakePose(snake, time);
      expect(neck[0].x).toBeGreaterThan(-30);
      expect(Math.abs(neck[0].y)).toBeLessThan(23);
      const tip = neck.at(-1);
      expect(Math.hypot(tip.x - head.x, tip.y - head.y)).toBeLessThan(12);
      for (const p of neck) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(Math.abs(p.x)).toBeLessThan(30);
        expect(Math.abs(p.y)).toBeLessThan(32);
      }
    }
  });

  it('uses the supplied drawing phase and reuses the rig points', () => {
    const pose = paintedSnakePose(snake, .5), points = [...pose.neck];
    expect(paintedSnakePose(snake, 2.5, pose)).toBe(pose);
    expect(pose.neck.every((point, i) => point === points[i])).toBe(true);
    expect(paintedSnakePose({ motion: { period: 4, phase: Math.PI } }, .5)).toEqual(pose);
  });
});
