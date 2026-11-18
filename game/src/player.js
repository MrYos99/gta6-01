// NEONFALL 2100 — on-foot controller: walk / sprint / jump, third-person
// camera orbit, building collision, stamina. Kade Voss on foot in Voltspire.
import { CAMERA, MAP, PLAYER } from './config.js';
import { buildKade, poseKade } from './models.js';
import { ACTION_JUMP } from './input.js';

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function collideCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = pos.x - c.minX, pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
}

export function createPlayer(spawn, colliders) {
  const kade = buildKade();
  const state = {
    x: spawn.x, z: spawn.z, y: 0, vy: 0,
    yaw: spawn.yaw, camYaw: spawn.yaw, camPitch: 0.18,
    grounded: true, stamina: PLAYER.staminaMax, phase: 0, speed: 0,
    moving: false, sprinting: false,
  };

  function step(dt, input) {
    const look = input.takeLook();
    state.camYaw -= look.dx * 0.003;
    state.camPitch = Math.min(CAMERA.pitchMax, Math.max(CAMERA.pitchMin, state.camPitch + look.dy * 0.003));

    const move = input.move();
    const wantSprint = input.sprint() && state.stamina > 0;
    const speed = wantSprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(move.x, move.y);
    state.moving = len > 0;
    state.sprinting = wantSprint && state.moving;

    if (state.moving) {
      const nx = move.x / len, ny = move.y / len;
      // Camera-relative: forward is where the camera looks, right is its right.
      const fx = Math.sin(state.camYaw), fz = Math.cos(state.camYaw);
      const rx = Math.cos(state.camYaw), rz = -Math.sin(state.camYaw);
      const dx = fx * ny + rx * nx;
      const dz = fz * ny + rz * nx;
      state.x += dx * speed * dt;
      state.z += dz * speed * dt;
      state.yaw = lerpAngle(state.yaw, Math.atan2(dx, dz), Math.min(1, dt * 12));
      state.speed = speed;
      state.phase += speed * dt * 1.7;
    } else {
      state.speed = 0;
    }

    if (state.sprinting) {
      state.stamina = Math.max(0, state.stamina - dt);
    } else {
      state.stamina = Math.min(PLAYER.staminaMax, state.stamina + (dt * PLAYER.staminaMax) / PLAYER.staminaRegen);
    }

    const actions = input.takeActions();
    if ((actions & ACTION_JUMP) && state.grounded) {
      state.vy = PLAYER.jumpVelocity;
      state.grounded = false;
    }
    if (!state.grounded) {
      state.vy -= PLAYER.gravity * dt;
      state.y += state.vy * dt;
      if (state.y <= 0) {
        state.y = 0;
        state.vy = 0;
        state.grounded = true;
      }
    }

    collideCircle(state, PLAYER.radius, colliders);
    state.x = Math.max(-MAP.half + 5, Math.min(MAP.seaX - 2, state.x));
    state.z = Math.max(-MAP.half + 5, Math.min(MAP.half - 5, state.z));
  }

  function pose() {
    kade.group.position.set(state.x, state.y, state.z);
    kade.group.rotation.y = state.yaw;
    const speedNorm = state.moving ? state.speed / PLAYER.sprintSpeed : 0;
    poseKade(kade.parts, state.phase, speedNorm, state.sprinting);
  }

  return { state, step, pose, group: kade.group };
}
