import { OBSTACLE_HITBOXES } from '../../config.js';
import {
  BAT_LOOKS,
  FLYING_BIRDS,
  LINE_COLORS,
  SNAKE_STALK_WIDTH,
  SPIDER_LEG_WIDTH,
  SPIDER_THREAD_WIDTH,
  drawClimbingSnakeHead,
  drawFlyingBatBody,
  drawFlyingBatWing,
  drawFlyingBirdBody,
  drawFlyingBirdWing,
  drawSnakeCoil,
  drawSnakeStalkLeaf,
  drawSpiderBody,
} from '../../render/obstacleViews.js';
import { OBSTACLE_SCALE } from './branch.js';
import { BAT_LOOK_NAMES, BIRD_LOOKS, flipbook } from './decorations.js';
import { linePieces } from './lines.js';

// The moving obstacles: a body that follows the obstacle and parts animated from its time,
// plus the thread a spider hangs from and the stalk a snake climbs.
const obstacle = { scale: OBSTACLE_SCALE };

// Wings beat from all the way down (lift -1) to all the way up (1), in flipbooks.
export const BIRD_WING = flipbook(33, -1, 1);
export const BAT_WING = flipbook(41, -1, 1);

const BIRD_TYPES = ['bird', 'blueBird', 'purpleBird']; // the red, blue and purple birds

export const MOVING_PIECES = [
  {
    ...obstacle,
    key: 'spider.body',
    purpose: 'The spider: abdomen, head, a red mark and four eyes. Its origin is the hitbox centre.',
    hitbox: OBSTACLE_HITBOXES.spider,
    frames: [(g) => drawSpiderBody(g)],
  },
  ...linePieces({ ...obstacle, key: 'spider.leg', width: SPIDER_LEG_WIDTH, color: LINE_COLORS.spiderLeg, purpose: "A spider's leg, from the body out to the knee or from the knee down to the foot." }),
  ...linePieces({
    ...obstacle,
    key: 'spider.thread',
    joints: false,
    width: SPIDER_THREAD_WIDTH,
    color: LINE_COLORS.thread,
    alpha: 0.8,
    purpose: 'The thread from the canopy down to the spider.',
  }),
  ...linePieces({ ...obstacle, key: 'snake.stalk', curve: true, width: SNAKE_STALK_WIDTH, color: LINE_COLORS.stalk, purpose: 'The stalk a snake climbs, from the floor up to the top of its climb.' }),
  {
    ...obstacle,
    key: 'snake.stalkLeaf',
    purpose: 'A leaf on the stalk, from its base on the stalk (the origin): pointing up and right (frame 0) and up and left (frame 1).',
    frames: [(g) => drawSnakeStalkLeaf(g, 0, { y: 0, side: 1 }), (g) => drawSnakeStalkLeaf(g, 0, { y: 0, side: -1 })],
  },
  {
    ...obstacle,
    key: 'snake.coil',
    purpose: 'The climbing snake\'s coils round the stalk. Its origin is the hitbox centre.',
    hitbox: OBSTACLE_HITBOXES.snake,
    frames: [(g) => drawSnakeCoil(g)],
  },
  {
    ...obstacle,
    key: 'snake.head',
    purpose: 'Its neck and head, pointing up (in the coil\'s coordinates); flipped to point down.',
    frames: [(g) => drawClimbingSnakeHead(g)],
  },
  ...BIRD_TYPES.flatMap((type, i) => [
    {
      ...obstacle,
      key: `bird.${BIRD_LOOKS[i]}.body`,
      purpose: `The ${BIRD_LOOKS[i]} bird, facing +x: tail, body, belly${FLYING_BIRDS[type].crest ? ', crest' : ''}, head, beak and eye. Its origin is the hitbox centre.`,
      hitbox: OBSTACLE_HITBOXES[type],
      frames: [(g) => drawFlyingBirdBody(g, FLYING_BIRDS[type])],
    },
    {
      ...obstacle,
      key: `bird.${BIRD_LOOKS[i]}.wing`,
      purpose: `The ${BIRD_LOOKS[i]} bird's wing (in the body's coordinates), in ${BIRD_WING.frames} frames from all the way down to all the way up.`,
      frames: Array.from({ length: BIRD_WING.frames }, (_, f) => (g) => drawFlyingBirdWing(g, FLYING_BIRDS[type], BIRD_WING.valueOf(f))),
    },
  ]),
  ...BAT_LOOK_NAMES.flatMap((name, i) => [
    {
      ...obstacle,
      key: `bat.${name}.body`,
      purpose: `A ${name} bat flying, facing +x: body, ears, eye and feet. Its origin is the hitbox centre.`,
      hitbox: OBSTACLE_HITBOXES.bat,
      frames: [(g) => drawFlyingBatBody(g, BAT_LOOKS[i])],
    },
    {
      ...obstacle,
      key: `bat.${name}.wing`,
      purpose: `The ${name} bat's wing (in the body's coordinates, behind it), in ${BAT_WING.frames} frames from all the way down to all the way up.`,
      frames: Array.from({ length: BAT_WING.frames }, (_, f) => (g) => drawFlyingBatWing(g, BAT_LOOKS[i], BAT_WING.valueOf(f))),
    },
  ]),
];
