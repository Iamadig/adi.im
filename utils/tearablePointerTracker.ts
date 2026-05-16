import { TearableHitRegion } from './tearableCanvasLayers';
import { MAX_GRAB_SLOTS } from './tearableGrabSlots';

export interface TearablePointerPoint {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
}

export interface ActiveTearPointer {
  id: number;
  slot: number;
  startX: number;
  startY: number;
  moved: boolean;
  region: TearableHitRegion | null;
  tearArmed: boolean;
  tearing: boolean;
  cutting: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
}

export function createTearablePointerTracker() {
  const activePointers = new Map<number, ActiveTearPointer>();

  function allocateSlot() {
    const used = new Set(Array.from(activePointers.values()).map((pointer) => pointer.slot));
    for (let slot = 0; slot < MAX_GRAB_SLOTS; slot += 1) if (!used.has(slot)) return slot;
    return -1;
  }

  return {
    activePointers,
    begin(event: PointerEvent, point: TearablePointerPoint, region: TearableHitRegion | null, cutting = false) {
      const slot = allocateSlot();
      if (slot < 0) return null;
      const pointer: ActiveTearPointer = {
        id: event.pointerId,
        slot,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        region,
        tearArmed: cutting || !region,
        tearing: false,
        cutting,
        x: point.worldX,
        y: point.worldY,
        px: point.worldX,
        py: point.worldY,
      };
      activePointers.set(event.pointerId, pointer);
      return pointer;
    },
    update(event: PointerEvent, point: TearablePointerPoint) {
      const pointer = activePointers.get(event.pointerId);
      if (!pointer) return null;
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = point.worldX;
      pointer.y = point.worldY;
      if (event.shiftKey) pointer.cutting = true;
      const dx = event.clientX - pointer.startX;
      const dy = event.clientY - pointer.startY;
      const movedSq = dx * dx + dy * dy;
      if (movedSq > 64) pointer.moved = true;
      return { pointer, movedSq };
    },
    finish(pointerId: number) {
      const pointer = activePointers.get(pointerId);
      if (!pointer) return null;
      activePointers.delete(pointerId);
      return pointer;
    },
    clear() {
      activePointers.clear();
    },
    hasTearingPointers() {
      return Array.from(activePointers.values()).some((pointer) => pointer.tearing);
    },
    lastRegion() {
      return activePointers.size ? Array.from(activePointers.values()).at(-1)?.region ?? null : null;
    },
    anyTearArmed() {
      return activePointers.size ? Array.from(activePointers.values()).some((pointer) => pointer.tearArmed) : false;
    },
    debugPointers() {
      return Array.from(activePointers.values()).map((pointer) => ({
        id: pointer.id,
        slot: pointer.slot,
        tearing: pointer.tearing,
        cutting: pointer.cutting,
        moved: pointer.moved,
      }));
    },
  };
}
