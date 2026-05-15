import type { OutlineItem } from '../types';

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[^;\s]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

function decodeHtml(value: string) {
  if (typeof document === 'undefined') {
    return value;
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

export function extractOutlineFromHtml(html: string, prefix: string): OutlineItem[] {
  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<article>${html}</article>`, 'text/html');
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3'));

  return headings.map((heading, index) => {
    const tagName = heading.tagName.toLowerCase();
    const rawText = decodeHtml((heading.textContent || '').trim());
    const level: OutlineItem['level'] = tagName === 'h1' ? 1 : tagName === 'h2' ? 2 : 3;

    return {
      id: `${prefix}-${slugify(rawText, `heading-${index + 1}`)}`,
      label: rawText,
      level,
    };
  }).filter((item) => item.label);
}

export function syncHeadingAnchors(container: HTMLElement | null, items: OutlineItem[]) {
  if (!container || items.length === 0) {
    return;
  }

  const headings = Array.from(container.querySelectorAll('h1, h2, h3'));
  headings.forEach((heading, index) => {
    const item = items[index];
    if (!item) {
      return;
    }

    const element = heading as HTMLElement;
    element.id = item.id;
    element.setAttribute('data-outline-id', item.id);
    element.style.scrollMarginTop = '112px';
  });
}

export function estimateReadingTimeMinutes(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}
