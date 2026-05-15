import { CanvasCopyItem, SectionType } from '../types';

export const CANVAS_COPY_LIMITS: Record<string, number> = {
  hero_line_1: 16,
  hero_line_2: 16,
  subtitle: 80,
  profile_intro: 140,
  profile_summary: 170,
  footer: 60,
};

export const DEFAULT_CANVAS_COPY: CanvasCopyItem[] = [
  { id: 'about-hero-1', layer: SectionType.ABOUT, slot: 'hero_line_1', text: 'hi! I am', sortOrder: 10, maxCharacters: 16, status: 'Published' },
  { id: 'about-hero-2', layer: SectionType.ABOUT, slot: 'hero_line_2', text: 'Adi', sortOrder: 20, maxCharacters: 16, status: 'Published' },
  { id: 'about-subtitle', layer: SectionType.ABOUT, slot: 'subtitle', text: 'AI products, agent infra, and fun internet experiments.', sortOrder: 30, maxCharacters: 80, status: 'Published' },
  { id: 'about-intro', layer: SectionType.ABOUT, slot: 'profile_intro', text: 'I’m Adi. I build AI products, agent infrastructure, and fun little internet experiments.', sortOrder: 40, maxCharacters: 140, status: 'Published' },
  { id: 'about-summary', layer: SectionType.ABOUT, slot: 'profile_summary', text: 'Currently building Watercooler. Previously founded Koan Analytics and worked on product ops at DiDi.', sortOrder: 50, maxCharacters: 170, status: 'Published' },
  { id: 'thoughts-title', layer: SectionType.THOUGHTS, slot: 'hero_line_1', text: 'THOUGHTS', sortOrder: 10, maxCharacters: 16, status: 'Published' },
  { id: 'thoughts-subtitle', layer: SectionType.THOUGHTS, slot: 'subtitle', text: 'Articles and notes from the notebook.', sortOrder: 20, maxCharacters: 80, status: 'Published' },
  { id: 'quotes-title', layer: SectionType.QUOTES, slot: 'hero_line_1', text: 'QUOTES', sortOrder: 10, maxCharacters: 16, status: 'Published' },
  { id: 'recommend-title', layer: SectionType.RECOMMENDATIONS, slot: 'hero_line_1', text: 'RECOMMENDATION', sortOrder: 10, maxCharacters: 16, status: 'Published' },
  { id: 'recommend-subtitle', layer: SectionType.RECOMMENDATIONS, slot: 'subtitle', text: 'Books, tools, and references I recommend.', sortOrder: 20, maxCharacters: 80, status: 'Published' },
  { id: 'global-footer', layer: SectionType.ABOUT, slot: 'footer', text: 'Tear the page to navigate. Press R to reset.', sortOrder: 90, maxCharacters: 60, status: 'Published' },
];

export function getCanvasText(
  copy: CanvasCopyItem[] | undefined,
  layer: SectionType,
  slot: string,
  fallback = '',
) {
  const match = copy?.find((item) => item.layer === layer && item.slot === slot && item.text.trim());
  if (match) return match.text.trim();

  const defaultMatch = DEFAULT_CANVAS_COPY.find((item) => item.layer === layer && item.slot === slot);
  if (defaultMatch) return defaultMatch.text;

  return fallback;
}
