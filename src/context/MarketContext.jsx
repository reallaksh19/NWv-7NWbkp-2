import { getIdbCache, setIdbCache } from '../services/indexedDbCache.js';
import React, { createContext, useContext, useState, useCallback } from 'react';
import { fetchAllMarketData, MARKET_SEED } from '../services/indianMarketStableService';
import {
    MARKET_CONTEXT_CACHE_KEY,
    MARKET_CACHE_SCHEMA_VERSION,
    MARKET_FRESH_CACHE_TTL_MS,
    shouldRejectMarketPayload,
    markMarketPayload
} from '../services/marketTrust';

const MarketContext = createContext(null);
/* eslint-disable react-refresh/only-export-components */

const CACHE_KEY = MARKET_CONTEXT_CACHE_KEY;
const CACHE_DURATION = MARKET_FRESH_CACHE_TTL_MS;

function publicDataUrl(path) {
    const base = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/');
    return `${base}${String(path).replace(/^\//, '')}`;
}

function hasUsableMarketData(data) {
    const rejection = shouldRejectMarketPayload(data, {
        allowSeed: true
    });

    return !rejection.reject;
}

export function MarketProvider({ children }) {
    const [marketData, setMarketData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastFetch, setLastFetch] = useState(null);
    const [booted, setBooted] = useState(false);

    const loadMarketData = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) {
            try {
                const parsed = await getIdbCache(CACHE_KEY);
                if (
                    parsed &&
                    parsed.schemaVersion === MARKET_CACHE_SCHEMA_VERSION &&
                    hasUsableMarketData(parsed)
                ) {
                    if (Date.now() - parsed.fetchedAt < CACHE_DURATION) {
                        console.log('[MarketContext] Using cached data');
                        setMarketData(parsed);
                        setLoading(false);
                        setLastFetch(parsed.fetchedAt);
                        return;
                    }
                }
            } catch {
                console.warn('[MarketContext] Cache read failed');
            }
        }

        setLoading(true);
        setError(null);

        try {
            const data = await fetchAllMarketData();
            if (!hasUsableMarketData(data)) {
                throw new Error('Market data unavailable: live, cache, and static snapshot returned no displayable rows.');
            }

            const normalized = markMarketPayload(
                data,
                data.sourceMode || 'live',
                {
                    sourceHealth: data.sourceHealth || {
                        market: {
                            status: data.sourceMode || 'live',
                            provider: data.sourceMode || 'live',
                            mode: data.sourceMode || 'live'
                        }
                    }
                }
            );

            const reject = shouldRejectMarketPayload(normalized, {
                allowSeed: true
            });

            if (reject.reject) {
                throw new Error(reject.reason);
            }

            setMarketData(normalized);
            setLastFetch(normalized.fetchedAt || Date.now());

            if (normalized.sourceMode !== 'seed') {
                await setIdbCache(CACHE_KEY, normalized);
            }

            if (normalized.sourceMode === 'seed') {
                setError('Live market feed unavailable. Showing bundled Indian market seed.');
            }
            console.log('[MarketContext] ✅ Market data loaded');
        } catch (err) {
            console.error('[MarketContext] ❌ Failed to load market data:', err);

            try {
                const parsed = await getIdbCache(CACHE_KEY);
                if (
                    parsed &&
                    parsed.schemaVersion === MARKET_CACHE_SCHEMA_VERSION &&
                    hasUsableMarketData(parsed)
                ) {
                    const age = Date.now() - parsed.fetchedAt;
                    console.log(`[MarketContext] Using stale cache due to fetch error (Age: ${(age/60000).toFixed(0)}m)`);
                    setMarketData(parsed);
                    setLastFetch(parsed.fetchedAt);
                    setError(age > 4 * 60 * 60 * 1000 ? 'Network error. Data is expired (>4h).' : 'Network error. Showing cached data.');
                } else {
                    try {
                        const resp = await fetch(publicDataUrl('data/market_snapshot.json'), { cache: 'no-cache' });
                        if (resp.ok) {
                            const snapshot = await resp.json();
                            const normalizedSnapshot = markMarketPayload(snapshot, 'snapshot', {
                                sourceHealth: {
                                    snapshot: {
                                        status: 'snapshot',
                                        provider: 'market_snapshot.json',
                                        mode: 'snapshot'
                                    }
                                }
                            });

                            if (hasUsableMarketData(normalizedSnapshot)) {
                                console.log('[MarketContext] Using static snapshot fallback');
                                setMarketData(normalizedSnapshot);
                                setLastFetch(normalizedSnapshot.fetchedAt || Date.now());
                                setError('Using offline snapshot. Live data failed.');
                                return;
                            }
                        }
                    } catch (staticErr) {
                        console.warn('Static fallback failed', staticErr);
                    }

                    const seed = { ...MARKET_SEED, fetchedAt: Date.now(), generatedAt: new Date().toISOString(), sourceMode: 'seed' };
                    setMarketData(seed);
                    setLastFetch(seed.fetchedAt);
                    setError('Live market feed and snapshot unavailable. Showing bundled Indian market seed.');
                }
            } catch {
                const seed = { ...MARKET_SEED, fetchedAt: Date.now(), generatedAt: new Date().toISOString(), sourceMode: 'seed' };
                setMarketData(seed);
                setLastFetch(seed.fetchedAt);
                setError('Live market feed and snapshot unavailable. Showing bundled Indian market seed.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const ensureBoot = useCallback(() => {
        if (!booted) {
            setBooted(true);
            loadMarketData();
        }
    }, [booted, loadMarketData]);

    const refreshMarket = useCallback(() => {
        return loadMarketData(true);
    }, [loadMarketData]);

    return (
        <MarketContext.Provider value={{
            marketData,
            loading: booted ? loading : true,
            error,
            lastFetch,
            refreshMarket,
            ensureBoot,
            booted
        }}>
            {children}
        </MarketContext.Provider>
    );
}

export function useMarket() {
    const context = useContext(MarketContext);
    if (!context) {
        throw new Error('useMarket must be used within MarketProvider');
    }
    return context;
}
