import { describe, expect, it } from 'vitest';
import { summarizeNewsdataRuntimeReports } from './newsdataRuntimeStatus';

function ok(data) {
  return { ok: true, data };
}

function missing(error = 'missing') {
  return { ok: false, missing: true, error };
}

describe('Newsdata runtime status certification', () => {
  it('summarizes healthy Insight, Sections and Pages reports', () => {
    const summary = summarizeNewsdataRuntimeReports({
      insightQuality: ok({
        status: 'PASS',
        schemaVersion: 3,
        storyCount: 40,
        usable24hStoryCount: 30,
        sourceGroupCount: 8,
        angleHintCoverage: 0.7,
        contentHash: 'insight-hash',
      }),
      sectionsQuality: ok({
        status: 'PASS',
        schemaVersion: 2,
        sectionCount: 9,
        storyCount: 80,
        sourceGroupCount: 12,
        contentHash: 'sections-hash',
      }),
      pagesManifest: ok({
        allTrackedFilesMatched: true,
        insight: { contentHash: 'insight-hash' },
        sections: { contentHash: 'sections-hash' },
      }),
      pagesVerification: ok({
        status: 'PASS',
        expected: { contentHash: 'insight-hash' },
        deployed: { contentHash: 'insight-hash' },
        expectedSections: { contentHash: 'sections-hash' },
        deployedSections: { contentHash: 'sections-hash' },
      }),
      insightSourcePolicy: ok({
        validation: { status: 'PASS' },
        sourceCount: 10,
      }),
      sectionSourcePolicy: ok({
        validation: { status: 'PASS' },
        sourceCount: 14,
      }),
      prefetchCommit: ok({
        shouldCommit: true,
        diagnosticOnly: false,
        changedContentFiles: ['public/newsdata/insight_latest.json'],
      }),
      rawInsight: missing(),
      rawSections: missing(),
    });

    expect(summary.status).toBe('PASS');
    expect(summary.tone).toBe('good');
    expect(summary.insight.storyCount).toBe(40);
    expect(summary.sections.sectionCount).toBe(9);
    expect(summary.pages.allTrackedFilesMatched).toBe(true);
  });

  it('falls back to raw deployed JSON when report files are missing', () => {
    const summary = summarizeNewsdataRuntimeReports({
      insightQuality: missing('404'),
      sectionsQuality: missing('404'),
      pagesManifest: missing('404'),
      pagesVerification: missing('404'),
      insightSourcePolicy: missing('404'),
      sectionSourcePolicy: missing('404'),
      prefetchCommit: missing('404'),
      rawInsight: ok({
        schemaVersion: 3,
        contentHash: 'raw-insight',
        stories: [
          {
            id: 'a',
            sourceGroup: 'gov',
            angleHints: [{ angle: 'official_response', score: 0.9 }],
          },
          {
            id: 'b',
            sourceGroup: 'market',
            storySignals: {
              angleHints: [{ angle: 'market_reaction', score: 0.9 }],
            },
          },
        ],
      }),
      rawSections: ok({
        schemaVersion: 2,
        contentHash: 'raw-sections',
        sections: {
          topStories: [
            { id: 'a', sourceGroup: 'wire' },
            { id: 'b', sourceGroup: 'agency' },
          ],
        },
      }),
    });

    expect(summary.rawFallbackUsed).toBe(true);
    expect(summary.insight.status).toBe('RAW');
    expect(summary.sections.status).toBe('RAW');
    expect(summary.insight.storyCount).toBe(2);
    expect(summary.sections.storyCount).toBe(2);
    expect(summary.insight.fallbackFromRawJson).toBe(true);
    expect(summary.sections.fallbackFromRawJson).toBe(true);
  });

  it('downgrades to WARN when section quality warns', () => {
    const summary = summarizeNewsdataRuntimeReports({
      insightQuality: ok({ status: 'PASS' }),
      sectionsQuality: ok({ status: 'WARN', warnings: ['Section sports is thin'] }),
      pagesManifest: ok({ allTrackedFilesMatched: true }),
      pagesVerification: ok({ status: 'PASS' }),
      insightSourcePolicy: ok({ validation: { status: 'PASS' } }),
      sectionSourcePolicy: ok({ validation: { status: 'PASS' } }),
      prefetchCommit: ok({}),
      rawInsight: missing(),
      rawSections: missing(),
    });

    expect(summary.status).toBe('WARN');
    expect(summary.tone).toBe('warn');
    expect(summary.warnings).toContain('Section sports is thin');
  });

  it('surfaces missing report files without throwing', () => {
    const summary = summarizeNewsdataRuntimeReports({
      insightQuality: missing('404'),
      sectionsQuality: ok({ status: 'PASS' }),
      pagesManifest: missing('404'),
      pagesVerification: missing('404'),
      insightSourcePolicy: ok({ validation: { status: 'PASS' } }),
      sectionSourcePolicy: ok({ validation: { status: 'PASS' } }),
      prefetchCommit: ok({}),
      rawInsight: missing('404'),
      rawSections: missing('404'),
    });

    expect(summary.status).toBe('UNKNOWN');
    expect(summary.missingReports.length).toBeGreaterThanOrEqual(1);
  });
});
