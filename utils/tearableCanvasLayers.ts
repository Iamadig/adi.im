import * as THREE from 'three';
import { Quote, RecommendationSection, SectionType, Thought } from '../types';
import { compactLabel, drawGear, drawRaggedRect, drawSpiral, drawWrappedText, htmlToText, roundedRect, summarize, uniqueAnchors, withAlpha } from './tearableCanvasDrawing';
import { paintTearableMobileLayer } from './tearableMobileCanvasLayers';

export const TEAR_TEXTURE_WIDTH = 2048;
export const TEAR_TEXTURE_HEIGHT = 1152;

export type TearableInputKey = 'signal' | 'rec';
export type TearableHitKind = 'link' | 'input' | 'button' | 'thought';

export interface TearableCanvasContent {
  aboutHtml: string;
  thoughts: Thought[];
  quotes: Quote[];
  recommendations: RecommendationSection[];
  generatedAt: string | null;
}

export interface TearableCanvasState {
  layout: 'landscape' | 'portrait';
  focusedInput: TearableInputKey | null;
  signalInput: string;
  recInput: string;
  selectedThoughtId: string | null;
  pulledSignal: string | null;
  queuedRec: string | null;
}

export interface TearableHitRegion {
  id: string;
  kind: TearableHitKind;
  x: number;
  y: number;
  width: number;
  height: number;
  href?: string;
  inputKey?: TearableInputKey;
  thoughtId?: string;
  action?: 'pull-signal' | 'queue-rec' | 'back-thread';
}

export interface TearableLayerRender {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  hitRegions: TearableHitRegion[];
}

export const TEAR_LAYER_ORDER = [
  SectionType.ABOUT,
  SectionType.THOUGHTS,
  SectionType.QUOTES,
  SectionType.RECOMMENDATIONS,
];

const palettes: Record<SectionType, {
  bg: string;
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  accent3: string;
}> = {
  [SectionType.ABOUT]: {
    bg: '#dedbd2', paper: '#f2ead6', ink: '#14130f', muted: '#6a665c', accent: '#e88468', accent2: '#b8afd9', accent3: '#9fcbbf',
  },
  [SectionType.THOUGHTS]: {
    bg: '#d9dfcc', paper: '#f6ecd4', ink: '#11120e', muted: '#5a604f', accent: '#88a96c', accent2: '#5d92aa', accent3: '#e7a063',
  },
  [SectionType.QUOTES]: {
    bg: '#dbe7df', paper: '#f4ecd7', ink: '#12140f', muted: '#536255', accent: '#d4756c', accent2: '#7e9eb5', accent3: '#c7b36f',
  },
  [SectionType.RECOMMENDATIONS]: {
    bg: '#ead8ca', paper: '#fff1d6', ink: '#14110e', muted: '#6d5549', accent: '#ff8a72', accent2: '#9bb9aa', accent3: '#a799c9',
  },
};

const layerLabels: Record<SectionType, { title: [string, string]; subtitle: string; next: string }> = {
  [SectionType.ABOUT]: {
    title: ['hi! I am', 'Adi'],
    subtitle: 'AI products, agent infra, and fun internet experiments.',
    next: 'work',
  },
  [SectionType.THOUGHTS]: {
    title: ['THOUGHTS', ''],
    subtitle: 'Articles and notes from the notebook.',
    next: 'quotes',
  },
  [SectionType.QUOTES]: {
    title: ['QUOTES', ''],
    subtitle: '',
    next: 'recommendation',
  },
  [SectionType.RECOMMENDATIONS]: {
    title: ['RECOMMENDATION', ''],
    subtitle: 'Books, tools, and references I recommend.',
    next: 'profile',
  },
};

export function getNextTearSection(section: SectionType): SectionType {
  const index = TEAR_LAYER_ORDER.indexOf(section);
  return TEAR_LAYER_ORDER[(index + 1) % TEAR_LAYER_ORDER.length];
}

export function createTearableLayerRender(
  section: SectionType,
  nextSection: SectionType,
  content: TearableCanvasContent,
  state: TearableCanvasState,
): TearableLayerRender {
  const canvas = document.createElement('canvas');
  canvas.width = TEAR_TEXTURE_WIDTH;
  canvas.height = TEAR_TEXTURE_HEIGHT;
  const hitRegions = paintTearableLayer(canvas, section, nextSection, content, state);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { canvas, texture, hitRegions };
}

export function repaintTearableLayer(
  render: TearableLayerRender,
  section: SectionType,
  nextSection: SectionType,
  content: TearableCanvasContent,
  state: TearableCanvasState,
) {
  render.hitRegions = paintTearableLayer(render.canvas, section, nextSection, content, state);
  render.texture.needsUpdate = true;
}

function paintTearableLayer(
  canvas: HTMLCanvasElement,
  section: SectionType,
  nextSection: SectionType,
  content: TearableCanvasContent,
  state: TearableCanvasState,
) {
  const g = canvas.getContext('2d');
  if (!g) return [];
  const regions: TearableHitRegion[] = [];
  const p = palettes[section];
  g.clearRect(0, 0, canvas.width, canvas.height);
  if (state.layout === 'portrait') {
    return paintTearableMobileLayer(canvas, section, content, state);
  }
  drawBase(g, p, section);
  drawHeader(g, p, section);

  if (section === SectionType.ABOUT) renderProfile(g, p, content, regions);
  if (section === SectionType.THOUGHTS) renderThreads(g, p, content, state, regions);
  if (section === SectionType.QUOTES) renderQuotes(g, p, content);
  if (section === SectionType.RECOMMENDATIONS) renderRecs(g, p, content, state, regions);

  drawTearInstructions(g, p);
  return regions;
}

function drawBase(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], section: SectionType) {
  const w = TEAR_TEXTURE_WIDTH;
  const h = TEAR_TEXTURE_HEIGHT;
  g.fillStyle = p.bg;
  g.fillRect(0, 0, w, h);

  const wash = g.createRadialGradient(w * 0.44, h * 0.4, 120, w * 0.5, h * 0.5, w * 0.8);
  wash.addColorStop(0, 'rgba(255,255,255,0.34)');
  wash.addColorStop(0.55, 'rgba(255,248,224,0.2)');
  wash.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = wash;
  g.fillRect(0, 0, w, h);

  drawRaggedRect(g, -110, 260, 760, 220, p.accent, -12, 0.78);
  drawRaggedRect(g, 1170, 150, 620, 520, p.accent2, 14, 0.62);
  drawRaggedRect(g, 1160, 710, 470, 340, p.accent, -5, 0.58);
  drawRaggedRect(g, 420, 780, 350, 210, p.accent3, -8, 0.38);
  drawGear(g, 1710, 260, 130, p.accent2, 0.78);
  drawSpiral(g, 450, 260, 110, p.ink, 0.64);
  if (section === SectionType.RECOMMENDATIONS) drawGear(g, 360, 900, 90, p.accent3, 0.62);

  g.save();
  g.strokeStyle = 'rgba(20,18,14,0.085)';
  g.lineWidth = 1.5;
  for (let y = 88; y < h - 40; y += 42) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y + Math.sin(y * 0.03) * 5);
    g.stroke();
  }
  g.restore();

  g.save();
  g.globalAlpha = 0.18;
  g.fillStyle = p.paper;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  g.restore();
}

function drawHeader(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], section: SectionType) {
  const meta = layerLabels[section];
  const isLongRecommendationTitle = section === SectionType.RECOMMENDATIONS;
  const titleSize = isLongRecommendationTitle ? 124 : 150;
  const titleX = isLongRecommendationTitle ? 150 : 185;
  g.save();
  g.font = `400 ${titleSize}px "Special Gothic Expanded One", sans-serif`;
  g.lineJoin = 'round';
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(255,248,232,0.75)';
  g.fillStyle = withAlpha(p.ink, 0.9);
  g.strokeText(meta.title[0], titleX, 330);
  g.fillText(meta.title[0], titleX, 330);
  if (meta.title[1]) {
    g.strokeText(meta.title[1], titleX, 486);
    g.fillText(meta.title[1], titleX, 486);
  }

  g.font = '800 42px "Bricolage Grotesque", sans-serif';
  g.fillStyle = withAlpha(p.ink, 0.58);
  if (meta.subtitle) drawWrappedText(g, meta.subtitle, 1265, 410, 600, 50, 2);

  g.restore();
}

function renderProfile(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], content: TearableCanvasContent, regions: TearableHitRegion[]) {
  const links = uniqueAnchors(content.aboutHtml).slice(0, 10);
  const intro = 'I’m Adi. I build AI products, agent infrastructure, and fun little internet experiments.';
  const profileSummary = 'Currently building Watercooler. Previously founded Koan Analytics and worked on product ops at DiDi.';
  card(g, 190, 650, 810, 350, p, 'PROFILE');
  g.font = '800 36px "Bricolage Grotesque", sans-serif';
  g.fillStyle = p.ink;
  drawWrappedText(g, intro, 230, 735, 700, 42, 2);
  g.font = '700 27px "Bricolage Grotesque", sans-serif';
  g.fillStyle = withAlpha(p.ink, 0.72);
  drawWrappedText(g, profileSummary, 230, 830, 700, 38, 4);

  card(g, 1080, 650, 760, 350, p, 'PLACES TO GO');
  let x = 1120;
  let y = 730;
  for (const link of links) {
    const label = compactLabel(link.label);
    const width = Math.min(290, 56 + label.length * 14);
    drawLinkPill(g, x, y, width, label, p);
    regions.push({ id: `profile-link-${regions.length}`, kind: 'link', x, y, width, height: 54, href: link.href });
    x += width + 14;
    if (x > 1690) { x = 1120; y += 72; }
  }
}

function renderThreads(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], content: TearableCanvasContent, state: TearableCanvasState, regions: TearableHitRegion[]) {
  const selected = content.thoughts.find((thought) => thought.id === state.selectedThoughtId) ?? null;
  if (selected) {
    card(g, 190, 650, 1290, 350, p, 'THOUGHT');
    regions.push({ id: 'thread-back', kind: 'button', action: 'back-thread', x: 1500, y: 670, width: 230, height: 62 });
    drawButton(g, 1500, 670, 230, 'BACK TO THOUGHTS', p);
    g.font = '800 46px "Bricolage Grotesque", sans-serif';
    g.fillStyle = p.ink;
    drawWrappedText(g, selected.title, 230, 750, 840, 54, 2);
    g.font = '700 25px "Bricolage Grotesque", sans-serif';
    g.fillStyle = withAlpha(p.ink, 0.72);
    drawWrappedText(g, htmlToText(selected.content), 230, 860, 1170, 35, 5);
    return;
  }

  card(g, 190, 640, 1640, 390, p, 'ARTICLE INDEX');
  content.thoughts.slice(0, 4).forEach((thought, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 230 + col * 790;
    const y = 710 + row * 150;
    g.fillStyle = index % 2 === 0 ? withAlpha(p.accent3, 0.25) : withAlpha(p.accent2, 0.22);
    roundedRect(g, x, y, 720, 120, 22, true, false);
    g.strokeStyle = withAlpha(p.ink, 0.16);
    g.lineWidth = 3;
    roundedRect(g, x, y, 720, 120, 22, false, true);
    g.font = '800 29px "Bricolage Grotesque", sans-serif';
    g.fillStyle = p.ink;
    drawWrappedText(g, thought.title, x + 28, y + 42, 560, 34, 1);
    g.font = '700 18px "Azeret Mono", monospace';
    g.fillStyle = withAlpha(p.ink, 0.52);
    g.fillText(thought.date || 'thread', x + 28, y + 92);
    regions.push({ id: `thought-${thought.id}`, kind: 'thought', thoughtId: thought.id, x, y, width: 720, height: 120 });
  });
}

function renderQuotes(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], content: TearableCanvasContent) {
  const quotes = content.quotes.filter((quote) => quote.text.trim());
  if (!quotes.length) {
    g.font = '800 40px "Bricolage Grotesque", sans-serif';
    g.fillStyle = withAlpha(p.ink, 0.72);
    drawWrappedText(g, 'No quotes yet.', 190, 690, 900, 48, 2);
    return;
  }

  const spread = { x: 170, y: 500, w: 1710, h: 520 };
  const count = quotes.length;
  const cols = count <= 3 ? count : count <= 6 ? 3 : count <= 12 ? 4 : 5;
  const rows = Math.ceil(count / cols);
  const cellW = spread.w / cols;
  const cellH = spread.h / rows;
  const rotations = [-5, 3, -2, 4, -4, 2, -3, 5, -1, 3];
  const marks = [p.accent, p.accent2, p.accent3, '#f1d48a'];

  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalAlpha = 0.9;
  for (let i = 0; i < Math.min(10, count + 2); i++) {
    const y = spread.y + 44 + i * 43;
    g.strokeStyle = withAlpha(i % 2 ? p.ink : p.accent2, 0.08);
    g.lineWidth = i % 3 === 0 ? 5 : 2;
    g.beginPath();
    g.moveTo(spread.x + 30 + Math.sin(i) * 18, y);
    g.bezierCurveTo(spread.x + 470, y - 18, spread.x + 980, y + 22, spread.x + spread.w - 60, y - 5);
    g.stroke();
  }
  g.restore();

  quotes.forEach((quote, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const jitterX = [-22, 18, -10, 24, -18, 12, 20, -16, 10, -24][index % 10];
    const jitterY = [8, -16, 18, -6, 16, -12, 4, 20, -18, 10][index % 10];
    const quoteLengthPenalty = Math.max(0, quote.text.length - 90) * 0.035;
    const fontSize = Math.max(17, Math.min(42, 45 - count * 1.45 - quoteLengthPenalty));
    const lineHeight = fontSize * 1.1;
    const maxWidth = Math.max(245, cellW * 0.78);
    const maxLines = Math.max(2, Math.min(8, Math.floor((cellH - 56) / lineHeight)));
    const x = spread.x + col * cellW + cellW * 0.11 + jitterX;
    const y = spread.y + row * cellH + cellH * 0.28 + jitterY;
    const rotation = rotations[index % rotations.length] * Math.min(1, Math.max(0.38, cellW / 520));
    const mark = marks[index % marks.length];

    g.save();
    g.translate(x, y);
    g.rotate((rotation * Math.PI) / 180);

    drawRaggedRect(g, -26, -fontSize * 0.95, maxWidth + 70, Math.max(92, lineHeight * Math.min(maxLines, 4.2)), mark, 0, 0.2);

    g.strokeStyle = withAlpha(p.ink, 0.38);
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(-22, -18, 34, 22, -0.2, 0, Math.PI * 2);
    g.stroke();

    g.font = '800 18px "Azeret Mono", monospace';
    g.fillStyle = withAlpha(p.ink, 0.58);
    g.fillText(String(index + 1).padStart(2, '0'), -38, -12);

    g.font = `800 ${fontSize}px "Bricolage Grotesque", sans-serif`;
    g.fillStyle = withAlpha(p.ink, 0.9);
    const bottom = drawWrappedText(g, `“${quote.text}”`, 18, 0, maxWidth, lineHeight, maxLines);

    g.strokeStyle = withAlpha(mark, 0.72);
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(18, bottom + 10);
    g.lineTo(Math.min(maxWidth * 0.76, 360), bottom + 4 + Math.sin(index) * 6);
    g.stroke();

    if (quote.author && quote.author.toLowerCase() !== 'unknown') {
      g.font = '700 18px "Azeret Mono", monospace';
      g.fillStyle = withAlpha(p.ink, 0.56);
      g.fillText('- ' + quote.author, 18, bottom + 38);
    }
    g.restore();
  });
}

function renderRecs(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], content: TearableCanvasContent, _state: TearableCanvasState, regions: TearableHitRegion[]) {
  const sections = content.recommendations.filter((section) => section.items.length).slice(0, 4);
  card(g, 190, 640, 1650, 390, p, '');

  if (!sections.length) {
    g.font = '800 34px "Bricolage Grotesque", sans-serif';
    g.fillStyle = withAlpha(p.ink, 0.72);
    drawWrappedText(g, 'No recommendations yet.', 235, 735, 820, 42, 2);
    return;
  }

  const colWidth = Math.floor(1540 / sections.length);
  sections.forEach((section, sectionIndex) => {
    const x = 235 + sectionIndex * colWidth;
    const textWidth = Math.max(260, colWidth - 44);
    g.font = '800 31px "Bricolage Grotesque", sans-serif';
    g.fillStyle = p.ink;
    drawWrappedText(g, section.title, x, 725, textWidth, 34, 1);
    section.items.slice(0, 5).forEach((item, itemIndex) => {
      const itemY = 775 + itemIndex * 50;
      const anchor = uniqueAnchors(item.html)[0];
      const label = summarize(htmlToText(item.html), Math.max(36, Math.floor(textWidth / 8)));
      g.font = '700 23px "Bricolage Grotesque", sans-serif';
      g.fillStyle = anchor ? p.ink : withAlpha(p.ink, 0.74);
      drawWrappedText(g, label, x, itemY, textWidth, 27, 1);
      if (anchor) regions.push({ id: `rec-link-${section.id}-${itemIndex}`, kind: 'link', href: anchor.href, x, y: itemY - 26, width: textWidth, height: 42 });
    });
  });
}

function drawTearInstructions(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT]) {
  g.save();
  g.font = '800 33px "Bricolage Grotesque", sans-serif';
  g.fillStyle = withAlpha(p.ink, 0.62);
  g.fillText('Tear the page to navigate. Press R to reset.', 185, 1100);
  g.restore();
}

function card(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: typeof palettes[SectionType.ABOUT], label: string) {
  g.save();
  g.shadowColor = 'rgba(20,18,14,0.20)';
  g.shadowBlur = 30;
  g.shadowOffsetY = 12;
  g.fillStyle = 'rgba(255,249,232,0.82)';
  roundedRect(g, x, y, w, h, 26, true, false);
  g.shadowColor = 'transparent';
  g.strokeStyle = withAlpha(p.ink, 0.28);
  g.lineWidth = 4;
  roundedRect(g, x, y, w, h, 26, false, true);
  if (label) {
    g.font = '800 20px "Azeret Mono", monospace';
    g.fillStyle = withAlpha(p.ink, 0.56);
    g.fillText(label, x + 38, y + 48);
  }
  g.restore();
}

function drawInput(g: CanvasRenderingContext2D, x: number, y: number, w: number, text: string, focused: boolean, p: typeof palettes[SectionType.ABOUT]) {
  g.save();
  g.fillStyle = focused ? 'rgba(255,255,255,0.92)' : 'rgba(255,248,232,0.68)';
  roundedRect(g, x, y, w, 78, 24, true, false);
  g.strokeStyle = focused ? p.accent : withAlpha(p.ink, 0.28);
  g.lineWidth = focused ? 6 : 4;
  roundedRect(g, x, y, w, 78, 24, false, true);
  g.font = '800 30px "Bricolage Grotesque", sans-serif';
  g.fillStyle = text.includes('...') ? withAlpha(p.ink, 0.42) : p.ink;
  g.fillText(text.slice(0, 28), x + 28, y + 50);
  g.restore();
}

function drawButton(g: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, p: typeof palettes[SectionType.ABOUT]) {
  g.save();
  g.fillStyle = p.ink;
  roundedRect(g, x, y, w, 62, 999, true, false);
  g.fillStyle = '#fff6dd';
  g.font = '900 21px "Azeret Mono", monospace';
  g.fillText(label, x + 30, y + 40);
  g.restore();
}

function drawLinkPill(g: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, p: typeof palettes[SectionType.ABOUT]) {
  g.fillStyle = 'rgba(255,255,255,0.64)';
  roundedRect(g, x, y, w, 54, 999, true, false);
  g.strokeStyle = p.accent;
  g.lineWidth = 4;
  roundedRect(g, x, y, w, 54, 999, false, true);
  g.font = '800 20px "Bricolage Grotesque", sans-serif';
  g.fillStyle = p.ink;
  g.fillText(label, x + 22, y + 35);
}
