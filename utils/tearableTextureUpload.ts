import * as THREE from 'three';

export interface TearableTextureUploadStats {
  fullUploads: number;
  partialUploads: number;
  skippedUploads: number;
  lastMode: 'full' | 'partial' | 'none';
  lastChangedRows: number;
  lastChangedPixels: number;
  lastUploadComponents: number;
}

export interface TearableTextureUpload {
  texture: THREE.DataTexture;
  pixels: Uint8Array;
  stats: TearableTextureUploadStats;
}

const COMPONENTS = 4;

export function createTearableTextureUpload(canvas: HTMLCanvasElement): TearableTextureUpload {
  const pixels = readCanvasPixels(canvas);
  const texture = new THREE.DataTexture(pixels, canvas.width, canvas.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.flipY = true;
  texture.needsUpdate = true;
  return {
    texture,
    pixels,
    stats: {
      fullUploads: 1,
      partialUploads: 0,
      skippedUploads: 0,
      lastMode: 'full',
      lastChangedRows: canvas.height,
      lastChangedPixels: canvas.width * canvas.height,
      lastUploadComponents: pixels.length,
    },
  };
}

export function syncTearableTextureUpload(canvas: HTMLCanvasElement, upload: TearableTextureUpload) {
  const next = readCanvasPixels(canvas);
  const rowStride = canvas.width * COMPONENTS;
  let changedRows = 0;
  let changedPixels = 0;

  for (let row = 0; row < canvas.height; row += 1) {
    const rowStart = row * rowStride;
    const rowEnd = rowStart + rowStride;
    let first = -1;
    let last = -1;
    for (let i = rowStart; i < rowEnd; i += 1) {
      if (upload.pixels[i] === next[i]) continue;
      if (first < 0) first = i;
      last = i;
    }
    if (first < 0) continue;
    const start = Math.floor(first / COMPONENTS) * COMPONENTS;
    const end = (Math.floor(last / COMPONENTS) + 1) * COMPONENTS;
    upload.pixels.set(next.subarray(start, end), start);
    changedRows += 1;
    changedPixels += (end - start) / COMPONENTS;
  }

  if (!changedRows) {
    upload.stats.skippedUploads += 1;
    upload.stats.lastMode = 'none';
    upload.stats.lastChangedRows = 0;
    upload.stats.lastChangedPixels = 0;
    upload.stats.lastUploadComponents = 0;
    return;
  }

  upload.texture.clearUpdateRanges();
  // Three/WebGL partial DataTexture updates with flipY can upload mirrored row bands
  // in some browser paths. Repaints are rare, so use a full upload for correctness.
  upload.pixels.set(next);
  upload.stats.fullUploads += 1;
  upload.stats.lastMode = 'full';
  upload.stats.lastUploadComponents = upload.pixels.length;
  upload.stats.lastChangedRows = changedRows;
  upload.stats.lastChangedPixels = changedPixels;
  upload.texture.needsUpdate = true;
}

function readCanvasPixels(canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d');
  if (!g) return new Uint8Array(canvas.width * canvas.height * COMPONENTS);
  return new Uint8Array(g.getImageData(0, 0, canvas.width, canvas.height).data);
}
