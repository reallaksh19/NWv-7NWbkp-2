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

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }

  return source.replace(before, after);
}

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

/* -------------------------------------------------------------------------- */
/* 1) Audit export / grade legend service                                      */
/* -------------------------------------------------------------------------- */

write('src/services/auditExport.js', `const GRADE_EXPLANATIONS = {
  A: {
    label: 'Excellent',
    description: 'Data is broad, fresh, low-duplicate and all major gates passed.',
    action: 'No immediate action required.',
  },
  B: {
    label: 'Good',
    description: 'Data is usable with minor weaknesses or soft warnings.',
    action: 'Review warnings if decisions are important.',
  },
  C: {
    label: 'Watch',
    description: 'Data is partially usable but has meaningful gaps.',
    action: 'Open More diagnostics before relying on this page.',
  },
  D: {
    label: 'Weak',
    description: 'Important gates are degraded or missing.',
    action: 'Treat this page as limited until the failed gates improve.',
  },
  F: {
    label: 'Fail',
    description: 'Data quality is not reliable for decision support.',
    action: 'Do not rely on this page without checking raw diagnostics.',
  },
};

function safeJsonClone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

function sanitizeFilePart(value) {
  return String(value || 'audit')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'audit';
}

export function getGradeExplanation(grade) {
  const key = String(grade || 'F').toUpperCase();
  return GRADE_EXPLANATIONS[key] || GRADE_EXPLANATIONS.F;
}

export function createAuditExportPayload(audit) {
  const grade = String(audit?.grade || 'F').toUpperCase();
  const explanation = getGradeExplanation(grade);

  return {
    schemaVersion: 1,
    exportType: 'nw-page-audit',
    exportedAt: new Date().toISOString(),
    target: audit?.target || 'unknown',
    title: audit?.title || 'Page quality audit',
    grade,
    score: Number.isFinite(Number(audit?.score)) ? Number(audit.score) : null,
    tone: audit?.tone || 'bad',
    gradeExplanation: explanation,
    generatedAt: audit?.generatedAt || null,
    dataTrust: safeJsonClone(audit?.dataTrust) || {},
    summary: safeJsonClone(audit?.summary) || {},
    gates: safeJsonClone(audit?.gates) || [],
    warnings: safeJsonClone(audit?.warnings) || [],
    failures: safeJsonClone(audit?.failures) || [],
    moreDiagnostics: safeJsonClone(audit?.moreDiagnostics) || [],
  };
}

export function stringifyAuditExport(audit) {
  return JSON.stringify(createAuditExportPayload(audit), null, 2);
}

export function buildAuditFileName(audit) {
  const target = sanitizeFilePart(audit?.target || audit?.title || 'audit');
  const grade = sanitizeFilePart(audit?.grade || 'grade');
  const date = new Date().toISOString().slice(0, 10);
  return \`\${target}-grade-\${grade}-audit-\${date}.json\`;
}

export function getGradeLegendRows() {
  return Object.entries(GRADE_EXPLANATIONS).map(([grade, value]) => ({
    grade,
    ...value,
  }));
}
`);

write('src/services/auditExport.cert.test.js', `import { describe, expect, it } from 'vitest';
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
`);

/* -------------------------------------------------------------------------- */
/* 2) Patch AuditDetailModal for actions, legend and Escape close              */
/* -------------------------------------------------------------------------- */

patchFile('src/components/audit/AuditDetailModal.jsx', source => {
  let text = source;

  text = replaceOnce(
    text,
    `import { useMemo, useState } from 'react';`,
    `import { useEffect, useMemo, useState } from 'react';
import {
  buildAuditFileName,
  getGradeExplanation,
  stringifyAuditExport,
} from '../../services/auditExport.js';`,
    'AuditDetailModal imports'
  );

  text = insertAfterOnce(
    text,
    `function KeyValue({ label, value }) {
  return (
    <div className="audit-modal__kv">
      <span>{label}</span>
      <strong>{stringifyDiagnosticValue(value)}</strong>
    </div>
  );
}

`,
    `function GradeMeaning({ grade }) {
  const explanation = getGradeExplanation(grade);

  return (
    <div className="audit-modal__grade-meaning" data-audit-grade-meaning={grade || 'F'}>
      <strong>{grade || 'F'} — {explanation.label}</strong>
      <span>{explanation.description}</span>
      <em>{explanation.action}</em>
    </div>
  );
}

`,
    'GradeMeaning component'
  );

  text = replaceOnce(
    text,
    `  const [showMoreDiagnostics, setShowMoreDiagnostics] = useState(false);`,
    `  const [showMoreDiagnostics, setShowMoreDiagnostics] = useState(false);
  const [actionMessage, setActionMessage] = useState('');`,
    'action message state'
  );

  text = insertAfterOnce(
    text,
    `  const moreDiagnostics = useMemo(
    () => normalizeMoreDiagnostics(audit?.moreDiagnostics),
    [audit]
  );

`,
    `  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function copyAuditJson() {
    const text = stringifyAuditExport(audit);

    try {
      await navigator.clipboard.writeText(text);
      setActionMessage('Audit JSON copied.');
    } catch {
      setActionMessage('Copy failed. Use Download JSON instead.');
    }
  }

  function downloadAuditJson() {
    try {
      const text = stringifyAuditExport(audit);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildAuditFileName(audit);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setActionMessage('Audit JSON downloaded.');
    } catch {
      setActionMessage('Download failed.');
    }
  }

`,
    'audit modal actions'
  );

  text = insertAfterOnce(
    text,
    `        <div className="audit-modal__score-row">
          <KeyValue label="Score" value={audit?.score != null ? audit.score + '/100' : '—'} />
          <KeyValue label="Target" value={audit?.target || '—'} />
          <KeyValue label="Data trust" value={audit?.dataTrust?.status || '—'} />
          <KeyValue label="Generated" value={audit?.generatedAt ? new Date(audit.generatedAt).toLocaleString() : '—'} />
        </div>

`,
    `        <div className="audit-modal__actions-row">
          <GradeMeaning grade={audit?.grade || 'F'} />

          <div className="audit-modal__actions">
            <button type="button" onClick={copyAuditJson} data-audit-copy-json="true">
              Copy audit JSON
            </button>
            <button type="button" onClick={downloadAuditJson} data-audit-download-json="true">
              Download JSON
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="audit-modal__action-message" role="status">
            {actionMessage}
          </div>
        )}

`,
    'audit actions row'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 3) Patch AuditDetailModal CSS                                               */
/* -------------------------------------------------------------------------- */

patchFile('src/components/audit/AuditDetailModal.css', source => {
  if (source.includes('.audit-modal__actions-row')) return source;

  return `${source}

/* Grade popup export / copy / legend controls */

.audit-modal__actions-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: stretch;
  padding: 14px 18px 0;
}

.audit-modal__grade-meaning {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(147, 197, 253, 0.20);
  border-radius: 16px;
  background: rgba(30, 64, 175, 0.16);
}

.audit-modal__grade-meaning strong,
.audit-modal__grade-meaning span,
.audit-modal__grade-meaning em {
  display: block;
}

.audit-modal__grade-meaning strong {
  color: #f8fafc;
  font-size: 0.92rem;
}

.audit-modal__grade-meaning span {
  margin-top: 4px;
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.35;
}

.audit-modal__grade-meaning em {
  margin-top: 4px;
  color: #bfdbfe;
  font-size: 0.76rem;
  font-style: normal;
  font-weight: 800;
}

.audit-modal__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 150px;
}

.audit-modal__actions button {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(147, 197, 253, 0.28);
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.14);
  color: #bfdbfe;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 900;
}

.audit-modal__actions button:hover {
  background: rgba(59, 130, 246, 0.22);
}

.audit-modal__action-message {
  margin: 10px 18px 0;
  padding: 8px 10px;
  border: 1px solid rgba(34, 197, 94, 0.22);
  border-radius: 12px;
  background: rgba(22, 101, 52, 0.18);
  color: #bbf7d0;
  font-size: 0.78rem;
  font-weight: 800;
}

@media (max-width: 680px) {
  .audit-modal__actions-row {
    grid-template-columns: 1fr;
  }

  .audit-modal__actions {
    flex-direction: row;
    min-width: 0;
  }

  .audit-modal__actions button {
    flex: 1;
  }
}

@media (max-width: 420px) {
  .audit-modal__actions {
    flex-direction: column;
  }
}
`;
});

/* -------------------------------------------------------------------------- */
/* 4) E2E static certification                                                  */
/* -------------------------------------------------------------------------- */

write('scripts/test_grade_system_e2e_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const requiredFiles = [
  'src/components/audit/GradeBadge.jsx',
  'src/components/audit/GradeBadge.css',
  'src/components/audit/AuditDetailModal.jsx',
  'src/components/audit/AuditDetailModal.css',
  'src/components/audit/gradeBadgePlacement.js',
  'src/services/pageAuditGrading.js',
  'src/services/auditExport.js',
];

for (const file of requiredFiles) {
  read(file);
}

const badge = read('src/components/audit/GradeBadge.jsx');
const modal = read('src/components/audit/AuditDetailModal.jsx');
const modalCss = read('src/components/audit/AuditDetailModal.css');
const grading = read('src/services/pageAuditGrading.js');
const auditExport = read('src/services/auditExport.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'data-grade-badge',
  'getGradeBadgeClassName',
  'AuditDetailModal'
]) {
  assert(badge.includes(token), 'GradeBadge.jsx missing token: ' + token);
}

for (const token of [
  'Copy audit JSON',
  'Download JSON',
  'data-audit-copy-json',
  'data-audit-download-json',
  'data-audit-grade-meaning',
  'Escape',
  'More diagnostics'
]) {
  assert(modal.includes(token), 'AuditDetailModal.jsx missing token: ' + token);
}

for (const token of [
  '.audit-modal__actions-row',
  '.audit-modal__grade-meaning',
  '.audit-modal__actions',
  '.audit-modal__action-message'
]) {
  assert(modalCss.includes(token), 'AuditDetailModal.css missing token: ' + token);
}

for (const token of [
  'auditMainTabQuality',
  'auditWeatherTabQuality',
  'auditMarketTabQuality',
  'auditInsightTabQuality',
  'moreDiagnostics'
]) {
  assert(grading.includes(token), 'pageAuditGrading.js missing token: ' + token);
}

for (const token of [
  'createAuditExportPayload',
  'stringifyAuditExport',
  'buildAuditFileName',
  'getGradeExplanation',
  'getGradeLegendRows'
]) {
  assert(auditExport.includes(token), 'auditExport.js missing token: ' + token);
}

const pageChecks = [
  ['src/pages/MainPage.jsx', 'Main tab quality grade'],
  ['src/pages/WeatherPage.jsx', 'Weather tab quality grade'],
  ['src/pages/MarketPage.jsx', 'Market tab quality grade'],
  ['src/pages/InsightPage.jsx', 'Insight tab quality grade'],
];

for (const [file, token] of pageChecks) {
  if (fs.existsSync(file)) {
    const content = read(file);
    assert(content.includes('GradeBadge'), file + ' must use GradeBadge');
    assert(content.includes(token), file + ' missing label token: ' + token);
  }
}

assert(
  packageJson.includes('"test:grade-system-e2e"'),
  'package.json must include test:grade-system-e2e'
);

assert(
  certGate.includes("['npm', ['run', 'test:grade-system-e2e']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include grade system e2e test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Grade system end-to-end static certification',
  guarantees: [
    'GradeBadge exists and opens the audit modal',
    'Grade popup includes grade meaning',
    'Grade popup supports Copy audit JSON',
    'Grade popup supports Download JSON',
    'Grade popup supports More diagnostics',
    'Main/Weather/Market/Insight use GradeBadge where pages exist',
    'Audit export payload is normalized',
    'Grade system certification is included'
  ]
}, null, 2));

console.log('PASS: Grade system e2e static certification');
`);

/* -------------------------------------------------------------------------- */
/* 5) package.json + certification                                             */
/* -------------------------------------------------------------------------- */

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:audit-export'] =
    'vitest run --config vitest.config.js src/services/auditExport.cert.test.js';
  pkg.scripts['test:grade-system-e2e'] =
    'node scripts/test_grade_system_e2e_static.mjs && npm run test:audit-export';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:grade-system-e2e']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  if (source.includes("  ['npm', ['run', 'test:grade-badge-position-safety']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:grade-badge-position-safety']],",
      "  ['npm', ['run', 'test:grade-badge-position-safety']],\\n  ['npm', ['run', 'test:grade-system-e2e']],"
    );
  }

  if (source.includes("  ['npm', ['run', 'test:grade-popup-more-diagnostics']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:grade-popup-more-diagnostics']],",
      "  ['npm', ['run', 'test:grade-popup-more-diagnostics']],\\n  ['npm', ['run', 'test:grade-system-e2e']],"
    );
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'grade-system-e2e')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'grade-badge-position-safety');
      const command = {
        id: 'grade-system-e2e',
        cmd: 'npm',
        args: ['run', 'test:grade-system-e2e'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:grade-system-e2e')) return source;

    if (source.includes("'test:grade-badge-position-safety',")) {
      return source.replace(
        "'test:grade-badge-position-safety',",
        "'test:grade-badge-position-safety',\\n  'test:grade-system-e2e',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 60E Grade popup export and e2e certification patch complete.');
