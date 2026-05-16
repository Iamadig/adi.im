import * as THREE from 'three';
import { ClothData, PAGE_H, PAGE_W, createCloth } from './tearableClothCore';
import { createGeometry, createPaperMaterial } from './tearableClothPhysics';
import { TearableLayerRender } from './tearableCanvasLayers';

export interface TearableActiveSheet {
  cloth: ClothData;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  mesh: THREE.Mesh;
}

export interface TearableThreeStage {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  raycaster: THREE.Raycaster;
  ndc: THREE.Vector2;
  hit: THREE.Vector3;
  plane: THREE.Plane;
  backGeometry: THREE.PlaneGeometry;
  backMaterial: THREE.MeshStandardMaterial;
  backMesh: THREE.Mesh;
  activeSheet: TearableActiveSheet;
  createActiveSheet: (render: TearableLayerRender) => TearableActiveSheet;
  disposeBase: () => void;
}

export function createTearableThreeStage(
  host: HTMLElement,
  activeRender: TearableLayerRender,
  backRender: TearableLayerRender,
): TearableThreeStage {
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

  const backGeometry = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 1, 1);
  const backMaterial = createPaperMaterial(backRender.texture);
  const backMesh = new THREE.Mesh(backGeometry, backMaterial);
  backMesh.position.z = -0.34;
  backMesh.receiveShadow = true;
  backMesh.visible = false;
  scene.add(backMesh);

  scene.add(new THREE.AmbientLight(0xffffff, 1.45));

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

  const createActiveSheet = (render: TearableLayerRender) => {
    const cloth = createCloth();
    const geometry = createGeometry(cloth);
    const material = createPaperMaterial(render.texture);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return { cloth, geometry, material, mesh };
  };

  return {
    scene,
    camera,
    renderer,
    raycaster: new THREE.Raycaster(),
    ndc: new THREE.Vector2(),
    hit: new THREE.Vector3(),
    plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    backGeometry,
    backMaterial,
    backMesh,
    activeSheet: createActiveSheet(activeRender),
    createActiveSheet,
    disposeBase: () => {
      backGeometry.dispose();
      backMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
