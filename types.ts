
import React from 'react';

export enum SectionType {
  ABOUT = 'About Me',
  THOUGHTS = 'Thoughts',
  QUOTES = 'Quotes',
  RECOMMENDATIONS = 'Recommendations'
}

export type ViewMode = 'editing' | 'viewing';

export interface NavItem {
  id: SectionType;
  label: string;
  icon?: React.ComponentType<any>;
}

export interface Thought {
  id: string;
  title: string;
  date: string;
  content: string;
  description?: string;
  tags: string[];
}

export interface Quote {
  id: string;
  text: string;
  author: string;
}

export interface RecommendationItem {
  id: string;
  html: string;
  label?: string;
  description?: string | null;
  url?: string | null;
  attribution?: string | null;
  kind: string;
}

export interface RecommendationSection {
  id: string;
  title: string;
  items: RecommendationItem[];
}

export interface CanvasCopyItem {
  id: string;
  layer: SectionType;
  slot: string;
  text: string;
  url?: string | null;
  sortOrder: number;
  maxCharacters?: number | null;
  status?: string;
}

export interface ProfileLink {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
  maxCharacters?: number | null;
  status?: string;
}

export interface OutlineItem {
  id: string;
  label: string;
  level: 1 | 2 | 3;
}

export interface SiteContentSnapshot {
  generatedAt: string;
  canvasCopy: CanvasCopyItem[];
  profileLinks: ProfileLink[];
  aboutHtml: string;
  craftsHtml: string;
  thoughts: Thought[];
  quotes: Quote[];
  recommendations: RecommendationSection[];
}

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignLeft: boolean;
  alignCenter: boolean;
  listOrdered: boolean;
  listBullet: boolean;
  fontFamily?: string;
  fontSize?: string;
  blockFormat?: string;
}
