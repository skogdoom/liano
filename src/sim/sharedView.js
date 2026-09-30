import { LIANA_SPACING, MONKEY_RADIUS, SCREEN_WIDTH, SHARED_LEADER_X, SHARED_ZOOM } from '../config.js';
import { Camera, cameraTarget } from '../render/camera.js';
import { MonkeyState } from './monkey.js';

// Shared screen: one view over one world with both monkeys. The camera follows the
// leader (the alive, non-invulnerable monkey furthest right) with the usual easing,
// so a change of leader pans rather than snaps. While the leader hangs it follows its
// liana, not its swing, so the view holds still. A monkey that goes fully off the left
// edge loses a life (a hanging one only once its liana is off too: swinging back out
// of view is fine), and respawns on the leftmost liana fully on screen.
//
// The view is SCREEN_WIDTH / SHARED_ZOOM of world wide, with the leader at
// SHARED_LEADER_X of it: the next liana is in view ahead, and a monkey a liana behind
// is still in view while the leader hangs; once the leader flies on, it has to follow.
export class SharedView {
  constructor(world, width = SCREEN_WIDTH / SHARED_ZOOM) {
    this.world = world;
    this.width = width;
    this.camera = new Camera(0, SHARED_LEADER_X * width);
    this.camera.reset(this.#target() ?? world.monkey.x);
    world.respawnLiana = (player) => this.respawnLiana(player);
  }

  // The monkey the camera follows: the alive, non-invulnerable one furthest right, else
  // any alive one, else none (everyone left is dead or about to respawn: the camera
  // then holds still, rather than going back to a fallen monkey).
  #leader() {
    const { world } = this;
    const alive = world.monkeys.filter((m) => m.state !== MonkeyState.DEAD);
    const leaders = alive.filter((m) => !world.isInvulnerable(world.monkeys.indexOf(m)));
    const pool = leaders.length > 0 ? leaders : alive;
    if (pool.length === 0) return null;
    return pool.reduce((a, b) => (b.x > a.x ? b : a));
  }

  // The leader's player index, or -1 if there is none.
  get leader() {
    return this.world.monkeys.indexOf(this.#leader());
  }

  #target() {
    const leader = this.#leader();
    return leader ? cameraTarget(leader, 'anchor') : null;
  }

  // After world.step(dt). `playing`: whether trailing monkeys can be left behind.
  step(dt, playing) {
    const { world, camera } = this;
    // Hold the camera still once everyone is out.
    const target = this.#target();
    if (target !== null) camera.update(target, dt);
    if (!playing) return;
    world.monkeys.forEach((m, player) => {
      if (m.state === MonkeyState.DEAD) return;
      const x = m.state === MonkeyState.HANGING ? Math.max(m.x, m.liana.x) : m.x;
      if (x + MONKEY_RADIUS < camera.x) world.eliminate(player, 'left');
    });
  }

  // Where a monkey respawns: the last liana it grabbed if that is fully on screen (its
  // rope, and a monkey hanging on it at rest), else the leftmost liana fully on screen.
  respawnLiana(player = null) {
    const inView = (index) => {
      const x = index * LIANA_SPACING;
      return x - MONKEY_RADIUS >= this.camera.x && x + MONKEY_RADIUS <= this.camera.x + this.width;
    };
    const last = player === null ? null : this.world.lastLiana[player];
    if (last !== null && inView(last)) return last;
    return Math.ceil((this.camera.x + MONKEY_RADIUS) / LIANA_SPACING);
  }
}
