// All gameplay tunables. Distances in logical pixels, times in seconds unless suffixed.

// The landscape design frame. Layouts for other screen shapes derive from it (see
// layout.js).
export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;
// The world band: lianas hang from its top, and falling below it ends the run.
export const WORLD_HEIGHT = 720;

export const SIM_DT = 1 / 120;
export const MAX_FRAME_DT = 0.1;
// Canvas pixels per CSS pixel are capped here: 3× phone screens cost fill rate for
// no visible gain.
export const MAX_RESOLUTION = 2;

export const ANCHOR_Y = -20;
export const LIANA_LENGTH = 420;
// The grip slips from where the liana was caught towards the tip; at the tip the monkey
// is forced off with its current velocity. Each grip gets its own steady slip speed, so
// that it reaches the tip at SLIP_OFF_PHASE: the fastest speed up to MAX_SLIP_SPEED that
// does. A release reaches the next liana only from about 310 px down the rope and on the
// forward swing, so slipping the last 110 px must take at least one swing period
// (≤ 42 px/s): then every grip, however high, passes a forward swing low enough on the
// rope before it is forced off.
export const MAX_SLIP_SPEED = 40; // px/s
// When the forced release comes: this fraction of the swing period after the bottom, on
// the upswing to the right. Mid-way through the forward release window (about 0.05 to
// 0.165), so the forced release is a hop to the next liana unless an obstacle is in the way.
export const SLIP_OFF_PHASE = 0.11;
// A catch lower on the rope than this grips here instead, so a monkey that catches the
// very tip still gets a swing before it is forced off.
export const MAX_ENTRY_RADIUS = 0.95 * LIANA_LENGTH;
// Where the monkey hangs at the start of a run (and, in 2P, after a respawn). It does
// not slip on the title screen.
export const START_GRIP = 0.7 * LIANA_LENGTH;
export const RESPAWN_GRIP = 0.7 * LIANA_LENGTH;
// The vine end blinks for this long (s) before the forced release, faster at the end.
export const TIP_WARNING_TIME = 1;
// Entry radii the fairness solver samples: every gap must be passable after grabbing
// the liana at each of them.
export const ENTRY_RADII = [0.35, 0.5, 0.65, 0.8].map((f) => f * LIANA_LENGTH).concat(MAX_ENTRY_RADIUS);
// Wide enough that neighbouring swings (reach LIANA_LENGTH · sin(SWING_AMPLITUDE) ≈ 322)
// leave the middle of each gap free for obstacles.
export const LIANA_SPACING = 700;

export const SWING_AMPLITUDE = (50 * Math.PI) / 180;
export const SWING_PERIOD = 2.6;
export const LIANA_SETTLE_DAMPING = 0.35; // damping ratio of the cosmetic sway after release

export const GRAVITY = 600; // low, for long flights across the wide gaps (400 felt too floaty)
export const MONKEY_RADIUS = 22;

// Obstacle centre y. Obstacles must stay clear of both neighbouring lianas' swept area
// (rope and hanging monkey), which rules out the middle heights near the swing tips.
// Above that the monkey has to fly under the obstacle, below it over it; outside this
// range an obstacle would not touch any forward flight.
export const OBSTACLE_Y_RANGE = [140, 375];
// Extra space kept between an obstacle and a liana's swept area, beyond MONKEY_RADIUS.
export const LIANA_CLEARANCE = 6;
// Hitbox shapes relative to the obstacle centre. Rects use their top-left corner.
export const OBSTACLE_HITBOXES = {
  branch: [{ kind: 'rect', dx: -80, dy: -12, w: 160, h: 24 }],
  thornBush: [
    { kind: 'circle', dx: -26, dy: 6, r: 30 },
    { kind: 'circle', dx: 26, dy: 6, r: 30 },
    { kind: 'circle', dx: 0, dy: -14, r: 34 },
  ],
  rock: [{ kind: 'circle', dx: 0, dy: 0, r: 36 }],
  spider: [{ kind: 'circle', dx: 0, dy: 0, r: 18 }],
  snake: [{ kind: 'circle', dx: 0, dy: 0, r: 18 }],
  bird: [{ kind: 'circle', dx: 0, dy: 0, r: 16 }],
};

// Moving obstacles (see obstacle.js). Their whole path stays clear of both
// neighbouring lianas' swept areas, which at the gap centre leaves the heights above
// about 213 and below about 288 (valid flights cross the centre at about 189–361).
// Each moves with a period in this range (s) and a random phase.
export const MOVING_PERIOD_RANGE = [1.5, 3.0];
// Spider: hangs on a thread from the canopy at the gap centre; its lowest point and
// how far it climbs above that.
export const SPIDER_LOW_RANGE = [175, 212];
export const SPIDER_TRAVEL_RANGE = [80, 150];
// Snake: climbs a vine standing in the gap centre; its highest point and how far it
// slides down below that.
export const SNAKE_HIGH_RANGE = [290, 320];
export const SNAKE_TRAVEL_RANGE = [90, 160];
// Bird: patrols across the gap, low where flights come in over the far liana, with a
// slight bob. Its patrol bounds are the widest that stay clear of the swings.
export const BIRD_Y_RANGE = [330, 390];
export const BIRD_BOB = 8;

// The shortest release window a gap may have in stage 1 (later stages: STAGES).
export const MIN_RELEASE_WINDOW_MS = 90;
// Difficulty stages, keyed by obstacle index (the gap: obstacle #1 is in gap 1), never
// by score. Each has its shortest release window, share of moving obstacles and
// obstacle scale.
export const STAGES = [
  { first: 1, minWindowMs: MIN_RELEASE_WINDOW_MS, movingShare: 0.15, scale: 1.0 },
  { first: 16, minWindowMs: 80, movingShare: 0.25, scale: 1.1 },
  { first: 31, minWindowMs: 70, movingShare: 0.5, scale: 1.2 },
  { first: 51, minWindowMs: 60, movingShare: 0.7, scale: 1.3 },
];
// The first obstacles are always static: moving ones start at this obstacle index.
export const MOVING_FROM = 6;

export const CAMERA_TARGET_X = 0.35 * SCREEN_WIDTH;
export const CAMERA_LERP = 8;

// Layout (see layout.js).
// Landscape screens wider than 16:9 first crop the empty bottom of the world band,
// down to this much visible height, then show more world to the side, up to this width.
export const MIN_VISIBLE_WORLD_HEIGHT = 570;
export const MAX_VIEW_WIDTH = 1600;
// Portrait shows this much world width. While the monkey hangs, the camera holds the
// liana's anchor at this fraction of the view from the left.
export const PORTRAIT_VIEW_WIDTH = 1100;
export const PORTRAIT_ANCHOR_X = 0.3;
// Portrait: share of the spare height (beyond the world band) above the band.
export const PORTRAIT_SPARE_ABOVE = 0.4;
// Portrait text and buttons are enlarged so they draw at least this many CSS pixels per
// logical pixel, up to MAX_UI_SCALE times their landscape size.
export const MIN_UI_CSS_SCALE = 0.6;
export const MAX_UI_SCALE = 1.8;

// Entities are generated this far beyond the view on each side, and discarded
// once they are further than this plus one liana spacing.
export const WORLD_MARGIN = 2 * SCREEN_WIDTH;

export const GAMEOVER_INPUT_LOCK_MS = 400;

// Keys by role (KeyboardEvent.code). `primary` is 1P's action key (a tap does the same),
// `p1`/`p2` are the two-player action keys (not Shift: five presses open Windows' Sticky
// Keys dialog), `mode` picks the mode on the title screen (1, 2, 3) and `start` starts it
// (as does `primary`).
export const KEYS = Object.freeze({
  primary: ['Space'],
  start: ['Enter', 'NumpadEnter'],
  p1: ['KeyA'],
  p2: ['KeyL'],
  mode: ['Digit1', 'Digit2', 'Digit3'],
  debug: ['KeyD'],
  mute: ['KeyM'],
});
export const LIVES_2P = 3;

// Death feedback. Hitting an obstacle bounces the monkey back (fraction of its
// horizontal speed) and pops it up (px/s) so the tumble is visible.
export const DEATH_BOUNCE = 0.4;
export const DEATH_POP = 260;
export const DEATH_SHAKE_PX = 9;
export const DEATH_SHAKE_TIME = 0.35;
