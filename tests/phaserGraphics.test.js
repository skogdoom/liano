import { describe, it, expect } from 'vitest';
import { RecordingGraphics } from '../src/art/recorder.js';
import { replay } from '../src/render/graphics.js';

// The debug view's drawing, recorded in Pixi's terms and replayed on a Phaser Graphics
// (docs/plans/history/phaser-migration.md, M6). A stand-in records what the replay asks of
// Phaser.
function phaserGraphics() {
  const calls = [];
  return new Proxy(
    { calls },
    { get: (target, name) => (name === 'calls' ? calls : (...args) => (calls.push([name, ...args]), target.proxy)) },
  );
}

describe('the debug drawing on Phaser Graphics', () => {
  it('replays fills and strokes of shapes with their styles', () => {
    const g = new RecordingGraphics();
    g.rect(1, 2, 3, 4).circle(5, 6, 7).stroke({ width: 2, color: 0xff00ff });
    g.circle(8, 9, 3).fill(0x5cff5c);
    const p = phaserGraphics();
    replay(p, g.instructions);
    expect(p.calls).toEqual([
      ['clear'],
      ['lineStyle', 2, 0xff00ff, 1],
      ['strokeRect', 1, 2, 3, 4],
      ['strokeCircle', 5, 6, 7],
      ['fillStyle', 0x5cff5c, 1],
      ['fillCircle', 8, 9, 3],
    ]);
  });

  it('replays lines and closed paths as points, with their alpha', () => {
    const g = new RecordingGraphics();
    g.moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).stroke({ width: 1, color: 0xffe14d });
    g.moveTo(0, 0).lineTo(5, 5).lineTo(0, 5).closePath().stroke({ width: 1, color: 0xff4dd2, alpha: 0.6 });
    const p = phaserGraphics();
    replay(p, g.instructions);
    expect(p.calls).toEqual([
      ['clear'],
      ['lineStyle', 1, 0xffe14d, 1],
      ['strokePoints', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false],
      ['lineStyle', 1, 0xff4dd2, 0.6],
      ['strokePoints', [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }], true],
    ]);
  });

  it('draws arcs as points along them', () => {
    const g = new RecordingGraphics();
    g.arc(0, 0, 10, 0, Math.PI / 2).stroke({ width: 3, color: 0xffffff });
    const p = phaserGraphics();
    replay(p, g.instructions);
    const [, , [name, points]] = p.calls;
    expect(name).toBe('strokePoints');
    expect(points.at(-1).x).toBeCloseTo(0, 9);
    expect(points.at(-1).y).toBeCloseTo(10, 9);
    for (const { x, y } of points) expect(Math.hypot(x, y)).toBeCloseTo(10, 9);
  });
});
