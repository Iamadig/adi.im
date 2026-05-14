import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SectionType } from '../types';
import {
  PAGE_H, PAGE_W, PASSIVE_LIFE, PassiveCloth, TearPhase, aliveFraction, beginGrab, commitGeometry, createCloth, createGeometry, createMouseState,
  createPaperMaterial, disposePassive, getClothDebugState, rebuildIndex, releaseTopEdge, resetCloth, releaseGrab, snapshotPassive, stepActive, stepPassive, tearProgress, moveGrab,
} from '../utils/tearableClothPhysics';
import {
  TEAR_TEXTURE_HEIGHT,
  TEAR_TEXTURE_WIDTH,
  TearableCanvasContent,
  TearableCanvasState,
  TearableHitRegion,
  TearableLayerRender,
  createTearableLayerRender,
  getNextTearSection,
  repaintTearableLayer,
} from '../utils/tearableCanvasLayers';
const DROP_TEAR_PROGRESS = 0.0065, DROP_ALIVE_FRACTION = 0.968, DROP_TEAR_WORK = 8.8, PRE_DROP_HOLD = 0.5, MAX_PASSIVE_LAYERS = 3, RELEASE_SETTLE_MAX = 3.1, RELEASE_SETTLE_MIN = 0.55, SETTLE_AVG_SPEED = 0.0016, SETTLE_MAX_SPEED = 0.01;
type TearDebugWindow = Window & { __tearState?: () => unknown };
interface LayeredTearableSiteProps { activeSection: SectionType; content: TearableCanvasContent; onRevealSection?: (section: SectionType) => void; }
const initialCanvasState: TearableCanvasState = { layout: 'landscape', focusedInput: null, signalInput: '', recInput: '', selectedThoughtId: null, pulledSignal: null, queuedRec: null };
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
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x11100d);
    const camera = new THREE.OrthographicCamera(-PAGE_W / 2, PAGE_W / 2, PAGE_H / 2, -PAGE_H / 2, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'layered-tearable-canvas';
    renderer.domElement.setAttribute('aria-label', 'Tearable profile canvas');
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.autocomplete = 'off';
    hiddenInput.spellcheck = false;
    hiddenInput.className = 'layered-tearable-hidden-input';
    hiddenInput.setAttribute('aria-label', 'Tearable sheet text entry');
    document.body.appendChild(hiddenInput);
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const mouse = createMouseState();
    const pointerStart = { x: 0, y: 0, moved: false };
    const uiState: TearableCanvasState = { ...initialCanvasState };
    const passives: PassiveCloth[] = [];
    const cloth = createCloth();
    const geometry = createGeometry(cloth);
    let currentSection = activeSectionRef.current;
    let activeRender = createRenderFor(currentSection);
    let backRender = createRenderFor(getNextTearSection(currentSection));
    let activeHitRegions = activeRender.hitRegions;
    let pointerRegion: TearableHitRegion | null = null;
    let hoveredRegion: TearableHitRegion | null = null;
    let tearArmed = false;
    let dropStarted = false;
    let dropStartedAt = 0, advanceCooldown = 0, settleStartedAt = 0, settleUntil = 0, tearWork = 0;
    let advancing = false;
    let phase: TearPhase = 'idle';
    let width = 1, height = 1, elapsed = 0, last = performance.now(), raf = 0;
    const material = createPaperMaterial(activeRender.texture);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const backGeometry = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 1, 1);
    const backMaterial = createPaperMaterial(backRender.texture);
    const backMesh = new THREE.Mesh(backGeometry, backMaterial);
    backMesh.position.z = -0.34;
    backMesh.receiveShadow = true;
    scene.add(backMesh);
    const ambient = new THREE.AmbientLight(0xffffff, 1.45);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
    keyLight.position.set(-1.8, 2.4, 5.4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -8;
    keyLight.shadow.bias = -0.0003;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xffe1b8, 0.75);
    rimLight.position.set(2.8, -1.4, 4.6);
    scene.add(rimLight);
    function createRenderFor(section: SectionType) {
      return createTearableLayerRender(section, getNextTearSection(section), contentRef.current, uiState);
    }
    function disposeRender(render: TearableLayerRender) {
      render.texture.dispose();
    }
    function repaintActiveSurfaces() {
      repaintTearableLayer(activeRender, currentSection, getNextTearSection(currentSection), contentRef.current, uiState);
      repaintTearableLayer(backRender, getNextTearSection(currentSection), getNextTearSection(getNextTearSection(currentSection)), contentRef.current, uiState);
      activeHitRegions = activeRender.hitRegions;
      material.map = activeRender.texture;
      backMaterial.map = backRender.texture;
      material.needsUpdate = true;
      backMaterial.needsUpdate = true;
    }
    if (import.meta.env.DEV) {
      (window as TearDebugWindow).__tearState = () => ({
        section: currentSection,
        nextSection: getNextTearSection(currentSection),
        phase,
        elapsed,
        dropStarted,
        settling: phase === 'torn' && elapsed < settleUntil,
        advanceCooldown,
        passives: passives.length,
        mouse: { x: mouse.x, y: mouse.y, px: mouse.px, py: mouse.py, down: mouse.down, active: mouse.active },
        focusedInput: uiState.focusedInput,
        selectedThoughtId: uiState.selectedThoughtId,
        inputs: { signal: uiState.signalInput, rec: uiState.recInput, pulledSignal: uiState.pulledSignal, queuedRec: uiState.queuedRec },
        tearWork,
        hitRegions: activeHitRegions.map(({ id, kind, action, inputKey, x, y, width, height }) => ({ id, kind, action, inputKey, x, y, width, height })),
        cloth: getClothDebugState(cloth),
      });
    }
	    function resize() {
	      const rect = host.getBoundingClientRect();
	      width = Math.max(1, rect.width);
	      height = Math.max(1, rect.height);
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
    function pointerToCanvas(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const clothHit = raycaster.intersectObject(mesh, false)[0];
      if (clothHit) hit.copy(clothHit.point);
      else raycaster.ray.intersectPlane(plane, hit);
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      mouse.x = hit.x;
      mouse.y = hit.y;
      mouse.active = true;
      if (clothHit?.uv) {
        return {
          x: clothHit.uv.x * TEAR_TEXTURE_WIDTH,
          y: (1 - clothHit.uv.y) * TEAR_TEXTURE_HEIGHT,
        };
      }
      return {
        x: (hit.x / PAGE_W + 0.5) * TEAR_TEXTURE_WIDTH,
        y: (0.5 - hit.y / PAGE_H) * TEAR_TEXTURE_HEIGHT,
      };
    }
    function findRegion(x: number, y: number) {
      if (x < 0 || y < 0 || x > TEAR_TEXTURE_WIDTH || y > TEAR_TEXTURE_HEIGHT) return null;
      for (let i = activeHitRegions.length - 1; i >= 0; i--) {
        const region = activeHitRegions[i];
        if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) {
          return region;
        }
      }
      return null;
    }
    function updateCursor(region: TearableHitRegion | null, tearing: boolean) {
      if (tearing) host.style.cursor = 'grabbing';
      else if (region?.kind === 'input') host.style.cursor = 'text';
      else if (region) host.style.cursor = 'pointer';
      else host.style.cursor = 'grab';
    }
    function setFocusedInput(inputKey: TearableCanvasState['focusedInput']) {
      uiState.focusedInput = inputKey;
      if (!inputKey) {
        hiddenInput.blur();
        repaintActiveSurfaces();
        return;
      }
      hiddenInput.value = inputKey === 'signal' ? uiState.signalInput : uiState.recInput;
      hiddenInput.focus({ preventScroll: true });
      hiddenInput.setSelectionRange(hiddenInput.value.length, hiddenInput.value.length);
      repaintActiveSurfaces();
    }
    function activateRegion(region: TearableHitRegion) {
      if (region.kind === 'link' && region.href) return void window.open(region.href, '_blank', 'noopener,noreferrer');
      if (region.kind === 'input' && region.inputKey) return void setFocusedInput(region.inputKey);
      if (region.kind === 'thought' && region.thoughtId) {
        uiState.selectedThoughtId = region.thoughtId;
        setFocusedInput(null);
        repaintActiveSurfaces();
        return;
      }
      if (region.action === 'back-thread') {
        uiState.selectedThoughtId = null;
        repaintActiveSurfaces();
        return;
      }
      if (region.action === 'pull-signal') {
        const quotes = contentRef.current.quotes;
        const index = quotes.length ? Math.abs(uiState.signalInput.length * 7 + currentSection.length) % quotes.length : -1;
        uiState.pulledSignal = index >= 0
          ? `${quotes[index].text} - ${quotes[index].author}`
          : 'Signal queued. Tear deeper for the next layer.';
        repaintActiveSurfaces();
        return;
      }
      if (region.action === 'queue-rec') {
        const value = uiState.recInput.trim();
        if (value) {
          uiState.queuedRec = value;
          uiState.recInput = '';
          hiddenInput.value = '';
          setFocusedInput(null);
        }
        repaintActiveSurfaces();
      }
    }
	    function clearInteractionState() {
	      const layout = uiState.layout;
	      Object.assign(uiState, initialCanvasState, { layout });
      hiddenInput.value = '';
      hiddenInput.blur();
      pointerRegion = null;
      hoveredRegion = null;
      tearArmed = false;
      dropStarted = false;
      dropStartedAt = 0;
      settleStartedAt = 0;
      settleUntil = 0;
      tearWork = 0;
      advanceCooldown = 0;
      mouse.down = false;
      mouse.active = false;
      releaseGrab(cloth);
    }
    function resetExperience() {
      passives.splice(0).forEach((passive) => disposePassive(passive, scene));
      disposeRender(activeRender);
      disposeRender(backRender);
      currentSection = SectionType.ABOUT;
      activeSectionRef.current = SectionType.ABOUT;
      activeRender = createRenderFor(currentSection);
      backRender = createRenderFor(getNextTearSection(currentSection));
      activeHitRegions = activeRender.hitRegions;
      resetCloth(cloth);
      rebuildIndex(geometry, cloth);
      commitGeometry(geometry, cloth);
      material.map = activeRender.texture;
      backMaterial.map = backRender.texture;
      material.needsUpdate = true;
      backMaterial.needsUpdate = true;
      phase = 'idle';
      clearInteractionState();
      onRevealRef.current?.(currentSection);
    }
    function advance() {
      if (advancing) return;
      advancing = true;
      const next = getNextTearSection(currentSection);
      phase = 'advancing';
      passives.push(snapshotPassive(cloth, activeRender.texture, scene, 0.42));
      while (passives.length > MAX_PASSIVE_LAYERS) {
        const oldest = passives.shift();
        if (oldest) disposePassive(oldest, scene);
      }
      activeRender = backRender;
      currentSection = next;
      backRender = createRenderFor(getNextTearSection(currentSection));
      activeHitRegions = activeRender.hitRegions;
      resetCloth(cloth);
      rebuildIndex(geometry, cloth);
      commitGeometry(geometry, cloth);
      material.map = activeRender.texture;
      backMaterial.map = backRender.texture;
      material.needsUpdate = true;
      backMaterial.needsUpdate = true;
      pointerRegion = null; tearArmed = false; mouse.down = false; mouse.active = false; releaseGrab(cloth);
      dropStarted = false;
      dropStartedAt = 0; settleStartedAt = 0; settleUntil = 0; tearWork = 0;
      advanceCooldown = 1.0;
      phase = 'idle';
      setFocusedInput(null);
      onRevealRef.current?.(currentSection);
      advancing = false;
    }
    function maybeStartDrop(dt: number) {
      advanceCooldown = Math.max(0, advanceCooldown - dt);
      if (advanceCooldown > 0 || mouse.down) return;
      const torn = tearProgress(cloth);
      const alive = aliveFraction(cloth);
      if (!dropStarted && (torn > DROP_TEAR_PROGRESS || alive < DROP_ALIVE_FRACTION || tearWork > DROP_TEAR_WORK)) {
        releaseGrab(cloth);
        mouse.down = false;
        releaseTopEdge(cloth);
        dropStarted = true;
        dropStartedAt = elapsed;
        phase = 'dropping';
      }
      if (dropStarted && elapsed - dropStartedAt > PRE_DROP_HOLD) {
        advance();
      }
    }
    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      event.preventDefault();
      try { renderer.domElement.setPointerCapture(event.pointerId); } catch {}
      const point = pointerToCanvas(event);
      pointerRegion = findRegion(point.x, point.y);
      pointerStart.x = event.clientX;
      pointerStart.y = event.clientY;
      pointerStart.moved = false;
      tearArmed = !pointerRegion;
      mouse.down = false;
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      updateCursor(pointerRegion, tearArmed);
    }
    function handlePointerMove(event: PointerEvent) {
      const point = pointerToCanvas(event);
      const region = findRegion(point.x, point.y);
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      const movedSq = dx * dx + dy * dy;
      if (mouse.down || pointerRegion || tearArmed) {
        if (movedSq > 64) pointerStart.moved = true;
        if (tearArmed && !mouse.down && movedSq > 64) {
          mouse.down = true;
          phase = 'dragging';
          mouse.px = mouse.x;
          mouse.py = mouse.y;
          beginGrab(cloth, mouse.x, mouse.y);
        }
        if (pointerRegion && movedSq > 900) {
          pointerRegion = null;
          tearArmed = false;
          setFocusedInput(null);
          mouse.down = true;
          phase = 'dragging';
          mouse.px = mouse.x;
          mouse.py = mouse.y;
          beginGrab(cloth, mouse.x, mouse.y);
        }
      }
      if (!mouse.down) {
        if (region !== hoveredRegion) hoveredRegion = region;
        updateCursor(region, false);
        return;
      }
      tearWork += Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
      moveGrab(cloth, mouse.x, mouse.y);
      updateCursor(null, true);
    }
    function handlePointerUp(event: PointerEvent) {
      const wasClick = !pointerStart.moved && pointerRegion && !dropStarted;
      if (mouse.down) {
        releaseGrab(cloth);
        settleStartedAt = elapsed;
        settleUntil = elapsed + RELEASE_SETTLE_MAX;
      }
      mouse.down = false;
      if (!dropStarted) phase = settleUntil > elapsed ? 'torn' : 'idle';
      try { renderer.domElement.releasePointerCapture(event.pointerId); } catch {}
      if (wasClick && pointerRegion) activateRegion(pointerRegion);
      pointerRegion = null;
      tearArmed = false;
      const point = pointerToCanvas(event);
      updateCursor(findRegion(point.x, point.y), false);
    }
    function handleInput() {
      if (uiState.focusedInput === 'signal') uiState.signalInput = hiddenInput.value.slice(0, 80);
      if (uiState.focusedInput === 'rec') uiState.recInput = hiddenInput.value.slice(0, 80);
      repaintActiveSurfaces();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (uiState.focusedInput === 'signal') activateRegion({ id: 'pull-signal', kind: 'button', action: 'pull-signal', x: 0, y: 0, width: 0, height: 0 });
      if (uiState.focusedInput === 'rec') activateRegion({ id: 'queue-rec', kind: 'button', action: 'queue-rec', x: 0, y: 0, width: 0, height: 0 });
    }
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || uiState.focusedInput) return;
      if (event.key.toLowerCase() !== 'r') return;
      event.preventDefault();
      resetExperience();
    }
    function tick(now: number) {
      if (disposed) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      elapsed += dt;
      if (activeSectionRef.current !== currentSection && !mouse.down && passives.length === 0) {
        currentSection = activeSectionRef.current;
        disposeRender(activeRender);
        disposeRender(backRender);
        activeRender = createRenderFor(currentSection);
        backRender = createRenderFor(getNextTearSection(currentSection));
        activeHitRegions = activeRender.hitRegions;
        material.map = activeRender.texture;
        backMaterial.map = backRender.texture;
        resetCloth(cloth);
        releaseGrab(cloth);
        rebuildIndex(geometry, cloth);
        phase = 'idle';
      }
      const settling = phase === 'torn' && elapsed < settleUntil, settleAge = settling ? elapsed - settleStartedAt : 0;
      const settleDamping = settling ? Math.max(0.925, 0.982 - Math.max(0, settleAge - 0.35) * 0.045) : undefined;
      if (mouse.down || dropStarted || settling) stepActive(cloth, undefined, settleDamping, settling ? 0.5 : 1);
      if (cloth.dirtyIndex) rebuildIndex(geometry, cloth);
      commitGeometry(geometry, cloth);
      maybeStartDrop(dt);
      if (settling && settleAge > RELEASE_SETTLE_MIN) {
        const { averageSpeed, maxSpeed } = getClothDebugState(cloth);
        if (averageSpeed < SETTLE_AVG_SPEED && maxSpeed < SETTLE_MAX_SPEED) settleUntil = elapsed;
      }
      if (phase === 'torn' && elapsed >= settleUntil && !dropStarted) phase = 'idle';
      for (let i = passives.length - 1; i >= 0; i--) {
        stepPassive(passives[i], dt);
        if (passives[i].age > PASSIVE_LIFE) {
          disposePassive(passives[i], scene);
          passives.splice(i, 1);
        }
      }
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
    hiddenInput.addEventListener('input', handleInput);
    hiddenInput.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleWindowKeyDown);
    hiddenInput.addEventListener('blur', () => {
      if (!disposed && uiState.focusedInput) {
        uiState.focusedInput = null;
        repaintActiveSurfaces();
      }
    });
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
      hiddenInput.removeEventListener('input', handleInput);
      hiddenInput.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleWindowKeyDown);
      if (import.meta.env.DEV) delete (window as TearDebugWindow).__tearState;
      passives.forEach((passive) => disposePassive(passive, scene));
      disposeRender(activeRender);
      disposeRender(backRender);
      geometry.dispose();
      backGeometry.dispose();
      material.dispose();
      backMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      hiddenInput.remove();
    };
  }, []);
	  return <main className="layered-tearable-site"><div ref={hostRef} className="layered-tearable-host" /><p className="sr-only">Interactive tearable profile. Click printed links and fields, or drag across the sheet to reveal the next layer.</p></main>;
	}
