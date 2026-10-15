import { BAT_LOOK_NAMES, BIRD_LOOKS } from '../../art/pieces/decorations.js';
import { BAT_WING, BIRD_WING } from '../../art/pieces/moving.js';
import {
  BAT_LOOKS,
  CANOPY_Y,
  FLYING_BIRDS,
  flyingBatLook,
  flyingBatPose,
  flyingBirdPose,
  snakeClimbs,
  snakeStalkLeaves,
  spiderLegs,
} from '../../views/obstacles.js';
import { FLOOR_Y } from '../../views/backdrop.js';
import { Builder, cubicPoints } from './build.js';
import { paintedSnakePose } from './snakePose.js';

// The moving obstacles in the Phaser version (PHASER_PLAN.md, M5c), as the Pixi
// ObstacleViews draw them: a body that follows the obstacle (scaled with the hitbox),
// parts animated from its time, and scenery in world units: the spider's thread, the
// snake's stalk. Each returns { parts, body, animate(t) }.

function spider(b, o) {
  // The thread from the canopy down to the spider: a segment, stretched.
  const thread = b.image('spider.thread');
  const body = b.container();
  const legs = spiderLegs(0).map(({ shoulder, knee, foot }) => b.line('spider.leg', [shoulder, knee, foot]));
  body.add([...legs.flat(), b.image('spider.body')]);
  return {
    parts: [thread, body],
    body,
    animate(t, position) {
      b.setSegment(thread, 'spider.thread', [position.x, CANOPY_Y - 40], [position.x, position.y - 14 * o.scale]);
      spiderLegs(t).forEach(({ shoulder, knee, foot }, i) => {
        const [upper, lower, ...joints] = legs[i];
        b.setSegment(upper, 'spider.leg', shoulder, knee);
        b.setSegment(lower, 'spider.leg', knee, foot);
        [shoulder, knee, foot].forEach((p, k) => joints[k].setPosition(p[0], p[1]));
      });
    },
  };
}

function snake(b, o) {
  const top = o.baseY - o.motion.ay - 40;
  const bottom = FLOOR_Y + 20;
  const x = o.baseX;
  const stalk = [
    ...b.curve('snake.stalk', cubicPoints([[x, bottom], [x - 6, bottom - 120], [x + 6, top + 80], [x, top]])),
    ...snakeStalkLeaves(top, bottom).map((leaf) => b.image('snake.stalkLeaf', leaf.side > 0 ? 0 : 1).setPosition(x, leaf.y)),
  ];
  const body = b.container();
  if (b.art.catalog.presentation?.climbingSnake === 'articulated') {
    const neck = b.art.rope(b.scene, 'perchedSnake.neck');
    // The painted head is centred at (0, -18) in its unchanged source box.
    const face = b.image('snake.head').setY(18);
    const head = b.container();
    head.add(face);
    body.add([neck, b.image('snake.coil'), head]);
    const pose = paintedSnakePose(o, o.time);
    return {
      parts: [...stalk, body], body,
      animate(t) {
        paintedSnakePose(o, t, pose);
        b.art.bend(neck, 'perchedSnake.neck', pose.neck);
        head.setPosition(pose.head.x, pose.head.y).setRotation(pose.head.rotation);
      },
    };
  }
  const head = b.image('snake.head');
  body.add([b.image('snake.coil'), head]);
  const unit = b.art.unit('snake.head');
  return {
    parts: [...stalk, body],
    body,
    animate(t) {
      // Pointing up while climbing, down while going down.
      head.scaleY = unit * (snakeClimbs(o, t) ? 1 : -1);
    },
  };
}

function bird(b, o) {
  const look = BIRD_LOOKS[Object.keys(FLYING_BIRDS).indexOf(o.type)];
  const body = b.container();
  const wing = b.image(`bird.${look}.wing`);
  body.add([b.image(`bird.${look}.body`), wing]);
  return {
    parts: [body],
    body,
    animate(t) {
      const pose = flyingBirdPose(o, t);
      body.setScale(pose.facing * o.scale, o.scale);
      if (pose.rotation !== null) body.rotation = pose.rotation;
      b.art.setFrame(wing, `bird.${look}.wing`, BIRD_WING.frameFor(pose.lift));
    },
  };
}

function bat(b, o) {
  const name = BAT_LOOK_NAMES[BAT_LOOKS.indexOf(flyingBatLook(o.gap))];
  const body = b.container();
  const wing = b.image(`bat.${name}.wing`);
  body.add([wing, b.image(`bat.${name}.body`)]);
  return {
    parts: [body],
    body,
    animate(t) {
      const pose = flyingBatPose(o, t);
      body.setScale(pose.facing * o.scale, o.scale);
      if (pose.rotation !== null) body.rotation = pose.rotation;
      b.art.setFrame(wing, `bat.${name}.wing`, BAT_WING.frameFor(pose.lift));
    },
  };
}

export const MOVING_RIGS = { spider, snake, bird, blueBird: bird, purpleBird: bird, bat, circleBat: bat };

// A moving obstacle's view sampled at the pane's drawing time. Using o.x/o.y and
// o.time here repeated a simulation pose on display frames without a sim step.
export function buildMovingRig(scene, art, o) {
  const b = new Builder(scene, art);
  const { parts, body, animate } = MOVING_RIGS[o.type](b, o);
  const view = b.container();
  view.add(parts);
  body.setScale(o.scale);
  const update = (t = o.time) => {
    const position = o.positionAt(t);
    body.setPosition(position.x, position.y);
    animate(t, position);
  };
  update();
  return { view, body, update };
}
