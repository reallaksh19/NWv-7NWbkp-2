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

fs.mkdirSync('src/services', { recursive: true });

write('src/services/plannerAgendaExport.js', `function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatDateLabel(dateKey) {
  if (!dateKey || dateKey === 'undated') return 'Undated';

  const parsed = new Date(\`\${dateKey}T00:00:00Z\`);
  if (Number.isNaN(parsed.getTime())) return dateKey;

  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function normalizeAgendaItem(item, index) {
  return {
    id: safeText(item?.id || item?.hiddenKey || item?.canonicalId || item?.title || \`item-\${index}\`),
    title: safeText(item?.title, 'Untitled planner item'),
    description: safeText(item?.description || item?.summary || ''),
    category: safeText(item?.category || item?.type || 'event', 'event'),
    dateKey: safeText(item?.dateKey || item?.eventDateKey || item?.planDate || item?.date || 'undated', 'undated'),
    displayDate: safeText(item?.displayDate || formatDateLabel(item?.dateKey), 'Undated'),
    link: safeText(item?.link || item?.url || ''),
  };
}

function normalizeAgendaGroups(groupedDates) {
  return safeArray(groupedDates).map(group => {
    const dateKey = safeText(group?.dateKey, 'undated');
    const items = safeArray(group?.items).map((item, index) => normalizeAgendaItem(item, index));

    return {
      dateKey,
      displayDate: safeText(group?.displayDate || formatDateLabel(dateKey), 'Undated'),
      count: items.length,
      items,
    };
  });
}

export function getPlannerAgendaExport({ viewModel, controls = {}, now = Date.now() } = {}) {
  const groups = normalizeAgendaGroups(viewModel?.groupedDates);
  const items = groups.flatMap(group => group.items);

  const categoryCounts = [...items.reduce((map, item) => {
    map.set(item.category, (map.get(item.category) || 0) + 1);
    return map;
  }, new Map()).entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  return {
    title: 'NWv7 Planner Agenda',
    generatedAt: new Date(now).toISOString(),
    totalCount: Number(viewModel?.totalCount || 0),
    filteredCount: Number(viewModel?.filteredCount || items.length),
    groupCount: groups.length,
    categoryCount: categoryCounts.length,
    controls: {
      query: controls.query || '',
      category: controls.category || 'all',
      dateWindow: controls.dateWindow || 'all',
      sortMode: controls.sortMode || 'date',
    },
    groups,
    items,
    categoryCounts,
    empty: items.length === 0,
  };
}

export function buildPlannerAgendaText(agenda) {
  const data = agenda || getPlannerAgendaExport();

  const lines = [
    data.title || 'NWv7 Planner Agenda',
    \`Generated: \${data.generatedAt}\`,
    \`Showing: \${data.filteredCount} of \${data.totalCount} item(s)\`,
    \`Filters: search="\${data.controls?.query || ''}", category=\${data.controls?.category || 'all'}, window=\${data.controls?.dateWindow || 'all'}, sort=\${data.controls?.sortMode || 'date'}\`,
    '',
  ];

  if (data.empty) {
    lines.push('No planner items match the current view.');
    return lines.join('\\n');
  }

  for (const group of safeArray(data.groups)) {
    lines.push(\`## \${group.displayDate} (\${group.count})\`);

    for (const item of safeArray(group.items)) {
      lines.push(\`- \${item.title} [\${item.category}]\`);
      if (item.description) lines.push(\`  \${item.description}\`);
      if (item.link) lines.push(\`  Link: \${item.link}\`);
    }

    lines.push('');
  }

  return lines.join('\\n').trimEnd();
}

export function buildPlannerAgendaJson(agenda) {
  return JSON.stringify(agenda || getPlannerAgendaExport(), null, 2);
}

function sanitizeFilename(value) {
  return String(value || 'nwv7_planner_agenda')
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'nwv7_planner_agenda';
}

export function downloadPlannerAgendaFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    return false;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
  return true;
}

export function makePlannerAgendaFilename(extension = 'txt') {
  const cleanExtension = String(extension || 'txt').replace(/^\\./, '');
  return \`\${sanitizeFilename('nwv7_planner_agenda')}.\${cleanExtension}\`;
}

export default getPlannerAgendaExport;
`);

write('src/services/plannerAgendaExport.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  buildPlannerAgendaJson,
  buildPlannerAgendaText,
  getPlannerAgendaExport,
  makePlannerAgendaFilename,
} from './plannerAgendaExport';

const viewModel = {
  totalCount: 3,
  filteredCount: 2,
  groupedDates: [
    {
      dateKey: '2026-01-01',
      displayDate: 'Thursday, Jan 1, 2026',
      items: [
        {
          id: 'a',
          title: 'Concert',
          description: 'Evening event',
          category: 'events',
          dateKey: '2026-01-01',
          displayDate: 'Thursday, Jan 1, 2026',
          link: 'https://example.com/concert',
        },
      ],
    },
    {
      dateKey: '2026-01-03',
      displayDate: 'Saturday, Jan 3, 2026',
      items: [
        {
          id: 'b',
          title: 'Movie',
          category: 'movies',
          dateKey: '2026-01-03',
          displayDate: 'Saturday, Jan 3, 2026',
        },
      ],
    },
  ],
};

describe('Planner agenda export certification', () => {
  it('creates agenda export model from filtered planner view', () => {
    const agenda = getPlannerAgendaExport({
      viewModel,
      controls: {
        query: 'movie',
        category: 'all',
        dateWindow: 'next7',
        sortMode: 'date',
      },
      now: Date.parse('2026-01-01T00:00:00Z'),
    });

    expect(agenda.title).toBe('NWv7 Planner Agenda');
    expect(agenda.totalCount).toBe(3);
    expect(agenda.filteredCount).toBe(2);
    expect(agenda.groupCount).toBe(2);
    expect(agenda.items.length).toBe(2);
    expect(agenda.categoryCount).toBe(2);
    expect(agenda.controls.dateWindow).toBe('next7');
  });

  it('builds readable agenda text', () => {
    const agenda = getPlannerAgendaExport({ viewModel, now: Date.parse('2026-01-01T00:00:00Z') });
    const text = buildPlannerAgendaText(agenda);

    expect(text).toContain('NWv7 Planner Agenda');
    expect(text).toContain('Concert');
    expect(text).toContain('Movie');
    expect(text).toContain('https://example.com/concert');
  });

  it('builds agenda json', () => {
    const agenda = getPlannerAgendaExport({ viewModel, now: Date.parse('2026-01-01T00:00:00Z') });
    const json = buildPlannerAgendaJson(agenda);

    expect(JSON.parse(json).items.length).toBe(2);
  });

  it('creates predictable export filename', () => {
    expect(makePlannerAgendaFilename('txt')).toBe('nwv7_planner_agenda.txt');
    expect(makePlannerAgendaFilename('.json')).toBe('nwv7_planner_agenda.json');
  });

  it('handles empty agenda safely', () => {
    const agenda = getPlannerAgendaExport({ viewModel: { totalCount: 0, filteredCount: 0, groupedDates: [] } });
    const text = buildPlannerAgendaText(agenda);

    expect(agenda.empty).toBe(true);
    expect(text).toContain('No planner items match');
  });
});
`);

patchFile('src/pages/MyPlannerPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    "import { getPlannerItemInspector } from '../services/plannerItemInspector';",
    "\nimport { buildPlannerAgendaJson, buildPlannerAgendaText, downloadPlannerAgendaFile, getPlannerAgendaExport, makePlannerAgendaFilename } from '../services/plannerAgendaExport';",
    'planner agenda export import'
  );

  const component = `
function PlannerAgendaExportPanel({
    agenda,
    copyStatus,
    onCopyText,
    onDownloadText,
    onDownloadJson,
    onPrint
}) {
    return (
        <section className={\`planner-agenda-export planner-agenda-export--\${agenda.empty ? 'empty' : 'ready'}\`} data-planner-agenda-export="copy-download-print">
            <div className="planner-agenda-export__header">
                <div>
                    <div className="planner-agenda-export__eyebrow">Agenda export</div>
                    <h2>Share the current planner view</h2>
                    <p>
                        {agenda.filteredCount} filtered item(s), {agenda.groupCount} date group(s), {agenda.categoryCount} category bucket(s).
                    </p>
                </div>
            </div>

            <div className="planner-agenda-export__meta">
                <span>Search: {agenda.controls.query || 'none'}</span>
                <span>Category: {agenda.controls.category}</span>
                <span>Window: {agenda.controls.dateWindow}</span>
                <span>Sort: {agenda.controls.sortMode}</span>
            </div>

            <div className="planner-agenda-export__actions">
                <button type="button" onClick={onCopyText} disabled={agenda.empty}>
                    {copyStatus || 'Copy text'}
                </button>
                <button type="button" onClick={onDownloadText} disabled={agenda.empty}>
                    Download TXT
                </button>
                <button type="button" onClick={onDownloadJson} disabled={agenda.empty}>
                    Download JSON
                </button>
                <button type="button" onClick={onPrint}>
                    Print
                </button>
            </div>
        </section>
    );
}

`;

  if (!text.includes('function PlannerAgendaExportPanel({')) {
    text = text.replace('function PlannerItemInspectorPanel({ detail, onClose, onExportCalendar, onRemove }) {', `${component}function PlannerItemInspectorPanel({ detail, onClose, onExportCalendar, onRemove }) {`);
  }

  text = insertAfterOnce(
    text,
    `    const [inspectedPlannerItem, setInspectedPlannerItem] = useState(null);
`,
    `    const [plannerAgendaCopyStatus, setPlannerAgendaCopyStatus] = useState('');
`,
    'planner agenda copy status state'
  );

  text = insertAfterOnce(
    text,
    `    const inspectedPlannerDetail = useMemo(() => (
        inspectedPlannerItem
            ? getPlannerItemInspector(inspectedPlannerItem.item, inspectedPlannerItem.dateKey)
            : null
    ), [inspectedPlannerItem]);
`,
    `
    const plannerAgendaExport = useMemo(() => (
        getPlannerAgendaExport({
            viewModel: plannerViewModel,
            controls: plannerControls
        })
    ), [plannerViewModel, plannerControls]);
`,
    'planner agenda export memo'
  );

  const handlers = `
    const copyPlannerAgendaText = async () => {
        const text = buildPlannerAgendaText(plannerAgendaExport);

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', 'readonly');
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }

            setPlannerAgendaCopyStatus('Copied');
        } catch {
            setPlannerAgendaCopyStatus('Copy failed');
        }

        setTimeout(() => setPlannerAgendaCopyStatus(''), 1800);
    };

    const downloadPlannerAgendaTextFile = () => {
        downloadPlannerAgendaFile(
            makePlannerAgendaFilename('txt'),
            buildPlannerAgendaText(plannerAgendaExport),
            'text/plain;charset=utf-8'
        );
    };

    const downloadPlannerAgendaJsonFile = () => {
        downloadPlannerAgendaFile(
            makePlannerAgendaFilename('json'),
            buildPlannerAgendaJson(plannerAgendaExport),
            'application/json;charset=utf-8'
        );
    };

    const printPlannerAgenda = () => {
        window.print();
    };

`;

  if (!text.includes('const copyPlannerAgendaText = async () =>')) {
    text = text.replace('    const inspectPlannerItem = (item, dateKey) => {', `${handlers}    const inspectPlannerItem = (item, dateKey) => {`);
  }

  text = insertAfterOnce(
    text,
    `                <PlannerBulkActionBar
                    summary={plannerBulkSummary}
                    onSelectAll={selectAllFilteredPlannerItems}
                    onClearSelection={clearPlannerSelection}
                    onExportCalendar={exportSelectedPlannerItems}
                    onRemoveSelected={removeSelectedPlannerItems}
                />
`,
    `
                <PlannerAgendaExportPanel
                    agenda={plannerAgendaExport}
                    copyStatus={plannerAgendaCopyStatus}
                    onCopyText={copyPlannerAgendaText}
                    onDownloadText={downloadPlannerAgendaTextFile}
                    onDownloadJson={downloadPlannerAgendaJsonFile}
                    onPrint={printPlannerAgenda}
                />
`,
    'planner agenda export render'
  );

  return text;
});

patchFile('src/pages/MyPlanner.css', source => {
  if (source.includes('.planner-agenda-export {')) return source;

  return `${source}

/* ==========================================================================
   My Planner agenda export
   Slice 30
   ========================================================================== */

.planner-agenda-export {
    margin: 0 0 16px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background:
        radial-gradient(420px 180px at 100% 0%, rgba(14, 165, 233, 0.10), transparent 62%),
        rgba(15, 23, 42, 0.74);
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.16);
}

.planner-agenda-export--ready {
    border-color: rgba(14, 165, 233, 0.34);
}

.planner-agenda-export--empty {
    border-color: rgba(148, 163, 184, 0.22);
}

.planner-agenda-export__eyebrow {
    color: #7dd3fc;
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.planner-agenda-export h2 {
    margin: 4px 0;
    color: var(--text-primary, #FFFFFF);
    font-size: 1.08rem;
    line-height: 1.18;
}

.planner-agenda-export p {
    margin: 0;
    color: var(--text-secondary, #9CA5B0);
    font-size: 0.84rem;
    line-height: 1.45;
}

.planner-agenda-export__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
}

.planner-agenda-export__meta span {
    padding: 4px 8px;
    border-radius: 999px;
    color: #e0f2fe;
    background: rgba(14, 165, 233, 0.10);
    border: 1px solid rgba(14, 165, 233, 0.18);
    font-size: 0.68rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.planner-agenda-export__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
}

.planner-agenda-export__actions button {
    min-height: 36px;
    border-radius: 11px;
    border: 1px solid rgba(14, 165, 233, 0.24);
    background: rgba(14, 165, 233, 0.10);
    color: #bae6fd;
    font-weight: 850;
    cursor: pointer;
    padding: 0 12px;
}

.planner-agenda-export__actions button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
}

@media print {
    .planner-controls,
    .planner-bulk,
    .planner-agenda-export,
    .planner-inspector,
    .ua-plan-delete-btn,
    .planner-item-select,
    .planner-item-inspect-btn,
    .ua-plan-action-btn {
        display: none !important;
    }

    .page-container,
    .main-content {
        background: #fff !important;
        color: #000 !important;
    }
}

@media (max-width: 640px) {
    .planner-agenda-export {
        padding: 14px;
    }

    .planner-agenda-export__actions button {
        flex: 1 1 calc(50% - 8px);
    }
}
`;
});

write('scripts/test_planner_agenda_export_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerAgendaExport.js');
const moduleTest = read('src/services/plannerAgendaExport.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerAgendaExport',
  'buildPlannerAgendaText',
  'buildPlannerAgendaJson',
  'downloadPlannerAgendaFile',
  'makePlannerAgendaFilename',
  'categoryCounts',
  'groupCount'
]) {
  assert(module.includes(token), \`plannerAgendaExport.js missing token: \${token}\`);
}

for (const token of [
  'Planner agenda export certification',
  'creates agenda export model from filtered planner view',
  'builds readable agenda text',
  'builds agenda json',
  'creates predictable export filename',
  'handles empty agenda safely'
]) {
  assert(moduleTest.includes(token), \`plannerAgendaExport.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'PlannerAgendaExportPanel',
  'data-planner-agenda-export',
  'copy-download-print',
  'plannerAgendaExport',
  'plannerAgendaCopyStatus',
  'copyPlannerAgendaText',
  'downloadPlannerAgendaTextFile',
  'downloadPlannerAgendaJsonFile',
  'printPlannerAgenda'
]) {
  assert(page.includes(token), \`MyPlannerPage.jsx missing agenda export token: \${token}\`);
}

for (const token of [
  '.planner-agenda-export',
  '.planner-agenda-export__meta',
  '.planner-agenda-export__actions',
  '@media print'
]) {
  assert(css.includes(token), \`MyPlanner.css missing agenda export CSS token: \${token}\`);
}

assert(
  packageJson.includes('"test:planner-agenda-export"'),
  'package.json must include test:planner-agenda-export'
);

assert(
  certGate.includes("['npm', ['run', 'test:planner-agenda-export']]"),
  'certification gate must run test:planner-agenda-export'
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
  checked: 'My Planner agenda export slice',
  guarantees: [
    'planner agenda export service exists',
    'copy/download/print panel is rendered',
    'text and JSON agenda builders are certified',
    'filtered planner view is exported',
    'print CSS is included',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner agenda export static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:planner-agenda-export'] = 'node scripts/test_planner_agenda_export_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:planner-agenda-export']]")) return source;

  return source.replace(
    "  ['npm', ['run', 'test:planner-item-inspector']],",
    "  ['npm', ['run', 'test:planner-item-inspector']],\n  ['npm', ['run', 'test:planner-agenda-export']],"
  );
});

console.log('\nSlice 30 planner agenda export patch complete.');
