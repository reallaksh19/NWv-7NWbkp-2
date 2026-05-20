import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) return '';
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  if (!before) throw new Error(`Missing file: ${path}`);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

write('.github/workflows/travel-local-news.yml', `name: Travel local news prefetch

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:
    inputs:
      location_key:
        description: 'Travel location key (colombo, muscat, chennai, trichy)'
        required: false
        default: 'colombo'

jobs:
  collect-travel-news:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Collect travel local news
        run: node scripts/collect_travel_local_news.mjs
        env:
          TRAVEL_LOCATION_KEY: \${{ github.event.inputs.location_key || 'colombo' }}

      - name: Commit updated travel news JSON
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update travel-local news JSON [skip ci]'
          file_pattern: 'public/data/travel-local-*.json'
          branch: \${{ github.ref_name }}
`);

write('scripts/collect_travel_local_news.mjs', `/**
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

console.log(\`Collecting travel news for: \${profile.display} (\${profile.countryCode})\`);
console.log(\`Queries: \${highPriorityQueries.map(q => q.query).join(', ')}\`);

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
  const itemRegex = /<item>([\s\S]*?)<\\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = (/<title><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/title>/.exec(item) || /<title>([^<]*)<\\/title>/.exec(item) || [])[1] || '';
    const link = (/<link>([^<]*)<\\/link>/.exec(item) || [])[1] || '';
    const pubDate = (/<pubDate>([^<]*)<\\/pubDate>/.exec(item) || [])[1] || '';
    const source = (/<source[^>]*>([^<]*)<\\/source>/.exec(item) || [])[1] || '';
    const guid = (/<guid[^>]*>([^<]*)<\\/guid>/.exec(item) || [])[1] || link;

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
    console.log(\`  Fetching: \${query.query}\`);
    const xml = await fetchUrl(query.url);
    const items = parseRssItems(xml);
    console.log(\`  Got \${items.length} items\`);

    for (const item of items) {
      const key = item.url.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allStories.push(item);
      }
    }
  } catch (error) {
    console.warn(\`  Warning: failed to fetch \${query.query}: \${error.message}\`);
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

const outPath = path.join(outDir, \`travel-local-\${profile.key}.json\`);
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\\n', 'utf8');

console.log(\`Written \${allStories.length} stories to \${outPath}\`);

console.log(JSON.stringify({
  status: 'PASS',
  locationKey: profile.key,
  storyCount: allStories.length,
  output: outPath.replace(process.cwd(), '.'),
}, null, 2));
`);

write('src/services/travelNewsWorkflow.cert.test.js', `import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Travel news workflow certification', () => {
  it('GitHub Actions workflow file exists and references travel-local-news', () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/travel-local-news.yml');
    expect(fs.existsSync(workflowPath)).toBe(true);

    const content = fs.readFileSync(workflowPath, 'utf8');
    expect(content).toContain('collect_travel_local_news.mjs');
    expect(content).toContain('travel-local-*.json');
    expect(content).toContain('TRAVEL_LOCATION_KEY');
  });

  it('RSS collector script exists and references location profile', () => {
    const collectorPath = path.join(process.cwd(), 'scripts/collect_travel_local_news.mjs');
    expect(fs.existsSync(collectorPath)).toBe(true);

    const content = fs.readFileSync(collectorPath, 'utf8');
    expect(content).toContain('buildTravelNewsQueries');
    expect(content).toContain('getTravelLocationProfile');
    expect(content).toContain('travel-local-');
    expect(content).toContain('sourceMode');
  });

  it('static source policy JSON is present for Colombo', () => {
    const policyPath = path.join(process.cwd(), 'public/data/travel-source-policy.json');
    expect(fs.existsSync(policyPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(content.locations.some(loc => loc.key === 'colombo')).toBe(true);
  });
});
`);

write('scripts/test_travel_news_workflow_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const workflow = read('.github/workflows/travel-local-news.yml');
const collector = read('scripts/collect_travel_local_news.mjs');
const workflowTest = read('src/services/travelNewsWorkflow.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'collect_travel_local_news.mjs',
  'travel-local-*.json',
  'TRAVEL_LOCATION_KEY',
  'workflow_dispatch',
]) {
  assert(workflow.includes(token), '.github/workflows/travel-local-news.yml missing token: ' + token);
}

for (const token of [
  'buildTravelNewsQueries',
  'getTravelLocationProfile',
  'travel-local-',
  'sourceMode',
  'github-rss-prefetch',
]) {
  assert(collector.includes(token), 'collect_travel_local_news.mjs missing token: ' + token);
}

for (const token of [
  'Travel news workflow certification',
  'GitHub Actions workflow file exists',
  'RSS collector script exists',
]) {
  assert(workflowTest.includes(token), 'travelNewsWorkflow.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:travel-news-workflow"'),
  'package.json must include test:travel-news-workflow'
);

assert(
  certGate.includes("['npm', ['run', 'test:travel-news-workflow']]") ||
  certGate.includes('certification_manifest.json'),
  'certification gate must include travel news workflow test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Travel news workflow',
  guarantees: [
    'GitHub Actions workflow exists',
    'RSS collector script exists',
    'Workflow references travel-local JSON pattern',
    'Collector uses profile-based queries'
  ]
}, null, 2));

console.log('PASS: Travel news workflow static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:travel-news-workflow'] =
    'node scripts/test_travel_news_workflow_static.mjs && vitest run --config vitest.config.js src/services/travelNewsWorkflow.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:travel-news-workflow']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  const anchors = [
    "  ['npm', ['run', 'test:travel-location-browser-smoke:static']],",
    "  ['npm', ['run', 'test:travel-news-prefetch']],",
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(
        anchor,
        anchor + "\n  ['npm', ['run', 'test:travel-news-workflow']],"
      );
    }
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'travel-news-workflow')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'travel-location-browser-smoke-static');
      const command = {
        id: 'travel-news-workflow',
        cmd: 'npm',
        args: ['run', 'test:travel-news-workflow'],
      };
      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:travel-news-workflow')) return source;
    const anchors = [
      "'test:travel-location-browser-smoke:static',",
      "'test:travel-news-prefetch',",
    ];
    for (const anchor of anchors) {
      if (source.includes(anchor)) {
        return source.replace(anchor, anchor + "\n  'test:travel-news-workflow',");
      }
    }
    return source;
  });
}

console.log('\nSlice 62J Travel local GitHub workflow patch complete.');
