// Phaser's keyboard and pointers as the event sources the game's input reads
// (createInput in input.js: `addEventListener('keydown' | 'pointerdown', listener)`),
// preserving the input rules: key repeat ignored, the toggles, the
// presses queued for the next sim step, taps on the buttons kept out.
//
// Phaser 4.2.1's keyboard plugin hands a scene every key event of the frame again with
// each new one (M2 report), so each event is passed on once. Phaser reads mouse and
// touch events, not pointer events: each pointer is described the way input.js and the
// buttons expect.

// A small event source: listeners for one event type.
function source(type, attach, detach) {
  const listeners = new Set();
  const emit = (event) => {
    for (const listener of listeners) listener(event);
  };
  attach(emit);
  return {
    addEventListener(eventType, listener) {
      if (eventType === type) listeners.add(listener);
    },
    removeEventListener(eventType, listener) {
      if (eventType === type) listeners.delete(listener);
    },
    destroy: () => detach(emit),
  };
}

// Key presses from a scene's keyboard plugin (`scene.input.keyboard`), as the browser's
// keydown events, each once.
export function phaserKeys(keyboard, { intercept = () => false } = {}) {
  const seen = new WeakSet();
  let handler = null;
  return source(
    'keydown',
    (emit) => {
      handler = (event) => {
        if (seen.has(event)) return;
        seen.add(event);
        if (intercept(event)) return;
        emit(event);
      };
      keyboard.on('keydown', handler);
    },
    () => keyboard.off('keydown', handler),
  );
}

// Pointer presses from a scene's input plugin (`scene.input`), as pointer events.
export function phaserPointers(input) {
  let handler = null;
  return source(
    'pointerdown',
    (emit) => {
      handler = (pointer) => emit(pointerEvent(pointer));
      input.on('pointerdown', handler);
    },
    () => input.off('pointerdown', handler),
  );
}

// What input.js and the buttons read from a pointer event, for a Phaser pointer: the
// kind of pointer, the mouse button, an id, where it is on the page (the touch's own
// position for a finger), and preventDefault.
export function pointerEvent(pointer) {
  const native = pointer.event;
  const touch = pointer.wasTouch ? Array.from(native?.changedTouches ?? []).find((t) => t.identifier === pointer.identifier) : null;
  return {
    pointerType: pointer.wasTouch ? 'touch' : 'mouse',
    button: pointer.button,
    pointerId: pointer.id,
    clientX: touch?.clientX ?? native?.clientX,
    clientY: touch?.clientY ?? native?.clientY,
    preventDefault: () => native?.preventDefault?.(),
  };
}
