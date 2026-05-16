import { ClothData, createCloth } from './tearableClothCore';

export interface ClothWorkerSnapshotBuffers {
  positions?: ArrayBuffer;
  prev?: ArrayBuffer;
  normals?: ArrayBuffer;
  pinned?: ArrayBuffer;
  isolation?: ArrayBuffer;
  cAlive?: ArrayBuffer;
  cellAlive?: ArrayBuffer;
}

export interface WorkerGeometryUploadHint {
  positionStart: number;
  positionCount: number;
  normalStart: number;
  normalCount: number;
  positionChanged: number;
  normalChanged: number;
  topologyChanged?: boolean;
}

export interface ClothWorkerTiming {
  solveMs: number;
  copyMs: number;
  topologyMs: number;
  totalMs: number;
  steps: number;
}

export interface ClothWorkerSnapshot {
  positions: Float32Array;
  prev: Float32Array;
  normals?: Float32Array;
  index?: Uint32Array;
  pinned?: Uint8Array;
  isolation?: Float32Array;
  cAlive?: Uint8Array;
  cellAlive?: Uint8Array;
  tearCount?: number;
  upload?: WorkerGeometryUploadHint;
  timing?: ClothWorkerTiming;
}

export function snapshotClothForWorker(source: ClothData, reusable?: ClothWorkerSnapshotBuffers, index?: Uint32Array): ClothWorkerSnapshot {
  return {
    positions: copyFloat32(source.positions, reusable?.positions),
    prev: copyFloat32(source.prev, reusable?.prev),
    normals: copyFloat32(source.normals, reusable?.normals),
    index,
    pinned: copyUint8(source.pinned, reusable?.pinned),
    isolation: copyFloat32(source.isolation, reusable?.isolation),
    cAlive: copyUint8(source.cAlive, reusable?.cAlive),
    cellAlive: copyUint8(source.cellAlive, reusable?.cellAlive),
    tearCount: source.tearCount,
  };
}

export function hydrateClothFromWorkerSnapshot(snapshot: ClothWorkerSnapshot): ClothData {
  const cloth = createCloth();
  applyClothWorkerSnapshot(cloth, snapshot);
  return cloth;
}

export function applyClothWorkerSnapshot(cloth: ClothData, snapshot: ClothWorkerSnapshot): void {
  cloth.positions.set(snapshot.positions);
  cloth.prev.set(snapshot.prev);
  if (snapshot.normals) cloth.normals.set(snapshot.normals);
  if (snapshot.pinned) cloth.pinned.set(snapshot.pinned);
  if (snapshot.isolation) cloth.isolation.set(snapshot.isolation);
  if (snapshot.cAlive) cloth.cAlive.set(snapshot.cAlive);
  if (snapshot.cellAlive) cloth.cellAlive.set(snapshot.cellAlive);
  if (typeof snapshot.tearCount === 'number') cloth.tearCount = snapshot.tearCount;
  cloth.dirtyIndex = false;
  cloth.cLambda.fill(0);
}

export function clothSnapshotTransferList(snapshot: ClothWorkerSnapshot): Transferable[] {
  return [
    snapshot.positions.buffer,
    snapshot.prev.buffer,
    snapshot.normals?.buffer,
    snapshot.index?.buffer,
    snapshot.pinned?.buffer,
    snapshot.isolation?.buffer,
    snapshot.cAlive?.buffer,
    snapshot.cellAlive?.buffer,
  ].filter(Boolean) as Transferable[];
}

export function clothSnapshotBuffers(snapshot: ClothWorkerSnapshot): ClothWorkerSnapshotBuffers {
  return {
    positions: snapshot.positions.buffer as ArrayBuffer,
    prev: snapshot.prev.buffer as ArrayBuffer,
    normals: snapshot.normals?.buffer as ArrayBuffer | undefined,
    pinned: snapshot.pinned?.buffer as ArrayBuffer | undefined,
    isolation: snapshot.isolation?.buffer as ArrayBuffer | undefined,
    cAlive: snapshot.cAlive?.buffer as ArrayBuffer | undefined,
    cellAlive: snapshot.cellAlive?.buffer as ArrayBuffer | undefined,
  };
}

function copyFloat32(source: Float32Array, buffer?: ArrayBuffer): Float32Array {
  const target = buffer?.byteLength === source.byteLength
    ? new Float32Array(buffer)
    : new Float32Array(source.length);
  target.set(source);
  return target;
}

function copyUint8(source: Uint8Array, buffer?: ArrayBuffer): Uint8Array {
  const target = buffer?.byteLength === source.byteLength
    ? new Uint8Array(buffer)
    : new Uint8Array(source.length);
  target.set(source);
  return target;
}
