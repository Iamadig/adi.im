import { ClothWorkerSnapshot } from '../utils/tearableClothWorkerState';
import { instantiateTearableWasmSolver, TearableWasmSolver } from '../utils/tearableWasmSolver';

type WorkerRequest =
  | { type: 'init'; id: number; snapshot: ClothWorkerSnapshot }
  | { type: 'step'; id: number; dt: number; steps: number; positionsBuffer?: ArrayBuffer; prevBuffer?: ArrayBuffer; normalsBuffer?: ArrayBuffer }
  | { type: 'dispose'; id: number };

const simulations = new Map<number, TearableWasmSolver>();
const workerScope = globalThis as unknown as {
  location: Location;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

const wasmBytesReady = loadWasmBytes();
let queue = Promise.resolve();

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  queue = queue
    .then(async () => handleMessage(await wasmBytesReady, message))
    .catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      workerScope.postMessage({ type: 'failed', id: message.id, error: reason });
    });
};

async function loadWasmBytes() {
  const wasmUrl = new URL('/wasm/tearable_solver.wasm', workerScope.location.origin);
  return (await fetch(wasmUrl)).arrayBuffer();
}

async function handleMessage(wasmBytes: ArrayBuffer, message: WorkerRequest) {
  if (message.type === 'init') {
    const solver = await instantiateTearableWasmSolver(wasmBytes);
    solver.loadSnapshot(message.snapshot);
    simulations.set(message.id, solver);
    workerScope.postMessage({ type: 'ready', id: message.id });
    return;
  }

  if (message.type === 'dispose') {
    simulations.delete(message.id);
    return;
  }

  const solver = simulations.get(message.id);
  if (!solver) return;
  const started = performance.now();
  solver.stepPassive(message.steps, message.dt);
  const { positions, prev, normals, upload, timing } = solver.motionSnapshot({
    positions: message.positionsBuffer,
    prev: message.prevBuffer,
    normals: message.normalsBuffer,
  }, { solveMs: performance.now() - started, steps: message.steps });
  workerScope.postMessage(
    { type: 'stepped', id: message.id, positions, prev, normals, upload, timing },
    [positions.buffer, prev.buffer, normals.buffer] as Transferable[],
  );
}
