import { describe, expect, it } from 'vitest';
import { auditMainTabQuality } from './pageAuditGrading';

function story(id, sourceGroup, publishedAt = Date.now()) {
  return {
    id,
    title: 'Story ' + id,
    sourceGroup,
    publishedAt,
  };
}

describe('Main tab audit grading certification', () => {
  it('gives strong grade for diverse fresh data', () => {
    const now = Date.now();
    const audit = auditMainTabQuality({
      now,
      newsData: {
        frontPage: Array.from({ length: 12 }, (_, index) => story('top-' + index, 'source_' + (index % 6), now - 60000)),
        india: [story('india-1', 'source_a', now), story('india-2', 'source_b', now), story('india-3', 'source_c', now)],
        chennai: [story('tn-1', 'source_d', now), story('tn-2', 'source_e', now), story('tn-3', 'source_f', now)],
        local: [story('local-1', 'source_g', now), story('local-2', 'source_h', now), story('local-3', 'source_i', now)],
        world: [story('world-1', 'source_j', now), story('world-2', 'source_k', now), story('world-3', 'source_l', now)],
      },
      weatherData: {
        chennai: { current: { temp: 32 } },
        trichy: { current: { temp: 34 } },
        muscat: { current: { temp: 35 } },
        colombo: { current: { temp: 29 } },
      },
      settings: {
        sections: {
          india: { enabled: true },
          chennai: { enabled: true },
          local: { enabled: true },
          world: { enabled: true },
        },
      },
    });

    expect(['A', 'B']).toContain(audit.grade);
    expect(audit.summary.sourceGroupCount).toBeGreaterThanOrEqual(6);
    expect(audit.failures).toEqual([]);
  });

  it('downgrades weak main tab data', () => {
    const audit = auditMainTabQuality({
      now: Date.now(),
      newsData: {
        frontPage: [story('same', 'single'), story('same', 'single')],
        india: [],
        chennai: [],
        local: [],
        world: [],
      },
      weatherData: {},
      settings: {
        sections: {
          india: { enabled: true },
          chennai: { enabled: true },
          local: { enabled: true },
          world: { enabled: true },
        },
      },
    });

    expect(['D', 'F']).toContain(audit.grade);
    expect(audit.failures.length).toBeGreaterThan(0);
  });

  it('keeps loading as warning instead of hard failure', () => {
    const audit = auditMainTabQuality({
      loading: true,
      newsData: {
        frontPage: Array.from({ length: 10 }, (_, index) => story('s-' + index, 'src_' + index)),
      },
      weatherData: {
        chennai: { current: { temp: 30 } },
      },
    });

    const loadingGate = audit.gates.find(gate => gate.id === 'loading-state');
    expect(loadingGate.status).toBe('WARN');
  });
});
