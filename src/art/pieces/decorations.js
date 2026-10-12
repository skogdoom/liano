import {
  BAT_LOOKS,
  BIRD_COLORS,
  HANGING_MONKEY_CURL,
  HANGING_MONKEY_LEG_WIDTH,
  LINE_COLORS,
  NEST_PARTS,
  PERCHED_BIRD,
  SNAKE_NECK_WIDTH,
  drawChick,
  drawChickBeak,
  drawCoconut,
  drawCoconutFrond,
  drawCoconutHair,
  drawFlowerHeart,
  drawFlowerLeaf,
  drawFlowerStem,
  drawHangingBatBody,
  drawHangingBatEar,
  drawHangingBatEyes,
  drawHangingMonkeyArms,
  drawHangingMonkeyBody,
  drawHangingMonkeyEyes,
  drawHangingMonkeyTail,
  drawNestBack,
  drawNestCap,
  drawNestEgg,
  drawNestFront,
  drawNestLeaf,
  drawNestRim,
  drawNestShell,
  drawOwlBeak,
  drawOwlBody,
  drawOwlDisc,
  drawOwlEyeball,
  drawOwlPupil,
  drawOwlShutEye,
  drawOwlSkull,
  drawPerchedBirdBody,
  drawPerchedBirdHead,
  drawPerchedBirdTail,
  drawPetal,
  drawSnakeBand,
  drawSnakeHead,
  drawSnakeMark,
  drawSnakeTail,
  drawSnakeTongue,
} from '../../render/obstacleViews.js';
import { OBSTACLE_SCALE } from './branch.js';
import { linePieces } from './lines.js';

// What a branch can carry (the panther is in branch.js). Each decoration is placed on the
// branch and faces left or right (mirrored); its parts are placed, turned and swapped by
// its rig as the code animates them.
const obstacle = { scale: OBSTACLE_SCALE };

export const BIRD_LOOKS = ['red', 'blue', 'purple']; // BIRD_COLORS, in order
export const BAT_LOOK_NAMES = ['purple', 'brown', 'grey', 'black']; // BAT_LOOKS, in order

// Flipbooks over a value from `min` to `max`: frame i's value, and the frame for a value.
export const flipbook = (frames, min, max) => ({
  frames,
  valueOf: (i) => min + ((max - min) * i) / (frames - 1),
  frameFor: (value) => Math.min(frames - 1, Math.max(0, Math.round(((value - min) / (max - min)) * (frames - 1)))),
});
export const MONKEY_TAIL = flipbook(13, -HANGING_MONKEY_CURL, HANGING_MONKEY_CURL);
export const BAT_EAR = flipbook(9, 0, 1);
export const CHICK_BEAK = flipbook(9, 0, 1);

// The snake's bands across a limb are drawn for a limb SNAKE_LIMB_REFERENCE thick and
// stretched across (from their top) to the limb's thickness plus 2.
export const SNAKE_LIMB_REFERENCE = 20;
export const SNAKE_POLE_THICKNESS = 26;
// Its scale marks are drawn SNAKE_MARK_REFERENCE in radius and scaled.
export const SNAKE_MARK_REFERENCE = 2;
// Flowers: stems drawn FLOWER_STEM_REFERENCE tall (stretched), leaves FLOWER_LEAF_REFERENCE
// long and half as wide, petals and hearts FLOWER_DOT_REFERENCE in radius (scaled, and
// tinted with the flower's colour).
export const FLOWER_STEM_REFERENCE = 20;
export const FLOWER_LEAF_REFERENCE = 7;
export const FLOWER_DOT_REFERENCE = 4;
// Coconuts: drawn COCONUT_REFERENCE in radius and scaled; a hair, at the nut's right.
export const COCONUT_REFERENCE = 7;

const perchedBirds = BIRD_LOOKS.flatMap((look, i) => [
  {
    ...obstacle,
    key: `perchedBird.${look}.body`,
    purpose: `A small ${look} bird perched on the branch: the body, its feet at the origin.`,
    attach: { tail: [PERCHED_BIRD.tail.x, PERCHED_BIRD.tail.y], head: [PERCHED_BIRD.head.x, PERCHED_BIRD.head.y] },
    frames: [(g) => drawPerchedBirdBody(g, BIRD_COLORS[i])],
  },
  {
    ...obstacle,
    key: `perchedBird.${look}.tail`,
    purpose: `The ${look} perched bird's tail, from its root (the origin); it flicks about the root.`,
    frames: [(g) => drawPerchedBirdTail(g, BIRD_COLORS[i])],
  },
  {
    ...obstacle,
    key: `perchedBird.${look}.head`,
    purpose: `The ${look} perched bird's head about its centre (the origin); it dips to peck.`,
    frames: [(g) => drawPerchedBirdHead(g, BIRD_COLORS[i])],
  },
]);

const perchedSnake = [
  {
    ...obstacle,
    key: 'perchedSnake.tail',
    purpose: 'The tail of a snake coiled round the branch, tapering from its root (the origin) past the last coil: round the trunk (frame 0) or the limb (frame 1).',
    frames: [(g) => drawSnakeTail(g, [0, 0], true), (g) => drawSnakeTail(g, [0, 0], false)],
  },
  {
    ...obstacle,
    key: 'perchedSnake.band',
    purpose: `The front of a coil, slanting across the wood from its top (the origin): round the trunk (frame 0, ${SNAKE_POLE_THICKNESS} px thick), or round the limb (frame 1, for a limb ${SNAKE_LIMB_REFERENCE} px thick, stretched across to the limb's thickness).`,
    frames: [
      (g) => drawSnakeBand(g, { from: [-SNAKE_POLE_THICKNESS / 2 - 1, 0], to: [SNAKE_POLE_THICKNESS / 2 + 1, 6], bulge: [0, 4.5] }),
      (g) => drawSnakeBand(g, { from: [-4, 0], to: [4, SNAKE_LIMB_REFERENCE + 2], bulge: [2.5, SNAKE_LIMB_REFERENCE / 2 + 1] }),
    ],
  },
  {
    ...obstacle,
    key: 'perchedSnake.mark',
    purpose: `A dark scale mark on a coil, ${SNAKE_MARK_REFERENCE} px in radius about the origin; scaled.`,
    frames: [(g) => drawSnakeMark(g, [0, 0], SNAKE_MARK_REFERENCE)],
  },
  ...linePieces({
    ...obstacle,
    key: 'perchedSnake.neck',
    curve: true,
    width: SNAKE_NECK_WIDTH,
    color: LINE_COLORS.snake,
    purpose: 'The neck of the coiled snake, rising from the last coil to the head.',
  }),
  {
    ...obstacle,
    key: 'perchedSnake.head',
    purpose: 'The coiled snake\'s head, about the end of its neck (the origin), facing +x; it sways and turns.',
    frames: [(g) => drawSnakeHead(g)],
  },
  {
    ...obstacle,
    key: 'perchedSnake.tongue',
    purpose: 'Its tongue, flicking now and then (in the head\'s coordinates).',
    frames: [(g) => drawSnakeTongue(g)],
  },
];

const hangingMonkey = [
  {
    ...obstacle,
    key: 'hangingMonkey.arms',
    purpose: 'A grey monkey hanging under the branch: the arms, its hands at the origin (it swings about them).',
    frames: [(g) => drawHangingMonkeyArms(g)],
  },
  {
    ...obstacle,
    key: 'hangingMonkey.body',
    purpose: 'The hanging monkey\'s body and head (in the hands\' coordinates).',
    frames: [(g) => drawHangingMonkeyBody(g)],
  },
  ...linePieces({
    ...obstacle,
    key: 'hangingMonkey.leg',
    width: HANGING_MONKEY_LEG_WIDTH,
    color: LINE_COLORS.monkeyFur,
    purpose: 'A leg of the hanging monkey, from its hip, kicking.',
  }),
  {
    ...obstacle,
    key: 'hangingMonkey.tail',
    purpose: `The hanging monkey's tail curling out and up, in ${MONKEY_TAIL.frames} frames from the least curled to the most (in the hands' coordinates).`,
    frames: Array.from({ length: MONKEY_TAIL.frames }, (_, i) => (g) => drawHangingMonkeyTail(g, MONKEY_TAIL.valueOf(i))),
  },
  {
    ...obstacle,
    key: 'hangingMonkey.eyes',
    purpose: 'Its eyes: open (frame 0) and shut (frame 1).',
    frames: [(g) => drawHangingMonkeyEyes(g, false), (g) => drawHangingMonkeyEyes(g, true)],
  },
];

const hangingBats = BAT_LOOK_NAMES.flatMap((name, i) => {
  const look = BAT_LOOKS[i];
  return [
    {
      ...obstacle,
      key: `hangingBat.${name}.body`,
      purpose: `A ${name} bat hanging upside down under the branch, wrapped in its wings; its feet at the origin (it sways about them).`,
      frames: [(g) => drawHangingBatBody(g, look)],
    },
    {
      ...obstacle,
      key: `hangingBat.${name}.eyes`,
      purpose: `The ${name} hanging bat's eyes: shut (frame 0) and open (frame 1).`,
      frames: [(g) => drawHangingBatEyes(g, look, false), (g) => drawHangingBatEyes(g, look, true)],
    },
    {
      ...obstacle,
      key: `hangingBat.${name}.ear`,
      purpose: `The ${name} hanging bat's ear that twitches, in ${BAT_EAR.frames} frames from still to the full twitch.`,
      frames: Array.from({ length: BAT_EAR.frames }, (_, f) => (g) => drawHangingBatEar(g, look, BAT_EAR.valueOf(f))),
    },
  ];
});

const owl = [
  ['body', 'An owl perched on the branch: the body, its feet at the origin; it puffs as it breathes.', drawOwlBody],
  ['skull', "The owl's head with its ear tufts, about its centre (the origin); it tilts as it turns.", drawOwlSkull],
  ['disc', 'The pale face round the eyes (in the head\'s coordinates); it slides as the head turns.', drawOwlDisc],
  ['beak', 'The beak (in the face\'s coordinates).', drawOwlBeak],
  ['eyeball', 'An eye, about its centre.', drawOwlEyeball],
  ['pupil', 'A pupil, about the eye\'s centre; it leads the turn.', drawOwlPupil],
  ['shutEye', 'An eye shut, about its centre.', drawOwlShutEye],
].map(([part, purpose, draw]) => ({ ...obstacle, key: `owl.${part}`, purpose, frames: [(g) => draw(g)] }));

const nest = [
  {
    ...obstacle,
    key: 'nest.back',
    purpose: 'A nest on the branch: the back of the bowl and its dark inside, its foot at the origin.',
    frames: [(g) => drawNestBack(g)],
  },
  {
    ...obstacle,
    key: 'nest.front',
    purpose: 'The front wall of the nest, over its contents (in the nest\'s coordinates).',
    frames: [(g) => drawNestFront(g)],
  },
  {
    ...obstacle,
    key: 'nest.rim',
    purpose: 'The rim of the nest, over the front wall and its twigs.',
    frames: [(g) => drawNestRim(g)],
  },
  ...linePieces({ ...obstacle, key: 'nest.twig', width: 1.2, color: LINE_COLORS.twig, purpose: 'A dark twig woven across the front of the nest.' }),
  ...linePieces({ ...obstacle, key: 'nest.lightTwig', width: 1.2, color: LINE_COLORS.twigLight, purpose: 'A light twig woven across the front of the nest.' }),
  ...linePieces({ ...obstacle, key: 'nest.rimTwig', width: 1.4, color: LINE_COLORS.twig, purpose: 'A twig stuck out of the rim.' }),
  {
    ...obstacle,
    key: 'nest.egg',
    purpose: `An egg in the nest, about its centre (placed at ${NEST_PARTS.egg.x}, ${NEST_PARTS.egg.y}); it rocks now and then.`,
    frames: [(g) => drawNestEgg(g)],
  },
  {
    ...obstacle,
    key: 'nest.shell',
    purpose: 'The cracked shell a chick hatched from, about its centre.',
    frames: [(g) => drawNestShell(g)],
  },
  {
    ...obstacle,
    key: 'nest.chick',
    purpose: 'The chick, about its centre; it bobs and tilts.',
    frames: [(g) => drawChick(g)],
  },
  {
    ...obstacle,
    key: 'nest.chickBeak',
    purpose: `The chick's beak, in ${CHICK_BEAK.frames} frames from shut to wide open (in the chick's coordinates).`,
    frames: Array.from({ length: CHICK_BEAK.frames }, (_, i) => (g) => drawChickBeak(g, CHICK_BEAK.valueOf(i))),
  },
  {
    ...obstacle,
    key: 'nest.cap',
    purpose: 'The top of the shell, tipped on the rim.',
    frames: [(g) => drawNestCap(g)],
  },
  {
    ...obstacle,
    key: 'nest.leaf',
    purpose: 'A dry leaf curled in the bottom of an empty nest (in the nest\'s coordinates).',
    frames: [(g) => drawNestLeaf(g)],
  },
];

const flowers = [
  {
    ...obstacle,
    key: 'flower.stem',
    purpose: `A flower's stem, ${FLOWER_STEM_REFERENCE} px up from its foot (the origin), curving a little; stretched to each flower's height.`,
    frames: [(g) => drawFlowerStem(g, FLOWER_STEM_REFERENCE)],
  },
  {
    ...obstacle,
    key: 'flower.leaf',
    purpose: `A leaf on a stem, ${FLOWER_LEAF_REFERENCE} px from its base (the origin) along +x: green (frame 0) and dark (frame 1). Placed, turned and scaled per leaf.`,
    frames: [LINE_COLORS.flowerStem, LINE_COLORS.leafDark].map((color) => (g) =>
      drawFlowerLeaf(g, { y: 0, angle: 0, length: FLOWER_LEAF_REFERENCE, width: FLOWER_LEAF_REFERENCE / 2, color }),
    ),
  },
  {
    ...obstacle,
    key: 'flower.petal',
    purpose: `A petal, ${FLOWER_DOT_REFERENCE} px in radius about its centre: white, tinted with the flower's colour, and scaled.`,
    frames: [(g) => drawPetal(g, { r: FLOWER_DOT_REFERENCE, color: 0xffffff })],
  },
  {
    ...obstacle,
    key: 'flower.heart',
    purpose: `A flower's heart, ${FLOWER_DOT_REFERENCE} px in radius about its centre: white, tinted, and scaled.`,
    frames: [(g) => drawFlowerHeart(g, { r: FLOWER_DOT_REFERENCE, color: 0xffffff })],
  },
];

// A nut at the reference size, its top (where the stem joins) at the origin.
const nut = { x: 0, drop: 0, r: COCONUT_REFERENCE };
const coconuts = [
  {
    ...obstacle,
    key: 'coconut.frond',
    purpose: 'The frond a bunch of coconuts hangs from, under the branch; the stems spring from the origin.',
    frames: [(g) => drawCoconutFrond(g)],
  },
  ...linePieces({ ...obstacle, key: 'coconut.stem', width: 1.8, color: LINE_COLORS.coconutStem, purpose: 'The stem from the frond to a nut.' }),
  {
    ...obstacle,
    key: 'coconut.nut',
    purpose: `A coconut ${COCONUT_REFERENCE} px in radius, its top at the origin: brown, a highlight and three dark eyes; scaled to each nut.`,
    frames: [(g) => drawCoconut(g, nut)],
  },
  {
    ...obstacle,
    key: 'coconut.hair',
    purpose: 'A hair on a nut\'s outline, at its right (about the nut\'s centre, which is the origin); turned round the nut.',
    frames: [(g) => drawCoconutHair(g, { x: 0, drop: -COCONUT_REFERENCE, r: COCONUT_REFERENCE }, 0)],
  },
];

export const DECORATION_PIECES = [...perchedBirds, ...perchedSnake, ...hangingMonkey, ...hangingBats, ...owl, ...nest, ...flowers, ...coconuts];
