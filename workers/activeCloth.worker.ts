import { beginGrab, buildAliveIndex, computeNormals, getClothDebugState, moveGrab, releaseGrab, stepActive } from '../utils/tearableClothCore';
import { cutClothSegment } from '../utils/tearableClothCut';
import {
  ClothWorkerSnapshot,
  ClothWorkerSnapshotBuffers,
  clothSnapshotTransferList,
  hydrateClothFromWorkerSnapshot,
  snapshotClothForWorker,
} from '../utils/tearableClothWorkerState';

type WorkerRequest =
  | { type: 'init'; generation: number; snapshot: ClothWorkerSnapshot }
  | { type: 'beginGrab'; generation: number; x: number; y: number; slot?: number }
  | { type: 'moveGrab'; generation: number; x: number; y: number; slot?: number }
  | { type: 'cutSegment'; generation: number; ax: number; ay: number; bx: number; by: number; radius: number }
  | { type: 'releaseGrab'; generation: number; slot?: number }
  | { type: 'step'; generation: number; revision: number; dt: number; steps: number; damping?: number; gravityScale: number; buffers?: ClothWorkerSnapshotBuffers };

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let cloth = hydrateClothFromWorkerSnapshot({
  positions: new Float32Array(),
  prev: new Float32Array(),
  pinned: new Uint8Array(),
  isolation: new Float32Array(),
  cAlive: new Uint8Array(),
  cellAlive: new Uint8Array(),
  tearCount: 0,
});
let generation = -1;

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === 'init') {
    cloth = hydrateClothFromWorkerSnapshot(message.snapshot);
    generation = message.generation;
    workerScope.postMessage({ type: 'ready', generation });
    return;
  }

  if (message.generation !== generation) return;

  if (message.type === 'beginGrab') {
    beginGrab(cloth, message.x, message.y, message.slot);
    return;
  }

  if (message.type === 'moveGrab') {
    moveGrab(cloth, message.x, message.y, message.slot);
    return;
  }

  if (message.type === 'releaseGrab') {
    releaseGrab(cloth, message.slot);
    return;
  }

  if (message.type === 'cutSegment') {
    cutClothSegment(cloth, message.ax, message.ay, message.bx, message.by, message.radius);
    return;
  }

  const started = performance.now();
  for (let i = 0; i < message.steps; i += 1) {
    stepActive(cloth, undefined, message.damping, message.gravityScale, message.dt);
  }
  const solveMs = performance.now() - started;

  computeNormals(cloth);
  const index = cloth.dirtyIndex ? buildAliveIndex(cloth) : undefined;
  cloth.dirtyIndex = false;
  const copyStarted = performance.now();
  const snapshot = snapshotClothForWorker(cloth, message.buffers, index);
  snapshot.upload = {
    positionStart: 0,
    positionCount: snapshot.positions.length,
    normalStart: 0,
    normalCount: snapshot.normals?.length ?? 0,
    positionChanged: snapshot.positions.length,
    normalChanged: snapshot.normals?.length ?? 0,
    topologyChanged: !!index,
  };
  snapshot.timing = { solveMs, copyMs: performance.now() - copyStarted, topologyMs: 0, totalMs: performance.now() - started, steps: message.steps };
  workerScope.postMessage(
    { type: 'stepped', generation, revision: message.revision, snapshot, debug: getClothDebugState(cloth) },
    clothSnapshotTransferList(snapshot),
  );
};
