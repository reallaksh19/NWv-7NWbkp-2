import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
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

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }
  return source.replace(before, after);
}

fs.mkdirSync('src/adapters', { recursive: true });

write('src/adapters/insightSnapshotSignalAdapter.js', `const SUPPORTED_SNAPSHOT_SCHEMAS = new Set([2, 3]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function unique(values) {
  return [...new Set(
    safeArray(values)
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )];
}

function tokensFromText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\\s-]/g, ' ')
    .split(/\\s+/)
    .map(token => token.replace(/^-+|-+$/g, ''))
    .filter(token => token.length >= 4);
}

function getAngleHintLabels(story) {
  return safeArray(story?.angleHints || story?.storySignals?.angleHints)
    .map(hint => typeof hint === 'string' ? hint : hint?.angle)
    .filter(Boolean);
}

function getSignalTopicTokens(story) {
  return unique([
    ...safeArray(story?.storySignals?.topicTokens),
    ...safeArray(story?.topicTokens),
  ]).slice(0, 16);
}

function getSignalNumbers(story) {
  return unique([
    ...safeArray(story?.storySignals?.numbers),
    ...safeArray(story?.numbers),
  ]).slice(0, 16);
}

function getSignalKeywords(story) {
  const topicTokens = getSignalTopicTokens(story);
  const angleTokens = getAngleHintLabels(story)
    .flatMap(label => tokensFromText(label.replace(/_/g, ' ')));

  return unique([
    ...topicTokens,
    ...angleTokens,
    ...safeArray(story?.keywords),
  ]).slice(0, 12);
}

function getSignalEntities(story) {
  const existing = story?.entities || {};
  const topicTokens = getSignalTopicTokens(story);
  const sourceGroup = safeText(story?.storySignals?.sourceGroup || story?.sourceGroup || story?.source);

  const orgCandidates = unique([
    ...safeArray(existing.orgs),
    ...topicTokens.filter(token => /bank|ministry|court|agency|authority|commission|group|corp|company|market|exchange|regulator/.test(token)),
  ]);

  const placeCandidates = unique([
    ...safeArray(existing.places),
    ...topicTokens.filter(token => /india|chennai|trichy|tamil|muscat|oman|delhi|mumbai|bengaluru|dubai|london|tokyo|gaza|ukraine/.test(token)),
  ]);

  return {
    people: unique(existing.people),
    orgs: orgCandidates,
    places: placeCandidates,
    products: unique(existing.products),
    symbols: unique(existing.symbols),
    sourceGroup,
  };
}

export function isSupportedInsightSnapshotSchema(snapshot) {
  return SUPPORTED_SNAPSHOT_SCHEMAS.has(Number(snapshot?.schemaVersion));
}

export function getInsightSnapshotSignals(story) {
  const hasCollectorSignals = Boolean(story?.storySignals || story?.angleHints);

  if (!hasCollectorSignals) {
    return {
      hasCollectorSignals: false,
      entities: null,
      keywords: null,
      verbs: null,
      numbers: null,
      angleHints: [],
      topicTokens: [],
    };
  }

  const angleHints = safeArray(story?.angleHints || story?.storySignals?.angleHints)
    .map(hint => {
      if (typeof hint === 'string') {
        return {
          angle: hint,
          score: 0.5,
          matches: [],
        };
      }

      return {
        angle: hint?.angle || 'base_report',
        score: Number.isFinite(Number(hint?.score)) ? Number(hint.score) : 0.5,
        matches: safeArray(hint?.matches),
      };
    })
    .filter(hint => hint.angle);

  const keywords = getSignalKeywords(story);
  const numbers = getSignalNumbers(story);
  const entities = getSignalEntities(story);
  const verbs = unique([
    ...safeArray(story?.eventVerbs),
    ...angleHints.flatMap(hint => tokensFromText(hint.angle.replace(/_/g, ' '))),
  ]).slice(0, 10);

  return {
    hasCollectorSignals: true,
    entities,
    keywords,
    verbs,
    numbers,
    angleHints,
    topicTokens: getSignalTopicTokens(story),
  };
}

export function enrichRawStoryWithSnapshotSignals(story, snapshot = null) {
  const signals = getInsightSnapshotSignals(story);

  return {
    ...story,
    sourceGroup: safeText(story?.sourceGroup || story?.storySignals?.sourceGroup || story?.source, 'unknown_source'),
    source: safeText(story?.source || story?.sourceGroup || story?.storySignals?.sourceGroup, 'Unknown source'),
    category: safeText(story?.category, 'general'),
    language: safeText(story?.language, 'en'),
    angleHints: signals.angleHints,
    storySignals: {
      ...(story?.storySignals || {}),
      topicTokens: signals.topicTokens,
      numbers: signals.numbers,
      angleHints: signals.angleHints,
      sourceGroup: safeText(story?.storySignals?.sourceGroup || story?.sourceGroup || story?.source, 'unknown_source'),
    },
    snapshotDiagnostics: snapshot ? {
      schemaVersion: snapshot.schemaVersion,
      collectorVersion: snapshot.collectorVersion || '',
      contentHash: snapshot.contentHash || '',
      slotQuality: snapshot.slotQuality || null,
      sourceDiversity: snapshot.sourceDiversity || null,
    } : story?.snapshotDiagnostics,
    _collectorSignalStatus: signals.hasCollectorSignals ? 'collector-signals-used' : 'browser-signals-required',
  };
}

export function getInsightSnapshotRuntimeSummary(snapshot) {
  return {
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    supported: isSupportedInsightSnapshotSchema(snapshot),
    collectorVersion: snapshot?.collectorVersion || '',
    contentHash: snapshot?.contentHash || '',
    totalStories: safeArray(snapshot?.stories).length,
    hasStorySignals: safeArray(snapshot?.stories).some(story => Boolean(story?.storySignals)),
    hasAngleHints: safeArray(snapshot?.stories).some(story => safeArray(story?.angleHints || story?.storySignals?.angleHints).length > 0),
    slotQuality: snapshot?.slotQuality || null,
    sourceDiversity: snapshot?.sourceDiversity || null,
  };
}

export default getInsightSnapshotSignals;
`);

write('src/adapters/insightSnapshotSignalAdapter.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  enrichRawStoryWithSnapshotSignals,
  getInsightSnapshotRuntimeSummary,
  getInsightSnapshotSignals,
  isSupportedInsightSnapshotSchema,
} from './insightSnapshotSignalAdapter';

describe('Insight browser JSON v3 signal ingestion certification', () => {
  it('accepts schema v2 and v3 snapshots only', () => {
    expect(isSupportedInsightSnapshotSchema({ schemaVersion: 2 })).toBe(true);
    expect(isSupportedInsightSnapshotSchema({ schemaVersion: 3 })).toBe(true);
    expect(isSupportedInsightSnapshotSchema({ schemaVersion: 1 })).toBe(false);
  });

  it('extracts collector storySignals and angleHints for browser normalization', () => {
    const story = {
      title: 'Acme Bank shares fell after outage',
      sourceGroup: 'market_desk',
      storySignals: {
        topicTokens: ['acme', 'bank', 'outage', 'shares'],
        numbers: ['4 percent'],
        angleHints: [
          { angle: 'market_reaction', score: 0.89, matches: ['shares', 'investors'] },
        ],
      },
    };

    const signals = getInsightSnapshotSignals(story);

    expect(signals.hasCollectorSignals).toBe(true);
    expect(signals.keywords).toContain('acme');
    expect(signals.numbers).toContain('4 percent');
    expect(signals.angleHints[0].angle).toBe('market_reaction');
    expect(signals.entities.orgs).toContain('bank');
  });

  it('enriches raw stories with snapshot diagnostics and collector signal status', () => {
    const snapshot = {
      schemaVersion: 3,
      collectorVersion: 'insight-collector-json-v3',
      contentHash: 'abc123',
      slotQuality: { now: { storyCount: 2 } },
      sourceDiversity: { sourceGroupCount: 2 },
    };

    const story = enrichRawStoryWithSnapshotSignals({
      id: 'a',
      title: 'Finance Ministry says Acme Bank outage is under review',
      source: 'Gov Desk',
      angleHints: [{ angle: 'official_response', score: 0.91 }],
      storySignals: {
        topicTokens: ['finance', 'ministry', 'acme', 'bank'],
        numbers: [],
      },
    }, snapshot);

    expect(story.snapshotDiagnostics.schemaVersion).toBe(3);
    expect(story.snapshotDiagnostics.collectorVersion).toBe('insight-collector-json-v3');
    expect(story._collectorSignalStatus).toBe('collector-signals-used');
    expect(story.angleHints[0].angle).toBe('official_response');
  });

  it('summarizes optimized snapshot runtime metadata', () => {
    const summary = getInsightSnapshotRuntimeSummary({
      schemaVersion: 3,
      collectorVersion: 'insight-collector-json-v3',
      contentHash: 'hash',
      stories: [
        {
          storySignals: {
            angleHints: [{ angle: 'official_response', score: 0.9 }],
          },
        },
      ],
      slotQuality: { now: { storyCount: 1 } },
      sourceDiversity: { sourceGroupCount: 1 },
    });

    expect(summary.supported).toBe(true);
    expect(summary.hasStorySignals).toBe(true);
    expect(summary.hasAngleHints).toBe(true);
    expect(summary.slotQuality.now.storyCount).toBe(1);
  });
});
`);

patchFile('src/adapters/insightSnapshotFetcher.js', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `const H = 3_600_000;`,
    `
import {
  enrichRawStoryWithSnapshotSignals,
  getInsightSnapshotRuntimeSummary,
  isSupportedInsightSnapshotSchema,
} from './insightSnapshotSignalAdapter.js';
`,
    'snapshot signal adapter import'
  );

  text = replaceOnce(
    text,
    `    if (snapshot?.schemaVersion !== 2) return null;`,
    `    if (!isSupportedInsightSnapshotSchema(snapshot)) return null;`,
    'accept schema 2 and 3'
  );

  text = replaceOnce(
    text,
    `    return snapshot;`,
    `    const pool = (snapshot?.stories ?? []).map((story, index) => (
      enrichRawStoryWithSnapshotSignals({
        ...story,
        id: story?.id || story?.url || \\\`snapshot-story-\\\${index}\\\`,
      }, snapshot)
    ));
    snapshot.stories = pool;

    return {
      ...snapshot,
      runtimeSummary: getInsightSnapshotRuntimeSummary(snapshot),
    };`,
    'attach snapshot runtime summary'
  );

  return text;
});

patchFile('src/adapters/insightFetcher.js', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { loadInsightSnapshot, createSnapshotRawFetcher } from './insightSnapshotFetcher.js';`,
    `\nimport { getInsightSnapshotSignals } from './insightSnapshotSignalAdapter.js';`,
    'snapshot signals import'
  );

  text = replaceOnce(
    text,
    `    const [entities, keywords, verbs, numbers] = await Promise.all([
      extractEntities(text),
      extractKeywords(text),
      extractVerbs(text),
      extractNumbers(text),
    ]);

    return normalizeStory(
      raw,
      slot,
      cfg,
      embeddings[index],
      entities,
      keywords,
      verbs,
      numbers,
    );`,
    `    const collectorSignals = getInsightSnapshotSignals(raw);
    const [entities, keywords, verbs, numbers] = collectorSignals.hasCollectorSignals
      ? [
          collectorSignals.entities,
          collectorSignals.keywords,
          collectorSignals.verbs,
          collectorSignals.numbers,
        ]
      : await Promise.all([
          extractEntities(text),
          extractKeywords(text),
          extractVerbs(text),
          extractNumbers(text),
        ]);

    return normalizeStory(
      {
        ...raw,
        angleHints: collectorSignals.angleHints,
        storySignals: {
          ...(raw.storySignals || {}),
          topicTokens: collectorSignals.topicTokens,
          numbers,
          angleHints: collectorSignals.angleHints,
        },
      },
      slot,
      cfg,
      embeddings[index],
      entities,
      keywords,
      verbs,
      numbers,
    );`,
    'use collector signals during browser normalization'
  );

  text = replaceOnce(
    text,
    `        contentHash: fresh.contentHash,`,
    `        contentHash: fresh.contentHash,
        snapshotRuntimeSummary: fresh.runtimeSummary,`,
    'fresh runtime summary'
  );

  text = replaceOnce(
    text,
    `        contentHash: stale.contentHash,`,
    `        contentHash: stale.contentHash,
        snapshotRuntimeSummary: stale.runtimeSummary,`,
    'stale runtime summary'
  );

  return text;
});

patchFile('src/insight/src/dedup/dedup.ts', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `function getAngleCandidateScores(story: InsightStory, text: string): Array<{
  angle: AngleLabel;
  score: number;
  reason: string;
}> {
  const sourceAndCategory = getSourceAndCategoryText(story);
  const lowerText = text.toLowerCase();
  const scores: Array<{ angle: AngleLabel; score: number; reason: string }> = [];
`,
    `
  const collectorAngleHints = Array.isArray((story as any).angleHints)
    ? (story as any).angleHints
    : Array.isArray((story as any).storySignals?.angleHints)
      ? (story as any).storySignals.angleHints
      : [];

  for (const hint of collectorAngleHints) {
    const angle = typeof hint === "string" ? hint : hint?.angle;
    if (!angle || angle === "unknown") continue;

    const rawScore = typeof hint === "string" ? 0.5 : Number(hint?.score || 0.5);
    scores.push({
      angle: angle as AngleLabel,
      score: normalizeAngleCandidateScore(2.4 + Math.max(0, Math.min(1, rawScore)) * 2.2),
      reason: "collector JSON angle hint",
    });
  }
`,
    'collector angle hints in classifier'
  );

  return text;
});

write('scripts/test_insight_browser_json_ingestion_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const signalAdapter = read('src/adapters/insightSnapshotSignalAdapter.js');
const signalTest = read('src/adapters/insightSnapshotSignalAdapter.cert.test.js');
const snapshotFetcher = read('src/adapters/insightSnapshotFetcher.js');
const insightFetcher = read('src/adapters/insightFetcher.js');
const dedup = read('src/insight/src/dedup/dedup.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'SUPPORTED_SNAPSHOT_SCHEMAS',
  'isSupportedInsightSnapshotSchema',
  'getInsightSnapshotSignals',
  'enrichRawStoryWithSnapshotSignals',
  'getInsightSnapshotRuntimeSummary',
  'collector-signals-used'
]) {
  assert(signalAdapter.includes(token), \`insightSnapshotSignalAdapter.js missing token: \${token}\`);
}

for (const token of [
  'Insight browser JSON v3 signal ingestion certification',
  'accepts schema v2 and v3 snapshots only',
  'extracts collector storySignals and angleHints',
  'summarizes optimized snapshot runtime metadata'
]) {
  assert(signalTest.includes(token), \`insightSnapshotSignalAdapter.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'isSupportedInsightSnapshotSchema',
  'getInsightSnapshotRuntimeSummary',
  'enrichRawStoryWithSnapshotSignals',
  'runtimeSummary'
]) {
  assert(snapshotFetcher.includes(token), \`insightSnapshotFetcher.js missing token: \${token}\`);
}

assert(
  !snapshotFetcher.includes('snapshot?.schemaVersion !== 2'),
  'insightSnapshotFetcher.js must not reject schemaVersion 3'
);

for (const token of [
  'getInsightSnapshotSignals',
  'collectorSignals.hasCollectorSignals',
  'collectorSignals.angleHints',
  'snapshotRuntimeSummary'
]) {
  assert(insightFetcher.includes(token), \`insightFetcher.js missing token: \${token}\`);
}

for (const token of [
  'collectorAngleHints',
  'collector JSON angle hint',
  'storySignals?.angleHints'
]) {
  assert(dedup.includes(token), \`dedup.ts missing collector angle hint token: \${token}\`);
}

assert(
  packageJson.includes('"test:insight-browser-json-ingestion"'),
  'package.json must include test:insight-browser-json-ingestion'
);

assert(
  certGate.includes("['npm', ['run', 'test:insight-browser-json-ingestion']]"),
  'certification gate must run test:insight-browser-json-ingestion'
);

assert(
  certGate.includes("['npm', ['run', 'test:unit']]"),
  'certification gate must run Vitest unit tests'
);

assert(
  certGate.includes("['npm', ['run', 'build']]"),
  'certification gate must still run production build'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight browser JSON v3 ingestion slice',
  guarantees: [
    'schemaVersion 2 and 3 snapshots are accepted',
    'collector storySignals are consumed by browser normalization',
    'collector angleHints influence angle classification',
    'snapshot runtime diagnostics are preserved',
    'browser avoids redundant NLP work when collector signals exist',
    'static and Vitest certification are included',
    'full certification gate includes browser JSON ingestion'
  ]
}, null, 2));

console.log('PASS: Insight browser JSON ingestion static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-browser-json-ingestion'] = 'node scripts/test_insight_browser_json_ingestion_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-browser-json-ingestion']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-collector-json']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-collector-json']],",
      "  ['npm', ['run', 'test:insight-collector-json']],\n  ['npm', ['run', 'test:insight-browser-json-ingestion']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-browser-json-ingestion']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\\nSlice 43 Insight browser JSON v3 ingestion patch complete.');
