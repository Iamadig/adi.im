import {
  MAX_GRAB_SLOTS,
  clearGrab,
  clearGrabSlot,
  createGrabState as createGrabStateForParticles,
  normalizeGrabSlot,
  updateGrabActivity,
} from './tearableGrabSlots';
import type { GrabState } from './tearableGrabSlots';
import { relaxClothBend, relaxClothCurvature } from './tearableClothCurvature';
import { relaxClothShear } from './tearableClothShear';
import { clampClothVelocity } from './tearableClothVelocity';

export const PAGE_W = 16;
export const PAGE_H = 9.2;
export const PASSIVE_LIFE = 3.6;
export { MAX_GRAB_SLOTS };
export type { GrabState };

export const W_DIV = 108;
export const H_DIV = 62;
export const W = W_DIV + 1;
export const H = H_DIV + 1;
export const N = W * H;
export const TOTAL_CELLS = W_DIV * H_DIV;
export const H_CONSTRAINTS = W_DIV * H;
export const V_CONSTRAINTS = W * H_DIV;
export const C_COUNT = H_CONSTRAINTS + V_CONSTRAINTS;

const REST_X = PAGE_W / W_DIV;
const REST_Y = PAGE_H / H_DIV;
const REST_DIAGONAL = Math.sqrt(REST_X * REST_X + REST_Y * REST_Y);
const TEAR_RATIO = 4.0;
const ITERATIONS = 3;
const ACTIVE_CONSTRAINT_STIFFNESS = 0.42;
const PASSIVE_CONSTRAINT_STIFFNESS = 0.34;
const ACTIVE_CONSTRAINT_COMPLIANCE = 0.000018;
const PASSIVE_CONSTRAINT_COMPLIANCE = 0.000032;
const ACTIVE_CURVATURE_STIFFNESS = 0.035;
const PASSIVE_CURVATURE_STIFFNESS = 0.045;
const ACTIVE_BEND_STIFFNESS = 0.055;
const PASSIVE_BEND_STIFFNESS = 0.045;
const ACTIVE_SHEAR_STIFFNESS = 0.16;
const PASSIVE_SHEAR_STIFFNESS = 0.12;
const DEFAULT_STEP_DT = 1 / 60;
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
  activeGrabSlots: number;
  grabCount: number;
  averageSpeed: number;
  maxSpeed: number;
  averageStretchRatio: number;
  maxStretchRatio: number;
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
  cLambda: Float32Array;
  cellAlive: Uint8Array;
  grab: GrabState;
  dirtyIndex: boolean;
  tearCount: number;
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
    cLambda: new Float32Array(C_COUNT),
    cellAlive: new Uint8Array(TOTAL_CELLS),
    grab: createGrabState(),
    dirtyIndex: false,
    tearCount: 0,
  };

  let k = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W - 1; x += 1, k += 1) {
    cloth.cA[k] = y * W + x;
    cloth.cB[k] = y * W + x + 1;
    cloth.cRest[k] = REST_X;
  }
  for (let y = 0; y < H - 1; y += 1) for (let x = 0; x < W; x += 1, k += 1) {
    cloth.cA[k] = y * W + x;
    cloth.cB[k] = (y + 1) * W + x;
    cloth.cRest[k] = REST_Y;
  }

  resetCloth(cloth);
  return cloth;
}

export function resetCloth(cloth: ClothData) {
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
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
  cloth.cLambda.fill(0);
  cloth.cellAlive.fill(1);
  clearGrab(cloth.grab);
  cloth.dirtyIndex = true;
  cloth.tearCount = 0;
}

export function createGrabState(): GrabState {
  return createGrabStateForParticles(N);
}

export function beginGrab(cloth: ClothData, x: number, y: number, slot = 0) {
  const slotId = normalizeGrabSlot(slot);
  const radiusSq = GRAB_RADIUS * GRAB_RADIUS;
  clearGrabSlot(cloth.grab, slotId);
  cloth.grab.activeSlots[slotId] = 1;
  cloth.grab.xBySlot[slotId] = x;
  cloth.grab.yBySlot[slotId] = y;
  cloth.grab.x = x;
  cloth.grab.y = y;
  const startCount = cloth.grab.count;
  for (let i = 0; i < N; i += 1) {
    if (cloth.pinned[i]) continue;
    if (cloth.grab.slotByParticle[i]) continue;
    const i3 = i * 3;
    const dx = cloth.positions[i3] - x;
    const dy = cloth.positions[i3 + 1] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radiusSq) continue;
    const slot = cloth.grab.count;
    cloth.grab.count += 1;
    cloth.grab.indices[slot] = i;
    cloth.grab.slotIds[slot] = slotId;
    cloth.grab.slotByParticle[i] = slot + 1;
    cloth.grab.weights[slot] = 1 - Math.sqrt(d2) / GRAB_RADIUS;
    cloth.grab.offsetX[slot] = dx;
    cloth.grab.offsetY[slot] = dy;
  }
  if (cloth.grab.count === startCount) cloth.grab.activeSlots[slotId] = 0;
  updateGrabActivity(cloth.grab);
  return cloth.grab.count > startCount;
}

export function moveGrab(cloth: ClothData, x: number, y: number, slot = 0) {
  const slotId = normalizeGrabSlot(slot);
  if (cloth.grab.activeSlots[slotId]) {
    cloth.grab.xBySlot[slotId] = x;
    cloth.grab.yBySlot[slotId] = y;
  }
  cloth.grab.x = x;
  cloth.grab.y = y;
}

export function releaseGrab(cloth: ClothData, slot?: number) {
  if (typeof slot === 'number') {
    clearGrabSlot(cloth.grab, normalizeGrabSlot(slot));
    return;
  }
  clearGrab(cloth.grab);
}

export function stepActive(cloth: ClothData, _mouse?: MouseState, damping = FRICTION, gravityScale = 1, dt = DEFAULT_STEP_DT) {
  const grabbed = cloth.grab.active && cloth.grab.count > 0;
  for (let i = 0; i < N; i += 1) {
    if (cloth.pinned[i]) continue;
    const i3 = i * 3;
    let x = cloth.positions[i3];
    let y = cloth.positions[i3 + 1];
    const z = cloth.positions[i3 + 2];
    const px = cloth.prev[i3];
    const py = cloth.prev[i3 + 1];
    const pz = cloth.prev[i3 + 2];

    if (grabbed && cloth.grab.slotByParticle[i]) {
      const entry = cloth.grab.slotByParticle[i] - 1;
      const slotId = cloth.grab.slotIds[entry];
      const weight = cloth.grab.weights[entry];
      x += (cloth.grab.xBySlot[slotId] + cloth.grab.offsetX[entry] - x) * GRAB_STRENGTH * weight;
      y += (cloth.grab.yBySlot[slotId] + cloth.grab.offsetY[entry] - y) * GRAB_STRENGTH * weight;
    }

    cloth.prev[i3] = x;
    cloth.prev[i3 + 1] = y;
    cloth.prev[i3 + 2] = z;
    cloth.positions[i3] = x + (x - px) * damping;
    cloth.positions[i3 + 1] = y + (y - py) * damping + GRAVITY * gravityScale * (1 + cloth.isolation[i] * 0.4);
    cloth.positions[i3 + 2] = z + (z - pz) * damping + cloth.isolation[i] * 0.0011;
  }
  relaxConstraints(cloth, TEAR_RATIO, true, ACTIVE_CONSTRAINT_STIFFNESS, ACTIVE_CONSTRAINT_COMPLIANCE, dt);
  relaxClothShear(cloth.positions, cloth.pinned, cloth.cellAlive, W, H, REST_DIAGONAL, ACTIVE_SHEAR_STIFFNESS);
  relaxClothCurvature(cloth.positions, cloth.pinned, cloth.cAlive, W, H, H_CONSTRAINTS, ACTIVE_CURVATURE_STIFFNESS);
  relaxClothBend(cloth.positions, cloth.pinned, cloth.cAlive, W, H, H_CONSTRAINTS, REST_X, REST_Y, ACTIVE_BEND_STIFFNESS);
  clampClothVelocity(cloth.positions, cloth.prev, 1.25);
}

export function dropPins(cloth: ClothData) {
  cloth.pinned.fill(0);
}

export function releaseTopEdge(cloth: ClothData) {
  cloth.pinned.fill(0);
  for (let k = 0; k < C_COUNT; k += 1) {
    if (!cloth.cAlive[k]) continue;
    const ay = Math.floor(cloth.cA[k] / W);
    const by = Math.floor(cloth.cB[k] / W);
    if (ay === 0 || by === 0) killConstraint(cloth, k);
  }
}

export function aliveFraction(cloth: ClothData) {
  let alive = 0;
  for (let i = 0; i < TOTAL_CELLS; i += 1) if (cloth.cellAlive[i]) alive += 1;
  return alive / TOTAL_CELLS;
}

export function tearProgress(cloth: ClothData) {
  return cloth.tearCount / C_COUNT;
}

export function getClothDebugState(cloth: ClothData): ClothDebugState {
  let pinnedTop = 0;
  for (let x = 0; x < W; x += 1) if (cloth.pinned[x]) pinnedTop += 1;
  let speedSum = 0;
  let maxSpeed = 0;
  for (let i = 0; i < N; i += 1) {
    const i3 = i * 3;
    const dx = cloth.positions[i3] - cloth.prev[i3];
    const dy = cloth.positions[i3 + 1] - cloth.prev[i3 + 1];
    const dz = cloth.positions[i3 + 2] - cloth.prev[i3 + 2];
    const speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
    speedSum += speed;
    if (speed > maxSpeed) maxSpeed = speed;
  }
  let stretchSum = 0;
  let maxStretchRatio = 1;
  let stretchCount = 0;
  for (let k = 0; k < C_COUNT; k += 1) {
    if (!cloth.cAlive[k]) continue;
    const a3 = cloth.cA[k] * 3;
    const b3 = cloth.cB[k] * 3;
    const dx = cloth.positions[a3] - cloth.positions[b3];
    const dy = cloth.positions[a3 + 1] - cloth.positions[b3 + 1];
    const dz = cloth.positions[a3 + 2] - cloth.positions[b3 + 2];
    const ratio = Math.sqrt(dx * dx + dy * dy + dz * dz) / cloth.cRest[k];
    stretchSum += ratio;
    if (ratio > maxStretchRatio) maxStretchRatio = ratio;
    stretchCount += 1;
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
    activeGrabSlots: cloth.grab.activeSlotCount,
    grabCount: cloth.grab.count,
    averageSpeed: speedSum / N,
    maxSpeed,
    averageStretchRatio: stretchCount ? stretchSum / stretchCount : 1,
    maxStretchRatio,
  };
}

export function stepPassiveCloth(cloth: ClothData, dt: number) {
  for (let i = 0; i < N; i += 1) {
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
  relaxConstraints(cloth, 6, false, PASSIVE_CONSTRAINT_STIFFNESS, PASSIVE_CONSTRAINT_COMPLIANCE, dt);
  relaxClothShear(cloth.positions, cloth.pinned, cloth.cellAlive, W, H, REST_DIAGONAL, PASSIVE_SHEAR_STIFFNESS);
  relaxClothCurvature(cloth.positions, cloth.pinned, cloth.cAlive, W, H, H_CONSTRAINTS, PASSIVE_CURVATURE_STIFFNESS);
  relaxClothBend(cloth.positions, cloth.pinned, cloth.cAlive, W, H, H_CONSTRAINTS, REST_X, REST_Y, PASSIVE_BEND_STIFFNESS);
  clampClothVelocity(cloth.positions, cloth.prev, 0.9);
}

export function averageMotion(cloth: ClothData) {
  let cx = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < N; i += 1) {
    const i3 = i * 3;
    const x = cloth.positions[i3];
    const y = cloth.positions[i3 + 1];
    cx += x;
    vx += x - cloth.prev[i3];
    vy += y - cloth.prev[i3 + 1];
  }
  return { cx: cx / N, vx: vx / N, vy: vy / N };
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeNormals(cloth: ClothData) {
  cloth.normals.fill(0);
  for (let cy = 0; cy < H_DIV; cy += 1) for (let cx = 0; cx < W_DIV; cx += 1) {
    if (!cloth.cellAlive[cy * W_DIV + cx]) continue;
    const tl = cy * W + cx;
    const tr = tl + 1;
    const bl = (cy + 1) * W + cx;
    const br = bl + 1;
    addFaceNormal(cloth, tl, bl, tr);
    addFaceNormal(cloth, tr, bl, br);
  }
  for (let i = 0; i < N; i += 1) {
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

export function buildAliveIndex(cloth: ClothData) {
  const indices = new Uint32Array(TOTAL_CELLS * 6);
  let k = 0;
  for (let cy = 0; cy < H_DIV; cy += 1) for (let cx = 0; cx < W_DIV; cx += 1) {
    if (!cloth.cellAlive[cy * W_DIV + cx]) continue;
    const tl = cy * W + cx;
    const tr = tl + 1;
    const bl = (cy + 1) * W + cx;
    const br = bl + 1;
    indices[k] = tl; indices[k + 1] = bl; indices[k + 2] = tr;
    indices[k + 3] = tr; indices[k + 4] = bl; indices[k + 5] = br;
    k += 6;
  }
  return indices.slice(0, k);
}

function killConstraint(cloth: ClothData, k: number) {
  if (!cloth.cAlive[k]) return;
  cloth.cAlive[k] = 0;
  cloth.cLambda[k] = 0;
  cloth.isolation[cloth.cA[k]] = Math.min(6, cloth.isolation[cloth.cA[k]] + 1);
  cloth.isolation[cloth.cB[k]] = Math.min(6, cloth.isolation[cloth.cB[k]] + 1);
  killCellsForConstraint(cloth, k);
  cloth.dirtyIndex = true;
  cloth.tearCount += 1;
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

function relaxConstraints(cloth: ClothData, tearRatio: number, canTear: boolean, stiffness: number, compliance: number, dt: number) {
  cloth.cLambda.fill(0);
  const alpha = compliance / Math.max(0.000001, dt * dt);
  for (let iter = 0; iter < ITERATIONS; iter += 1) {
    for (let k = 0; k < C_COUNT; k += 1) {
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
      const pa = cloth.pinned[a] ? 0 : 1;
      const pb = cloth.pinned[b] ? 0 : 1;
      const sum = pa + pb;
      if (!sum) continue;
      const constraint = dist - cloth.cRest[k];
      const deltaLambda = (-constraint - alpha * cloth.cLambda[k]) / (sum + alpha) * stiffness;
      cloth.cLambda[k] += deltaLambda;
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      cloth.positions[a3] += pa * deltaLambda * nx;
      cloth.positions[a3 + 1] += pa * deltaLambda * ny;
      cloth.positions[a3 + 2] += pa * deltaLambda * nz;
      cloth.positions[b3] -= pb * deltaLambda * nx;
      cloth.positions[b3 + 1] -= pb * deltaLambda * ny;
      cloth.positions[b3 + 2] -= pb * deltaLambda * nz;
    }
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
