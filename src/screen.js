// The screen the game is shown on, for both versions: the pixel ratio, the safe-area
// insets, and a callback whenever the screen changes shape.

// Device pixels per CSS pixel, capped at `max` (more costs fill rate for little gain).
export const pixelRatio = (win, max) => Math.min(win.devicePixelRatio || 1, max);

// Safe-area insets (notch, home indicator) in CSS pixels, read from a hidden probe
// element. Returns a function that reads the current insets.
export function safeAreaReader(doc) {
  const probe = doc.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  doc.body.appendChild(probe);
  const px = (value) => parseFloat(value) || 0;
  return () => {
    const style = doc.defaultView.getComputedStyle(probe);
    return { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) };
  };
}

// Calls `onChange` (at most once per frame) on window resizes, rotation, the iOS
// address bar showing or hiding, and pixel-ratio changes without a resize (a window
// moved to another screen). Returns a function that queues a call too.
export function watchScreen(win, onChange) {
  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(() => {
      queued = false;
      onChange();
    });
  };
  win.addEventListener('resize', queue);
  win.addEventListener('orientationchange', queue);
  win.visualViewport?.addEventListener('resize', queue);
  const watchRatio = () => {
    win
      .matchMedia(`(resolution: ${win.devicePixelRatio}dppx)`)
      .addEventListener('change', () => (queue(), watchRatio()), { once: true });
  };
  watchRatio();
  return queue;
}

// Whether the page runs as an app added to the home screen, which is full screen
// already (so it gets no full-screen button or key).
export const isHomeScreenApp = (win) =>
  win.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || win.navigator.standalone === true;

// Blocks browser gestures on the game's canvas: double-tap zoom, iOS pinch, and the
// long-press menu. iOS Safari also acts on quick taps (in landscape it briefly shifts
// the page under the tab bar) unless the touch events themselves are cancelled;
// pointer events, which the game reads, arrive before them and are unaffected.
export function blockBrowserGestures(canvas) {
  for (const type of ['dblclick', 'gesturestart', 'contextmenu']) {
    canvas.addEventListener(type, (event) => event.preventDefault());
  }
  for (const type of ['touchstart', 'touchmove', 'touchend']) {
    canvas.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }
}
