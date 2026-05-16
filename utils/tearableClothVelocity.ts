import { N } from './tearableClothCore';

export function clampClothVelocity(positions: Float32Array, prev: Float32Array, maxSpeed: number) {
  const maxSpeedSq = maxSpeed * maxSpeed;
  let clamped = 0;
  for (let i = 0; i < N; i += 1) {
    const i3 = i * 3;
    const vx = positions[i3] - prev[i3];
    const vy = positions[i3 + 1] - prev[i3 + 1];
    const vz = positions[i3 + 2] - prev[i3 + 2];
    const speedSq = vx * vx + vy * vy + vz * vz;
    if (speedSq <= maxSpeedSq) continue;
    const scale = maxSpeed / Math.sqrt(speedSq);
    prev[i3] = positions[i3] - vx * scale;
    prev[i3 + 1] = positions[i3 + 1] - vy * scale;
    prev[i3 + 2] = positions[i3 + 2] - vz * scale;
    clamped += 1;
  }
  return clamped;
}
