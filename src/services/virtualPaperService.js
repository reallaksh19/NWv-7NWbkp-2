import { fetchSectionNews } from './rssAggregator';

/**
 * Virtual Paper Service
 * Generates a "Digital Front Page" by aggregating news from various sections
 * when the static E-paper data is unavailable.
 */

const PAPER_CONFIG = {
    THE_HINDU: {
        sections: [
            { id: 'india', title: 'Front Page', limit: 10 },
            { id: 'world', title: 'International', limit: 6 },
            { id: 'business', title: 'Business', limit: 5 },
            { id: 'sports', title: 'Sport', limit: 5 }
        ]
    },
    INDIAN_EXPRESS: {
        sections: [
            { id: 'india', title: 'Front Page', limit: 10 },
            { id: 'world', title: 'World', limit: 5 },
            { id: 'technology', title: 'Explained / Tech', limit: 5 }
        ]
    },
    DINAMANI: {
        sections: [
            { id: 'chennai', title: 'Tamil Nadu', limit: 10 }, // Approximation
            { id: 'entertainment', title: 'Cinema', limit: 5 }
        ]
    },
    DAILY_THANTHI: {
        sections: [
            { id: 'chennai', title: 'Headlines', limit: 10 },
            { id: 'local', title: 'District News', limit: 5 }
        ]
    }
};

export const virtualPaperService = {
    /**
     * Generates a virtual paper for a given source ID.
     * @param {string} sourceId - e.g., 'THE_HINDU'
     * @returns {Promise<Array>} - Array of section objects { page, articles }
     */
    getVirtualPaper: async (sourceId) => {
        const config = PAPER_CONFIG[sourceId];
        if (!config) {
            console.warn(`[VirtualPaper] No config for ${sourceId}`);
            return [];
        }

        console.log(`[VirtualPaper] Generating for ${sourceId}...`);

        const tasks = config.sections.map(async (sectionConfig) => {
            try {
                // Fetch news from the aggregator
                // We map 'india' -> 'india' section in aggregator, etc.
                const articles = await fetchSectionNews(sectionConfig.id, sectionConfig.limit);

                return {
                    page: sectionConfig.title,
                    articles: articles.map(a => ({
                        title: a.title,
                        link: a.link,
                        description: a.description,
                        source: a.source,
                        publishedAt: a.publishedAt
                    }))
                };
            } catch (error) {
                console.error(`[VirtualPaper] Failed to fetch section ${sectionConfig.id}`, error);
                return {
                    page: sectionConfig.title,
                    articles: [],
                    error: "Failed to load section"
                };
            }
        });

        const results = await Promise.all(tasks);
        return results.filter(r => r.articles.length > 0);
    }
};
