// Spacebar-only input. Presses are queued and consumed by the fixed-step loop,
// so they are applied at a sim step boundary. Key auto-repeat is ignored.

export function isFreshSpacePress(event) {
  return event.code === 'Space' && !event.repeat;
}

export function createInput(target) {
  let pending = false;

  const onKeyDown = (event) => {
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
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
    },
  };
}
