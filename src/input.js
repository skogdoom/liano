import { KEYS } from './config.js';

// Game input: keys by role (see KEYS in config.js), and a tap/click on the game, which
// counts as `primary`. Presses are queued and consumed by the fixed-step loop, so they
// are applied at a sim step boundary. Key auto-repeat is ignored for every key. `debug`
// (D) and `mute` (M) are toggles; `mode` (1, 2, 3) picks a mode on the title screen.

export function isFreshSpacePress(event) {
  return event.code === 'Space' && !event.repeat;
}

// `keyTarget` receives keydown (the window); `pointerTarget` (the canvas) receives
// pointerdown. `initialType` is the input type assumed before any input: 'keyboard',
// 'mouse' or 'touch'. `accepts()` is asked when a press happens; a press it rejects
// (e.g. while paused) is dropped then, not when the loop gets round to it.
// `intercept(event)` sees each pointerdown first; returning true swallows it (used by
// on-screen buttons). `keys` maps roles to key codes.
export function createInput(
  keyTarget,
  pointerTarget = null,
  { initialType = 'keyboard', accepts = () => true, intercept = () => false, keys = KEYS } = {},
) {
  const roleOf = new Map();
  for (const [role, codes] of Object.entries(keys)) for (const code of codes) roleOf.set(code, role);
  const pending = new Set(); // action roles pressed since they were last consumed
  const toggles = { debug: 0, mute: 0 };
  let modePick = null;
  let lastType = initialType;

  const onKeyDown = (event) => {
    const role = roleOf.get(event.code);
    if (!role) return;
    if (event.code === 'Space') event.preventDefault(); // keep the page from scrolling, repeats too
    if (event.repeat) return;
    if (role in toggles) {
      toggles[role]++;
      return;
    }
    lastType = 'keyboard';
    if (!accepts()) return;
    if (role === 'mode') modePick = keys.mode.indexOf(event.code) + 1;
    else pending.add(role);
  };

  // Every new finger, pen or primary mouse button is one press.
  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); // no text selection, focus changes or emulated mouse events
    lastType = event.pointerType === 'mouse' ? 'mouse' : 'touch';
    if (intercept(event)) return;
    if (accepts()) pending.add('primary');
  };

  const consumeToggle = (role) => {
    const toggled = toggles[role] % 2 === 1;
    toggles[role] = 0;
    return toggled;
  };

  keyTarget.addEventListener('keydown', onKeyDown);
  pointerTarget?.addEventListener('pointerdown', onPointerDown);

  return {
    // True if `role` ('primary', 'start', 'p1' or 'p2') was pressed since the last call.
    consumePress(role = 'primary') {
      return pending.delete(role);
    },
    // The mode picked (1, 2 or 3) since the last call, or null.
    consumeModePick() {
      const pick = modePick;
      modePick = null;
      return pick;
    },
    // Drops every queued press and mode pick (e.g. ones made just before pausing).
    clear() {
      pending.clear();
      modePick = null;
    },
    // True if D was pressed an odd number of times since the last call.
    consumeDebugToggle() {
      return consumeToggle('debug');
    },
    // True if M was pressed an odd number of times since the last call.
    consumeMuteToggle() {
      return consumeToggle('mute');
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
