// Pure math helpers. Coordinates are y-down; angle 0 hangs straight down and
// positive angles swing towards +x.

export function pendulumAngle(t, dir, amplitude, omega) {
  return dir * amplitude * Math.sin(omega * t);
}

export function pendulumAngularVelocity(t, dir, amplitude, omega) {
  return dir * amplitude * omega * Math.cos(omega * t);
}

export function pendulumPosition(anchorX, anchorY, radius, angle) {
  return { x: anchorX + radius * Math.sin(angle), y: anchorY + radius * Math.cos(angle) };
}

// Velocity of a point at `radius` on a pendulum: d/dt of pendulumPosition with fixed radius.
export function tangentialVelocity(radius, angle, angularVelocity) {
  const speed = radius * angularVelocity;
  return { vx: speed * Math.cos(angle), vy: -speed * Math.sin(angle) };
}

// Velocity of a point sliding outward along a pendulum: the tangential part plus
// `radialSpeed` along the rope, away from the anchor.
export function hangingVelocity(radius, radialSpeed, angle, angularVelocity) {
  const t = tangentialVelocity(radius, angle, angularVelocity);
  return { vx: t.vx + radialSpeed * Math.sin(angle), vy: t.vy + radialSpeed * Math.cos(angle) };
}

// Semi-implicit Euler step of a body with {x, y, vx, vy} under gravity. Mutates `body`.
export function ballisticStep(body, dt, gravity) {
  body.vy += gravity * dt;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
}

// Closest point to (px, py) on segment a–b. `t` is the position along the segment in [0, 1].
export function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0), 1);
  return { x: ax + t * dx, y: ay + t * dy, t };
}

export function circleIntersectsSegment(cx, cy, radius, ax, ay, bx, by) {
  const p = closestPointOnSegment(cx, cy, ax, ay, bx, by);
  const dx = cx - p.x;
  const dy = cy - p.y;
  return dx * dx + dy * dy <= radius * radius;
}

// Distance from (px, py) to a circular sector hanging from (ox, oy): radius `radius`,
// spanning `halfAngle` either side of straight down (halfAngle ≤ 90°). 0 inside.
export function pointSectorDistance(px, py, ox, oy, radius, halfAngle) {
  const dx = px - ox;
  const dy = py - oy;
  if (Math.abs(Math.atan2(dx, dy)) <= halfAngle) return Math.max(0, Math.hypot(dx, dy) - radius);
  // Outside the angular range the closest point lies on one of the two edges.
  const ex = radius * Math.sin(halfAngle);
  const ey = radius * Math.cos(halfAngle);
  const edge = (sx) => {
    const p = closestPointOnSegment(px, py, ox, oy, ox + sx, oy + ey);
    return Math.hypot(px - p.x, py - p.y);
  };
  return Math.min(edge(ex), edge(-ex));
}

export function circleIntersectsCircle(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

// Axis-aligned rect given by its top-left corner (x, y) and size.
export function circleIntersectsRect(cx, cy, radius, x, y, w, h) {
  const dx = cx - Math.min(Math.max(cx, x), x + w);
  const dy = cy - Math.min(Math.max(cy, y), y + h);
  return dx * dx + dy * dy <= radius * radius;
}
