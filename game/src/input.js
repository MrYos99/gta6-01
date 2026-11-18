// Keyboard and pointer input. Held keys give a move vector; one-shot presses
// (start, pause, jump) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice. The mouse
// orbits the third-person camera: pointer lock on click, drag as fallback.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_JUMP = 4;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const JUMP = new Set(['Space']);

export function createInput(target) {
  const keys = new Set();
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code)
      || RIGHT.has(event.code) || SPRINT.has(event.code)) {
      keys.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (JUMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JUMP;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => keys.clear());

  target.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    // Pointer lock on click (desktop): the mouse then orbits the camera.
    if (target.requestPointerLock) {
      try { target.requestPointerLock(); } catch { /* drag fallback below */ }
    }
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (event) => {
    if (document.pointerLockElement === target) {
      lookDX += event.movementX;
      lookDY += event.movementY;
    } else if (dragging) {
      lookDX += event.clientX - lastX;
      lookDY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });

  function hasAny(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    /** Move vector in camera space: x = strafe right, y = forward. */
    move() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(FORWARD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0);
      return { x, y };
    },
    sprint() { return hasAny(SPRINT); },
    /** Mouse look delta since the last call, in pixels. */
    takeLook() {
      const taken = { dx: lookDX, dy: lookDY };
      lookDX = 0;
      lookDY = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
