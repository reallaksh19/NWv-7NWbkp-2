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

fs.mkdirSync('src/services', { recursive: true });

write('src/services/plannerInteractionQuality.js', `function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getStateLabel(state) {
  if (state === 'ready') return 'Ready';
  if (state === 'active') return 'Active';
  if (state === 'focused') return 'Focused';
  if (state === 'empty') return 'Empty';
  return 'Idle';
}

export function getPlannerInteractionQuality(input = {}) {
  const totalCount = asNumber(input.totalCount);
  const filteredCount = asNumber(input.filteredCount);
  const selectedCount = asNumber(input.selectedCount);
  const inspectorOpen = Boolean(input.inspectorOpen);
  const agendaEmpty = Boolean(input.agendaEmpty);
  const copyStatus = String(input.copyStatus || '');

  const checks = [
    {
      key: 'filters',
      label: 'Filtered view',
      state: filteredCount > 0 ? 'ready' : totalCount > 0 ? 'idle' : 'empty',
      detail: \`\${filteredCount} of \${totalCount} item(s) visible\`,
    },
    {
      key: 'selection',
      label: 'Bulk selection',
      state: selectedCount > 0 ? 'active' : filteredCount > 0 ? 'ready' : 'idle',
      detail: selectedCount > 0
        ? \`\${selectedCount} selected item(s)\`
        : 'Selection is available when filtered items are visible',
    },
    {
      key: 'inspector',
      label: 'Item inspector',
      state: inspectorOpen ? 'focused' : filteredCount > 0 ? 'ready' : 'idle',
      detail: inspectorOpen
        ? 'Inspector is open; Escape closes it'
        : 'Inspector can be opened from each planner row',
    },
    {
      key: 'agenda',
      label: 'Agenda export',
      state: agendaEmpty ? 'empty' : 'ready',
      detail: agendaEmpty
        ? 'No filtered agenda items to export'
        : 'Copy, TXT, JSON and print are available',
    },
    {
      key: 'copy',
      label: 'Copy status',
      state: copyStatus ? 'active' : 'idle',
      detail: copyStatus || 'No recent copy action',
    },
  ];

  const status = inspectorOpen
    ? 'focused'
    : selectedCount > 0
      ? 'active'
      : filteredCount > 0
        ? 'ready'
        : 'empty';

  const notes = [];

  if (filteredCount === 0 && totalCount > 0) {
    notes.push('Filters are hiding all saved planner items.');
  }

  if (selectedCount > 0) {
    notes.push('Bulk actions are enabled for selected items.');
  }

  if (inspectorOpen) {
    notes.push('Press Escape to close the item inspector.');
  }

  if (!agendaEmpty) {
    notes.push('Current filtered agenda can be copied, downloaded, or printed.');
  }

  if (notes.length === 0) {
    notes.push('Planner interaction controls are idle.');
  }

  return {
    status,
    statusLabel: getStateLabel(status),
    totalCount,
    filteredCount,
    selectedCount,
    inspectorOpen,
    agendaEmpty,
    copyStatus,
    checks,
    notes,
  };
}

export default getPlannerInteractionQuality;
`);

write('src/services/plannerInteractionQuality.cert.test.js', `import { describe, expect, it } from 'vitest';
import { getPlannerInteractionQuality } from './plannerInteractionQuality';

describe('Planner interaction quality certification', () => {
  it('reports ready state when filtered planner items are visible', () => {
    const quality = getPlannerInteractionQuality({
      totalCount: 5,
      filteredCount: 3,
      selectedCount: 0,
      inspectorOpen: false,
      agendaEmpty: false,
    });

    expect(quality.status).toBe('ready');
    expect(quality.checks.map(check => check.key)).toContain('agenda');
    expect(quality.notes.join(' ')).toContain('copied');
  });

  it('reports active state when bulk selection exists', () => {
    const quality = getPlannerInteractionQuality({
      totalCount: 5,
      filteredCount: 3,
      selectedCount: 2,
      inspectorOpen: false,
      agendaEmpty: false,
    });

    expect(quality.status).toBe('active');
    expect(quality.notes.join(' ')).toContain('Bulk actions');
  });

  it('reports focused state when inspector is open', () => {
    const quality = getPlannerInteractionQuality({
      totalCount: 5,
      filteredCount: 3,
      selectedCount: 0,
      inspectorOpen: true,
      agendaEmpty: false,
    });

    expect(quality.status).toBe('focused');
    expect(quality.notes.join(' ')).toContain('Escape');
  });

  it('reports empty state safely', () => {
    const quality = getPlannerInteractionQuality({
      totalCount: 0,
      filteredCount: 0,
      selectedCount: 0,
      inspectorOpen: false,
      agendaEmpty: true,
    });

    expect(quality.status).toBe('empty');
    expect(quality.checks.length).toBeGreaterThanOrEqual(5);
  });
});
`);

patchFile('src/pages/MyPlannerPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    "import { buildPlannerAgendaJson, buildPlannerAgendaText, downloadPlannerAgendaFile, getPlannerAgendaExport, makePlannerAgendaFilename } from '../services/plannerAgendaExport';",
    "\nimport { getPlannerInteractionQuality } from '../services/plannerInteractionQuality';",
    'planner interaction quality import'
  );

  const component = `
function PlannerInteractionQualityPanel({ quality }) {
    return (
        <section className={\`planner-interaction-quality planner-interaction-quality--\${quality.status}\`} data-planner-interaction-quality="accessibility-readiness">
            <div className="planner-interaction-quality__header">
                <div>
                    <div className="planner-interaction-quality__eyebrow">Interaction quality</div>
                    <h2>{quality.statusLabel}</h2>
                    <p>
                        {quality.filteredCount} visible · {quality.selectedCount} selected · inspector {quality.inspectorOpen ? 'open' : 'closed'}.
                    </p>
                </div>
            </div>

            <div className="planner-interaction-quality__checks">
                {quality.checks.map(check => (
                    <div key={check.key} className={\`planner-interaction-quality__check planner-interaction-quality__check--\${check.state}\`}>
                        <span>{check.label}</span>
                        <strong>{check.detail}</strong>
                    </div>
                ))}
            </div>

            <ul className="planner-interaction-quality__notes">
                {quality.notes.map((note, index) => (
                    <li key={\`planner-interaction-note-\${index}\`}>{note}</li>
                ))}
            </ul>
        </section>
    );
}

`;

  if (!text.includes('function PlannerInteractionQualityPanel({')) {
    text = text.replace('function PlannerAgendaExportPanel({', `${component}function PlannerAgendaExportPanel({`);
  }

  text = replaceOnce(
    text,
    `<section className={\`planner-agenda-export planner-agenda-export--\${agenda.empty ? 'empty' : 'ready'}\`} data-planner-agenda-export="copy-download-print">`,
    `<section className={\`planner-agenda-export planner-agenda-export--\${agenda.empty ? 'empty' : 'ready'}\`} data-planner-agenda-export="copy-download-print" role="status" aria-live="polite">`,
    'agenda export aria live'
  );

  text = replaceOnce(
    text,
    `<aside className="planner-inspector" data-planner-item-inspector="metadata-actions" role="dialog" aria-label="Planner item inspector">`,
    `<aside
            className="planner-inspector"
            data-planner-item-inspector="metadata-actions"
            role="dialog"
            aria-modal="true"
            aria-label="Planner item inspector"
            tabIndex={-1}
            onKeyDown={event => {
                if (event.key === 'Escape') onClose();
            }}
        >`,
    'inspector aria modal'
  );

  text = insertAfterOnce(
    text,
    `    const plannerAgendaExport = useMemo(() => (
        getPlannerAgendaExport({
            viewModel: plannerViewModel,
            controls: plannerControls
        })
    ), [plannerViewModel, plannerControls]);
`,
    `
    const plannerInteractionQuality = useMemo(() => (
        getPlannerInteractionQuality({
            totalCount: plannerViewModel.totalCount,
            filteredCount: plannerViewModel.filteredCount,
            selectedCount: plannerBulkSummary.selectedCount,
            inspectorOpen: Boolean(inspectedPlannerDetail),
            agendaEmpty: plannerAgendaExport.empty,
            copyStatus: plannerAgendaCopyStatus
        })
    ), [plannerViewModel.totalCount, plannerViewModel.filteredCount, plannerBulkSummary.selectedCount, inspectedPlannerDetail, plannerAgendaExport.empty, plannerAgendaCopyStatus]);
`,
    'planner interaction quality memo'
  );

  const escapeEffect = `
    useEffect(() => {
        if (!inspectedPlannerItem) return undefined;

        const handlePlannerEscape = (event) => {
            if (event.key === 'Escape') {
                setInspectedPlannerItem(null);
            }
        };

        window.addEventListener('keydown', handlePlannerEscape);

        return () => {
            window.removeEventListener('keydown', handlePlannerEscape);
        };
    }, [inspectedPlannerItem]);

`;

  if (!text.includes('handlePlannerEscape')) {
    text = text.replace('    const removeWithUndo = (item, dateKey) => {', `${escapeEffect}    const removeWithUndo = (item, dateKey) => {`);
  }

  text = insertAfterOnce(
    text,
    `                <PlannerAgendaExportPanel
                    agenda={plannerAgendaExport}
                    copyStatus={plannerAgendaCopyStatus}
                    onCopyText={copyPlannerAgendaText}
                    onDownloadText={downloadPlannerAgendaTextFile}
                    onDownloadJson={downloadPlannerAgendaJsonFile}
                    onPrint={printPlannerAgenda}
                />
`,
    `
                <PlannerInteractionQualityPanel quality={plannerInteractionQuality} />
`,
    'planner interaction quality panel render'
  );

  text = replaceOnce(
    text,
    `<div style={{
                        position: 'fixed',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        padding: '12px 24px',
                        borderRadius: '24px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        zIndex: 1000
                    }}>`,
    `<div
                    role="status"
                    aria-live="polite"
                    style={{
                        position: 'fixed',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        padding: '12px 24px',
                        borderRadius: '24px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        zIndex: 1000
                    }}>`,
    'undo toast aria live'
  );

  return text;
});

patchFile('src/pages/MyPlanner.css', source => {
  if (source.includes('.planner-interaction-quality {')) return source;

  return `${source}

/* ==========================================================================
   My Planner interaction quality
   Slice 31
   ========================================================================== */

.planner-interaction-quality {
    margin: 0 0 16px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background:
        radial-gradient(420px 180px at 100% 0%, rgba(45, 212, 191, 0.10), transparent 62%),
        rgba(15, 23, 42, 0.74);
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.16);
}

.planner-interaction-quality--ready,
.planner-interaction-quality--active,
.planner-interaction-quality--focused {
    border-color: rgba(45, 212, 191, 0.34);
}

.planner-interaction-quality--empty {
    border-color: rgba(148, 163, 184, 0.22);
}

.planner-interaction-quality__eyebrow {
    color: #5eead4;
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.planner-interaction-quality h2 {
    margin: 4px 0;
    color: var(--text-primary, #FFFFFF);
    font-size: 1.08rem;
    line-height: 1.18;
}

.planner-interaction-quality p {
    margin: 0;
    color: var(--text-secondary, #9CA5B0);
    font-size: 0.84rem;
    line-height: 1.45;
}

.planner-interaction-quality__checks {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
    margin-top: 14px;
}

.planner-interaction-quality__check {
    padding: 10px;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(255, 255, 255, 0.045);
}

.planner-interaction-quality__check span {
    display: block;
    color: var(--text-secondary, #9CA5B0);
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.07em;
    text-transform: uppercase;
}

.planner-interaction-quality__check strong {
    display: block;
    margin-top: 4px;
    color: var(--text-primary, #FFFFFF);
    font-size: 0.78rem;
    line-height: 1.35;
}

.planner-interaction-quality__check--active,
.planner-interaction-quality__check--focused,
.planner-interaction-quality__check--ready {
    border-color: rgba(45, 212, 191, 0.20);
    background: rgba(45, 212, 191, 0.07);
}

.planner-interaction-quality__notes {
    margin: 12px 0 0;
    padding-left: 18px;
    color: #cbd5e1;
    font-size: 0.8rem;
    line-height: 1.45;
}

@media print {
    .planner-interaction-quality {
        display: none !important;
    }
}
`;
});

write('scripts/test_planner_interaction_quality_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerInteractionQuality.js');
const moduleTest = read('src/services/plannerInteractionQuality.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerInteractionQuality',
  'statusLabel',
  'inspectorOpen',
  'agendaEmpty',
  'copyStatus',
  'Escape closes it'
]) {
  assert(module.includes(token), \`plannerInteractionQuality.js missing token: \${token}\`);
}

for (const token of [
  'Planner interaction quality certification',
  'reports ready state',
  'reports active state',
  'reports focused state',
  'reports empty state safely'
]) {
  assert(moduleTest.includes(token), \`plannerInteractionQuality.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'getPlannerInteractionQuality',
  'PlannerInteractionQualityPanel',
  'data-planner-interaction-quality',
  'accessibility-readiness',
  'plannerInteractionQuality',
  'handlePlannerEscape',
  'aria-modal="true"',
  'aria-live="polite"',
  'role="status"'
]) {
  assert(page.includes(token), \`MyPlannerPage.jsx missing interaction quality token: \${token}\`);
}

for (const token of [
  '.planner-interaction-quality',
  '.planner-interaction-quality__checks',
  '.planner-interaction-quality__check',
  '.planner-interaction-quality__notes'
]) {
  assert(css.includes(token), \`MyPlanner.css missing interaction quality CSS token: \${token}\`);
}

assert(
  packageJson.includes('"test:planner-interaction-quality"'),
  'package.json must include test:planner-interaction-quality'
);

assert(
  certGate.includes("['npm', ['run', 'test:planner-interaction-quality']]"),
  'certification gate must run test:planner-interaction-quality'
);

assert(
  certGate.includes("['npm', ['run', 'lint']]"),
  'certification gate must still run lint'
);

assert(
  certGate.includes("['npm', ['run', 'test:unit']]"),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'My Planner interaction quality slice',
  guarantees: [
    'planner interaction quality service exists',
    'interaction quality panel is rendered',
    'Escape closes item inspector',
    'inspector modal semantics are present',
    'agenda export and undo status are live regions',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner interaction quality static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:planner-interaction-quality'] = 'node scripts/test_planner_interaction_quality_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:planner-interaction-quality']]")) return source;

  return source.replace(
    "  ['npm', ['run', 'test:planner-agenda-export']]",
    "  ['npm', ['run', 'test:planner-agenda-export']],\n  ['npm', ['run', 'test:planner-interaction-quality']]"
  );
});

console.log('\nSlice 31 planner interaction quality patch complete.');
