// Game input: Space, or a tap/click on the game. Presses are queued and consumed by
// the fixed-step loop, so they are applied at a sim step boundary. Key auto-repeat is
// ignored. D toggles the debug overlay.

export function isFreshSpacePress(event) {
  return event.code === 'Space' && !event.repeat;
}

// `keyTarget` receives keydown (the window); `pointerTarget` (the canvas) receives
// pointerdown. `initialType` is the input type assumed before any input: 'keyboard',
// 'mouse' or 'touch'. `accepts()` is asked when a press happens; a press it rejects
// (e.g. while paused) is dropped then, not when the loop gets round to it.
export function createInput(keyTarget, pointerTarget = null, { initialType = 'keyboard', accepts = () => true } = {}) {
  let pending = false;
  let debugToggles = 0;
  let lastType = initialType;

  const onKeyDown = (event) => {
    if (event.code === 'KeyD') {
      if (!event.repeat) debugToggles++;
      return;
    }
    if (event.code !== 'Space') return;
    event.preventDefault(); // keep the page from scrolling
    if (isFreshSpacePress(event)) {
      lastType = 'keyboard';
      if (accepts()) pending = true;
    }
  };

  // Every new finger, pen or primary mouse button is one press.
  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); // no text selection, focus changes or emulated mouse events
    lastType = event.pointerType === 'mouse' ? 'mouse' : 'touch';
    if (accepts()) pending = true;
  };

  keyTarget.addEventListener('keydown', onKeyDown);
  pointerTarget?.addEventListener('pointerdown', onPointerDown);

  return {
    consumePress() {
      const pressed = pending;
      pending = false;
      return pressed;
    },
    // True if D was pressed an odd number of times since the last call.
    consumeDebugToggle() {
      const toggled = debugToggles % 2 === 1;
      debugToggles = 0;
      return toggled;
    },
    // The input type used last, for prompts ("Tap" or "Press Space").
    get lastType() {
      return lastType;
    },
    destroy() {
      keyTarget.removeEventListener('keydown', onKeyDown);
      pointerTarget?.removeEventListener('pointerdown', onPointerDown);
    },
  };
}
