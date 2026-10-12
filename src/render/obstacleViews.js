import { Container, Graphics } from 'pixi.js';
import { HIGH_BELOW_Y, OBSTACLE_HITBOXES } from '../config.js';
import { mixSeed, mulberry32 } from '../sim/rng.js';
import { FLOOR_Y } from './background.js';
import { ObstacleType } from '../sim/obstacle.js';
import { CANOPY_Y, LEAF, LEAF_DARK, vine, canopyY, trunk, trunkBottom, drawStem, HIVE_TRUNK, BRANCH_TRUNK_X, BRANCH_TRUNK_WIDTH, branchBarkLines, drawBranchBody, branchTop, perchedBird, PERCHED_BIRD, perchedBirdPose, drawPerchedBirdBody, drawPerchedBirdTail, drawPerchedBirdHead, perchedSnake, perchedSnakePose, drawSnakeTail, drawSnakeBand, drawSnakeMark, drawSnakeNeck, drawSnakeHead, drawSnakeTongue, hangingMonkey, hangingMonkeyPose, drawHangingMonkeyArms, drawHangingMonkeyBody, drawHangingMonkeyLeg, drawHangingMonkeyTail, drawHangingMonkeyEyes, nestPlacement, NEST_PARTS, drawNestBack, drawNestFront, drawNestTwig, drawNestRimTwig, drawNestRim, drawNestEgg, eggRock, drawNestShell, drawChick, chickPose, drawChickBeak, drawNestCap, drawNestLeaf, pantherPlacement, drawPantherBody, drawPantherEar, pantherSwish, pantherBlinks, drawPantherTail, drawPantherEyes, hangingBat, hangingBatPose, drawHangingBatBody, drawHangingBatEyes, drawHangingBatEar, flowerCluster, flowerSway, drawFlowerStem, drawFlowerLeaf, drawPetal, drawFlowerHeart, coconutBunch, coconutSway, drawCoconutFrond, drawCoconutStem, drawCoconutHair, drawCoconut, owlPlacement, OWL_HEAD, owlPose, drawOwlBody, drawOwlSkull, drawOwlDisc, drawOwlBeak, drawOwlEye, drawThornBush, drawRock, hiveTop, drawHiveArm, drawHiveNest, beeSwarm, beeAt, drawBeeWing, drawBee, TEMPLE_STYLES, MOSS, MOSS_LIGHT, drawTempleTier, templePanelRows, drawTemplePanels, TEMPLE_STAIRS, drawTempleStairs, drawTempleShrine, drawTempleFret, drawTempleComb, drawTempleSerpent, drawTempleTierFerns, drawTempleGold, TEMPLE_BRAZIERS, drawTempleBrazier, templeFlame, drawTempleFlame, drawTempleGlow, templeOvergrowth, drawTempleMoss, drawTempleVine, drawTempleHaze, templeFringe, drawTempleLeaf, BIRD_COLORS, BAT_LOOKS, drawSpiderBody, drawSpiderThread, spiderLegs, drawSpiderLegs, snakeClimbs, drawSnakeStalk, snakeStalkLeaves, drawSnakeStalkLeaf, drawSnakeCoil, drawClimbingSnakeHead, FLYING_BIRDS, drawFlyingBirdBody, drawFlyingBirdWing, flyingBirdPose, flyingBatLook, flyingBatPose, drawFlyingBatBody, drawFlyingBatWing, darknessOf } from '../views/obstacles.js';

// The parts both versions share (pure: no Pixi) are in views/obstacles.js.
export * from '../views/obstacles.js';

// Hitbox: rect 160 × 24 centred. A limb tapering from a cut trunk stub on the left,
// with a leaf tuft near the tip, and the decoration it carries, if any (see addDecoration).
// Returns the decoration's animation.
function drawBranch(g, o, rand, hangs, view) {
  const [box] = OBSTACLE_HITBOXES.branch;
  const left = box.dx;
  const right = box.dx + box.w;
  const top = box.dy;
  if (hangs) {
    vine(g, left + 30, canopyY(o), top + 2, 8);
    vine(g, right - 45, canopyY(o), top + 4, -8);
  } else {
    trunk(g, o, BRANCH_TRUNK_X, 0, BRANCH_TRUNK_WIDTH);
  }
  drawBranchBody(g, branchBarkLines(rand));
  return o.decoration ? addDecoration(view, o, hangs) : null;
}

// A small bird perched on top of the branch, in the colours of one of the flying birds
// picked at random: now and then it pecks at the bark, and its tail flicks. Faces left or
// right at random.
function drawPerchedBird(rand) {
  const bird = new Container();
  const { look, dir, x, phase } = perchedBird(rand);
  const colors = BIRD_COLORS[look];
  bird.scale.x = dir;
  bird.position.set(x, branchTop(0));
  const body = drawPerchedBirdBody(new Graphics(), colors);
  const tail = drawPerchedBirdTail(new Graphics(), colors);
  tail.position.set(PERCHED_BIRD.tail.x, PERCHED_BIRD.tail.y);
  const head = drawPerchedBirdHead(new Graphics(), colors);
  head.position.set(PERCHED_BIRD.head.x, PERCHED_BIRD.head.y);
  bird.addChild(tail, body, head);
  const animate = (t) => {
    const pose = perchedBirdPose(t, phase);
    head.rotation = pose.head;
    head.y = pose.headY;
    tail.rotation = pose.tail;
  };
  return { part: bird, animate };
}

function drawPerchedSnake(rand, { hangs = false } = {}) {
  const snake = new Container();
  const coil = perchedSnake(rand, hangs);
  snake.scale.x = coil.dir;
  snake.position.set(coil.x, coil.y);
  const g = new Graphics();
  const neck = new Graphics();
  const head = new Graphics();
  snake.addChild(g, neck, head);
  drawSnakeTail(g, coil.tailRoot, coil.pole);
  for (const [k, band] of coil.bands.entries()) {
    drawSnakeBand(g, band);
    // Darker scale marks across the band, and a lighter edge where it turns the corner.
    const mid = [(band.from[0] + band.to[0]) / 2 + (coil.pole ? 0 : 0.5), (band.from[1] + band.to[1]) / 2];
    drawSnakeMark(g, mid, 2);
    drawSnakeMark(g, k % 2 ? band.from : band.to, 1.6);
  }
  const animate = (t) => {
    const pose = perchedSnakePose(coil, t);
    drawSnakeNeck(neck.clear(), pose.neck);
    head.position.set(pose.head.x, pose.head.y);
    head.rotation = pose.head.rotation;
    drawSnakeHead(head.clear());
    if (pose.tongue) drawSnakeTongue(head);
  };
  return { part: snake, animate };
}

// A grey monkey hanging from the underside of the branch by its hands, swaying like a
// pendulum, its legs swinging and its tail curling; now and then it blinks. Mirrored at
// random, so its tail curls out to the left or right.
function drawHangingMonkey(rand) {
  const monkey = new Container();
  const [box] = OBSTACLE_HITBOXES.branch;
  const { x, dir, phase } = hangingMonkey(rand);
  monkey.position.set(x, box.dy + box.h - 1);
  monkey.scale.x = dir;
  // Everything hangs from the hands at (0, 0): the pendulum swings about that point.
  const swing = new Container();
  monkey.addChild(swing);
  const arms = drawHangingMonkeyArms(new Graphics());
  const tail = new Graphics();
  const legs = new Graphics();
  const body = drawHangingMonkeyBody(new Graphics());
  const eyes = new Graphics();
  swing.addChild(tail, legs, body, arms, eyes);
  const animate = (t) => {
    const pose = hangingMonkeyPose(t, phase);
    swing.rotation = pose.swing;
    legs.clear();
    for (const leg of pose.legs) drawHangingMonkeyLeg(legs, leg.from, leg.to);
    drawHangingMonkeyTail(tail.clear(), pose.curl);
    drawHangingMonkeyEyes(eyes.clear(), pose.blink);
  };
  return { part: monkey, animate };
}

// A woven nest of twigs on top of the branch, empty, with an egg in it, or with a hatched
// egg: a chick peeping from its cracked shell. Which, and which way it faces, is random.
// Returns the state too.
function drawNest(rand) {
  const nest = new Container();
  const { dir, x: cx, state, phase, twigs, rimTwigs } = nestPlacement(rand);
  nest.scale.x = dir;
  nest.position.set(cx, branchTop(cx));

  // The back of the bowl and its dark inside, the contents, then the front wall, so the
  // contents sit in the nest.
  const back = drawNestBack(new Graphics());
  const contents = new Container();
  const front = drawNestFront(new Graphics());
  // Twigs woven across the front, and a few stuck out of the rim (behind the contents).
  for (const twig of twigs) drawNestTwig(front, twig);
  for (const twig of rimTwigs) drawNestRimTwig(back, twig);
  drawNestRim(front);
  nest.addChild(back, contents, front);

  let animate = () => {};
  if (state === 'egg') {
    const egg = drawNestEgg(new Graphics());
    egg.position.set(NEST_PARTS.egg.x, NEST_PARTS.egg.y);
    contents.addChild(egg);
    animate = (t) => {
      egg.rotation = eggRock(t, phase);
    };
  } else if (state === 'hatched') {
    const shell = drawNestShell(new Graphics());
    shell.position.set(NEST_PARTS.shell.x, NEST_PARTS.shell.y);
    const chick = new Container();
    const body = drawChick(new Graphics());
    const beak = new Graphics();
    chick.addChild(body, beak);
    chick.position.set(NEST_PARTS.chick.x, NEST_PARTS.chick.y);
    const cap = drawNestCap(new Graphics());
    cap.position.set(NEST_PARTS.cap.x, NEST_PARTS.cap.y);
    cap.rotation = NEST_PARTS.cap.rotation;
    contents.addChild(shell, chick, cap);
    animate = (t) => {
      const pose = chickPose(t, phase);
      chick.y = pose.y;
      chick.rotation = pose.rotation;
      drawChickBeak(beak.clear(), pose.open);
    };
  } else {
    contents.addChild(drawNestLeaf(new Graphics()));
  }
  return { part: nest, animate, state };
}

// A black panther lying along the top of the branch with its head up, watching: its
// flanks rise and fall as it breathes, its tail hangs down off the end and swishes, its
// ears twitch now and then and it blinks. Faces left or right at random.
function drawPanther(rand) {
  const panther = new Container();
  const { facing, cx, phase } = pantherPlacement(rand);
  panther.scale.x = facing;
  panther.position.set(cx, branchTop(cx));

  const tail = new Graphics();
  const body = new Container();
  const g = new Graphics();
  drawPantherBody(g);
  const eye = new Graphics();
  const ear = new Graphics();
  drawPantherEar(ear);
  ear.position.set(35.5, -22);
  body.addChild(g, ear, eye);
  panther.addChild(tail, body);

  const animate = (t) => {
    // Breathing: the body swells and settles.
    body.scale.y = 1 + 0.03 * Math.sin(t * 1.7 + phase);
    drawPantherTail(tail.clear(), pantherSwish(t, phase));
    drawPantherEyes(eye.clear(), pantherBlinks(t, phase));
    // One ear flicks now and then.
    ear.scale.y = 1 - 0.55 * Math.max(0, Math.sin(t * 1.3 + phase * 2)) ** 14;
  };
  return { part: panther, animate };
}

// A bat roosting upside down from the underside of the branch, wrapped in its wings like a
// cloak: it sways a little, its ears twitch and it opens a red eye now and then. For the
// night.
function drawHangingBat(rand) {
  const bat = new Container();
  const [box] = OBSTACLE_HITBOXES.branch;
  const { x, dir, phase, look } = hangingBat(rand);
  bat.position.set(x, box.dy + box.h - 1);
  bat.scale.x = dir;
  // Everything hangs from the feet at (0, 0).
  const swing = new Container();
  bat.addChild(swing);
  const g = drawHangingBatBody(new Graphics(), look);
  const eyes = new Graphics();
  const ears = new Graphics();
  swing.addChild(g, ears, eyes);
  const animate = (t) => {
    const pose = hangingBatPose(t, phase);
    swing.rotation = pose.swing;
    drawHangingBatEyes(eyes.clear(), look, pose.open);
    drawHangingBatEar(ears.clear(), look, pose.twitch);
  };
  return { part: bat, animate };
}

// A small cluster of three to five flowers growing from the top of the branch, each on a
// stem with a leaf or two and each in a colour of its own: red, pink, yellow, purple,
// white, orange or blue. They sway in the breeze, each out of step with the others.
// Returns the colours too.
function drawFlowers(rand) {
  const flowers = new Container();
  const { dir, x: cx, plants } = flowerCluster(rand);
  flowers.scale.x = dir;
  flowers.position.set(cx, branchTop(cx));
  const stems = [];
  for (const p of plants) {
    const plant = new Container();
    plant.position.set(p.x, 1);
    const g = new Graphics();
    // A stem, a leaf or two, and the head: five or six petals round a heart.
    drawFlowerStem(g, p.height);
    drawFlowerLeaf(g, p.leaf);
    if (p.leaf2) drawFlowerLeaf(g, p.leaf2);
    for (const petal of p.petals) drawPetal(g, petal);
    drawFlowerHeart(g, p.heart);
    plant.addChild(g);
    flowers.addChild(plant);
    stems.push({ plant, phase: p.phase, speed: p.speed });
  }
  const animate = (t) => {
    for (const s of stems) s.plant.rotation = flowerSway(t, s);
  };
  return { part: flowers, animate, colors: plants.map((p) => p.color) };
}

// A bunch of two or three coconuts hanging from the underside of the branch on short
// stems, under a small green frond: brown and hairy, each with the three dark "eyes" at
// the top. They sway a little, each out of step with the others.
function drawCoconuts(rand) {
  const bunch = new Container();
  const [box] = OBSTACLE_HITBOXES.branch;
  const { x: cx, dir, nuts } = coconutBunch(rand);
  bunch.position.set(cx, box.dy + box.h - 1);
  bunch.scale.x = dir;
  // The frond the stems spring from, tucked against the limb.
  bunch.addChild(drawCoconutFrond(new Graphics()));
  const swaying = [];
  for (const n of nuts) {
    const nut = new Container();
    nut.position.set(n.x * 0.4, 1);
    const g = new Graphics();
    // The stem, then the nut with a few hairs on its outline, a highlight and the eyes.
    drawCoconutStem(g, n);
    for (const a of n.hairs) drawCoconutHair(g, n, a);
    drawCoconut(g, n);
    nut.addChild(g);
    bunch.addChild(nut);
    swaying.push({ nut, phase: n.phase, speed: n.speed });
  }
  const animate = (t) => {
    for (const n of swaying) n.nut.rotation = coconutSway(t, n);
  };
  return { part: bunch, animate, count: nuts.length };
}

// An owl perched on top of the branch, round and brown with ear tufts and a pale
// chevroned belly. Its face turns slowly from side to side, its big yellow eyes close for
// a moment now and then, and it puffs a little as it breathes. For the night.
function drawOwl(rand) {
  const owl = new Container();
  const { dir, x, phase } = owlPlacement(rand);
  owl.scale.x = dir;
  owl.position.set(x, branchTop(x));

  const body = drawOwlBody(new Graphics());
  const head = new Container();
  head.position.set(OWL_HEAD.x, OWL_HEAD.y);
  const skull = drawOwlSkull(new Graphics());
  const face = new Container();
  const disc = drawOwlDisc(new Graphics());
  const eyes = new Graphics();
  const beak = drawOwlBeak(new Graphics());
  face.addChild(disc, eyes, beak);
  head.addChild(skull, face);
  owl.addChild(body, head);

  const animate = (t) => {
    const pose = owlPose(t, phase);
    body.scale.y = pose.breath;
    face.x = pose.faceX;
    head.rotation = pose.head;
    eyes.clear();
    for (const side of [-1, 1]) drawOwlEye(eyes, side * 4.6, pose.blink, pose.turn);
  };
  return { part: owl, animate };
}

export const DECORATIONS = {
  bird: drawPerchedBird,
  snake: drawPerchedSnake,
  monkey: drawHangingMonkey,
  nest: drawNest,
  panther: drawPanther,
  hangingBat: drawHangingBat,
  owl: drawOwl,
  flowers: drawFlowers,
  coconuts: drawCoconuts,
};

// Adds the decoration the branch carries to `view`; returns its animation.
function addDecoration(view, o, hangs) {
  const { part, animate } = DECORATIONS[o.decoration](mulberry32(mixSeed(0xa11a, o.gap)), { hangs });
  view.addChild(part);
  return animate;
}

// Hitbox: three stacked circles. A teardrop paper nest in gold bands with a dark
// entrance at the bottom, hanging from a vine, or from an arm off a trunk when it is low;
// bees buzz around it (scenery: only the nest is the hitbox). Returns the bees'
// animation.
function drawBeehive(g, o, rand, hangs, view) {
  const top = hiveTop();
  if (hangs) {
    vine(g, 0, canopyY(o), top + 2, 7);
  } else {
    // A trunk beside it with an arm over it, and the nest on a rope from the arm.
    const armY = top - 12;
    drawStem(g, HIVE_TRUNK.x, armY - 6, trunkBottom(o), HIVE_TRUNK.halfTop, HIVE_TRUNK.halfBottom);
    drawHiveArm(g);
  }
  drawHiveNest(g);

  const bees = new Graphics();
  view.addChild(bees);
  const swarm = beeSwarm(rand);
  return (t) => {
    bees.clear();
    for (const bee of swarm) {
      const { x, y, wing } = beeAt(bee, t);
      // A round yellow body with a dark stripe and two wings that beat.
      drawBeeWing(bees, x - 2.5, y - 3, wing);
      drawBeeWing(bees, x + 2.5, y - 3, wing);
      drawBee(bees, x, y);
    }
  };
}

function drawTemple(g, o, rand, hangs, view) {
  const style = TEMPLE_STYLES[o.variant ?? 0];
  const [shrine, tierA, tierB, tierC, base] = OBSTACLE_HITBOXES.temple;
  const floor = (FLOOR_Y + 20 - o.y) / o.scale;

  // The tiers, from the base up, then the base's rows of panels, the stairs and the shrine.
  drawTempleTier(g, style, base, floor);
  for (const r of [tierC, tierB, tierA]) drawTempleTier(g, style, r);
  for (const y of templePanelRows(floor)) drawTemplePanels(g, style, y);
  drawTempleStairs(g, style, TEMPLE_STAIRS.y, floor);
  drawTempleShrine(g, style, o.variant ?? 0);

  let animate = null;
  if (o.variant === 0) drawTempleFret(g, style);
  else if (o.variant === 1) drawTempleComb(g, style);
  else if (o.variant === 2) {
    for (const side of [-1, 1]) drawTempleSerpent(g, style, side);
    for (const r of [tierA, tierB, tierC]) drawTempleTierFerns(g, r, [MOSS, MOSS_LIGHT], 22, 7, 10, 5, [-1.1, -2.0]);
  } else {
    drawTempleGold(g);
    for (const x of TEMPLE_BRAZIERS) drawTempleBrazier(g, style, x);
    // The fire is not tinted with the stone (see ObstacleViews.update): it stays bright in the
    // dark stages and, there, lights up the stone round each brazier with a warm glow
    // (added to what is behind it), flickering with the flame.
    const fire = new Container();
    fire.untinted = true;
    const glow = new Graphics();
    glow.blendMode = 'add';
    const flames = new Graphics();
    fire.addChild(glow, flames);
    view.addChild(fire);
    const phase = rand() * 6.3;
    animate = (t) => {
      flames.clear();
      glow.clear();
      const dark = view.darkness ?? 0;
      TEMPLE_BRAZIERS.forEach((x, i) => {
        const flame = templeFlame(t, phase, i);
        if (dark > 0) drawTempleGlow(glow, x, dark * flame.flicker, flame.reach);
        drawTempleFlame(flames, x, flame);
      });
    };
  }

  // Overgrowth, on every look: moss along the tiers, vines hanging from their edges, ferns
  // on the corners.
  const overgrowth = templeOvergrowth(rand);
  for (const [k, r] of [tierA, tierB, tierC].entries()) {
    for (const moss of overgrowth[k]) {
      drawTempleMoss(g, moss, o.variant === 2 ? 1 : 0.8);
      if (moss.vine) drawTempleVine(g, moss.vine);
    }
    drawTempleTierFerns(g, r, [LEAF_DARK, LEAF], 26, 8, 4, 6, [-0.9, -2.2]);
  }

  // The rest is buried: a haze rising from the ground, thickest at the bottom, and a thick
  // fringe of ferns and leaves across the foot of the temple, wider than the temple itself,
  // as if it carried on down into the jungle.
  drawTempleHaze(g, floor);
  for (const leaf of templeFringe(rand)) drawTempleLeaf(g, { ...leaf, y: floor + 14 });
  return animate;
}

const DRAW = { branch: drawBranch, thornBush: drawThornBush, rock: drawRock, beehive: drawBeehive, temple: drawTemple };

// Hitbox: circle r 18. Abdomen and head; the legs are redrawn as they wriggle.
function buildSpider(o) {
  const thread = new Graphics();
  const body = new Container();
  const legs = new Graphics();
  const g = new Graphics();
  drawSpiderBody(g);
  body.addChild(legs, g);
  const animate = (t) => {
    drawSpiderThread(thread.clear(), o.x, CANOPY_Y - 40, o.y - 14 * o.scale);
    drawSpiderLegs(legs.clear(), spiderLegs(t));
  };
  return { parts: [thread, body], body, animate };
}

// Hitbox: circle r 18. Coils around a stalk standing from the floor; the head points
// the way it is climbing.
function buildSnake(o) {
  const top = o.baseY - o.motion.ay - 40;
  const stalk = new Graphics();
  const bottom = FLOOR_Y + 20;
  drawSnakeStalk(stalk, o.baseX, top, bottom);
  for (const leaf of snakeStalkLeaves(top, bottom)) drawSnakeStalkLeaf(stalk, o.baseX, leaf);
  const body = new Container();
  const coil = new Graphics();
  drawSnakeCoil(coil);
  const head = new Graphics();
  drawClimbingSnakeHead(head);
  body.addChild(coil, head);
  const animate = (t) => {
    head.scale.y = snakeClimbs(o, t) ? 1 : -1;
  };
  return { parts: [stalk, body], body, animate };
}

// Hitbox: circle r 16. A bird, flapping as it flies (see FLYING_BIRDS and flyingBirdPose):
// red, patrolling; blue, with a pale belly and a small crest, flying up and down; purple,
// with a pale belly and a tail feather, flying in circles.
function buildBird(o) {
  const kind = FLYING_BIRDS[o.type];
  const body = new Container();
  const g = new Graphics();
  drawFlyingBirdBody(g, kind);
  const wing = new Graphics();
  body.addChild(g, wing);
  const animate = (t) => {
    const pose = flyingBirdPose(o, t);
    body.scale.set(pose.facing * o.scale, o.scale);
    if (pose.rotation !== null) body.rotation = pose.rotation;
    drawFlyingBirdWing(wing.clear(), kind, pose.lift);
  };
  return { parts: [body], body, animate };
}

// Hitbox: circle r 16. A bat: a furry body with pointed ears and glowing eyes, and a
// membrane wing that flutters fast, in one of BAT_LOOKS by gap. It faces the way it flies,
// like the bird; the one that flies in circles (the purple bird's night replacement)
// also pitches its nose along the circle.
function buildBat(o) {
  const look = flyingBatLook(o.gap);
  const body = new Container();
  const g = new Graphics();
  drawFlyingBatBody(g, look);
  const wing = new Graphics();
  body.addChild(wing, g);
  const animate = (t) => {
    const pose = flyingBatPose(o, t);
    body.scale.set(pose.facing * o.scale, o.scale);
    if (pose.rotation !== null) body.rotation = pose.rotation;
    drawFlyingBatWing(wing.clear(), look, pose.lift);
  };
  return { parts: [body], body, animate };
}

const BUILD_MOVING = { spider: buildSpider, snake: buildSnake, bird: buildBird, bat: buildBat, circleBat: buildBat, blueBird: buildBird, purpleBird: buildBird };

// A view: `view` to add to the layer, and `update()` each frame.
function buildObstacle(o) {
  if (o.moving) {
    const { parts, body, animate } = BUILD_MOVING[o.type](o);
    const view = new Container();
    view.addChild(...parts);
    body.scale.set(o.scale);
    const update = () => {
      body.position.set(o.x, o.y);
      animate(o.time);
    };
    update();
    return { view, update };
  }
  // The art is drawn at scale 1 (supports reaching the canopy or floor are divided by
  // the scale), then scaled with the hitbox. A drawing may return an animation: a
  // function of the world time for the parts it added to `view`.
  const view = new Container();
  const g = new Graphics();
  view.addChild(g);
  const animate = DRAW[o.type](g, o, mulberry32(mixSeed(0x0b57, o.gap)), o.y < HIGH_BELOW_Y, view);
  view.position.set(o.x, o.y);
  view.scale.set(o.scale);
  if (!animate) return { view, update: null };
  animate(0);
  return { view, update: (time) => animate(time) };
}

export class ObstacleViews {
  constructor() {
    this.view = new Container();
    this.views = new Map();
  }

  // `time` is the world time (s), for the scenery that moves on its own (the bees).
  // `tint` is the background's, which the temple's stone and ferns take too: they would
  // otherwise stay as bright as by day in the dark stages. Its fires keep their light.
  update(obstacles, time = 0, tint = 0xffffff) {
    const seen = new Set();
    const dark = darknessOf(tint);
    for (const o of obstacles) {
      if (!o) continue;
      seen.add(o);
      let entry = this.views.get(o);
      if (!entry) {
        entry = buildObstacle(o);
        this.views.set(o, entry);
        this.view.addChild(entry.view);
      }
      if (o.type === ObstacleType.TEMPLE) {
        entry.view.darkness = dark;
        // The stone and the greenery take the tint, but not the fire.
        for (const child of entry.view.children) child.tint = child.untinted ? 0xffffff : tint;
      }
      entry.update?.(time);
    }
    for (const [o, entry] of this.views) {
      if (seen.has(o)) continue;
      entry.view.destroy({ children: true });
      this.views.delete(o);
    }
  }
}
