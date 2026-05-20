import { getFeedWeight } from './feedHealthMonitor.js';

const DEFAULT_FEED_SOURCE_REGISTRY = Object.freeze({
  alerts: {
    Chennai: [
      { url: 'https://www.thehindu.com/news/cities/chennai/feeder/default.rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://www.dtnext.in/rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=Chennai+power+cut+OR+water+supply+OR+TANGEDCO+OR+metro+water&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://www.omanobserver.om/rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://timesofoman.com/rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=Muscat+road+closure+OR+advisory+OR+announcement&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ],
    Trichy: [
      { url: 'https://www.thehindu.com/news/cities/Tiruchirapalli/feeder/default.rss', sourceType: 'general_news', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=Trichy+power+cut+OR+water+supply+OR+civic+alert&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  weather_alerts: {
    Chennai: [
      { url: 'https://news.google.com/rss/search?q=IMD+Chennai+weather+warning+OR+cyclone+OR+heavy+rain+alert&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://news.google.com/rss/search?q=Oman+Met+weather+warning+OR+thunderstorm+OR+flood+alert+Muscat&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ],
    Trichy: [
      { url: 'https://news.google.com/rss/search?q=Trichy+weather+warning+OR+Tamil+Nadu+rain+alert+OR+IMD&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  shopping: {
    online: [
      { url: 'https://news.google.com/rss/search?q=Amazon+sale+OR+Flipkart+sale+OR+Myntra+sale+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=online+shopping+sale+discount+coupon+India+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Chennai: [
      { url: 'https://news.google.com/rss/search?q=Chennai+sale+OR+T+Nagar+shopping+OR+Saravana+Stores+offer&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://news.google.com/rss/search?q=Muscat+Lulu+sale+OR+Oman+shopping+offer+discount&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ]
  },
  airlines: {
    global: [
      { url: 'https://news.google.com/rss/search?q=IndiGo+OR+Air+India+OR+Oman+Air+OR+SalamAir+fare+sale+booking+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  events: {
    Chennai: [
      { url: 'https://news.google.com/rss/search?q=Chennai+upcoming+events+concert+exhibition+workshop+this+week&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://news.google.com/rss/search?q=Muscat+upcoming+events+concert+exhibition+this+month&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ],
    Trichy: [
      { url: 'https://news.google.com/rss/search?q=Trichy+events+exhibition+cultural+event+this+week&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  movies: {
    India: [
      { url: 'https://www.hindustantimes.com/feeds/rss/entertainment/tamil-cinema/rssfeed.xml', sourceType: 'cinema', trust: 'high' },
      { url: 'https://www.hindustantimes.com/feeds/rss/entertainment/bollywood/rssfeed.xml', sourceType: 'cinema', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=upcoming+movie+release+date+theatre+OTT+India+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ]
  },
  festivals: {
    India: [
      { url: 'https://www.timeanddate.com/holidays/india/feed', sourceType: 'calendar', trust: 'high' },
      { url: 'https://news.google.com/rss/search?q=India+public+holiday+OR+Pongal+OR+Diwali+OR+Republic+Day+2025&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Oman: [
      { url: 'https://news.google.com/rss/search?q=Oman+public+holiday+OR+Eid+OR+National+Day+2025&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ]
  },
  civic: {
    Chennai: [
      { url: 'https://news.google.com/rss/search?q=Chennai+metro+water+OR+TANGEDCO+OR+corporation+notice+OR+civic+body&hl=en-IN&gl=IN&ceid=IN:en', sourceType: 'search', trust: 'high' }
    ],
    Muscat: [
      { url: 'https://news.google.com/rss/search?q=Muscat+municipality+OR+Oman+civic+announcement+OR+road+work&hl=en-US&gl=US&ceid=US:en', sourceType: 'search', trust: 'high' }
    ]
  }
});

function uniqByUrl(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const url = String(item?.url || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(item);
  }
  return out;
}

function normalizeLocationKey(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (['chennai', 'madras', 't nagar', 'tnagar', 'adyar', 'velachery', 'tambaram'].includes(lower)) return 'Chennai';
  if (['trichy', 'tiruchirappalli', 'srirangam', 'thillai nagar'].includes(lower)) return 'Trichy';
  if (['muscat', 'al khuwair', 'qurum', 'ruwi', 'seeb', 'mabela'].includes(lower)) return 'Muscat';
  if (['india', 'in'].includes(lower)) return 'India';
  if (['oman'].includes(lower)) return 'Oman';
  return text;
}

function normalizeCategoryKey(value) {
  const text = String(value || '').toLowerCase().trim();
  const aliases = {
    movie: 'movies',
    event: 'events',
    festival: 'festivals',
    alert: 'alerts',
    weather_alert: 'weather_alerts',
    offer: 'shopping',
    airline_offer: 'airlines'
  };
  return aliases[text] || text;
}

export function topupFeedSourceRegistry(baseRegistry = DEFAULT_FEED_SOURCE_REGISTRY, topup = {}) {
  const merged = JSON.parse(JSON.stringify(baseRegistry));
  for (const [category, locationMap] of Object.entries(topup || {})) {
    if (!merged[category]) merged[category] = {};
    for (const [location, entries] of Object.entries(locationMap || {})) {
      if (!merged[category][location]) merged[category][location] = [];
      merged[category][location] = uniqByUrl([...(merged[category][location] || []), ...(entries || [])]);
    }
  }
  return merged;
}

export function getFeedSourcesForRequest({ category, locations = [], includeOnline = true, registry = DEFAULT_FEED_SOURCE_REGISTRY } = {}) {
  const categoryKey = normalizeCategoryKey(category);
  const categoryRegistry = registry[categoryKey] || {};
  const requestedLocations = Array.isArray(locations) ? locations.map(normalizeLocationKey).filter(Boolean) : [];
  const selected = [];

  for (const location of requestedLocations) {
    if (categoryRegistry[location]) {
      selected.push(...categoryRegistry[location].map(entry => ({ ...entry, category: categoryKey, location })));
    }
  }

  if (includeOnline && categoryRegistry.online) {
    selected.push(...categoryRegistry.online.map(entry => ({ ...entry, category: categoryKey, location: 'online' })));
  }
  if (categoryRegistry.global) {
    selected.push(...categoryRegistry.global.map(entry => ({ ...entry, category: categoryKey, location: 'global' })));
  }
  if (categoryRegistry.India && requestedLocations.includes('Chennai')) {
    selected.push(...categoryRegistry.India.map(entry => ({ ...entry, category: categoryKey, location: 'India' })));
  }
  if (categoryRegistry.Oman && requestedLocations.includes('Muscat')) {
    selected.push(...categoryRegistry.Oman.map(entry => ({ ...entry, category: categoryKey, location: 'Oman' })));
  }

  return uniqByUrl(selected);
}

export function rankFeedSource(source) {
  return {
    ...source,
    priorityScore:
      (source.trust === 'high' ? 3 : source.trust === 'medium' ? 2 : 1) +
      (source.sourceType === 'government' ? 2 : 0)
  };
}

export function buildFeedFetchPlan({ categories = [], locations = [], registry = DEFAULT_FEED_SOURCE_REGISTRY, isStaticHost = false } = {}) {
  const plan = [];
  for (const category of categories || []) {
    let sources = getFeedSourcesForRequest({ category, locations, registry, includeOnline: true });

    // Phase 9: Source and feed governance
    // Apply ranking
    sources = sources.map(rankFeedSource).sort((a, b) => b.priorityScore - a.priorityScore);

    // If static host, aggressively trim lower-value feeds to save network/proxy bandwidth
    if (isStaticHost) {
      sources = sources.filter(s => s.priorityScore >= 2 || s.trust !== 'low').slice(0, 3);
    }

    // Feed health auto-demotion: skip sources with >50% failure rate
    sources = sources.filter(s => {
        try { return getFeedWeight(s.url) > 0; } catch { return true; } // fail-open if monitor unavailable
    });

    if (sources.length > 0) {
      plan.push({
        category: normalizeCategoryKey(category),
        sources
      });
    }
  }
  return plan;
}

export { DEFAULT_FEED_SOURCE_REGISTRY };
