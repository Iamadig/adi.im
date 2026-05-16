import { ClothData } from './tearableClothCore';
import { PassiveCloth } from './tearableClothPhysics';
import {
  ClothWorkerSnapshot,
  ClothWorkerSnapshotBuffers,
  ClothWorkerTiming,
  WorkerGeometryUploadHint,
  clothSnapshotBuffers,
  clothSnapshotTransferList,
  snapshotClothForWorker,
} from './tearableClothWorkerState';

type WorkerStepResult = 'posted' | 'waiting' | 'unavailable';

type PassiveWorkerMessage =
  | { type: 'ready'; id: number }
  | { type: 'failed'; id: number; error?: string }
  | { type: 'stepped'; id: number; positions: Float32Array; prev: Float32Array; normals?: Float32Array; upload?: WorkerGeometryUploadHint; timing?: ClothWorkerTiming };

type ActiveWorkerMessage =
  | { type: 'ready'; generation: number }
  | { type: 'failed'; generation: number; error?: string }
  | { type: 'stepped'; generation: number; revision: number; snapshot: ClothWorkerSnapshot };

type ActiveWorkerCommand =
  | { type: 'beginGrab'; x: number; y: number; slot?: number }
  | { type: 'moveGrab'; x: number; y: number; slot?: number }
  | { type: 'cutSegment'; ax: number; ay: number; bx: number; by: number; radius: number }
  | { type: 'releaseGrab'; slot?: number };

type ClothWorkerBackend = 'typescript' | 'wasm';

export class PassiveClothWorkerController {
  private worker: Worker | null = null;
  private usable = typeof Worker !== 'undefined';
  private backend: ClothWorkerBackend;
  private readonly byId = new Map<number, PassiveCloth>();
  private nextId = 1;
  private failovers = 0;
  private failures = 0;
  private lastError = '';
  private lastTiming: ClothWorkerTiming | undefined;
  private lastUpload: WorkerGeometryUploadHint | undefined;

  constructor(
    private readonly onStep: (passive: PassiveCloth, positions: Float32Array, prev: Float32Array, normals?: Float32Array, upload?: WorkerGeometryUploadHint) => void,
    private readonly options: { wasm?: boolean } = {},
  ) {
    this.backend = options.wasm ? 'wasm' : 'typescript';
  }

  getStatus(passives: PassiveCloth[]) {
    return {
      supported: typeof Worker !== 'undefined',
      enabled: !!this.worker && this.usable,
      backend: this.backend,
      wasmRequested: !!this.options.wasm,
      active: passives.filter((passive) => passive.workerId).length,
      pending: passives.filter((passive) => passive.workerPending).length,
      failovers: this.failovers,
      failures: this.failures,
      lastError: this.lastError,
      timing: this.lastTiming,
      upload: this.lastUpload,
    };
  }

  attach(passive: PassiveCloth) {
    const worker = this.ensure();
    if (!worker) return;
    const id = this.nextId++;
    const snapshot = snapshotClothForWorker(passive.cloth);
    passive.workerId = id;
    passive.workerPending = false;
    this.byId.set(id, passive);
    try {
      worker.postMessage({ type: 'init', id, snapshot }, clothSnapshotTransferList(snapshot));
    } catch {
      passive.workerId = undefined;
      passive.workerPending = false;
      if (this.options.wasm && this.backend === 'wasm') {
        passive.workerId = id;
        this.byId.set(id, passive);
        if (this.failoverToTypeScript('passive worker init post failed')) return;
      }
      this.byId.delete(id);
    }
  }

  dispose(passive: PassiveCloth) {
    if (!passive.workerId) return;
    this.byId.delete(passive.workerId);
    this.worker?.postMessage({ type: 'dispose', id: passive.workerId });
  }

  step(passive: PassiveCloth, dt: number, steps: number): WorkerStepResult {
    if (!passive.workerId || !this.worker || !this.usable) return 'unavailable';
    if (passive.workerPending || steps <= 0) return 'waiting';
    passive.workerPending = true;
    try {
      const transfer: Transferable[] = [];
      const message: {
        type: 'step';
        id: number;
        dt: number;
        steps: number;
        positionsBuffer?: ArrayBuffer;
        prevBuffer?: ArrayBuffer;
        normalsBuffer?: ArrayBuffer;
      } = { type: 'step', id: passive.workerId, dt, steps };
      if (passive.workerPositionsBuffer) {
        message.positionsBuffer = passive.workerPositionsBuffer;
        transfer.push(passive.workerPositionsBuffer);
        passive.workerPositionsBuffer = undefined;
      }
      if (passive.workerPrevBuffer) {
        message.prevBuffer = passive.workerPrevBuffer;
        transfer.push(passive.workerPrevBuffer);
        passive.workerPrevBuffer = undefined;
      }
      if (passive.workerNormalsBuffer) {
        message.normalsBuffer = passive.workerNormalsBuffer;
        transfer.push(passive.workerNormalsBuffer);
        passive.workerNormalsBuffer = undefined;
      }
      this.worker.postMessage(message, transfer);
      return 'posted';
    } catch {
      passive.workerPending = false;
      if (this.options.wasm && this.backend === 'wasm' && this.failoverToTypeScript('passive worker step post failed')) return 'waiting';
      this.byId.delete(passive.workerId);
      passive.workerId = undefined;
      return 'unavailable';
    }
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.byId.clear();
  }

  private readonly handleMessage = (event: MessageEvent<PassiveWorkerMessage>) => {
    const message = event.data;
    const passive = this.byId.get(message.id);
    if (!passive || message.type === 'ready') return;
    if (message.type === 'failed') {
      this.failoverToTypeScript(message.error || 'passive worker failed');
      return;
    }
    passive.workerPending = false;
    passive.workerPositionsBuffer = message.positions.buffer as ArrayBuffer;
    passive.workerPrevBuffer = message.prev.buffer as ArrayBuffer;
    passive.workerNormalsBuffer = message.normals?.buffer as ArrayBuffer | undefined;
    this.lastTiming = message.timing;
    this.lastUpload = message.upload;
    this.onStep(passive, message.positions, message.prev, message.normals, message.upload);
  };

  private ensure() {
    if (!this.usable) return null;
    if (this.worker) return this.worker;
    try {
      this.worker = this.createWorker(this.options.wasm ? 'wasm' : 'typescript');
      this.worker.onmessage = this.handleMessage;
      this.worker.onerror = () => this.handleWorkerError('passive worker error');
      return this.worker;
    } catch {
      if (!this.options.wasm) {
        this.usable = false;
        return null;
      }
      try {
        this.worker = this.createWorker('typescript');
        this.worker.onmessage = this.handleMessage;
        this.worker.onerror = () => this.handleWorkerError('passive TypeScript worker error');
        return this.worker;
      } catch {
        this.usable = false;
      }
      return null;
    }
  }

  private createWorker(backend: ClothWorkerBackend) {
    this.backend = backend;
    if (backend === 'wasm') return new Worker(new URL('../workers/passiveClothWasm.worker.ts', import.meta.url), { type: 'module' });
    return new Worker(new URL('../workers/passiveCloth.worker.ts', import.meta.url), { type: 'module' });
  }

  private handleWorkerError(reason: string) {
    if (this.options.wasm && this.backend === 'wasm' && this.failoverToTypeScript(reason)) return;
    this.disableAll(reason);
  }

  private failoverToTypeScript(reason: string) {
    this.failures++;
    this.lastError = reason;
    if (!this.options.wasm || this.backend === 'typescript') return false;
    this.failovers++;
    this.worker?.terminate();
    this.worker = null;
    try {
      this.worker = this.createWorker('typescript');
      this.worker.onmessage = this.handleMessage;
      this.worker.onerror = () => this.disableAll('passive TypeScript worker error');
      this.byId.forEach((passive, id) => {
        passive.workerPending = false;
        const snapshot = snapshotClothForWorker(passive.cloth);
        this.worker?.postMessage({ type: 'init', id, snapshot }, clothSnapshotTransferList(snapshot));
      });
      return true;
    } catch {
      this.disableAll('passive TypeScript failover failed');
      return false;
    }
  }

  private disableAll(reason: string) {
    this.failures++;
    this.lastError = reason;
    this.usable = false;
    this.byId.forEach((passive) => {
      passive.workerPending = false;
      passive.workerId = undefined;
    });
    this.terminate();
  }
}

export class ActiveClothWorkerController {
  private worker: Worker | null = null;
  private usable = typeof Worker !== 'undefined';
  private ready = false;
  private backend: ClothWorkerBackend;
  private pending = false;
  private pendingRevision = 0;
  private staleStepRevision = 0;
  private generation = 0;
  private revision = 0;
  private appliedSteps = 0;
  private skippedSnapshots = 0;
  private topologyUpdates = 0;
  private reusableSnapshotBuffers: ClothWorkerSnapshotBuffers | null = null;
  private sourceCloth: ClothData | null = null;
  private failovers = 0;
  private failures = 0;
  private lastError = '';
  private lastTiming: ClothWorkerTiming | undefined;
  private lastUpload: WorkerGeometryUploadHint | undefined;

  constructor(
    private readonly onStep: (snapshot: ClothWorkerSnapshot) => void,
    private readonly options: { wasm?: boolean } = {},
  ) {
    this.backend = options.wasm ? 'wasm' : 'typescript';
  }

  getStatus() {
    return {
      supported: typeof Worker !== 'undefined',
      enabled: !!this.worker && this.usable,
      backend: this.backend,
      wasmRequested: !!this.options.wasm,
      ready: this.ready,
      pending: this.pending,
      generation: this.generation,
      revision: this.revision,
      appliedSteps: this.appliedSteps,
      skippedSnapshots: this.skippedSnapshots,
      topologyUpdates: this.topologyUpdates,
      failovers: this.failovers,
      failures: this.failures,
      lastError: this.lastError,
      timing: this.lastTiming,
      upload: this.lastUpload,
    };
  }

  init(cloth: ClothData) {
    const worker = this.ensure();
    if (!worker) return;
    this.sourceCloth = cloth;
    this.generation++;
    this.revision = 0;
    this.appliedSteps = 0;
    this.skippedSnapshots = 0;
    this.topologyUpdates = 0;
    this.reusableSnapshotBuffers = null;
    this.pending = false;
    this.pendingRevision = 0;
    this.staleStepRevision = 0;
    this.ready = false;
    const snapshot = snapshotClothForWorker(cloth);
    try {
      worker.postMessage({ type: 'init', generation: this.generation, snapshot }, clothSnapshotTransferList(snapshot));
    } catch {
      this.handleWorkerError('active worker init post failed');
    }
  }

  command(command: ActiveWorkerCommand) {
    if (!this.worker || !this.usable || !this.ready) return;
    try {
      this.worker.postMessage({ ...command, generation: this.generation });
      if (this.pending) this.staleStepRevision = this.pendingRevision;
    } catch {
      this.handleWorkerError('active worker command post failed');
    }
  }

  suspend() {
    this.generation++;
    this.ready = false;
    this.pending = false;
    this.pendingRevision = 0;
    this.staleStepRevision = 0;
  }

  step(dt: number, steps: number, damping: number | undefined, gravityScale: number): WorkerStepResult {
    if (!this.worker || !this.usable) return 'unavailable';
    if (!this.ready || this.pending || steps <= 0) return 'waiting';
    this.pending = true;
    this.pendingRevision = ++this.revision;
    const buffers = this.reusableSnapshotBuffers;
    try {
      this.reusableSnapshotBuffers = null;
      this.worker.postMessage({
        type: 'step',
        generation: this.generation,
        revision: this.pendingRevision,
        dt,
        steps,
        damping,
        gravityScale,
        buffers,
      }, buffers ? Object.values(buffers).filter(Boolean) as Transferable[] : []);
      return 'posted';
    } catch {
      this.pending = false;
      this.pendingRevision = 0;
      this.reusableSnapshotBuffers = buffers;
      return this.options.wasm && this.backend === 'wasm' && this.failoverToTypeScript('active worker step post failed') ? 'waiting' : 'unavailable';
    }
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
  }

  private readonly handleMessage = (event: MessageEvent<ActiveWorkerMessage>) => {
    const message = event.data;
    if (message.generation !== this.generation) return;
    if (message.type === 'ready') {
      this.ready = true;
      return;
    }
    if (message.type === 'failed') {
      this.failoverToTypeScript(message.error || 'active worker failed');
      return;
    }
    this.pending = false;
    this.pendingRevision = 0;
    this.reusableSnapshotBuffers = clothSnapshotBuffers(message.snapshot);
    if (message.revision === this.staleStepRevision) {
      this.staleStepRevision = 0;
      this.skippedSnapshots++;
      return;
    }
    this.appliedSteps++;
    if (message.snapshot.index) this.topologyUpdates++;
    this.lastTiming = message.snapshot.timing;
    this.lastUpload = message.snapshot.upload;
    this.onStep(message.snapshot);
  };

  private ensure() {
    if (!this.usable) return null;
    if (this.worker) return this.worker;
    try {
      this.worker = this.createWorker(this.options.wasm ? 'wasm' : 'typescript');
      this.worker.onmessage = this.handleMessage;
      this.worker.onerror = () => this.handleWorkerError('active worker error');
      return this.worker;
    } catch {
      if (!this.options.wasm) {
        this.disable();
        return null;
      }
      try {
        this.worker = this.createWorker('typescript');
        this.worker.onmessage = this.handleMessage;
        this.worker.onerror = () => this.handleWorkerError('active TypeScript worker error');
        return this.worker;
      } catch {
        this.disable();
      }
      return null;
    }
  }

  private createWorker(backend: ClothWorkerBackend) {
    this.backend = backend;
    if (backend === 'wasm') return new Worker(new URL('../workers/activeClothWasm.worker.ts', import.meta.url), { type: 'module' });
    return new Worker(new URL('../workers/activeCloth.worker.ts', import.meta.url), { type: 'module' });
  }

  private handleWorkerError(reason: string) {
    if (this.options.wasm && this.backend === 'wasm' && this.failoverToTypeScript(reason)) return;
    this.disable(reason);
  }

  private failoverToTypeScript(reason: string) {
    this.failures++;
    this.lastError = reason;
    if (!this.options.wasm || this.backend === 'typescript' || !this.sourceCloth) {
      this.disable(reason);
      return false;
    }
    this.failovers++;
    this.worker?.terminate();
    this.worker = null;
    this.pending = false;
    this.pendingRevision = 0;
    this.staleStepRevision = 0;
    this.ready = false;
    try {
      this.worker = this.createWorker('typescript');
      this.worker.onmessage = this.handleMessage;
      this.worker.onerror = () => this.disable('active TypeScript worker error');
      const snapshot = snapshotClothForWorker(this.sourceCloth);
      this.worker.postMessage({ type: 'init', generation: this.generation, snapshot }, clothSnapshotTransferList(snapshot));
      return true;
    } catch {
      this.disable('active TypeScript failover failed');
      return false;
    }
  }

  private disable(reason = '') {
    this.failures++;
    this.lastError = reason;
    this.usable = false;
    this.ready = false;
    this.pending = false;
    this.pendingRevision = 0;
    this.staleStepRevision = 0;
    this.reusableSnapshotBuffers = null;
    this.worker?.terminate();
    this.worker = null;
  }
}
