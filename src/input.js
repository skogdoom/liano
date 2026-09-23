// Spacebar is the only game input. Presses are queued and consumed by the
// fixed-step loop, so they are applied at a sim step boundary. Key auto-repeat is
// ignored. D toggles the debug overlay.

export function isFreshSpacePress(event) {
  return event.code === 'Space' && !event.repeat;
}

export function createInput(target) {
  let pending = false;
  let debugToggles = 0;

  const onKeyDown = (event) => {
    if (event.code === 'KeyD') {
      if (!event.repeat) debugToggles++;
      return;
    }
    if (event.code !== 'Space') return;
    event.preventDefault(); // keep the page from scrolling
    if (isFreshSpacePress(event)) pending = true;
  };

  target.addEventListener('keydown', onKeyDown);

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
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
    },
  };
}
