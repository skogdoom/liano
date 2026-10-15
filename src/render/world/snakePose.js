// Cartoon climbing snakes lead with their head without turning the face upside
// down. The phase follows the obstacle's drawing time, so reversals stay smooth
// even on display frames between simulation steps. Reuse `pose` in the rig.
export function paintedSnakePose(obstacle, time, pose = {
  head: {}, neck: Array.from({ length: 25 }, () => ({ x: 0, y: 0 })),
}) {
  const phase = 2 * Math.PI * time / obstacle.motion.period + obstacle.motion.phase;
  const velocity = Math.sin(phase);
  // Keep the turn continuous, but pass across the coils quickly at a reversal
  // instead of lingering with the face halfway through the body.
  const direction = velocity / Math.hypot(velocity, .07);
  const head = pose.head;
  head.x = 6 + 10 * (1 - direction * direction);
  head.y = -20 * direction;
  head.rotation = -.28 * direction;
  const fromY = 2 - 12 * direction, toX = head.x - 10, toY = head.y + 3 * direction;
  for (let i = 0; i < pose.neck.length; i++) {
    const u = i / (pose.neck.length - 1), v = 1 - u;
    pose.neck[i].x = v * v * -17 + 2 * v * u * -23 + u * u * toX;
    pose.neck[i].y = v * v * fromY + 2 * v * u * head.y + u * u * toY;
  }
  return pose;
}
