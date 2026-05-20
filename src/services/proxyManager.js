/**
 * Proxy Manager - Handles failover between multiple RSS proxies
 * Hardened for static hosting: cooldowns, in-memory caching, and dead-proxy suppression
 */
import logStore from '../utils/logStore.js';

function parseXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('XML Parsing Error');
    }

    const feedTitle = xmlDoc.querySelector('channel > title')?.textContent || 'Unknown Source';

    const items = Array.from(xmlDoc.querySelectorAll('item')).map(node => {
        const title = node.querySelector('title')?.textContent;
        const link = node.querySelector('link')?.textContent;
        const pubDate = node.querySelector('pubDate')?.textContent;
        const description = node.querySelector('description')?.textContent;
        const guid = node.querySelector('guid')?.textContent;
        const author = node.querySelector('author')?.textContent || node.querySelector('dc\\:creator')?.textContent;
        const enclosureNode = node.querySelector('enclosure');
        const enclosure = enclosureNode ? {
            url: enclosureNode.getAttribute('url'),
            type: enclosureNode.getAttribute('type')
        } : null;
        const mediaContentNode = node.querySelector('media\\:content') || node.querySelector('content');
        const mediaContent = mediaContentNode ? { url: mediaContentNode.getAttribute('url') } : null;
        const mediaThumbnailNode = node.querySelector('media\\:thumbnail') || node.querySelector('thumbnail');
        const thumbnail = mediaThumbnailNode ? mediaThumbnailNode.getAttribute('url') : null;

        return {
            title,
            link,
            pubDate,
            description,
            guid,
            author,
            enclosure,
            'media:content': mediaContent,
            thumbnail
        };
    });

    return { title: feedTitle, items };
}

const PROXIES = [
    {
        name: 'allorigins',
        format: (feedUrl) => `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`,
        parse: async (response) => {
            const text = await response.text();
            if (!text) throw new Error('Empty response from allorigins');
            return parseXML(text);
        }
    },
    {
        name: 'corsproxy',
        format: (feedUrl) => `https://corsproxy.io/?${encodeURIComponent(feedUrl)}`,
        parse: async (response) => {
            const text = await response.text();
            if (!text) throw new Error('Empty response from corsproxy');
            return parseXML(text);
        }
    },
    {
        name: 'codetabs',
        format: (feedUrl) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(feedUrl)}`,
        parse: async (response) => {
            const text = await response.text();
            if (!text) throw new Error('Empty response from codetabs');
            return parseXML(text);
        }
    },
    {
        name: 'rss2json',
        format: (feedUrl) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`,
        parse: async (response) => {
            const data = await response.json();
            if (data.status === 'ok') {
                return { title: data.feed?.title, items: data.items || [] };
            }
            throw new Error('rss2json status not ok');
        }
    }
];

const SUCCESS_CACHE_TTL_MS = 10 * 60 * 1000;
const SHORT_COOLDOWN_MS = 5 * 60 * 1000;
const LONG_COOLDOWN_MS = 60 * 60 * 1000;

function now() {
    return Date.now();
}

function isLikelyCorsError(message = '') {
    const lower = String(message || '').toLowerCase();
    return lower.includes('cors') || lower.includes('failed to fetch') || lower.includes('networkerror');
}

function isRateLimitError(message = '') {
    return String(message || '').includes('429');
}

class ProxyManager {
    constructor() {
        this.currentIndex = 0;
        this.failureCounts = new Map();
        this.lastSuccess = new Map();
        this.cooldownUntil = new Map();
        this.responseCache = new Map();
    }

    getCached(feedUrl) {
        const cached = this.responseCache.get(feedUrl);
        if (!cached) return null;
        if ((now() - cached.timestamp) > SUCCESS_CACHE_TTL_MS) {
            this.responseCache.delete(feedUrl);
            return null;
        }
        return cached.result;
    }

    setCached(feedUrl, result) {
        this.responseCache.set(feedUrl, { result, timestamp: now() });
    }

    isProxyCoolingDown(proxyName) {
        const until = this.cooldownUntil.get(proxyName) || 0;
        return until > now();
    }

    setCooldown(proxyName, errorMessage) {
        const duration = isRateLimitError(errorMessage)
            ? SHORT_COOLDOWN_MS
            : (isLikelyCorsError(errorMessage) ? LONG_COOLDOWN_MS : SHORT_COOLDOWN_MS);
        this.cooldownUntil.set(proxyName, now() + duration);
    }

    async fetchViaProxy(feedUrl) {
        const cached = this.getCached(feedUrl);
        if (cached) {
            return cached;
        }

        const availableProxies = PROXIES.filter(proxy => !this.isProxyCoolingDown(proxy.name));
        const proxiesToTry = availableProxies.length > 0 ? availableProxies : PROXIES;
        let lastError = null;

        for (let i = 0; i < proxiesToTry.length; i++) {
            const index = (this.currentIndex + i) % proxiesToTry.length;
            const proxy = proxiesToTry[index];

            try {
                const proxyUrl = proxy.format(feedUrl);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                let response;
                try {
                    response = await fetch(proxyUrl, {
                        signal: controller.signal,
                        cache: 'no-store'
                    });
                } finally {
                    clearTimeout(timeoutId);
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await proxy.parse(response);
                if (!result || !Array.isArray(result.items) || result.items.length === 0) {
                    throw new Error('No items returned');
                }

                this.failureCounts.set(proxy.name, 0);
                this.lastSuccess.set(proxy.name, now());
                this.cooldownUntil.delete(proxy.name);
                this.currentIndex = index;
                this.setCached(feedUrl, result);
                logStore.info('proxy', `${proxy.name} OK (${result.items.length} items)`);
                return result;
            } catch (error) {
                const message = error?.message || 'unknown';
                lastError = error;
                this.failureCounts.set(proxy.name, (this.failureCounts.get(proxy.name) || 0) + 1);
                this.setCooldown(proxy.name, message);
                console.warn(`[ProxyManager] ${proxy.name} failed for ${feedUrl}:`, message);
            }
        }

        if (cached) {
            return cached;
        }

        logStore.error('proxy', `All proxies failed: ${lastError?.message}`);
        throw new Error(`All proxies failed. Last error: ${lastError?.message || 'unknown'}`);
    }

    getProxyHealth() {
        return PROXIES.map(proxy => ({
            name: proxy.name,
            failures: this.failureCounts.get(proxy.name) || 0,
            lastSuccess: this.lastSuccess.get(proxy.name) || null,
            coolingDown: this.isProxyCoolingDown(proxy.name)
        }));
    }
}

export const proxyManager = new ProxyManager();
