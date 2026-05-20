/**
 * schemaOrgExtractor.js
 * Extracts structured article/event metadata from Schema.org JSON-LD blocks
 * in fetched HTML strings. Uses browser-native DOMParser — zero dependencies.
 *
 * Returns null when no valid JSON-LD is found — callers must handle gracefully.
 */

const ARTICLE_TYPES = new Set([
  'Article', 'NewsArticle', 'ReportageNewsArticle',
  'BlogPosting', 'LiveBlogPosting', 'Event'
]);

/**
 * @param {string} html  Raw HTML string (e.g. from a CORS-proxied page)
 * @returns {{ headline, datePublished, author, image, keywords, description }|null}
 */
export function extractSchemaOrg(html) {
  if (!html || typeof html !== 'string') return null;

  let doc;
  try {
    // DOMParser runs in a detached document — no scripts execute, safe for untrusted HTML
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return null;
  }

  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const raw = JSON.parse(script.textContent);
      // Support both single objects and @graph arrays
      const nodes = Array.isArray(raw['@graph']) ? raw['@graph'] : [raw];
      for (const node of nodes) {
        if (!ARTICLE_TYPES.has(node['@type'])) continue;
        return {
          headline     : node.headline      || node.name        || null,
          datePublished: node.datePublished  || node.startDate   || null,
          author       : node.author?.name   || (typeof node.author === 'string' ? node.author : null),
          image        : node.image?.url     || (typeof node.image  === 'string' ? node.image  : null),
          keywords     : typeof node.keywords === 'string'
                           ? node.keywords.split(',').map(k => k.trim()).filter(Boolean)
                           : Array.isArray(node.keywords) ? node.keywords : [],
          description  : node.description   || null,
        };
      }
    } catch { /* malformed JSON — skip silently */ }
  }
  return null;
}
