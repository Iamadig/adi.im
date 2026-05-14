import { SectionType } from '../types';

export interface TearableProfileLayer {
  section: SectionType;
  titleLines: [string, string];
  title: string;
  subtitle: string;
  detail: string;
  chips: string[];
  palette: {
    bg: string;
    ink: string;
    muted: string;
    paper: string;
    paperAlt: string;
    accent: string;
    accentAlt: string;
    wash: string;
  };
}

export const PROFILE_TEAR_LAYER_ORDER = [
  SectionType.ABOUT,
  SectionType.THOUGHTS,
  SectionType.QUOTES,
  SectionType.RECOMMENDATIONS,
];

export const PROFILE_TEAR_LAYERS: Record<SectionType, TearableProfileLayer> = {
  [SectionType.ABOUT]: {
    section: SectionType.ABOUT,
    titleLines: ['hi! I am', 'Adi'],
    title: 'Profile',
    subtitle: 'AI products, agent infra, and fun internet experiments.',
    detail: 'A direct read on what Adi is building, where he has worked, and where to find him.',
    chips: ['ai products', 'agents', 'experiments'],
    palette: {
      bg: '#dedbd2',
      ink: '#080807',
      muted: '#55534e',
      paper: '#e88468',
      paperAlt: '#b8afd9',
      accent: '#a7ccc0',
      accentAlt: '#f2dfc8',
      wash: '#fff8e8',
    },
  },
  [SectionType.THOUGHTS]: {
    section: SectionType.THOUGHTS,
    titleLines: ['WORK', 'LOG'],
    title: 'Work',
    subtitle: 'Products, agents, and experiments worth opening.',
    detail: 'Current and past projects with enough context to understand the judgment behind them.',
    chips: ['watercooler', 'infra', 'agents'],
    palette: {
      bg: '#e8e0ca',
      ink: '#0a0a0a',
      muted: '#5e5548',
      paper: '#a3b18a',
      paperAlt: '#5b8aa6',
      accent: '#e7a063',
      accentAlt: '#c8c0af',
      wash: '#f8f1dc',
    },
  },
  [SectionType.QUOTES]: {
    section: SectionType.QUOTES,
    titleLines: ['QUOTES', ''],
    title: 'Quotes',
    subtitle: '',
    detail: 'Lines I keep coming back to.',
    chips: ['quotes', 'notes', 'principles'],
    palette: {
      bg: '#dfe9df',
      ink: '#10120f',
      muted: '#4b584b',
      paper: '#d4756c',
      paperAlt: '#7e9eb5',
      accent: '#c9b785',
      accentAlt: '#a08bc4',
      wash: '#f8f0dc',
    },
  },
  [SectionType.RECOMMENDATIONS]: {
    section: SectionType.RECOMMENDATIONS,
    titleLines: ['RECOMMENDATION', ''],
    title: 'Recommendation',
    subtitle: 'Books, tools, and references I recommend.',
    detail: 'A compact set of recommendations that says something about what Adi values.',
    chips: ['books', 'tools', 'references'],
    palette: {
      bg: '#f1e2d3',
      ink: '#11110f',
      muted: '#684f44',
      paper: '#ff8a72',
      paperAlt: '#9bb9aa',
      accent: '#a799c9',
      accentAlt: '#5b8aa6',
      wash: '#fff4dc',
    },
  },
};

export function getNextProfileSection(section: SectionType): SectionType {
  const index = PROFILE_TEAR_LAYER_ORDER.indexOf(section);
  return PROFILE_TEAR_LAYER_ORDER[(index + 1) % PROFILE_TEAR_LAYER_ORDER.length];
}
