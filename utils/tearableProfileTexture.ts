import * as THREE from 'three';
import { TearableProfileLayer } from './tearableProfileLayers';

export function createLayerTexture(layer: TearableProfileLayer, nextLayer: TearableProfileLayer) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1152;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas 2D context unavailable');
  paintLayer(g, canvas.width, canvas.height, layer, nextLayer);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function paintLayer(g: CanvasRenderingContext2D, width: number, height: number, layer: TearableProfileLayer, nextLayer: TearableProfileLayer) {
  const p = layer.palette;
  g.clearRect(0, 0, width, height);
  g.fillStyle = withAlpha(p.bg, 0.92);
  g.fillRect(0, 0, width, height);

  const warmWash = g.createLinearGradient(0, 0, width, height);
  warmWash.addColorStop(0, 'rgba(255,255,255,0.28)');
  warmWash.addColorStop(0.46, withAlpha(p.paper, 0.14));
  warmWash.addColorStop(1, withAlpha(nextLayer.palette.bg, 0.16));
  g.fillStyle = warmWash;
  g.fillRect(0, 0, width, height);

  const vignette = g.createRadialGradient(width * 0.5, height * 0.48, 160, width * 0.5, height * 0.5, width * 0.78);
  vignette.addColorStop(0, 'rgba(255,255,255,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.13)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, width, height);

  drawFibers(g, width, height, withAlpha(p.ink, 0.045));

  g.strokeStyle = 'rgba(17,17,15,0.105)';
  g.lineWidth = 1.5;
  for (let y = 120; y < height; y += 80) {
    g.beginPath();
    g.moveTo(120, y);
    g.lineTo(width - 120, y + Math.sin(y * 0.02) * 7);
    g.stroke();
  }
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawFibers(g: CanvasRenderingContext2D, width: number, height: number, color: string) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 1;
  for (let i = 0; i < 180; i++) {
    const seed = i * 19.917;
    const x = (Math.sin(seed) * 0.5 + 0.5) * width;
    const y = (Math.cos(seed * 1.41) * 0.5 + 0.5) * height;
    const length = 20 + (Math.sin(seed * 0.73) * 0.5 + 0.5) * 64;
    const angle = -0.22 + Math.sin(seed * 0.31) * 0.44;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    g.stroke();
  }
  g.restore();
}
