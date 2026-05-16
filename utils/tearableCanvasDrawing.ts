export function roundedRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: boolean, stroke: boolean) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  if (fill) g.fill();
  if (stroke) g.stroke();
}

export function drawRaggedRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, rot: number, alpha: number) {
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.rotate((rot * Math.PI) / 180);
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const px = -w / 2 + (i / steps) * w;
    const py = -h / 2 + Math.sin(i * 1.9) * 18;
    i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
  }
  for (let i = 0; i <= steps; i++) {
    g.lineTo(w / 2 - (i / steps) * w, h / 2 + Math.cos(i * 2.3) * 18);
  }
  g.closePath();
  g.fill();
  g.restore();
}

export function drawGear(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha: number) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 28; i++) {
    const radius = i % 2 === 0 ? r : r * 0.78;
    const a = (i / 28) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  // Keep the sheet texture opaque. Clearing the center creates alpha-zero
  // pixels that render as black through the opaque Three material.
  g.globalAlpha = Math.min(1, alpha * 0.72);
  g.fillStyle = 'rgba(255,248,224,0.82)';
  g.beginPath();
  g.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function drawSpiral(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha: number) {
  g.save();
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = 8;
  g.beginPath();
  for (let i = 0; i < 130; i++) {
    const t = i / 129;
    const a = t * Math.PI * 8;
    const rr = r * t;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.72;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke();
  g.restore();
}

export function drawWrappedText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 6) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > maxWidth && line) {
      g.fillText(line, x, y);
      y += lineHeight;
      lines++;
      line = word;
      if (lines >= maxLines) return y;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) {
    g.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function uniqueAnchors(html: string) {
  const anchors = extractAnchors(html);
  const seen = new Set<string>();
  return anchors.filter((anchor) => {
    if (!anchor.href || seen.has(anchor.href)) return false;
    seen.add(anchor.href);
    return true;
  });
}

export function extractAnchors(html: string): Array<{ label: string; href: string }> {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('a[href]')).map((anchor) => ({
    label: (anchor.textContent || anchor.getAttribute('href') || 'link').replace(/\s+/g, ' ').trim(),
    href: (anchor as HTMLAnchorElement).href || anchor.getAttribute('href') || '',
  }));
}

export function htmlToText(html: string) {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    const spacedHtml = html.replace(/<\/(p|li|h[1-6]|blockquote)>/gi, ' </$1>');
    const doc = new DOMParser().parseFromString(spacedHtml, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function summarize(text: string, max: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1).trim() + '...' : clean;
}

export function compactLabel(label: string) {
  return summarize(label.replace(/^https?:\/\//, '').replace(/\/$/, ''), 24);
}

export function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
