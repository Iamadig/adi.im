import {
  ClothWorkerSnapshot,
  ClothWorkerSnapshotBuffers,
  clothSnapshotTransferList,
} from '../utils/tearableClothWorkerState';
import { instantiateTearableWasmSolver, TearableWasmSolver } from '../utils/tearableWasmSolver';

type WorkerRequest =
  | { type: 'init'; generation: number; snapshot: ClothWorkerSnapshot }
  | { type: 'beginGrab'; generation: number; x: number; y: number; slot?: number }
  | { type: 'moveGrab'; generation: number; x: number; y: number; slot?: number }
  | { type: 'cutSegment'; generation: number; ax: number; ay: number; bx: number; by: number; radius: number }
  | { type: 'releaseGrab'; generation: number; slot?: number }
  | { type: 'step'; generation: number; revision: number; dt: number; steps: number; damping?: number; gravityScale: number; buffers?: ClothWorkerSnapshotBuffers };

const workerScope = globalThis as unknown as {
  location: Location;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let generation = -1;
const solverReady = loadSolver();
let queue = Promise.resolve();

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  queue = queue
    .then(async () => handleMessage(await solverReady, message))
    .catch((error: unknown) => {
      workerScope.postMessage({ type: 'failed', generation: message.generation, error: error instanceof Error ? error.message : String(error) });
    });
};

async function loadSolver(): Promise<TearableWasmSolver> {
  const wasmUrl = new URL('/wasm/tearable_solver.wasm', workerScope.location.origin);
  return instantiateTearableWasmSolver(await fetch(wasmUrl));
}

function handleMessage(solver: TearableWasmSolver, message: WorkerRequest) {
  if (message.type === 'init') {
    solver.loadSnapshot(message.snapshot);
    generation = message.generation;
    workerScope.postMessage({ type: 'ready', generation });
    return;
  }

  if (message.generation !== generation) return;

  if (message.type === 'beginGrab') {
    solver.beginGrab(message.x, message.y, message.slot);
    return;
  }

  if (message.type === 'moveGrab') {
    solver.moveGrab(message.x, message.y, message.slot);
    return;
  }

  if (message.type === 'releaseGrab') {
    solver.releaseGrab(message.slot);
    return;
  }

  if (message.type === 'cutSegment') {
    solver.cutSegment(message.ax, message.ay, message.bx, message.by, message.radius);
    return;
  }

  const started = performance.now();
  solver.step(message.steps, message.damping, message.gravityScale, message.dt);
  const snapshot = solver.stepSnapshot(message.buffers, { solveMs: performance.now() - started, steps: message.steps });
  workerScope.postMessage(
    { type: 'stepped', generation, revision: message.revision, snapshot },
    clothSnapshotTransferList(snapshot),
  );
}
