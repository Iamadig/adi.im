import {
  C_COUNT,
  H_CONSTRAINTS,
  H_DIV,
  PAGE_H,
} from './tearableClothCore';
import type { ClothData } from './tearableClothCore';

const REST_Y = PAGE_H / H_DIV;
const MIN_INVERTED_EDGE = REST_Y * 0.22;
const MAX_INVERTED_VERTICAL_RATIO = 0.018;

export function hasUnsafeActiveFold(cloth: ClothData) {
  let checked = 0;
  let inverted = 0;
  for (let k = H_CONSTRAINTS; k < C_COUNT; k += 1) {
    if (!cloth.cAlive[k]) continue;
    const topY = cloth.positions[cloth.cA[k] * 3 + 1];
    const bottomY = cloth.positions[cloth.cB[k] * 3 + 1];
    checked += 1;
    if (topY + MIN_INVERTED_EDGE < bottomY) inverted += 1;
  }
  return checked > 0 && inverted / checked > MAX_INVERTED_VERTICAL_RATIO;
}
