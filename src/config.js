// All gameplay tunables. Distances in logical pixels, times in seconds unless suffixed.

export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;

export const SIM_DT = 1 / 120;
export const MAX_FRAME_DT = 0.1;

export const ANCHOR_Y = -20;
export const LIANA_LENGTH = 420;
export const GRIP_RADIUS = 0.9 * LIANA_LENGTH;
export const GRIP_SLIDE_TIME = 0.15; // slide from contact point to GRIP_RADIUS
export const LIANA_SPACING = 380;

export const SWING_AMPLITUDE = (50 * Math.PI) / 180;
export const SWING_PERIOD = 1.8;
export const LIANA_SETTLE_DAMPING = 0.35; // damping ratio of the cosmetic sway after release

export const GRAVITY = 1800;
export const MONKEY_RADIUS = 22;

// Obstacle centre y. Outside roughly [200, 450] an obstacle never touches a forward
// swing or flight, so it would not affect the release window at all; the middle
// (about 255-385) is impassable and rerolled. [215, 430] keeps most generated gaps
// narrower than the 44-step obstacle-free window.
export const OBSTACLE_Y_RANGE = [215, 430];
// Hitbox shapes relative to the obstacle centre. Rects use their top-left corner.
export const OBSTACLE_HITBOXES = {
  branch: [{ kind: 'rect', dx: -80, dy: -12, w: 160, h: 24 }],
  thornBush: [
    { kind: 'circle', dx: -26, dy: 6, r: 30 },
    { kind: 'circle', dx: 26, dy: 6, r: 30 },
    { kind: 'circle', dx: 0, dy: -14, r: 34 },
  ],
  rock: [{ kind: 'circle', dx: 0, dy: 0, r: 36 }],
};
export const MIN_RELEASE_WINDOW_MS = 90;

export const CAMERA_TARGET_X = 0.35 * SCREEN_WIDTH;
export const CAMERA_LERP = 8;

// Entities are generated this far beyond the view on each side, and discarded
// once they are further than this plus one liana spacing.
export const WORLD_MARGIN = 2 * SCREEN_WIDTH;

export const GAMEOVER_INPUT_LOCK_MS = 400;
