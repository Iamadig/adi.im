import * as THREE from 'three';
import { CanvasCopyItem, ProfileLink, Quote, RecommendationSection, SectionType, Thought } from '../types';
import { getCanvasText } from './canvasCms';
import { compactLabel, drawGear, drawRaggedRect, drawSpiral, drawWrappedText, htmlToText, roundedRect, summarize, uniqueAnchors, withAlpha } from './tearableCanvasDrawing';
import { paintTearableMobileLayer } from './tearableMobileCanvasLayers';
import { TEARABLE_PALETTES, TearablePalette } from './tearablePalettes';
import { TearableTextureUpload, createTearableTextureUpload, syncTearableTextureUpload } from './tearableTextureUpload';

export const TEAR_TEXTURE_WIDTH = 2048;
export const TEAR_TEXTURE_HEIGHT = 1152;

export type TearableHitKind = 'link';

export interface TearableCanvasContent {
  canvasCopy: CanvasCopyItem[];
  profileLinks: ProfileLink[];
  aboutHtml: string;
  thoughts: Thought[];
  quotes: Quote[];
  recommendations: RecommendationSection[];
  generatedAt: string | null;
}

export interface TearableCanvasState {
  layout: 'landscape' | 'portrait';
}

export interface TearableHitRegion {
  id: string;
  kind: TearableHitKind;
  x: number;
  y: number;
  width: number;
  height: number;
  href?: string;
}

export interface TearableLayerRender {
  canvas: HTMLCanvasElement;
  texture: THREE.DataTexture;
  textureUpload: TearableTextureUpload;
  hitRegions: TearableHitRegion[];
}

export const TEAR_LAYER_ORDER = [
  SectionType.ABOUT,
  SectionType.THOUGHTS,
  SectionType.QUOTES,
  SectionType.RECOMMENDATIONS,
];

const layerLabels: Record<SectionType, { title: [string, string]; subtitle: string }> = {
  [SectionType.ABOUT]: {
    title: ['hi! I am', 'Adi'],
    subtitle: 'AI products, agent infra, and fun internet experiments.',
  },
  [SectionType.THOUGHTS]: {
    title: ['THOUGHTS', ''],
    subtitle: 'Articles and notes from the notebook.',
  },
  [SectionType.QUOTES]: {
    title: ['QUOTES', ''],
    subtitle: '',
  },
  [SectionType.RECOMMENDATIONS]: {
    title: ['RECOMMENDATION', ''],
    subtitle: 'Books, tools, and references I recommend.',
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
  const textureUpload = createTearableTextureUpload(canvas);
  return { canvas, texture: textureUpload.texture, textureUpload, hitRegions };
}

export function repaintTearableLayer(
  render: TearableLayerRender,
  section: SectionType,
  nextSection: SectionType,
  content: TearableCanvasContent,
  state: TearableCanvasState,
) {
  render.hitRegions = paintTearableLayer(render.canvas, section, nextSection, content, state);
  syncTearableTextureUpload(render.canvas, render.textureUpload);
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
  const p = TEARABLE_PALETTES[section];
  g.clearRect(0, 0, canvas.width, canvas.height);
  if (state.layout === 'portrait') {
    return paintTearableMobileLayer(canvas, section, content, state);
  }
  drawBase(g, p, section);
  drawHeader(g, p, section, content);

  if (section === SectionType.ABOUT) renderProfile(g, p, content, regions);
  // Thoughts article content is rendered only by the DOM overlay.
  if (section === SectionType.QUOTES) renderQuotes(g, p, content);
  if (section === SectionType.RECOMMENDATIONS) renderRecs(g, p, content, state, regions);

  return regions;
}

function drawBase(g: CanvasRenderingContext2D, p: TearablePalette, section: SectionType) {
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
  g.globalAlpha = 0.1;
  g.fillStyle = p.paper;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  g.restore();
}

function drawHeader(g: CanvasRenderingContext2D, p: TearablePalette, section: SectionType, content: TearableCanvasContent) {
  const fallback = layerLabels[section];
  const meta = {
    title: [
      getCanvasText(content.canvasCopy, section, 'hero_line_1', fallback.title[0]),
      getCanvasText(content.canvasCopy, section, 'hero_line_2', fallback.title[1]),
    ],
    subtitle: getCanvasText(content.canvasCopy, section, 'subtitle', fallback.subtitle),
  };
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

function renderProfile(g: CanvasRenderingContext2D, p: TearablePalette, content: TearableCanvasContent, regions: TearableHitRegion[]) {
  const links = content.profileLinks.length
    ? content.profileLinks.map((link) => ({ label: link.label, href: link.url })).slice(0, 10)
    : uniqueAnchors(content.aboutHtml).slice(0, 10);
  const intro = getCanvasText(content.canvasCopy, SectionType.ABOUT, 'profile_intro', 'I’m Adi. I build AI products, agent infrastructure, and fun little internet experiments.');
  const profileSummary = getCanvasText(content.canvasCopy, SectionType.ABOUT, 'profile_summary', 'Currently building Watercooler. Previously founded Koan Analytics and worked on product ops at DiDi.');
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

function renderQuotes(g: CanvasRenderingContext2D, p: TearablePalette, content: TearableCanvasContent) {
  const quotes = content.quotes.filter((quote) => quote.text.trim());
  if (!quotes.length) {
    g.font = '800 40px "Bricolage Grotesque", sans-serif';
    g.fillStyle = withAlpha(p.ink, 0.72);
    drawWrappedText(g, 'No quotes yet.', 190, 690, 900, 48, 2);
    return;
  }

  const spread = { x: 150, y: 455, w: 1750, h: 590 };
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

function renderRecs(g: CanvasRenderingContext2D, p: TearablePalette, content: TearableCanvasContent, _state: TearableCanvasState, regions: TearableHitRegion[]) {
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
      const href = item.url || anchor?.href;
      const label = summarize(item.label || htmlToText(item.html), Math.max(36, Math.floor(textWidth / 8)));
      g.font = '700 23px "Bricolage Grotesque", sans-serif';
      g.fillStyle = href ? p.ink : withAlpha(p.ink, 0.74);
      drawWrappedText(g, label, x, itemY, textWidth, 27, 1);
      if (href) regions.push({ id: `rec-link-${section.id}-${itemIndex}`, kind: 'link', href, x, y: itemY - 26, width: textWidth, height: 42 });
    });
  });
}

function card(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: TearablePalette, label: string) {
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

function drawLinkPill(g: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, p: TearablePalette) {
  g.fillStyle = 'rgba(255,255,255,0.64)';
  roundedRect(g, x, y, w, 54, 999, true, false);
  g.strokeStyle = p.accent;
  g.lineWidth = 4;
  roundedRect(g, x, y, w, 54, 999, false, true);
  g.font = '800 20px "Bricolage Grotesque", sans-serif';
  g.fillStyle = p.ink;
  g.fillText(label, x + 22, y + 35);
}
