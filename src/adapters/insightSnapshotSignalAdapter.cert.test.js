import { describe, expect, it } from 'vitest';
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
