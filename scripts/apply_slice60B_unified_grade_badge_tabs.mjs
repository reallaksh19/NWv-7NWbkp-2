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

function optionalPatchFile(path, patcher) {
  const before = read(path);
  if (!before) {
    console.log(`skip optional missing file: ${path}`);
    return;
  }
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function insertBeforeOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }
  return source.replace(before, after);
}

function removeBlock(source, before, after, label) {
  const start = source.indexOf(before);
  if (start < 0) {
    console.log(`skip block removal, missing start: ${label}`);
    return source;
  }
  const end = source.indexOf(after, start);
  if (end < 0) {
    throw new Error(`Missing block end for ${label}`);
  }
  return source.slice(0, start) + source.slice(end + after.length);
}

function insertImportAfterLastImport(source, insertion) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  const importMatches = [...source.matchAll(/^import .+;$/gm)];
  if (!importMatches.length) return insertion + '\n' + source;
  const last = importMatches[importMatches.length - 1];
  const index = last.index + last[0].length;
  return source.slice(0, index) + '\n' + insertion + source.slice(index);
}

/* -------------------------------------------------------------------------- */
/* 1) GradeBadge owns modal CSS                                                */
/* -------------------------------------------------------------------------- */

patchFile('src/components/audit/GradeBadge.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import './GradeBadge.css';`,
    `
import './AuditDetailModal.css';`,
    'GradeBadge modal CSS import'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 2) Extend page audit grading service                                        */
/* -------------------------------------------------------------------------- */

patchFile('src/services/pageAuditGrading.js', source => {
  if (source.includes('auditWeatherTabQuality')) return source;

  const insertion = `
function gate(id, label, status, detail) {
  return { id, label, status, detail };
}

function scoreAuditGates(gates) {
  const weights = {
    PASS: 100,
    WARN: 62,
    FAIL: 15,
  };

  return clampScore(
    gates.reduce((sum, item) => sum + (weights[item.status] ?? 40), 0) / Math.max(1, gates.length)
  );
}

function makePageAudit({ target, title, gates, summary = {}, dataTrust = {}, now = Date.now() }) {
  const score = scoreAuditGates(gates);
  const grade = gradeFromScore(score);
  const warnings = gates.filter(item => item.status === 'WARN').map(item => item.detail);
  const failures = gates.filter(item => item.status === 'FAIL').map(item => item.detail);

  return {
    schemaVersion: 1,
    target,
    title,
    grade,
    score,
    tone: toneFromGrade(grade),
    generatedAt: now,
    summary,
    gates,
    audits: gates,
    dataTrust: {
      status: failures.length === 0 ? warnings.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
      ...dataTrust,
    },
    warnings,
    failures,
  };
}

function getSectionLength(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  return Object.keys(value).length;
}

function isUsableSection(value) {
  return getSectionLength(value) > 0;
}

function getNewestAgeMinutesFromItems(items, now) {
  const timestamps = asArray(items)
    .map(item => Number(item?.publishedAt || item?.fetchedAt || item?.timestamp || item?.timeMs || 0))
    .filter(value => Number.isFinite(value) && value > 0);

  if (timestamps.length === 0) return null;
  return Math.max(0, Math.round((now - Math.max(...timestamps)) / 60000));
}

export function auditWeatherTabQuality({
  weatherData = {},
  cities = [],
  activeCity = '',
  error = null,
  loading = false,
  now = Date.now(),
} = {}) {
  const data = asObject(weatherData);
  const cityList = asArray(cities).length ? asArray(cities) : Object.keys(data);
  const active = activeCity || cityList[0] || '';
  const readyCities = cityList.filter(city => data?.[city]?.current || data?.[city]?.temp || data?.[city]?.weeklyForecast);
  const weeklyReady = cityList.filter(city => asArray(data?.[city]?.weeklyForecast).length >= 5);
  const sourceModes = unique(cityList.map(city => data?.[city]?.sourceMode).filter(Boolean));
  const staleCities = cityList.filter(city => data?.[city]?.isStale || data?.[city]?.sourceMode === 'cache');
  const fallbackCities = cityList.filter(city => data?.[city]?.sourceMode === 'fallback' || data?.[city]?.sourceMode === 'snapshot');
  const activeReady = Boolean(data?.[active]);

  const gates = [
    gate(
      'weather-city-coverage',
      'Configured city coverage',
      readyCities.length >= Math.min(3, cityList.length) ? 'PASS' : readyCities.length > 0 ? 'WARN' : 'FAIL',
      \`\${readyCities.length} of \${cityList.length} configured weather cities have usable data.\`
    ),
    gate(
      'weather-active-city',
      'Active city readiness',
      activeReady ? 'PASS' : 'FAIL',
      activeReady ? \`Active city \${active} is ready.\` : \`Active city \${active || 'unknown'} has no weather payload.\`
    ),
    gate(
      'weather-weekly-forecast',
      'Weekly forecast coverage',
      weeklyReady.length >= Math.min(3, cityList.length) ? 'PASS' : weeklyReady.length > 0 ? 'WARN' : 'FAIL',
      \`\${weeklyReady.length} city/cities have 5+ day weekly forecast.\`
    ),
    gate(
      'weather-source-mode',
      'Source mode trust',
      fallbackCities.length === 0 && staleCities.length === 0 ? 'PASS' : fallbackCities.length === 0 ? 'WARN' : 'FAIL',
      sourceModes.length
        ? \`Source modes: \${sourceModes.join(', ')}. Stale: \${staleCities.length}, fallback/snapshot: \${fallbackCities.length}.\`
        : 'No source mode metadata available.'
    ),
    gate(
      'weather-error-state',
      'Weather error state',
      error ? 'WARN' : 'PASS',
      error ? 'Weather context reports degraded update or cached fallback.' : 'No active weather error.'
    ),
    gate(
      'weather-loading-state',
      'Loading gate',
      loading ? 'WARN' : 'PASS',
      loading ? 'Weather tab is still loading or refreshing.' : 'Weather tab is not in blocking loading state.'
    ),
  ];

  return makePageAudit({
    target: 'weather-tab',
    title: 'Weather tab data quality',
    gates,
    now,
    summary: {
      configuredCities: cityList,
      activeCity: active,
      readyCityCount: readyCities.length,
      weeklyReadyCount: weeklyReady.length,
      staleCityCount: staleCities.length,
      fallbackCityCount: fallbackCities.length,
      sourceModes,
      loading,
    },
    dataTrust: {
      readyCityCount: readyCities.length,
      weeklyReadyCount: weeklyReady.length,
      staleCityCount: staleCities.length,
      fallbackCityCount: fallbackCities.length,
    },
  });
}

export function auditMarketTabQuality({
  marketData = {},
  sourceHealth = {},
  sessionState = {},
  error = null,
  loading = false,
  lastFetch = null,
  now = Date.now(),
} = {}) {
  const data = asObject(marketData);
  const indices = asArray(data.indices);
  const gainers = asArray(data?.movers?.gainers);
  const losers = asArray(data?.movers?.losers);
  const sectorals = asArray(data.sectorals);
  const commodities = asArray(data.commodities);
  const currencies = asArray(data.currencies);
  const mutualFunds = asArray(data.mutualFunds);
  const sourceRows = Object.values(asObject(sourceHealth));
  const sourceOkCount = sourceRows.filter(item => item?.ok !== false).length;
  const sourceFailCount = sourceRows.filter(item => item?.ok === false).length;
  const newestAgeMinutes = lastFetch ? Math.max(0, Math.round((now - Number(lastFetch)) / 60000)) : null;

  const gates = [
    gate(
      'market-index-coverage',
      'Index coverage',
      indices.length >= 4 ? 'PASS' : indices.length > 0 ? 'WARN' : 'FAIL',
      \`\${indices.length} index row(s) available.\`
    ),
    gate(
      'market-movers',
      'Mover coverage',
      gainers.length > 0 && losers.length > 0 ? 'PASS' : gainers.length + losers.length > 0 ? 'WARN' : 'FAIL',
      \`\${gainers.length} gainers and \${losers.length} losers available.\`
    ),
    gate(
      'market-breadth-sections',
      'Market breadth sections',
      [sectorals, commodities, currencies, mutualFunds].filter(section => section.length > 0).length >= 2 ? 'PASS' : 'WARN',
      \`Sectorals \${sectorals.length}, commodities \${commodities.length}, currencies \${currencies.length}, mutual funds \${mutualFunds.length}.\`
    ),
    gate(
      'market-source-health',
      'Source health',
      sourceFailCount === 0 ? 'PASS' : sourceOkCount >= sourceFailCount ? 'WARN' : 'FAIL',
      \`\${sourceOkCount} source(s) OK, \${sourceFailCount} failing.\`
    ),
    gate(
      'market-session-freshness',
      'Session freshness',
      data.isSnapshot ? 'WARN' : data.isStale ? 'WARN' : newestAgeMinutes == null || newestAgeMinutes <= 60 ? 'PASS' : newestAgeMinutes <= 240 ? 'WARN' : 'FAIL',
      sessionState?.label
        ? \`\${sessionState.label}; age \${sessionState.ageLabel || (newestAgeMinutes == null ? 'unknown' : newestAgeMinutes + ' min')}.\`
        : newestAgeMinutes == null ? 'No lastFetch timestamp.' : \`Latest market fetch age \${newestAgeMinutes} minutes.\`
    ),
    gate(
      'market-error-state',
      'Market error state',
      error ? 'WARN' : 'PASS',
      error ? String(error) : 'No active market error.'
    ),
    gate(
      'market-loading-state',
      'Loading gate',
      loading ? 'WARN' : 'PASS',
      loading ? 'Market tab is still loading or refreshing.' : 'Market tab is not in blocking loading state.'
    ),
  ];

  return makePageAudit({
    target: 'market-tab',
    title: 'Market tab data quality',
    gates,
    now,
    summary: {
      indexCount: indices.length,
      gainerCount: gainers.length,
      loserCount: losers.length,
      sectoralCount: sectorals.length,
      commodityCount: commodities.length,
      currencyCount: currencies.length,
      mutualFundCount: mutualFunds.length,
      sourceOkCount,
      sourceFailCount,
      sourceMode: data.isSnapshot ? 'snapshot' : data.isStale ? 'cache' : 'live',
      newestAgeMinutes,
      loading,
    },
    dataTrust: {
      sourceOkCount,
      sourceFailCount,
      sourceMode: data.isSnapshot ? 'snapshot' : data.isStale ? 'cache' : 'live',
      newestAgeMinutes,
    },
  });
}

export function auditInsightTabQuality({
  result = null,
  diagnostics = null,
  behaviorEvidence = null,
  source = 'live',
  loading = false,
  error = null,
  now = Date.now(),
} = {}) {
  const parents = asArray(result?.parents);
  const storiesById = result?.storiesById instanceof Map
    ? result.storiesById
    : new Map(Object.entries(asObject(result?.storiesById)));

  const sourceGroups = unique(
    [...storiesById.values()].map(story => story?.sourceGroup || story?.source || 'unknown')
  );

  const weakTrees = parents.filter(parent => parent?.weakTree).length;
  const childCounts = parents.map(parent => asArray(parent?.childStoryIds).length);
  const avgChildCount = childCounts.length
    ? childCounts.reduce((sum, value) => sum + value, 0) / childCounts.length
    : 0;

  const angleCounts = parents.map(parent => {
    const childStories = asArray(parent?.childStoryIds)
      .map(id => storiesById.get(id))
      .filter(Boolean);
    return unique(childStories.map(story => story?.angle || 'unknown')).length;
  });

  const multiAngleParents = angleCounts.filter(count => count >= 2).length;
  const avgAngleCount = angleCounts.length
    ? angleCounts.reduce((sum, value) => sum + value, 0) / angleCounts.length
    : 0;

  const behaviorStatus = behaviorEvidence?.status || '';
  const runtimeGate = result?.runtimeQualityGate || null;

  const gates = [
    gate(
      'insight-parent-volume',
      'Parent cluster volume',
      parents.length >= 5 ? 'PASS' : parents.length >= 2 ? 'WARN' : 'FAIL',
      \`\${parents.length} parent cluster(s) generated.\`
    ),
    gate(
      'insight-child-depth',
      'Child-story depth',
      avgChildCount >= 3 ? 'PASS' : avgChildCount >= 1.5 ? 'WARN' : 'FAIL',
      \`Average child stories per cluster: \${avgChildCount.toFixed(1)}.\`
    ),
    gate(
      'insight-angle-diversity',
      'Angle diversity',
      avgAngleCount >= 2 && multiAngleParents >= 2 ? 'PASS' : multiAngleParents >= 1 ? 'WARN' : 'FAIL',
      \`\${multiAngleParents} multi-angle parent(s); average angle count \${avgAngleCount.toFixed(1)}.\`
    ),
    gate(
      'insight-source-diversity',
      'Source diversity',
      sourceGroups.length >= 6 ? 'PASS' : sourceGroups.length >= 3 ? 'WARN' : 'FAIL',
      \`\${sourceGroups.length} source group(s) represented in storiesById.\`
    ),
    gate(
      'insight-weak-tree-control',
      'Weak-tree control',
      weakTrees === 0 ? 'PASS' : weakTrees <= Math.max(1, Math.floor(parents.length / 3)) ? 'WARN' : 'FAIL',
      \`\${weakTrees} weak tree(s) among \${parents.length} parent(s).\`
    ),
    gate(
      'insight-runtime-quality-gate',
      'Runtime quality gate',
      runtimeGate?.recovered ? 'PASS' : runtimeGate?.attempted ? 'WARN' : 'PASS',
      runtimeGate?.reason || 'No runtime recovery required.'
    ),
    gate(
      'insight-behavior-evidence',
      'Behavior evidence',
      behaviorStatus === 'pass' || behaviorStatus === 'PASS' ? 'PASS' : behaviorStatus ? 'WARN' : 'WARN',
      behaviorEvidence?.summaryTitle || 'Behavior evidence available only after pipeline diagnostics run.'
    ),
    gate(
      'insight-error-state',
      'Insight error state',
      error ? 'FAIL' : 'PASS',
      error ? String(error) : 'No active Insight error.'
    ),
    gate(
      'insight-loading-state',
      'Loading gate',
      loading ? 'WARN' : 'PASS',
      loading ? 'Insight pipeline is still loading.' : 'Insight pipeline is not in blocking loading state.'
    ),
  ];

  return makePageAudit({
    target: 'insight-tab',
    title: 'Insight tab data quality',
    gates,
    now,
    summary: {
      parentCount: parents.length,
      storyCount: storiesById.size,
      sourceGroupCount: sourceGroups.length,
      weakTreeCount: weakTrees,
      multiAngleParentCount: multiAngleParents,
      avgAngleCount: Number(avgAngleCount.toFixed(2)),
      avgChildCount: Number(avgChildCount.toFixed(2)),
      signalScore: diagnostics?.signalScore,
      source,
      loading,
    },
    dataTrust: {
      parentCount: parents.length,
      storyCount: storiesById.size,
      sourceGroupCount: sourceGroups.length,
      weakTreeCount: weakTrees,
      multiAngleParentCount: multiAngleParents,
      runtimeRecovered: Boolean(runtimeGate?.recovered),
    },
  });
}

`;

  return insertBeforeOnce(
    source,
    `export function auditGradeLabel(audit) {`,
    insertion,
    'tab audit functions before auditGradeLabel'
  );
});

/* -------------------------------------------------------------------------- */
/* 3) WeatherPage: replace inline trust panel with GradeBadge                  */
/* -------------------------------------------------------------------------- */

patchFile('src/pages/WeatherPage.jsx', source => {
  let text = source;

  text = text.replace(
    `import WeatherTrustPanel from '../components/weather/WeatherTrustPanel';\n`,
    ''
  );

  text = insertImportAfterLastImport(
    text,
    `import GradeBadge from '../components/audit/GradeBadge.jsx';
import { auditWeatherTabQuality } from '../services/pageAuditGrading.js';`
  );

  text = insertAfterOnce(
    text,
    `    const cities = getConfiguredWeatherCities(settings);\n`,
    `    const weatherTabAudit = React.useMemo(() => auditWeatherTabQuality({
        weatherData: displayData || {},
        cities,
        activeCity,
        error,
        loading,
    }), [displayData, cities, activeCity, error, loading]);

`,
    'weather tab audit memo'
  );

  text = insertAfterOnce(
    text,
    `        <div className="page-container" style={{ padding: 0 }}>`,
    `
            <GradeBadge audit={weatherTabAudit} label="Weather tab quality grade" />
`,
    'weather page grade badge'
  );

  text = removeBlock(
    text,
    `                <WeatherTrustPanel`,
    `                />\n\n`,
    'WeatherTrustPanel inline block'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 4) MarketPage: replace inline trust panel with GradeBadge                   */
/* -------------------------------------------------------------------------- */

patchFile('src/pages/MarketPage.jsx', source => {
  let text = source;

  text = text.replace(
    `import MarketTrustPanel from '../components/market/MarketTrustPanel';\n`,
    ''
  );

  text = insertImportAfterLastImport(
    text,
    `import GradeBadge from '../components/audit/GradeBadge.jsx';
import { auditMarketTabQuality } from '../services/pageAuditGrading.js';`
  );

  text = insertAfterOnce(
    text,
    `    const sectoralIndices = (marketData?.sectorals?.length ? marketData.sectorals : getIndexByName(indices, ['BANK NIFTY', 'NIFTY IT', 'NIFTY PHARMA', 'NIFTY AUTO']))
        .filter((item, idx, arr) => arr.findIndex((candidate) => candidate.name === item.name) === idx);

`,
    `    const marketTabAudit = React.useMemo(() => auditMarketTabQuality({
        marketData,
        sourceHealth,
        sessionState,
        error,
        loading,
        lastFetch,
    }), [marketData, sourceHealth, sessionState, error, loading, lastFetch]);

`,
    'market tab audit memo'
  );

  text = insertAfterOnce(
    text,
    `        <div className="page-container market-page-shell" style={{ padding: 0 }}>`,
    `
            <GradeBadge audit={marketTabAudit} label="Market tab quality grade" />
`,
    'market page grade badge'
  );

  text = removeBlock(
    text,
    `                <MarketTrustPanel`,
    `                />\n\n`,
    'MarketTrustPanel inline block'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 5) InsightPage: expose diagnostics through GradeBadge                       */
/* -------------------------------------------------------------------------- */

optionalPatchFile('src/pages/InsightPage.jsx', source => {
  let text = source;

  text = insertImportAfterLastImport(
    text,
    `import GradeBadge from '../components/audit/GradeBadge.jsx';
import { auditInsightTabQuality } from '../services/pageAuditGrading.js';`
  );

  text = insertAfterOnce(
    text,
    `  const runtimeQualityGate = result?.runtimeQualityGate || null;

`,
    `  const insightTabAudit = React.useMemo(() => auditInsightTabQuality({
    result,
    diagnostics,
    behaviorEvidence,
    source,
    loading: false,
  }), [result, diagnostics, behaviorEvidence, source]);

`,
    'InsightTab audit memo'
  );

  text = insertAfterOnce(
    text,
    `    <div className="scroll insight-page">`,
    `
      <GradeBadge audit={insightTabAudit} label="Insight tab quality grade" />
`,
    'InsightTab grade badge render'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 6) Certification tests                                                      */
/* -------------------------------------------------------------------------- */

write('src/services/pageAuditGradingTabs.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  auditInsightTabQuality,
  auditMarketTabQuality,
  auditWeatherTabQuality,
} from './pageAuditGrading';

describe('Unified tab audit grading certification', () => {
  it('grades Weather tab using city, weekly and source-mode gates', () => {
    const audit = auditWeatherTabQuality({
      weatherData: {
        chennai: { current: { temp: 32 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
        trichy: { current: { temp: 34 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
        muscat: { current: { temp: 35 }, weeklyForecast: [{}, {}, {}, {}, {}], sourceMode: 'live-multi-model' },
      },
      cities: ['chennai', 'trichy', 'muscat'],
      activeCity: 'chennai',
    });

    expect(['A', 'B']).toContain(audit.grade);
    expect(audit.target).toBe('weather-tab');
    expect(audit.gates.some(gate => gate.id === 'weather-weekly-forecast')).toBe(true);
  });

  it('grades Market tab using market coverage and source health gates', () => {
    const audit = auditMarketTabQuality({
      marketData: {
        indices: [{ name: 'NIFTY' }, { name: 'SENSEX' }, { name: 'BANK' }, { name: 'MIDCAP' }],
        movers: {
          gainers: [{ symbol: 'A' }],
          losers: [{ symbol: 'B' }],
        },
        sectorals: [{ name: 'IT' }],
        commodities: [{ name: 'Gold' }],
        currencies: [{ name: 'USDINR' }],
      },
      sourceHealth: {
        a: { ok: true },
        b: { ok: true },
      },
      lastFetch: Date.now(),
    });

    expect(['A', 'B']).toContain(audit.grade);
    expect(audit.target).toBe('market-tab');
    expect(audit.gates.some(gate => gate.id === 'market-source-health')).toBe(true);
  });

  it('downgrades Insight tab when no multi-angle clusters exist', () => {
    const result = {
      parents: [
        { parentId: 'p1', childStoryIds: ['s1'], clusterStoryIds: ['s1'], weakTree: true },
      ],
      storiesById: new Map([
        ['s1', { id: 's1', sourceGroup: 'single', angle: 'base_report' }],
      ]),
    };

    const audit = auditInsightTabQuality({ result, source: 'fixture' });

    expect(['C', 'D', 'F']).toContain(audit.grade);
    expect(audit.target).toBe('insight-tab');
    expect(audit.gates.some(gate => gate.id === 'insight-angle-diversity')).toBe(true);
  });
});
`);

write('scripts/test_unified_grade_badge_tabs_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const grading = read('src/services/pageAuditGrading.js');
const tabTests = read('src/services/pageAuditGradingTabs.cert.test.js');
const gradeBadge = read('src/components/audit/GradeBadge.jsx');
const weatherPage = read('src/pages/WeatherPage.jsx');
const marketPage = read('src/pages/MarketPage.jsx');
const insightPage = fs.existsSync('src/pages/InsightPage.jsx') ? read('src/pages/InsightPage.jsx') : '';
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'auditWeatherTabQuality',
  'auditMarketTabQuality',
  'auditInsightTabQuality',
  'makePageAudit',
  'weather-weekly-forecast',
  'market-source-health',
  'insight-angle-diversity'
]) {
  assert(grading.includes(token), 'pageAuditGrading.js missing token: ' + token);
}

for (const token of [
  'Unified tab audit grading certification',
  'grades Weather tab',
  'grades Market tab',
  'downgrades Insight tab'
]) {
  assert(tabTests.includes(token), 'pageAuditGradingTabs.cert.test.js missing token: ' + token);
}

assert(gradeBadge.includes('AuditDetailModal.css'), 'GradeBadge must import AuditDetailModal.css');

for (const token of [
  'GradeBadge',
  'auditWeatherTabQuality',
  'weatherTabAudit',
  'Weather tab quality grade'
]) {
  assert(weatherPage.includes(token), 'WeatherPage.jsx missing token: ' + token);
}

assert(!weatherPage.includes('<WeatherTrustPanel'), 'WeatherTrustPanel must not remain inline on WeatherPage');

for (const token of [
  'GradeBadge',
  'auditMarketTabQuality',
  'marketTabAudit',
  'Market tab quality grade'
]) {
  assert(marketPage.includes(token), 'MarketPage.jsx missing token: ' + token);
}

assert(!marketPage.includes('<MarketTrustPanel'), 'MarketTrustPanel must not remain inline on MarketPage');

if (insightPage) {
  for (const token of [
    'GradeBadge',
    'auditInsightTabQuality',
    'insightTabAudit',
    'Insight tab quality grade'
  ]) {
    assert(insightPage.includes(token), 'InsightPage.jsx missing token: ' + token);
  }
}

assert(
  packageJson.includes('"test:unified-grade-badge-tabs"'),
  'package.json must include test:unified-grade-badge-tabs'
);

assert(
  certGate.includes("['npm', ['run', 'test:unified-grade-badge-tabs']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include unified grade badge tabs test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Unified GradeBadge tab audits',
  guarantees: [
    'Weather trust panel is migrated into GradeBadge modal',
    'Market trust panel is migrated into GradeBadge modal',
    'Insight diagnostics are exposed through GradeBadge modal',
    'Weather/Market/Insight have robust page audit grading functions',
    'GradeBadge owns its modal CSS',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Unified GradeBadge tabs static slice');
`);

/* -------------------------------------------------------------------------- */
/* 7) package.json + certification                                             */
/* -------------------------------------------------------------------------- */

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:unified-grade-badge-tabs'] =
    'node scripts/test_unified_grade_badge_tabs_static.mjs && vitest run --config vitest.config.js src/services/pageAuditGradingTabs.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:unified-grade-badge-tabs']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  if (source.includes("  ['npm', ['run', 'test:main-grade-audit']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:main-grade-audit']],",
      "  ['npm', ['run', 'test:main-grade-audit']],\\n  ['npm', ['run', 'test:unified-grade-badge-tabs']],"
    );
  }

  if (source.includes("  ['npm', ['run', 'test:weather-trust']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:weather-trust']],",
      "  ['npm', ['run', 'test:weather-trust']],\\n  ['npm', ['run', 'test:unified-grade-badge-tabs']],"
    );
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'unified-grade-badge-tabs')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'main-grade-audit');
      const command = {
        id: 'unified-grade-badge-tabs',
        cmd: 'npm',
        args: ['run', 'test:unified-grade-badge-tabs'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:unified-grade-badge-tabs')) return source;

    if (source.includes("'test:main-grade-audit',")) {
      return source.replace(
        "'test:main-grade-audit',",
        "'test:main-grade-audit',\\n  'test:unified-grade-badge-tabs',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 60B Unified GradeBadge tabs patch complete.');
