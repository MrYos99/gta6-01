// NEONFALL 2100 — three.js scene: sun-soaked daylight, exponential fog, sky
// dome, third-person chase camera. Rendering is decoupled from simulation.
import * as THREE from 'three';
import { CAMERA, PALETTE, QUALITY, DEBUG_HIDE } from './config.js';

// Render scale (?scale=0.5 renders at half resolution and upscales via CSS).
// The main lever for software-rasterizer FPS: fill rate scales with pixels.
export const RENDER_SCALE = Math.min(
  1,
  Math.max(0.25, parseFloat(new URLSearchParams(window.location.search).get('scale') || '1') || 1),
);

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = `
varying vec3 vDir;
void main() {
  float h = normalize(vDir).y;
  vec3 top = vec3(0.44, 0.66, 0.87);
  vec3 mid = vec3(0.75, 0.89, 1.00);
  vec3 bot = vec3(1.00, 0.96, 0.87);
  vec3 c = h > 0.12
    ? mix(mid, top, smoothstep(0.12, 0.65, h))
    : mix(bot, mid, smoothstep(-0.08, 0.12, h));
  gl_FragColor = vec4(c, 1.0);
}`;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY.antialias });
  renderer.setPixelRatio(1);
  renderer.setSize(
    Math.round(window.innerWidth * RENDER_SCALE),
    Math.round(window.innerHeight * RENDER_SCALE),
    false,
  );
  renderer.toneMapping = new URLSearchParams(window.location.search).get('notone') === '1'
    ? THREE.NoToneMapping
    : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = new URLSearchParams(window.location.search).get('notone') === '1'
    ? THREE.LinearSRGBColorSpace
    : THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = QUALITY.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xdfeefc, 0.0012);

  // Sky dome (never fogged).
  if (!DEBUG_HIDE.has('sky')) {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: SKY_VERT, fragmentShader: SKY_FRAG }),
    );
    scene.add(sky);
  }

  // One strong sun from the south, high — so the faces the camera sees when
  // looking north are sunlit and the streets read sun-soaked, not shadowed.
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.position.set(60, 280, 260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(QUALITY.shadowSize, QUALITY.shadowSize);
  sun.shadow.camera.left = -170;
  sun.shadow.camera.right = 170;
  sun.shadow.camera.top = 170;
  sun.shadow.camera.bottom = -170;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a8f96, 1.15);
  scene.add(hemi);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(
      Math.round(window.innerWidth * RENDER_SCALE),
      Math.round(window.innerHeight * RENDER_SCALE),
      false,
    );
  });

  // Camera: over-the-shoulder, behind the player relative to camYaw — unless
  // a shot sets a cinematic override { pos: [x,y,z], target: [x,y,z] }.
  const camPos = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  function updateCamera(p, override) {
    if (override) {
      camPos.set(override.pos[0], override.pos[1], override.pos[2]);
      lookTarget.set(override.target[0], override.target[1], override.target[2]);
      camera.position.copy(camPos);
      camera.lookAt(lookTarget);
      return;
    }
    const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw);
    const rx = Math.cos(p.camYaw), rz = -Math.sin(p.camYaw);
    const hDist = Math.cos(p.camPitch) * CAMERA.distance;
    const vDist = Math.sin(p.camPitch) * CAMERA.distance;
    camPos.set(
      p.x - fx * hDist + rx * CAMERA.shoulder,
      p.y + CAMERA.height + vDist,
      p.z - fz * hDist + rz * CAMERA.shoulder,
    );
    if (camPos.y < 0.6) camPos.y = 0.6;
    lookTarget.set(p.x + fx * 3, p.y + 1.5, p.z + fz * 3);
    camera.position.copy(camPos);
    camera.lookAt(lookTarget);
  }

  return {
    scene, camera, renderer,
    /** Paint the world for a screen. `playerGroup` is Kade's THREE.Group. */
    draw(world, playerGroup, seaTex, time) {
      const p = world.state.player;
      if (!DEBUG_HIDE.has('player')) {
        world.player.pose();
        if (playerGroup.parent !== scene) scene.add(playerGroup);
      }
      updateCamera(p, world.state.cameraOverride);
      // Sea drift.
      if (seaTex) seaTex.offset.x = (time * 0.004) % 1;
      renderer.render(scene, camera);
      return renderer.info.render;
    },
  };
}
