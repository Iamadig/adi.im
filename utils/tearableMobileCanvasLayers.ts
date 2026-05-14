import { SectionType } from '../types';
import {
  compactLabel,
  drawGear,
  drawRaggedRect,
  drawSpiral,
  drawWrappedText,
  htmlToText,
  roundedRect,
  summarize,
  uniqueAnchors,
  withAlpha,
} from './tearableCanvasDrawing';
import type { TearableCanvasContent, TearableCanvasState, TearableHitRegion } from './tearableCanvasLayers';

const W = 2048;
const H = 1152;
const STRIP_X = 760;
const STRIP_W = 560;

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

const labels: Record<SectionType, { title: string; note: string }> = {
  [SectionType.ABOUT]: {
    title: 'hi! I am Adi',
    note: 'AI products, agent infra, and fun internet experiments.',
  },
  [SectionType.THOUGHTS]: {
    title: 'THOUGHTS',
    note: 'Articles from the notebook.',
  },
  [SectionType.QUOTES]: {
    title: 'QUOTES',
    note: '',
  },
  [SectionType.RECOMMENDATIONS]: {
    title: 'RECOMMEND',
    note: 'Books, tools, and references.',
  },
};

export function paintTearableMobileLayer(
  canvas: HTMLCanvasElement,
  section: SectionType,
  content: TearableCanvasContent,
  state: TearableCanvasState,
) {
  const g = canvas.getContext('2d');
  if (!g) return [];
  const p = palettes[section];
  const regions: TearableHitRegion[] = [];
  drawMobileBase(g, p, section);
  drawMobileHeader(g, p, section);

  if (section === SectionType.ABOUT) renderMobileProfile(g, p, content, regions);
  if (section === SectionType.THOUGHTS) renderMobileThoughts(g, p, content, state, regions);
  if (section === SectionType.QUOTES) renderMobileQuotes(g, p, content);
  if (section === SectionType.RECOMMENDATIONS) renderMobileRecs(g, p, content, regions);

  g.save();
  g.font = '800 27px "Bricolage Grotesque", sans-serif';
  g.fillStyle = withAlpha(p.ink, 0.58);
  drawWrappedText(g, 'Tear to navigate. Press R to reset.', STRIP_X + 20, 1124, STRIP_W - 40, 32, 1);
  g.restore();
  return regions;
}

function drawMobileBase(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], section: SectionType) {
  g.fillStyle = p.bg;
  g.fillRect(0, 0, W, H);
  const wash = g.createRadialGradient(W * 0.5, H * 0.4, 80, W * 0.5, H * 0.5, W * 0.5);
  wash.addColorStop(0, 'rgba(255,255,255,0.44)');
  wash.addColorStop(0.65, 'rgba(255,248,224,0.24)');
  wash.addColorStop(1, 'rgba(0,0,0,0.16)');
  g.fillStyle = wash;
  g.fillRect(0, 0, W, H);
  drawRaggedRect(g, STRIP_X - 90, 150, 410, 160, p.accent, -10, 0.72);
  drawRaggedRect(g, STRIP_X + 230, 108, 350, 310, p.accent2, 12, 0.54);
  drawRaggedRect(g, STRIP_X - 60, 760, 330, 210, p.accent3, -6, 0.38);
  drawRaggedRect(g, STRIP_X + 245, 805, 300, 240, p.accent, 4, 0.46);
  drawGear(g, STRIP_X + 430, 205, 82, p.accent2, 0.7);
  drawSpiral(g, STRIP_X + 150, 180, 72, p.ink, 0.52);
  if (section === SectionType.RECOMMENDATIONS) drawGear(g, STRIP_X + 96, 910, 72, p.accent3, 0.5);
  g.strokeStyle = 'rgba(20,18,14,0.085)';
  g.lineWidth = 1.5;
  for (let y = 74; y < H - 40; y += 42) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y + Math.sin(y * 0.03) * 5);
    g.stroke();
  }
  g.globalAlpha = 0.18;
  g.fillStyle = p.paper;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
}

function drawMobileHeader(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], section: SectionType) {
  const meta = labels[section];
  const titleSize = section === SectionType.THOUGHTS ? 70 : section === SectionType.QUOTES ? 82 : section === SectionType.RECOMMENDATIONS ? 70 : 86;
  g.save();
  g.font = `400 ${titleSize}px "Special Gothic Expanded One", sans-serif`;
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(255,248,232,0.78)';
  g.fillStyle = withAlpha(p.ink, 0.9);
  if (section === SectionType.ABOUT) {
    g.fillText('hi! I am', STRIP_X + 22, 190);
    g.fillText('Adi', STRIP_X + 22, 284);
  } else {
    drawFittedTitle(g, meta.title, STRIP_X + 22, 190, STRIP_W - 44, titleSize);
  }
  if (meta.note) {
    g.font = '800 31px "Bricolage Grotesque", sans-serif';
    g.fillStyle = withAlpha(p.ink, 0.64);
    drawWrappedText(g, meta.note, STRIP_X + 26, 360, STRIP_W - 52, 38, 3);
  }
  g.restore();
}

function drawFittedTitle(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, maxSize: number) {
  let size = maxSize;
  do {
    g.font = `400 ${size}px "Special Gothic Expanded One", sans-serif`;
    if (g.measureText(text).width <= maxWidth || size <= 44) break;
    size -= 2;
  } while (size > 44);
  g.fillText(text, x, y);
}

function mobileCard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: typeof palettes[SectionType.ABOUT], label: string) {
  g.save();
  g.shadowColor = 'rgba(20,18,14,0.18)';
  g.shadowBlur = 24;
  g.shadowOffsetY = 10;
  g.fillStyle = 'rgba(255,249,232,0.84)';
  roundedRect(g, x, y, w, h, 24, true, false);
  g.shadowColor = 'transparent';
  g.strokeStyle = withAlpha(p.ink, 0.28);
  g.lineWidth = 4;
  roundedRect(g, x, y, w, h, 24, false, true);
  g.font = '800 18px "Azeret Mono", monospace';
  g.fillStyle = withAlpha(p.ink, 0.56);
  g.fillText(label, x + 28, y + 42);
  g.restore();
}

function renderMobileProfile(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], content: TearableCanvasContent, regions: TearableHitRegion[]) {
  mobileCard(g, STRIP_X + 22, 450, STRIP_W - 44, 290, p, 'PROFILE');
  g.font = '800 34px "Bricolage Grotesque", sans-serif';
  g.fillStyle = p.ink;
  drawWrappedText(g, 'I build AI products, agent infrastructure, and fun little internet experiments.', STRIP_X + 50, 525, STRIP_W - 100, 40, 4);
  g.font = '700 24px "Bricolage Grotesque", sans-serif';
  g.fillStyle = withAlpha(p.ink, 0.72);
  drawWrappedText(g, 'Currently building Watercooler. Previously founded Koan Analytics and worked on product ops at DiDi.', STRIP_X + 50, 670, STRIP_W - 100, 31, 3);

  mobileCard(g, STRIP_X + 22, 750, STRIP_W - 44, 335, p, 'LINKS');
  const links = uniqueAnchors(content.aboutHtml).slice(0, 8);
  let x = STRIP_X + 50;
  let y = 815;
  for (const link of links) {
    const label = compactLabel(link.label);
    const width = Math.min(220, 50 + label.length * 13);
    if (x + width > STRIP_X + STRIP_W - 50) {
      x = STRIP_X + 50;
      y += 62;
    }
    drawPill(g, x, y, width, label, p);
    regions.push({ id: `mobile-profile-link-${regions.length}`, kind: 'link', x, y, width, height: 50, href: link.href });
    x += width + 12;
  }
}

function renderMobileThoughts(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], content: TearableCanvasContent, state: TearableCanvasState, regions: TearableHitRegion[]) {
  void content;
  void state;
  void regions;
  g.save();
  g.globalAlpha = 0.22;
  drawRaggedRect(g, STRIP_X + 10, 510, STRIP_W - 20, 470, p.paper, -1, 0.38);
  g.restore();
}

function renderMobileQuotes(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], content: TearableCanvasContent) {
  const quotes = content.quotes.filter((quote) => quote.text.trim()).slice(0, 6);
  if (!quotes.length) return;
  quotes.forEach((quote, index) => {
    const x = STRIP_X + 42 + (index % 2) * 18;
    const y = 470 + index * 94;
    drawRaggedRect(g, x - 18, y - 34, STRIP_W - 70, 86, index % 2 ? p.accent2 : p.accent, index % 2 ? 2 : -2, 0.18);
    g.font = '800 28px "Bricolage Grotesque", sans-serif';
    g.fillStyle = withAlpha(p.ink, 0.9);
    const bottom = drawWrappedText(g, `"${quote.text}"`, x + 26, y, STRIP_W - 120, 31, 2);
    if (quote.author && quote.author.toLowerCase() !== 'unknown') {
      g.font = '700 16px "Azeret Mono", monospace';
      g.fillStyle = withAlpha(p.ink, 0.56);
      g.fillText('- ' + quote.author, x + 26, bottom + 12);
    }
  });
}

function renderMobileRecs(g: CanvasRenderingContext2D, p: typeof palettes[SectionType.ABOUT], content: TearableCanvasContent, regions: TearableHitRegion[]) {
  mobileCard(g, STRIP_X + 22, 455, STRIP_W - 44, 580, p, 'RECOMMENDATION');
  content.recommendations.filter((section) => section.items.length).slice(0, 4).forEach((section, sectionIndex) => {
    const y = 520 + sectionIndex * 120;
    g.font = '800 30px "Bricolage Grotesque", sans-serif';
    g.fillStyle = p.ink;
    drawWrappedText(g, section.title, STRIP_X + 50, y, STRIP_W - 100, 34, 1);
    section.items.slice(0, 2).forEach((item, itemIndex) => {
      const itemY = y + 42 + itemIndex * 36;
      const anchor = uniqueAnchors(item.html)[0];
      const label = summarize(htmlToText(item.html), 34);
      g.font = '700 23px "Bricolage Grotesque", sans-serif';
      g.fillStyle = anchor ? p.ink : withAlpha(p.ink, 0.72);
      drawWrappedText(g, label, STRIP_X + 58, itemY, STRIP_W - 120, 27, 1);
      if (anchor) regions.push({ id: `mobile-rec-link-${section.id}-${itemIndex}`, kind: 'link', href: anchor.href, x: STRIP_X + 58, y: itemY - 25, width: STRIP_W - 120, height: 35 });
    });
  });
}

function drawPill(g: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, p: typeof palettes[SectionType.ABOUT]) {
  g.fillStyle = 'rgba(255,255,255,0.64)';
  roundedRect(g, x, y, w, 50, 999, true, false);
  g.strokeStyle = p.accent;
  g.lineWidth = 4;
  roundedRect(g, x, y, w, 50, 999, false, true);
  g.font = '800 18px "Bricolage Grotesque", sans-serif';
  g.fillStyle = p.ink;
  g.fillText(label, x + 18, y + 32);
}
