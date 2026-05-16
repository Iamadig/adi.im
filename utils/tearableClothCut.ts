import { C_COUNT, H_CONSTRAINTS, H_DIV, W, W_DIV } from './tearableClothCore';
import type { ClothData } from './tearableClothCore';

export function cutClothSegment(cloth: ClothData, ax: number, ay: number, bx: number, by: number, radius: number) {
  const radiusSq = radius * radius;
  let killed = 0;
  for (let k = 0; k < C_COUNT; k += 1) {
    if (!cloth.cAlive[k]) continue;
    const a = cloth.cA[k] * 3;
    const b = cloth.cB[k] * 3;
    if (segmentDistanceSq(ax, ay, bx, by, cloth.positions[a], cloth.positions[a + 1], cloth.positions[b], cloth.positions[b + 1]) > radiusSq) continue;
    killConstraint(cloth, k);
    killed += 1;
  }
  return killed;
}

function killConstraint(cloth: ClothData, k: number) {
  cloth.cAlive[k] = 0;
  cloth.cLambda[k] = 0;
  cloth.isolation[cloth.cA[k]] = Math.min(6, cloth.isolation[cloth.cA[k]] + 1);
  cloth.isolation[cloth.cB[k]] = Math.min(6, cloth.isolation[cloth.cB[k]] + 1);
  killCellsForConstraint(cloth, k);
  cloth.dirtyIndex = true;
  cloth.tearCount += 1;
}

function killCellsForConstraint(cloth: ClothData, k: number) {
  if (k < H_CONSTRAINTS) {
    const x = k % W_DIV;
    const y = Math.floor(k / W_DIV);
    if (y > 0) cloth.cellAlive[(y - 1) * W_DIV + x] = 0;
    if (y < H_DIV) cloth.cellAlive[y * W_DIV + x] = 0;
    return;
  }
  const idx = k - H_CONSTRAINTS;
  const x = idx % W;
  const y = Math.floor(idx / W);
  if (x > 0) cloth.cellAlive[y * W_DIV + x - 1] = 0;
  if (x < W_DIV) cloth.cellAlive[y * W_DIV + x] = 0;
}

function segmentDistanceSq(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  return Math.min(
    pointSegmentDistanceSq(ax, ay, cx, cy, dx, dy),
    pointSegmentDistanceSq(bx, by, cx, cy, dx, dy),
    pointSegmentDistanceSq(cx, cy, ax, ay, bx, by),
    pointSegmentDistanceSq(dx, dy, ax, ay, bx, by),
  );
}

function pointSegmentDistanceSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const x = ax + dx * t - px;
  const y = ay + dy * t - py;
  return x * x + y * y;
}
