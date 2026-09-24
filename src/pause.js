// Pauses the game while the window is unfocused, the page is hidden, or a touch
// device is held upright (`portrait`: a MediaQueryList-like object with `matches` and
// a 'change' event). Starts unpaused unless hidden or upright: some browsers report
// no focus until the first interaction.

// Presses are ignored for this long after resuming, so the tap or click that brings
// the game back does not also act as a press.
export const RESUME_GRACE_MS = 250;

export function createPause(win, doc, { portrait = null, now = () => performance.now() } = {}) {
  let blurred = false;
  let hidden = doc.visibilityState === 'hidden';
  let upright = portrait?.matches ?? false;
  let resumedAt = -Infinity;

  const isPaused = () => blurred || hidden || upright;
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
  if (portrait) listeners.push([portrait, 'change', change(() => (upright = portrait.matches))]);
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener);

  return {
    get paused() {
      return isPaused();
    },
    // 'portrait' (turn the device sideways), 'unfocused', or null when running.
    get reason() {
      if (upright) return 'portrait';
      return isPaused() ? 'unfocused' : null;
    },
    acceptsInput() {
      return !isPaused() && now() - resumedAt >= RESUME_GRACE_MS;
    },
    destroy() {
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
    },
  };
}
