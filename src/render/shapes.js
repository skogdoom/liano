// Small drawing helpers shared by the views.

// Flat point list for a leaf starting at (x, y) and pointing along `angle`
// (radians, 0 = +x), `length` long and `width` wide.
export function leafPoints(x, y, angle, length, width) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const local = [
    [0, 0],
    [0.3 * length, 0.5 * width],
    [0.72 * length, 0.4 * width],
    [length, 0],
    [0.72 * length, -0.4 * width],
    [0.3 * length, -0.5 * width],
  ];
  const points = [];
  for (const [u, v] of local) points.push(x + u * c - v * s, y + u * s + v * c);
  return points;
}

// Linear interpolation between two 0xRRGGBB colours.
export function mixColor(a, b, t) {
  const ch = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
