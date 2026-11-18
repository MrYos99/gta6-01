// NEONFALL 2100 — procedural Voltspire: 600x600 m, 6 districts, ~90 neon
// buildings, 3 sky-lane altitudes (marked by rooftop pads), beach + sea.
// Built from InstancedMeshes (one per archetype per material) so the whole
// city costs a few dozen draw calls, not hundreds.
import * as THREE from 'three';
import { DISTRICTS, MAP, QUALITY, DEBUG_HIDE } from './config.js';
import {
  ARCHETYPE_COUNT, buildArchetypes, lambert, makeGroundTexture, makeSignTexture,
  makeWindowTexture,
} from './models.js';

const SIGN_NAMES = [
  ['N00DLE', '#00f0ff'], ['HELIX', '#e8f4ff'], ['VOLT', '#ffb300'],
  ['SKYPORT', '#ff7a1a'], ['LANTERN', '#ffb300'], ['CYBER CLINIC', '#00f0ff'],
  ['NEON ROW', '#ff2d78'], ['VOLTSPIRE', '#00f0ff'], ['SKYLANE', '#2de8c4'],
  ['HOLO MART', '#ff2d78'], ['OCT\'S', '#ffb300'], ['THE GARDENS', '#b78cff'],
];

function districtAt(x, z) {
  if (x >= MAP.shoreX) return DISTRICTS.shore;
  if (z < -60 && x >= -120) return DISTRICTS.spire;
  if (z < -60) return DISTRICTS.gardens;
  if (z >= 60 && x < -120) return DISTRICTS.rustworks;
  if (z >= 60 && x >= 120) return DISTRICTS.skyport;
  return DISTRICTS.neonrow;
}

function archetypesFor(district) {
  if (district === DISTRICTS.spire) return [0, 1, 2, 0, 1];
  if (district === DISTRICTS.neonrow) return [1, 2, 3, 3];
  if (district === DISTRICTS.gardens) return [3, 5, 5];
  if (district === DISTRICTS.rustworks) return [3, 4, 4];
  return [4, 3, 4]; // skyport
}

export function buildCity(scene, random) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const buildings = [];

  // --- Ground: 540x600 m map texture (x -300..240) + sand + sea. ---
  const groundTex = DEBUG_HIDE.has('ground') ? null : makeGroundTexture(random);
  if (groundTex) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(540, 600),
      lambert({ map: groundTex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-30, 0, 0);
    ground.receiveShadow = true;
    group.add(ground);
  }

  if (!DEBUG_HIDE.has('ground')) {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 600),
      lambert({ color: 0xe3d3a4 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(270, 0.02, 0);
    sand.receiveShadow = true;
    group.add(sand);
  }

  // Sea: animated wave texture, the map's eastern edge (not swimmable).
  let seaTex = null;
  if (!DEBUG_HIDE.has('ground')) {
    const seaCanvas = document.createElement('canvas');
    seaCanvas.width = 256;
    seaCanvas.height = 256;
    const sctx = seaCanvas.getContext('2d');
    sctx.fillStyle = '#1e7fb8';
    sctx.fillRect(0, 0, 256, 256);
    sctx.strokeStyle = 'rgba(232,244,255,0.35)';
    sctx.lineWidth = 3;
    for (let i = 0; i < 14; i += 1) {
      sctx.beginPath();
      const y = i * 20 + 6;
      for (let x = 0; x <= 256; x += 16) sctx.lineTo(x, y + Math.sin(x / 40 + i) * 5);
      sctx.stroke();
    }
    seaTex = new THREE.CanvasTexture(seaCanvas);
    seaTex.colorSpace = THREE.SRGBColorSpace;
    seaTex.wrapS = THREE.RepeatWrapping;
    seaTex.wrapT = THREE.RepeatWrapping;
    seaTex.repeat.set(6, 6);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 640),
      lambert({ map: seaTex }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(560, -0.5, 0);
    group.add(sea);
  }

  // --- Buildings: one placement per block, instanced per archetype. ---
  const archetypes = buildArchetypes(random);
  const windowTex = [0, 1, 2].map((v) => makeWindowTexture(random, v));
  const bodyMat = windowTex.map((tex) => lambert({ map: tex }));
  const roofMat = lambert({ color: 0x2a2f38 });
  const trimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const placements = Array.from({ length: ARCHETYPE_COUNT }, () => []);

  // Blocks left empty: a Neon Row plaza, a Skyport landing pad, a Gardens park.
  const emptyBlocks = new Set(['-30,90', '150,210', '-210,-210']);
  for (let i = 0; i < 9; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      const cx = -270 + i * 60, cz = -270 + j * 60;
      if (emptyBlocks.has(`${cx},${cz}`)) continue;
      const district = districtAt(cx, cz);
      const kinds = archetypesFor(district);
      const kind = kinds[Math.floor(random() * kinds.length)];
      const h = district.minH + random() * (district.maxH - district.minH);
      const w = 28 + random() * 14, d = 28 + random() * 14;
      const rotY = random() < 0.5 ? 0 : Math.PI / 2;
      const m = new THREE.Matrix4();
      m.makeRotationY(rotY);
      m.scale(new THREE.Vector3(w / 32, h / 40, d / 32));
      m.setPosition(cx, 0, cz);
      placements[kind].push({ matrix: m, district, h, w, d, x: cx, z: cz, rotY });
      buildings.push({ kind, district, h, w, d, x: cx, z: cz, rotY });
      const hw = (rotY === 0 ? w : d) / 2, hd = (rotY === 0 ? d : w) / 2;
      colliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
    }
  }

  const dummy = new THREE.Object3D();
  if (!DEBUG_HIDE.has('buildings')) {
    for (let kind = 0; kind < ARCHETYPE_COUNT; kind += 1) {
      const list = placements[kind];
      if (list.length === 0) continue;
      const body = new THREE.InstancedMesh(archetypes[kind].sides, bodyMat[kind % 3], list.length);
      const caps = new THREE.InstancedMesh(archetypes[kind].caps, roofMat, list.length);
      const trim = new THREE.InstancedMesh(archetypes[kind].trim, trimMat, list.length);
      list.forEach((p, idx) => {
        body.setMatrixAt(idx, p.matrix);
        caps.setMatrixAt(idx, p.matrix);
        trim.setMatrixAt(idx, p.matrix);
        const shade = 0.85 + random() * 0.15;
        body.setColorAt(idx, new THREE.Color(shade, shade, shade));
        trim.setColorAt(idx, new THREE.Color(p.district.accent));
      });
      body.castShadow = true;
      body.receiveShadow = true;
      caps.castShadow = true;
      trim.instanceMatrix.needsUpdate = true;
      group.add(body, caps, trim);
    }
  }

  if (!DEBUG_HIDE.has('props')) {
    // --- Rooftop landing pads (cyan rings) on tall Spire rooftops + the Skyport pad. ---
    const padGeo = new THREE.RingGeometry(8, 10, 32);
    const padMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const padSpots = buildings
      .filter((b) => b.district === DISTRICTS.spire && b.h > 70)
      .slice(0, 7)
      .map((b) => ({ x: b.x, y: b.h + 0.3, z: b.z }));
    padSpots.push({ x: 150, y: 0.15, z: 210 }); // Skyport ground pad
    const pads = new THREE.InstancedMesh(padGeo, padMat, padSpots.length);
    padSpots.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pads.setMatrixAt(idx, dummy.matrix);
    });
    group.add(pads);
  }

  if (!DEBUG_HIDE.has('props')) {
    // --- Holo-signs on building faces toward the map centre. ---
    const signGeo = new THREE.PlaneGeometry(14, 3.5);
  const signTargets = buildings.filter((b) => b.district !== DISTRICTS.skyport);
  for (let s = 0; s < SIGN_NAMES.length; s += 1) {
    const b = signTargets[Math.floor(random() * signTargets.length)];
    const [text, color] = SIGN_NAMES[s];
    const mat = new THREE.MeshBasicMaterial({
      map: makeSignTexture(text, color), transparent: true, side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sign = new THREE.Mesh(signGeo, mat);
    const toCentreX = -b.x, toCentreZ = -b.z;
    const y = b.h * (0.55 + random() * 0.25);
    if (Math.abs(toCentreX) > Math.abs(toCentreZ)) {
      const dir = Math.sign(toCentreX);
      sign.position.set(b.x + dir * (b.w / 2 + 0.4), y, b.z);
      sign.rotation.y = dir * Math.PI / 2;
    } else {
      const dir = Math.sign(toCentreZ);
      sign.position.set(b.x, y, b.z + dir * (b.d / 2 + 0.4));
      sign.rotation.y = dir > 0 ? 0 : Math.PI;
    }
    group.add(sign);
  }

  // --- Street lamps at every other intersection. ---
  const lampPole = new THREE.CylinderGeometry(0.09, 0.12, 5.5, 6);
  lampPole.translate(0, 2.75, 0);
  const lampHead = new THREE.BoxGeometry(0.5, 0.18, 0.5);
  lampHead.translate(0, 5.6, 0);
  const lampPositions = [];
  for (let a = -4; a <= 4; a += 1) {
    for (let b = -4; b <= 4; b += 1) {
      if ((a + b) % 2 !== 0) continue;
      lampPositions.push([a * 60 + 7, b * 60 + 7]);
    }
  }
  const poles = new THREE.InstancedMesh(
    lampPole, lambert({ color: 0x2a2f38 }), lampPositions.length,
  );
  const heads = new THREE.InstancedMesh(
    lampHead, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), lampPositions.length,
  );
  lampPositions.forEach(([x, z], idx) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(idx, dummy.matrix);
    heads.setMatrixAt(idx, dummy.matrix);
  });
  group.add(poles, heads);

  // --- The Shore: boardwalk, pier, parasols. ---
  const woodMat = lambert({ color: 0x8a6b46 });
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 600), woodMat);
  boardwalk.position.set(241.5, 0.15, 0);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(80, 0.4, 8), woodMat);
  pier.position.set(340, 0.2, 0);
  pier.receiveShadow = true;
  group.add(pier);
  const parasolPole = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6);
  parasolPole.translate(0, 1.1, 0);
  const parasolTop = new THREE.ConeGeometry(1.8, 0.9, 10);
  parasolTop.translate(0, 2.4, 0);
  const parasolSpots = [];
  for (let i = 0; i < 8; i += 1) {
    parasolSpots.push([252 + random() * 36, -240 + random() * 480]);
  }
  const pPoles = new THREE.InstancedMesh(
    parasolPole, lambert({ color: 0xdddddd }), parasolSpots.length,
  );
  const pTops = new THREE.InstancedMesh(
    parasolTop, lambert({ color: 0xffffff }), parasolSpots.length,
  );
  const parasolColors = [0xff2d78, 0x00f0ff, 0xffb300, 0xffffff];
  parasolSpots.forEach(([x, z], idx) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pPoles.setMatrixAt(idx, dummy.matrix);
    pTops.setMatrixAt(idx, dummy.matrix);
    pTops.setColorAt(idx, new THREE.Color(parasolColors[idx % parasolColors.length]));
  });
    group.add(pPoles, pTops);
  }

  return {
    group, colliders, buildings, seaTex,
    spawn: { x: 0, z: 0, yaw: Math.PI }, // intersection in Neon Row, facing the Spire (north)
  };
}
