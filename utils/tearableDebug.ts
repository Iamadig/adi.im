import type { WebGLRenderer } from 'three';
import type { SectionType } from '../types';
import { getNextTearSection, TearableHitRegion } from './tearableCanvasLayers';
import type { ClothData, ClothDebugState, MouseState, TearPhase } from './tearableClothCore';

interface TearDebugWindow extends Window { __tearState?: () => unknown }

interface TearDebugSnapshotOptions {
  currentSection: SectionType;
  phase: TearPhase;
  elapsed: number;
  dropStarted: boolean;
  settling: boolean;
  advanceCooldown: number;
  passives: Array<{ age: number; mesh: { position: { x: number; y: number }; rotation: { z: number } }; workerId?: number }>;
  mouse: MouseState;
  pointers: unknown[];
  tearWork: number;
  passiveWorker: unknown;
  activeWorker: unknown;
  textureUpload: unknown;
  hitRegions: TearableHitRegion[];
  cloth: ClothDebugState;
}

export function shouldExposeTearDebug(window: Window) {
  return import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function exposeTearDebugState(getSnapshot: () => TearDebugSnapshotOptions) {
  const readState = () => {
    const snapshot = getSnapshot();
    return {
      ...snapshot,
      nextSection: getNextTearSection(snapshot.currentSection),
      section: snapshot.currentSection,
      passives: snapshot.passives.length,
      passiveSheets: snapshot.passives.map((passive) => ({
        age: passive.age,
        x: passive.mesh.position.x,
        y: passive.mesh.position.y,
        rotation: passive.mesh.rotation.z,
        worker: !!passive.workerId,
      })),
      hitRegions: snapshot.hitRegions.map(({ id, kind, x, y, width, height }) => ({ id, kind, x, y, width, height })),
    };
  };
  (window as TearDebugWindow).__tearState = readState;
  return () => clearTearDebugState(readState);
}

export function clearTearDebugState(readState?: () => unknown) {
  if (readState && (window as TearDebugWindow).__tearState !== readState) return;
  delete (window as TearDebugWindow).__tearState;
}

export function updateTearDebugDataset(
  renderer: WebGLRenderer,
  currentSection: SectionType,
  phase: TearPhase,
  passivesLength: number,
  activePassiveWorkers: number,
  debug: ClothDebugState,
) {
  renderer.domElement.dataset.tearSection = currentSection;
  renderer.domElement.dataset.tearNext = getNextTearSection(currentSection);
  renderer.domElement.dataset.tearPhase = phase;
  renderer.domElement.dataset.tearPassives = String(passivesLength);
  renderer.domElement.dataset.tearWorkerPassives = String(activePassiveWorkers);
  renderer.domElement.dataset.tearPinnedTop = String(debug.pinnedTop);
  renderer.domElement.dataset.tearPercent = debug.tearPercent.toFixed(3);
  renderer.domElement.dataset.tearAverageSpeed = debug.averageSpeed.toFixed(5);
  renderer.domElement.dataset.tearMaxSpeed = debug.maxSpeed.toFixed(5);
}

export function tearClothDebug(cloth: ClothData, getDebugState: (cloth: ClothData) => ClothDebugState) {
  return getDebugState(cloth);
}
