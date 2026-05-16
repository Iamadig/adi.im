const PAGE_W_F: f32 = 16.0;
const PAGE_H_F: f32 = 9.2;
const W_DIV: i32 = 108;
const H_DIV: i32 = 62;
const W: i32 = W_DIV + 1;
const H: i32 = H_DIV + 1;
const N: i32 = W * H;
const TOTAL_CELLS: i32 = W_DIV * H_DIV;
const H_CONSTRAINTS: i32 = W_DIV * H;
const V_CONSTRAINTS: i32 = W * H_DIV;
const C_COUNT: i32 = H_CONSTRAINTS + V_CONSTRAINTS;
const VEC3_BYTES: i32 = N * 3 * 4;
const REST_X: f32 = PAGE_W_F / 108.0;
const REST_Y: f32 = PAGE_H_F / 62.0;
const REST_DIAGONAL: f32 = 0.21059895;
const TEAR_RATIO: f32 = 4.0;
const ITERATIONS: i32 = 3;
const ACTIVE_CONSTRAINT_STIFFNESS: f32 = 0.42;
const PASSIVE_CONSTRAINT_STIFFNESS: f32 = 0.34;
const ACTIVE_CONSTRAINT_COMPLIANCE: f32 = 0.000018;
const PASSIVE_CONSTRAINT_COMPLIANCE: f32 = 0.000032;
const ACTIVE_CURVATURE_STIFFNESS: f32 = 0.035;
const PASSIVE_CURVATURE_STIFFNESS: f32 = 0.045;
const ACTIVE_BEND_STIFFNESS: f32 = 0.055;
const PASSIVE_BEND_STIFFNESS: f32 = 0.045;
const ACTIVE_SHEAR_STIFFNESS: f32 = 0.16;
const PASSIVE_SHEAR_STIFFNESS: f32 = 0.12;
const FRICTION: f32 = 0.978;
const GRAVITY: f32 = -0.0009;
const PASSIVE_GRAVITY: f32 = -0.00075;
const GRAB_RADIUS: f32 = 0.52;
const GRAB_STRENGTH: f32 = 0.58;
const MAX_SPEED: f32 = 1.25;
const PASSIVE_MAX_SPEED: f32 = 0.9;
const MAX_GRAB_SLOTS: i32 = 4;

const POSITIONS_PTR: i32 = 0;
const PREV_PTR: i32 = POSITIONS_PTR + VEC3_BYTES;
const NORMALS_PTR: i32 = PREV_PTR + VEC3_BYTES;
const PINNED_PTR: i32 = NORMALS_PTR + VEC3_BYTES;
const ISOLATION_PTR: i32 = ((PINNED_PTR + N + 3) >> 2) << 2;
const C_ALIVE_PTR: i32 = ISOLATION_PTR + N * 4;
const CELL_ALIVE_PTR: i32 = C_ALIVE_PTR + C_COUNT;
const C_LAMBDA_PTR: i32 = ((CELL_ALIVE_PTR + TOTAL_CELLS + 3) >> 2) << 2;
const GRAB_SLOT_BY_PARTICLE_PTR: i32 = C_LAMBDA_PTR + C_COUNT * 4;
const GRAB_WEIGHT_PTR: i32 = ((GRAB_SLOT_BY_PARTICLE_PTR + N + 3) >> 2) << 2;
const GRAB_OFFSET_X_PTR: i32 = GRAB_WEIGHT_PTR + N * 4;
const GRAB_OFFSET_Y_PTR: i32 = GRAB_OFFSET_X_PTR + N * 4;
const GRAB_ACTIVE_SLOTS_PTR: i32 = GRAB_OFFSET_Y_PTR + N * 4;
const GRAB_X_BY_SLOT_PTR: i32 = ((GRAB_ACTIVE_SLOTS_PTR + MAX_GRAB_SLOTS + 3) >> 2) << 2;
const GRAB_Y_BY_SLOT_PTR: i32 = GRAB_X_BY_SLOT_PTR + MAX_GRAB_SLOTS * 4;
const INDEX_PTR: i32 = GRAB_Y_BY_SLOT_PTR + MAX_GRAB_SLOTS * 4;
const REQUIRED_BYTES: i32 = INDEX_PTR + TOTAL_CELLS * 6 * 4;

let dirtyIndex: bool = false;
let tearCount: i32 = 0;
let aliveIndexCount: i32 = 0;

export function ensure_memory(): void {
  const pages = (REQUIRED_BYTES + 65535) >> 16;
  const current = memory.size();
  if (current < pages) memory.grow(pages - current);
}

export function positions_ptr(): i32 { ensure_memory(); return POSITIONS_PTR; }
export function prev_ptr(): i32 { ensure_memory(); return PREV_PTR; }
export function normals_ptr(): i32 { ensure_memory(); return NORMALS_PTR; }
export function pinned_ptr(): i32 { ensure_memory(); return PINNED_PTR; }
export function isolation_ptr(): i32 { ensure_memory(); return ISOLATION_PTR; }
export function c_alive_ptr(): i32 { ensure_memory(); return C_ALIVE_PTR; }
export function cell_alive_ptr(): i32 { ensure_memory(); return CELL_ALIVE_PTR; }
export function index_ptr(): i32 { ensure_memory(); return INDEX_PTR; }
export function index_count(): i32 { return aliveIndexCount; }
export function get_tear_count(): i32 { return tearCount; }
export function set_tear_count(value: i32): void { tearCount = value; }
export function is_dirty_index(): i32 { return dirtyIndex ? 1 : 0; }
export function clear_dirty_index(): void { dirtyIndex = false; }

export function reset_runtime_state(): void {
  ensure_memory();
  for (let i = 0; i < C_COUNT; i++) store<f32>(C_LAMBDA_PTR + (i << 2), 0.0);
  clear_all_grabs();
  dirtyIndex = false;
  aliveIndexCount = 0;
}

export function begin_grab(x: f32, y: f32, slot: i32): i32 {
  ensure_memory();
  const slotId = normalize_slot(slot);
  clear_grab_slot(slotId);
  store<u8>(GRAB_ACTIVE_SLOTS_PTR + slotId, 1);
  store<f32>(GRAB_X_BY_SLOT_PTR + (slotId << 2), x);
  store<f32>(GRAB_Y_BY_SLOT_PTR + (slotId << 2), y);
  const radiusSq = GRAB_RADIUS * GRAB_RADIUS;
  let count = 0;
  for (let i = 0; i < N; i++) {
    if (load<u8>(PINNED_PTR + i) != 0) continue;
    if (load<u8>(GRAB_SLOT_BY_PARTICLE_PTR + i) != 0) continue;
    const i3 = i * 3;
    const dx = f32_load(POSITIONS_PTR, i3) - x;
    const dy = f32_load(POSITIONS_PTR, i3 + 1) - y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radiusSq) continue;
    store<u8>(GRAB_SLOT_BY_PARTICLE_PTR + i, <u8>(slotId + 1));
    store<f32>(GRAB_WEIGHT_PTR + (i << 2), 1.0 - sqrt_f32(d2) / GRAB_RADIUS);
    store<f32>(GRAB_OFFSET_X_PTR + (i << 2), dx);
    store<f32>(GRAB_OFFSET_Y_PTR + (i << 2), dy);
    count++;
  }
  if (count == 0) store<u8>(GRAB_ACTIVE_SLOTS_PTR + slotId, 0);
  return count > 0 ? 1 : 0;
}

export function move_grab(x: f32, y: f32, slot: i32): void {
  const slotId = normalize_slot(slot);
  if (load<u8>(GRAB_ACTIVE_SLOTS_PTR + slotId) == 0) return;
  store<f32>(GRAB_X_BY_SLOT_PTR + (slotId << 2), x);
  store<f32>(GRAB_Y_BY_SLOT_PTR + (slotId << 2), y);
}

export function release_grab(slot: i32): void {
  if (slot < 0) {
    clear_all_grabs();
    return;
  }
  clear_grab_slot(normalize_slot(slot));
}

export function cut_segment(ax: f32, ay: f32, bx: f32, by: f32, radius: f32): i32 {
  const radiusSq = radius * radius;
  let killed = 0;
  for (let k = 0; k < C_COUNT; k++) {
    if (load<u8>(C_ALIVE_PTR + k) == 0) continue;
    const a3 = constraint_a(k) * 3;
    const b3 = constraint_b(k) * 3;
    const distanceSq = segment_distance_sq(
      ax, ay, bx, by,
      f32_load(POSITIONS_PTR, a3), f32_load(POSITIONS_PTR, a3 + 1),
      f32_load(POSITIONS_PTR, b3), f32_load(POSITIONS_PTR, b3 + 1),
    );
    if (distanceSq > radiusSq) continue;
    kill_constraint(k);
    killed++;
  }
  return killed;
}

export function step_active(damping: f32, gravityScale: f32, dt: f32): void {
  ensure_memory();
  const effectiveDamping = damping > 0.0 ? damping : FRICTION;
  const grabbed = has_active_grab();
  for (let i = 0; i < N; i++) {
    if (load<u8>(PINNED_PTR + i) != 0) continue;
    const i3 = i * 3;
    let x = f32_load(POSITIONS_PTR, i3);
    let y = f32_load(POSITIONS_PTR, i3 + 1);
    const z = f32_load(POSITIONS_PTR, i3 + 2);
    const px = f32_load(PREV_PTR, i3);
    const py = f32_load(PREV_PTR, i3 + 1);
    const pz = f32_load(PREV_PTR, i3 + 2);
    const slotByte = load<u8>(GRAB_SLOT_BY_PARTICLE_PTR + i);
    if (grabbed && slotByte != 0) {
      const slotId = <i32>slotByte - 1;
      const weight = f32_load(GRAB_WEIGHT_PTR, i);
      x += (f32_load(GRAB_X_BY_SLOT_PTR, slotId) + f32_load(GRAB_OFFSET_X_PTR, i) - x) * GRAB_STRENGTH * weight;
      y += (f32_load(GRAB_Y_BY_SLOT_PTR, slotId) + f32_load(GRAB_OFFSET_Y_PTR, i) - y) * GRAB_STRENGTH * weight;
    }
    f32_store(PREV_PTR, i3, x);
    f32_store(PREV_PTR, i3 + 1, y);
    f32_store(PREV_PTR, i3 + 2, z);
    const isolation = f32_load(ISOLATION_PTR, i);
    f32_store(POSITIONS_PTR, i3, x + (x - px) * effectiveDamping);
    f32_store(POSITIONS_PTR, i3 + 1, y + (y - py) * effectiveDamping + GRAVITY * gravityScale * (1.0 + isolation * 0.4));
    f32_store(POSITIONS_PTR, i3 + 2, z + (z - pz) * effectiveDamping + isolation * 0.0011);
  }
  relax_constraints(dt, ACTIVE_CONSTRAINT_STIFFNESS, ACTIVE_CONSTRAINT_COMPLIANCE, true, TEAR_RATIO);
  relax_shear(ACTIVE_SHEAR_STIFFNESS);
  relax_curvature(ACTIVE_CURVATURE_STIFFNESS);
  relax_bend(ACTIVE_BEND_STIFFNESS);
  clamp_velocity(MAX_SPEED);
}

export function step_passive(dt: f32): void {
  ensure_memory();
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const x = f32_load(POSITIONS_PTR, i3);
    const y = f32_load(POSITIONS_PTR, i3 + 1);
    const z = f32_load(POSITIONS_PTR, i3 + 2);
    const px = f32_load(PREV_PTR, i3);
    const py = f32_load(PREV_PTR, i3 + 1);
    const pz = f32_load(PREV_PTR, i3 + 2);
    f32_store(PREV_PTR, i3, x);
    f32_store(PREV_PTR, i3 + 1, y);
    f32_store(PREV_PTR, i3 + 2, z);
    f32_store(POSITIONS_PTR, i3, x + (x - px) * 0.99);
    f32_store(POSITIONS_PTR, i3 + 1, y + (y - py) * 0.99 + PASSIVE_GRAVITY);
    f32_store(POSITIONS_PTR, i3 + 2, min_f32(0.08, z + (z - pz) * 0.99 + 0.0012));
  }
  relax_constraints(dt, PASSIVE_CONSTRAINT_STIFFNESS, PASSIVE_CONSTRAINT_COMPLIANCE, false, 6.0);
  relax_shear(PASSIVE_SHEAR_STIFFNESS);
  relax_curvature(PASSIVE_CURVATURE_STIFFNESS);
  relax_bend(PASSIVE_BEND_STIFFNESS);
  clamp_velocity(PASSIVE_MAX_SPEED);
}

export function compute_normals(): void {
  for (let i = 0; i < N * 3; i++) f32_store(NORMALS_PTR, i, 0.0);
  for (let cy = 0; cy < H_DIV; cy++) for (let cx = 0; cx < W_DIV; cx++) {
    if (load<u8>(CELL_ALIVE_PTR + cy * W_DIV + cx) == 0) continue;
    const tl = cy * W + cx;
    const tr = tl + 1;
    const bl = (cy + 1) * W + cx;
    const br = bl + 1;
    add_face_normal(tl, bl, tr);
    add_face_normal(tr, bl, br);
  }
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const nx = f32_load(NORMALS_PTR, i3);
    const ny = f32_load(NORMALS_PTR, i3 + 1);
    const nz = f32_load(NORMALS_PTR, i3 + 2);
    const len = sqrt_f32(nx * nx + ny * ny + nz * nz);
    const inv: f32 = len > 0.0 ? <f32>1.0 / len : <f32>1.0;
    f32_store(NORMALS_PTR, i3, nx * inv);
    f32_store(NORMALS_PTR, i3 + 1, ny * inv);
    f32_store(NORMALS_PTR, i3 + 2, nz * inv);
  }
}

export function build_alive_index(): i32 {
  let k = 0;
  for (let cy = 0; cy < H_DIV; cy++) for (let cx = 0; cx < W_DIV; cx++) {
    if (load<u8>(CELL_ALIVE_PTR + cy * W_DIV + cx) == 0) continue;
    const tl = cy * W + cx;
    const tr = tl + 1;
    const bl = (cy + 1) * W + cx;
    const br = bl + 1;
    store<u32>(INDEX_PTR + (k << 2), <u32>tl);
    store<u32>(INDEX_PTR + ((k + 1) << 2), <u32>bl);
    store<u32>(INDEX_PTR + ((k + 2) << 2), <u32>tr);
    store<u32>(INDEX_PTR + ((k + 3) << 2), <u32>tr);
    store<u32>(INDEX_PTR + ((k + 4) << 2), <u32>bl);
    store<u32>(INDEX_PTR + ((k + 5) << 2), <u32>br);
    k += 6;
  }
  aliveIndexCount = k;
  return k;
}

function relax_constraints(dt: f32, stiffness: f32, compliance: f32, canTear: bool, tearRatio: f32): void {
  for (let i = 0; i < C_COUNT; i++) f32_store(C_LAMBDA_PTR, i, 0.0);
  const alpha = compliance / max_f32(0.000001, dt * dt);
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let k = 0; k < C_COUNT; k++) {
      if (load<u8>(C_ALIVE_PTR + k) == 0) continue;
      const a = constraint_a(k);
      const b = constraint_b(k);
      const a3 = a * 3;
      const b3 = b * 3;
      const dx = f32_load(POSITIONS_PTR, a3) - f32_load(POSITIONS_PTR, b3);
      const dy = f32_load(POSITIONS_PTR, a3 + 1) - f32_load(POSITIONS_PTR, b3 + 1);
      const dz = f32_load(POSITIONS_PTR, a3 + 2) - f32_load(POSITIONS_PTR, b3 + 2);
      const dist = sqrt_f32(dx * dx + dy * dy + dz * dz);
      if (dist == 0.0) continue;
      const rest = constraint_rest(k);
      if (canTear && dist > rest * tearRatio) {
        kill_constraint(k);
        continue;
      }
      const pa: f32 = load<u8>(PINNED_PTR + a) != 0 ? <f32>0.0 : <f32>1.0;
      const pb: f32 = load<u8>(PINNED_PTR + b) != 0 ? <f32>0.0 : <f32>1.0;
      const sum: f32 = pa + pb;
      if (sum == 0.0) continue;
      const lambda: f32 = f32_load(C_LAMBDA_PTR, k);
      const constraint: f32 = dist - rest;
      const deltaLambda: f32 = (-constraint - alpha * lambda) / (sum + alpha) * stiffness;
      f32_store(C_LAMBDA_PTR, k, lambda + deltaLambda);
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      add_position(a3, pa * deltaLambda * nx, pa * deltaLambda * ny, pa * deltaLambda * nz);
      add_position(b3, -pb * deltaLambda * nx, -pb * deltaLambda * ny, -pb * deltaLambda * nz);
    }
  }
}

function relax_shear(stiffness: f32): void {
  for (let y = 0; y < H_DIV; y++) for (let x = 0; x < W_DIV; x++) {
    if (load<u8>(CELL_ALIVE_PTR + y * W_DIV + x) == 0) continue;
    const tl = y * W + x;
    const tr = tl + 1;
    const bl = (y + 1) * W + x;
    const br = bl + 1;
    relax_distance(tl, br, REST_DIAGONAL, stiffness);
    relax_distance(tr, bl, REST_DIAGONAL, stiffness);
  }
}

function relax_curvature(stiffness: f32): void {
  for (let y = 0; y < H; y++) for (let x = 1; x < W - 1; x++) {
    const leftConstraint = y * W_DIV + x - 1;
    if (load<u8>(C_ALIVE_PTR + leftConstraint) == 0 || load<u8>(C_ALIVE_PTR + leftConstraint + 1) == 0) continue;
    smooth_particle(y * W + x, y * W + x - 1, y * W + x + 1, stiffness);
  }
  for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
    const topConstraint = H_CONSTRAINTS + (y - 1) * W + x;
    if (load<u8>(C_ALIVE_PTR + topConstraint) == 0 || load<u8>(C_ALIVE_PTR + topConstraint + W) == 0) continue;
    smooth_particle(y * W + x, (y - 1) * W + x, (y + 1) * W + x, stiffness);
  }
}

function relax_bend(stiffness: f32): void {
  for (let y = 0; y < H; y++) for (let x = 1; x < W - 1; x++) {
    const left = y * W_DIV + x - 1;
    if (load<u8>(C_ALIVE_PTR + left) != 0 && load<u8>(C_ALIVE_PTR + left + 1) != 0) relax_distance(y * W + x - 1, y * W + x + 1, REST_X * 2.0, stiffness);
  }
  for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
    const top = H_CONSTRAINTS + (y - 1) * W + x;
    if (load<u8>(C_ALIVE_PTR + top) != 0 && load<u8>(C_ALIVE_PTR + top + W) != 0) relax_distance((y - 1) * W + x, (y + 1) * W + x, REST_Y * 2.0, stiffness);
  }
}

function clamp_velocity(maxSpeed: f32): void {
  const maxSpeedSq = maxSpeed * maxSpeed;
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const vx = f32_load(POSITIONS_PTR, i3) - f32_load(PREV_PTR, i3);
    const vy = f32_load(POSITIONS_PTR, i3 + 1) - f32_load(PREV_PTR, i3 + 1);
    const vz = f32_load(POSITIONS_PTR, i3 + 2) - f32_load(PREV_PTR, i3 + 2);
    const speedSq = vx * vx + vy * vy + vz * vz;
    if (speedSq <= maxSpeedSq) continue;
    const scale = maxSpeed / sqrt_f32(speedSq);
    f32_store(PREV_PTR, i3, f32_load(POSITIONS_PTR, i3) - vx * scale);
    f32_store(PREV_PTR, i3 + 1, f32_load(POSITIONS_PTR, i3 + 1) - vy * scale);
    f32_store(PREV_PTR, i3 + 2, f32_load(POSITIONS_PTR, i3 + 2) - vz * scale);
  }
}

function relax_distance(a: i32, b: i32, rest: f32, stiffness: f32): void {
  const a3 = a * 3;
  const b3 = b * 3;
  const dx = f32_load(POSITIONS_PTR, a3) - f32_load(POSITIONS_PTR, b3);
  const dy = f32_load(POSITIONS_PTR, a3 + 1) - f32_load(POSITIONS_PTR, b3 + 1);
  const dz = f32_load(POSITIONS_PTR, a3 + 2) - f32_load(POSITIONS_PTR, b3 + 2);
  const dist = sqrt_f32(dx * dx + dy * dy + dz * dz);
  if (dist == 0.0) return;
  const pa: f32 = load<u8>(PINNED_PTR + a) != 0 ? <f32>0.0 : <f32>1.0;
  const pb: f32 = load<u8>(PINNED_PTR + b) != 0 ? <f32>0.0 : <f32>1.0;
  const sum: f32 = pa + pb;
  if (sum == 0.0) return;
  const correction: f32 = (dist - rest) / dist * stiffness / sum;
  add_position(a3, -pa * dx * correction, -pa * dy * correction, -pa * dz * correction);
  add_position(b3, pb * dx * correction, pb * dy * correction, pb * dz * correction);
}

function smooth_particle(center: i32, first: i32, second: i32, stiffness: f32): void {
  if (load<u8>(PINNED_PTR + center) != 0) return;
  const c3 = center * 3;
  const a3 = first * 3;
  const b3 = second * 3;
  add_position(
    c3,
    (f32_load(POSITIONS_PTR, a3) + f32_load(POSITIONS_PTR, b3)) * 0.5 * stiffness - f32_load(POSITIONS_PTR, c3) * stiffness,
    (f32_load(POSITIONS_PTR, a3 + 1) + f32_load(POSITIONS_PTR, b3 + 1)) * 0.5 * stiffness - f32_load(POSITIONS_PTR, c3 + 1) * stiffness,
    (f32_load(POSITIONS_PTR, a3 + 2) + f32_load(POSITIONS_PTR, b3 + 2)) * 0.5 * stiffness - f32_load(POSITIONS_PTR, c3 + 2) * stiffness,
  );
}

function add_face_normal(a: i32, b: i32, c: i32): void {
  const a3 = a * 3;
  const b3 = b * 3;
  const c3 = c * 3;
  const abx = f32_load(POSITIONS_PTR, b3) - f32_load(POSITIONS_PTR, a3);
  const aby = f32_load(POSITIONS_PTR, b3 + 1) - f32_load(POSITIONS_PTR, a3 + 1);
  const abz = f32_load(POSITIONS_PTR, b3 + 2) - f32_load(POSITIONS_PTR, a3 + 2);
  const acx = f32_load(POSITIONS_PTR, c3) - f32_load(POSITIONS_PTR, a3);
  const acy = f32_load(POSITIONS_PTR, c3 + 1) - f32_load(POSITIONS_PTR, a3 + 1);
  const acz = f32_load(POSITIONS_PTR, c3 + 2) - f32_load(POSITIONS_PTR, a3 + 2);
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  add_normal(a3, nx, ny, nz);
  add_normal(b3, nx, ny, nz);
  add_normal(c3, nx, ny, nz);
}

function kill_constraint(k: i32): void {
  if (load<u8>(C_ALIVE_PTR + k) == 0) return;
  store<u8>(C_ALIVE_PTR + k, 0);
  f32_store(C_LAMBDA_PTR, k, 0.0);
  const a = constraint_a(k);
  const b = constraint_b(k);
  f32_store(ISOLATION_PTR, a, min_f32(6.0, f32_load(ISOLATION_PTR, a) + 1.0));
  f32_store(ISOLATION_PTR, b, min_f32(6.0, f32_load(ISOLATION_PTR, b) + 1.0));
  kill_cells_for_constraint(k);
  dirtyIndex = true;
  tearCount++;
}

function kill_cells_for_constraint(k: i32): void {
  if (k < H_CONSTRAINTS) {
    const x = k % W_DIV;
    const y = k / W_DIV;
    if (y > 0) store<u8>(CELL_ALIVE_PTR + (y - 1) * W_DIV + x, 0);
    if (y < H_DIV) store<u8>(CELL_ALIVE_PTR + y * W_DIV + x, 0);
    return;
  }
  const idx = k - H_CONSTRAINTS;
  const x = idx % W;
  const y = idx / W;
  if (x > 0) store<u8>(CELL_ALIVE_PTR + y * W_DIV + x - 1, 0);
  if (x < W_DIV) store<u8>(CELL_ALIVE_PTR + y * W_DIV + x, 0);
}

function clear_grab_slot(slotId: i32): void {
  store<u8>(GRAB_ACTIVE_SLOTS_PTR + slotId, 0);
  for (let i = 0; i < N; i++) {
    if (<i32>load<u8>(GRAB_SLOT_BY_PARTICLE_PTR + i) != slotId + 1) continue;
    store<u8>(GRAB_SLOT_BY_PARTICLE_PTR + i, 0);
    f32_store(GRAB_WEIGHT_PTR, i, 0.0);
    f32_store(GRAB_OFFSET_X_PTR, i, 0.0);
    f32_store(GRAB_OFFSET_Y_PTR, i, 0.0);
  }
}

function clear_all_grabs(): void {
  for (let slot = 0; slot < MAX_GRAB_SLOTS; slot++) store<u8>(GRAB_ACTIVE_SLOTS_PTR + slot, 0);
  for (let i = 0; i < N; i++) {
    store<u8>(GRAB_SLOT_BY_PARTICLE_PTR + i, 0);
    f32_store(GRAB_WEIGHT_PTR, i, 0.0);
    f32_store(GRAB_OFFSET_X_PTR, i, 0.0);
    f32_store(GRAB_OFFSET_Y_PTR, i, 0.0);
  }
}

function has_active_grab(): bool {
  for (let slot = 0; slot < MAX_GRAB_SLOTS; slot++) if (load<u8>(GRAB_ACTIVE_SLOTS_PTR + slot) != 0) return true;
  return false;
}

function normalize_slot(slot: i32): i32 {
  if (slot < 0) return 0;
  if (slot >= MAX_GRAB_SLOTS) return MAX_GRAB_SLOTS - 1;
  return slot;
}

function constraint_a(k: i32): i32 {
  if (k < H_CONSTRAINTS) return (k / W_DIV) * W + (k % W_DIV);
  const idx = k - H_CONSTRAINTS;
  return (idx / W) * W + (idx % W);
}

function constraint_b(k: i32): i32 {
  if (k < H_CONSTRAINTS) return constraint_a(k) + 1;
  return constraint_a(k) + W;
}

function constraint_rest(k: i32): f32 {
  return k < H_CONSTRAINTS ? REST_X : REST_Y;
}

function segment_distance_sq(ax: f32, ay: f32, bx: f32, by: f32, cx: f32, cy: f32, dx: f32, dy: f32): f32 {
  return min_f32(
    min_f32(point_segment_distance_sq(ax, ay, cx, cy, dx, dy), point_segment_distance_sq(bx, by, cx, cy, dx, dy)),
    min_f32(point_segment_distance_sq(cx, cy, ax, ay, bx, by), point_segment_distance_sq(dx, dy, ax, ay, bx, by)),
  );
}

function point_segment_distance_sq(px: f32, py: f32, ax: f32, ay: f32, bx: f32, by: f32): f32 {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = max_f32(0.0, min_f32(1.0, ((px - ax) * dx + (py - ay) * dy) / (lenSq > 0.0 ? lenSq : 1.0)));
  const x = ax + dx * t - px;
  const y = ay + dy * t - py;
  return x * x + y * y;
}

function add_position(i3: i32, x: f32, y: f32, z: f32): void {
  f32_store(POSITIONS_PTR, i3, f32_load(POSITIONS_PTR, i3) + x);
  f32_store(POSITIONS_PTR, i3 + 1, f32_load(POSITIONS_PTR, i3 + 1) + y);
  f32_store(POSITIONS_PTR, i3 + 2, f32_load(POSITIONS_PTR, i3 + 2) + z);
}

function add_normal(i3: i32, x: f32, y: f32, z: f32): void {
  f32_store(NORMALS_PTR, i3, f32_load(NORMALS_PTR, i3) + x);
  f32_store(NORMALS_PTR, i3 + 1, f32_load(NORMALS_PTR, i3 + 1) + y);
  f32_store(NORMALS_PTR, i3 + 2, f32_load(NORMALS_PTR, i3 + 2) + z);
}

function f32_load(base: i32, index: i32): f32 { return load<f32>(base + (index << 2)); }
function f32_store(base: i32, index: i32, value: f32): void { store<f32>(base + (index << 2), value); }
function sqrt_f32(value: f32): f32 { return <f32>Math.sqrt(<f64>value); }
function min_f32(a: f32, b: f32): f32 { return a < b ? a : b; }
function max_f32(a: f32, b: f32): f32 { return a > b ? a : b; }
