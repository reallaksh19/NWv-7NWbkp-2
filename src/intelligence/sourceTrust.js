function domainFromUrl(link) {
  try {
    const url = new URL(link);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return String(link || '').replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase();
  }
}

const DEFAULT_RULES = Object.freeze({
  domainRules: {
    'imd.gov.in': { sourceTrust: 'high', sourceType: 'government', score: 1.0 },
    'mawaqit.gov.om': { sourceTrust: 'high', sourceType: 'government', score: 1.0 },
    'timesofoman.com': { sourceTrust: 'medium', sourceType: 'general_news', score: 0.72 },
    'omanobserver.om': { sourceTrust: 'medium', sourceType: 'general_news', score: 0.72 },
    'thehindu.com': { sourceTrust: 'high', sourceType: 'general_news', score: 0.86 },
    'indianexpress.com': { sourceTrust: 'high', sourceType: 'general_news', score: 0.84 },
    'dtnext.in': { sourceTrust: 'medium', sourceType: 'general_news', score: 0.7 },
    'bookmyshow.com': { sourceTrust: 'high', sourceType: 'event_listing', score: 0.94 },
    'paytminsider.com': { sourceTrust: 'high', sourceType: 'event_listing', score: 0.92 },
    'district.in': { sourceTrust: 'high', sourceType: 'event_listing', score: 0.9 },
    'ticketnew.com': { sourceTrust: 'high', sourceType: 'event_listing', score: 0.9 },
    'netflix.com': { sourceTrust: 'high', sourceType: 'cinema', score: 0.9 },
    'primevideo.com': { sourceTrust: 'high', sourceType: 'cinema', score: 0.9 },
    'hotstar.com': { sourceTrust: 'high', sourceType: 'cinema', score: 0.9 },
    'zee5.com': { sourceTrust: 'high', sourceType: 'cinema', score: 0.88 },
    'jiocinema.com': { sourceTrust: 'high', sourceType: 'cinema', score: 0.88 },
    'omanair.com': { sourceTrust: 'high', sourceType: 'airline', score: 0.93 },
    'goindigo.in': { sourceTrust: 'high', sourceType: 'airline', score: 0.93 },
    'airindia.com': { sourceTrust: 'high', sourceType: 'airline', score: 0.93 },
    'salamair.com': { sourceTrust: 'high', sourceType: 'airline', score: 0.93 },
    'makemytrip.com': { sourceTrust: 'medium', sourceType: 'commerce', score: 0.78 },
    'cleartrip.com': { sourceTrust: 'medium', sourceType: 'commerce', score: 0.78 }
  },
  sourceTypeKeywords: {
    government: ['advisory', 'bulletin', 'department', 'official', 'authority', 'municipal', 'corporation'],
    airline: ['fare sale', 'flight offer', 'book flights', 'flight tickets', 'pnr'],
    cinema: ['streaming now', 'ott release', 'now on netflix', 'now on prime', 'in theatres'],
    event_listing: ['tickets available', 'register now', 'book tickets', 'venue', 'entry fee', 'show timings'],
    commerce: ['discount', 'sale', 'coupon', 'promo code']
  },
  lowTrustSignals: ['rumour', 'rumor', 'gossip', 'speculation', 'viral', 'click here', 'you won\'t believe'],
  mediumTrustSignals: ['report', 'reports', 'according to', 'sources said'],
  highTrustSignals: ['official', 'announced', 'schedule', 'advisory', 'bulletin', 'tickets']
});

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function scoreSignals(text, rules) {
  let score = 0;
  const lower = normalizeText(text);
  for (const term of rules.highTrustSignals || []) {
    if (lower.includes(term)) score += 0.06;
  }
  for (const term of rules.mediumTrustSignals || []) {
    if (lower.includes(term)) score += 0.02;
  }
  for (const term of rules.lowTrustSignals || []) {
    if (lower.includes(term)) score -= 0.14;
  }
  return score;
}

function detectSourceTypeFromKeywords(text, rules) {
  const lower = normalizeText(text);
  let best = { sourceType: 'general_news', score: 0 };
  for (const [sourceType, keywords] of Object.entries(rules.sourceTypeKeywords || {})) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) score += 1;
    }
    if (score > best.score) {
      best = { sourceType, score };
    }
  }
  return best.sourceType;
}

function trustBucket(score) {
  if (score >= 0.85) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export function evaluateSourceTrust(item, options = {}) {
  const rules = options.rules || DEFAULT_RULES;
  const link = item?.link || item?.url || '';
  const domain = domainFromUrl(link);
  const fullText = `${item?.title || ''} ${item?.description || ''} ${item?.summary || ''}`;
  const ruleMatch = rules.domainRules[domain] || null;

  let score = ruleMatch?.score ?? 0.55;
  let sourceType = ruleMatch?.sourceType || detectSourceTypeFromKeywords(fullText, rules);
  const decisionTrace = [];

  if (ruleMatch) {
    decisionTrace.push(`domain_rule:${domain}`);
  } else if (domain) {
    decisionTrace.push(`domain_unknown:${domain}`);
  }

  score += scoreSignals(fullText, rules);
  if (item?.category && ['weather_alerts', 'alerts', 'civic'].includes(String(item.category).toLowerCase()) && sourceType === 'government') {
    score += 0.08;
    decisionTrace.push('category_government_boost');
  }
  if (item?.category && ['shopping', 'airlines'].includes(String(item.category).toLowerCase()) && ['airline', 'commerce'].includes(sourceType)) {
    score += 0.06;
    decisionTrace.push('commerce_relevance_boost');
  }

  score = Math.max(0, Math.min(1, score));
  const sourceTrust = ruleMatch?.sourceTrust || trustBucket(score);

  return {
    domain,
    sourceTrust,
    sourceType,
    sourceTrustScore: score,
    decisionTrace
  };
}

export function annotateItemSourceTrust(item, options = {}) {
  const trust = evaluateSourceTrust(item, options);
  return {
    ...item,
    sourceDomain: trust.domain,
    sourceTrust: trust.sourceTrust,
    sourceType: trust.sourceType,
    sourceTrustScore: trust.sourceTrustScore,
    decisionTrace: [...new Set([...(item?.decisionTrace || []), ...trust.decisionTrace])]
  };
}

export { DEFAULT_RULES as DEFAULT_SOURCE_TRUST_RULES };
