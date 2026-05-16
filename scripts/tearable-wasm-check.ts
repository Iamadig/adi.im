import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beginGrab, createCloth, dropPins, getClothDebugState, moveGrab, releaseGrab, stepActive, stepPassiveCloth } from '../utils/tearableClothCore';
import { cutClothSegment } from '../utils/tearableClothCut';
import { snapshotClothForWorker } from '../utils/tearableClothWorkerState';
import { instantiateTearableWasmSolver } from '../utils/tearableWasmSolver';

function averageY(positions: Float32Array) {
  let total = 0;
  for (let i = 1; i < positions.length; i += 3) total += positions[i];
  return total / (positions.length / 3);
}

function assertFinite(source: Float32Array, label: string) {
  for (let i = 0; i < source.length; i += 1) assert.ok(Number.isFinite(source[i]), `${label} should stay finite at ${i}`);
}

const wasmBytes = await readFile(resolve('public/wasm/tearable_solver.wasm'));
const solver = await instantiateTearableWasmSolver(new Uint8Array(wasmBytes));

const tsCloth = createCloth();
solver.loadSnapshot(snapshotClothForWorker(tsCloth));
let wasmSnapshot = solver.snapshot();
assert.deepEqual(
  Array.from(wasmSnapshot.positions.slice(0, 18)),
  Array.from(tsCloth.positions.slice(0, 18)),
  'WASM memory should load the canonical cloth grid',
);

const motionOnlySolver = await instantiateTearableWasmSolver(new Uint8Array(wasmBytes));
motionOnlySolver.loadSnapshot(snapshotClothForWorker(createCloth()));
motionOnlySolver.step(1, undefined, 1, 1 / 60);
const motionOnly = motionOnlySolver.stepSnapshot(undefined, { solveMs: 0.25, steps: 1 });
assert.equal(motionOnly.cAlive, undefined, 'motion-only WASM snapshots should omit unchanged constraint state');
assert.equal(motionOnly.cellAlive, undefined, 'motion-only WASM snapshots should omit unchanged cell topology');
assert.equal(motionOnly.upload?.topologyChanged, false, 'motion-only WASM snapshots should mark topology unchanged');
assert.ok((motionOnly.upload?.positionCount ?? 0) > 0, 'motion-only WASM snapshots should still expose position upload ranges');
assert.equal(motionOnly.timing?.steps, 1, 'WASM snapshots should report worker step timing metadata');

assert.equal(beginGrab(tsCloth, 0, 0), true, 'TS baseline grab should attach particles');
solver.beginGrab(0, 0);
for (let i = 0; i < 14; i += 1) {
  const x = -1.8 - i * 0.04;
  const y = -1.2 - i * 0.06;
  moveGrab(tsCloth, x, y);
  solver.moveGrab(x, y);
  stepActive(tsCloth, undefined, undefined, 1, 1 / 60);
  solver.step(1, undefined, 1, 1 / 60);
}
releaseGrab(tsCloth);
solver.releaseGrab();
wasmSnapshot = solver.snapshot();
assertFinite(wasmSnapshot.positions, 'WASM positions');
assertFinite(wasmSnapshot.normals!, 'WASM normals');
assert.ok(
  Math.abs(averageY(wasmSnapshot.positions) - averageY(tsCloth.positions)) < 0.035,
  'WASM and TS active solves should preserve comparable sheet motion',
);

const tsCut = cutClothSegment(tsCloth, -2, 0, 2, 0, 0.08);
const wasmCut = solver.cutSegment(-2, 0, 2, 0, 0.08);
wasmSnapshot = solver.snapshot();
assert.ok(Math.abs(wasmCut - tsCut) <= 5, 'WASM cut should kill a comparable constraint count to TS for a straight segment');
assert.ok(Math.abs((wasmSnapshot.tearCount ?? 0) - tsCloth.tearCount) <= 5, 'WASM cut should preserve tear count parity within numeric tolerance');
assert.ok(wasmSnapshot.index && wasmSnapshot.index.length > 0, 'WASM dirty topology should produce a reusable live index');
assert.ok(
  wasmSnapshot.cellAlive.filter((value) => value === 0).length > 0,
  'WASM cut should update dead cell topology',
);

const debug = getClothDebugState(tsCloth);
assert.ok(debug.maxStretchRatio < 7, 'TS comparison cloth should remain bounded during WASM parity test');

const passiveSolver = await instantiateTearableWasmSolver(new Uint8Array(wasmBytes));
const tsPassive = createCloth();
dropPins(tsPassive);
passiveSolver.loadSnapshot(snapshotClothForWorker(tsPassive));
const passiveStartY = averageY(tsPassive.positions);
for (let i = 0; i < 32; i += 1) {
  stepPassiveCloth(tsPassive, 1 / 60);
  passiveSolver.stepPassive(1, 1 / 60);
}
const passiveMotion = passiveSolver.motionSnapshot();
assertFinite(passiveMotion.positions, 'WASM passive positions');
assertFinite(passiveMotion.normals, 'WASM passive normals');
assert.ok(averageY(passiveMotion.positions) < passiveStartY - 0.04, 'WASM passive cloth should fall over time');
assert.ok(
  Math.abs(averageY(passiveMotion.positions) - averageY(tsPassive.positions)) < 0.02,
  'WASM and TS passive solves should preserve comparable falling motion',
);
