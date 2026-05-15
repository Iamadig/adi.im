import { SectionType } from '../types';

export interface TearablePalette {
  bg: string;
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  accent3: string;
}

// Pushmatrix-inspired: each torn sheet owns a bold field color.
export const TEARABLE_PALETTES: Record<SectionType, TearablePalette> = {
  [SectionType.ABOUT]: {
    bg: '#f6f2ea',
    paper: '#fff8e8',
    ink: '#1a1a1a',
    muted: '#5e584f',
    accent: '#e88468',
    accent2: '#91abdb',
    accent3: '#9acb89',
  },
  [SectionType.THOUGHTS]: {
    bg: '#91abdb',
    paper: '#f6f2ea',
    ink: '#161616',
    muted: '#34445c',
    accent: '#9acb89',
    accent2: '#ae84e6',
    accent3: '#d8a563',
  },
  [SectionType.QUOTES]: {
    bg: '#9acb89',
    paper: '#f6f2ea',
    ink: '#151714',
    muted: '#405534',
    accent: '#ae84e6',
    accent2: '#d8a563',
    accent3: '#91abdb',
  },
  [SectionType.RECOMMENDATIONS]: {
    bg: '#d8a563',
    paper: '#fff3d8',
    ink: '#191510',
    muted: '#675030',
    accent: '#ae84e6',
    accent2: '#91abdb',
    accent3: '#9acb89',
  },
};
