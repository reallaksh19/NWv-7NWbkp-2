/* eslint-disable */
import { DEFAULT_SETTINGS } from '../utils/storage.js';
import { annotateItemSourceTrust } from './sourceTrust.js';

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function countMatches(text, keywords = []) {
  const lower = normalizeText(text);
  let count = 0;
  for (const keyword of keywords || []) {
    const normalized = String(keyword || '').trim().toLowerCase();
    if (!normalized) continue;
    if (normalized.includes(' ')) {
      if (lower.includes(normalized)) count += 1;
    } else {
      const re = new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(lower)) count += 1;
    }
  }
  return count;
}

function collectMatches(text, keywords = []) {
  const lower = normalizeText(text);
  const matched = [];
  for (const keyword of keywords || []) {
    const normalized = String(keyword || '').trim().toLowerCase();
    if (!normalized) continue;
    if (normalized.includes(' ')) {
      if (lower.includes(normalized)) matched.push(normalized);
    } else {
      const re = new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(lower)) matched.push(normalized);
    }
  }
  return matched;
}

function keywordSets(settings) {
  return settings?.upAhead?.keywords || DEFAULT_SETTINGS.upAhead.keywords;
}

function categoryList() {
  return ['movies', 'events', 'festivals', 'alerts', 'sports', 'shopping', 'civic', 'weather_alerts', 'airlines'];
}

function categoryAliases() {
  return {
    movie: 'movies',
    event: 'events',
    festival: 'festivals',
    alert: 'alerts',
    weather_alert: 'weather_alerts',
    airline_offer: 'airlines',
    offer: 'shopping',
    shopping: 'shopping'
  };
}

function detectBySourceType(sourceType) {
  const map = {
    airline: 'airlines',
    cinema: 'movies',
    event_listing: 'events',
    government: 'alerts',
    commerce: 'shopping'
  };
  return map[sourceType] || null;
}

export function classifyItemCategory(item, options = {}) {
  const settings = options.settings || DEFAULT_SETTINGS;
  const itemWithTrust = annotateItemSourceTrust(item, options.sourceTrustOptions || {});
  const text = `${item?.title || ''} ${item?.description || ''} ${item?.summary || ''}`;
  const keywords = keywordSets(settings);
  const aliases = categoryAliases();
  const decisionTrace = [...(itemWithTrust.decisionTrace || [])];

  const explicitCategory = aliases[String(item?.category || '').toLowerCase()] || String(item?.category || '').toLowerCase() || null;
  if (explicitCategory && categoryList().includes(explicitCategory)) {
    decisionTrace.push(`category_hint:${explicitCategory}`);
  }

  let best = { 
    category: explicitCategory && categoryList().includes(explicitCategory) ? explicitCategory : 'general', 
    score: explicitCategory && categoryList().includes(explicitCategory) ? 1.5 : 0,
    breakdown: {
      positive: 0,
      categoryNegative: 0,
      globalNegative: 0,
      sourceTypeBonus: 0,
      explicitBonus: explicitCategory && categoryList().includes(explicitCategory) ? 1.5 : 0
    }
  };

  function scoreCategory(text, category, keywords, itemWithTrust, explicitCategory) {
    const matchedPositive = collectMatches(text, keywords[category] || []);
    const matchedCategoryNegative = collectMatches(text, keywords[`${category}_negative`] || []);
    const matchedGlobalNegative = collectMatches(text, keywords.negative || []);

    const positive = matchedPositive.length;
    const categoryNegative = matchedCategoryNegative.length;
    const globalNegative = matchedGlobalNegative.length;

    let score = positive;
    score -= categoryNegative * 1.0;
    score -= globalNegative * 0.65;

    let sourceTypeBonus = detectBySourceType(itemWithTrust.sourceType) === category ? 0.9 : 0;
    let explicitBonus = explicitCategory === category ? 0.6 : 0;

    if (category === 'weather_alerts' && itemWithTrust.sourceType === 'government') {
      sourceTypeBonus += 0.3;
    }
    if (category === 'airlines' && itemWithTrust.sourceType === 'airline') {
      sourceTypeBonus += 0.4;
    }
    // Phase B edgecase rule
    if (category === 'airlines' && (text.includes('fare sale') || text.includes('flight') || text.includes('qatar airways'))) {
      sourceTypeBonus += 1.0;
    }

    score += sourceTypeBonus + explicitBonus;

    return {
      score,
      breakdown: {
        positive,
        categoryNegative,
        globalNegative,
        sourceTypeBonus,
        explicitBonus,
        matchedPositive,
        matchedCategoryNegative,
        matchedGlobalNegative
      }
    };
  }

  for (const category of categoryList()) {
    const scored = scoreCategory(text, category, keywords, itemWithTrust, explicitCategory);

    if (scored.score > best.score) {
      best = { 
        category, 
        score: scored.score,
        breakdown: scored.breakdown
      };
    }
  }

  const classificationConfidence = Math.max(0, Math.min(1, best.score <= 0 ? 0 : best.score / 4));
  
  // Phase B: If global negative is very high, suppress classification to general to prevent planner pollution
  if (best.breakdown && best.breakdown.globalNegative >= 2 && best.score < 2.25) {
      best.category = 'general';
      best.score = 0;
  }

  // High confidence categories bypass some dropping rules for strict planner dates, so ensure strict scoring
  if (best.category !== 'general') {
    decisionTrace.push(`classified:${best.category}`);
  } else {
    decisionTrace.push('classified:general');
  }

  let finalConfidence = classificationConfidence;
  if (!finalConfidence && best.category !== 'general') {
      if (explicitCategory) finalConfidence = 0.375;
      else if (item.sourceType === 'event_listing') finalConfidence = 0.4;
  }
  if (finalConfidence === 0 && best.score > 0 && best.category !== 'general') {
      finalConfidence = 0.25; // Minimum fallback for positive matched explicit items to avoid complete 0 score wiping out Planner routing
  }

  return {
    ...itemWithTrust,
    category: best.category,
    classificationConfidence: finalConfidence,
    classificationBreakdown: best.breakdown,
    decisionTrace
  };
}

export function annotateItemsWithClassification(items = [], options = {}) {
  return (items || []).map(item => classifyItemCategory(item, options));
}
