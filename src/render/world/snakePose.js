// Cartoon climbing snakes tuck their head into the coils at a reversal, then
// emerge at the leading end. Reposition only while concealed: never slide the
// face across the front of the body. Sample drawing time, without frame history.
export function paintedSnakePose(obstacle, time, pose = {
  head: {}, neck: Array.from({ length: 25 }, () => ({ x: 0, y: 0 })),
}) {
  const phase = 2 * Math.PI * time / obstacle.motion.period + obstacle.motion.phase;
  const velocity = Math.sin(phase);
  const direction = velocity >= 0 ? 1 : -1;
  // Seconds to the nearest reversal. Keep the brief retreat the same duration
  // for slow and fast snakes: concealed within 30 ms, fully out by 120 ms.
  const seconds = Math.asin(Math.min(1, Math.abs(velocity))) * obstacle.motion.period / (2 * Math.PI);
  const reveal = Math.max(0, Math.min(1, (seconds - .03) / .09));
  const alpha = reveal * reveal * (3 - 2 * reveal);
  const head = pose.head;
  head.alpha = alpha;
  head.scale = .65 + .35 * alpha;
  head.x = -10 + 16 * alpha;
  head.y = -20 * direction;
  head.rotation = -.28 * direction;
  // Join the back of the cheek directly to a root inside the upper/lower band.
  // The former long sideways bend exposed a handle-shaped neck above the coil.
  const fromY = 2 - 8 * direction;
  const c = Math.cos(head.rotation), s = Math.sin(head.rotation);
  const toX = head.x + (-9 * c - 4 * s) * head.scale;
  const toY = head.y + (-9 * s + 4 * c) * head.scale;
  for (let i = 0; i < pose.neck.length; i++) {
    const u = i / (pose.neck.length - 1), v = 1 - u;
    pose.neck[i].x = v * v * -9 + 2 * v * u * -10 + u * u * toX;
    pose.neck[i].y = v * v * fromY + 2 * v * u * (head.y + 8 * direction) + u * u * toY;
  }
  return pose;
}
