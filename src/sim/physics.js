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
