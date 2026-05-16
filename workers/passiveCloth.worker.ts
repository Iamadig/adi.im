import { ClothData, computeNormals, stepPassiveCloth } from '../utils/tearableClothCore';
import { ClothWorkerSnapshot, hydrateClothFromWorkerSnapshot } from '../utils/tearableClothWorkerState';

type WorkerRequest =
  | { type: 'init'; id: number; snapshot: ClothWorkerSnapshot }
  | { type: 'step'; id: number; dt: number; steps: number; positionsBuffer?: ArrayBuffer; prevBuffer?: ArrayBuffer; normalsBuffer?: ArrayBuffer }
  | { type: 'dispose'; id: number };

const simulations = new Map<number, ClothData>();
const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === 'init') {
    simulations.set(message.id, hydrateClothFromWorkerSnapshot(message.snapshot));
    workerScope.postMessage({ type: 'ready', id: message.id });
    return;
  }

  if (message.type === 'dispose') {
    simulations.delete(message.id);
    return;
  }

  const cloth = simulations.get(message.id);
  if (!cloth) return;

  const started = performance.now();
  for (let i = 0; i < message.steps; i += 1) {
    stepPassiveCloth(cloth, message.dt);
  }
  const solveMs = performance.now() - started;

  computeNormals(cloth);
  const copyStarted = performance.now();
  const positions = copyFloat32(cloth.positions, message.positionsBuffer);
  const prev = copyFloat32(cloth.prev, message.prevBuffer);
  const normals = copyFloat32(cloth.normals, message.normalsBuffer);
  const copyMs = performance.now() - copyStarted;
  workerScope.postMessage(
    {
      type: 'stepped',
      id: message.id,
      positions,
      prev,
      normals,
      upload: {
        positionStart: 0,
        positionCount: positions.length,
        normalStart: 0,
        normalCount: normals.length,
        positionChanged: positions.length,
        normalChanged: normals.length,
      },
      timing: { solveMs, copyMs, topologyMs: 0, totalMs: performance.now() - started, steps: message.steps },
    },
    [positions.buffer, prev.buffer, normals.buffer] as Transferable[],
  );
};

function copyFloat32(source: Float32Array, buffer?: ArrayBuffer): Float32Array {
  const target = buffer?.byteLength === source.byteLength
    ? new Float32Array(buffer)
    : new Float32Array(source.length);
  target.set(source);
  return target;
}
