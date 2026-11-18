// NEONFALL 2100 — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. Screens: title, play, paused.
//
// ?seed=N fixes the city. ?shot=start|play (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP, applyQuality, DEBUG_HIDE } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;
applyQuality(params.get('quality') || 'high');
for (const part of (params.get('hide') || '').split(',')) {
  if (part) DEBUG_HIDE.add(part);
}

// Error trap: any failure is visible to the QA harness (and to the player).
window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error));
});
window.addEventListener('unhandledrejection', (event) => {
  window.__errors.push(String(event.reason));
});

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const title = document.getElementById('title');
const debug = document.getElementById('debug');
const renderer = createRenderer(canvas);
const world = createWorld(createRandom(seed), renderer.scene);

function runShot(name) {
  const scene = stageShot(name, world);
  // The title overlay is part of the TITLE screen only.
  title.style.display = scene.screen === SCREEN_TITLE ? 'flex' : 'none';
  let painted = 0;
  function paint() {
    const info = renderer.draw(world, world.player.group, world.city.seaTex, world.state.time);
    window.__perf = { calls: info.calls, triangles: info.triangles };
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let frames = 0;
  let fpsTime = last;
  let fps = 0;

  function announce(message) {
    status.textContent = message;
  }

  function showTitle(show) {
    title.style.display = show ? 'flex' : 'none';
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    showTitle(false);
    announce('Playing. Walk with W A S D. Sprint with Shift. Jump with Space.');
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    world.step(STEP, input);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      showTitle(false);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const info = renderer.draw(world, world.player.group, world.city.seaTex, world.state.time);
    frames += 1;
    if (now - fpsTime >= 500) {
      fps = Math.round((frames * 1000) / (now - fpsTime));
      frames = 0;
      fpsTime = now;
      const p = world.state.player;
      debug.textContent = `${fps} FPS · ${info.calls} calls · ${info.triangles} tris · `
        + `x ${p.x.toFixed(0)} z ${p.z.toFixed(0)} · ${window.__errors.length} errors`;
      window.__perf = { calls: info.calls, triangles: info.triangles, fps };
    }
  }

  // Clicking the title starts the game; clicks in play orbit the camera.
  title.addEventListener('pointerdown', () => startGame());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('NEONFALL 2100. Click to start.');
  showTitle(true);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
