function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function storyKey(story) {
  return String(story?.id || story?.url || story?.link || story?.title || '').trim();
}

function storySource(story) {
  return String(story?.sourceGroup || story?.source || 'unknown').trim().toLowerCase();
}

function storyTime(story) {
  const candidates = [
    story?.publishedAt,
    story?.fetchedAt,
    story?.timestamp,
    story?.timeMs,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function gradeFromScore(score) {
  if (score >= 88) return 'A';
  if (score >= 74) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function toneFromGrade(grade) {
  if (grade === 'A' || grade === 'B') return 'good';
  if (grade === 'C') return 'warn';
  return 'bad';
}

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function auditMainTabQuality({
  newsData = {},
  weatherData = {},
  breakingNews = [],
  settings = {},
  loading = false,
  errors = {},
  now = Date.now(),
} = {}) {
  const news = asObject(newsData);
  const weather = asObject(weatherData);
  const sectionSettings = asObject(settings.sections);

  const frontPage = asArray(news.frontPage);
  const sectionNames = ['india', 'chennai', 'local', 'world'];
  const enabledSections = sectionNames.filter(section => sectionSettings?.[section]?.enabled !== false);

  const sectionStories = enabledSections.flatMap(section => asArray(news[section]));
  const allStories = [...frontPage, ...sectionStories, ...asArray(breakingNews)];

  const keys = allStories.map(storyKey).filter(Boolean);
  const duplicateCount = Math.max(0, keys.length - unique(keys).length);
  const duplicateRate = keys.length > 0 ? duplicateCount / keys.length : 0;

  const sourceGroups = unique(allStories.map(storySource));
  const sectionHealth = enabledSections.map(section => {
    const stories = asArray(news[section]);
    const sources = unique(stories.map(storySource));

    return {
      section,
      storyCount: stories.length,
      sourceGroupCount: sources.length,
      status: stories.length >= 3 && sources.length >= 2 ? 'PASS' : stories.length > 0 ? 'WARN' : 'FAIL',
    };
  });

  const missingSections = sectionHealth.filter(item => item.status === 'FAIL').map(item => item.section);
  const weakSections = sectionHealth.filter(item => item.status === 'WARN').map(item => item.section);

  const timestamps = allStories.map(storyTime).filter(Boolean);
  const newestAgeMinutes = timestamps.length > 0
    ? Math.max(0, Math.round((now - Math.max(...timestamps)) / 60000))
    : null;

  const stale = newestAgeMinutes == null ? true : newestAgeMinutes > 360;
  const weatherCities = Object.keys(weather).filter(city => weather[city]);
  const weatherCityCount = weatherCities.length;
  const weatherReadyCount = weatherCities.filter(city => weather[city]?.current || weather[city]?.temp || weather[city]?.weeklyForecast).length;

  const audits = [
    {
      id: 'frontpage-volume',
      label: 'Front page story volume',
      status: frontPage.length >= 10 ? 'PASS' : frontPage.length >= 5 ? 'WARN' : 'FAIL',
      detail: `${frontPage.length} front-page stories available.`,
    },
    {
      id: 'source-diversity',
      label: 'Source diversity',
      status: sourceGroups.length >= 6 ? 'PASS' : sourceGroups.length >= 3 ? 'WARN' : 'FAIL',
      detail: `${sourceGroups.length} unique source groups across visible main-tab news.`,
    },
    {
      id: 'section-coverage',
      label: 'Section coverage',
      status: missingSections.length === 0 && weakSections.length === 0 ? 'PASS' : missingSections.length === 0 ? 'WARN' : 'FAIL',
      detail: missingSections.length
        ? `Missing sections: ${missingSections.join(', ')}.`
        : weakSections.length
          ? `Weak sections: ${weakSections.join(', ')}.`
          : 'All enabled sections have visible stories.',
    },
    {
      id: 'duplicate-rate',
      label: 'Duplicate story control',
      status: duplicateRate <= 0.08 ? 'PASS' : duplicateRate <= 0.18 ? 'WARN' : 'FAIL',
      detail: `${duplicateCount} duplicate-like story keys from ${keys.length || 0} keyed stories.`,
    },
    {
      id: 'freshness',
      label: 'Freshness',
      status: !stale ? 'PASS' : newestAgeMinutes == null ? 'WARN' : 'FAIL',
      detail: newestAgeMinutes == null
        ? 'No usable story timestamp found.'
        : `Newest visible story is about ${newestAgeMinutes} minutes old.`,
    },
    {
      id: 'weather-availability',
      label: 'Weather availability',
      status: weatherReadyCount >= 3 ? 'PASS' : weatherReadyCount >= 1 ? 'WARN' : 'FAIL',
      detail: `${weatherReadyCount} weather locations ready from ${weatherCityCount} loaded locations.`,
    },
    {
      id: 'error-state',
      label: 'Runtime error state',
      status: Object.keys(asObject(errors)).length === 0 ? 'PASS' : 'FAIL',
      detail: Object.keys(asObject(errors)).length === 0
        ? 'No active error object from news context.'
        : `Errors present: ${Object.keys(asObject(errors)).join(', ')}.`,
    },
    {
      id: 'loading-state',
      label: 'Loading gate',
      status: loading ? 'WARN' : 'PASS',
      detail: loading ? 'Main tab is still loading or refreshing.' : 'Main tab is not in blocking loading state.',
    },
  ];

  const weights = {
    PASS: 100,
    WARN: 62,
    FAIL: 15,
  };

  const score = clampScore(
    audits.reduce((sum, audit) => sum + (weights[audit.status] ?? 40), 0) / audits.length
  );

  const grade = gradeFromScore(score);
  const warnings = audits.filter(audit => audit.status === 'WARN').map(audit => audit.detail);
  const failures = audits.filter(audit => audit.status === 'FAIL').map(audit => audit.detail);

  return {
    schemaVersion: 1,
    target: 'main-tab',
    title: 'Main tab data quality',
    grade,
    score,
    tone: toneFromGrade(grade),
    generatedAt: now,
    summary: {
      frontPageStoryCount: frontPage.length,
      totalVisibleStoryCount: allStories.length,
      sourceGroupCount: sourceGroups.length,
      duplicateRate: Number(duplicateRate.toFixed(3)),
      newestAgeMinutes,
      enabledSections,
      missingSections,
      weakSections,
      weatherReadyCount,
      loading,
    },
    gates: audits,
    audits,
    dataTrust: {
      status: failures.length === 0 ? warnings.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
      sourceDiversity: sourceGroups.length,
      duplicateRate: Number(duplicateRate.toFixed(3)),
      stale,
      weatherReadyCount,
    },
    moreDiagnostics: [
      diagnosticSection({
        id: 'main-section-health',
        title: 'Section health',
        description: 'Per-section volume and source diversity behind the Main tab grade.',
        status: missingSections.length === 0 ? weakSections.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Enabled sections', enabledSections.length),
          diagnosticMetric('Missing sections', missingSections.length),
          diagnosticMetric('Weak sections', weakSections.length),
          diagnosticMetric('Section stories', sectionStories.length),
        ],
        rows: sectionHealth.map(item => diagnosticRow(
          item.section,
          item.status,
          item.storyCount + ' stories / ' + item.sourceGroupCount + ' source groups'
        )),
        raw: { sectionHealth, enabledSections, missingSections, weakSections },
      }),
      diagnosticSection({
        id: 'main-data-trust',
        title: 'Data trust details',
        description: 'Source diversity, freshness, duplicate control and weather readiness.',
        status: failures.length === 0 ? warnings.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Visible stories', allStories.length),
          diagnosticMetric('Front page stories', frontPage.length),
          diagnosticMetric('Source groups', sourceGroups.length),
          diagnosticMetric('Duplicate rate', Number(duplicateRate.toFixed(3))),
          diagnosticMetric('Newest age min', newestAgeMinutes ?? 'unknown'),
          diagnosticMetric('Weather ready', weatherReadyCount),
        ],
        notes: [
          stale ? 'Newest story is stale or timestamp is unavailable.' : 'Freshness gate has usable story timestamps.',
          duplicateRate > 0.08 ? 'Duplicate pressure is visible in main-tab story keys.' : 'Duplicate pressure is within expected range.',
        ],
        raw: { sourceGroups, duplicateCount, duplicateRate, timestamps, weatherCities },
      }),
    ],
    warnings,
    failures,
  };
}


function diagnosticMetric(label, value, hint = '') {
  return { label, value, hint };
}

function diagnosticRow(label, value, detail = '') {
  return { label, value, detail };
}

function diagnosticSection({ id, title, description, status = null, metrics = [], rows = [], notes = [], raw = null }) {
  return { id, title, description, status, metrics, rows, notes, raw };
}

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

function makePageAudit({ target, title, gates, summary = {}, dataTrust = {}, moreDiagnostics = [], now = Date.now() }) {
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
    moreDiagnostics,
    warnings,
    failures,
  };
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
      `${readyCities.length} of ${cityList.length} configured weather cities have usable data.`
    ),
    gate(
      'weather-active-city',
      'Active city readiness',
      activeReady ? 'PASS' : 'FAIL',
      activeReady ? `Active city ${active} is ready.` : `Active city ${active || 'unknown'} has no weather payload.`
    ),
    gate(
      'weather-weekly-forecast',
      'Weekly forecast coverage',
      weeklyReady.length >= Math.min(3, cityList.length) ? 'PASS' : weeklyReady.length > 0 ? 'WARN' : 'FAIL',
      `${weeklyReady.length} city/cities have 5+ day weekly forecast.`
    ),
    gate(
      'weather-source-mode',
      'Source mode trust',
      fallbackCities.length === 0 && staleCities.length === 0 ? 'PASS' : fallbackCities.length === 0 ? 'WARN' : 'FAIL',
      sourceModes.length
        ? `Source modes: ${sourceModes.join(', ')}. Stale: ${staleCities.length}, fallback/snapshot: ${fallbackCities.length}.`
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
    moreDiagnostics: [
      diagnosticSection({
        id: 'weather-city-readiness',
        title: 'Weather city readiness',
        description: 'Configured city coverage, active city state and weekly forecast readiness.',
        status: readyCities.length === cityList.length ? 'PASS' : readyCities.length > 0 ? 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Configured cities', cityList.length),
          diagnosticMetric('Ready cities', readyCities.length),
          diagnosticMetric('Weekly ready', weeklyReady.length),
          diagnosticMetric('Active city', active),
        ],
        rows: cityList.map(city => diagnosticRow(
          city,
          data?.[city] ? 'ready' : 'missing',
          asArray(data?.[city]?.weeklyForecast).length + ' weekly days; source ' + (data?.[city]?.sourceMode || 'unknown')
        )),
        raw: { cityList, readyCities, weeklyReady, staleCities, fallbackCities, active },
      }),
      diagnosticSection({
        id: 'weather-source-trust',
        title: 'Weather source trust',
        description: 'Source mode, stale/cache/fallback visibility and runtime error state.',
        status: fallbackCities.length === 0 && !error ? staleCities.length === 0 ? 'PASS' : 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Source modes', sourceModes),
          diagnosticMetric('Stale cities', staleCities.length),
          diagnosticMetric('Fallback cities', fallbackCities.length),
          diagnosticMetric('Loading', loading),
          diagnosticMetric('Error', Boolean(error)),
        ],
        notes: [
          error ? 'Weather context reports a degraded update or cached fallback.' : 'No active weather error reported.',
          fallbackCities.length ? 'At least one city is using fallback/snapshot data.' : 'No fallback/snapshot city detected.',
        ],
        raw: { sourceModes, staleCities, fallbackCities, error },
      }),
    ],
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
      `${indices.length} index row(s) available.`
    ),
    gate(
      'market-movers',
      'Mover coverage',
      gainers.length > 0 && losers.length > 0 ? 'PASS' : gainers.length + losers.length > 0 ? 'WARN' : 'FAIL',
      `${gainers.length} gainers and ${losers.length} losers available.`
    ),
    gate(
      'market-breadth-sections',
      'Market breadth sections',
      [sectorals, commodities, currencies, mutualFunds].filter(section => section.length > 0).length >= 2 ? 'PASS' : 'WARN',
      `Sectorals ${sectorals.length}, commodities ${commodities.length}, currencies ${currencies.length}, mutual funds ${mutualFunds.length}.`
    ),
    gate(
      'market-source-health',
      'Source health',
      sourceFailCount === 0 ? 'PASS' : sourceOkCount >= sourceFailCount ? 'WARN' : 'FAIL',
      `${sourceOkCount} source(s) OK, ${sourceFailCount} failing.`
    ),
    gate(
      'market-session-freshness',
      'Session freshness',
      data.isSnapshot ? 'WARN' : data.isStale ? 'WARN' : newestAgeMinutes == null || newestAgeMinutes <= 60 ? 'PASS' : newestAgeMinutes <= 240 ? 'WARN' : 'FAIL',
      sessionState?.label
        ? `${sessionState.label}; age ${sessionState.ageLabel || (newestAgeMinutes == null ? 'unknown' : newestAgeMinutes + ' min')}.`
        : newestAgeMinutes == null ? 'No lastFetch timestamp.' : `Latest market fetch age ${newestAgeMinutes} minutes.`
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
    moreDiagnostics: [
      diagnosticSection({
        id: 'market-coverage',
        title: 'Market coverage',
        description: 'Coverage across indices, movers and auxiliary market sections.',
        status: indices.length >= 4 && gainers.length > 0 && losers.length > 0 ? 'PASS' : indices.length > 0 ? 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Indices', indices.length),
          diagnosticMetric('Gainers', gainers.length),
          diagnosticMetric('Losers', losers.length),
          diagnosticMetric('Sectorals', sectorals.length),
          diagnosticMetric('Commodities', commodities.length),
          diagnosticMetric('Currencies', currencies.length),
          diagnosticMetric('Mutual funds', mutualFunds.length),
        ],
        raw: {
          indexNames: indices.map(item => item.name || item.symbol).filter(Boolean),
          gainers: gainers.slice(0, 5),
          losers: losers.slice(0, 5),
        },
      }),
      diagnosticSection({
        id: 'market-source-health',
        title: 'Market source health',
        description: 'Source health and freshness details behind the market grade.',
        status: sourceFailCount === 0 ? 'PASS' : sourceOkCount >= sourceFailCount ? 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Sources OK', sourceOkCount),
          diagnosticMetric('Sources failing', sourceFailCount),
          diagnosticMetric('Source mode', data.isSnapshot ? 'snapshot' : data.isStale ? 'cache' : 'live'),
          diagnosticMetric('Newest age min', newestAgeMinutes ?? 'unknown'),
          diagnosticMetric('Loading', loading),
          diagnosticMetric('Error', Boolean(error)),
        ],
        rows: Object.entries(asObject(sourceHealth)).map(([name, item]) => diagnosticRow(
          name,
          item?.ok === false ? 'FAIL' : 'PASS',
          item?.message || item?.reason || ''
        )),
        raw: { sourceHealth, sessionState, lastFetch },
      }),
    ],
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
      `${parents.length} parent cluster(s) generated.`
    ),
    gate(
      'insight-child-depth',
      'Child-story depth',
      avgChildCount >= 3 ? 'PASS' : avgChildCount >= 1.5 ? 'WARN' : 'FAIL',
      `Average child stories per cluster: ${avgChildCount.toFixed(1)}.`
    ),
    gate(
      'insight-angle-diversity',
      'Angle diversity',
      avgAngleCount >= 2 && multiAngleParents >= 2 ? 'PASS' : multiAngleParents >= 1 ? 'WARN' : 'FAIL',
      `${multiAngleParents} multi-angle parent(s); average angle count ${avgAngleCount.toFixed(1)}.`
    ),
    gate(
      'insight-source-diversity',
      'Source diversity',
      sourceGroups.length >= 6 ? 'PASS' : sourceGroups.length >= 3 ? 'WARN' : 'FAIL',
      `${sourceGroups.length} source group(s) represented in storiesById.`
    ),
    gate(
      'insight-weak-tree-control',
      'Weak-tree control',
      weakTrees === 0 ? 'PASS' : weakTrees <= Math.max(1, Math.floor(parents.length / 3)) ? 'WARN' : 'FAIL',
      `${weakTrees} weak tree(s) among ${parents.length} parent(s).`
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
    moreDiagnostics: [
      diagnosticSection({
        id: 'insight-tree-quality',
        title: 'Insight tree quality',
        description: 'Cluster depth, angle diversity, source diversity and weak-tree control.',
        status: multiAngleParents >= 2 && weakTrees === 0 ? 'PASS' : multiAngleParents >= 1 ? 'WARN' : 'FAIL',
        metrics: [
          diagnosticMetric('Parents', parents.length),
          diagnosticMetric('Stories', storiesById.size),
          diagnosticMetric('Source groups', sourceGroups.length),
          diagnosticMetric('Weak trees', weakTrees),
          diagnosticMetric('Multi-angle parents', multiAngleParents),
          diagnosticMetric('Avg angles', Number(avgAngleCount.toFixed(2))),
          diagnosticMetric('Avg children', Number(avgChildCount.toFixed(2))),
        ],
        rows: parents.slice(0, 10).map(parent => diagnosticRow(
          parent?.canonicalHeadline || parent?.parentId || 'cluster',
          parent?.weakTree ? 'weak' : 'ok',
          asArray(parent?.childStoryIds).length + ' children / ' + asArray(parent?.clusterStoryIds).length + ' cluster stories'
        )),
        raw: { sourceGroups, weakTrees, angleCounts, childCounts },
      }),
      diagnosticSection({
        id: 'insight-runtime-gates',
        title: 'Insight runtime gates',
        description: 'Runtime quality gate, source mode and behavior evidence status.',
        status: runtimeGate?.attempted && !runtimeGate?.recovered ? 'WARN' : 'PASS',
        metrics: [
          diagnosticMetric('Source', source),
          diagnosticMetric('Signal score', diagnostics?.signalScore ?? 'unknown'),
          diagnosticMetric('Runtime recovered', Boolean(runtimeGate?.recovered)),
          diagnosticMetric('Runtime attempted', Boolean(runtimeGate?.attempted)),
          diagnosticMetric('Behavior status', behaviorStatus || 'unknown'),
          diagnosticMetric('Loading', loading),
          diagnosticMetric('Error', Boolean(error)),
        ],
        notes: [
          runtimeGate?.reason || 'No runtime recovery reason recorded.',
          behaviorEvidence?.summaryTitle || 'No behavior evidence title recorded.',
        ],
        raw: { runtimeGate, behaviorEvidence, diagnostics },
      }),
    ],
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

export function auditGradeLabel(audit) {
  return audit?.grade || 'F';
}

export function auditGradeTone(audit) {
  return audit?.tone || toneFromGrade(audit?.grade || 'F');
}
