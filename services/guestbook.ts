
import { createClient } from '@supabase/supabase-js';
import { GuestbookEntry } from '../types';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// --- ANONYMOUS NAMES GENERATOR ---
const ANIMALS = ['Anonymous Armadillo', 'Anonymous Buffalo', 'Anonymous Capybara', 'Anonymous Dingo', 'Anonymous Elephant', 'Anonymous Ferret', 'Anonymous Giraffe'];
const COLORS = ['#E57373', '#F06292', '#BA68C8', '#9575CD', '#7986CB', '#64B5F6', '#4FC3F7', '#4DD0E1', '#4DB6AC', '#81C784'];

export const guestbookService = {

  async getEntries(): Promise<GuestbookEntry[]> {
    if (!supabase) {
      // Fallback to localStorage if Supabase not configured
      await new Promise(resolve => setTimeout(resolve, 600));

      try {
        const raw = localStorage.getItem('docs_folio_guestbook');
        if (!raw) return [];

        const allEntries: GuestbookEntry[] = JSON.parse(raw);
        return allEntries.filter(e => e.isApproved);
      } catch (e) {
        return [];
      }
    }

    try {
      const { data, error } = await supabase
        .from('guestbook_entries')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((entry: any) => ({
        id: entry.id,
        content: entry.content,
        category: entry.category,
        author: entry.author,
        createdAt: entry.created_at,
        color: entry.color || COLORS[Math.floor(Math.random() * COLORS.length)],
        isApproved: entry.is_approved
      }));
    } catch (error) {
      console.error('Error fetching guestbook entries:', error);
      return [];
    }
  },

  async addEntry(content: string, category: string, author?: string): Promise<GuestbookEntry> {
    const nameToUse = author && author.trim() ? author.trim() : ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    const newEntry: GuestbookEntry = {
      id: Date.now().toString(),
      content: content,
      category: category,
      author: nameToUse,
      createdAt: new Date().toISOString(),
      color: color,
      isApproved: false,
    };

    if (!supabase) {
      // Fallback to localStorage if Supabase not configured
      await new Promise(resolve => setTimeout(resolve, 400));

      const raw = localStorage.getItem('docs_folio_guestbook');
      const allEntries: GuestbookEntry[] = raw ? JSON.parse(raw) : [];
      allEntries.push(newEntry);
      localStorage.setItem('docs_folio_guestbook', JSON.stringify(allEntries));

      return newEntry;
    }

    try {
      const { data, error } = await supabase
        .from('guestbook_entries')
        .insert([
          {
            content: content,
            category: category,
            author: nameToUse,
            color: color,
            is_approved: false
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        content: data.content,
        category: data.category,
        author: data.author,
        createdAt: data.created_at,
        color: data.color,
        isApproved: data.is_approved
      };
    } catch (error) {
      console.error('Error adding guestbook entry:', error);
      // Return the entry anyway (it just won't be saved)
      return newEntry;
    }
  }
};
