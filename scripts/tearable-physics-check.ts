import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  beginGrab,
  cutClothSegment,
  createCloth,
  createGeometry,
  createPaperMaterial,
  commitGeometry,
  getClothDebugState,
  moveGrab,
  promoteLivePassive,
  releaseGrab,
  setGeometryIndex,
  stepActive,
  stepPassive,
} from '../utils/tearableClothPhysics';
import type { PassiveCloth } from '../utils/tearableClothPhysics';
import { H, W, buildAliveIndex } from '../utils/tearableClothCore';
import { relaxClothShear } from '../utils/tearableClothShear';
import { raycastClothGrid } from '../utils/tearableClothRaycast';
import { clampClothVelocity } from '../utils/tearableClothVelocity';
import { hasUnsafeActiveFold } from '../utils/tearableClothSafety';
import { snapshotClothForWorker } from '../utils/tearableClothWorkerState';
import { ActiveClothWorkerController, PassiveClothWorkerController } from '../utils/tearableWorkerControllers';

function averageY(positions: Float32Array) {
  let total = 0;
  for (let i = 1; i < positions.length; i += 3) total += positions[i];
  return total / (positions.length / 3);
}

function averageVelocityY(positions: Float32Array, prev: Float32Array) {
  let total = 0;
  for (let i = 1; i < positions.length; i += 3) total += positions[i] - prev[i];
  return total / (positions.length / 3);
}

function localCurvature(positions: Float32Array, center: number, first: number, second: number) {
  return Math.abs(positions[center * 3 + 2] - (positions[first * 3 + 2] + positions[second * 3 + 2]) * 0.5);
}

function diagonalError(positions: Float32Array) {
  const rest = Math.SQRT2;
  const first = Math.hypot(positions[0] - positions[9], positions[1] - positions[10], positions[2] - positions[11]);
  const second = Math.hypot(positions[3] - positions[6], positions[4] - positions[7], positions[5] - positions[8]);
  return Math.abs(first - rest) + Math.abs(second - rest);
}

const canvasDrawingSource = readFileSync(new URL('../utils/tearableCanvasDrawing.ts', import.meta.url), 'utf8');
const textureUploadSource = readFileSync(new URL('../utils/tearableTextureUpload.ts', import.meta.url), 'utf8');
assert.ok(
  !canvasDrawingSource.includes('destination-out'),
  'decorative canvas helpers should not punch transparent holes that render as black blobs on opaque Three materials',
);
assert.ok(
  !textureUploadSource.includes('addUpdateRange'),
  'texture repaints should avoid partial DataTexture row uploads that can mirror row bands with flipY',
);

const safeCloth = createCloth();
assert.equal(hasUnsafeActiveFold(safeCloth), false, 'fresh active cloth should not report an unsafe fold');
for (let y = 8; y < 22; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const i3 = (y * W + x) * 3;
    safeCloth.positions[i3 + 1] = 2.2 + y * 0.08;
    safeCloth.prev[i3 + 1] = safeCloth.positions[i3 + 1];
  }
}
assert.equal(hasUnsafeActiveFold(safeCloth), true, 'inverted active cloth rows should be detected before they render mirrored texture bands');

const cloth = createCloth();
const geometry = createGeometry(cloth);
const texture = new THREE.Texture();
const material = createPaperMaterial(texture);
const mesh = new THREE.Mesh(geometry, material);

assert.equal(beginGrab(cloth, 0, 0), true, 'center grab should attach particles');
for (let i = 0; i < 16; i++) {
  moveGrab(cloth, -2.8, -2.3 - i * 0.12);
  stepActive(cloth);
}
releaseGrab(cloth);

const yBeforeDrop = averageY(cloth.positions);
const yVelocityBeforeDrop = averageVelocityY(cloth.positions, cloth.prev);
const passive = promoteLivePassive(cloth, geometry, material, mesh, texture, 0.011);

assert.equal(passive.cloth, cloth, 'drop must preserve the live cloth object');
assert.equal(passive.mesh, mesh, 'drop must preserve the live rendered mesh');
assert.equal(getClothDebugState(cloth).pinnedTop, 0, 'released sheet should have no pinned top edge');
assert.equal(material.transparent, true, 'falling sheet must be fade-capable');
assert.ok(
  Math.abs(averageVelocityY(cloth.positions, cloth.prev) - (yVelocityBeforeDrop - 0.011)) < 0.0001,
  'drop impulse should preserve stored release momentum instead of replacing it',
);

for (let i = 0; i < 40; i++) stepPassive(passive, 1 / 60);

const debug = getClothDebugState(cloth);
assert.ok(passive.age > 0.6, 'passive sheet should continue simulating over time');
assert.ok(averageY(cloth.positions) < yBeforeDrop - 0.08, 'released sheet should physically fall after promotion');
assert.ok(mesh.position.y < -0.15, 'released mesh should drift down as a body');
assert.ok(Number.isFinite(debug.maxStretchRatio), 'solver stretch metrics should be finite');
assert.ok(debug.maxStretchRatio < 7, 'solver should keep passive cloth bounded while falling');

geometry.dispose();
material.dispose();
texture.dispose();

const multiGrabCloth = createCloth();
assert.equal(beginGrab(multiGrabCloth, -2.2, 0.4, 0), true, 'first grab slot should attach particles');
assert.equal(beginGrab(multiGrabCloth, 2.2, 0.4, 1), true, 'second grab slot should attach particles');
let multiDebug = getClothDebugState(multiGrabCloth);
assert.equal(multiDebug.activeGrabSlots, 2, 'cloth should support two simultaneous grab slots');
assert.ok(multiDebug.grabCount > 0, 'multi-grab should keep grabbed particles registered');
moveGrab(multiGrabCloth, -2.8, -0.6, 0);
moveGrab(multiGrabCloth, 2.8, -0.6, 1);
for (let i = 0; i < 8; i++) stepActive(multiGrabCloth);
releaseGrab(multiGrabCloth, 0);
multiDebug = getClothDebugState(multiGrabCloth);
assert.equal(multiDebug.activeGrabSlots, 1, 'releasing one slot should preserve the other active grab');
releaseGrab(multiGrabCloth);
assert.equal(getClothDebugState(multiGrabCloth).activeGrabSlots, 0, 'release without a slot should clear every grab');

const curvatureCloth = createCloth();
const center = Math.floor(H / 2) * W + Math.floor(W / 2);
curvatureCloth.positions[center * 3 + 2] = 0.24;
curvatureCloth.prev[center * 3 + 2] = 0.24;
const curvatureBefore = localCurvature(curvatureCloth.positions, center, center - 1, center + 1);
stepActive(curvatureCloth, undefined, 0, 0);
const curvatureAfter = localCurvature(curvatureCloth.positions, center, center - 1, center + 1);
assert.ok(curvatureAfter < curvatureBefore * 0.92, 'curvature smoothing should reduce sharp local folds');

const shearPositions = new Float32Array([0, 0, 0, 1.42, 0, 0, 0, 1, 0, 1.1, 1.22, 0]);
const shearPinned = new Uint8Array(4);
const shearCells = new Uint8Array([1]);
const shearBefore = diagonalError(shearPositions);
relaxClothShear(shearPositions, shearPinned, shearCells, 2, 2, Math.SQRT2, 0.35);
const shearAfter = diagonalError(shearPositions);
assert.ok(shearAfter < shearBefore * 0.75, 'shear pass should restore live-cell diagonal shape');

const velocityCloth = createCloth();
velocityCloth.prev[0] = velocityCloth.positions[0] - 4;
velocityCloth.prev[1] = velocityCloth.positions[1] - 3;
assert.equal(clampClothVelocity(velocityCloth.positions, velocityCloth.prev, 0.6), 1, 'velocity clamp should only touch outlier particles');
assert.ok(getClothDebugState(velocityCloth).maxSpeed <= 0.60001, 'velocity clamp should cap outlier speed without moving cloth positions');

const raycastCloth = createCloth();
const centerRay = new THREE.Ray(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
const centerHit = raycastClothGrid(raycastCloth, centerRay, { x: 0, y: 0 });
assert.ok(centerHit, 'cloth-grid raycast should hit the live sheet without Three mesh raycasting');
assert.ok(Math.abs(centerHit.u - 0.5) < 0.02, 'cloth-grid raycast should return stable texture u coordinates');
assert.ok(Math.abs(centerHit.v - 0.5) < 0.02, 'cloth-grid raycast should return stable texture v coordinates');

const cutCloth = createCloth();
const cutBefore = getClothDebugState(cutCloth);
const cutCount = cutClothSegment(cutCloth, -2, 0, 2, 0, 0.08);
const cutAfter = getClothDebugState(cutCloth);
assert.ok(cutCount > 0, 'explicit cut should kill constraints along the path');
assert.equal(cutAfter.brokenConstraints, cutCount, 'explicit cut should update tear count');
assert.ok(cutAfter.aliveFraction < cutBefore.aliveFraction, 'explicit cut should update cell topology');
assert.equal(cutCloth.dirtyIndex, true, 'explicit cut should mark topology dirty');

const reusableIndexGeometry = createGeometry(createCloth());
const reusableIndex = reusableIndexGeometry.getIndex();
const cutIndex = buildAliveIndex(cutCloth);
setGeometryIndex(reusableIndexGeometry, cutIndex);
assert.equal(reusableIndexGeometry.getIndex(), reusableIndex, 'geometry topology updates should reuse index buffers when capacity allows');
assert.equal(reusableIndexGeometry.drawRange.count, cutIndex.length, 'geometry draw range should match the live topology length');
reusableIndexGeometry.dispose();

const rangedCloth = createCloth();
const rangedGeometry = createGeometry(rangedCloth);
commitGeometry(rangedGeometry, rangedCloth, false);
const rangedPosition = rangedGeometry.getAttribute('position') as THREE.BufferAttribute;
rangedPosition.clearUpdateRanges();
rangedCloth.positions[0] += 0.05;
rangedCloth.positions[1] -= 0.04;
commitGeometry(rangedGeometry, rangedCloth, false);
assert.equal(rangedPosition.usage, THREE.DynamicDrawUsage, 'cloth position buffers should use dynamic draw usage');
assert.equal(rangedPosition.updateRanges.length, 1, 'small geometry changes should mark a partial position upload range');
assert.ok(rangedPosition.updateRanges[0].count < rangedPosition.array.length, 'partial geometry upload should be smaller than the full buffer');
rangedPosition.clearUpdateRanges();
commitGeometry(rangedGeometry, rangedCloth, false, {
  positionStart: 3,
  positionCount: 6,
  normalStart: 0,
  normalCount: 0,
  positionChanged: 6,
  normalChanged: 0,
});
assert.equal(rangedPosition.updateRanges.length, 1, 'worker-provided upload hints should bypass main-thread diff scans');
assert.equal(rangedPosition.updateRanges[0].start, 3, 'worker-provided upload hints should preserve the changed start component');
assert.equal(rangedPosition.updateRanges[0].count, 6, 'worker-provided upload hints should preserve the changed component count');
rangedGeometry.dispose();

const originalWorker = globalThis.Worker;
let latestFakeWorker: FakeActiveWorker | null = null;

class FakeActiveWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private pendingStep: { generation: number; revision: number; buffers?: Parameters<typeof snapshotClothForWorker>[1] } | null = null;

  constructor() {
    latestFakeWorker = this;
  }

  postMessage(message: { type: string; generation: number; revision?: number; buffers?: Parameters<typeof snapshotClothForWorker>[1] }) {
    if (message.type === 'init') {
      this.onmessage?.({ data: { type: 'ready', generation: message.generation } } as MessageEvent<unknown>);
      return;
    }
    if (message.type === 'step') {
      this.pendingStep = { generation: message.generation, revision: message.revision ?? 0, buffers: message.buffers };
    }
  }

  flushStep() {
    assert.ok(this.pendingStep, 'fake worker should have a pending step to flush');
    const { generation, revision, buffers } = this.pendingStep;
    this.pendingStep = null;
    this.onmessage?.({
      data: {
        type: 'stepped',
        generation,
        revision,
        snapshot: snapshotClothForWorker(createCloth(), buffers),
      },
    } as MessageEvent<unknown>);
  }

  terminate() {}
}

try {
  (globalThis as typeof globalThis & { Worker: typeof Worker }).Worker = FakeActiveWorker as unknown as typeof Worker;
  let appliedSnapshots = 0;
  const activeWorker = new ActiveClothWorkerController(() => { appliedSnapshots += 1; });
  activeWorker.init(createCloth());
  assert.equal(activeWorker.step(1 / 60, 1, undefined, 1), 'posted', 'fake active worker should accept a step');
  activeWorker.command({ type: 'moveGrab', x: 0.7, y: -0.4, slot: 0 });
  latestFakeWorker?.flushStep();
  assert.equal(appliedSnapshots, 0, 'post-command stale worker snapshots should not overwrite immediate main-thread cloth updates');
  assert.equal(activeWorker.getStatus().skippedSnapshots, 1, 'stale active-worker snapshots should be counted for debug visibility');
  assert.equal(activeWorker.getStatus().pending, false, 'skipping a stale snapshot should clear pending worker state');
  activeWorker.terminate();
} finally {
  if (originalWorker) {
    (globalThis as typeof globalThis & { Worker: typeof Worker }).Worker = originalWorker;
  } else {
    delete (globalThis as typeof globalThis & { Worker?: typeof Worker }).Worker;
  }
}

type FakeWorkerRole = 'active-wasm' | 'active-ts' | 'passive-wasm' | 'passive-ts';

class FailingWasmWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private readonly role: FakeWorkerRole;

  constructor(url: URL | string) {
    const href = String(url);
    const active = href.includes('activeCloth');
    const wasm = href.includes('Wasm');
    this.role = active ? (wasm ? 'active-wasm' : 'active-ts') : (wasm ? 'passive-wasm' : 'passive-ts');
  }

  postMessage(message: { type: string; generation?: number; id?: number }) {
    if (message.type !== 'init') return;
    if (this.role === 'active-wasm') {
      this.onmessage?.({ data: { type: 'failed', generation: message.generation, error: 'simulated wasm init failure' } } as MessageEvent<unknown>);
      return;
    }
    if (this.role === 'passive-wasm') {
      this.onmessage?.({ data: { type: 'failed', id: message.id, error: 'simulated wasm init failure' } } as MessageEvent<unknown>);
      return;
    }
    if (this.role === 'active-ts') this.onmessage?.({ data: { type: 'ready', generation: message.generation } } as MessageEvent<unknown>);
    else this.onmessage?.({ data: { type: 'ready', id: message.id } } as MessageEvent<unknown>);
  }

  terminate() {}
}

try {
  (globalThis as typeof globalThis & { Worker: typeof Worker }).Worker = FailingWasmWorker as unknown as typeof Worker;

  const activeFailover = new ActiveClothWorkerController(() => {}, { wasm: true });
  activeFailover.init(createCloth());
  const activeStatus = activeFailover.getStatus();
  assert.equal(activeStatus.backend, 'typescript', 'active WASM init failure should fall back to the TypeScript worker');
  assert.equal(activeStatus.failovers, 1, 'active worker failover should be counted');
  assert.equal(activeStatus.ready, true, 'active TypeScript fallback worker should initialize after failover');
  activeFailover.terminate();

  const passiveFailover = new PassiveClothWorkerController(() => {}, { wasm: true });
  const fakePassive = { cloth: createCloth(), workerPending: false } as PassiveCloth;
  passiveFailover.attach(fakePassive);
  const passiveStatus = passiveFailover.getStatus([fakePassive]);
  assert.equal(passiveStatus.backend, 'typescript', 'passive WASM init failure should fall back to the TypeScript worker');
  assert.equal(passiveStatus.failovers, 1, 'passive worker failover should be counted');
  assert.equal(passiveStatus.active, 1, 'passive TypeScript fallback should preserve tracked falling sheets');
  passiveFailover.terminate();
} finally {
  if (originalWorker) {
    (globalThis as typeof globalThis & { Worker: typeof Worker }).Worker = originalWorker;
  } else {
    delete (globalThis as typeof globalThis & { Worker?: typeof Worker }).Worker;
  }
}
