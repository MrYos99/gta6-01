// NEONFALL 2100 — procedural models: canvas textures, building archetypes built
// from composed (non-boxy) geometry, and the Kade Voss character. Everything is
// generated in code; no external assets, no network.
// HARD RULE: realistic humanoid shapes, never blocky / voxel / stacked-box
// characters. Buildings are composed of setbacks, trim and rooftop plant —
// never a bare slab with a flat texture.
import * as THREE from 'three';
import { DISTRICTS, MAP, PALETTE, QUALITY } from './config.js';

// ---------------------------------------------------------------------------
// Small geometry helpers (non-indexed triangles, two material groups)
// ---------------------------------------------------------------------------

function newChunk() {
  return { pos: [], nor: [], uv: [] };
}

function pushQuad(c, a, b, d, e, n, u0, v0, u1, v1) {
  // Quad a-b-d-e (a bottom-left, b bottom-right, d top-right, e top-left).
  c.pos.push(...a, ...b, ...d, ...a, ...d, ...e);
  for (let i = 0; i < 6; i += 1) c.nor.push(...n);
  c.uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
}

// One box, split into window-textured sides and plain caps. (w, h, d) size,
// centre (cx, cy, cz). uvRepeat: metres of facade one texture repeat covers.
function boxParts(sides, caps, w, h, d, cx, cy, cz, uvRepeat = 20) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const uX = w / uvRepeat, uZ = d / uvRepeat, v = h / 12;
  // +x face (u runs along z)
  pushQuad(sides, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], 0, 0, uZ, v);
  // -x face
  pushQuad(sides, [x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], 0, 0, uZ, v);
  // +z face (u runs along x)
  pushQuad(sides, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], 0, 0, uX, v);
  // -z face
  pushQuad(sides, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], 0, 0, uX, v);
  // top + bottom caps (plain)
  pushQuad(caps, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], 0, 0, 1, 1);
  pushQuad(caps, [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, -1, 0], 0, 0, 1, 1);
}

// A thin box whose faces all go to one chunk (used for neon trim / plant).
function solidBox(chunk, w, h, d, cx, cy, cz) {
  boxParts(chunk, chunk, w, h, d, cx, cy, cz);
}

// Neon trim frame around a roofline: four thin strips at height y.
function trimFrame(trim, w, d, cx, y, cz) {
  const t = 0.5, h = 0.7;
  solidBox(trim, w, h, t, cx, y, cz - d / 2 + t / 2);
  solidBox(trim, w, h, t, cx, y, cz + d / 2 - t / 2);
  solidBox(trim, t, h, d, cx - w / 2 + t / 2, y, cz);
  solidBox(trim, t, h, d, cx + w / 2 - t / 2, y, cz);
}

function toGeometry(chunk) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(chunk.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(chunk.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(chunk.uv, 2));
  return g;
}

// Cheap lit material for big flat surfaces: Lambert does per-vertex sun +
// hemisphere lighting with a single texture fetch, which is several times
// faster per pixel than Standard in a software rasterizer — and flat building
// faces shade identically either way. With ?flat=1 every Lambert becomes a
// Basic (no lighting at all): the fastest path, used only to isolate cost.
export function lambert(opts) {
  if (new URLSearchParams(window.location.search).get('flat') === '1') {
    return new THREE.MeshBasicMaterial(opts);
  }
  return new THREE.MeshLambertMaterial(opts);
}

// ---------------------------------------------------------------------------
// Canvas textures
// ---------------------------------------------------------------------------

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Window grid: 8 cols x 8 rows per repeat (20 m wide, 12 m tall). Variant
// changes the lit ratio and the lit tint.
export function makeWindowTexture(random, variant) {
  return canvasTexture(256, (ctx, s) => {
    // Sunlit facade: light grey-blue base, so the tower reads in daylight.
    ctx.fillStyle = '#7d8590';
    ctx.fillRect(0, 0, s, s);
    // Subtle vertical panel shading.
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let c = 0; c < 8; c += 2) ctx.fillRect(c * (s / 8), 0, s / 8, s);
    const cols = 8, rows = 8;
    const cw = s / cols, ch = s / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lit = random();
        const x = c * cw + 4, y = r * ch + 3, w = cw - 8, h = ch - 6;
        if (lit < 0.48 + variant * 0.12) {
          // Lit window: warm or cyan, seeded per building variant.
          ctx.fillStyle = random() < 0.7 ? '#ffd27a' : '#9be8ff';
          ctx.fillRect(x, y, w, h);
        } else if (lit < 0.55) {
          ctx.fillStyle = '#5a6a7a';
          ctx.fillRect(x, y, w, h);
        } else {
          // Dark glass.
          ctx.fillStyle = '#22303e';
          ctx.fillRect(x, y, w, h);
        }
      }
    }
    // Faint floor lines between rows.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let r = 0; r <= rows; r += 1) ctx.fillRect(0, r * ch - 1, s, 2);
  });
}

// Ground map for the 540x600 m built area: streets, sidewalks, lane dashes,
// crosswalks, subtle district tints. The canvas maps x -300..240, z -300..300.
export function makeGroundTexture(random) {
  const W = 2048, H = 2276; // 540 m x 600 m at ~3.8 px/m
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const px = W / 540; // px per metre
  const X = (x) => (x + 300) * px;
  const Z = (z) => (z + 300) * px;
  ctx.fillStyle = PALETTE.pavement;
  ctx.fillRect(0, 0, W, H);
  // Subtle district tints.
  const tints = [
    { x0: -120, z0: -300, x1: 240, z1: -60, c: 'rgba(0,240,255,0.05)' },
    { x0: -300, z0: -300, x1: -120, z1: -60, c: 'rgba(45,232,196,0.06)' },
    { x0: -120, z0: -60, x1: 240, z1: 150, c: 'rgba(255,45,120,0.05)' },
    { x0: -300, z0: 60, x1: -120, z1: 300, c: 'rgba(255,179,0,0.06)' },
    { x0: 120, z0: 60, x1: 240, z1: 300, c: 'rgba(255,122,26,0.05)' },
  ];
  for (const t of tints) {
    ctx.fillStyle = t.c;
    ctx.fillRect(X(t.x0), Z(t.z0), (t.x1 - t.x0) * px, (t.z1 - t.z0) * px);
  }
  // Streets: dark asphalt bands on the 60 m grid (street centres at -240..240).
  ctx.fillStyle = PALETTE.asphalt;
  for (let k = -4; k <= 4; k += 1) {
    const c = k * 60;
    ctx.fillRect(X(c - 6), 0, 12 * px, H); // vertical street
    ctx.fillRect(0, Z(c - 6), W, 12 * px); // horizontal street
  }
  // Block interiors: slightly lighter pavement squares.
  ctx.fillStyle = '#5d626b';
  for (let i = 0; i < 9; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      const cx = -270 + i * 60, cz = -270 + j * 60;
      ctx.fillRect(X(cx - 24), Z(cz - 24), 48 * px, 48 * px);
    }
  }
  // Lane dashes (cyan, centre of each street).
  ctx.fillStyle = 'rgba(0,240,255,0.75)';
  for (let k = -4; k <= 4; k += 1) {
    const c = k * 60;
    for (let m = -300; m < 300; m += 12) {
      ctx.fillRect(X(c - 0.4), Z(m), 0.8 * px, 5 * px);
      ctx.fillRect(X(m), Z(c - 0.4), 5 * px, 0.8 * px);
    }
  }
  // Crosswalks at intersections (white stripes).
  ctx.fillStyle = 'rgba(232,244,255,0.55)';
  for (let a = -4; a <= 4; a += 1) {
    for (let b = -4; b <= 4; b += 1) {
      const cx = a * 60, cz = b * 60;
      for (let s = -5; s <= 5; s += 2) {
        ctx.fillRect(X(cx + s - 0.7), Z(cz - 7), 1.4 * px, 3 * px);
        ctx.fillRect(X(cx + s - 0.7), Z(cz + 4), 1.4 * px, 3 * px);
        ctx.fillRect(X(cx - 7), Z(cz + s - 0.7), 3 * px, 1.4 * px);
        ctx.fillRect(X(cx + 4), Z(cz + s - 0.7), 3 * px, 1.4 * px);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.anisotropy;
  return tex;
}

// Sky dome gradient: bright blue up top, pale horizon.
export function makeSkyTexture() {
  return canvasTexture(512, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#6fa8dd');
    g.addColorStop(0.45, PALETTE.skyTop);
    g.addColorStop(0.75, PALETTE.skyHorizon);
    g.addColorStop(1, '#fff6dd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

// Holo-sign: glowing original text on a transparent plane.
export function makeSignTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 66);
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Building archetypes. Each returns { sides, caps, trim } BufferGeometries
// (window sides / dark roof caps + plant / emissive neon trim), built around
// the origin at ground level, footprint ~w x d, total height h.
// ---------------------------------------------------------------------------

function archetypeGeometries(kind, w, d, h, random) {
  const sides = newChunk(), caps = newChunk(), trim = newChunk();
  if (kind === 0) {
    // Setback tower: three stacked boxes, trim at each roofline.
    const h1 = h * 0.55, h2 = h * 0.28, h3 = h * 0.17;
    boxParts(sides, caps, w, h1, d, 0, h1 / 2, 0);
    boxParts(sides, caps, w * 0.72, h2, d * 0.72, 0, h1 + h2 / 2, 0);
    boxParts(sides, caps, w * 0.45, h3, d * 0.45, 0, h1 + h2 + h3 / 2, 0);
    trimFrame(trim, w, d, 0, h1, 0);
    trimFrame(trim, w * 0.72, d * 0.72, 0, h1 + h2, 0);
    trimFrame(trim, w * 0.45, d * 0.45, 0, h1 + h2 + h3, 0);
    solidBox(caps, 3, 2.5, 3, w * 0.18, h1 + h2 + h3 + 1.2, d * 0.15); // roof plant
    solidBox(trim, 0.4, 7, 0.4, -w * 0.2, h1 + h2 + h3 + 3.5, -d * 0.18); // antenna
  } else if (kind === 1) {
    // Slab tower: one tall box, roof cap + trim + plant.
    boxParts(sides, caps, w, h, d, 0, h / 2, 0);
    trimFrame(trim, w, d, 0, h, 0);
    solidBox(caps, w * 0.3, 2, d * 0.3, w * 0.2, h + 1, d * 0.2);
    solidBox(trim, 0.4, 6, 0.4, -w * 0.25, h + 3, -d * 0.2);
  } else if (kind === 2) {
    // Twin peak: two boxes side by side, different heights.
    const hA = h, hB = h * 0.62;
    boxParts(sides, caps, w * 0.48, hA, d, -w * 0.26, hA / 2, 0);
    boxParts(sides, caps, w * 0.48, hB, d, w * 0.26, hB / 2, 0);
    trimFrame(trim, w * 0.48, d, -w * 0.26, hA, 0);
    trimFrame(trim, w * 0.48, d, w * 0.26, hB, 0);
    solidBox(caps, 2.5, 2, 2.5, -w * 0.26, hA + 1, d * 0.2);
  } else if (kind === 3) {
    // Mid block: box + parapet + street awning with a neon edge.
    boxParts(sides, caps, w, h, d, 0, h / 2, 0);
    solidBox(caps, w + 0.6, 0.8, d + 0.6, 0, h + 0.4, 0); // parapet
    trimFrame(trim, w, d, 0, h, 0);
    solidBox(caps, w * 0.8, 0.4, 3, 0, 3.2, d / 2 + 1); // awning
    solidBox(trim, w * 0.8, 0.25, 0.25, 0, 3.0, d / 2 + 2.4); // awning neon edge
  } else if (kind === 4) {
    // Warehouse: wide low box + big sign band on the front.
    boxParts(sides, caps, w, h, d, 0, h / 2, 0);
    trimFrame(trim, w, d, 0, h, 0);
    solidBox(trim, w * 0.7, 1.6, 0.3, 0, h * 0.72, d / 2 + 0.15); // sign band
    solidBox(caps, 4, 1.5, 3, -w * 0.3, h + 0.75, 0); // roof vent
  } else {
    // Residential: box + two balcony bands + trim.
    boxParts(sides, caps, w, h, d, 0, h / 2, 0);
    trimFrame(trim, w, d, 0, h, 0);
    solidBox(trim, w + 0.3, 0.3, 0.3, 0, h * 0.66, d / 2 + 0.1);
    solidBox(trim, w + 0.3, 0.3, 0.3, 0, h * 0.33, d / 2 + 0.1);
    solidBox(caps, 2, 1.6, 2, w * 0.25, h + 0.8, -d * 0.2);
  }
  return { sides: toGeometry(sides), caps: toGeometry(caps), trim: toGeometry(trim) };
}

export const ARCHETYPE_COUNT = 6;
export function buildArchetypes(random) {
  // One geometry set per archetype, sized to a reference footprint; instances
  // scale it per building. Reference: 32 m wide, 32 m deep, 40 m tall.
  const out = [];
  for (let kind = 0; kind < ARCHETYPE_COUNT; kind += 1) {
    out.push(archetypeGeometries(kind, 32, 32, 40, random));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Kade Voss — the protagonist. A realistic humanoid: capsule torso and limbs,
// sphere head, flared trench coat, popped collar. Never blocky.
// Returns { group, parts: { armL, armR, legL, legR, coat, head } }.
// ---------------------------------------------------------------------------

export function buildKade() {
  const group = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x232c42, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x141a26, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.95 });
  const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  // Trench coat: flared cylinder from shoulders to knees.
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 1.15, 12), coatMat);
  coat.position.y = 0.95;
  coat.castShadow = true;
  group.add(coat);
  // Coat front neon rim strip (subtle).
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.03), neonMat);
  rim.position.set(0, 0.95, 0.40);
  group.add(rim);
  // Torso under the coat.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.35, 4, 10), darkMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  group.add(torso);
  // Head + hair + popped collar.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skinMat);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.70;
  group.add(hair);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 8, 16), coatMat);
  collar.rotation.x = Math.PI / 2 - 0.25;
  collar.position.y = 1.53;
  group.add(collar);

  function limb(px, py, r, len, mat) {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    seg.position.y = -len / 2 - r;
    seg.castShadow = true;
    pivot.add(seg);
    group.add(pivot);
    return pivot;
  }
  const armL = limb(-0.27, 1.46, 0.065, 0.5, coatMat);
  const armR = limb(0.27, 1.46, 0.065, 0.5, coatMat);
  const legL = limb(-0.11, 0.85, 0.085, 0.55, darkMat);
  const legR = limb(0.11, 0.85, 0.085, 0.55, darkMat);
  // Boots.
  for (const leg of [legL, legR]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), darkMat);
    boot.position.set(0, -0.78, 0.05);
    leg.add(boot);
  }
  // Blob shadow: cheap grounding that always reads, even if the shadow map is off.
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  group.add(blob);

  return { group, parts: { armL, armR, legL, legR, coat, head, blob } };
}

// Pose the character: walkPhase advances with speed; lean with sprint.
export function poseKade(parts, phase, speedNorm, sprinting) {
  const swing = 0.55 * speedNorm;
  parts.armL.rotation.x = Math.sin(phase) * swing;
  parts.armR.rotation.x = -Math.sin(phase) * swing;
  parts.legL.rotation.x = -Math.sin(phase) * swing * 1.1;
  parts.legR.rotation.x = Math.sin(phase) * swing * 1.1;
  parts.coat.rotation.x = (sprinting ? 0.12 : 0.04) * speedNorm + Math.sin(phase * 2) * 0.02 * speedNorm;
  parts.head.position.y = 1.68 + Math.abs(Math.sin(phase)) * 0.03 * speedNorm;
}
