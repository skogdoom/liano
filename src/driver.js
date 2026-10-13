import { MAX_FRAME_DT, SIM_DT } from './config.js';
import { soundsFor } from './audio/sounds.js';
import { FrameClock } from './frameClock.js';
import { createFixedStepLoop } from './loop.js';
import { MODE_ORDER } from './sim/match.js';

// Action roles, in the order the loop applies them within a step (see KEYS).
const ROLES = ['start', 'primary', 'p1', 'p2', 'menu'];

// Runs the game for either version: presses applied at fixed-step boundaries, the
// toggle keys, pause, the obstacle prefetch and the sounds for each frame's events.
// Drawing is the version's own: `onStep(dt)` after every sim step, and `frame()`
// returns what a frame draws with.
//
// `input` is createInput's, `pause` createPause's, `sound` a SoundPlayer (or the Phaser
// version's), `prefetch` an ObstaclePrefetch. `onDebugToggle` and `onMuteToggle` are
// called when D and M are pressed. Until `ready()` (the Phaser version's art), presses
// wait in the input: one made before then acts as soon as it is.
export function createDriver({ game, input, pause, sound, prefetch, ready = () => true, onStep = () => {}, onDebugToggle = () => {}, onMuteToggle = () => {} }) {
  const loop = createFixedStepLoop({
    dt: SIM_DT,
    maxFrameDt: MAX_FRAME_DT,
    step(dt) {
      const pick = input.consumeModePick();
      if (pick && game.selectMode(MODE_ORDER[pick - 1])) input.clear();
      for (const role of ready() ? ROLES : []) {
        // A press that changes the state (starts or restarts a run) is the step's last.
        if (input.consumePress(role) && game.press(role)) {
          input.clear();
          break;
        }
      }
      game.step(dt);
      onStep(dt);
    },
  });

  // Frame times evened out to the screen's refresh (frameClock.js).
  const clock = new FrameClock();

  return {
    loop,
    // One frame, `deltaMs` after the last. Returns the frame's time step (0 while
    // paused), how far into the next sim step to draw (`alpha`), the sim's events since
    // the last frame, and whether the game is paused.
    frame(deltaMs) {
      if (input.consumeDebugToggle()) onDebugToggle();
      if (input.consumeMuteToggle()) onMuteToggle();
      // G turns slipping on and off, anywhere (paused too).
      if (input.consumeSlipToggle()) game.toggleSlip();
      // H turns lives on and off for single player, on the title screen.
      if (input.consumeLivesToggle()) game.toggleLives();
      // S turns the shadow monkey on and off for single player, on the title screen.
      if (input.consumeShadowToggle()) game.toggleShadow();
      // P pauses a run, and resumes whatever it paused.
      if (input.consumePauseToggle() && (game.pausable || pause.reason === 'manual')) pause.toggle('manual');
      // While paused nothing moves: the sim, the monkey's spin, the shake and the pulsing prompts.
      const paused = pause.paused;
      if (paused) input.clear(); // a press made just before pausing must not act on resume
      const stepMs = clock.frame(deltaMs);
      const frameDt = paused ? 0 : Math.min(stepMs / 1000, MAX_FRAME_DT);
      // The part of a step the accumulator holds: the camera and monkeys are drawn that far on.
      const alpha = loop.advance(frameDt);
      prefetch.update(game.worlds.map((w) => w.obstacles));
      sound.setPaused(paused);
      const events = game.takeEvents();
      if (globalThis.__frameNote) for (const e of events) globalThis.__frameNote(e.type); // ?frames=1 (frameStats.js)
      for (const recipe of soundsFor(events)) sound.play(recipe);
      return { frameDt, alpha, events, paused };
    },
  };
}
