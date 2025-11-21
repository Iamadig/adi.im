
import React from 'react';

export enum SectionType {
  ABOUT = 'About Me',
  THOUGHTS = 'Thoughts',
  QUOTES = 'Quotes',
  CRAFTS = 'Crafts',
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
  tags: string[];
}

export interface Quote {
  id: string;
  text: string;
  author: string;
}

export interface Craft {
  id: string;
  title: string;
  url: string;
  domain: string;
}

export interface GuestbookEntry {
  id: string;
  content: string;
  author: string;
  category: string; // New field to track which list this belongs to (Books, Tools, etc.)
  createdAt: string; 
  color?: string; 
  isApproved: boolean;
}

export interface RecommendationSection {
  id: string;
  title: string;
  items: string[];
}

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignLeft: boolean;
  alignCenter: boolean; 
  listOrdered: boolean;
  listBullet: boolean;
}
