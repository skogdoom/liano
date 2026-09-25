// Pauses the game while the window is unfocused, the page is hidden, or something
// else holds it (hold(), e.g. while the graphics context is lost). Starts unpaused
// unless hidden: some browsers report no focus until the first interaction.

// Presses are ignored for this long after resuming, so the tap or click that brings
// the game back does not also act as a press.
export const RESUME_GRACE_MS = 250;

export function createPause(win, doc, { now = () => performance.now() } = {}) {
  let blurred = false;
  let hidden = doc.visibilityState === 'hidden';
  const held = new Set();
  let resumedAt = -Infinity;

  const isPaused = () => blurred || hidden || held.size > 0;
  // Wraps a state change so the moment the game resumes is recorded.
  const change = (apply) => () => {
    const was = isPaused();
    apply();
    if (was && !isPaused()) resumedAt = now();
  };

  const listeners = [
    [win, 'blur', change(() => (blurred = true))],
    [win, 'focus', change(() => (blurred = false))],
    [doc, 'visibilitychange', change(() => (hidden = doc.visibilityState === 'hidden'))],
  ];
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener);

  return {
    get paused() {
      return isPaused();
    },
    // A held reason, 'unfocused', or null when running.
    get reason() {
      if (held.size > 0) return held.values().next().value;
      return isPaused() ? 'unfocused' : null;
    },
    // Pauses (on) or releases (off) the game for `reason`.
    hold(reason, on) {
      change(() => (on ? held.add(reason) : held.delete(reason)))();
    },
    acceptsInput() {
      return !isPaused() && now() - resumedAt >= RESUME_GRACE_MS;
    },
    destroy() {
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
    },
  };
}
