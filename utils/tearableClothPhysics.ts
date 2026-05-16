import * as THREE from 'three';
import {
  C_COUNT,
  N,
  PASSIVE_LIFE,
  averageMotion,
  buildAliveIndex,
  clamp,
  computeNormals,
  createGrabState,
  dropPins,
  releaseGrab,
  stepPassiveCloth,
} from './tearableClothCore';
import type { ClothData } from './tearableClothCore';
import { markGeometryUploadRanges, prepareDynamicGeometryUploads } from './tearableGeometryUpload';
import type { WorkerGeometryUploadHint } from './tearableClothWorkerState';
export { cutClothSegment } from './tearableClothCut';

export {
  PAGE_W,
  PAGE_H,
  PASSIVE_LIFE,
  MAX_GRAB_SLOTS,
  createMouseState,
  createCloth,
  resetCloth,
  createGrabState,
  beginGrab,
  moveGrab,
  releaseGrab,
  stepActive,
  dropPins,
  releaseTopEdge,
  aliveFraction,
  tearProgress,
  getClothDebugState,
  stepPassiveCloth,
  buildAliveIndex,
} from './tearableClothCore';
export type { ClothData, ClothDebugState, MouseState, TearPhase } from './tearableClothCore';

const PASSIVE_START_OPACITY = 1;

export interface PassiveCloth {
  cloth: ClothData;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  mesh: THREE.Mesh;
  texture: THREE.Texture;
  age: number;
  stepCarry: number;
  driftX: number;
  driftY: number;
  spin: number;
  workerId?: number;
  workerPending?: boolean;
  workerPositionsBuffer?: ArrayBuffer;
  workerPrevBuffer?: ArrayBuffer;
  workerNormalsBuffer?: ArrayBuffer;
}

export function createGeometry(cloth: ClothData) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(cloth.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(cloth.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(cloth.uvs, 2));
  prepareDynamicGeometryUploads(geometry);
  rebuildIndex(geometry, cloth);
  return geometry;
}

export function commitGeometry(geometry: THREE.BufferGeometry, cloth: ClothData, refreshNormals = true, upload?: WorkerGeometryUploadHint) {
  if (refreshNormals) computeNormals(cloth);
  markGeometryUploadRanges(geometry, upload);
}

export function rebuildIndex(geometry: THREE.BufferGeometry, cloth: ClothData) {
  setGeometryIndex(geometry, buildAliveIndex(cloth));
  cloth.dirtyIndex = false;
}

export function setGeometryIndex(geometry: THREE.BufferGeometry, indices: Uint32Array) {
  const existing = geometry.getIndex();
  if (existing?.array instanceof Uint32Array && existing.array.length >= indices.length) {
    existing.array.set(indices);
    existing.needsUpdate = true;
    geometry.setDrawRange(0, indices.length);
    return;
  }
  const attribute = new THREE.BufferAttribute(indices, 1);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setIndex(attribute);
  geometry.setDrawRange(0, indices.length);
}

export function snapshotPassive(source: ClothData, texture: THREE.Texture, scene: THREE.Scene, dropImpulse: number): PassiveCloth {
  const cloth: ClothData = {
    positions: source.positions.slice(),
    prev: source.prev.slice(),
    normals: source.normals.slice(),
    pinned: new Uint8Array(N),
    isolation: source.isolation.slice(),
    uvs: source.uvs.slice(),
    cA: source.cA,
    cB: source.cB,
    cRest: source.cRest,
    cAlive: source.cAlive.slice(),
    cLambda: new Float32Array(C_COUNT),
    cellAlive: source.cellAlive.slice(),
    grab: createGrabState(),
    dirtyIndex: false,
    tearCount: source.tearCount,
  };
  applyDropImpulse(cloth, dropImpulse);
  const geometry = createGeometry(cloth);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: PASSIVE_START_OPACITY,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = 0.22;
  scene.add(mesh);
  const motion = averageMotion(source);
  const driftX = clamp(motion.vx * 34 + (motion.cx < 0 ? -0.11 : 0.11), -0.44, 0.44);
  const spin = clamp(motion.vx * 0.16 - motion.vy * 0.08 + (motion.cx < 0 ? -0.025 : 0.025), -0.18, 0.18);
  return { cloth, geometry, material, mesh, texture, age: 0, stepCarry: 0, driftX, driftY: -0.62, spin };
}

export function promoteLivePassive(
  cloth: ClothData,
  geometry: THREE.BufferGeometry,
  material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial,
  mesh: THREE.Mesh,
  texture: THREE.Texture,
  dropImpulse: number,
): PassiveCloth {
  releaseGrab(cloth);
  dropPins(cloth);
  applyDropImpulse(cloth, dropImpulse);
  material.transparent = true;
  material.opacity = PASSIVE_START_OPACITY;
  material.depthWrite = false;
  material.needsUpdate = true;
  mesh.position.z = 0.22;
  mesh.renderOrder = 8;
  const motion = averageMotion(cloth);
  const driftX = clamp(motion.vx * 34 + (motion.cx < 0 ? -0.11 : 0.11), -0.44, 0.44);
  const spin = clamp(motion.vx * 0.16 - motion.vy * 0.08 + (motion.cx < 0 ? -0.025 : 0.025), -0.18, 0.18);
  return { cloth, geometry, material, mesh, texture, age: 0, stepCarry: 0, driftX, driftY: -0.62, spin };
}

export function advancePassiveVisual(passive: PassiveCloth, dt: number) {
  passive.age += dt;
  const exitEase = Math.min(1, passive.age / 0.35);
  passive.mesh.position.x += passive.driftX * dt * exitEase;
  passive.mesh.position.y += passive.driftY * dt * (0.55 + passive.age * 0.2);
  passive.mesh.rotation.z += passive.spin * dt * exitEase;
  const fadeStart = PASSIVE_LIFE * 0.66;
  passive.material.opacity = passive.age < fadeStart
    ? PASSIVE_START_OPACITY
    : Math.max(0, PASSIVE_START_OPACITY * (1 - (passive.age - fadeStart) / (PASSIVE_LIFE - fadeStart)));
}

export function stepPassive(passive: PassiveCloth, dt: number) {
  stepPassiveCloth(passive.cloth, dt);
  advancePassiveVisual(passive, dt);
  commitGeometry(passive.geometry, passive.cloth);
}

export function disposePassive(passive: PassiveCloth, scene: THREE.Scene) {
  scene.remove(passive.mesh);
  passive.geometry.dispose();
  passive.material.dispose();
  passive.texture.dispose();
}

export function createPaperMaterial(texture: THREE.Texture, transparent = false) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
    transparent,
    opacity: 1,
  });
}

function applyDropImpulse(cloth: ClothData, dropImpulse: number) {
  for (let i = 0; i < N; i += 1) cloth.prev[i * 3 + 1] += dropImpulse;
}
