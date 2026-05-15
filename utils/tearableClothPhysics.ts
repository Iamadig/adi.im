import * as THREE from 'three';

export const PAGE_W = 16;
export const PAGE_H = 9.2;
export const PASSIVE_LIFE = 3.6;

const PASSIVE_START_OPACITY = 0.96;
const W_DIV = 108;
const H_DIV = 62;
const W = W_DIV + 1;
const H = H_DIV + 1;
const N = W * H;
const TOTAL_CELLS = W_DIV * H_DIV;
const H_CONSTRAINTS = W_DIV * H;
const V_CONSTRAINTS = W * H_DIV;
const C_COUNT = H_CONSTRAINTS + V_CONSTRAINTS;
const REST_X = PAGE_W / W_DIV;
const REST_Y = PAGE_H / H_DIV;

const TEAR_RATIO = 4.0;
const ITERATIONS = 2;
const FRICTION = 0.978;
const GRAVITY = -0.0009;
const PASSIVE_GRAVITY = -0.00075;
const GRAB_RADIUS = 0.52;
const GRAB_STRENGTH = 0.58;

export type TearPhase = 'idle' | 'dragging' | 'torn' | 'dropping' | 'advancing';

export interface MouseState {
  x: number;
  y: number;
  px: number;
  py: number;
  down: boolean;
  active: boolean;
}

export interface ClothDebugState {
  aliveFraction: number;
  brokenConstraints: number;
  constraintCount: number;
  tearPercent: number;
  gridWidth: number;
  gridHeight: number;
  pinnedTop: number;
  grabActive: boolean;
  grabCount: number;
  averageSpeed: number;
  maxSpeed: number;
}

interface GrabState {
  active: boolean;
  x: number;
  y: number;
  indices: Int32Array;
  slotByParticle: Int32Array;
  weights: Float32Array;
  offsetX: Float32Array;
  offsetY: Float32Array;
  count: number;
}

export interface ClothData {
  positions: Float32Array;
  prev: Float32Array;
  normals: Float32Array;
  pinned: Uint8Array;
  isolation: Float32Array;
  uvs: Float32Array;
  cA: Int32Array;
  cB: Int32Array;
  cRest: Float32Array;
  cAlive: Uint8Array;
  cellAlive: Uint8Array;
  grab: GrabState;
  dirtyIndex: boolean;
  tearCount: number;
}

export interface PassiveCloth {
  cloth: ClothData;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  mesh: THREE.Mesh;
  texture: THREE.Texture;
  age: number;
}

export function createMouseState(): MouseState {
  return { x: 0, y: 0, px: 0, py: 0, down: false, active: false };
}

export function createCloth(): ClothData {
  const cloth: ClothData = {
    positions: new Float32Array(N * 3),
    prev: new Float32Array(N * 3),
    normals: new Float32Array(N * 3),
    pinned: new Uint8Array(N),
    isolation: new Float32Array(N),
    uvs: new Float32Array(N * 2),
    cA: new Int32Array(C_COUNT),
    cB: new Int32Array(C_COUNT),
    cRest: new Float32Array(C_COUNT),
    cAlive: new Uint8Array(C_COUNT),
    cellAlive: new Uint8Array(TOTAL_CELLS),
    grab: {
      active: false,
      x: 0,
      y: 0,
      indices: new Int32Array(N),
      slotByParticle: new Int32Array(N),
      weights: new Float32Array(N),
      offsetX: new Float32Array(N),
      offsetY: new Float32Array(N),
      count: 0,
    },
    dirtyIndex: false,
    tearCount: 0,
  };
  let k = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++, k++) {
    cloth.cA[k] = y * W + x;
    cloth.cB[k] = y * W + x + 1;
    cloth.cRest[k] = REST_X;
  }
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++, k++) {
    cloth.cA[k] = y * W + x;
    cloth.cB[k] = (y + 1) * W + x;
    cloth.cRest[k] = REST_Y;
  }
  resetCloth(cloth);
  return cloth;
}

export function resetCloth(cloth: ClothData) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const px = (x / W_DIV - 0.5) * PAGE_W;
    const py = (0.5 - y / H_DIV) * PAGE_H;
    const i3 = i * 3;
    cloth.positions[i3] = px;
    cloth.positions[i3 + 1] = py;
    cloth.positions[i3 + 2] = 0;
    cloth.prev[i3] = px;
    cloth.prev[i3 + 1] = py;
    cloth.prev[i3 + 2] = 0;
    cloth.normals[i3] = 0;
    cloth.normals[i3 + 1] = 0;
    cloth.normals[i3 + 2] = 1;
    cloth.uvs[i * 2] = x / W_DIV;
    cloth.uvs[i * 2 + 1] = 1 - y / H_DIV;
    cloth.pinned[i] = y === 0 ? 1 : 0;
    cloth.isolation[i] = 0;
  }
  cloth.cAlive.fill(1);
  cloth.cellAlive.fill(1);
  clearGrab(cloth.grab);
  cloth.dirtyIndex = true;
  cloth.tearCount = 0;
}

export function createGeometry(cloth: ClothData) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(cloth.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(cloth.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(cloth.uvs, 2));
  rebuildIndex(geometry, cloth);
  return geometry;
}

export function commitGeometry(geometry: THREE.BufferGeometry, cloth: ClothData) {
  computeNormals(cloth);
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.normal.needsUpdate = true;
}

export function rebuildIndex(geometry: THREE.BufferGeometry, cloth: ClothData) {
  const indices = new Uint32Array(TOTAL_CELLS * 6);
  let k = 0;
  for (let cy = 0; cy < H_DIV; cy++) for (let cx = 0; cx < W_DIV; cx++) {
    if (!cloth.cellAlive[cy * W_DIV + cx]) continue;
    const tl = cy * W + cx;
    const tr = tl + 1;
    const bl = (cy + 1) * W + cx;
    const br = bl + 1;
    indices[k++] = tl; indices[k++] = bl; indices[k++] = tr;
    indices[k++] = tr; indices[k++] = bl; indices[k++] = br;
  }
  geometry.setIndex(new THREE.BufferAttribute(indices.slice(0, k), 1));
  cloth.dirtyIndex = false;
}

export function beginGrab(cloth: ClothData, x: number, y: number) {
  const radiusSq = GRAB_RADIUS * GRAB_RADIUS;
  cloth.grab.active = true;
  cloth.grab.x = x;
  cloth.grab.y = y;
  for (let slot = 0; slot < cloth.grab.count; slot++) cloth.grab.slotByParticle[cloth.grab.indices[slot]] = 0;
  cloth.grab.count = 0;
  for (let i = 0; i < N; i++) {
    if (cloth.pinned[i]) continue;
    const i3 = i * 3;
    const dx = cloth.positions[i3] - x;
    const dy = cloth.positions[i3 + 1] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radiusSq) continue;
    const slot = cloth.grab.count++;
    cloth.grab.indices[slot] = i;
    cloth.grab.slotByParticle[i] = slot + 1;
    cloth.grab.weights[slot] = 1 - Math.sqrt(d2) / GRAB_RADIUS;
    cloth.grab.offsetX[slot] = dx;
    cloth.grab.offsetY[slot] = dy;
  }
  return cloth.grab.count > 0;
}

export function moveGrab(cloth: ClothData, x: number, y: number) {
  cloth.grab.x = x;
  cloth.grab.y = y;
}

export function releaseGrab(cloth: ClothData) {
  clearGrab(cloth.grab);
}

export function stepActive(cloth: ClothData, _mouse?: MouseState, damping = FRICTION, gravityScale = 1) {
  const grabbed = cloth.grab.active && cloth.grab.count > 0;
  for (let i = 0; i < N; i++) {
    if (cloth.pinned[i]) continue;
    const i3 = i * 3;
    let x = cloth.positions[i3];
    let y = cloth.positions[i3 + 1];
    const z = cloth.positions[i3 + 2];
    const px = cloth.prev[i3];
    const py = cloth.prev[i3 + 1];
    const pz = cloth.prev[i3 + 2];

    if (grabbed && cloth.grab.slotByParticle[i]) {
      const slot = cloth.grab.slotByParticle[i] - 1;
      const weight = cloth.grab.weights[slot];
      x += (cloth.grab.x + cloth.grab.offsetX[slot] - x) * GRAB_STRENGTH * weight;
      y += (cloth.grab.y + cloth.grab.offsetY[slot] - y) * GRAB_STRENGTH * weight;
    }

    cloth.prev[i3] = x;
    cloth.prev[i3 + 1] = y;
    cloth.prev[i3 + 2] = z;
    cloth.positions[i3] = x + (x - px) * damping;
    cloth.positions[i3 + 1] = y + (y - py) * damping + GRAVITY * gravityScale * (1 + cloth.isolation[i] * 0.4);
    cloth.positions[i3 + 2] = z + (z - pz) * damping + cloth.isolation[i] * 0.0011;
  }
  relaxConstraints(cloth, TEAR_RATIO, true);
}

export function releaseTopEdge(cloth: ClothData) {
  cloth.pinned.fill(0);
  for (let k = 0; k < C_COUNT; k++) {
    if (!cloth.cAlive[k]) continue;
    const ay = Math.floor(cloth.cA[k] / W);
    const by = Math.floor(cloth.cB[k] / W);
    if (ay === 0 || by === 0) killConstraint(cloth, k);
  }
}

export function aliveFraction(cloth: ClothData) {
  let alive = 0;
  for (let i = 0; i < TOTAL_CELLS; i++) if (cloth.cellAlive[i]) alive++;
  return alive / TOTAL_CELLS;
}

export function tearProgress(cloth: ClothData) {
  return cloth.tearCount / C_COUNT;
}

export function getClothDebugState(cloth: ClothData): ClothDebugState {
  let pinnedTop = 0;
  for (let x = 0; x < W; x++) if (cloth.pinned[x]) pinnedTop++;
  let speedSum = 0;
  let maxSpeed = 0;
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const dx = cloth.positions[i3] - cloth.prev[i3];
    const dy = cloth.positions[i3 + 1] - cloth.prev[i3 + 1];
    const dz = cloth.positions[i3 + 2] - cloth.prev[i3 + 2];
    const speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
    speedSum += speed;
    if (speed > maxSpeed) maxSpeed = speed;
  }
  return {
    aliveFraction: aliveFraction(cloth),
    brokenConstraints: cloth.tearCount,
    constraintCount: C_COUNT,
    tearPercent: tearProgress(cloth) * 100,
    gridWidth: W_DIV,
    gridHeight: H_DIV,
    pinnedTop,
    grabActive: cloth.grab.active,
    grabCount: cloth.grab.count,
    averageSpeed: speedSum / N,
    maxSpeed,
  };
}

export function snapshotPassive(source: ClothData, texture: THREE.Texture, scene: THREE.Scene, dropImpulse: number): PassiveCloth {
  const cloth: ClothData = {
    positions: source.positions.slice(),
    prev: source.prev.slice(),
    normals: source.normals.slice(),
    pinned: new Uint8Array(N),
    isolation: source.isolation.slice(),
    uvs: source.uvs.slice(),
    cA: source.cA,
    cB: source.cB,
    cRest: source.cRest,
    cAlive: source.cAlive.slice(),
    cellAlive: source.cellAlive.slice(),
    grab: {
      active: false,
      x: 0,
      y: 0,
      indices: new Int32Array(N),
      slotByParticle: new Int32Array(N),
      weights: new Float32Array(N),
      offsetX: new Float32Array(N),
      offsetY: new Float32Array(N),
      count: 0,
    },
    dirtyIndex: false,
    tearCount: source.tearCount,
  };
  for (let i = 0; i < N; i++) cloth.prev[i * 3 + 1] = cloth.positions[i * 3 + 1] + dropImpulse;
  const geometry = createGeometry(cloth);
  const material = createPaperMaterial(texture, true);
  material.opacity = PASSIVE_START_OPACITY;
  material.depthWrite = false;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = 0.22;
  scene.add(mesh);
  return { cloth, geometry, material, mesh, texture, age: 0 };
}

export function stepPassive(passive: PassiveCloth, dt: number) {
  passive.age += dt;
  const { cloth } = passive;
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const x = cloth.positions[i3];
    const y = cloth.positions[i3 + 1];
    const z = cloth.positions[i3 + 2];
    const px = cloth.prev[i3];
    const py = cloth.prev[i3 + 1];
    const pz = cloth.prev[i3 + 2];
    cloth.prev[i3] = x;
    cloth.prev[i3 + 1] = y;
    cloth.prev[i3 + 2] = z;
    cloth.positions[i3] = x + (x - px) * 0.99;
    cloth.positions[i3 + 1] = y + (y - py) * 0.99 + PASSIVE_GRAVITY;
    cloth.positions[i3 + 2] = Math.min(0.08, z + (z - pz) * 0.99 + 0.0012);
  }
  relaxConstraints(cloth, 6, false);
  commitGeometry(passive.geometry, cloth);
  const fadeStart = PASSIVE_LIFE * 0.55;
  passive.material.opacity = passive.age < fadeStart
    ? PASSIVE_START_OPACITY
    : Math.max(0, PASSIVE_START_OPACITY * (1 - (passive.age - fadeStart) / (PASSIVE_LIFE - fadeStart)));
}

export function disposePassive(passive: PassiveCloth, scene: THREE.Scene) {
  scene.remove(passive.mesh);
  passive.geometry.dispose();
  passive.material.dispose();
  passive.texture.dispose();
}

export function createPaperMaterial(texture: THREE.Texture, transparent = false) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
    transparent,
    opacity: 1,
  });
}

function clearGrab(grab: GrabState) {
  for (let slot = 0; slot < grab.count; slot++) grab.slotByParticle[grab.indices[slot]] = 0;
  grab.active = false;
  grab.count = 0;
}

function killConstraint(cloth: ClothData, k: number) {
  if (!cloth.cAlive[k]) return;
  cloth.cAlive[k] = 0;
  cloth.isolation[cloth.cA[k]] = Math.min(6, cloth.isolation[cloth.cA[k]] + 1);
  cloth.isolation[cloth.cB[k]] = Math.min(6, cloth.isolation[cloth.cB[k]] + 1);
  killCellsForConstraint(cloth, k);
  cloth.dirtyIndex = true;
  cloth.tearCount++;
}

function killCellsForConstraint(cloth: ClothData, k: number) {
  if (k < H_CONSTRAINTS) {
    const x = k % W_DIV;
    const y = Math.floor(k / W_DIV);
    if (y > 0) cloth.cellAlive[(y - 1) * W_DIV + x] = 0;
    if (y < H_DIV) cloth.cellAlive[y * W_DIV + x] = 0;
    return;
  }
  const idx = k - H_CONSTRAINTS;
  const x = idx % W;
  const y = Math.floor(idx / W);
  if (x > 0) cloth.cellAlive[y * W_DIV + x - 1] = 0;
  if (x < W_DIV) cloth.cellAlive[y * W_DIV + x] = 0;
}

function relaxConstraints(cloth: ClothData, tearRatio: number, canTear: boolean) {
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let k = 0; k < C_COUNT; k++) {
      if (!cloth.cAlive[k]) continue;
      const a = cloth.cA[k];
      const b = cloth.cB[k];
      const a3 = a * 3;
      const b3 = b * 3;
      const dx = cloth.positions[a3] - cloth.positions[b3];
      const dy = cloth.positions[a3 + 1] - cloth.positions[b3 + 1];
      const dz = cloth.positions[a3 + 2] - cloth.positions[b3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist === 0) continue;
      if (canTear && dist > cloth.cRest[k] * tearRatio) {
        killConstraint(cloth, k);
        continue;
      }
      const diff = (cloth.cRest[k] - dist) / dist * 0.5;
      const pa = cloth.pinned[a] ? 0 : 1;
      const pb = cloth.pinned[b] ? 0 : 1;
      const sum = pa + pb;
      if (!sum) continue;
      const wa = (pa / sum) * 2;
      const wb = (pb / sum) * 2;
      cloth.positions[a3] += dx * diff * wa;
      cloth.positions[a3 + 1] += dy * diff * wa;
      cloth.positions[a3 + 2] += dz * diff * wa;
      cloth.positions[b3] -= dx * diff * wb;
      cloth.positions[b3 + 1] -= dy * diff * wb;
      cloth.positions[b3 + 2] -= dz * diff * wb;
    }
  }
}

function computeNormals(cloth: ClothData) {
  cloth.normals.fill(0);
  for (let cy = 0; cy < H_DIV; cy++) for (let cx = 0; cx < W_DIV; cx++) {
    if (!cloth.cellAlive[cy * W_DIV + cx]) continue;
    const tl = cy * W + cx;
    const tr = tl + 1;
    const bl = (cy + 1) * W + cx;
    const br = bl + 1;
    addFaceNormal(cloth, tl, bl, tr);
    addFaceNormal(cloth, tr, bl, br);
  }
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const nx = cloth.normals[i3];
    const ny = cloth.normals[i3 + 1];
    const nz = cloth.normals[i3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    cloth.normals[i3] = nx / len;
    cloth.normals[i3 + 1] = ny / len;
    cloth.normals[i3 + 2] = nz / len;
  }
}

function addFaceNormal(cloth: ClothData, a: number, b: number, c: number) {
  const a3 = a * 3;
  const b3 = b * 3;
  const c3 = c * 3;
  const abx = cloth.positions[b3] - cloth.positions[a3];
  const aby = cloth.positions[b3 + 1] - cloth.positions[a3 + 1];
  const abz = cloth.positions[b3 + 2] - cloth.positions[a3 + 2];
  const acx = cloth.positions[c3] - cloth.positions[a3];
  const acy = cloth.positions[c3 + 1] - cloth.positions[a3 + 1];
  const acz = cloth.positions[c3 + 2] - cloth.positions[a3 + 2];
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  cloth.normals[a3] += nx; cloth.normals[a3 + 1] += ny; cloth.normals[a3 + 2] += nz;
  cloth.normals[b3] += nx; cloth.normals[b3 + 1] += ny; cloth.normals[b3 + 2] += nz;
  cloth.normals[c3] += nx; cloth.normals[c3 + 1] += ny; cloth.normals[c3 + 2] += nz;
}
