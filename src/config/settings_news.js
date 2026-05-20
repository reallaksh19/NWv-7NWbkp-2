export const DEFAULT_NEWS_SETTINGS = {
    enableNewScoring: true,
    enableProximityScoring: false,
    maxTopicPercent: 40,
    maxGeoPercent: 30,
    topicSuggestions: { enabled: true, basedOnReadingHistory: true },
    enableCache: true,
    crawlerMode: 'auto'
};

export const DEFAULT_NEWSPAPER_SETTINGS = {
    enableImages: true,
    headlinesCount: 3,
    leadsCount: 6,
    briefsCount: 12
};
