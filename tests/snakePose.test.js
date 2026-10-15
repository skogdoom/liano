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
    for (const head of [up, down]) {
      expect(Math.abs(head.rotation)).toBeLessThan(Math.PI / 4);
      expect(head.alpha).toBe(1);
      expect(head.scale).toBe(1);
    }
  });

  it('switches ends only while the head is fully concealed at either reversal', () => {
    for (const time of [0, 2, 4]) {
      const before = paintedSnakePose(snake, time - .00001).head;
      const after = paintedSnakePose(snake, time + .00001).head;
      expect(before.y).toBe(-after.y);
      expect(before.alpha).toBe(0);
      expect(after.alpha).toBe(0);
    }
    let previous = paintedSnakePose(snake, -.2).head;
    for (let time = -.19; time <= 4.2; time += .01) {
      const current = paintedSnakePose(snake, time).head;
      if (current.y !== previous.y) {
        expect(previous.alpha).toBe(0);
        expect(current.alpha).toBe(0);
      }
      previous = current;
    }
  });

  it('retracts and emerges briefly, with the same timing for different climbing periods', () => {
    for (const period of [3, 4, 6]) {
      const obstacle = { motion: { period, phase: .7 } };
      for (const turn of [0, 1, 2]) {
        const reversal = (turn * Math.PI - .7) * period / (2 * Math.PI);
        for (const side of [-1, 1]) {
          const out = paintedSnakePose(obstacle, reversal + side * .121).head;
          const retreat = paintedSnakePose(obstacle, reversal + side * .075).head;
          const hidden = paintedSnakePose(obstacle, reversal + side * .029).head;
          expect(out.alpha).toBe(1);
          expect(hidden.alpha).toBe(0);
          expect(retreat.alpha).toBeCloseTo(.5, 10);
          expect(hidden.x).toBeLessThan(retreat.x);
          expect(retreat.x).toBeLessThan(out.x);
          expect(hidden.scale).toBeLessThan(retreat.scale);
          expect(retreat.scale).toBeLessThan(out.scale);
          // The head stays at an end of the coil while it is visible.
          expect(Math.abs(retreat.y)).toBe(20);
        }
      }
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
