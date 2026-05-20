import { getIdbCache, setIdbCache } from './indexedDbCache.js';
/* eslint-disable */
import { proxyManager } from "./proxyManager.js";
import { getSettings } from '../utils/storage.js';
import { getRuntimeCapabilities } from "../runtime/runtimeCapabilities.js";

const INDICES = { nifty50: '^NSEI', sensex: '^BSESN', niftyBank: '^NSEBANK', niftyIT: '^CNXIT', niftyMidcap: 'NIFTYMIDCAP150.NS', niftyPharma: '^CNXPHARMA', niftyAuto: '^CNXAUTO', sp500: '^GSPC', nasdaq: '^IXIC', dow: '^DJI', nikkei225: '^N225', hangSeng: '^HSI', ftse100: '^FTSE' };
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url) => `https://crossorigin.me/${url}`,
    (url) => `https://cors-anywhere.herokuapp.com/${url}`
];
const CACHE_KEY = 'indian_market_data';
const CACHE_TTL = 30 * 60 * 1000; // 30 min — matches market_refresh.yml workflow cadence
const MARKET_SNAPSHOT_API = '/api/market_snapshot';

function isStaticHostRuntime() { return getRuntimeCapabilities().isStaticHost; }



async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

const proxyHealth = new Map();
const FAILURE_THRESHOLD = 3;
const COOL_OFF_PERIOD = 5 * 60 * 1000;

function getProxyBaseDomain(proxyGenStr) {
    try {
        const match = proxyGenStr.match(/https?:\/\/([^/]+)/);
        return match ? match[1] : proxyGenStr;
    } catch {
        return proxyGenStr;
    }
}

async function fetchThroughProxies(url, parser = 'json', timeoutMs = 10000) {
    // Dynamically prioritize proxies based on tracked health and historical latency
    const sortedProxies = [...PROXIES].sort((a, b) => {
        const domainA = getProxyBaseDomain(a.toString());
        const domainB = getProxyBaseDomain(b.toString());
        const healthA = proxyHealth.get(domainA) || { failures: 0, latency: 99999 };
        const healthB = proxyHealth.get(domainB) || { failures: 0, latency: 99999 };

        // Prioritize proxies with fewer failures
        if (healthA.failures !== healthB.failures) {
            return healthA.failures - healthB.failures;
        }

        // Tie-breaker: prioritize proxies with lower historical latency
        return healthA.latency - healthB.latency;
    });

    for (const proxyGen of sortedProxies) {
        const proxyDomain = getProxyBaseDomain(proxyGen.toString());
        const health = proxyHealth.get(proxyDomain) || { failures: 0, lastFailure: 0, latency: 99999 };

        if (health.failures >= FAILURE_THRESHOLD) {
            if (Date.now() - health.lastFailure < COOL_OFF_PERIOD) {
                console.warn(`[MarketService] Skipping proxy ${proxyDomain} due to circuit breaker`);
                continue;
            } else {
                // Reset after cool-off period
                health.failures = 0;
                proxyHealth.set(proxyDomain, health);
            }
        }

        try {
            const start = Date.now();
            let response = await fetchWithTimeout(proxyGen(url), {}, timeoutMs);

            // Exponential backoff retry logic for transient errors (like Rate Limit)
            let retries = 0;
            const MAX_RETRIES = 2;
            while ((response.status === 429 || response.status === 503 || response.status >= 520) && retries < MAX_RETRIES) {
                retries++;
                const delay = Math.pow(2, retries) * 500; // 1s, 2s
                console.warn(`[MarketService] Proxy ${proxyDomain} returned ${response.status}. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                response = await fetchWithTimeout(proxyGen(url), {}, timeoutMs);
            }

            const latency = Date.now() - start;

            if (!response.ok) {
                health.failures += 1;
                health.lastFailure = Date.now();
                proxyHealth.set(proxyDomain, health);
                continue;
            }

            // Success logic: reset failures and calculate EMA for latency
            health.failures = 0;
            health.latency = health.latency && health.latency !== 99999 ? (health.latency * 0.8) + (latency * 0.2) : latency;
            proxyHealth.set(proxyDomain, health);
            return parser === 'text' ? await response.text() : await response.json();
        } catch (e) {
            console.warn(`[MarketService] Proxy ${proxyDomain} failed: ${e.message}`);
            health.failures += 1;
            health.lastFailure = Date.now();
            proxyHealth.set(proxyDomain, health);
        }
    }
    throw new Error(`Failed to fetch ${url}`);
}

async function fetchYahooData(symbol, { range = '1d', interval = '1d' } = {}) {
    return fetchThroughProxies(`${YAHOO_BASE}${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`, 'json');
}

function parseYahooSeries(data) {
    const result = data.chart?.result?.[0] || data.finance?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const opens = result?.indicators?.quote?.[0]?.open || [];
    const highs = result?.indicators?.quote?.[0]?.high || [];
    const lows = result?.indicators?.quote?.[0]?.low || [];
    return timestamps.map((timestamp, index) => {
        const close = closes[index];
        if (close == null) return null;
        return { timestamp: timestamp * 1000, close, open: opens[index] ?? close, high: highs[index] ?? close, low: lows[index] ?? close };
    }).filter(Boolean);
}

function extractYahooPrice(data) {
    const result = data.chart?.result?.[0] || data.finance?.result?.[0];
    if (!result || !result.meta) return null;
    const quote = result.meta;
    const currentPrice = quote.regularMarketPrice;
    const prevClose = quote.chartPreviousClose || quote.previousClose;
    const change = currentPrice - prevClose;
    const changePercent = prevClose ? ((change / prevClose) * 100) : 0;
    const timestamp = quote.regularMarketTime ? quote.regularMarketTime * 1000 : Date.now();
    return { price: currentPrice, change, changePercent: changePercent.toFixed(2), timestamp };
}

export async function fetchIndices() {
    const promises = Object.entries(INDICES).map(async ([name, symbol]) => {
        try {
            const data = await fetchYahooData(symbol, { range: '5d', interval: '1d' });
            const priceData = extractYahooPrice(data);
            const series = parseYahooSeries(data);
            if (!priceData) return null;
            const labels = { nifty50: 'NIFTY 50', sensex: 'SENSEX', niftyBank: 'BANK NIFTY', niftyIT: 'NIFTY IT', niftyMidcap: 'MIDCAP 150', niftyPharma: 'NIFTY PHARMA', niftyAuto: 'NIFTY AUTO', sp500: 'S&P 500', nasdaq: 'NASDAQ', dow: 'DOW', nikkei225: 'NIKKEI 225', hangSeng: 'HANG SENG', ftse100: 'FTSE 100' };
            return { name: labels[name] || 'MARKET', symbol, value: priceData.price.toLocaleString('en-IN'), change: priceData.change.toFixed(2), changePercent: priceData.changePercent, direction: priceData.change >= 0 ? 'up' : 'down', currency: '₹', timestamp: priceData.timestamp, history: series.map((point) => point.close), series, dayOpen: series[0]?.open ?? priceData.price, dayHigh: series.length ? Math.max(...series.map((point) => Number(point.high || point.close))) : priceData.price, dayLow: series.length ? Math.min(...series.map((point) => Number(point.low || point.close))) : priceData.price };
        } catch { return null; }
    });
    const results = (await Promise.all(promises)).filter(Boolean);
    return results;
}

const MF_API = 'https://api.mfapi.in/mf/';
const POPULAR_MF_SCHEMES = [{ code: '119551', name: 'SBI Bluechip Fund' }, { code: '120503', name: 'HDFC Mid-Cap Opportunities' }, { code: '118834', name: 'ICICI Prudential Value Discovery' }, { code: '122639', name: 'Axis Long Term Equity Fund' }, { code: '125354', name: 'Mirae Asset Large Cap Fund' }, { code: '118989', name: 'Kotak Emerging Equity Fund' }];
const FUND_TYPE_LABELS = { 'large-cap': 'Large Cap', 'mid-cap': 'Mid Cap', 'flexi-cap': 'Flexi Cap', value: 'Value', elss: 'ELSS' };
function classifyMutualFundType(name = '', category = '') { const text = `${name} ${category}`.toLowerCase(); if (/(elss|tax saver|long term equity)/.test(text)) return 'elss'; if (/(value|contra|dividend yield)/.test(text)) return 'value'; if (/(mid[- ]?cap|midcap|emerging|small[- ]?cap)/.test(text)) return 'mid-cap'; if (/(large[- ]?cap|bluechip|index)/.test(text)) return 'large-cap'; return 'flexi-cap'; }
function enrichMutualFundRecord(record, fallbackName) { const fundType = classifyMutualFundType(record?.name || fallbackName, record?.category); return { ...record, fundType, fundTypeLabel: FUND_TYPE_LABELS[fundType] || 'Flexi Cap' }; }
async function fetchAmfiNavFeed() { return fetchThroughProxies('https://portal.amfiindia.com/spages/NAVAll.txt', 'text'); }
function parseAmfiNavFeed(text) { const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean); const parsed = []; for (const scheme of POPULAR_MF_SCHEMES) { const match = lines.find((line) => line.toLowerCase().includes(scheme.name.toLowerCase())); if (!match) continue; const parts = match.split(';').map((part) => part.trim()).filter(Boolean); const numericCandidates = parts.map((part) => Number(String(part).replace(/,/g, ''))).filter((value) => Number.isFinite(value)); const navCandidate = numericCandidates[numericCandidates.length - 1]; const dateMatch = match.match(/(\d{2}-[A-Za-z]{3}-\d{4})/); const navDate = dateMatch ? dateMatch[1] : ''; if (Number.isFinite(navCandidate)) parsed.push({ code: scheme.code, name: scheme.name, category: 'Equity', fundHouse: 'AMFI', nav: navCandidate.toFixed(2), navDate, change: '0.00', changePercent: '0.00', direction: 'up', source: 'amfi', ...enrichMutualFundRecord({ name: scheme.name, category: 'Equity' }, scheme.name) }); } return parsed; }
export async function fetchMutualFunds() {
    try { const parsed = parseAmfiNavFeed(await fetchAmfiNavFeed()); if (parsed.length > 0) return parsed; } catch {}
    const results = await Promise.allSettled(POPULAR_MF_SCHEMES.map(async (scheme) => {
        const response = await fetch(`${MF_API}${scheme.code}`); const data = await response.json(); if (!data.data || data.data.length === 0) throw new Error('No NAV data');
        const latestNAV = parseFloat(data.data[0].nav); const prevNAV = data.data.length > 1 ? parseFloat(data.data[1].nav) : latestNAV; const change = latestNAV - prevNAV; const changePercent = ((change / prevNAV) * 100).toFixed(2);
        return { code: scheme.code, name: data.meta?.scheme_name || scheme.name, category: data.meta?.scheme_category || 'Equity', fundHouse: data.meta?.fund_house || 'Unknown', nav: latestNAV.toFixed(2), navDate: data.data[0].date, change: change.toFixed(2), changePercent, direction: change >= 0 ? 'up' : 'down', source: 'mfapi', ...enrichMutualFundRecord({ name: data.meta?.scheme_name || scheme.name, category: data.meta?.scheme_category || 'Equity' }, scheme.name) };
    }));
    return results.filter(r => r.status === 'fulfilled').map(r => r.value);
}

export async function fetchIPOData() {
  // Try static snapshot first
  const snapshot = await fetchStaticSnapshot();
  if (snapshot?.ipo?.upcoming?.length || snapshot?.ipo?.live?.length) {
    return snapshot.ipo;
  }

  // Fallback: Google News RSS for IPO headlines
  // NOTE: Use proxyManager.fetchViaProxy (XML path), NOT fetchThroughProxies (JSON path)
  try {
    const rssUrl  = 'https://news.google.com/rss/search?q=India+IPO+GMP+subscription+2025&hl=en-IN&gl=IN&ceid=IN:en';
    const rssResult = await proxyManager.fetchViaProxy(rssUrl);
    const items   = (rssResult?.items || []).slice(0, 10);
    // rssResult.items is already parsed by proxyManager.fetchViaProxy — no XML re-parse needed

    const parseGMP = (title = '') => {
      // Extract GMP pattern: e.g. "GMP ₹45" or "GMP +45"
      const m = title.match(/GMP[:\s]+[₹+]?([\d.]+)/i);
      return m ? `₹${m[1]}` : null;
    };

    const parseSub = (title = '') => {
      // Extract subscription: e.g. "subscribed 12.5x" or "12.5 times"
      const m = title.match(/([\d.]+)\s*[xX×]|([\d.]+)\s*times/i);
      return m ? `${m[1] || m[2]}x subscribed` : null;
    };

    const upcoming = items
      .filter(i => /open|upcoming|launch/i.test(i.title || ''))
      .map(i => ({
        name         : (i.title || '').trim(),
        gmp          : parseGMP(i.title),
        subscription : parseSub(i.title),
        date         : i.pubDate || '',
        url          : i.link || '',
      }));

    const live = items
      .filter(i => /live|close|allotment/i.test(i.title || ''))
      .map(i => ({
        name         : (i.title || '').trim(),
        gmp          : parseGMP(i.title),
        subscription : parseSub(i.title),
        date         : i.pubDate || '',
        url          : i.link || '',
      }));

    return { upcoming, live, recent: [] };
  } catch {
    return { upcoming: [], live: [], recent: [] };
  }
}

/**
 * fetchNFOData — New Fund Offers from Google News RSS.
 * Returns array of { name, fundHouse, openDate, closeDate, category, url }
 * NOTE: Uses proxyManager.fetchViaProxy (XML path), NOT fetchThroughProxies (JSON path)
 */
export async function fetchNFOData() {
  const snapshot = await fetchStaticSnapshot();
  if (snapshot?.nfo?.length) return snapshot.nfo;

  try {
    const rssUrl = 'https://news.google.com/rss/search?q=NFO+new+fund+offer+mutual+fund+India+2025&hl=en-IN&gl=IN&ceid=IN:en';
    const rssResult = await proxyManager.fetchViaProxy(rssUrl);
    const items  = (rssResult?.items || []).slice(0, 8);
    return items.map(i => ({
      name      : (i.title || '').trim(),
      fundHouse : null,   // enrichable from title parsing if needed
      openDate  : i.pubDate || '',
      closeDate : null,
      category  : /equity/i.test(i.title || '') ? 'Equity' : 'Debt',
      url       : i.link || '',
    }));
  } catch {
    return [];
  }
}

/**
 * fetchStockCategories — 52-week highs/lows for major indices.
 * Returns { highs: [...], lows: [...] }
 */
export async function fetchStockCategories() {
  const snapshot = await fetchStaticSnapshot();
  if (snapshot?.stockCategories) return snapshot.stockCategories;

  // Fetch 52-week data for top indices as a proxy for market themes
  const SYMBOLS = [
    { symbol: '%5ENSEI',  name: 'NIFTY 50' },
    { symbol: '%5EBSESN', name: 'SENSEX' },
    { symbol: '%5ENSEBANK', name: 'BANK NIFTY' },
  ];
  const results = await Promise.allSettled(
    SYMBOLS.map(async ({ symbol, name }) => {
      const data  = await fetchYahooData(symbol, { range: '1y', interval: '1mo' });
      const meta  = data?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      return {
        name,
        high52w : meta.fiftyTwoWeekHigh?.toFixed(2) || null,
        low52w  : meta.fiftyTwoWeekLow?.toFixed(2)  || null,
        current : meta.regularMarketPrice?.toFixed(2) || null,
        nearHigh: meta.regularMarketPrice >= meta.fiftyTwoWeekHigh * 0.97,
        nearLow : meta.regularMarketPrice <= meta.fiftyTwoWeekLow  * 1.03,
      };
    })
  );
  const valid = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
  return {
    highs: valid.filter(v => v.nearHigh),
    lows : valid.filter(v => v.nearLow),
    all  : valid,
  };
}

const SCREENER_URL = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved/screener/new?scrIds=day_gainers&count=5';
const SCREENER_URL_LOSERS = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved/screener/new?scrIds=day_losers&count=5';
async function fetchScreenerData(url) {
    try {
        const data = await fetchThroughProxies(url, 'json');
        const results = data.finance?.result?.[0]?.quotes || [];
        return results.map(quote => ({ symbol: quote.symbol.replace('.NS', '').replace('.BO', ''), price: quote.regularMarketPrice?.toFixed(2) || '0.00', change: quote.regularMarketChange?.toFixed(2) || '0.00', changePercent: quote.regularMarketChangePercent?.toFixed(2) || '0.00', direction: (quote.regularMarketChange || 0) >= 0 ? 'up' : 'down', volume: quote.regularMarketVolume })).filter(q => q.symbol);
    } catch { return []; }
}

const TOP_STOCKS = ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS','HINDUNILVR.NS','SBIN.NS','BHARTIARTL.NS','ITC.NS','KOTAKBANK.NS','LT.NS','AXISBANK.NS','ASIANPAINT.NS','MARUTI.NS','BAJFINANCE.NS'];
async function fetchTopMoversFallback() {
    const quotes = await Promise.allSettled(TOP_STOCKS.map(async (symbol) => {
        const data = await fetchYahooData(symbol, { range: '5d', interval: '1d' }); const priceData = extractYahooPrice(data); if (!priceData) return null;
        return { symbol: symbol.replace('.NS', '').replace('.BO', ''), price: priceData.price.toFixed(2), change: priceData.change.toFixed(2), changePercent: priceData.changePercent, direction: priceData.change >= 0 ? 'up' : 'down', timestamp: priceData.timestamp };
    }));
    const valid = quotes.filter((item) => item.status === 'fulfilled' && item.value).map((item) => item.value);
    return { gainers: valid.filter((item) => item.direction === 'up').sort((a, b) => Number(b.changePercent) - Number(a.changePercent)).slice(0, 5), losers: valid.filter((item) => item.direction === 'down').sort((a, b) => Number(a.changePercent) - Number(b.changePercent)).slice(0, 5), source: 'yahoo-quote' };
}
export async function fetchTopMovers() {
    const [gainers, losers] = await Promise.all([fetchScreenerData(SCREENER_URL), fetchScreenerData(SCREENER_URL_LOSERS)]);
    if (gainers.length || losers.length) return { gainers: gainers.slice(0, 5), losers: losers.slice(0, 5), source: 'yahoo-screener' };
    const fallback = await fetchTopMoversFallback();
    if (fallback.gainers.length || fallback.losers.length) return fallback;
    // Last resort: read pre-fetched snapshot movers
    const snapshot = await fetchStaticSnapshot();
    if (snapshot?.movers?.gainers?.length || snapshot?.movers?.losers?.length) {
        return {
            gainers: (snapshot.movers.gainers || []).slice(0, 5),
            losers:  (snapshot.movers.losers  || []).slice(0, 5),
            source:  'snapshot',
        };
    }
    return { gainers: [], losers: [], source: 'empty' };
}
export async function fetchSectoralIndices() { const sectorals = [{ key: 'niftyBank', name: 'Bank Nifty', symbol: INDICES.niftyBank }, { key: 'niftyIT', name: 'Nifty IT', symbol: INDICES.niftyIT }, { key: 'niftyPharma', name: 'Nifty Pharma', symbol: INDICES.niftyPharma }, { key: 'niftyAuto', name: 'Nifty Auto', symbol: INDICES.niftyAuto }]; const results = await Promise.allSettled(sectorals.map(async (sector) => { const data = await fetchYahooData(sector.symbol, { range: '5d', interval: '1d' }); const priceData = extractYahooPrice(data); if (!priceData) throw new Error('No data'); return { name: sector.name, value: priceData.price.toFixed(2), change: priceData.change.toFixed(2), changePercent: priceData.changePercent, timestamp: priceData.timestamp }; })); return results.filter(r => r.status === 'fulfilled').map(r => r.value); }
export async function fetchStaticSnapshot() { try { const resp = await fetch('/data/market_snapshot.json'); if (resp.ok) return await resp.json(); } catch {} return null; }

export async function fetchCommodities() {
    const snapshot = await fetchStaticSnapshot();
    if (snapshot?.commodities?.length) return snapshot.commodities;

    // Fallback: fetch from Yahoo Finance via CORS proxy
    const COMMODITY_SYMBOLS = [
        { symbol: 'GC=F',  name: 'Gold',      unit: '$/oz' },
        { symbol: 'SI=F',  name: 'Silver',     unit: '$/oz' },
        { symbol: 'CL=F',  name: 'Crude Oil',  unit: '$/bbl' },
    ];
    const results = await Promise.allSettled(
        COMMODITY_SYMBOLS.map(async (c) => {
            const data = await fetchYahooData(c.symbol, { range: '5d', interval: '1d' });
            const price = extractYahooPrice(data);
            if (!price) return null;
            return {
                name: c.name,
                unit: c.unit,
                value: `$${price.price.toFixed(2)}`,
                changePercent: price.changePercent,
                direction: price.change >= 0 ? 'up' : 'down',
                source: 'yahoo'
            };
        })
    );
    return results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
}

export async function fetchCurrencyRates() {
    const snapshot = await fetchStaticSnapshot();
    if (snapshot?.currencies?.length) return snapshot.currencies;

    // Fallback: fetch INR pairs from Yahoo Finance via CORS proxy
    const FX_SYMBOLS = [
        { symbol: 'USDINR=X', name: 'USD/INR' },
        { symbol: 'EURINR=X', name: 'EUR/INR' },
        { symbol: 'GBPINR=X', name: 'GBP/INR' },
    ];
    const results = await Promise.allSettled(
        FX_SYMBOLS.map(async (fx) => {
            const data = await fetchYahooData(fx.symbol, { range: '5d', interval: '1d' });
            const price = extractYahooPrice(data);
            if (!price) return null;
            return {
                name: fx.name,
                value: `₹${price.price.toFixed(2)}`,
                changePercent: price.changePercent,
                direction: price.change >= 0 ? 'up' : 'down',
                source: 'yahoo'
            };
        })
    );
    return results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
}

export async function fetchFIIDII() {
    const snapshot = await fetchStaticSnapshot();
    if (
        snapshot?.fiidii &&
        (snapshot.fiidii.date ||
         Object.keys(snapshot.fiidii.fii || {}).length ||
         Object.keys(snapshot.fiidii.dii || {}).length)
    ) {
        return snapshot.fiidii;
    }
    return { fii: {}, dii: {}, date: '' };
}
async function saveMarketSnapshot(snapshot) { if (isStaticHostRuntime()) return false; try { const response = await fetch(MARKET_SNAPSHOT_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) }); return response.ok; } catch { return false; } }

export async function fetchAllMarketData() {
    if (isStaticHostRuntime()) {
        // 1. Try cache first
        try {
            const parsed = await getIdbCache(CACHE_KEY);
                if (parsed) {
                const age = Date.now() - (parsed.fetchedAt || 0);
                if (age < CACHE_TTL) return { ...parsed, isStale: true, staleReason: 'Static host cache' };
            }
        } catch {}

        // 2. Try live Yahoo via CORS proxies
        try {
            const [indices, mutualFunds, commodities, currencies, ipo, nfo, stockCategories, movers] = await Promise.allSettled([
                fetchIndices(), fetchMutualFunds(), fetchCommodities(), fetchCurrencyRates(), fetchIPOData(), fetchNFOData(), fetchStockCategories(), fetchTopMovers()
            ]);
            const result = {
                indices: indices.status === 'fulfilled' ? indices.value : [],
                mutualFunds: mutualFunds.status === 'fulfilled' ? mutualFunds.value : [],
                ipo: ipo.status === 'fulfilled' ? ipo.value : { upcoming: [], live: [], recent: [] },
                nfo: nfo.status === 'fulfilled' ? nfo.value : [],
                stockCategories: stockCategories.status === 'fulfilled' ? stockCategories.value : { highs: [], lows: [], all: [] },
                movers: movers.status === 'fulfilled' ? movers.value : { gainers: [], losers: [] },
                sectorals: [],
                commodities: commodities.status === 'fulfilled' ? commodities.value : [],
                currencies: currencies.status === 'fulfilled' ? currencies.value : [],
                fiidii: { fii: {}, dii: {}, date: '' },
                fetchedAt: Date.now(),
                generatedAt: new Date().toISOString(),
                sourceHealth: {
                    indices: indices.status === 'fulfilled' && indices.value.length > 0 ? 'live' : 'failed',
                    mutualFunds: mutualFunds.status === 'fulfilled' ? 'live' : 'failed',
                    movers: movers.status === 'fulfilled' ? 'live' : 'failed',
                },
                errors: {}
            };
            if (result.indices.length > 0) {
                await setIdbCache(CACHE_KEY, result);
                console.log('[Agent03] fetchAllMarketData resolved');
                return result;
            }
        } catch {}

        // 3. Try static snapshot as last resort
        const snapshot = await fetchStaticSnapshot();
        if (snapshot) {
            return { ...snapshot, isSnapshot: true, fetchedAt: snapshot.generatedAt ? new Date(snapshot.generatedAt).getTime() : Date.now() };
        }

        // 4. Absolute last resort — empty
        return { indices: [], mutualFunds: [], ipo: { upcoming: [], live: [], recent: [] }, nfo: [], stockCategories: { highs: [], lows: [], all: [] }, movers: { gainers: [], losers: [] }, sectorals: [], commodities: [], currencies: [], fiidii: { fii: {}, dii: {}, date: '' }, fetchedAt: Date.now(), generatedAt: new Date().toISOString(), sourceHealth: {}, errors: { indices: 'All proxies failed on static host' } };
    }

    const [indices, mutualFunds, ipoData, nfoData, stockCatData, movers, sectorals, commodities, currencies, fiidii] = await Promise.allSettled([fetchIndices(), fetchMutualFunds(), fetchIPOData(), fetchNFOData(), fetchStockCategories(), fetchTopMovers(), fetchSectoralIndices(), fetchCommodities(), fetchCurrencyRates(), fetchFIIDII()]);
    const result = { indices: indices.status === 'fulfilled' ? indices.value : [], mutualFunds: mutualFunds.status === 'fulfilled' ? mutualFunds.value : [], ipo: ipoData.status === 'fulfilled' ? ipoData.value : { upcoming: [], live: [], recent: [] }, nfo: nfoData.status === 'fulfilled' ? nfoData.value : [], stockCategories: stockCatData.status === 'fulfilled' ? stockCatData.value : { highs: [], lows: [], all: [] }, movers: movers.status === 'fulfilled' ? movers.value : { gainers: [], losers: [] }, sectorals: sectorals.status === 'fulfilled' ? sectorals.value : [], commodities: commodities.status === 'fulfilled' ? commodities.value : [], currencies: currencies.status === 'fulfilled' ? currencies.value : [], fiidii: fiidii.status === 'fulfilled' ? fiidii.value : { fii: {}, dii: {}, date: '' }, fetchedAt: Date.now(), generatedAt: new Date().toISOString(), sourceHealth: { indices: indices.status === 'fulfilled' ? 'live' : 'failed', mutualFunds: mutualFunds.status === 'fulfilled' ? 'live' : 'failed', ipo: ipoData.status === 'fulfilled' ? 'live' : 'failed', movers: movers.status === 'fulfilled' ? 'live' : 'failed', sectorals: sectorals.status === 'fulfilled' ? 'live' : 'failed', commodities: commodities.status === 'fulfilled' ? 'live' : 'failed', currencies: currencies.status === 'fulfilled' ? 'live' : 'failed', fiidii: fiidii.status === 'fulfilled' ? 'live' : 'failed' }, errors: { indices: indices.status === 'rejected' ? indices.reason?.message : null } };
    if (result.indices.length > 0) {
        await setIdbCache(CACHE_KEY, result);
        saveMarketSnapshot(result);
        return result;
    }
    try {
        const parsed = await getIdbCache(CACHE_KEY);
                if (parsed) {
            const age = Date.now() - (parsed.fetchedAt || 0);
            if (age < CACHE_TTL) return { ...parsed, isStale: true, staleReason: 'Network/Proxy Failure - Showing cached data' };
        }
    } catch {}
    const snapshot = await fetchStaticSnapshot();
    if (snapshot) return { ...snapshot, isSnapshot: true, fetchedAt: snapshot.generatedAt ? new Date(snapshot.generatedAt).getTime() : Date.now() };
    return result;
}

export default { fetchAllMarketData, fetchStaticSnapshot, fetchIndices, fetchMutualFunds, fetchIPOData, fetchNFOData, fetchStockCategories, fetchTopMovers, fetchSectoralIndices, fetchCommodities, fetchCurrencyRates, fetchFIIDII };
