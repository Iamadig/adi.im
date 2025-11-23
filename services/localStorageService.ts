import { GuestbookEntry } from '../types';

const STORAGE_KEY = 'recommendations_pending_v1';
const EXPIRATION_DAYS = 30;

interface LocalPendingEntry extends GuestbookEntry {
    isPending: true;
}

export const localStorageService = {
    /**
     * Get all pending entries, optionally filtered by category
     */
    getPendingEntries(categoryId?: string): LocalPendingEntry[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];

            const entries: LocalPendingEntry[] = JSON.parse(raw);

            // Filter by category if specified
            if (categoryId) {
                return entries.filter(entry => entry.category === categoryId);
            }

            return entries;
        } catch (error) {
            console.error('Error reading pending entries:', error);
            return [];
        }
    },

    /**
     * Add a new pending entry
     */
    addPendingEntry(content: string, categoryId: string, author: string): LocalPendingEntry {
        const newEntry: LocalPendingEntry = {
            id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: content.trim(),
            category: categoryId,
            author: author || 'Anonymous',
            createdAt: new Date().toISOString(),
            isApproved: false,
            isPending: true,
        };

        try {
            const existing = this.getPendingEntries();
            existing.push(newEntry);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
            return newEntry;
        } catch (error) {
            console.error('Error adding pending entry:', error);
            return newEntry;
        }
    },

    /**
     * Remove a pending entry by ID
     */
    removePendingEntry(id: string): void {
        try {
            const entries = this.getPendingEntries();
            const filtered = entries.filter(entry => entry.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        } catch (error) {
            console.error('Error removing pending entry:', error);
        }
    },

    /**
     * Clean up entries older than EXPIRATION_DAYS
     */
    cleanupExpiredEntries(): number {
        try {
            const entries = this.getPendingEntries();
            const now = new Date();
            const expirationMs = EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

            const validEntries = entries.filter(entry => {
                const entryDate = new Date(entry.createdAt);
                const age = now.getTime() - entryDate.getTime();
                return age < expirationMs;
            });

            const removedCount = entries.length - validEntries.length;

            if (removedCount > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(validEntries));
                console.log(`Cleaned up ${removedCount} expired pending entries`);
            }

            return removedCount;
        } catch (error) {
            console.error('Error cleaning up expired entries:', error);
            return 0;
        }
    },

    /**
     * Check if any pending entries have been approved
     * Remove them from localStorage if found in approved list
     */
    syncWithApprovedEntries(approvedEntries: GuestbookEntry[]): number {
        try {
            const pending = this.getPendingEntries();

            // Create a set of approved content + category combinations
            const approvedSet = new Set(
                approvedEntries.map(entry => `${entry.content.trim()}|${entry.category}`)
            );

            // Filter out pending entries that appear in approved list
            const stillPending = pending.filter(entry => {
                const key = `${entry.content.trim()}|${entry.category}`;
                return !approvedSet.has(key);
            });

            const syncedCount = pending.length - stillPending.length;

            if (syncedCount > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stillPending));
                console.log(`Synced ${syncedCount} approved entries from localStorage`);
            }

            return syncedCount;
        } catch (error) {
            console.error('Error syncing with approved entries:', error);
            return 0;
        }
    },

    /**
     * Get total count of pending entries
     */
    getPendingCount(): number {
        return this.getPendingEntries().length;
    },

    /**
     * Clear all pending entries (useful for debugging)
     */
    clearAllPending(): void {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('Cleared all pending entries');
        } catch (error) {
            console.error('Error clearing pending entries:', error);
        }
    }
};
