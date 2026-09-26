import { LIANA_SPACING, MONKEY_RADIUS, SCREEN_WIDTH, SHARED_LEADER_X } from '../config.js';
import { Camera, cameraTarget } from '../render/camera.js';
import { MonkeyState } from './monkey.js';

// Shared screen: one view over one world with both monkeys. The camera follows the
// leader (the alive, non-invulnerable monkey furthest right) with the usual easing,
// so a change of leader pans rather than snaps. While the leader hangs it follows its
// liana, not its swing, so the view holds still. A monkey that goes fully off the left
// edge loses a life (a hanging one only once its liana is off too: swinging back out
// of view is fine), and respawns on the leftmost liana fully on screen.
//
// The leader sits further right than in single player (SHARED_LEADER_X), so a monkey
// one liana behind is still in view while the leader hangs; once the leader flies on,
// it has to follow.
export class SharedView {
  constructor(world, width = SCREEN_WIDTH) {
    this.world = world;
    this.width = width;
    this.camera = new Camera(0, SHARED_LEADER_X * width);
    this.camera.reset(this.#target());
    world.respawnLiana = () => this.respawnLiana();
  }

  // The monkey the camera follows: the alive, non-invulnerable one furthest right, else
  // any alive one, else player 1's.
  #leader() {
    const { world } = this;
    const alive = world.monkeys.filter((m) => m.state !== MonkeyState.DEAD);
    const leaders = alive.filter((m) => !world.isInvulnerable(world.monkeys.indexOf(m)));
    const pool = leaders.length > 0 ? leaders : alive;
    if (pool.length === 0) return world.monkey;
    return pool.reduce((a, b) => (b.x > a.x ? b : a));
  }

  get leader() {
    return this.world.monkeys.indexOf(this.#leader());
  }

  #target() {
    return cameraTarget(this.#leader(), 'anchor');
  }

  // After world.step(dt). `playing`: whether trailing monkeys can be left behind.
  step(dt, playing) {
    const { world, camera } = this;
    // Hold the camera still once everyone is out.
    if (world.alive) camera.update(this.#target(), dt);
    if (!playing) return;
    world.monkeys.forEach((m, player) => {
      if (m.state === MonkeyState.DEAD) return;
      const x = m.state === MonkeyState.HANGING ? Math.max(m.x, m.liana.x) : m.x;
      if (x + MONKEY_RADIUS < camera.x) world.eliminate(player, 'left');
    });
  }

  // The leftmost liana fully on screen: its rope, and a monkey hanging on it at rest.
  respawnLiana() {
    return Math.ceil((this.camera.x + MONKEY_RADIUS) / LIANA_SPACING);
  }
}
