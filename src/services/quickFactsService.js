/**
 * Quick Facts Service
 * Fetches "On This Day" events from Wikipedia API to provide interesting daily facts.
 */

const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected';

export const quickFactsService = {
    /**
     * Fetches "On This Day" facts for the current date.
     * @returns {Promise<Array>} Array of fact objects { text, year }
     */
    fetchDailyFacts: async () => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const url = `${WIKI_API_BASE}/${month}/${day}`;

        try {
            console.log(`[QuickFacts] Fetching from ${url}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error('Wiki API Failed');

            const data = await response.json();

            if (!data.selected || data.selected.length === 0) return [];

            // Randomly select 5 facts
            const shuffled = data.selected.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 5);

            return selected.map(item => ({
                text: item.text,
                year: item.year,
                pages: item.pages // Optional: Link to wiki pages
            }));

        } catch (error) {
            console.warn('[QuickFacts] Fetch failed:', error);
            return [];
        }
    }
};
