import type * as THREE from 'three';
import { ClothData, PAGE_H, PAGE_W, MouseState } from './tearableClothCore';
import { raycastClothGrid } from './tearableClothRaycast';
import { TEAR_TEXTURE_HEIGHT, TEAR_TEXTURE_WIDTH, TearableHitRegion } from './tearableCanvasLayers';
import type { TearablePointerPoint } from './tearablePointerTracker';

interface PointerProjectionOptions {
  event: PointerEvent;
  renderer: THREE.WebGLRenderer;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
  ndc: THREE.Vector2;
  hit: THREE.Vector3;
  plane: THREE.Plane;
  cloth: ClothData;
  mouse: MouseState;
  mode?: 'mesh' | 'plane';
}

export function pointerToTearablePoint({
  event,
  renderer,
  camera,
  raycaster,
  ndc,
  hit,
  plane,
  cloth,
  mouse,
  mode = 'mesh',
}: PointerProjectionOptions): TearablePointerPoint {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(plane, hit) ?? hit.set(0, 0, 0);
  const clothHit = mode === 'mesh' ? raycastClothGrid(cloth, raycaster.ray, hit) : null;
  if (clothHit) hit.set(clothHit.x, clothHit.y, clothHit.z);
  mouse.px = mouse.x;
  mouse.py = mouse.y;
  mouse.x = hit.x;
  mouse.y = hit.y;
  mouse.active = true;
  if (clothHit) {
    return {
      x: clothHit.u * TEAR_TEXTURE_WIDTH,
      y: (1 - clothHit.v) * TEAR_TEXTURE_HEIGHT,
      worldX: hit.x,
      worldY: hit.y,
    };
  }
  return {
    x: (hit.x / PAGE_W + 0.5) * TEAR_TEXTURE_WIDTH,
    y: (0.5 - hit.y / PAGE_H) * TEAR_TEXTURE_HEIGHT,
    worldX: hit.x,
    worldY: hit.y,
  };
}

export function findTearableHitRegion(activeHitRegions: TearableHitRegion[], x: number, y: number) {
  if (x < 0 || y < 0 || x > TEAR_TEXTURE_WIDTH || y > TEAR_TEXTURE_HEIGHT) return null;
  for (let i = activeHitRegions.length - 1; i >= 0; i -= 1) {
    const region = activeHitRegions[i];
    if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) return region;
  }
  return null;
}

export function updateTearableCursor(host: HTMLElement, region: TearableHitRegion | null, tearing: boolean) {
  if (tearing) host.style.cursor = 'grabbing';
  else if (region) host.style.cursor = 'pointer';
  else host.style.cursor = 'grab';
}
