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
// A catch higher on the rope than FLOW_GRIP first slides quickly down to it, at
// QUICK_SLIP_SPEED, then slips as above. From FLOW_GRIP down there is a release window
// on the first forward swing after a grab, so the jumps keep flowing instead of waiting
// a swing or two for the grip to slip low enough. The quick slide does not add to the
// release velocity.
export const FLOW_GRIP = 0.7 * LIANA_LENGTH;
export const QUICK_SLIP_SPEED = 1000; // px/s
// With slipping turned off (G), the grip holds still where it catches, but no higher
// than HOLD_GRIP (see Monkey.holds): a catch above it slides down to it. Deeper than
// FLOW_GRIP: a slipping grip is lower on the rope by the time it lets go, and a held one
// needs the same reach. Held anywhere from here to MAX_ENTRY_RADIUS, every generated gap
// keeps its windows.
export const HOLD_GRIP = 350;
// That slide carries on the monkey's fall along the rope and brakes evenly to a stop, in
// at most HOLD_SLIDE_TIME (faster if the monkey came in falling fast enough).
export const HOLD_SLIDE_TIME = 0.25; // s
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
// Bananas: collected on touch (hanging or flying), and counted per player against the
// bananas passed. They change neither the score nor the swing.
export const BANANA_RADIUS = 14;
// Each gap from obstacle 1 is a banana candidate with this chance; a candidate becomes
// a banana unless one of the two gaps before it is a candidate too, so bananas are at
// least 3 gaps apart and come in about 14 % of the gaps.
export const BANANA_CHANCE = 0.25;
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
  // The bat takes the bird's place at night: the same hitbox, so the same patrols.
  bat: [{ kind: 'circle', dx: 0, dy: 0, r: 16 }],
  blueBird: [{ kind: 'circle', dx: 0, dy: 0, r: 16 }],
  purpleBird: [{ kind: 'circle', dx: 0, dy: 0, r: 16 }],
  circleBat: [{ kind: 'circle', dx: 0, dy: 0, r: 16 }],
  // A stepped pyramid with a shrine on top, drawn from the top centre of the shrine
  // down: the shrine, three tiers each wider than the last, and a base tall enough to
  // reach the floor whatever the height (the obstacle is picked high enough in the lower
  // region that a flight passes over it, not under it). It is big: a door taller than the
  // monkey, a staircase wider than it. What shows is the top of a temple far bigger than
  // the gap, the rest lost in the undergrowth (see drawTemple). The shrine's width at the
  // top is what limits how high it can stand: the base can be as wide as it likes, below
  // where the swings reach. Every variant has this hitbox.
  temple: [
    { kind: 'rect', dx: -50, dy: 0, w: 100, h: 64 },
    { kind: 'rect', dx: -90, dy: 64, w: 180, h: 46 },
    { kind: 'rect', dx: -136, dy: 110, w: 272, h: 46 },
    { kind: 'rect', dx: -184, dy: 156, w: 368, h: 46 },
    { kind: 'rect', dx: -236, dy: 202, w: 472, h: 420 },
  ],
  // A skep-shaped hive: three stacked circles, about as wide as a thorn bush and a
  // little taller than a rock.
  beehive: [
    { kind: 'circle', dx: 0, dy: -16, r: 18 },
    { kind: 'circle', dx: 0, dy: 2, r: 24 },
    { kind: 'circle', dx: 0, dy: 22, r: 18 },
  ],
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
// Bird (and the bat that replaces it at night): patrols across the gap, low where
// flights come in over the far liana, with a slight bob. Its patrol bounds are the
// widest that stay clear of the swings.
export const BIRD_Y_RANGE = [330, 390];
export const BIRD_BOB = 8;

// A Mayan-style temple: rare, a static obstacle in the lower region. Each day/night cycle
// (the five stages from day to dawn, see stages.js) has at most one, at a random gap in it
// but not among the first TEMPLE_MIN_GAP, in one of TEMPLE_VARIANTS looks (the hitbox is
// the same for all).
export const TEMPLE_MIN_GAP = 6;
export const TEMPLE_VARIANTS = 4;

// The share of the static gaps that get a beehive; the other three static types split
// the rest equally. A hive is a bigger thing to meet than a rock.
export const BEEHIVE_SHARE = 0.08;

// Some branches (this share of them) carry a decoration, for show: see BRANCH_DECORATIONS in
// obstacle.js. The decoration is not part of the hitbox.
export const BRANCH_DECORATION_CHANCE = 0.14;
// The night stages are few and far between, and a branch is only about one gap in seven
// in them, so by day's odds the night animals (the hanging bat and the owl) would almost
// never show. At night more branches carry a decoration, and this share of them one of the
// night ones.
export const BRANCH_DECORATION_CHANCE_NIGHT = 0.4;
export const NIGHT_DECORATION_SHARE = 0.5;

// Blue bird: flies up and down at the gap centre, in free air: in the high band (its
// lowest point in BLUE_BIRD_HIGH, over a flight of BLUE_BIRD_HIGH_TRAVEL) or the low band
// (its highest point in BLUE_BIRD_LOW, over BLUE_BIRD_LOW_TRAVEL), with a slight
// swoop (BLUE_BIRD_BOB). By day only: not at dusk or at night.
export const BLUE_BIRD_HIGH = [165, 200];
export const BLUE_BIRD_HIGH_TRAVEL = [70, 130];
export const BLUE_BIRD_LOW = [296, 322];
export const BLUE_BIRD_LOW_TRAVEL = [80, 140];
export const BLUE_BIRD_BOB = 6;

// Purple bird (and, at night, its replacement the circling bat): flies in a circle at the
// gap centre, either way round, in the open space
// the swings leave in the lower region, between the highest point of the circle
// (PURPLE_BIRD_TOP) and a radius (PURPLE_BIRD_RADIUS), once round in PURPLE_BIRD_PERIOD
// seconds. So it is a high obstacle at the top of its circle, a low one at the bottom and
// a wide one at the sides, depending on where it is when the monkey swings by. At any
// time of day.
export const PURPLE_BIRD_TOP = [322, 345];
export const PURPLE_BIRD_RADIUS = [42, 72];
export const PURPLE_BIRD_PERIOD = [2.4, 3.6];

// The shortest release window a gap may have in stage 1 (later stages: STAGES).
export const MIN_RELEASE_WINDOW_MS = 90;
// Difficulty stages, keyed by obstacle index (the gap: obstacle #1 is in gap 1), never
// by score. Each has its shortest release window, share of moving obstacles and
// obstacle scale.
export const STAGES = [
  { first: 1, minWindowMs: MIN_RELEASE_WINDOW_MS, movingShare: 0.12, scale: 1.0, grades: [0.65, 0.35, 0, 0], high: 0.5 },
  { first: 16, minWindowMs: 80, movingShare: 0.2, scale: 1.1, grades: [0.4, 0.4, 0.2, 0], high: 0.5 },
  { first: 31, minWindowMs: 70, movingShare: 0.4, scale: 1.2, grades: [0.25, 0.35, 0.4, 0], high: 0.5 },
  { first: 51, minWindowMs: 60, movingShare: 0.55, scale: 1.3, grades: [0.2, 0.3, 0.3, 0.2], high: null },
];

// Obstacles above this height hang from the canopy ("high"); lower ones stand on the
// floor ("low"). Swing clearance leaves no passable height around this line. A stage's
// `high` is the share of its gaps that aim for a high obstacle (the rest for a low one),
// to keep the two about even where the grades alone would not (the easy obstacles are
// mostly high); null leaves the mix to the types and the grades.
export const HIGH_BELOW_Y = 255;

// Obstacle difficulty grades, 1 (easiest) to 4. An obstacle's grade is how much of the
// release timing it takes away: the share of release steps whose flight it blocks, over
// an empty gap's, averaged over the entry radii (and, for a moving obstacle, over sampled
// arrival times). GRADE_BOUNDS are the shares from which the grades 2, 3 and 4 start.
export const GRADE_BOUNDS = [0.12, 0.19, 0.27];
// Each stage's `grades` are the odds (they need not sum to 1) of a gap aiming for grade
// 1, 2, 3 and 4. A grade with no odds in a stage never appears in it, so the hardest
// obstacles wait for the stage that lists them. The stages after the last move on
// from its odds towards LATER_GRADE_ODDS, over LATER_GRADE_STAGES stages: all four grades
// stay in play, the harder ones get likelier.
export const LATER_GRADE_ODDS = [0.1, 0.2, 0.3, 0.4];
export const LATER_GRADE_STAGES = 8;
// A moving obstacle is accepted with a grade within one of the one a gap aims for, else
// the gap gets a static one. Only the first MOVING_GRADED_TRIES candidates that clear the
// solver are graded (grading a moving obstacle costs a few ms), the closest wins.
export const MOVING_GRADED_TRIES = 3;
// Static candidates (type and height) drawn per gap while looking for the aimed grade.
export const STATIC_TRIES = 40;
// A moving obstacle's grade samples every GRADE_ARRIVAL_STEP-th of the solver's arrival
// times and every GRADE_RADIUS_STEP-th entry radius (grading it is the costly part).
export const GRADE_ARRIVAL_STEP = 4;
export const GRADE_RADIUS_STEP = 2;
// From the last stage's first obstacle on, the stage number (and the time of day) counts
// on every STAGE_LENGTH_AFTER obstacles. Each stage after the last then keeps the last
// one's obstacle scale but asks a little more: a shortest release window 2 ms shorter
// (down to 40 ms, about 5 sim steps) and 4 points more moving obstacles (up to 75 %).
export const STAGE_LENGTH_AFTER = 20;
export const LATER_WINDOW_STEP_MS = 2;
export const LATER_MIN_WINDOW_MS = 40;
export const LATER_MOVING_STEP = 0.04;
export const LATER_MOVING_MAX = 0.75;
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
// (as does `primary`). `slip` (G, for grip) turns slipping on and off, `lives` (H, for
// hearts) turns lives on and off for single player, on the title screen.
export const KEYS = Object.freeze({
  primary: ['Space'],
  start: ['Enter', 'NumpadEnter'],
  p1: ['KeyA'],
  p2: ['KeyL'],
  mode: ['Digit1', 'Digit2', 'Digit3'],
  menu: ['Escape'],
  debug: ['KeyD'],
  mute: ['KeyM'],
  pause: ['KeyP'],
  slip: ['KeyG'],
  lives: ['KeyH'],
});
// The lives each player starts with in the two-player modes, and in single player with
// lives turned on.
export const LIVES_2P = 3;
// With lives, every BANANAS_PER_HEART bananas a player takes turn the next banana in the
// game into a heart: an extra life, not counted as a banana. No one has more than MAX_LIVES.
export const BANANAS_PER_HEART = 5;
export const MAX_LIVES = 99;
// Shared screen draws the world at this scale in the 16:9 frame, a wider view
// (SCREEN_WIDTH / SHARED_ZOOM of world), and keeps the leading monkey this far across
// it: the next liana is in view ahead, and the other monkey can be over a liana behind.
export const SHARED_ZOOM = 0.75;
export const SHARED_LEADER_X = 0.5;
// After losing a life, a monkey tumbles for RESPAWN_DELAY_MS, then hangs again on a
// liana at RESPAWN_GRIP, invulnerable to obstacles for RESPAWN_INVULN_MS.
export const RESPAWN_DELAY_MS = 1000;
export const RESPAWN_INVULN_MS = 1500;

// Death feedback. Hitting an obstacle bounces the monkey back (fraction of its
// horizontal speed) and pops it up (px/s) so the tumble is visible.
export const DEATH_BOUNCE = 0.4;
export const DEATH_POP = 260;
export const DEATH_SHAKE_PX = 9;
export const DEATH_SHAKE_TIME = 0.35;
