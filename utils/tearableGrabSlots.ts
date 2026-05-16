export const MAX_GRAB_SLOTS = 8;

export interface GrabState {
  active: boolean;
  x: number;
  y: number;
  activeSlots: Uint8Array;
  xBySlot: Float32Array;
  yBySlot: Float32Array;
  slotIds: Uint8Array;
  indices: Int32Array;
  slotByParticle: Int32Array;
  weights: Float32Array;
  offsetX: Float32Array;
  offsetY: Float32Array;
  count: number;
  activeSlotCount: number;
}

export function createGrabState(particleCount: number): GrabState {
  return {
    active: false,
    x: 0,
    y: 0,
    activeSlots: new Uint8Array(MAX_GRAB_SLOTS),
    xBySlot: new Float32Array(MAX_GRAB_SLOTS),
    yBySlot: new Float32Array(MAX_GRAB_SLOTS),
    slotIds: new Uint8Array(particleCount),
    indices: new Int32Array(particleCount),
    slotByParticle: new Int32Array(particleCount),
    weights: new Float32Array(particleCount),
    offsetX: new Float32Array(particleCount),
    offsetY: new Float32Array(particleCount),
    count: 0,
    activeSlotCount: 0,
  };
}

export function clearGrab(grab: GrabState) {
  for (let slot = 0; slot < grab.count; slot += 1) grab.slotByParticle[grab.indices[slot]] = 0;
  grab.activeSlots.fill(0);
  grab.active = false;
  grab.count = 0;
  grab.activeSlotCount = 0;
}

export function clearGrabSlot(grab: GrabState, slotId: number) {
  if (!grab.activeSlots[slotId] && grab.count === 0) return;
  grab.slotByParticle.fill(0);
  let write = 0;
  for (let read = 0; read < grab.count; read += 1) {
    if (grab.slotIds[read] === slotId) continue;
    if (write !== read) {
      grab.indices[write] = grab.indices[read];
      grab.slotIds[write] = grab.slotIds[read];
      grab.weights[write] = grab.weights[read];
      grab.offsetX[write] = grab.offsetX[read];
      grab.offsetY[write] = grab.offsetY[read];
    }
    grab.slotByParticle[grab.indices[write]] = write + 1;
    write += 1;
  }
  grab.count = write;
  grab.activeSlots[slotId] = 0;
  updateGrabActivity(grab);
}

export function normalizeGrabSlot(slot: number) {
  return Math.max(0, Math.min(MAX_GRAB_SLOTS - 1, Math.floor(slot) || 0));
}

export function updateGrabActivity(grab: GrabState) {
  let activeSlotCount = 0;
  for (let slot = 0; slot < MAX_GRAB_SLOTS; slot += 1) {
    let hasParticles = false;
    for (let i = 0; i < grab.count; i += 1) {
      if (grab.slotIds[i] === slot) {
        hasParticles = true;
        break;
      }
    }
    grab.activeSlots[slot] = hasParticles ? 1 : 0;
    if (hasParticles) activeSlotCount += 1;
  }
  grab.activeSlotCount = activeSlotCount;
  grab.active = activeSlotCount > 0;
}
