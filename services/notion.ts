
import { NOTION_CONFIG, ABOUT_ME_TEXT, INITIAL_THOUGHTS, INITIAL_QUOTES, INITIAL_CRAFTS, RECOMMENDATION_SECTIONS } from '../constants';
import { Thought, Quote, Craft, RecommendationSection } from '../types';

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const notionService = {
  
  // 1. ABOUT ME
  async getAboutMe(): Promise<string> {
    if (!NOTION_CONFIG.API_KEY || !NOTION_CONFIG.PAGE_IDS.ABOUT) {
      await delay(600);
      return ABOUT_ME_TEXT;
    }
    return ABOUT_ME_TEXT;
  },

  // 2. THOUGHTS
  async getThoughts(): Promise<Thought[]> {
    if (!NOTION_CONFIG.API_KEY || !NOTION_CONFIG.DATABASE_IDS.THOUGHTS) {
      await delay(800);
      return INITIAL_THOUGHTS;
    }
    return INITIAL_THOUGHTS;
  },

  // 3. QUOTES
  async getQuotes(): Promise<Quote[]> {
    if (!NOTION_CONFIG.API_KEY || !NOTION_CONFIG.DATABASE_IDS.QUOTES) {
      await delay(500);
      return INITIAL_QUOTES;
    }
    return INITIAL_QUOTES;
  },

  // 4. CRAFTS
  async getCrafts(): Promise<Craft[]> {
    if (!NOTION_CONFIG.API_KEY || !NOTION_CONFIG.DATABASE_IDS.CRAFTS) {
      await delay(400);
      return INITIAL_CRAFTS;
    }
    return INITIAL_CRAFTS;
  },

  // 5. RECOMMENDATIONS
  async getRecommendations(): Promise<RecommendationSection[]> {
    if (!NOTION_CONFIG.API_KEY || !NOTION_CONFIG.PAGE_IDS.RECOMMENDATIONS) {
      await delay(700);
      return RECOMMENDATION_SECTIONS;
    }
    return RECOMMENDATION_SECTIONS;
  }
};
