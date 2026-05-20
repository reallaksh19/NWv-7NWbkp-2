import { getIdbCache, setIdbCache } from './indexedDbCache.js';
import {
  MARKET_CACHE_SCHEMA_VERSION,
  MARKET_SERVICE_CACHE_KEY,
  MARKET_SERVICE_CACHE_TTL_MS,
  MARKET_STALE_CACHE_MAX_AGE_MS,
  MARKET_SNAPSHOT_FRESH_MS,
  MARKET_EXPIRED_DISPLAY_MAX_AGE_MS,
  getMarketPayloadAgeMs,
  isMarketPayloadUsable,
  isMarketPayloadFresh,
  markMarketPayload,
  shouldRejectMarketPayload
} from './marketTrust.js';

const CACHE_KEY = MARKET_SERVICE_CACHE_KEY;
const CACHE_TTL = MARKET_SERVICE_CACHE_TTL_MS;
const STALE_CACHE_MAX_AGE = MARKET_STALE_CACHE_MAX_AGE_MS;
const SNAPSHOT_FRESH_MS = MARKET_SNAPSHOT_FRESH_MS;
const STALE_SNAPSHOT_MAX_AGE = 24 * 60 * 60 * 1000;
const YAHOO_CHART_BASES = [
  'https://query1.finance.yahoo.com/v8/finance/chart/',
  'https://query2.finance.yahoo.com/v8/finance/chart/',
];
const YAHOO_QUOTE_BASES = [
  'https://query1.finance.yahoo.com/v7/finance/quote',
  'https://query2.finance.yahoo.com/v7/finance/quote',
];

const PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const CORE_INDICES = [
  { key: 'nifty50', name: 'NIFTY 50', symbol: '^NSEI' },
  { key: 'sensex', name: 'SENSEX', symbol: '^BSESN' },
  { key: 'bankNifty', name: 'BANK NIFTY', symbol: '^NSEBANK' },
  { key: 'niftyIT', name: 'NIFTY IT', symbol: '^CNXIT' },
  { key: 'niftyAuto', name: 'NIFTY AUTO', symbol: '^CNXAUTO' },
  { key: 'niftyPharma', name: 'NIFTY PHARMA', symbol: '^CNXPHARMA' },
  { key: 'sp500', name: 'S&P 500', symbol: '^GSPC' },
  { key: 'nasdaq', name: 'NASDAQ', symbol: '^IXIC' },
  { key: 'nikkei', name: 'NIKKEI 225', symbol: '^N225' },
  { key: 'hangSeng', name: 'HANG SENG', symbol: '^HSI' },
];

const TOP_STOCKS = [
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
  'BHARTIARTL.NS', 'SBIN.NS', 'ITC.NS', 'LT.NS', 'AXISBANK.NS',
  'KOTAKBANK.NS', 'MARUTI.NS', 'BAJFINANCE.NS', 'HINDUNILVR.NS', 'SUNPHARMA.NS',
];

export const MARKET_SEED = {
  indices: [
    { name: 'NIFTY 50', symbol: '^NSEI', value: '22,340.55', change: '124.30', changePercent: '0.56', direction: 'up', currency: '₹', sourceMode: 'seed' },
    { name: 'SENSEX', symbol: '^BSESN', value: '73,745.35', change: '350.20', changePercent: '0.48', direction: 'up', currency: '₹', sourceMode: 'seed' },
    { name: 'BANK NIFTY', symbol: '^NSEBANK', value: '48,060.80', change: '210.10', changePercent: '0.44', direction: 'up', currency: '₹', sourceMode: 'seed' },
    { name: 'NIFTY IT', symbol: '^CNXIT', value: '33,210.40', change: '-85.50', changePercent: '-0.26', direction: 'down', currency: '₹', sourceMode: 'seed' },
  ],
  movers: {
    gainers: [
      { symbol: 'RELIANCE', price: '2,835.20', change: '34.10', changePercent: '1.22', direction: 'up', sourceMode: 'seed' },
      { symbol: 'ICICIBANK', price: '1,108.40', change: '12.30', changePercent: '1.12', direction: 'up', sourceMode: 'seed' },
      { symbol: 'BHARTIARTL', price: '1,321.00', change: '13.80', changePercent: '1.06', direction: 'up', sourceMode: 'seed' },
    ],
    losers: [
      { symbol: 'INFY', price: '1,445.30', change: '-18.20', changePercent: '-1.24', direction: 'down', sourceMode: 'seed' },
      { symbol: 'TCS', price: '3,890.10', change: '-32.40', changePercent: '-0.83', direction: 'down', sourceMode: 'seed' },
      { symbol: 'HINDUNILVR', price: '2,310.75', change: '-12.10', changePercent: '-0.52', direction: 'down', sourceMode: 'seed' },
    ],
  },
  sectorals: [
    { name: 'BANK NIFTY', value: '48,060.80', change: '210.10', changePercent: '0.44', direction: 'up', sourceMode: 'seed' },
    { name: 'NIFTY IT', value: '33,210.40', change: '-85.50', changePercent: '-0.26', direction: 'down', sourceMode: 'seed' },
  ],
  commodities: [
    { name: 'Gold', value: '$2,330.00', unit: '$/oz', changePercent: '0.18', direction: 'up', source: 'seed' },
    { name: 'Silver', value: '$27.40', unit: '$/oz', changePercent: '-0.12', direction: 'down', source: 'seed' },
    { name: 'Crude Oil', value: '$82.10', unit: '$/bbl', changePercent: '0.35', direction: 'up', source: 'seed' },
  ],
  currencies: [
    { name: 'USD/INR', value: '₹83.45', changePercent: '0.05', direction: 'up', source: 'seed' },
    { name: 'EUR/INR', value: '₹89.30', changePercent: '-0.10', direction: 'down', source: 'seed' },
    { name: 'GBP/INR', value: '₹104.20', changePercent: '0.08', direction: 'up', source: 'seed' },
  ],
  mutualFunds: [],
  ipo: { upcoming: [], live: [], recent: [] },
  nfo: [],
  stockCategories: { highs: [], lows: [], all: [] },
  fiidii: { fii: {}, dii: {}, date: '' },
  sourceHealth: {
    indices: 'seed',
    movers: 'seed',
    sectorals: 'seed',
    commodities: 'seed',
    currencies: 'seed',
    mutualFunds: 'empty',
    ipo: 'empty',
    fiidii: 'empty',
  },
  errors: {},
};

function publicDataUrl(path) {
  const base = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/');
  return `${base}${String(path).replace(/^\//, '')}`;
}

function isUsableMarketPayload(data) {
  return isMarketPayloadUsable(data);
}

function getPayloadTimestamp(data) {
  const candidates = [
    Number(data?.fetchedAt || 0),
    Date.parse(data?.generatedAt || ''),
    Date.parse(data?.generated_at || ''),
  ].filter((ts) => Number.isFinite(ts) && ts > 0 && ts <= Date.now() + 5 * 60 * 1000);
  return candidates.length ? Math.max(...candidates) : 0;
}

function getPayloadAgeMs(data) {
  return getMarketPayloadAgeMs(data);
}

function isFreshPayload(data, ttlMs) {
  return isMarketPayloadFresh(data, ttlMs);
}

function withMeta(data, sourceMode, extra = {}) {
  const timestamp = getPayloadTimestamp(data) || (sourceMode === 'seed' ? Date.now() : Date.now());
  return {
    ...MARKET_SEED,
    ...data,
    indices: Array.isArray(data?.indices) && data.indices.length ? data.indices : MARKET_SEED.indices,
    movers: data?.movers || MARKET_SEED.movers,
    sectorals: Array.isArray(data?.sectorals) && data.sectorals.length ? data.sectorals : MARKET_SEED.sectorals,
    commodities: Array.isArray(data?.commodities) && data.commodities.length ? data.commodities : MARKET_SEED.commodities,
    currencies: Array.isArray(data?.currencies) && data.currencies.length ? data.currencies : MARKET_SEED.currencies,
    schemaVersion: MARKET_CACHE_SCHEMA_VERSION,
    fetchedAt: timestamp,
    generatedAt: data?.generatedAt || data?.generated_at || new Date(timestamp).toISOString(),
    sourceMode,
    sourceHealth: markMarketPayload(
      {
        sourceHealth: {
          ...MARKET_SEED.sourceHealth,
          ...(data?.sourceHealth || {}),
          ...(extra.sourceHealth || {})
        }
      },
      sourceMode
    ).sourceHealth,
    errors: { ...(data?.errors || {}), ...(extra.errors || {}) },
  };
}

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-cache' });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonDirectOrProxy(url, timeoutMs = 8000) {
  const candidates = [url, ...PROXIES.map((proxy) => proxy(url))];
  const attempts = await Promise.allSettled(candidates.map(async (candidate) => {
    const response = await fetchWithTimeout(candidate, timeoutMs);
    if (!response.ok) throw new Error(`${response.status} ${candidate}`);
    return { data: await response.json(), transport: candidate === url ? 'direct' : 'proxy' };
  }));
  const winner = attempts.find((attempt) => attempt.status === 'fulfilled' && attempt.value?.data);
  return winner?.value || null;
}

function parseYahooChart(payload, provider = 'yahoo-chart') {
  const data = payload?.data || payload;
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || !Number.isFinite(Number(meta.regularMarketPrice))) return null;
  const price = Number(meta.regularMarketPrice);
  const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
  const change = price - prev;
  const changePercent = prev ? (change / prev) * 100 : 0;
  const quote = result?.indicators?.quote?.[0] || {};
  const series = (result?.timestamp || []).map((ts, i) => {
    const close = quote.close?.[i];
    if (close == null) return null;
    return {
      timestamp: ts * 1000,
      close: Number(close),
      open: Number(quote.open?.[i] ?? close),
      high: Number(quote.high?.[i] ?? close),
      low: Number(quote.low?.[i] ?? close),
    };
  }).filter(Boolean);
  return { price, change, changePercent, timestamp: (meta.regularMarketTime || Date.now() / 1000) * 1000, series, provider: `${provider}-${payload?.transport || 'direct'}` };
}

function parseYahooQuote(payload, provider = 'yahoo-quote') {
  const item = payload?.data?.quoteResponse?.result?.[0] || payload?.quoteResponse?.result?.[0] || payload;
  if (!item || !Number.isFinite(Number(item.regularMarketPrice))) return null;
  const price = Number(item.regularMarketPrice);
  const change = Number(item.regularMarketChange ?? 0);
  const changePercent = Number(item.regularMarketChangePercent ?? 0);
  return {
    price,
    change,
    changePercent,
    timestamp: (item.regularMarketTime || Date.now() / 1000) * 1000,
    series: [],
    provider: `${provider}-${payload?.transport || 'direct'}`,
  };
}

function providerLabelFromBase(base, type) {
  const mirror = base.includes('query2') ? 'query2' : 'query1';
  return `yahoo-${type}-${mirror}`;
}

async function fetchYahooChartQuote(symbol, opts = {}) {
  const range = opts.range || '5d';
  const interval = opts.interval || '1d';
  const attempts = await Promise.allSettled(YAHOO_CHART_BASES.map(async (base) => {
    const url = `${base}${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const payload = await fetchJsonDirectOrProxy(url, 8000);
    return payload ? parseYahooChart(payload, providerLabelFromBase(base, 'chart')) : null;
  }));
  return attempts.find((attempt) => attempt.status === 'fulfilled' && attempt.value)?.value || null;
}

async function fetchYahooQuoteApi(symbol) {
  const attempts = await Promise.allSettled(YAHOO_QUOTE_BASES.map(async (base) => {
    const url = `${base}?symbols=${encodeURIComponent(symbol)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketTime`;
    const payload = await fetchJsonDirectOrProxy(url, 8000);
    return payload ? parseYahooQuote(payload, providerLabelFromBase(base, 'quote')) : null;
  }));
  return attempts.find((attempt) => attempt.status === 'fulfilled' && attempt.value)?.value || null;
}

async function fetchBestYahooQuote(symbol, opts = {}) {
  const [chart, quote] = await Promise.allSettled([
    fetchYahooChartQuote(symbol, opts),
    fetchYahooQuoteApi(symbol),
  ]);
  const chartValue = chart.status === 'fulfilled' ? chart.value : null;
  const quoteValue = quote.status === 'fulfilled' ? quote.value : null;
  return chartValue || quoteValue || null;
}

function formatIndex({ name, symbol }, priceData) {
  const series = priceData.series || [];
  return {
    name,
    symbol,
    value: priceData.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
    change: priceData.change.toFixed(2),
    changePercent: priceData.changePercent.toFixed(2),
    direction: priceData.change >= 0 ? 'up' : 'down',
    currency: name.includes('NIFTY') || name === 'SENSEX' ? '₹' : '',
    timestamp: priceData.timestamp,
    history: series.map((p) => p.close),
    series,
    dayOpen: series[0]?.open ?? priceData.price,
    dayHigh: series.length ? Math.max(...series.map((p) => p.high || p.close)) : priceData.price,
    dayLow: series.length ? Math.min(...series.map((p) => p.low || p.close)) : priceData.price,
    sourceProvider: priceData.provider,
  };
}

export async function fetchStaticSnapshot() {
  try {
    const resp = await fetch(publicDataUrl('data/market_snapshot.json'), { cache: 'no-cache' });
    if (!resp.ok) return null;

    const snapshot = await resp.json();
    if (!isUsableMarketPayload(snapshot)) return null;

    const reject = shouldRejectMarketPayload(
      {
        ...snapshot,
        sourceMode: snapshot.sourceMode || 'snapshot'
      },
      {
        maxAgeMs: MARKET_EXPIRED_DISPLAY_MAX_AGE_MS,
        allowSeed: false
      }
    );

    if (reject.reject) {
      console.warn('[MarketStableService] Ignoring stale market snapshot:', reject.reason);
      return null;
    }

    return markMarketPayload(snapshot, snapshot.sourceMode || 'snapshot', {
      sourceHealth: {
        snapshot: {
          status: isFreshPayload(snapshot, SNAPSHOT_FRESH_MS) ? 'snapshot' : 'stale',
          provider: 'market_snapshot.json',
          mode: 'snapshot',
          freshnessMs: getPayloadAgeMs(snapshot),
          message: isFreshPayload(snapshot, SNAPSHOT_FRESH_MS)
            ? 'Fresh static snapshot'
            : 'Stale static snapshot'
        }
      }
    });
  } catch {
    return null;
  }
}

async function readMarketCache({ allowStale = false } = {}) {
  try {
    const cached = await getIdbCache(CACHE_KEY);
    if (!isUsableMarketPayload(cached)) return null;

    // Reject old cache schema immediately. This prevents old 900h payloads
    // from surviving after service contract changes.
    if (cached.schemaVersion !== MARKET_CACHE_SCHEMA_VERSION) {
      return null;
    }

    const age = getPayloadAgeMs(cached);
    if (!allowStale && age > CACHE_TTL) return null;
    if (allowStale && age > STALE_CACHE_MAX_AGE) return null;

    const reject = shouldRejectMarketPayload(cached, {
      maxAgeMs: allowStale ? STALE_CACHE_MAX_AGE : CACHE_TTL
    });

    if (reject.reject) {
      console.warn('[MarketStableService] Ignoring cached market payload:', reject.reason);
      return null;
    }

    return cached;
  } catch {
    return null;
  }
}

export async function fetchIndices() {
  const results = await Promise.allSettled(CORE_INDICES.map(async (index) => {
    const quote = await fetchBestYahooQuote(index.symbol, { range: '5d', interval: '1d' });
    return quote ? formatIndex(index, quote) : null;
  }));
  return results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
}

export async function fetchSectoralIndices() {
  const indices = await fetchIndices();
  return indices.filter((index) => ['BANK NIFTY', 'NIFTY IT', 'NIFTY AUTO', 'NIFTY PHARMA'].includes(index.name));
}

async function fetchStockQuote(symbol) {
  const quote = await fetchBestYahooQuote(symbol, { range: '5d', interval: '1d' });
  if (!quote) return null;
  return {
    symbol: symbol.replace('.NS', '').replace('.BO', ''),
    price: quote.price.toFixed(2),
    change: quote.change.toFixed(2),
    changePercent: quote.changePercent.toFixed(2),
    direction: quote.change >= 0 ? 'up' : 'down',
    timestamp: quote.timestamp,
    sourceProvider: quote.provider,
  };
}

export async function fetchTopMovers() {
  const quotes = await Promise.allSettled(TOP_STOCKS.map(fetchStockQuote));
  const valid = quotes.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
  if (!valid.length) return MARKET_SEED.movers;
  return {
    gainers: valid.filter((q) => Number(q.changePercent) > 0).sort((a, b) => Number(b.changePercent) - Number(a.changePercent)).slice(0, 5),
    losers: valid.filter((q) => Number(q.changePercent) < 0).sort((a, b) => Number(a.changePercent) - Number(b.changePercent)).slice(0, 5),
    source: 'yahoo-query1-query2-parallel-watchlist',
  };
}

export async function fetchCommodities() {
  const symbols = [
    { symbol: 'GC=F', name: 'Gold', unit: '$/oz' },
    { symbol: 'SI=F', name: 'Silver', unit: '$/oz' },
    { symbol: 'CL=F', name: 'Crude Oil', unit: '$/bbl' },
  ];
  const results = await Promise.allSettled(symbols.map(async (item) => {
    const quote = await fetchBestYahooQuote(item.symbol, { range: '5d', interval: '1d' });
    if (!quote) return null;
    return {
      name: item.name,
      unit: item.unit,
      value: `$${quote.price.toFixed(2)}`,
      changePercent: quote.changePercent.toFixed(2),
      direction: quote.change >= 0 ? 'up' : 'down',
      source: quote.provider,
    };
  }));
  const valid = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
  return valid.length ? valid : MARKET_SEED.commodities;
}

export async function fetchCurrencyRates() {
  const symbols = [
    { symbol: 'USDINR=X', name: 'USD/INR' },
    { symbol: 'EURINR=X', name: 'EUR/INR' },
    { symbol: 'GBPINR=X', name: 'GBP/INR' },
  ];
  const results = await Promise.allSettled(symbols.map(async (item) => {
    const quote = await fetchBestYahooQuote(item.symbol, { range: '5d', interval: '1d' });
    if (!quote) return null;
    return {
      name: item.name,
      value: `₹${quote.price.toFixed(2)}`,
      changePercent: quote.changePercent.toFixed(2),
      direction: quote.change >= 0 ? 'up' : 'down',
      source: quote.provider,
    };
  }));
  const valid = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
  return valid.length ? valid : MARKET_SEED.currencies;
}

export async function fetchMutualFunds() { return []; }
export async function fetchIPOData() { return MARKET_SEED.ipo; }
export async function fetchNFOData() { return []; }
export async function fetchStockCategories() { return MARKET_SEED.stockCategories; }
export async function fetchFIIDII() { return MARKET_SEED.fiidii; }

async function fetchLiveMarketBundle() {
  const [indices, movers, sectorals, commodities, currencies] = await Promise.allSettled([
    fetchIndices(),
    fetchTopMovers(),
    fetchSectoralIndices(),
    fetchCommodities(),
    fetchCurrencyRates(),
  ]);

  const live = {
    indices: indices.status === 'fulfilled' ? indices.value : [],
    movers: movers.status === 'fulfilled' ? movers.value : MARKET_SEED.movers,
    sectorals: sectorals.status === 'fulfilled' ? sectorals.value : [],
    commodities: commodities.status === 'fulfilled' ? commodities.value : MARKET_SEED.commodities,
    currencies: currencies.status === 'fulfilled' ? currencies.value : MARKET_SEED.currencies,
    fetchedAt: Date.now(),
    generatedAt: new Date().toISOString(),
    sourceHealth: {
      indices: indices.status === 'fulfilled' && indices.value.length ? 'live-query1-query2-parallel' : 'failed',
      movers: movers.status === 'fulfilled' ? 'live-query1-query2-parallel' : 'seed',
      sectorals: sectorals.status === 'fulfilled' && sectorals.value.length ? 'live-query1-query2-parallel' : 'seed',
      commodities: commodities.status === 'fulfilled' ? 'live-query1-query2-parallel' : 'seed',
      currencies: currencies.status === 'fulfilled' ? 'live-query1-query2-parallel' : 'seed',
    },
    providerPlan: ['cache', 'yahoo-chart-query1', 'yahoo-chart-query2', 'yahoo-quote-query1', 'yahoo-quote-query2', 'proxy-parallel', 'snapshot', 'stale-cache', 'seed'],
  };

  return isUsableMarketPayload(live) ? live : null;
}

export async function fetchAllMarketData() {
  const freshCache = await readMarketCache({ allowStale: false });
  if (freshCache) return withMeta(freshCache, 'cache', { sourceHealth: { cache: 'fresh' } });

  const [liveResult, snapshotResult, staleCacheResult] = await Promise.allSettled([
    fetchLiveMarketBundle(),
    fetchStaticSnapshot(),
    readMarketCache({ allowStale: true }),
  ]);

  const live = liveResult.status === 'fulfilled' ? liveResult.value : null;
  if (isUsableMarketPayload(live)) {
    const normalized = withMeta(live, 'live', { sourceHealth: { provider: 'parallel-live-query1-query2-first' } });
    try { await setIdbCache(CACHE_KEY, normalized); } catch { /* ignore */ }
    return normalized;
  }

  const snapshot = snapshotResult.status === 'fulfilled' ? snapshotResult.value : null;
  if (isFreshPayload(snapshot, SNAPSHOT_FRESH_MS)) {
    const normalized = withMeta(snapshot, 'snapshot', { sourceHealth: { indices: 'fresh-snapshot' } });
    try { await setIdbCache(CACHE_KEY, normalized); } catch { /* ignore */ }
    return normalized;
  }

  const staleCache = staleCacheResult.status === 'fulfilled' ? staleCacheResult.value : null;
  if (isUsableMarketPayload(staleCache)) {
    return withMeta(staleCache, 'stale-cache', {
      sourceHealth: { cache: 'stale-after-live-failure' },
      errors: { feed: 'Live feeds failed; showing stale cache.' },
    });
  }

  if (isUsableMarketPayload(snapshot) && getPayloadAgeMs(snapshot) <= STALE_SNAPSHOT_MAX_AGE) {
    return withMeta(snapshot, 'stale-snapshot', {
      sourceHealth: { indices: 'stale-snapshot-after-live-failure' },
      errors: { feed: 'Live feeds failed; showing stale snapshot.' },
    });
  }

  const seed = withMeta(
    {
      ...MARKET_SEED,
      fetchedAt: Date.now(),
      generatedAt: new Date().toISOString(),
      schemaVersion: MARKET_CACHE_SCHEMA_VERSION
    },
    'seed',
    {
      sourceHealth: {
        seed: {
          status: 'seed',
          provider: 'bundled-seed',
          mode: 'seed',
          message: 'Live feed, snapshot, and cache unavailable; showing bundled seed.'
        }
      },
      errors: {
        indices: 'Live feed, snapshot, and cache unavailable; showing bundled seed.'
      }
    }
  );

  // Do not cache seed as a normal market feed.
  // Seed is display fallback only.
  return seed;
}
