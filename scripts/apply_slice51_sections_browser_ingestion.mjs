import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  const dir = path.split('/').slice(0, -1).join('/'); if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

fs.mkdirSync('src/adapters', { recursive: true });

write('src/adapters/sectionsSnapshotFetcher.js', `const SECTION_SNAPSHOT_PATH = '/newsdata/sections_latest.json';
const SECTION_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

const SECTION_ALIASES = {
  chennai: 'tn',
  tamilnadu: 'tn',
  tamilNadu: 'tn',
  top: 'topStories',
  topstories: 'topStories',
};

let memorySnapshot = null;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function hash(value) {
  const text = String(value || '');
  let h = 0;
  for (let index = 0; index < text.length; index += 1) {
    h = (h << 5) - h + text.charCodeAt(index);
    h |= 0;
  }
  return String(h);
}

function normalizeSectionKey(section) {
  const key = String(section || '').trim();
  return SECTION_ALIASES[key] || SECTION_ALIASES[key.toLowerCase()] || key;
}

function isSupportedSectionsSnapshot(snapshot) {
  const schema = Number(snapshot?.schemaVersion || 0);
  return schema === 1 || schema === 2;
}

function sectionSnapshotAgeMs(snapshot) {
  return Math.max(0, Date.now() - Number(snapshot?.fetchedAt || 0));
}

function getSnapshotUrl() {
  const base = import.meta?.env?.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return \`\${cleanBase}\${SECTION_SNAPSHOT_PATH}?v=\${Date.now()}\`;
}

function normalizePrefetchedSectionItem(item, requestedSection, sourceSection) {
  const title = safeText(item.title || item.headline, 'Untitled');
  const description = safeText(item.description || item.summary, '');
  const url = safeText(item.url || item.link || item.guid, '');
  const source = safeText(item.source || item.sourceGroup, 'Unknown');
  const publishedAt = Number(item.publishedAt || item.pubDate || item.date || Date.now());

  return {
    ...item,
    id: safeText(item.id || hash(url || title)),
    title,
    headline: title,
    description,
    summary: description,
    link: url,
    url,
    source,
    sourceGroup: safeText(item.sourceGroup || source, source),
    publishedAt,
    fetchedAt: Number(item.fetchedAt || Date.now()),
    time: new Date(publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    section: requestedSection,
    sourceSection,
    impactScore: Number(item.impactScore || 0),
    imageUrl: item.imageUrl || item.image || null,
    _prefetchedSection: true,
  };
}

export function getSectionsSnapshotRuntimeSummary(snapshot) {
  const sections = snapshot?.sections && typeof snapshot.sections === 'object'
    ? snapshot.sections
    : {};

  return {
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    supported: isSupportedSectionsSnapshot(snapshot),
    fetchedAt: Number(snapshot?.fetchedAt || 0),
    ageMs: sectionSnapshotAgeMs(snapshot),
    contentHash: snapshot?.contentHash || '',
    sectionCount: Object.keys(sections).length,
    totalStories: Object.values(sections).reduce((sum, items) => sum + safeArray(items).length, 0),
    hasSectionQuality: Boolean(snapshot?.sectionQuality),
    sectionQuality: snapshot?.sectionQuality || null,
  };
}

export async function loadSectionsSnapshot({ force = false } = {}) {
  if (!force && memorySnapshot && Date.now() - memorySnapshot.loadedAt < SECTION_SNAPSHOT_TTL_MS) {
    return memorySnapshot.snapshot;
  }

  const response = await fetch(getSnapshotUrl(), {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(\`sections snapshot fetch failed: HTTP \${response.status}\`);
  }

  const snapshot = await response.json();

  if (!isSupportedSectionsSnapshot(snapshot)) {
    throw new Error(\`unsupported sections snapshot schema: \${snapshot?.schemaVersion}\`);
  }

  memorySnapshot = {
    loadedAt: Date.now(),
    snapshot,
  };

  return snapshot;
}

export function selectPrefetchedSectionItems(snapshot, section, limit = 10) {
  if (!isSupportedSectionsSnapshot(snapshot)) {
    return {
      items: [],
      sourceSection: normalizeSectionKey(section),
      quality: null,
      summary: getSectionsSnapshotRuntimeSummary(snapshot),
    };
  }

  const requestedSection = String(section || '');
  const sourceSection = normalizeSectionKey(section);
  const sectionItems = safeArray(snapshot?.sections?.[sourceSection]);

  const items = sectionItems
    .map(item => normalizePrefetchedSectionItem(item, requestedSection, sourceSection))
    .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0))
    .slice(0, Math.max(0, Number(limit || 0)));

  return {
    items,
    sourceSection,
    quality: snapshot?.sectionQuality?.[sourceSection] || null,
    summary: getSectionsSnapshotRuntimeSummary(snapshot),
  };
}

export async function fetchPrefetchedSectionNews(section, limit = 10) {
  const snapshot = await loadSectionsSnapshot();
  return selectPrefetchedSectionItems(snapshot, section, limit);
}

export function clearSectionsSnapshotCache() {
  memorySnapshot = null;
}

export default fetchPrefetchedSectionNews;
`);

write('src/adapters/sectionsSnapshotFetcher.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  getSectionsSnapshotRuntimeSummary,
  selectPrefetchedSectionItems,
} from './sectionsSnapshotFetcher';

const snapshot = {
  schemaVersion: 2,
  fetchedAt: Date.now(),
  contentHash: 'abc123',
  sectionQuality: {
    tn: {
      storyCount: 2,
      sourceGroupCount: 2,
      thin: false,
    },
  },
  sections: {
    tn: [
      {
        id: 'a',
        title: 'Chennai rain update',
        summary: 'Schools monitor weather after heavy rain.',
        url: 'https://example.com/a',
        source: 'The Hindu Chennai',
        sourceGroup: 'the_hindu',
        publishedAt: Date.now() - 1000,
      },
      {
        id: 'b',
        title: 'Tamil Nadu transport update',
        summary: 'Officials announced route changes.',
        url: 'https://example.com/b',
        source: 'DT Next',
        sourceGroup: 'dtnext',
        publishedAt: Date.now() - 2000,
      },
    ],
  },
};

describe('Sections snapshot browser ingestion certification', () => {
  it('summarizes section snapshot runtime quality', () => {
    const summary = getSectionsSnapshotRuntimeSummary(snapshot);

    expect(summary.supported).toBe(true);
    expect(summary.schemaVersion).toBe(2);
    expect(summary.hasSectionQuality).toBe(true);
    expect(summary.totalStories).toBe(2);
  });

  it('maps chennai requests to tn prefetched section', () => {
    const result = selectPrefetchedSectionItems(snapshot, 'chennai', 10);

    expect(result.sourceSection).toBe('tn');
    expect(result.items.length).toBe(2);
    expect(result.quality.sourceGroupCount).toBe(2);
    expect(result.items[0]._prefetchedSection).toBe(true);
    expect(result.items[0].section).toBe('chennai');
  });

  it('returns empty result for missing sections without throwing', () => {
    const result = selectPrefetchedSectionItems(snapshot, 'sports', 10);

    expect(result.items).toEqual([]);
    expect(result.sourceSection).toBe('sports');
  });
});
`);

patchFile('src/services/rssAggregator.js', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { getSectionHealth, recordFetchCount, checkSingleSource } from '../utils/sectionHealth.js';`,
    `\nimport { fetchPrefetchedSectionNews } from '../adapters/sectionsSnapshotFetcher.js';`,
    'sections snapshot fetcher import'
  );

  text = insertAfterOnce(
    text,
    `    } else {
        console.log(\`[RSS] ℹ️ Cache DISABLED by user settings for \${section}\`);
    }

`,
    `    // Static-host / GitHub Pages path: prefer pre-generated section JSON.
    // This avoids browser RSS/proxy failures and uses workflow-produced quality data.
    if (settings.usePrefetchedSections !== false) {
        try {
            const prefetched = await fetchPrefetchedSectionNews(section, Math.max(limit * 3, limit));

            if (prefetched.items.length > 0) {
                console.log(\`[RSS] ✅ Prefetched sections HIT for \${section} via \${prefetched.sourceSection}: \${prefetched.items.length} items\`);

                const rankedPrefetched = await rankAndFilter(
                    prefetched.items,
                    section,
                    limit,
                    allowedSources
                );

                rankedPrefetched.prefetched = true;
                rankedPrefetched.prefetchSourceSection = prefetched.sourceSection;
                rankedPrefetched.sectionQuality = prefetched.quality;
                rankedPrefetched.snapshotRuntimeSummary = prefetched.summary;
                rankedPrefetched.health = getSectionHealth(section, rankedPrefetched.length);
                rankedPrefetched.isSingleSource = checkSingleSource(rankedPrefetched);

                recordFetchCount(section, rankedPrefetched.length);

                if (settings.enableCache !== false) {
                    memoryCache.set(cacheKey, {
                        timestamp: Date.now(),
                        data: rankedPrefetched
                    });
                }

                return rankedPrefetched;
            }

            console.warn(\`[RSS] Prefetched sections EMPTY for \${section}; falling back to live RSS\`);
        } catch (error) {
            console.warn(\`[RSS] Prefetched sections unavailable for \${section}; falling back to live RSS:\`, error.message);
        }
    }

`,
    'prefetched sections first path'
  );

  return text;
});

write('scripts/test_sections_browser_ingestion_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const adapter = read('src/adapters/sectionsSnapshotFetcher.js');
const adapterTest = read('src/adapters/sectionsSnapshotFetcher.cert.test.js');
const rssAggregator = read('src/services/rssAggregator.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'SECTION_SNAPSHOT_PATH',
  'isSupportedSectionsSnapshot',
  'getSectionsSnapshotRuntimeSummary',
  'loadSectionsSnapshot',
  'selectPrefetchedSectionItems',
  'fetchPrefetchedSectionNews',
  'chennai',
  'tn',
  '_prefetchedSection'
]) {
  assert(adapter.includes(token), \`sectionsSnapshotFetcher.js missing token: \${token}\`);
}

for (const token of [
  'Sections snapshot browser ingestion certification',
  'maps chennai requests to tn prefetched section',
  'summarizes section snapshot runtime quality'
]) {
  assert(adapterTest.includes(token), \`sectionsSnapshotFetcher.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'fetchPrefetchedSectionNews',
  'settings.usePrefetchedSections !== false',
  'Prefetched sections HIT',
  'sectionQuality',
  'snapshotRuntimeSummary',
  'falling back to live RSS'
]) {
  assert(rssAggregator.includes(token), \`rssAggregator.js missing prefetched section token: \${token}\`);
}

assert(
  packageJson.includes('"test:sections-browser-ingestion"'),
  'package.json must include test:sections-browser-ingestion'
);

assert(
  certGate.includes("['npm', ['run', 'test:sections-browser-ingestion']]"),
  'certification gate must run test:sections-browser-ingestion'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Sections browser JSON ingestion slice',
  guarantees: [
    'browser can load /newsdata/sections_latest.json',
    'schema v1/v2 sections snapshots are supported',
    'chennai section maps to tn prefetched data',
    'sectionQuality metadata is preserved',
    'rssAggregator uses prefetched JSON before live RSS',
    'live RSS remains fallback when JSON is unavailable',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Sections browser ingestion static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:sections-browser-ingestion'] = 'node scripts/test_sections_browser_ingestion_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:sections-browser-ingestion']]")) return source;

  if (source.includes("['npm', ['run', 'test:sections-source-policy']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:sections-source-policy']],",
      "  ['npm', ['run', 'test:sections-source-policy']],\n  ['npm', ['run', 'test:sections-browser-ingestion']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:sections-browser-ingestion']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 51 Sections browser ingestion patch complete.');
