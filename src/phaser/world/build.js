import { SEGMENT_REFERENCE } from '../../art/pieces/lines.js';

// Building blocks of the rigs: pieces made from an Art (phaser/art.js) and placed as the
// drawing code places its shapes. Each returns Phaser objects, not yet added.

// Points along a cubic or quadratic Bézier curve, for bending a strip along it.
export const CURVE_STEPS = 24;
export function cubicPoints([p0, p1, p2, p3], steps = CURVE_STEPS) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const u = i / steps;
    const v = 1 - u;
    return {
      x: v ** 3 * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u ** 3 * p3[0],
      y: v ** 3 * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u ** 3 * p3[1],
    };
  });
}
export function quadraticPoints([p0, p1, p2], steps = CURVE_STEPS) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const u = i / steps;
    const v = 1 - u;
    return { x: v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], y: v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1] };
  });
}

export class Builder {
  constructor(scene, art) {
    this.scene = scene;
    this.art = art;
  }

  container(x = 0, y = 0) {
    return this.scene.make.container({ x, y }, false);
  }

  image(key, frame = 0) {
    return this.art.image(this.scene, key, frame);
  }

  // A piece drawn `reference` long downwards from its top (stems, trunks), from `top` down
  // to `bottom` at x.
  stretched(key, x, top, bottom, reference) {
    const image = this.image(key).setPosition(x, top);
    image.scaleY = (this.art.unit(key) * (bottom - top)) / reference;
    return image;
  }

  // Sets an image made by line() (a segment piece) to run from `from` to `to`.
  setSegment(image, key, from, to) {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    image.setPosition(from[0], from[1]).setRotation(Math.atan2(to[1] - from[1], to[0] - from[0]));
    image.scaleX = (this.art.unit(key) * length) / SEGMENT_REFERENCE;
    return image;
  }

  // A line with round ends through `points` ([x, y] each): a segment piece per stretch and
  // a joint piece (`${key}End`) at each point, as linePieces made them.
  line(key, points) {
    const parts = [];
    for (let i = 1; i < points.length; i++) parts.push(this.setSegment(this.image(key), key, points[i - 1], points[i]));
    for (const p of points) parts.push(this.image(`${key}End`).setPosition(p[0], p[1]));
    return parts;
  }

  // A strip piece bent along `points` ({ x, y } each), with joints at its ends if `ends`.
  curve(key, points, ends = true) {
    const rope = this.art.rope(this.scene, key);
    this.art.bend(rope, key, points);
    const parts = [rope];
    if (ends) for (const p of [points[0], points[points.length - 1]]) parts.push(this.image(`${key}End`).setPosition(p.x, p.y));
    return parts;
  }
}
