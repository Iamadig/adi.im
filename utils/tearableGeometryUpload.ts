import * as THREE from 'three';

interface AttributeUploadState {
  position?: Float32Array;
  normal?: Float32Array;
}

interface GeometryUploadHint {
  positionStart: number;
  positionCount: number;
  normalStart: number;
  normalCount: number;
}

const PARTIAL_UPLOAD_COMPONENT_RATIO = 0.62;

export function prepareDynamicGeometryUploads(geometry: THREE.BufferGeometry) {
  geometry.getAttribute('position')?.setUsage(THREE.DynamicDrawUsage);
  geometry.getAttribute('normal')?.setUsage(THREE.DynamicDrawUsage);
}

export function markGeometryUploadRanges(geometry: THREE.BufferGeometry, hint?: GeometryUploadHint) {
  if (hint) {
    markHintedUploadRange(geometry.getAttribute('position') as THREE.BufferAttribute | undefined, hint.positionStart, hint.positionCount);
    markHintedUploadRange(geometry.getAttribute('normal') as THREE.BufferAttribute | undefined, hint.normalStart, hint.normalCount);
    return;
  }
  const state = geometry.userData.tearUploadState as AttributeUploadState | undefined ?? {};
  geometry.userData.tearUploadState = state;
  markAttributeUploadRange(geometry.getAttribute('position') as THREE.BufferAttribute | undefined, 'position', state);
  markAttributeUploadRange(geometry.getAttribute('normal') as THREE.BufferAttribute | undefined, 'normal', state);
}

function markHintedUploadRange(attribute: THREE.BufferAttribute | undefined, start: number, count: number) {
  if (!attribute) return;
  attribute.clearUpdateRanges();
  if (count > 0 && count < attribute.array.length) attribute.addUpdateRange(start, count);
  attribute.needsUpdate = count > 0;
}

function markAttributeUploadRange(
  attribute: THREE.BufferAttribute | undefined,
  key: keyof AttributeUploadState,
  state: AttributeUploadState,
) {
  if (!attribute || !(attribute.array instanceof Float32Array)) return;
  const array = attribute.array;
  const previous = state[key];
  if (!previous || previous.length !== array.length) {
    state[key] = new Float32Array(array);
    attribute.clearUpdateRanges();
    attribute.needsUpdate = true;
    return;
  }

  attribute.clearUpdateRanges();
  let start = -1, end = -1, changed = 0;
  for (let i = 0; i < array.length; i += 1) {
    if (array[i] === previous[i]) continue;
    if (start < 0) start = i;
    end = i + 1;
    previous[i] = array[i];
    changed += 1;
  }
  if (!changed) return;
  if (changed / array.length <= PARTIAL_UPLOAD_COMPONENT_RATIO && start >= 0) {
    attribute.addUpdateRange(start, end - start);
  }
  attribute.needsUpdate = true;
}
