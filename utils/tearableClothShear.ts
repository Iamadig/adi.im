export function relaxClothShear(
  positions: Float32Array,
  pinned: Uint8Array,
  cellAlive: Uint8Array,
  width: number,
  height: number,
  restDiagonal: number,
  stiffness: number,
) {
  const cellsWide = width - 1;
  const cellsHigh = height - 1;
  for (let y = 0; y < cellsHigh; y += 1) for (let x = 0; x < cellsWide; x += 1) {
    if (!cellAlive[y * cellsWide + x]) continue;
    const tl = y * width + x;
    const tr = tl + 1;
    const bl = (y + 1) * width + x;
    const br = bl + 1;
    relaxDistance(positions, pinned, tl, br, restDiagonal, stiffness);
    relaxDistance(positions, pinned, tr, bl, restDiagonal, stiffness);
  }
}

export function relaxDistance(
  positions: Float32Array,
  pinned: Uint8Array,
  a: number,
  b: number,
  rest: number,
  stiffness: number,
) {
  const a3 = a * 3;
  const b3 = b * 3;
  const dx = positions[a3] - positions[b3];
  const dy = positions[a3 + 1] - positions[b3 + 1];
  const dz = positions[a3 + 2] - positions[b3 + 2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!dist) return;
  const pa = pinned[a] ? 0 : 1;
  const pb = pinned[b] ? 0 : 1;
  const sum = pa + pb;
  if (!sum) return;
  const correction = (dist - rest) / dist * stiffness / sum;
  positions[a3] -= pa * dx * correction;
  positions[a3 + 1] -= pa * dy * correction;
  positions[a3 + 2] -= pa * dz * correction;
  positions[b3] += pb * dx * correction;
  positions[b3 + 1] += pb * dy * correction;
  positions[b3 + 2] += pb * dz * correction;
}
