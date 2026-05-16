import { relaxDistance } from './tearableClothShear';

export function relaxClothCurvature(
  positions: Float32Array,
  pinned: Uint8Array,
  constraintsAlive: Uint8Array,
  width: number,
  height: number,
  horizontalConstraintCount: number,
  stiffness: number,
) {
  const rowConstraints = width - 1;
  for (let y = 0; y < height; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const leftConstraint = y * rowConstraints + x - 1;
    if (!constraintsAlive[leftConstraint] || !constraintsAlive[leftConstraint + 1]) continue;
    smoothParticle(positions, pinned, y * width + x, y * width + x - 1, y * width + x + 1, stiffness);
  }
  for (let y = 1; y < height - 1; y += 1) for (let x = 0; x < width; x += 1) {
    const topConstraint = horizontalConstraintCount + (y - 1) * width + x;
    if (!constraintsAlive[topConstraint] || !constraintsAlive[topConstraint + width]) continue;
    smoothParticle(positions, pinned, y * width + x, (y - 1) * width + x, (y + 1) * width + x, stiffness);
  }
}

export function relaxClothBend(
  positions: Float32Array,
  pinned: Uint8Array,
  constraintsAlive: Uint8Array,
  width: number,
  height: number,
  horizontalConstraintCount: number,
  restX: number,
  restY: number,
  stiffness: number,
) {
  const rowConstraints = width - 1;
  for (let y = 0; y < height; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const leftConstraint = y * rowConstraints + x - 1;
    if (!constraintsAlive[leftConstraint] || !constraintsAlive[leftConstraint + 1]) continue;
    relaxDistance(positions, pinned, y * width + x - 1, y * width + x + 1, restX * 2, stiffness);
  }
  for (let y = 1; y < height - 1; y += 1) for (let x = 0; x < width; x += 1) {
    const topConstraint = horizontalConstraintCount + (y - 1) * width + x;
    if (!constraintsAlive[topConstraint] || !constraintsAlive[topConstraint + width]) continue;
    relaxDistance(positions, pinned, (y - 1) * width + x, (y + 1) * width + x, restY * 2, stiffness);
  }
}

function smoothParticle(
  positions: Float32Array,
  pinned: Uint8Array,
  center: number,
  first: number,
  second: number,
  stiffness: number,
) {
  if (pinned[center]) return;
  const c3 = center * 3;
  const a3 = first * 3;
  const b3 = second * 3;
  positions[c3] += ((positions[a3] + positions[b3]) * 0.5 - positions[c3]) * stiffness;
  positions[c3 + 1] += ((positions[a3 + 1] + positions[b3 + 1]) * 0.5 - positions[c3 + 1]) * stiffness;
  positions[c3 + 2] += ((positions[a3 + 2] + positions[b3 + 2]) * 0.5 - positions[c3 + 2]) * stiffness;
}
