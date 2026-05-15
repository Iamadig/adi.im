import { SectionType, NavItem, Quote, Thought, RecommendationSection } from './types';
import { NotebookPen, Sparkles, UserRound } from 'lucide-react';

export const NAV_ITEMS: NavItem[] = [
  { id: SectionType.ABOUT, label: 'Profile', icon: UserRound },
  { id: SectionType.THOUGHTS, label: 'Thoughts', icon: NotebookPen },
  { id: SectionType.QUOTES, label: 'Quotes', icon: NotebookPen },
  { id: SectionType.RECOMMENDATIONS, label: 'Recommendation', icon: Sparkles },
];

export const ABOUT_ME_TEXT = `I’m Adi. I build AI products, agent infrastructure, and fun little internet experiments.

Currently I’m building Watercooler, a coordination surface and memory layer for coding agents.

Previously, I founded Koan Analytics, an AI platform for mineral exploration, and worked on product operations at DiDi.`;

export const RECOMMENDATION_SECTIONS: RecommendationSection[] = [];

export const INITIAL_THOUGHTS: Thought[] = [
  {
    id: 'work-watercooler',
    title: 'Watercooler',
    date: 'now',
    content: 'A coordination surface and memory layer for coding agents.',
    tags: ['agents', 'memory', 'coordination']
  },
  {
    id: 'work-makemyclaw',
    title: 'MakeMyClaw',
    date: 'agent infra',
    content: 'One-click deploy infrastructure for OpenClaw and Hermes agents.',
    tags: ['deployment', 'openclaw', 'infra']
  },
  {
    id: 'work-learnfromlenny',
    title: 'LearnFromLenny',
    date: 'internet agent',
    content: 'An X agent that answers with Lenny Rachitsky’s product corpus.',
    tags: ['x', 'product', 'agent']
  },
  {
    id: 'work-moltipedia',
    title: 'Moltipedia',
    date: 'experiment',
    content: 'A playful experiment in agent-written knowledge systems.',
    tags: ['knowledge', 'agents', 'web']
  }
];

export const INITIAL_QUOTES: Quote[] = [
];
