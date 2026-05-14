import type { Quote, RecommendationSection, Thought } from '../types';

interface BuildSiteContextInput {
  aboutHtml: string;
  thoughts: Thought[];
  quotes: Quote[];
  recommendations: RecommendationSection[];
  stripHtml: (html: string) => string;
}

export function buildSiteContext({
  aboutHtml,
  thoughts,
  quotes,
  recommendations,
  stripHtml,
}: BuildSiteContextInput) {
  return [
    `Profile:\n${stripHtml(aboutHtml)}`,
    `Thoughts:\n${thoughts.map((thought) => `${thought.title} (${thought.date}): ${thought.description || stripHtml(thought.content)}`).join('\n')}`,
    `Quotes:\n${quotes.map((quote) => `"${quote.text}" - ${quote.author}`).join('\n')}`,
    `Recommendations:\n${recommendations.map((section) => `${section.title}: ${section.items.map((item) => stripHtml(item.html)).join('; ')}`).join('\n')}`,
  ].join('\n\n');
}
