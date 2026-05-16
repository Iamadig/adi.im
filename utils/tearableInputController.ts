import { TearableHitRegion } from './tearableCanvasLayers';

export function createTearableInputController() {
  function activateRegion(region: TearableHitRegion) {
    if (region.kind === 'link' && region.href) return void window.open(region.href, '_blank', 'noopener,noreferrer');
  }

  return { activateRegion };
}
