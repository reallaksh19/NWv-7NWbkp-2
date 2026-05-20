/**
 * Travel local news RSS collector.
 * Fetches Google News RSS for configured travel location and writes JSON to public/data/.
 *
 * Environment variables:
 *   TRAVEL_LOCATION_KEY - location key (colombo, muscat, chennai, trichy). Default: colombo
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// Import travel services (ES modules)
const { buildTravelNewsQueries } = await import('../src/services/travelNewsQueries.js');
const { getTravelLocationProfile } = await import('../src/services/travelLocationProfile.js');

const locationKey = process.env.TRAVEL_LOCATION_KEY || 'colombo';

const settings = { travelLocation: { city: locationKey, enabled: true, prioritizeStories: true } };
const profile = getTravelLocationProfile(settings);
const queries = buildTravelNewsQueries(profile);

const highPriorityQueries = queries.filter(q => q.priority === 'high');

console.log(`Collecting travel news for: ${profile.display} (${profile.countryCode})`);
console.log(`Queries: ${highPriorityQueries.map(q => q.query).join(', ')}`);

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const request = lib.get(url, { timeout: 10000 }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return resolve(fetchUrl(response.headers.location));
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Request timeout: ' + url)); });
  });
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([sS]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(item) || /<title>([^<]*)<\/title>/.exec(item) || [])[1] || '';
    const link = (/<link>([^<]*)<\/link>/.exec(item) || [])[1] || '';
    const pubDate = (/<pubDate>([^<]*)<\/pubDate>/.exec(item) || [])[1] || '';
    const source = (/<source[^>]*>([^<]*)<\/source>/.exec(item) || [])[1] || '';
    const guid = (/<guid[^>]*>([^<]*)<\/guid>/.exec(item) || [])[1] || link;

    if (title && link) {
      items.push({
        id: guid || link,
        title: title.trim(),
        url: link.trim(),
        link: link.trim(),
        source: source.trim() || 'Google News',
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        city: profile.display,
        country: profile.countryLabel,
      });
    }
  }

  return items;
}

const allStories = [];
const seen = new Set();

for (const query of highPriorityQueries) {
  try {
    console.log(`  Fetching: ${query.query}`);
    const xml = await fetchUrl(query.url);
    const items = parseRssItems(xml);
    console.log(`  Got ${items.length} items`);

    for (const item of items) {
      const key = item.url.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allStories.push(item);
      }
    }
  } catch (error) {
    console.warn(`  Warning: failed to fetch ${query.query}: ${error.message}`);
  }
}

const payload = {
  schemaVersion: 1,
  type: 'travel-location-news-payload',
  locationKey: profile.key,
  display: profile.display,
  countryCode: profile.countryCode,
  countryLabel: profile.countryLabel,
  generatedAt: new Date().toISOString(),
  sourceMode: 'github-rss-prefetch',
  storyCount: allStories.length,
  stories: allStories,
};

const outDir = path.join(process.cwd(), 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, `travel-local-${profile.key}.json`);
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.log(`Written ${allStories.length} stories to ${outPath}`);

console.log(JSON.stringify({
  status: 'PASS',
  locationKey: profile.key,
  storyCount: allStories.length,
  output: outPath.replace(process.cwd(), '.'),
}, null, 2));
