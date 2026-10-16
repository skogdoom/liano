// SVG matrices register painted landmarks to the rig's fixed attachment points.
// Source points are pixels in a trimmed component; destinations are world units.
export function registerLimb(from, to, length) {
  const dx = to[0] - from[0], dy = to[1] - from[1], square = dx * dx + dy * dy;
  if (!(square > 0) || !(length > 0)) throw new Error('Invalid limb landmarks');
  const a = length * dy / square, b = length * dx / square, c = -b, d = a;
  return [a, b, c, d, -a * from[0] - c * from[1], -b * from[0] - d * from[1]];
}

export function registerTriangle(source, target) {
  const [s0, s1, s2] = source, [t0, t1, t2] = target;
  const sx1 = s1[0] - s0[0], sy1 = s1[1] - s0[1], sx2 = s2[0] - s0[0], sy2 = s2[1] - s0[1];
  const tx1 = t1[0] - t0[0], ty1 = t1[1] - t0[1], tx2 = t2[0] - t0[0], ty2 = t2[1] - t0[1];
  const determinant = sx1 * sy2 - sx2 * sy1;
  if (Math.abs(determinant) < 1e-9) throw new Error('Degenerate attachment landmarks');
  const a = (tx1 * sy2 - tx2 * sy1) / determinant, c = (tx2 * sx1 - tx1 * sx2) / determinant;
  const b = (ty1 * sy2 - ty2 * sy1) / determinant, d = (ty2 * sx1 - ty1 * sx2) / determinant;
  return [a, b, c, d, t0[0] - a * s0[0] - c * s0[1], t0[1] - b * s0[0] - d * s0[1]];
}
