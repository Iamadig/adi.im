
import { ABOUT_ME_TEXT, INITIAL_THOUGHTS, INITIAL_QUOTES, INITIAL_CRAFTS, RECOMMENDATION_SECTIONS } from '../constants';
import { Thought, Quote, Craft, RecommendationSection } from '../types';

export const notionService = {

  // 1. ABOUT ME
  async getAboutMe(): Promise<string> {
    try {
      const response = await fetch('/api/notion/about');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.html || data.text || ABOUT_ME_TEXT;
    } catch (error) {
      console.error('Error fetching About Me:', error);
      return ABOUT_ME_TEXT;
    }
  },

  // 2. THOUGHTS
  async getThoughts(): Promise<Thought[]> {
    try {
      const response = await fetch('/api/notion/thoughts');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.thoughts || INITIAL_THOUGHTS;
    } catch (error) {
      console.error('Error fetching Thoughts:', error);
      return INITIAL_THOUGHTS;
    }
  },

  async getThoughtContent(id: string): Promise<string> {
    try {
      const response = await fetch(`/api/notion/thoughts?id=${id}`);
      if (!response.ok) throw new Error('Failed to fetch content');
      const data = await response.json();
      return data.content || '';
    } catch (error) {
      console.error('Error fetching Thought Content:', error);
      return '';
    }
  },

  // 3. QUOTES
  async getQuotes(): Promise<Quote[]> {
    try {
      const response = await fetch('/api/notion/quotes');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.quotes || INITIAL_QUOTES;
    } catch (error) {
      console.error('Error fetching Quotes:', error);
      return INITIAL_QUOTES;
    }
  },

  // 4. CRAFTS
  async getCrafts(): Promise<string> {
    try {
      const response = await fetch('/api/notion/crafts');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.html || '';
    } catch (error) {
      console.error('Error fetching Crafts:', error);
      return '';
    }
  },

  // 5. RECOMMENDATIONS
  async getRecommendations(): Promise<RecommendationSection[]> {
    try {
      const response = await fetch('/api/notion/recommendations');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.recommendations || RECOMMENDATION_SECTIONS;
    } catch (error) {
      console.error('Error fetching Recommendations:', error);
      return RECOMMENDATION_SECTIONS;
    }
  }
};

