import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SectionType } from '../types';
import {
  PAGE_H,
  PAGE_W,
  PASSIVE_LIFE,
  PassiveCloth,
  aliveFraction,
  commitGeometry,
  createCloth,
  createGeometry,
  createMouseState,
  createPaperMaterial,
  disposePassive,
  rebuildIndex,
  releaseTopEdge,
  resetCloth,
  snapshotPassive,
  stepActive,
  stepPassive,
  tearProgress,
} from '../utils/tearableClothPhysics';
import { getNextProfileSection, PROFILE_TEAR_LAYERS } from '../utils/tearableProfileLayers';
import { createLayerTexture } from '../utils/tearableProfileTexture';

const DROP_TEAR_PROGRESS = 0.006;
const DROP_ALIVE_FRACTION = 0.68;
const PRE_DROP_HOLD = 0.22;
const MAX_PASSIVE_LAYERS = 1;
const RESTING_SKIN_OPACITY = 0;
const TEARING_SKIN_OPACITY = 0.82;
const RESTING_UNDER_SKIN_OPACITY = 0;
const TEARING_UNDER_SKIN_OPACITY = 0.22;

interface TearableProfileCanvasProps {
  activeSection: SectionType;
  onRevealSection: (section: SectionType) => void;
}

export function TearableProfileCanvas({ activeSection, onRevealSection }: TearableProfileCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onRevealRef = useRef(onRevealSection);
  const activeSectionRef = useRef(activeSection);

  useEffect(() => {
    onRevealRef.current = onRevealSection;
  }, [onRevealSection]);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    if (!hostRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let disposed = false;
    const host = hostRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'tearable-physics-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.opacity = '0';
    host.appendChild(renderer.domElement);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    const mouse = createMouseState();
    const pointerStart = { x: 0, y: 0, moved: false };
    const cloth = createCloth();
    const geometry = createGeometry(cloth);
    let currentSection = activeSectionRef.current;
    let frontTexture = createLayerTexture(PROFILE_TEAR_LAYERS[currentSection], PROFILE_TEAR_LAYERS[getNextProfileSection(currentSection)]);
    let backTexture = createLayerTexture(PROFILE_TEAR_LAYERS[getNextProfileSection(currentSection)], PROFILE_TEAR_LAYERS[getNextProfileSection(getNextProfileSection(currentSection))]);
    const material = createPaperMaterial(frontTexture);
    material.transparent = true;
    material.opacity = RESTING_SKIN_OPACITY;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const backGeometry = new THREE.PlaneGeometry(PAGE_W * 1.05, PAGE_H * 1.05);
    const backMaterial = createPaperMaterial(backTexture);
    backMaterial.transparent = true;
    backMaterial.opacity = RESTING_UNDER_SKIN_OPACITY;
    const backMesh = new THREE.Mesh(backGeometry, backMaterial);
    backMesh.position.z = -0.42;
    backMesh.receiveShadow = true;
    scene.add(backMesh);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
    keyLight.position.set(-2.4, 3.2, 5.6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -8;
    keyLight.shadow.bias = -0.0002;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xfff1d0, 0.65);
    rimLight.position.set(2.5, -1.5, 4);
    scene.add(rimLight);

    const passives: PassiveCloth[] = [];
    let width = 1;
    let height = 1;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    let advanceCooldown = 0;
    let advancing = false;
    let dropStarted = false;
    let dropStartedAt = 0;
    let tearVisualUntil = 0;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const fov = THREE.MathUtils.degToRad(35);
      const padding = 1.08;
      const fitH = (PAGE_H * padding * 0.5) / Math.tan(fov / 2);
      const fitW = (PAGE_W * padding * 0.5) / (Math.tan(fov / 2) * camera.aspect);
      camera.position.set(0, 0, Math.max(fitH, fitW));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };

    const syncPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      raycaster.ray.intersectPlane(plane, hit);
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      mouse.x = hit.x;
      mouse.y = hit.y;
      mouse.active = true;
    };

    const getElementBelowPaper = (clientX: number, clientY: number) => {
      const previousPointerEvents = host.style.pointerEvents;
      host.style.pointerEvents = 'none';
      const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      host.style.pointerEvents = previousPointerEvents;
      return target;
    };

    const forwardClickBelowPaper = (event: PointerEvent) => {
      const target = getElementBelowPaper(event.clientX, event.clientY);
      if (!target) return;
      const interactive = target.closest(
        'a, button, input, textarea, select, label, [contenteditable="true"], [role="button"], [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement | null;
      const receiver = interactive ?? target;
      if (receiver === document.body || receiver === document.documentElement) return;
      if (typeof receiver.focus === 'function') {
        receiver.focus({ preventScroll: true });
      }
      const anchor = receiver.closest('a[href]') as HTMLAnchorElement | null;
      if (anchor?.href) {
        if (anchor.target === '_blank') {
          window.open(anchor.href, '_blank', 'noopener,noreferrer') ?? window.location.assign(anchor.href);
        } else {
          window.location.assign(anchor.href);
        }
        return;
      }
      receiver.click();
    };

    const findScrollParent = (target: HTMLElement | null): HTMLElement | null => {
      let node: HTMLElement | null = target;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const canScrollY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
        if (canScrollY) return node;
        node = node.parentElement;
      }
      return null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      try { renderer.domElement.setPointerCapture(event.pointerId); } catch {}
      pointerStart.x = event.clientX;
      pointerStart.y = event.clientY;
      pointerStart.moved = false;
      syncPointer(event);
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      mouse.down = true;
    };
    const handlePointerMove = (event: PointerEvent) => {
      const shouldCut = mouse.down;
      if (shouldCut) {
        const dx = event.clientX - pointerStart.x;
        const dy = event.clientY - pointerStart.y;
        if (dx * dx + dy * dy > 64) {
          pointerStart.moved = true;
        }
      }
      syncPointer(event);
      if (shouldCut) {
        tearVisualUntil = Math.max(tearVisualUntil, elapsed + 0.9);
      }
    };
    const handlePointerUp = (event: PointerEvent) => {
      const wasClick = mouse.down && !pointerStart.moved && !dropStarted;
      mouse.down = false;
      try { renderer.domElement.releasePointerCapture(event.pointerId); } catch {}
      if (wasClick) {
        forwardClickBelowPaper(event);
      }
    };
    const handleWheel = (event: WheelEvent) => {
      if (mouse.down) return;
      const target = getElementBelowPaper(event.clientX, event.clientY);
      const scrollParent = findScrollParent(target)
        ?? host.closest('.tearable-sheet-wrap')?.querySelector<HTMLElement>('.tearable-sheet-body')
        ?? null;
      if (!scrollParent) return;
      event.preventDefault();
      scrollParent.scrollBy({ left: event.deltaX, top: event.deltaY, behavior: 'auto' });
    };

    const resetToSection = (section: SectionType) => {
      currentSection = section;
      resetCloth(cloth);
      frontTexture.dispose();
      backTexture.dispose();
      frontTexture = createLayerTexture(PROFILE_TEAR_LAYERS[section], PROFILE_TEAR_LAYERS[getNextProfileSection(section)]);
      backTexture = createLayerTexture(PROFILE_TEAR_LAYERS[getNextProfileSection(section)], PROFILE_TEAR_LAYERS[getNextProfileSection(getNextProfileSection(section))]);
      material.map = frontTexture;
      material.needsUpdate = true;
      backMaterial.map = backTexture;
      backMaterial.needsUpdate = true;
      rebuildIndex(geometry, cloth);
      commitGeometry(geometry, cloth);
      advanceCooldown = 0;
      dropStarted = false;
      dropStartedAt = 0;
    };

    const advance = () => {
      if (advancing) return;
      advancing = true;
      const next = getNextProfileSection(currentSection);
      passives.push(snapshotPassive(cloth, frontTexture, scene, 0.012));
      while (passives.length > MAX_PASSIVE_LAYERS) {
        const oldest = passives.shift();
        if (oldest) disposePassive(oldest, scene);
      }
      frontTexture = backTexture;
      backTexture = createLayerTexture(PROFILE_TEAR_LAYERS[getNextProfileSection(next)], PROFILE_TEAR_LAYERS[getNextProfileSection(getNextProfileSection(next))]);
      currentSection = next;
      resetCloth(cloth);
      rebuildIndex(geometry, cloth);
      material.map = frontTexture;
      material.needsUpdate = true;
      backMaterial.map = backTexture;
      backMaterial.needsUpdate = true;
      commitGeometry(geometry, cloth);
      mouse.down = false;
      mouse.active = false;
      dropStarted = false;
      dropStartedAt = 0;
      advanceCooldown = 1.0;
      onRevealRef.current(next);
      advancing = false;
    };

    const progress = (dt: number, allowDrop: boolean) => {
      elapsed += dt;
      advanceCooldown = Math.max(0, advanceCooldown - dt);
      if (!allowDrop) return;
      const alive = aliveFraction(cloth);
      const torn = tearProgress(cloth);
      if (!dropStarted && advanceCooldown <= 0 && (torn > DROP_TEAR_PROGRESS || alive < DROP_ALIVE_FRACTION)) {
        releaseTopEdge(cloth);
        dropStarted = true;
        dropStartedAt = elapsed;
        tearVisualUntil = Math.max(tearVisualUntil, elapsed + 1.2);
      }
      if (dropStarted && elapsed - dropStartedAt > PRE_DROP_HOLD) {
        advance();
      }
    };

    const updateSkinOpacity = () => {
      const isActivelyTearing = mouse.down || dropStarted || elapsed < tearVisualUntil;
      const frontTarget = isActivelyTearing ? TEARING_SKIN_OPACITY : RESTING_SKIN_OPACITY;
      const backTarget = isActivelyTearing ? TEARING_UNDER_SKIN_OPACITY : RESTING_UNDER_SKIN_OPACITY;
      material.opacity += (frontTarget - material.opacity) * 0.22;
      backMaterial.opacity += (backTarget - backMaterial.opacity) * 0.22;
      const canvasVisible = isActivelyTearing || passives.length > 0;
      host.classList.toggle('is-tearing', canvasVisible);
      renderer.domElement.style.opacity = canvasVisible ? '1' : '0';
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (activeSectionRef.current !== currentSection && !mouse.down && passives.length === 0) {
        resetToSection(activeSectionRef.current);
      }
      const activePhysics = mouse.down || dropStarted || elapsed < tearVisualUntil;
      if (activePhysics) {
        stepActive(cloth, mouse);
      }
      if (cloth.dirtyIndex) rebuildIndex(geometry, cloth);
      commitGeometry(geometry, cloth);
      progress(dt, activePhysics);
      updateSkinOpacity();
      for (let i = passives.length - 1; i >= 0; i--) {
        stepPassive(passives[i], dt);
        if (passives[i].age > PASSIVE_LIFE) {
          disposePassive(passives[i], scene);
          passives.splice(i, 1);
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
    resize();
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      passives.forEach((passive) => disposePassive(passive, scene));
      geometry.dispose();
      backGeometry.dispose();
      material.dispose();
      backMaterial.dispose();
      frontTexture.dispose();
      backTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="tearable-physics-stage" />;
}

export default TearableProfileCanvas;
