import { OBSTACLE_HITBOXES } from '../../config.js';
import { tailFrameFor } from '../../art/pieces/branch.js';
import {
  BAT_EAR,
  BAT_LOOK_NAMES,
  BIRD_LOOKS,
  CHICK_BEAK,
  COCONUT_REFERENCE,
  FLOWER_DOT_REFERENCE,
  FLOWER_LEAF_REFERENCE,
  FLOWER_STEM_REFERENCE,
  MONKEY_TAIL,
  SNAKE_LIMB_REFERENCE,
  SNAKE_MARK_REFERENCE,
} from '../../art/pieces/decorations.js';
import {
  BAT_LOOKS,
  LINE_COLORS,
  NEST_PARTS,
  OWL_HEAD,
  PERCHED_BIRD,
  branchTop,
  chickPose,
  coconutBunch,
  coconutSway,
  eggRock,
  flowerCluster,
  flowerSway,
  hangingBat,
  hangingBatPose,
  hangingMonkey,
  hangingMonkeyPose,
  nestPlacement,
  owlPlacement,
  owlPose,
  pantherBlinks,
  pantherPlacement,
  pantherSwish,
  perchedBird,
  perchedBirdPose,
  perchedSnake,
  perchedSnakePose,
} from '../../views/obstacles.js';
import { quadraticPoints } from './build.js';
import { LEG } from '../../views/monkey.js';

// The decorations a branch carries, in the Phaser version (as the Pixi DECORATIONS): each
// builds its part from pieces (`b`, a Builder) and the decoration's random stream, and
// returns { part, animate(t) }, as the Pixi ones do.

const under = () => {
  const [box] = OBSTACLE_HITBOXES.branch;
  return box.dy + box.h - 1;
};

function bird(b, rand) {
  const { look, dir, x, phase } = perchedBird(rand);
  const key = (part) => `perchedBird.${BIRD_LOOKS[look]}.${part}`;
  const part = b.container(x, branchTop(0)).setScale(dir, 1);
  const tail = b.image(key('tail')).setPosition(PERCHED_BIRD.tail.x, PERCHED_BIRD.tail.y);
  const head = b.image(key('head')).setPosition(PERCHED_BIRD.head.x, PERCHED_BIRD.head.y);
  part.add([tail, b.image(key('body')), head]);
  return {
    part,
    animate(t) {
      const pose = perchedBirdPose(t, phase);
      head.setRotation(pose.head).setY(pose.headY);
      tail.setRotation(pose.tail);
    },
  };
}

function snake(b, rand, { hangs = false } = {}) {
  const coil = perchedSnake(rand, hangs);
  const limbThickness = b.art.catalog.presentation?.snakeLimbThickness;
  if (!coil.pole && limbThickness !== undefined) {
    // Keep the wrap tight to this pack's painted wood. Updating the existing
    // endpoints also moves tailRoot, which shares the first band's endpoint.
    coil.thick = limbThickness;
    for (const band of coil.bands) {
      band.to[1] = limbThickness + 1;
      band.bulge[1] = limbThickness / 2;
    }
  }
  const part = b.container(coil.x, coil.y).setScale(coil.dir, 1);
  const art = b.art;
  const pieces = [b.image('perchedSnake.tail', coil.pole ? 0 : 1).setPosition(...coil.tailRoot)];
  const mark = (at, r) => b.image('perchedSnake.mark').setPosition(...at).setScale((art.unit('perchedSnake.mark') * r) / SNAKE_MARK_REFERENCE);
  for (const [k, band] of coil.bands.entries()) {
    // The band's piece starts at its top: the trunk's runs across, the limb's down, and is
    // stretched to the limb's thickness.
    const image = b.image('perchedSnake.band', coil.pole ? 0 : 1);
    if (coil.pole) image.setPosition(0, band.from[1]);
    else {
      image.setPosition(band.from[0] + 4, band.from[1]);
      image.scaleY = (art.unit('perchedSnake.band') * (band.to[1] - band.from[1])) / (SNAKE_LIMB_REFERENCE + 2);
    }
    const mid = [(band.from[0] + band.to[0]) / 2 + (coil.pole ? 0 : 0.5), (band.from[1] + band.to[1]) / 2];
    pieces.push(image);
    if (!art.catalog.presentation?.perchedSnakePaintedSkin) pieces.push(mark(mid, 2), mark(k % 2 ? band.from : band.to, 1.6));
  }
  const neck = b.container();
  const head = b.container();
  const tongue = b.image('perchedSnake.tongue');
  head.add([b.image('perchedSnake.head'), tongue]);
  const neckSocket = art.catalog.presentation?.perchedSnakeNeckSocket;
  // Painted coils cover the neck's root; the head covers its registered end.
  part.add(neckSocket ? [neck, ...pieces, head] : [...pieces, neck, head]);
  return {
    part,
    // The tail is the lowest part through the full head-sway cycle. Keep pole
    // foliage and stubs beneath this conservative envelope, including limb wraps.
    poleClearance: coil.y + Math.max(...coil.bands.map(band => band.to[1])) + 20,
    animate(t) {
      const pose = perchedSnakePose(coil, t);
      if (neckSocket) {
        const [x, y] = neckSocket, { rotation, x: hx, y: hy } = pose.head;
        pose.neck.to = [hx + x * Math.cos(rotation) - y * Math.sin(rotation), hy + x * Math.sin(rotation) + y * Math.cos(rotation)];
      }
      neck.removeAll(true);
      neck.add(b.curve('perchedSnake.neck', quadraticPoints([pose.neck.from, pose.neck.control, pose.neck.to]), !neckSocket));
      head.setPosition(pose.head.x, pose.head.y).setRotation(pose.head.rotation);
      tongue.visible = pose.tongue;
    },
  };
}

function monkey(b, rand) {
  const { x, dir, phase } = hangingMonkey(rand);
  const part = b.container(x, b.art.catalog.presentation?.monkeyRootY ?? under()).setScale(dir, 1);
  // Everything hangs from the hands at (0, 0): the pendulum swings about that point.
  const swing = b.container();
  const tail = b.image('hangingMonkey.tail');
  const legTint = b.art.catalog.presentation?.hangingMonkeyLegTint;
  const painted = legTint !== undefined;
  const legs = [0, 1].map(i => {
    if (!painted) return b.line('hangingMonkey.leg', [[0, 0], [0, 1]]);
    const leg = b.image('monkey.p1.leg').setTint(legTint);
    if (i === 1 && b.art.catalog.presentation.monkeyMirrorFrontLeg) leg.scaleX *= -1;
    return leg;
  });
  const eyes = b.image('hangingMonkey.eyes');
  const body = b.image('hangingMonkey.body'), arms = b.image('hangingMonkey.arms');
  swing.add([tail, ...legs.flat(), ...(painted ? [arms, body] : [body, arms]), eyes]);
  part.add(swing);
  return {
    part, behindBranch: painted,
    animate(t) {
      const pose = hangingMonkeyPose(t, phase);
      swing.rotation = pose.swing;
      pose.legs.forEach(({ from, to }, i) => {
        if (painted) {
          const leg = legs[i];
          const hip = b.art.catalog.presentation.hangingMonkeyHips?.[i] ?? from;
          const dx = to[0] - from[0], dy = to[1] - from[1];
          leg.setPosition(...hip).setRotation(Math.atan2(-dx, dy));
          leg.scaleY = b.art.unit('monkey.p1.leg') * Math.hypot(dx, dy) / LEG.length;
          return;
        }
        const [segment, start, end] = legs[i];
        b.setSegment(segment, 'hangingMonkey.leg', from, to);
        start.setPosition(...from);
        end.setPosition(...to);
      });
      b.art.setFrame(tail, 'hangingMonkey.tail', MONKEY_TAIL.frameFor(pose.curl));
      b.art.setFrame(eyes, 'hangingMonkey.eyes', pose.blink ? 1 : 0);
    },
  };
}

function nest(b, rand) {
  const { dir, x: cx, state, phase, twigs, rimTwigs } = nestPlacement(rand);
  const part = b.container(cx, branchTop(cx)).setScale(dir, 1);
  // The back of the bowl with the twigs out of its rim, the contents, then the front wall
  // with its twigs and rim, so the contents sit in the nest.
  const back = [b.image('nest.back'), ...rimTwigs.flatMap(({ x, lean, rise }) => b.line('nest.rimTwig', [[x, -8], [x + lean, rise]]))];
  const front = [
    b.image('nest.front'),
    ...twigs.flatMap(({ x, y, len, tilt, light }) => b.line(light ? 'nest.lightTwig' : 'nest.twig', [[x - len / 2, y - tilt * len], [x + len / 2, y + tilt * len]])),
    b.image('nest.rim'),
  ];
  const contents = b.container();
  let animate = () => {};
  if (state === 'egg') {
    const egg = b.image('nest.egg').setPosition(NEST_PARTS.egg.x, NEST_PARTS.egg.y);
    contents.add(egg);
    animate = (t) => egg.setRotation(eggRock(t, phase));
  } else if (state === 'hatched') {
    const chick = b.container(NEST_PARTS.chick.x, NEST_PARTS.chick.y);
    const beak = b.image('nest.chickBeak');
    chick.add([b.image('nest.chick'), beak]);
    const cap = b.image('nest.cap').setPosition(NEST_PARTS.cap.x, NEST_PARTS.cap.y).setRotation(NEST_PARTS.cap.rotation);
    contents.add([b.image('nest.shell').setPosition(NEST_PARTS.shell.x, NEST_PARTS.shell.y), chick, cap]);
    animate = (t) => {
      const pose = chickPose(t, phase);
      chick.setY(pose.y).setRotation(pose.rotation);
      b.art.setFrame(beak, 'nest.chickBeak', CHICK_BEAK.frameFor(pose.open));
    };
  } else {
    contents.add(b.image('nest.leaf'));
  }
  part.add([...back, contents, ...front]);
  return { part, animate };
}

function panther(b, rand) {
  const { facing, cx, phase } = pantherPlacement(rand);
  const part = b.container(cx, branchTop(cx) + (b.art.catalog.presentation?.pantherSeatY ?? 0)).setScale(facing, 1);
  const tail = b.image('panther.tail');
  const body = b.container();
  const ear = b.image('panther.ear').setPosition(35.5, -22);
  const eyes = b.image('panther.eyes');
  body.add([b.image('panther.body'), ear, eyes]);
  part.add([tail, body]);
  const earUnit = b.art.unit('panther.ear');
  return {
    part,
    animate(t) {
      // Breathing: the body swells and settles; one ear flicks now and then.
      body.scaleY = 1 + 0.03 * Math.sin(t * 1.7 + phase);
      b.art.setFrame(tail, 'panther.tail', tailFrameFor(pantherSwish(t, phase)));
      b.art.setFrame(eyes, 'panther.eyes', pantherBlinks(t, phase) ? 1 : 0);
      ear.scaleY = earUnit * (1 - 0.55 * Math.max(0, Math.sin(t * 1.3 + phase * 2)) ** 14);
    },
  };
}

function hangingBatRig(b, rand) {
  const { x, dir, phase, look } = hangingBat(rand);
  const name = BAT_LOOK_NAMES[BAT_LOOKS.indexOf(look)];
  const key = (p) => `hangingBat.${name}.${p}`;
  const part = b.container(x, b.art.catalog.presentation?.hangingBatRootY ?? under()).setScale(dir, 1);
  // Everything hangs from the feet at (0, 0).
  const swing = b.container();
  const ear = b.image(key('ear'));
  const eyes = b.image(key('eyes'));
  swing.add([b.image(key('body')), ear, eyes]);
  part.add(swing);
  return {
    part,
    animate(t) {
      const pose = hangingBatPose(t, phase);
      swing.rotation = pose.swing;
      b.art.setFrame(eyes, key('eyes'), pose.open ? 1 : 0);
      b.art.setFrame(ear, key('ear'), BAT_EAR.frameFor(pose.twitch));
    },
  };
}

function owl(b, rand) {
  const { dir, x, phase } = owlPlacement(rand);
  const part = b.container(x, branchTop(x)).setScale(dir, 1);
  const body = b.image('owl.body');
  const head = b.container(OWL_HEAD.x, OWL_HEAD.y);
  const face = b.container();
  // Per eye: the eyeball and its pupil, or the eye shut.
  const eyes = [-1, 1].map((side) => ({ x: side * 4.6, ball: b.image('owl.eyeball'), pupil: b.image('owl.pupil'), shut: b.image('owl.shutEye') }));
  for (const eye of eyes) for (const p of [eye.ball, eye.shut]) p.setX(eye.x);
  face.add([b.image('owl.disc'), ...eyes.flatMap((e) => [e.ball, e.pupil, e.shut]), b.image('owl.beak')]);
  head.add([b.image('owl.skull'), face]);
  part.add([body, head]);
  const bodyUnit = b.art.unit('owl.body');
  return {
    part,
    animate(t) {
      const pose = owlPose(t, phase);
      body.scaleY = bodyUnit * pose.breath;
      face.x = pose.faceX;
      head.rotation = pose.head;
      for (const eye of eyes) {
        eye.ball.visible = eye.pupil.visible = !pose.blink;
        eye.shut.visible = pose.blink;
        eye.pupil.setX(eye.x + pose.turn * 1.4);
      }
    },
  };
}

function flowers(b, rand) {
  const { dir, x: cx, plants } = flowerCluster(rand);
  const part = b.container(cx, branchTop(cx)).setScale(dir, 1);
  const art = b.art;
  const leafFrame = (color) => (color === LINE_COLORS.flowerStem ? 0 : 1);
  const scaled = (key, s) => art.unit(key) * s;
  const stems = plants.map((p) => {
    const plant = b.container(p.x, 1);
    // The stem's piece runs up from its foot (the origin): stretched to the height.
    const stem = b.image('flower.stem');
    stem.scaleY = scaled('flower.stem', p.height / FLOWER_STEM_REFERENCE);
    const pieces = [stem];
    for (const leaf of [p.leaf, p.leaf2].filter(Boolean)) {
      const image = b.image('flower.leaf', leafFrame(leaf.color)).setPosition(0, leaf.y).setRotation(leaf.angle);
      image.setScale(scaled('flower.leaf', leaf.length / FLOWER_LEAF_REFERENCE), scaled('flower.leaf', leaf.width / (FLOWER_LEAF_REFERENCE / 2)));
      pieces.push(image);
    }
    for (const petal of p.petals) pieces.push(b.image('flower.petal').setPosition(petal.x, petal.y).setScale(scaled('flower.petal', petal.r / FLOWER_DOT_REFERENCE)).setTint(petal.color));
    pieces.push(b.image('flower.heart').setPosition(0, p.heart.y).setScale(scaled('flower.heart', p.heart.r / FLOWER_DOT_REFERENCE)).setTint(p.heart.color));
    plant.add(pieces);
    return { plant, phase: p.phase, speed: p.speed };
  });
  part.add(stems.map((s) => s.plant));
  return {
    part,
    animate(t) {
      for (const s of stems) s.plant.rotation = flowerSway(t, s);
    },
  };
}

function coconuts(b, rand) {
  const { x: cx, dir, nuts } = coconutBunch(rand);
  const art = b.art;
  // The painted branch's visible underside is higher than its collision box.
  const part = b.container(cx, art.catalog.presentation?.coconutRootY ?? under()).setScale(dir, 1);
  const swaying = nuts.map((n) => {
    const nut = b.container(n.x * 0.4, 1);
    const nx = n.x - n.x * 0.4;
    const scale = art.unit('coconut.nut') * (n.r / COCONUT_REFERENCE);
    const hairScale = art.unit('coconut.hair') * (n.r / COCONUT_REFERENCE);
    nut.add([
      ...b.line('coconut.stem', [[0, 0], [nx * 0.5, n.drop * 0.6], [nx, n.drop]]),
      ...n.hairs.map((a) => b.image('coconut.hair').setPosition(nx, n.drop + n.r).setRotation(a).setScale(hairScale)),
      b.image('coconut.nut').setPosition(nx, n.drop).setScale(scale),
    ]);
    return { nut, phase: n.phase, speed: n.speed };
  });
  part.add([b.image('coconut.frond'), ...swaying.map((s) => s.nut)]);
  return {
    part,
    animate(t) {
      for (const n of swaying) n.nut.rotation = coconutSway(t, n);
    },
  };
}

export const DECORATION_RIGS = { bird, snake, monkey, nest, panther, hangingBat: hangingBatRig, owl, flowers, coconuts };
