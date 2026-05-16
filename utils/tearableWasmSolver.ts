import { C_COUNT, N, TOTAL_CELLS } from './tearableClothCore';
import type { ClothWorkerSnapshot, ClothWorkerSnapshotBuffers, ClothWorkerTiming, WorkerGeometryUploadHint } from './tearableClothWorkerState';

type TearableSolverExports = {
  memory: WebAssembly.Memory;
  ensure_memory: () => void;
  positions_ptr: () => number;
  prev_ptr: () => number;
  normals_ptr: () => number;
  pinned_ptr: () => number;
  isolation_ptr: () => number;
  c_alive_ptr: () => number;
  cell_alive_ptr: () => number;
  index_ptr: () => number;
  index_count: () => number;
  get_tear_count: () => number;
  set_tear_count: (value: number) => void;
  is_dirty_index: () => number;
  clear_dirty_index: () => void;
  reset_runtime_state: () => void;
  begin_grab: (x: number, y: number, slot: number) => number;
  move_grab: (x: number, y: number, slot: number) => void;
  release_grab: (slot: number) => void;
  cut_segment: (ax: number, ay: number, bx: number, by: number, radius: number) => number;
  step_active: (damping: number, gravityScale: number, dt: number) => void;
  step_passive: (dt: number) => void;
  compute_normals: () => void;
  build_alive_index: () => number;
};

export async function instantiateTearableWasmSolver(source: BufferSource | Response) {
  const instance = await instantiateSource(source);
  return new TearableWasmSolver(instance.exports as unknown as TearableSolverExports);
}

export class TearableWasmSolver {
  constructor(private readonly exports: TearableSolverExports) {
    this.exports.ensure_memory();
  }

  loadSnapshot(snapshot: ClothWorkerSnapshot) {
    this.exports.reset_runtime_state();
    this.positions.set(snapshot.positions);
    this.prev.set(snapshot.prev);
    if (snapshot.normals) this.normals.set(snapshot.normals);
    this.pinned.set(snapshot.pinned);
    this.isolation.set(snapshot.isolation);
    this.cAlive.set(snapshot.cAlive);
    this.cellAlive.set(snapshot.cellAlive);
    this.exports.set_tear_count(snapshot.tearCount);
    this.exports.clear_dirty_index();
  }

  beginGrab(x: number, y: number, slot = 0) {
    this.exports.begin_grab(x, y, slot);
  }

  moveGrab(x: number, y: number, slot = 0) {
    this.exports.move_grab(x, y, slot);
  }

  releaseGrab(slot?: number) {
    this.exports.release_grab(typeof slot === 'number' ? slot : -1);
  }

  cutSegment(ax: number, ay: number, bx: number, by: number, radius: number) {
    return this.exports.cut_segment(ax, ay, bx, by, radius);
  }

  step(steps: number, damping: number | undefined, gravityScale: number, dt: number) {
    for (let i = 0; i < steps; i += 1) {
      this.exports.step_active(damping ?? 0, gravityScale, dt);
    }
    this.exports.compute_normals();
  }

  stepPassive(steps: number, dt: number) {
    for (let i = 0; i < steps; i += 1) {
      this.exports.step_passive(dt);
    }
    this.exports.compute_normals();
  }

  stepSnapshot(reusable?: ClothWorkerSnapshotBuffers, timing?: Omit<ClothWorkerTiming, 'copyMs' | 'topologyMs' | 'totalMs'>): ClothWorkerSnapshot {
    const topologyStart = nowMs();
    const dirtyIndex = this.exports.is_dirty_index() !== 0;
    const index = dirtyIndex ? this.buildIndexSnapshot() : undefined;
    if (dirtyIndex) this.exports.clear_dirty_index();
    const topologyMs = nowMs() - topologyStart;
    const copyStart = nowMs();
    const positions = copyFloat32WithRange(this.positions, reusable?.positions);
    const prev = copyFloat32(this.prev, reusable?.prev);
    const normals = copyFloat32WithRange(this.normals, reusable?.normals);
    const copyMs = nowMs() - copyStart;
    const upload = uploadHint(positions, normals, dirtyIndex);
    return {
      positions: positions.array,
      prev,
      normals: normals.array,
      index,
      ...(dirtyIndex ? {
        isolation: copyFloat32(this.isolation, reusable?.isolation),
        cAlive: copyUint8(this.cAlive, reusable?.cAlive),
        cellAlive: copyUint8(this.cellAlive, reusable?.cellAlive),
        tearCount: this.exports.get_tear_count(),
      } : null),
      upload,
      timing: timing && { ...timing, copyMs, topologyMs, totalMs: timing.solveMs + copyMs + topologyMs },
    };
  }

  motionSnapshot(reusable?: Pick<ClothWorkerSnapshotBuffers, 'positions' | 'prev' | 'normals'>, timing?: Omit<ClothWorkerTiming, 'copyMs' | 'topologyMs' | 'totalMs'>) {
    const copyStart = nowMs();
    const positions = copyFloat32WithRange(this.positions, reusable?.positions);
    const prev = copyFloat32(this.prev, reusable?.prev);
    const normals = copyFloat32WithRange(this.normals, reusable?.normals);
    const copyMs = nowMs() - copyStart;
    return {
      positions: positions.array,
      prev,
      normals: normals.array,
      upload: uploadHint(positions, normals, false),
      timing: timing && { ...timing, copyMs, topologyMs: 0, totalMs: timing.solveMs + copyMs },
    };
  }

  snapshot(reusable?: ClothWorkerSnapshotBuffers): ClothWorkerSnapshot {
    const dirtyIndex = this.exports.is_dirty_index() !== 0;
    const index = dirtyIndex ? this.buildIndexSnapshot() : undefined;
    if (dirtyIndex) this.exports.clear_dirty_index();
    return {
      positions: copyFloat32(this.positions, reusable?.positions),
      prev: copyFloat32(this.prev, reusable?.prev),
      normals: copyFloat32(this.normals, reusable?.normals),
      index,
      pinned: copyUint8(this.pinned, reusable?.pinned),
      isolation: copyFloat32(this.isolation, reusable?.isolation),
      cAlive: copyUint8(this.cAlive, reusable?.cAlive),
      cellAlive: copyUint8(this.cellAlive, reusable?.cellAlive),
      tearCount: this.exports.get_tear_count(),
    };
  }

  private buildIndexSnapshot() {
    const count = this.exports.build_alive_index();
    return new Uint32Array(this.memory.buffer, this.exports.index_ptr(), count).slice();
  }

  private get memory() {
    return this.exports.memory;
  }

  private get positions() {
    return new Float32Array(this.memory.buffer, this.exports.positions_ptr(), N * 3);
  }

  private get prev() {
    return new Float32Array(this.memory.buffer, this.exports.prev_ptr(), N * 3);
  }

  private get normals() {
    return new Float32Array(this.memory.buffer, this.exports.normals_ptr(), N * 3);
  }

  private get pinned() {
    return new Uint8Array(this.memory.buffer, this.exports.pinned_ptr(), N);
  }

  private get isolation() {
    return new Float32Array(this.memory.buffer, this.exports.isolation_ptr(), N);
  }

  private get cAlive() {
    return new Uint8Array(this.memory.buffer, this.exports.c_alive_ptr(), C_COUNT);
  }

  private get cellAlive() {
    return new Uint8Array(this.memory.buffer, this.exports.cell_alive_ptr(), TOTAL_CELLS);
  }
}

async function instantiateSource(source: BufferSource | Response) {
  if (typeof Response !== 'undefined' && source instanceof Response) {
    if (WebAssembly.instantiateStreaming) {
      try {
        return (await WebAssembly.instantiateStreaming(source, {})).instance;
      } catch {
        source = await source.arrayBuffer();
      }
    } else {
      source = await source.arrayBuffer();
    }
  }
  return (await WebAssembly.instantiate(source as BufferSource, {})).instance;
}

function copyFloat32(source: Float32Array, buffer?: ArrayBuffer): Float32Array {
  const target = buffer?.byteLength === source.byteLength ? new Float32Array(buffer) : new Float32Array(source.length);
  target.set(source);
  return target;
}

function copyFloat32WithRange(source: Float32Array, buffer?: ArrayBuffer) {
  const target = buffer?.byteLength === source.byteLength ? new Float32Array(buffer) : new Float32Array(source.length);
  let start = -1, end = -1, changed = 0;
  if (buffer?.byteLength === source.byteLength) {
    for (let i = 0; i < source.length; i += 1) {
      if (target[i] === source[i]) continue;
      if (start < 0) start = i;
      end = i + 1;
      changed += 1;
    }
  } else {
    start = 0;
    end = source.length;
    changed = source.length;
  }
  target.set(source);
  return { array: target, start: Math.max(0, start), count: end > start ? end - start : 0, changed };
}

function copyUint8(source: Uint8Array, buffer?: ArrayBuffer): Uint8Array {
  const target = buffer?.byteLength === source.byteLength ? new Uint8Array(buffer) : new Uint8Array(source.length);
  target.set(source);
  return target;
}

function uploadHint(
  positions: ReturnType<typeof copyFloat32WithRange>,
  normals: ReturnType<typeof copyFloat32WithRange>,
  topologyChanged: boolean,
): WorkerGeometryUploadHint {
  return {
    positionStart: positions.start,
    positionCount: positions.count,
    normalStart: normals.start,
    normalCount: normals.count,
    positionChanged: positions.changed,
    normalChanged: normals.changed,
    topologyChanged,
  };
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
