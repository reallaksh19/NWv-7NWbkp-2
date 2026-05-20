import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities.js';
import { DEFAULT_NEWS_SETTINGS, DEFAULT_NEWSPAPER_SETTINGS } from '../config/settings_news.js';
import { DEFAULT_WEATHER_SETTINGS } from '../config/settings_weather.js';
import { DEFAULT_MARKET_SETTINGS } from '../config/settings_market.js';
import { DEFAULT_UPAHEAD_SETTINGS } from '../config/settings_upahead.js';

// Local Storage utility for settings persistence
import { isDevMobileViewForced } from '../hooks/useMediaQuery.js';

const STORAGE_KEYS = {
    SETTINGS: 'dailyEventAI_settings',
    LAST_REFRESH: 'dailyEventAI_lastRefresh',
    CACHED_DATA: 'dailyEventAI_cachedData',
    ARTICLE_VIEWS: 'dailyEventAI_articleViews'
};

const API_BASE = '/api';

const SETTINGS_SCHEMA_VERSION = 2;

function migrateSettings(stored) {
    const version = stored?.schemaVersion || 1;
    let migrated = { ...stored };

    if (version < 2) {
        migrated = {
            ...migrated,
            schemaVersion: 2
        };
    }

    return migrated;
}


function isStaticHostRuntime() { return getRuntimeCapabilities().isStaticHost; }

// Default settings - REDESIGNED SCHEMA

export const DEFAULT_SETTINGS = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    uiMode: 'timeline',
    customSortTopStories: true,
    theme: 'dark',
    fontSize: 26,
    freshnessLimitHours: 36,
    hideOlderThanHours: 60,
    weatherFreshnessLimit: 4,
    strictFreshness: true,
    filteringMode: 'source',
    rankingMode: 'smart',
    storyDeduplication: {
        similarityThreshold: 0.82,
        secondarySimilarityThreshold: 0.58,
        tokenOverlapThreshold: 0.5,
        strongTokenOverlapThreshold: 0.52,
        minimumSharedTokens: 3,
        strongSharedTokens: 4,
        maxFingerprintTokens: 8,
        ignoredTokens: ['a','an','and','are','at','be','between','by','for','from','how','in','into','is','it','of','on','or','the','this','that','to','was','were','with','who','why','will','alert','analysis','breaking','coverage','details','exclusive','explainer','headline','highlights','latest','live','news','photos','preview','prediction','predictions','report','reports','story','today','todays','update','updates','video','watch','expected','likely','lineup','lineups','match','playing','win','winner','winners','xis','xi']
    },
    rankingWeights: { temporal: { weekendBoost: 2.0, entertainmentBoost: 2.5 }, geo: { cityMatch: 1.5, maxScore: 5.0 }, freshness: { decayHours: 26, maxBoost: 3.0 }, impact: { boost: 1.0, highImpactBoost: 2.5 }, visual: { videoBoost: 1.3, imageBoost: 1.15 }, sentiment: { positiveBoost: 0.5, negativeBoost: 0.3 }, keyword: { matchBoost: 2.0 }, source: { tier1Boost: 0.25, tier2Boost: 0.15, tier3Boost: 0.0 }, viewedPenalty: 0.4, trending: { threshold: 12.0 }, audit: { consensusThreshold: 2, anomalySigma: 2.0 } },
    buzzRankingWeights: { visual: { videoBoost: 2.0, imageBoost: 1.5 }, freshness: { decayHours: 12, maxBoost: 2.0 }, trending: { threshold: 10.0 } },
    buzz: {
        entertainment: { enabled: true, positiveKeywords: ['tamil','kollywood','hindi','bollywood','hollywood','ott','netflix','prime video','disney','hotstar'], positiveMultiplier: 2.0, negativeKeywords: ['gossip','rumour','dating','spotted'], negativeMultiplier: 2.0, filterThreshold: 0 },
        technology: { enabled: true, positiveKeywords: ['startup','ai','artificial intelligence','innovation','funding','launch','generative ai','llm'], positiveMultiplier: 2.0, negativeKeywords: ['rumour','leak','speculation'], negativeMultiplier: 2.0, filterThreshold: 0 },
        sports: { enabled: true, positiveKeywords: ['cricket','football','ipl','world cup','india vs','final','highlights'], positiveMultiplier: 2.0, negativeKeywords: ['opinion','blog'], negativeMultiplier: 2.0, filterThreshold: 0 }
    },
    weather: { ...DEFAULT_WEATHER_SETTINGS, models: { ecmwf: true, gfs: true, icon: true }, cities: ['chennai', 'trichy', 'muscat'], showHumidity: true, showWind: false },
    sections: { world: { enabled: true, count: 5 }, india: { enabled: true, count: 5 }, chennai: { enabled: true, count: 5 }, trichy: { enabled: true, count: 5 }, local: { enabled: true, count: 5 }, social: { enabled: true, count: 25 }, entertainment: { enabled: true, count: 5 }, business: { enabled: true, count: 5 }, technology: { enabled: true, count: 5 }, sports: { enabled: true, count: 5 } },
    newsSources: { bbc: true, reuters: true, ndtv: true, theHindu: true, toi: true, financialExpress: true, dtNext: true, omanObserver: true, moneyControl: true, variety: true, hollywoodReporter: true, bollywoodHungama: true, filmCompanion: true, indiaToday: true, timesOfOman: true },
    market: DEFAULT_MARKET_SETTINGS,
    sources: {
        enabled: [
            'ndtv', 'indianexpress', 'thehindu', 'news18',
            'moneycontrol', 'livemint', 'economictimes',
            'techcrunch', 'verge', 'wired',
            'espncricinfo', 'sportskeeda'
        ],
        customRssUrls: [],
        autoRefreshInterval: 30, // minutes
        backgroundSync: true
    },
    feedBlockedKeywords: [],
    highImpactKeywords: ['Budget', 'Election', 'Summit', 'Treaty', 'War', 'Crash', 'Landfall', 'Verdict', 'Resigns', 'Assassination'],
    upAhead: DEFAULT_UPAHEAD_SETTINGS,
    sectionOverrides: {},
    newspaper: DEFAULT_NEWSPAPER_SETTINGS,
    enableNewScoring: DEFAULT_NEWS_SETTINGS.enableNewScoring,
    enableProximityScoring: DEFAULT_NEWS_SETTINGS.enableProximityScoring,
    maxTopicPercent: DEFAULT_NEWS_SETTINGS.maxTopicPercent,
    maxGeoPercent: DEFAULT_NEWS_SETTINGS.maxGeoPercent,
    followedTopics: [],
    readingHistory: [],
    topicSuggestions: DEFAULT_NEWS_SETTINGS.topicSuggestions,
    enableCache: DEFAULT_NEWS_SETTINGS.enableCache,
    crawlerMode: DEFAULT_NEWS_SETTINGS.crawlerMode,
    debugLogs: false,
    showDebugConsole: true,
    lastUpdated: 0
};

export function getSettings() {
    let defaultFontSize = DEFAULT_SETTINGS.fontSize;
    if (typeof window !== 'undefined') {
        defaultFontSize = (window.innerWidth >= 1024 && !isDevMobileViewForced()) ? 18 : 26;
    }
    const dynamicDefaults = { ...DEFAULT_SETTINGS, fontSize: defaultFontSize };
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (stored) {
            const parsed = JSON.parse(stored);
            const migrated = migrateSettings(parsed);
            return deepMerge(dynamicDefaults, migrated);
        }
    } catch (error) {
        console.error('Error reading settings:', error);
    }
    return { ...dynamicDefaults };
}

export function saveSettings(settings) {
    try {
        const settingsToSave = { ...settings, lastUpdated: Date.now() };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settingsToSave));
        if (!isStaticHostRuntime()) {
            saveSettingsToApi(settingsToSave);
        }
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

async function saveSettingsToApi(settings) {
    if (isStaticHostRuntime()) return false;
    try {
        const response = await fetch(`${API_BASE}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
        if (!response.ok) {
            console.warn('Failed to save settings to API');
        }
        return response.ok;
    } catch (e) {
        console.warn('API save error:', e);
        return false;
    }
}

export async function fetchSettingsFromApi() {
    if (isStaticHostRuntime()) return null;
    try {
        const response = await fetch(`${API_BASE}/settings`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn('API fetch error:', e);
        return null;
    }
}

export function updateSetting(path, value) {
    const settings = getSettings();
    const keys = path.split('.');
    let obj = settings;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    return saveSettings(settings);
}

export function resetSettings() { return saveSettings(DEFAULT_SETTINGS); }

export function getLastRefresh(section) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LAST_REFRESH);
        if (stored) {
            const timestamps = JSON.parse(stored);
            if (timestamps[section]) {
                return new Date(timestamps[section]);
            }
        }
    } catch (error) {
        console.error('Error reading last refresh:', error);
    }
    return null;
}

export function setLastRefresh(section) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LAST_REFRESH);
        const timestamps = stored ? JSON.parse(stored) : {};
        timestamps[section] = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.LAST_REFRESH, JSON.stringify(timestamps));
    } catch (error) {
        console.error('Error setting last refresh:', error);
    }
}

export function getTimeSinceRefresh(section = null) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LAST_REFRESH);
        if (!stored) return 'Never';
        const timestamps = JSON.parse(stored);
        let lastTime = null;
        if (section && timestamps[section]) {
            lastTime = new Date(timestamps[section]);
        } else {
            const times = Object.values(timestamps).map(t => new Date(t).getTime());
            if (times.length > 0) lastTime = new Date(Math.max(...times));
        }
        if (!lastTime) return 'Never';
        const now = new Date();
        const diffMs = now - lastTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return lastTime.toLocaleDateString();
    } catch {
        return 'Unknown';
    }
}

export function cacheData(section, data) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CACHED_DATA);
        const cache = stored ? JSON.parse(stored) : {};
        cache[section] = { data, timestamp: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEYS.CACHED_DATA, JSON.stringify(cache));
    } catch (error) {
        console.error('Error caching data:', error);
    }
}

export function getCachedData(section, maxAgeMs = 30 * 60 * 1000) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CACHED_DATA);
        if (!stored) return null;
        const cache = JSON.parse(stored);
        if (!cache[section]) return null;
        const age = new Date() - new Date(cache[section].timestamp);
        if (age > maxAgeMs) return null;
        return cache[section].data;
    } catch (error) {
        console.error('Error reading cache:', error);
        return null;
    }
}

export function clearCache() {
    try {
        localStorage.removeItem(STORAGE_KEYS.CACHED_DATA);
        localStorage.removeItem(STORAGE_KEYS.LAST_REFRESH);
    } catch (error) {
        console.error('Error clearing cache:', error);
    }
}

function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        const val = source[key];
        if (val === null || val === undefined) continue;
        if (typeof val === 'object' && !Array.isArray(val)) {
            result[key] = deepMerge(target[key] || {}, val);
        } else {
            result[key] = val;
        }
    }
    return result;
}

export function addFollowedTopic(topic) {
    const settings = getSettings();
    settings.followedTopics = settings.followedTopics || [];
    settings.followedTopics.push({ ...topic, id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, created: new Date().toISOString(), lastFetched: null });
    saveSettings(settings);
}

export function removeFollowedTopic(topicId) {
    const settings = getSettings();
    settings.followedTopics = settings.followedTopics.filter(t => t.id !== topicId);
    saveSettings(settings);
}

export function updateTopicLastFetched(topicId) {
    const settings = getSettings();
    const topic = settings.followedTopics.find(t => t.id === topicId);
    if (topic) {
        topic.lastFetched = new Date().toISOString();
        saveSettings(settings);
    }
}

export function incrementViewCount(articleIds) {
    if (!articleIds || articleIds.length === 0) return;
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.ARTICLE_VIEWS);
        const views = stored ? JSON.parse(stored) : {};
        articleIds.forEach(id => { views[id] = (views[id] || 0) + 1; });
        localStorage.setItem(STORAGE_KEYS.ARTICLE_VIEWS, JSON.stringify(views));
    } catch (e) {
        console.error('[Storage] Error incrementing views', e);
    }
}

export function getViewCount(articleId) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.ARTICLE_VIEWS);
        const views = stored ? JSON.parse(stored) : {};
        return views[articleId] || 0;
    } catch {
        return 0;
    }
}

export function isArticleRead(articleId) {
    const settings = getSettings();
    return settings.readingHistory?.some(h => h.id === articleId) || false;
}

export function addReadArticle(article) {
    if (!article || !article.title) return;
    const settings = getSettings();
    const history = settings.readingHistory || [];
    if (history.some(h => h.id === article.id)) return;
    history.unshift({ id: article.id, title: article.title, description: article.description || '', timestamp: Date.now() });
    if (history.length > 50) history.length = 50;
    settings.readingHistory = history;
    saveSettings(settings);
}

export function getSuggestedTopics() {
    const settings = getSettings();
    const history = settings.readingHistory || [];
    if (history.length === 0) return [];
    const text = history.map(h => `${h.title} ${h.description}`).join(' ').toLowerCase();
    const stopWords = ['the', 'and', 'in', 'of', 'to', 'a', 'is', 'for', 'on', 'with', 'at', 'from', 'by', 'an', 'be', 'as', 'it', 'has', 'that', 'are', 'was', 'will', 'says', 'said', 'after', 'over', 'new', 'more', 'about', 'can', 'top', 'best', 'india', 'news', 'update', 'latest', 'today', 'live'];
    const words = text.match(/\b[a-z]{4,}\b/g) || [];
    const counts = {};
    words.forEach(w => { if (!stopWords.includes(w)) counts[w] = (counts[w] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word, count]) => ({ word: word.charAt(0).toUpperCase() + word.slice(1), count }));
}