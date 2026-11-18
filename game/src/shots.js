// The screenshot scenes behind ?shot=start|play. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, so the frame
// is what a short game really looks like and the same seed always gives the
// same frame. The full 4-shot set (cover / chase / hijack / heist) lands with
// vehicles and police on later days; these two prove the city + on-foot play.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 2;
const PLAY_SECONDS = 12;

// Minimal input stub: walk straight ahead (north, up the x = 0 street).
function autopilotInput() {
  return {
    move: () => ({ x: 0, y: 1 }),
    sprint: () => false,
    takeLook: () => ({ dx: 0, dy: 0 }),
    takeActions: () => 0,
  };
}

/**
 * Set `world` to the named scene (start or play; any other name is start)
 * and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play') {
    // Hero view: high and far south, looking north over Neon Row to the
    // sunlit Spire skyline — facades and sky, not rooftops.
    world.state.cameraOverride = {
      pos: [0, 130, 320],
      target: [0, 40, -250],
    };
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, autopilotInput());
    return { screen: SCREEN_TITLE };
  }
  world.state.cameraOverride = null;
  const input = autopilotInput();
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) world.step(STEP, input);
  world.state.player.camYaw = Math.PI;
  world.state.player.camPitch = 0.18;
  return { screen: SCREEN_PLAY };
}
