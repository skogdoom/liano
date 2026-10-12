import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { Graphics } from 'pixi.js';
import { generateArt } from '../src/art/generate.js';
import { DEFAULT_STROKE, RecordingGraphics } from '../src/art/recorder.js';
import { SPIKE_PIECES, TAIL_FRAMES, TAIL_SWISH, tailFrameFor, tailSwishOf } from '../src/art/spike.js';
import { bounds, elements, shapeD, toSvg, unionBox } from '../src/art/svg.js';
import { bendStrip } from '../src/spike/rigs.js';
import { drawLiana, leafLayout, LIANA_PALETTES } from '../src/render/lianaView.js';
import { Liana } from '../src/sim/liana.js';

describe('recording the drawing calls', () => {
  it('fills and strokes the path drawn since the last fill or stroke', () => {
    const g = new RecordingGraphics();
    g.circle(0, 0, 5).rect(1, 2, 3, 4).fill(0xff0000).ellipse(9, 9, 2, 1).fill({ color: 0x00ff00, alpha: 0.5 });
    expect(g.instructions.map((i) => [i.action, i.path.map((s) => s.type)])).toEqual([
      ['fill', ['circle', 'rect']],
      ['fill', ['ellipse']],
    ]);
    expect(g.instructions[1].style).toEqual({ color: 0x00ff00, alpha: 0.5 });
  });

  it('strokes the same path after a fill, as Pixi does', () => {
    const g = new RecordingGraphics();
    g.rect(0, 0, 10, 10).fill(0x111111).stroke({ width: 2, color: 0x222222 });
    const [fill, stroke] = g.instructions;
    expect(stroke.path).toBe(fill.path);
    // But not once something new is drawn in between.
    g.circle(0, 0, 1).fill(0x333333).circle(5, 5, 1).stroke(0x444444);
    expect(g.instructions[3].path[0]).toMatchObject({ type: 'circle', x: 5 });
  });

  it('takes the defaults for a style left out, and keeps the last style when none is given', () => {
    const g = new RecordingGraphics();
    g.moveTo(0, 0).lineTo(5, 5).stroke({ width: 3, color: 0x123456, cap: 'round' });
    g.moveTo(1, 1).lineTo(2, 2).stroke({ color: 0x654321 });
    g.moveTo(1, 1).lineTo(2, 2).stroke();
    expect(g.instructions[0].style).toEqual({ ...DEFAULT_STROKE, width: 3, color: 0x123456, cap: 'round' });
    expect(g.instructions[1].style).toEqual({ ...DEFAULT_STROKE, color: 0x654321 });
    expect(g.instructions[2].style).toEqual(g.instructions[1].style);
  });

  it('carries on a line from where the last fill or stroke ended', () => {
    const g = new RecordingGraphics();
    g.moveTo(1, 2).lineTo(3, 4).stroke(0xffffff).lineTo(5, 6).stroke(0xffffff);
    expect(g.instructions[1].path[0]).toMatchObject({ start: [3, 4], segments: [['L', 5, 6]] });
  });

  it('replaces a moveTo that nothing followed', () => {
    const g = new RecordingGraphics();
    g.moveTo(1, 1).moveTo(2, 2).lineTo(3, 3).stroke(0xffffff);
    expect(g.instructions[0].path).toHaveLength(1);
    expect(g.instructions[0].path[0].start).toEqual([2, 2]);
  });

  it('records the same fills and strokes as Pixi for real drawing code (a liana)', () => {
    const liana = new Liana(7, 0);
    const pixi = new Graphics();
    const recorded = new RecordingGraphics();
    for (const flash of [false, true]) {
      drawLiana(pixi.clear(), liana, leafLayout(7), flash, LIANA_PALETTES[0]);
      drawLiana(recorded.clear(), liana, leafLayout(7), flash, LIANA_PALETTES[0]);
      const theirs = pixi.context.instructions;
      expect(recorded.instructions.map((i) => i.action)).toEqual(theirs.map((i) => i.action));
      recorded.instructions.forEach((mine, k) => {
        const style = theirs[k].data.style;
        expect(mine.style.color).toBe(style.color);
        expect(mine.style.alpha).toBeCloseTo(style.alpha, 9);
        if (mine.action === 'stroke') expect([mine.style.width, mine.style.cap, mine.style.join]).toEqual([style.width, style.cap, style.join]);
      });
    }
  });
});

describe('writing SVG', () => {
  it('writes each shape as a path', () => {
    expect(shapeD({ type: 'rect', x: 1, y: 2, w: 3, h: 4 })).toBe('M1 2 H4 V6 H1 Z');
    expect(shapeD({ type: 'poly', points: [0, 0, 1, 0, 1, 1], closed: true })).toBe('M0 0 L1 0 L1 1 Z');
    expect(shapeD({ type: 'circle', x: 0, y: 0, r: 2 })).toBe('M2 0 A2 2 0 1 1 -2 0 A2 2 0 1 1 2 0 Z');
    expect(shapeD({ type: 'subpath', start: [0, 0], segments: [['Q', 1, 1, 2, 0], ['C', 3, 1, 4, 1, 5, 0]], closed: false })).toBe('M0 0 Q1 1 2 0 C3 1 4 1 5 0');
  });

  it('draws a full-turn arc in two halves, and a part arc in one', () => {
    const full = shapeD({ type: 'subpath', start: [1, 0], segments: [['A', 0, 0, 1, 0, Math.PI * 2, false]], closed: false });
    expect(full.match(/A/g)).toHaveLength(2);
    const quarter = shapeD({ type: 'subpath', start: [1, 0], segments: [['A', 0, 0, 1, 0, Math.PI / 2, false]], closed: false });
    expect(quarter).toBe('M1 0 A1 1 0 0 1 0 1');
  });

  it('keeps colours, alphas, widths, caps, joins and the miter limit', () => {
    const g = new RecordingGraphics();
    g.circle(0, 0, 3).fill({ color: 0x0a0b0c, alpha: 0.25 });
    g.moveTo(0, 0).lineTo(4, 4).stroke({ width: 5, color: 0xff8800, cap: 'round', join: 'round', alpha: 0.7 });
    const [fill, stroke] = elements(g.instructions);
    expect(fill).toContain('fill="#0a0b0c" fill-opacity="0.25"');
    expect(stroke).toContain('fill="none" stroke="#ff8800" stroke-opacity="0.7" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10"');
  });

  it('draws each shape of one fill on its own, so overlapping see-through shapes show twice as in Pixi', () => {
    const g = new RecordingGraphics();
    g.circle(0, 0, 3).circle(1, 0, 3).fill({ color: 0, alpha: 0.5 });
    expect(elements(g.instructions)).toHaveLength(2);
  });

  it('bounds the drawing, strokes included, and frames it in a document', () => {
    const g = new RecordingGraphics();
    g.rect(0, 0, 10, 4).fill(0).moveTo(-2, 2).lineTo(12, 2).stroke({ width: 2, cap: 'round' });
    const box = bounds(g.instructions);
    // The line reaches 1 px each side, plus 2 more allowed for a miter join (the
    // default), plus the 1 px pad.
    expect(box).toEqual({ x: -6, y: -2, w: 22, h: 8 });
    expect(unionBox([box, { x: 0, y: 0, w: 30, h: 1 }])).toEqual({ x: -6, y: -2, w: 36, h: 8 });
    const svg = toSvg(g.instructions, box);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="8" viewBox="-6 -2 22 8">')).toBe(true);
  });
});

describe('the generated art', () => {
  it('is up to date (npm run art)', () => {
    const { files, manifest } = generateArt(SPIKE_PIECES);
    const dir = new URL('../art/generated/', import.meta.url);
    expect(readdirSync(dir).sort()).toEqual(Object.keys(files).sort());
    for (const [name, svg] of Object.entries(files)) expect(readFileSync(new URL(name, dir), 'utf8'), name).toBe(svg);
    expect(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8')).toBe(manifest);
  });

  it('gives every piece a box with room in it', () => {
    const { manifest } = generateArt(SPIKE_PIECES);
    for (const piece of JSON.parse(manifest).pieces) {
      expect(piece.box.w, piece.key).toBeGreaterThan(0);
      expect(piece.box.h, piece.key).toBeGreaterThan(0);
    }
  });
});

describe('the spike pieces', () => {
  it('picks the tail frame nearest the swish, within the flipbook', () => {
    for (let frame = 0; frame < TAIL_FRAMES; frame++) expect(tailFrameFor(tailSwishOf(frame))).toBe(frame);
    expect(tailSwishOf(0)).toBe(-TAIL_SWISH);
    expect(tailSwishOf(TAIL_FRAMES - 1)).toBe(TAIL_SWISH);
    expect(tailFrameFor(-100)).toBe(0);
    expect(tailFrameFor(100)).toBe(TAIL_FRAMES - 1);
  });
});

describe('bending a strip piece along a rope', () => {
  // A stand-in for a Phaser Rope: its frame and what setPoints leaves (UVs spread evenly).
  const fakeRope = (width) => ({
    frame: { width, u0: 0.1, u1: 0.5 },
    setPoints(points) {
      this.points = points;
      this.uv = new Float32Array(points.length * 4);
    },
  });

  it('extends the points by the margins and lays the strip along them by distance', () => {
    // A strip 100 units long with 5-unit margins, at 2 atlas pixels a unit.
    const rope = fakeRope(220);
    const info = { zoom: 2, anchor: [5 / 110, 0.5] };
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 80 },
      { x: 0, y: 100 },
    ];
    bendStrip(rope, info, points, 100);
    expect(rope.points.map((p) => p.y / 2)).toEqual([-5, 0, 80, 100, 105]);
    const u = [...rope.uv].filter((_, i) => i % 4 === 0);
    const share = (units) => 0.1 + (0.4 * units) / 110;
    [0, 5, 85, 105, 110].forEach((units, i) => expect(u[i]).toBeCloseTo(share(units), 6));
    // Both UVs of a point (either side of the strip) move together.
    expect([...rope.uv].filter((_, i) => i % 4 === 2)).toEqual(u);
  });

  it('spreads the strip over a bowed rope, keeping the margins their size', () => {
    const rope = fakeRope(220);
    const points = [
      { x: 0, y: 0 },
      { x: 60, y: 80 }, // 100 long
      { x: 60, y: 180 }, // 100 more: twice the strip's length
    ];
    bendStrip(rope, { zoom: 2, anchor: [5 / 110, 0.5] }, points, 100);
    const u = [...rope.uv].filter((_, i) => i % 4 === 0).map((v) => ((v - 0.1) / 0.4) * 110);
    [0, 5, 55, 105, 110].forEach((units, i) => expect(u[i]).toBeCloseTo(units, 4));
  });
});
