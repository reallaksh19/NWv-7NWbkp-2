const NEWSDATA_REPORTS = {
  insightQuality: 'insight_quality_report.json',
  sectionsQuality: 'sections_quality_report.json',
  pagesManifest: 'pages_data_manifest.json',
  pagesVerification: 'pages_newsdata_verify_report.json',
  insightSourcePolicy: 'source_policy_report.json',
  sectionSourcePolicy: 'section_source_policy_report.json',
  prefetchCommit: 'prefetch_commit_manifest.json',
  rawInsight: 'insight_latest.json',
  rawSections: 'sections_latest.json',
};

function getNewsdataBaseUrl() {
  const base = import.meta?.env?.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}/newsdata`;
}

async function fetchJsonOrNull(url) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        missing: true,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      data: await response.json(),
    };
  } catch (error) {
    return {
      ok: false,
      missing: true,
      error: error?.message || 'fetch failed',
    };
  }
}

function asStatus(value, fallback = 'UNKNOWN') {
  return String(value || fallback).toUpperCase();
}

function statusRank(status) {
  const ranks = {
    PASS: 3,
    OK: 3,
    WARN: 2,
    WARNING: 2,
    RAW: 2,
    UNKNOWN: 1,
    FAIL: 0,
    ERROR: 0,
  };

  return ranks[asStatus(status)] ?? 1;
}

function worstStatus(statuses) {
  const normalized = statuses.map(status => asStatus(status));
  return normalized.sort((a, b) => statusRank(a) - statusRank(b))[0] || 'UNKNOWN';
}

function getTone(status) {
  const normalized = asStatus(status);

  if (normalized === 'PASS' || normalized === 'OK') return 'good';
  if (normalized === 'WARN' || normalized === 'WARNING' || normalized === 'RAW') return 'warn';
  if (normalized === 'FAIL' || normalized === 'ERROR') return 'bad';
  return 'unknown';
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function reportStatus(fetchResult) {
  if (!fetchResult?.ok) return 'UNKNOWN';
  return asStatus(fetchResult.data?.status, 'UNKNOWN');
}

function getReportData(fetchResult) {
  return fetchResult?.ok ? fetchResult.data : null;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function summarizeRawInsightSnapshot(snapshot) {
  const stories = safeArray(snapshot?.stories);
  const sourceGroups = new Set(
    stories.map(story => story?.sourceGroup || story?.source || 'unknown')
  );

  const storiesWithAngleHints = stories.filter(story => (
    safeArray(story?.angleHints).length > 0 ||
    safeArray(story?.storySignals?.angleHints).length > 0
  ));

  return {
    status: stories.length > 0 ? 'RAW' : 'UNKNOWN',
    schemaVersion: safeNumber(snapshot?.schemaVersion),
    storyCount: stories.length,
    usable24hStoryCount: stories.length,
    sourceGroupCount: sourceGroups.size,
    angleHintCoverage: stories.length > 0 ? storiesWithAngleHints.length / stories.length : 0,
    contentHash: snapshot?.contentHash || '',
    fallbackFromRawJson: true,
  };
}

function summarizeRawSectionsSnapshot(snapshot) {
  const sections = snapshot?.sections && typeof snapshot.sections === 'object'
    ? snapshot.sections
    : {};

  const allStories = Object.values(sections).flatMap(items => safeArray(items));
  const sourceGroups = new Set(
    allStories.map(story => story?.sourceGroup || story?.source || 'unknown')
  );

  return {
    status: allStories.length > 0 ? 'RAW' : 'UNKNOWN',
    schemaVersion: safeNumber(snapshot?.schemaVersion),
    sectionCount: Object.keys(sections).length,
    storyCount: allStories.length,
    sourceGroupCount: sourceGroups.size,
    contentHash: snapshot?.contentHash || '',
    fallbackFromRawJson: true,
  };
}

function collectWarnings(...reports) {
  return reports
    .flatMap(report => Array.isArray(report?.warnings) ? report.warnings : [])
    .slice(0, 8);
}

function collectErrors(...reports) {
  return reports
    .flatMap(report => Array.isArray(report?.errors) ? report.errors : [])
    .slice(0, 8);
}

export function summarizeNewsdataRuntimeReports(reports) {
  const insightQualityReport = getReportData(reports.insightQuality);
  const sectionsQualityReport = getReportData(reports.sectionsQuality);
  const rawInsight = getReportData(reports.rawInsight);
  const rawSections = getReportData(reports.rawSections);

  const insightQuality = insightQualityReport || (rawInsight ? summarizeRawInsightSnapshot(rawInsight) : null);
  const sectionsQuality = sectionsQualityReport || (rawSections ? summarizeRawSectionsSnapshot(rawSections) : null);

  const pagesVerification = getReportData(reports.pagesVerification);
  const pagesManifest = getReportData(reports.pagesManifest);
  const insightSourcePolicy = getReportData(reports.insightSourcePolicy);
  const sectionSourcePolicy = getReportData(reports.sectionSourcePolicy);
  const prefetchCommit = getReportData(reports.prefetchCommit);

  const insightStatus = insightQuality?.status || 'UNKNOWN';
  const sectionsStatus = sectionsQuality?.status || 'UNKNOWN';

  const pagesStatus = reportStatus(reports.pagesVerification);
  const manifestStatus = pagesManifest?.allTrackedFilesMatched === true
    ? 'PASS'
    : pagesManifest
      ? 'WARN'
      : 'UNKNOWN';

  const sourcePolicyStatus = worstStatus([
    insightSourcePolicy?.validation?.status || 'UNKNOWN',
    sectionSourcePolicy?.validation?.status || 'UNKNOWN',
  ]);

  const overallStatus = worstStatus([
    insightStatus,
    sectionsStatus,
    pagesStatus,
    manifestStatus,
    sourcePolicyStatus,
  ]);

  const warnings = collectWarnings(
    insightQuality,
    sectionsQuality,
    insightSourcePolicy?.validation,
    sectionSourcePolicy?.validation,
  );

  const errors = collectErrors(
    insightQuality,
    sectionsQuality,
    pagesVerification,
    insightSourcePolicy?.validation,
    sectionSourcePolicy?.validation,
  );

  const missingReports = Object.entries(reports)
    .filter(([key, result]) => {
      if (key === 'rawInsight' || key === 'rawSections') return false;
      return !result?.ok;
    })
    .map(([key, result]) => ({
      key,
      error: result?.error || 'missing',
    }));

  const rawFallbackUsed = Boolean(
    (!insightQualityReport && rawInsight) ||
    (!sectionsQualityReport && rawSections)
  );

  return {
    status: overallStatus,
    tone: getTone(overallStatus),
    generatedAt: Date.now(),
    rawFallbackUsed,
    insight: {
      status: insightStatus,
      tone: getTone(insightStatus),
      schemaVersion: safeNumber(insightQuality?.schemaVersion),
      storyCount: safeNumber(insightQuality?.storyCount),
      usable24hStoryCount: safeNumber(insightQuality?.usable24hStoryCount),
      sourceGroupCount: safeNumber(insightQuality?.sourceGroupCount),
      angleHintCoverage: safeNumber(insightQuality?.angleHintCoverage),
      contentHash: insightQuality?.contentHash || pagesManifest?.insight?.contentHash || '',
      fallbackFromRawJson: Boolean(insightQuality?.fallbackFromRawJson),
    },
    sections: {
      status: sectionsStatus,
      tone: getTone(sectionsStatus),
      schemaVersion: safeNumber(sectionsQuality?.schemaVersion),
      sectionCount: safeNumber(sectionsQuality?.sectionCount),
      storyCount: safeNumber(sectionsQuality?.storyCount),
      sourceGroupCount: safeNumber(sectionsQuality?.sourceGroupCount),
      contentHash: sectionsQuality?.contentHash || pagesManifest?.sections?.contentHash || '',
      fallbackFromRawJson: Boolean(sectionsQuality?.fallbackFromRawJson),
    },
    pages: {
      status: pagesStatus,
      tone: getTone(pagesStatus),
      manifestStatus,
      allTrackedFilesMatched: Boolean(pagesManifest?.allTrackedFilesMatched),
      expectedInsightContentHash: pagesVerification?.expected?.contentHash || '',
      deployedInsightContentHash: pagesVerification?.deployed?.contentHash || '',
      expectedSectionsContentHash: pagesVerification?.expectedSections?.contentHash || '',
      deployedSectionsContentHash: pagesVerification?.deployedSections?.contentHash || '',
    },
    sourcePolicy: {
      status: sourcePolicyStatus,
      tone: getTone(sourcePolicyStatus),
      insightSourceCount: safeNumber(insightSourcePolicy?.sourceCount),
      sectionSourceCount: safeNumber(sectionSourcePolicy?.sourceCount),
      insightValidation: insightSourcePolicy?.validation || null,
      sectionValidation: sectionSourcePolicy?.validation || null,
    },
    prefetchCommit: {
      shouldCommit: Boolean(prefetchCommit?.shouldCommit),
      diagnosticOnly: Boolean(prefetchCommit?.diagnosticOnly),
      changedContentFiles: Array.isArray(prefetchCommit?.changedContentFiles)
        ? prefetchCommit.changedContentFiles
        : [],
    },
    warnings,
    errors,
    missingReports,
  };
}

export async function getNewsdataRuntimeStatus() {
  const base = getNewsdataBaseUrl();

  const entries = await Promise.all(
    Object.entries(NEWSDATA_REPORTS).map(async ([key, file]) => [
      key,
      await fetchJsonOrNull(`${base}/${file}?runtime=${Date.now()}`),
    ])
  );

  return summarizeNewsdataRuntimeReports(Object.fromEntries(entries));
}

export default getNewsdataRuntimeStatus;
