# Tearable Physics Audit

read_when: changing cloth physics, tear/release transitions, browser smoke coverage, or Pushmatrix fidelity.

## Current Verified Behavior

- The active sheet is promoted into a falling passive sheet instead of being replaced by a static snapshot.
- Drop promotion waits for a short post-release rebound window before converting the active sheet to a falling passive.
- Drop impulse is added to existing cloth velocity, preserving stored release momentum instead of replacing it with a uniform downward kick.
- Secondary-button drag uses an explicit cut segment path, killing nearby constraints and updating live-cell topology without relying solely on stretch thresholds. Shift-drag uses the same path as a keyboard-accessible shortcut.
- Active and passive cloth simulation run through WASM workers by default when `Worker` is available.
- The TypeScript worker remains an explicit fallback behind `VITE_TEARABLE_WASM=0`, `?wasmCloth=0`, or `localStorage.tearableWasm = '0'`.
- WASM worker startup/runtime failures rehydrate the same cloth into the TypeScript worker backend before disabling worker simulation, so async WASM failures do not strand a sheet.
- WASM parity is covered by `test:wasm`, including active solve motion, motion-only snapshots, worker timing metadata, passive falling, normals, explicit cuts, tear counts, and worker-generated live topology indices.
- Active and passive worker snapshots return normals so drag/drop frames avoid main-thread normal recomputation.
- Active WASM worker snapshots send motion-only buffers on normal frames and include constraint/topology state only when topology changes.
- Active worker snapshots return topology index buffers when constraints tear, so the main thread applies worker-generated draw topology instead of rebuilding it during the drag path.
- Worker snapshots return geometry upload hints and timing stats for solve, copy, topology, and total worker work; the debug state exposes those counters for active and passive workers.
- Active worker snapshots posted before a later pointer command are skipped on arrival, preventing stale worker frames from rewinding immediate main-thread grab/cut updates.
- Main-thread topology application reuses existing dynamic index buffers and draw ranges when capacity allows, reducing allocation churn during tear/cut updates.
- Cloth position and normal buffers use dynamic draw usage and worker-provided changed ranges when available, falling back to per-geometry changed-range tracking for local edits.
- Initial mesh-mode pointer hits use a bounded cloth-grid raycast over nearby live cells instead of Three's generic mesh raycaster.
- Active tear/cut pointer moves switch to plane projection after the gesture starts, avoiding repeated deforming-mesh raycasts on the hottest drag path.
- Layer canvases upload through `DataTexture` row ranges after the initial paint, so protected article repaints can update changed texture rows instead of re-uploading the entire sheet.
- Active and passive solver steps include live-cell diagonal shear correction, reducing rubbery in-plane skew while leaving torn cells free to separate.
- Active and passive solver steps include an intact-neighbor bend/strain pass across second-neighbor particle spans, increasing sheet-like resistance while leaving torn seams free.
- Active and passive solver steps include a lightweight curvature smoothing pass gated by intact neighbor constraints, so local folds rebound more like one sheet while torn edges stay free.
- Active and passive solver steps cap extreme per-particle velocity outliers after constraint solving, preserving normal rebound while preventing single-frame snap spikes from carrying into the next frame.
- Single-pointer dragging still uses slot `0`; additional touch pointers get independent grab slots.
- The browser smoke test verifies protected link clicks, display-only Thoughts/Quotes canvas surfaces, real wheel scrolling and clicks in the Thoughts article pane, hidden arrow navigation, secondary-button cut/tear, reset, mobile overflow, live falling passives, worker usage, two-touch grab slots, and frame pacing during tear/drop.
- The deterministic physics test verifies live-cloth promotion, momentum-preserving drop impulse, explicit cut topology, reusable topology buffers, physical falling, bounded stretch, shear correction, curvature smoothing, and multi-grab slot release.

## Remaining Pushmatrix Gaps

- Pushmatrix likely has a more mature WASM constraint stack; this site now has WASM active/passive workers plus shear, bend/strain, curvature, and velocity-outlier damping, but it is still a smaller custom solver.
- Pushmatrix supports explicit secondary-button cutting; this site now supports secondary-button cut with Shift-drag as an additional shortcut in the default WASM active solver.
- Pushmatrix computes/reuses more mesh data in the worker and WASM runtime; this site now receives active topology updates, motion-only snapshots, worker upload hints, and timing metadata, but still commits Three geometry from the main render thread.
- Pushmatrix uses lower-level partial texture upload plumbing; this site now performs row-range `DataTexture` uploads for changed canvas pixels, while still repainting the 2D canvas before diffing.
- Pushmatrix uses a stronger WASM/BVH-style interaction runtime; this site now avoids Three mesh raycasting for initial hits and repeated drag moves, but still uses a bounded local cloth-grid scan instead of a full acceleration structure.

## Definition Of Done Evidence

| # | Requirement | Evidence |
| --- | --- | --- |
| 1 | Tearing keeps the same simulated cloth alive through release/drop. | `test:physics` asserts `promoteLivePassive` preserves the live cloth object and mesh. Browser smoke asserts rebound has `passives = 0` before promotion and falling passives remain live. |
| 2 | Released sheets rebound, preserve tension, fall through, and settle without teleport/snap artifacts. | `test:physics` asserts momentum-preserving drop impulse, passive fall, bounded stretch, shear, curvature smoothing, and velocity-outlier damping. Browser smoke asserts rebound phase, dropping phase, downward passive movement, and frame pacing limits. |
| 3 | Next layer appears only after physical release feels natural. | Browser smoke asserts the section remains `About Me` during `dropping`, then reveals `Thoughts` only after the tear/drop delay. |
| 4 | Page content remains on the tearable sheet while protected DOM regions stay interactive. | Browser smoke verifies protected profile links, display-only Thoughts/Quotes canvas surfaces, real Thoughts pane wheel scrolling, article-list clicks, and no accidental tear/passive creation from those interactions. |
| 5 | Keyboard reset and hidden page navigation still work. | Browser smoke verifies ArrowRight/ArrowLeft page changes, reset while a sheet is falling, and reset after reveal. |
| 6 | Desktop/mobile avoid overflow and keep bottom guidance visible. | Browser smoke checks desktop hint bounds on About/Thoughts and mobile canvas/hint/scroll-width bounds at `390x844`. |
| 7 | Deterministic/manual coverage exists for tear, release, reset, navigation, protected regions, responsive behavior. | `test:physics` covers deterministic solver/topology/drop cases, worker upload hints, and WASM-to-TypeScript failover; `test:browser-smoke` covers the end-to-end browser interaction matrix plus worker timing/upload debug state. |
| 8 | Code remains maintainable, typed, and shippable with gate passing. | Files stay under the repo guardrail; gate is `npm run lint --if-present`, `npm run typecheck`, `npm run test:physics`, `npm run test:wasm`, `npm run test:browser-smoke:wasm`, `npm run test:browser-smoke:ts`, `npm run build`, and `git diff --check`. |
| 9 | Final verification uses local browser testing and records Pushmatrix gaps. | Browser smoke runs against default WASM and forced TypeScript fallback; remaining Pushmatrix gaps are listed above. |

## Gate

Run before shipping physics changes:

```bash
npm run lint --if-present
npm run typecheck
npm run test:physics
npm run test:wasm
npm run test:browser-smoke:wasm
npm run test:browser-smoke:ts
npm run build
git diff --check
```
