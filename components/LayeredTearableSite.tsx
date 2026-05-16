import { useEffect, useRef } from 'react';
import { SectionType } from '../types';
import {
  PAGE_H, PAGE_W, PASSIVE_LIFE, PassiveCloth, TearPhase, advancePassiveVisual, aliveFraction, beginGrab, commitGeometry, createMouseState,
  cutClothSegment, disposePassive, getClothDebugState, promoteLivePassive, rebuildIndex, resetCloth, releaseGrab, setGeometryIndex, stepActive, stepPassive, tearProgress, moveGrab,
} from '../utils/tearableClothPhysics';
import { applyClothWorkerSnapshot } from '../utils/tearableClothWorkerState';
import { exposeTearDebugState, shouldExposeTearDebug, updateTearDebugDataset } from '../utils/tearableDebug';
import { createTearableInputController } from '../utils/tearableInputController';
import { createTearablePointerTracker } from '../utils/tearablePointerTracker';
import { findTearableHitRegion, pointerToTearablePoint, updateTearableCursor } from '../utils/tearablePointerProjection';
import type { ActiveTearPointer } from '../utils/tearablePointerTracker';
import { hasUnsafeActiveFold } from '../utils/tearableClothSafety';
import { createTearableThreeStage } from '../utils/tearableThreeStage';
import { ActiveClothWorkerController, PassiveClothWorkerController } from '../utils/tearableWorkerControllers';
import { shouldUseTearableWasm } from '../utils/tearableWasmFlag';
import {
  TearableCanvasContent,
  TearableCanvasState,
  TearableLayerRender,
  createTearableLayerRender,
  getNextTearSection,
  repaintTearableLayer,
} from '../utils/tearableCanvasLayers';
const DROP_TEAR_PROGRESS = 0.012, DROP_ALIVE_FRACTION = 0.968, DROP_TEAR_WORK = 10.4, DROP_REBOUND_HOLD = 0.18, CUT_RADIUS = 0.08, POST_DROP_IMPULSE = 0.011, MAX_PASSIVE_LAYERS = 3, RELEASE_SETTLE_MAX = 3.1, RELEASE_SETTLE_MIN = 0.55, SETTLE_AVG_SPEED = 0.0016, SETTLE_MAX_SPEED = 0.01, FIXED_PHYSICS_STEP = 1 / 60, MAX_PHYSICS_STEPS = 4, DROP_ADVANCE_DELAY = 0.42;
interface LayeredTearableSiteProps { activeSection: SectionType; content: TearableCanvasContent; onRevealSection?: (section: SectionType) => void; }
const initialCanvasState: TearableCanvasState = { layout: 'landscape' };
export function LayeredTearableSite({ activeSection, content, onRevealSection }: LayeredTearableSiteProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef(content);
  const activeSectionRef = useRef(activeSection);
  const onRevealRef = useRef(onRevealSection);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { activeSectionRef.current = activeSection; }, [activeSection]);
  useEffect(() => { onRevealRef.current = onRevealSection; }, [onRevealSection]);
  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    const host = hostRef.current;
    const mouse = createMouseState();
    const pointerTracker = createTearablePointerTracker();
    const uiState: TearableCanvasState = { ...initialCanvasState };
    const passives: PassiveCloth[] = [];
    let currentSection = activeSectionRef.current;
    let activeRender = createRenderFor(currentSection);
    let backRender = createRenderFor(getNextTearSection(currentSection));
    const stage = createTearableThreeStage(host, activeRender, backRender);
    const { scene, camera, renderer, raycaster, ndc, hit, plane, backMaterial, backMesh } = stage;
    let { cloth, geometry, material, mesh } = stage.activeSheet;
    let activeHitRegions = activeRender.hitRegions;
    let dropStarted = false, dropSheetPromoted = false;
    let dropStartedAt = 0, advanceCooldown = 0, settleStartedAt = 0, settleUntil = 0, tearWork = 0;
    let advancing = false;
    let phase: TearPhase = 'idle';
    let elapsed = 0, last = performance.now(), raf = 0, activeStepCarry = 0;
    const useWasmCloth = shouldUseTearableWasm(window);
    const passiveWorkers = new PassiveClothWorkerController((passive, positions, prev, normals, upload) => {
      passive.cloth.positions.set(positions);
      passive.cloth.prev.set(prev);
      if (normals) passive.cloth.normals.set(normals);
      commitGeometry(passive.geometry, passive.cloth, !normals, upload);
    }, { wasm: useWasmCloth });
    const activeWorkers = new ActiveClothWorkerController((snapshot) => {
      const previousTearCount = cloth.tearCount;
      applyClothWorkerSnapshot(cloth, snapshot);
      if (snapshot.index) setGeometryIndex(geometry, snapshot.index);
      else if (cloth.tearCount !== previousTearCount) rebuildIndex(geometry, cloth);
      commitGeometry(geometry, cloth, !snapshot.normals, snapshot.upload);
    }, { wasm: useWasmCloth });
    function createRenderFor(section: SectionType) {
      return createTearableLayerRender(section, getNextTearSection(section), contentRef.current, uiState);
    }
    const disposeRender = (render: TearableLayerRender) => render.texture.dispose();
    function repaintActiveSurfaces() {
      repaintTearableLayer(activeRender, currentSection, getNextTearSection(currentSection), contentRef.current, uiState);
      repaintTearableLayer(backRender, getNextTearSection(currentSection), getNextTearSection(getNextTearSection(currentSection)), contentRef.current, uiState);
      activeHitRegions = activeRender.hitRegions;
      material.map = activeRender.texture;
      backMaterial.map = backRender.texture;
      material.needsUpdate = true;
      backMaterial.needsUpdate = true;
    }
    const inputController = createTearableInputController();
    const exposeDebugState = shouldExposeTearDebug(window);
    const clearDebugState = exposeDebugState
      ? exposeTearDebugState(() => ({
        currentSection,
        phase,
        elapsed,
        dropStarted,
        settling: phase === 'torn' && elapsed < settleUntil,
        advanceCooldown,
        passives,
        mouse: { x: mouse.x, y: mouse.y, px: mouse.px, py: mouse.py, down: mouse.down, active: mouse.active },
        pointers: pointerTracker.debugPointers(),
        tearWork,
        passiveWorker: passiveWorkers.getStatus(passives),
        activeWorker: activeWorkers.getStatus(),
        textureUpload: { active: activeRender.textureUpload.stats, back: backRender.textureUpload.stats },
        hitRegions: activeHitRegions,
        cloth: getClothDebugState(cloth),
      }))
      : null;
    function updateDebugDataset() {
      if (!exposeDebugState) return;
      updateTearDebugDataset(renderer, currentSection, phase, passives.length, passiveWorkers.getStatus(passives).active, getClothDebugState(cloth));
    }
    function disposeFallingSheet(passive: PassiveCloth) {
      passiveWorkers.dispose(passive);
      disposePassive(passive, scene);
    }
    function initActiveWorkerForCurrentCloth() {
      activeWorkers.init(cloth);
    }
    function postActiveWorkerCommand(command: Parameters<ActiveClothWorkerController['command']>[0]) {
      activeWorkers.command(command);
    }
    function hasTearingPointers() {
      return pointerTracker.hasTearingPointers();
    }
    function syncMouseFromPointer(pointer: ActiveTearPointer) {
      mouse.px = pointer.px;
      mouse.py = pointer.py;
      mouse.x = pointer.x;
      mouse.y = pointer.y;
      mouse.active = true;
      mouse.down = hasTearingPointers();
    }
    function startPointerTear(pointer: ActiveTearPointer) {
      if (pointer.tearing) return;
      pointer.tearing = true;
      phase = 'dragging';
      syncMouseFromPointer(pointer);
      beginGrab(cloth, pointer.x, pointer.y, pointer.slot);
      postActiveWorkerCommand({ type: 'beginGrab', x: pointer.x, y: pointer.y, slot: pointer.slot });
    }
    function suspendActiveWorkerForPromotedSheet() {
      activeWorkers.suspend();
      activeStepCarry = 0;
    }
    function resize() {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      const viewportAspect = width / height;
      const nextLayout = viewportAspect < 0.72 ? 'portrait' : 'landscape';
      if (uiState.layout !== nextLayout) {
        uiState.layout = nextLayout;
        repaintActiveSurfaces();
      }
      const pageAspect = PAGE_W / PAGE_H;
      let viewW = PAGE_W;
      let viewH = PAGE_H;
      if (viewportAspect > pageAspect) viewH = viewW / viewportAspect;
      else viewW = viewH * viewportAspect;
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.position.set(0, 0, 10);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
    const pointerProjection = () => ({ renderer, camera, raycaster, ndc, hit, plane, cloth, mouse });
    const pointerToCanvas = (event: PointerEvent, mode?: 'mesh' | 'plane') => pointerToTearablePoint({ event, mode, ...pointerProjection() });
    const findRegion = (x: number, y: number) => findTearableHitRegion(activeHitRegions, x, y);
    const updateCursor = (region: ReturnType<typeof findRegion>, tearing: boolean) => updateTearableCursor(host, region, tearing);
    function clearInteractionState() {
      const layout = uiState.layout;
      Object.assign(uiState, initialCanvasState, { layout });
      pointerTracker.clear();
      dropStarted = false;
      dropSheetPromoted = false;
      dropStartedAt = 0;
      settleStartedAt = 0;
      settleUntil = 0;
      tearWork = 0;
      advanceCooldown = 0;
      activeStepCarry = 0;
      mouse.down = hasTearingPointers();
      mouse.active = false;
      releaseGrab(cloth);
      postActiveWorkerCommand({ type: 'releaseGrab' });
    }
    function restoreActiveSheet() {
      resetCloth(cloth);
      releaseGrab(cloth);
      rebuildIndex(geometry, cloth);
      commitGeometry(geometry, cloth);
      initActiveWorkerForCurrentCloth();
      dropStarted = false; dropSheetPromoted = false; tearWork = 0; settleUntil = 0; activeStepCarry = 0; phase = 'idle';
    }
    function resetExperience() {
      const activeSheetIsPassive = dropSheetPromoted;
      passives.splice(0).forEach(disposeFallingSheet);
      disposeRender(activeRender);
      disposeRender(backRender);
      currentSection = SectionType.ABOUT;
      activeSectionRef.current = SectionType.ABOUT;
      activeRender = createRenderFor(currentSection);
      backRender = createRenderFor(getNextTearSection(currentSection));
      activeHitRegions = activeRender.hitRegions;
      if (activeSheetIsPassive) {
        const fresh = stage.createActiveSheet(activeRender);
        cloth = fresh.cloth;
        geometry = fresh.geometry;
        material = fresh.material;
        mesh = fresh.mesh;
      } else {
        resetCloth(cloth);
        rebuildIndex(geometry, cloth);
        commitGeometry(geometry, cloth);
        material.map = activeRender.texture;
      }
      backMaterial.map = backRender.texture;
      material.needsUpdate = true;
      backMaterial.needsUpdate = true;
      initActiveWorkerForCurrentCloth();
      phase = 'idle';
      clearInteractionState();
      onRevealRef.current?.(currentSection);
    }
    function promoteFallingSheet() {
      suspendActiveWorkerForPromotedSheet();
      const passive = promoteLivePassive(cloth, geometry, material, mesh, activeRender.texture, POST_DROP_IMPULSE);
      passiveWorkers.attach(passive);
      passives.push(passive);
      while (passives.length > MAX_PASSIVE_LAYERS) {
        const oldest = passives.shift();
        if (oldest) disposeFallingSheet(oldest);
      }
    }
    function advance() {
      if (advancing) return;
      advancing = true;
      const next = getNextTearSection(currentSection);
      phase = 'advancing';
      if (!dropSheetPromoted) promoteFallingSheet();
      activeRender = backRender;
      currentSection = next;
      activeSectionRef.current = currentSection;
      backRender = createRenderFor(getNextTearSection(currentSection));
      activeHitRegions = activeRender.hitRegions;
      const fresh = stage.createActiveSheet(activeRender);
      cloth = fresh.cloth;
      geometry = fresh.geometry;
      material = fresh.material;
      mesh = fresh.mesh;
      backMaterial.map = backRender.texture;
      material.needsUpdate = true;
      backMaterial.needsUpdate = true;
      initActiveWorkerForCurrentCloth();
      pointerTracker.clear();
      mouse.down = false; mouse.active = false; releaseGrab(cloth);
      dropStarted = false;
      dropSheetPromoted = false;
      dropStartedAt = 0; settleStartedAt = 0; settleUntil = 0; tearWork = 0;
      activeStepCarry = 0;
      advanceCooldown = 1.0;
      phase = 'idle';
      onRevealRef.current?.(currentSection);
      advancing = false;
    }
    function maybeAdvanceAfterDrop() {
      if (!dropStarted || !dropSheetPromoted || advancing) return;
      if (elapsed - dropStartedAt < DROP_ADVANCE_DELAY) return;
      advance();
    }
    function maybeStartDrop(dt: number) {
      advanceCooldown = Math.max(0, advanceCooldown - dt);
      if (advanceCooldown > 0 || mouse.down || (phase === 'torn' && elapsed - settleStartedAt < DROP_REBOUND_HOLD)) return;
      const torn = tearProgress(cloth);
      const alive = aliveFraction(cloth);
      if (!dropStarted && (torn > DROP_TEAR_PROGRESS || alive < DROP_ALIVE_FRACTION || tearWork > DROP_TEAR_WORK)) {
        releaseGrab(cloth);
        mouse.down = false;
        dropStarted = true;
        if (!dropSheetPromoted) {
          promoteFallingSheet();
          dropSheetPromoted = true;
        }
        dropStartedAt = elapsed;
        phase = 'dropping';
      }
    }
    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 && event.button !== 2) return;
      event.preventDefault();
      try { renderer.domElement.setPointerCapture(event.pointerId); } catch {}
      const point = pointerToCanvas(event);
      const cutting = event.button === 2 || event.shiftKey;
      const region = cutting ? null : findRegion(point.x, point.y);
      const pointer = pointerTracker.begin(event, point, region, cutting);
      if (!pointer) return;
      mouse.down = false;
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      updateCursor(region, pointer.tearArmed);
    }
    function handlePointerMove(event: PointerEvent) {
      const existingPointer = pointerTracker.activePointers.get(event.pointerId);
      const point = pointerToCanvas(event, existingPointer?.tearing ? 'plane' : 'mesh');
      const region = existingPointer?.tearing ? null : findRegion(point.x, point.y);
      const pointerUpdate = pointerTracker.update(event, point);
      if (!pointerUpdate) {
        updateCursor(region, false);
        return;
      }
      const { pointer, movedSq } = pointerUpdate;
      if (pointer.tearing || pointer.region || pointer.tearArmed) {
        if (pointer.tearArmed && !pointer.tearing && movedSq > 64) {
          startPointerTear(pointer);
        }
        if (pointer.region && movedSq > 900) {
          pointer.region = null;
          pointer.tearArmed = false;
          startPointerTear(pointer);
        }
      }
      if (!pointer.tearing) {
        updateCursor(region, false);
        return;
      }
      tearWork += Math.hypot(pointer.x - pointer.px, pointer.y - pointer.py);
      syncMouseFromPointer(pointer);
      moveGrab(cloth, pointer.x, pointer.y, pointer.slot);
      postActiveWorkerCommand({ type: 'moveGrab', x: pointer.x, y: pointer.y, slot: pointer.slot });
      if (pointer.cutting) { cutClothSegment(cloth, pointer.px, pointer.py, pointer.x, pointer.y, CUT_RADIUS); postActiveWorkerCommand({ type: 'cutSegment', ax: pointer.px, ay: pointer.py, bx: pointer.x, by: pointer.y, radius: CUT_RADIUS }); }
      updateCursor(null, true);
    }
    function handlePointerUp(event: PointerEvent) {
      const pointer = pointerTracker.finish(event.pointerId);
      if (!pointer) return;
      const wasClick = event.type !== 'pointercancel' && !pointer.moved && pointer.region && !dropStarted;
      if (pointer.tearing) { releaseGrab(cloth, pointer.slot); postActiveWorkerCommand({ type: 'releaseGrab', slot: pointer.slot }); }
      mouse.down = hasTearingPointers();
      if (pointer.tearing && !mouse.down) {
        settleStartedAt = elapsed;
        settleUntil = elapsed + RELEASE_SETTLE_MAX;
      }
      if (!dropStarted) phase = mouse.down ? 'dragging' : (settleUntil > elapsed ? 'torn' : 'idle');
      try { renderer.domElement.releasePointerCapture(event.pointerId); } catch {}
      if (wasClick && pointer.region) inputController.activateRegion(pointer.region);
      if (mouse.down) updateCursor(null, true);
      else {
        const point = pointerToCanvas(event);
        updateCursor(findRegion(point.x, point.y), false);
      }
    }
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'r') return;
      event.preventDefault();
      resetExperience();
    }
    function tick(now: number) {
      if (disposed) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      elapsed += dt;
      if (activeSectionRef.current !== currentSection && !mouse.down) {
        const activeSheetIsPassive = dropSheetPromoted;
        passives.splice(0).forEach(disposeFallingSheet);
        currentSection = activeSectionRef.current;
        disposeRender(activeRender);
        disposeRender(backRender);
        activeRender = createRenderFor(currentSection);
        backRender = createRenderFor(getNextTearSection(currentSection));
        activeHitRegions = activeRender.hitRegions;
        if (activeSheetIsPassive) {
          const fresh = stage.createActiveSheet(activeRender);
          cloth = fresh.cloth;
          geometry = fresh.geometry;
          material = fresh.material;
          mesh = fresh.mesh;
        } else {
          material.map = activeRender.texture;
          resetCloth(cloth);
          releaseGrab(cloth);
          rebuildIndex(geometry, cloth);
          commitGeometry(geometry, cloth);
          material.map = activeRender.texture;
        }
        backMaterial.map = backRender.texture;
        material.needsUpdate = true;
        backMaterial.needsUpdate = true;
        initActiveWorkerForCurrentCloth();
        clearInteractionState();
        phase = 'idle';
      }
      const settling = phase === 'torn' && elapsed < settleUntil, settleAge = settling ? elapsed - settleStartedAt : 0;
      const settleDamping = settling ? Math.max(0.925, 0.982 - Math.max(0, settleAge - 0.35) * 0.045) : undefined;
      if (mouse.down || settling) {
        activeStepCarry = Math.min(FIXED_PHYSICS_STEP * MAX_PHYSICS_STEPS, activeStepCarry + dt);
        const activeSteps = Math.min(Math.floor(activeStepCarry / FIXED_PHYSICS_STEP), MAX_PHYSICS_STEPS);
        const workerResult = activeWorkers.step(FIXED_PHYSICS_STEP, activeSteps, settleDamping, settling ? 0.5 : 1);
        if (workerResult === 'posted') {
          activeStepCarry -= activeSteps * FIXED_PHYSICS_STEP;
        } else if (workerResult === 'unavailable') {
          let mainSteps = 0;
          while (activeStepCarry >= FIXED_PHYSICS_STEP && mainSteps < MAX_PHYSICS_STEPS) {
            stepActive(cloth, undefined, settleDamping, settling ? 0.5 : 1, FIXED_PHYSICS_STEP);
            activeStepCarry -= FIXED_PHYSICS_STEP;
            mainSteps++;
          }
        }
      } else {
        activeStepCarry = 0;
      }
      if (cloth.dirtyIndex) rebuildIndex(geometry, cloth);
      commitGeometry(geometry, cloth);
      maybeStartDrop(dt);
      maybeAdvanceAfterDrop();
      if (settling && settleAge > RELEASE_SETTLE_MIN) {
        const { averageSpeed, maxSpeed } = getClothDebugState(cloth);
        if (averageSpeed < SETTLE_AVG_SPEED && maxSpeed < SETTLE_MAX_SPEED) settleUntil = elapsed;
      }
      if (phase === 'torn' && elapsed >= settleUntil && !dropStarted) restoreActiveSheet();
      else if (phase === 'idle' && !mouse.down && !dropStarted && hasUnsafeActiveFold(cloth)) restoreActiveSheet();
      for (let i = passives.length - 1; i >= 0; i--) {
        const passive = passives[i];
        if (passive.workerId) {
          advancePassiveVisual(passive, dt);
          passive.stepCarry = Math.min(FIXED_PHYSICS_STEP * MAX_PHYSICS_STEPS, passive.stepCarry + dt);
          const passiveSteps = Math.min(Math.floor(passive.stepCarry / FIXED_PHYSICS_STEP), MAX_PHYSICS_STEPS);
          const workerResult = passiveWorkers.step(passive, FIXED_PHYSICS_STEP, passiveSteps);
          if (workerResult === 'posted') {
            passive.stepCarry -= passiveSteps * FIXED_PHYSICS_STEP;
          } else if (workerResult === 'unavailable') {
            passive.workerId = undefined;
          }
        }
        if (!passive.workerId) {
          passive.stepCarry = Math.min(FIXED_PHYSICS_STEP * MAX_PHYSICS_STEPS, passive.stepCarry + dt);
          let passiveSteps = 0;
          while (passive.stepCarry >= FIXED_PHYSICS_STEP && passiveSteps < MAX_PHYSICS_STEPS) {
            stepPassive(passive, FIXED_PHYSICS_STEP);
            passive.stepCarry -= FIXED_PHYSICS_STEP;
            passiveSteps++;
          }
        }
        if (passives[i].age > PASSIVE_LIFE) {
          disposeFallingSheet(passives[i]);
          passives.splice(i, 1);
        }
      }
      backMesh.visible = mouse.down || dropStarted || phase === 'dragging' || phase === 'dropping' || phase === 'torn';
      updateDebugDataset();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('keydown', handleWindowKeyDown);
    initActiveWorkerForCurrentCloth();
    resize();
    raf = requestAnimationFrame(tick);
    document.fonts?.ready.then(() => {
      if (!disposed) repaintActiveSurfaces();
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('keydown', handleWindowKeyDown);
      clearDebugState?.();
      passives.forEach(disposeFallingSheet);
      passiveWorkers.terminate();
      activeWorkers.terminate();
      disposeRender(activeRender);
      disposeRender(backRender);
      geometry.dispose();
      material.dispose();
      stage.disposeBase();
    };
  }, []); return <main className="layered-tearable-site"><div ref={hostRef} className="layered-tearable-host" /><p className="sr-only">Interactive tearable profile. Click printed links and article cards, or drag across the sheet to reveal the next layer.</p></main>; }
