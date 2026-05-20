import { describe, expect, it } from 'vitest';
import {
  buildAuditFileName,
  createAuditExportPayload,
  getGradeExplanation,
  getGradeLegendRows,
  stringifyAuditExport,
} from './auditExport';

describe('Audit export and grade legend certification', () => {
  it('returns useful grade explanation', () => {
    expect(getGradeExplanation('A').label).toBe('Excellent');
    expect(getGradeExplanation('F').action).toContain('Do not rely');
    expect(getGradeExplanation('bad').label).toBe('Fail');
  });

  it('creates normalized export payload', () => {
    const payload = createAuditExportPayload({
      target: 'main-tab',
      title: 'Main tab data quality',
      grade: 'B',
      score: 82,
      dataTrust: { status: 'WARN' },
      gates: [{ id: 'source-diversity', status: 'PASS' }],
      moreDiagnostics: [{ id: 'raw', metrics: [{ label: 'Stories', value: 10 }] }],
    });

    expect(payload.schemaVersion).toBe(1);
    expect(payload.exportType).toBe('nw-page-audit');
    expect(payload.grade).toBe('B');
    expect(payload.gradeExplanation.label).toBe('Good');
    expect(payload.gates.length).toBe(1);
  });

  it('stringifies export payload as JSON', () => {
    const text = stringifyAuditExport({
      target: 'weather-tab',
      grade: 'C',
      score: 61,
    });

    expect(text).toContain('"exportType": "nw-page-audit"');
    expect(text).toContain('"grade": "C"');
  });

  it('builds safe file names', () => {
    const fileName = buildAuditFileName({
      target: 'Weather Tab',
      grade: 'A',
    });

    expect(fileName).toContain('weather-tab-grade-a-audit-');
    expect(fileName.endsWith('.json')).toBe(true);
  });

  it('lists all grade legend rows', () => {
    const rows = getGradeLegendRows();
    expect(rows.map(row => row.grade)).toEqual(['A', 'B', 'C', 'D', 'F']);
  });
});
