import { ClothData, H_DIV, PAGE_H, PAGE_W, W, W_DIV } from './tearableClothCore';

interface RayLike {
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
}

interface PointLike {
  x: number;
  y: number;
}

export interface TearableClothRaycastHit {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
  t: number;
}

const PRIMARY_RADIUS = 4;
const FALLBACK_RADIUS = 14;
const EPSILON = 1e-7;

export function raycastClothGrid(cloth: ClothData, ray: RayLike, planeHit: PointLike): TearableClothRaycastHit | null {
  const centerU = planeHit.x / PAGE_W + 0.5;
  const centerV = 0.5 - planeHit.y / PAGE_H;
  if (centerU < -0.08 || centerU > 1.08 || centerV < -0.08 || centerV > 1.08) return null;
  const cx = clampCell(Math.floor(centerU * W_DIV), W_DIV);
  const cy = clampCell(Math.floor(centerV * H_DIV), H_DIV);
  return scanCells(cloth, ray, cx, cy, PRIMARY_RADIUS) ?? scanCells(cloth, ray, cx, cy, FALLBACK_RADIUS);
}

function scanCells(cloth: ClothData, ray: RayLike, cx: number, cy: number, radius: number) {
  let best: TearableClothRaycastHit | null = null;
  const minX = Math.max(0, cx - radius);
  const maxX = Math.min(W_DIV - 1, cx + radius);
  const minY = Math.max(0, cy - radius);
  const maxY = Math.min(H_DIV - 1, cy + radius);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!cloth.cellAlive[y * W_DIV + x]) continue;
      const a = y * W + x;
      const b = a + 1;
      const c = (y + 1) * W + x;
      const d = c + 1;
      best = nearer(best, intersectTriangle(cloth, ray, a, c, b));
      best = nearer(best, intersectTriangle(cloth, ray, b, c, d));
    }
  }
  return best;
}

function nearer(current: TearableClothRaycastHit | null, next: TearableClothRaycastHit | null) {
  if (!next) return current;
  return !current || next.t < current.t ? next : current;
}

function intersectTriangle(cloth: ClothData, ray: RayLike, ia: number, ib: number, ic: number): TearableClothRaycastHit | null {
  const p = cloth.positions;
  const a = ia * 3, b = ib * 3, c = ic * 3;
  const ax = p[a], ay = p[a + 1], az = p[a + 2];
  const e1x = p[b] - ax, e1y = p[b + 1] - ay, e1z = p[b + 2] - az;
  const e2x = p[c] - ax, e2y = p[c + 1] - ay, e2z = p[c + 2] - az;
  const px = ray.direction.y * e2z - ray.direction.z * e2y;
  const py = ray.direction.z * e2x - ray.direction.x * e2z;
  const pz = ray.direction.x * e2y - ray.direction.y * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < EPSILON) return null;
  const invDet = 1 / det;
  const tx = ray.origin.x - ax, ty = ray.origin.y - ay, tz = ray.origin.z - az;
  const u = (tx * px + ty * py + tz * pz) * invDet;
  if (u < 0 || u > 1) return null;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (ray.direction.x * qx + ray.direction.y * qy + ray.direction.z * qz) * invDet;
  if (v < 0 || u + v > 1) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * invDet;
  if (t < EPSILON) return null;
  const w = 1 - u - v;
  const hitU = cloth.uvs[ia * 2] * w + cloth.uvs[ib * 2] * u + cloth.uvs[ic * 2] * v;
  const hitV = cloth.uvs[ia * 2 + 1] * w + cloth.uvs[ib * 2 + 1] * u + cloth.uvs[ic * 2 + 1] * v;
  return {
    x: ax + e1x * u + e2x * v,
    y: ay + e1y * u + e2y * v,
    z: az + e1z * u + e2z * v,
    u: hitU,
    v: hitV,
    t,
  };
}

function clampCell(value: number, maxExclusive: number) {
  return Math.max(0, Math.min(maxExclusive - 1, value));
}
