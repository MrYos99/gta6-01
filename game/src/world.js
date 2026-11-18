// The game's rules and state, with no drawing and no browser in it: the
// player on foot in Voltspire, advancing in fixed 1/60 s steps. step()
// advances one step; nothing here allocates after createWorld returns.
import { STEP } from './config.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';

export function createWorld(random, scene) {
  const city = buildCity(scene, random);
  const player = createPlayer(city.spawn, city.colliders);
  const state = { player: player.state, city, time: 0, seed: 0 };

  function reset() {
    player.state.x = city.spawn.x;
    player.state.z = city.spawn.z;
    player.state.y = 0;
    player.state.vy = 0;
    player.state.yaw = city.spawn.yaw;
    player.state.camYaw = city.spawn.yaw;
    player.state.camPitch = 0.18;
    player.state.grounded = true;
    player.state.stamina = 6;
    player.state.phase = 0;
    state.time = 0;
  }

  function step(dt, input) {
    state.time += dt;
    player.step(dt, input);
  }

  reset();
  return { state, city, player, reset, step, STEP };
}
