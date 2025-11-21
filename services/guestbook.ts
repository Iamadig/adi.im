
import { GuestbookEntry } from '../types';

// --- ANONYMOUS NAMES GENERATOR ---
const ANIMALS = ['Anonymous Armadillo', 'Anonymous Buffalo', 'Anonymous Capybara', 'Anonymous Dingo', 'Anonymous Elephant', 'Anonymous Ferret', 'Anonymous Giraffe'];
const COLORS = ['#E57373', '#F06292', '#BA68C8', '#9575CD', '#7986CB', '#64B5F6', '#4FC3F7', '#4DD0E1', '#4DB6AC', '#81C784'];

export const guestbookService = {
  
  async getEntries(): Promise<GuestbookEntry[]> {
    // --- MOCK IMPLEMENTATION (LocalStorage) ---
    await new Promise(resolve => setTimeout(resolve, 600));
    
    try {
      const raw = localStorage.getItem('docs_folio_guestbook');
      if (!raw) return [];
      
      const allEntries: GuestbookEntry[] = JSON.parse(raw);
      // Filter for approved entries only
      return allEntries.filter(e => e.isApproved);
    } catch (e) {
      return [];
    }
  },

  async addEntry(content: string, category: string, author?: string): Promise<GuestbookEntry> {
    const nameToUse = author && author.trim() ? author.trim() : ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    
    const newEntry: GuestbookEntry = {
      id: Date.now().toString(),
      content: content,
      category: category, // Track which section this belongs to
      author: nameToUse,
      createdAt: new Date().toISOString(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      isApproved: false, // Default to false for moderation
    };

    // --- MOCK IMPLEMENTATION ---
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const raw = localStorage.getItem('docs_folio_guestbook');
    const allEntries: GuestbookEntry[] = raw ? JSON.parse(raw) : [];
    allEntries.push(newEntry);
    localStorage.setItem('docs_folio_guestbook', JSON.stringify(allEntries));
    
    return newEntry;
  }
};
