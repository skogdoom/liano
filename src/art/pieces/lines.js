// Lines in pieces. A round-capped line, or a polyline with round joins, is exactly the
// union of its straight segments (butt-ended) and a disc at each end and corner, so the
// rigs build legs, twigs and stems from a segment piece, stretched along its length and
// turned, and a joint piece. A curve (a vine, a stalk, a neck) is a strip the rig bends
// along the points the code computes, with joints for its round ends.

// The segment: `length` along +x from the origin, `width` across.
export const segment = (g, length, width, color, alpha = 1) => g.rect(0, -width / 2, length, width).fill({ color, alpha });

// The joint: a disc `width` across, about the origin.
export const joint = (g, width, color) => g.circle(0, 0, width / 2).fill(color);

// The length segments are drawn at (and stretched from).
export const SEGMENT_REFERENCE = 20;

// A segment piece and its joint piece, as `${key}` and `${key}End`. With `curve`, the
// segment is a strip, bent along a curve.
export function linePieces({ key, width, color, alpha = 1, purpose, joints = true, curve = false, ...rest }) {
  const how = curve ? 'bent along the curve' : 'stretched to each length and turned';
  const pieces = [
    {
      ...rest,
      ...(curve ? { kind: 'strip', length: SEGMENT_REFERENCE } : {}),
      key,
      purpose: `${purpose} A straight ${curve ? 'strip' : 'segment'} ${SEGMENT_REFERENCE} px along +x from the origin, ${width} px across; ${how}.`,
      box: { x: 0, y: -width / 2, w: SEGMENT_REFERENCE, h: width },
      frames: [(g) => segment(g, SEGMENT_REFERENCE, width, color, alpha)],
    },
  ];
  if (joints) {
    pieces.push({
      ...rest,
      key: `${key}End`,
      purpose: `A round end or joint of ${key}: a disc ${width} px across about the origin.`,
      frames: [(g) => joint(g, width, color)],
    });
  }
  return pieces;
}
