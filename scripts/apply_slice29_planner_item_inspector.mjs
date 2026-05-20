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

write('src/services/plannerItemInspector.js', `function asText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function toDateKey(value) {
  if (!value) return 'undated';

  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(value))) {
    return String(value);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'undated';

  return parsed.toISOString().slice(0, 10);
}

function formatDisplayDate(dateKey) {
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

function normalizeCategory(item) {
  return asText(item?.category || item?.type || 'event', 'event')
    .toLowerCase()
    .replace(/\\s+/g, '_');
}

export function getPlannerItemInspector(item, fallbackDateKey = 'undated') {
  if (!item) return null;

  const raw = item.raw || item;
  const dateKey = toDateKey(
    item.dateKey ||
    raw.eventDateKey ||
    raw.planDate ||
    raw.date ||
    raw.eventDate ||
    raw.releaseDate ||
    fallbackDateKey
  );

  const title = asText(item.title || raw.title, 'Untitled planner item');
  const description = asText(
    item.description ||
    raw.description ||
    raw.summary ||
    raw.subtitle ||
    ''
  );

  const link = asText(item.link || item.url || raw.link || raw.url || '');
  const source = asText(raw.source || raw.platform || raw.publisher || raw.category || '');
  const category = normalizeCategory(item);

  const facts = [
    { key: 'date', label: 'Date', value: formatDisplayDate(dateKey) },
    { key: 'category', label: 'Category', value: category },
    { key: 'source', label: 'Source', value: source || 'Not specified' },
    { key: 'link', label: 'Link', value: link ? 'Available' : 'Not available' },
  ];

  const actionHints = [
    'Export this item to calendar',
    'Open source link when available',
    'Remove item with undo protection'
  ];

  return {
    id: asText(item.hiddenKey || item.canonicalId || item.id || raw.hiddenKey || raw.canonicalId || raw.id || title),
    title,
    description,
    category,
    dateKey,
    displayDate: formatDisplayDate(dateKey),
    link,
    source,
    hasLink: Boolean(link),
    raw,
    facts,
    actionHints,
  };
}

export default getPlannerItemInspector;
`);

write('src/services/plannerItemInspector.cert.test.js', `import { describe, expect, it } from 'vitest';
import { getPlannerItemInspector } from './plannerItemInspector';

describe('Planner item inspector certification', () => {
  it('normalizes item metadata for inspector display', () => {
    const detail = getPlannerItemInspector({
      id: 'movie-1',
      title: 'Movie release',
      description: 'A saved movie item',
      category: 'Movies',
      dateKey: '2026-01-03',
      link: 'https://example.com/movie',
      raw: {
        source: 'Cinema Desk',
      },
    });

    expect(detail.title).toBe('Movie release');
    expect(detail.category).toBe('movies');
    expect(detail.dateKey).toBe('2026-01-03');
    expect(detail.displayDate).toContain('2026');
    expect(detail.hasLink).toBe(true);
    expect(detail.source).toBe('Cinema Desk');
    expect(detail.facts.length).toBeGreaterThanOrEqual(4);
  });

  it('falls back safely for incomplete items', () => {
    const detail = getPlannerItemInspector({ title: 'Loose note' });

    expect(detail.title).toBe('Loose note');
    expect(detail.dateKey).toBe('undated');
    expect(detail.displayDate).toBe('Undated');
    expect(detail.hasLink).toBe(false);
    expect(detail.actionHints).toContain('Remove item with undo protection');
  });

  it('returns null safely for missing item', () => {
    expect(getPlannerItemInspector(null)).toBe(null);
  });
});
`);

patchFile('src/pages/MyPlannerPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    "import { getPlannerBulkActionSummary, makePlannerSelectionKey } from '../services/plannerBulkActions';",
    "\nimport { getPlannerItemInspector } from '../services/plannerItemInspector';",
    'planner item inspector import'
  );

  const inspectorComponent = `
function PlannerItemInspectorPanel({ detail, onClose, onExportCalendar, onRemove }) {
    if (!detail) return null;

    return (
        <aside className="planner-inspector" data-planner-item-inspector="metadata-actions" role="dialog" aria-label="Planner item inspector">
            <div className="planner-inspector__backdrop" onClick={onClose} />
            <section className="planner-inspector__sheet">
                <div className="planner-inspector__header">
                    <div>
                        <div className="planner-inspector__eyebrow">Saved item inspector</div>
                        <h2>{detail.title}</h2>
                        <p>{detail.description || 'No description available.'}</p>
                    </div>
                    <button type="button" className="planner-inspector__close" onClick={onClose} aria-label="Close inspector">
                        ✕
                    </button>
                </div>

                <div className="planner-inspector__facts">
                    {detail.facts.map(fact => (
                        <div key={fact.key} className="planner-inspector__fact">
                            <span>{fact.label}</span>
                            <strong>{fact.value}</strong>
                        </div>
                    ))}
                </div>

                {detail.hasLink && (
                    <a className="planner-inspector__link" href={detail.link} target="_blank" rel="noopener noreferrer">
                        Open source link
                    </a>
                )}

                <div className="planner-inspector__actions">
                    <button type="button" onClick={() => onExportCalendar(detail)}>
                        Export calendar
                    </button>
                    <button type="button" className="planner-inspector__danger" onClick={() => onRemove(detail)}>
                        Remove item
                    </button>
                </div>

                <details className="planner-inspector__details">
                    <summary>Action notes</summary>
                    <ul>
                        {detail.actionHints.map((hint, index) => (
                            <li key={\`planner-inspector-hint-\${index}\`}>{hint}</li>
                        ))}
                    </ul>
                </details>
            </section>
        </aside>
    );
}

`;

  if (!text.includes('function PlannerItemInspectorPanel({')) {
    text = text.replace('function PlannerEvidencePanel({ evidence }) {', `${inspectorComponent}function PlannerEvidencePanel({ evidence }) {`);
  }

  text = text.replace(
    'function SwipeableItem({ item, dateKey, onRemove, onLongPressAction, selected = false, onSelectionToggle }) {',
    'function SwipeableItem({ item, dateKey, onRemove, onLongPressAction, selected = false, onSelectionToggle, onInspect }) {'
  );

  text = insertAfterOnce(
    text,
    `<input
                    className="planner-item-select"
                    type="checkbox"
                    checked={selected}
                    onChange={() => onSelectionToggle?.(item)}
                    onClick={event => event.stopPropagation()}
                    aria-label={\`Select \${item.title}\`}
                />`,
    `
                <button
                    type="button"
                    className="planner-item-inspect-btn"
                    onClick={() => onInspect?.(item, dateKey)}
                    aria-label={\`Inspect \${item.title}\`}
                    title="Inspect item"
                >
                    ⓘ
                </button>`,
    'planner item inspect button'
  );

  text = insertAfterOnce(
    text,
    `    const [selectedPlannerIds, setSelectedPlannerIds] = useState([]);
`,
    `    const [inspectedPlannerItem, setInspectedPlannerItem] = useState(null);
`,
    'inspected planner item state'
  );

  text = insertAfterOnce(
    text,
    `    const plannerBulkSummary = useMemo(() => (
        getPlannerBulkActionSummary(plannerViewModel.filteredItems, selectedPlannerIds)
    ), [plannerViewModel.filteredItems, selectedPlannerIds]);
`,
    `
    const inspectedPlannerDetail = useMemo(() => (
        inspectedPlannerItem
            ? getPlannerItemInspector(inspectedPlannerItem.item, inspectedPlannerItem.dateKey)
            : null
    ), [inspectedPlannerItem]);
`,
    'inspected planner detail'
  );

  const handlers = `
    const inspectPlannerItem = (item, dateKey) => {
        setInspectedPlannerItem({ item, dateKey });
    };

    const closePlannerInspector = () => {
        setInspectedPlannerItem(null);
    };

    const exportInspectedPlannerItem = (detail) => {
        downloadCalendarEvent(detail.raw || detail);
    };

    const removeInspectedPlannerItem = (detail) => {
        removeWithUndo(detail.raw || detail, detail.dateKey);
        closePlannerInspector();
    };

`;

  if (!text.includes('const inspectPlannerItem = (item, dateKey) =>')) {
    text = text.replace('    const togglePlannerSelection = (item) => {', `${handlers}    const togglePlannerSelection = (item) => {`);
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
                <PlannerItemInspectorPanel
                    detail={inspectedPlannerDetail}
                    onClose={closePlannerInspector}
                    onExportCalendar={exportInspectedPlannerItem}
                    onRemove={removeInspectedPlannerItem}
                />
`,
    'planner inspector render'
  );

  text = insertAfterOnce(
    text,
    `                                                selected={selectedPlannerIds.includes(makePlannerSelectionKey(item))}
                                                onSelectionToggle={togglePlannerSelection}`,
    `
                                                onInspect={inspectPlannerItem}`,
    'swipeable inspect prop'
  );

  return text;
});

patchFile('src/pages/MyPlanner.css', source => {
  if (source.includes('.planner-inspector {')) return source;

  return `${source}

/* ==========================================================================
   My Planner item inspector
   Slice 29
   ========================================================================== */

.planner-item-inspect-btn {
    width: 28px;
    height: 28px;
    margin-right: 8px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    background: rgba(255, 255, 255, 0.055);
    color: var(--text-secondary, #9CA5B0);
    cursor: pointer;
    font-weight: 900;
}

.planner-item-inspect-btn:hover {
    border-color: rgba(88, 166, 255, 0.44);
    color: #bfdbfe;
    background: rgba(88, 166, 255, 0.10);
}

.planner-inspector {
    position: fixed;
    inset: 0;
    z-index: 1300;
    pointer-events: auto;
}

.planner-inspector__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(2, 6, 23, 0.66);
    backdrop-filter: blur(8px);
}

.planner-inspector__sheet {
    position: absolute;
    top: 18px;
    right: 18px;
    bottom: 18px;
    width: min(430px, calc(100% - 36px));
    padding: 18px;
    overflow: auto;
    border-radius: 22px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    background:
        radial-gradient(420px 180px at 100% 0%, rgba(88, 166, 255, 0.12), transparent 62%),
        rgba(15, 23, 42, 0.96);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.42);
}

.planner-inspector__header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 36px;
    gap: 12px;
    align-items: start;
}

.planner-inspector__eyebrow {
    color: #93c5fd;
    font-size: 0.66rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.planner-inspector h2 {
    margin: 5px 0;
    color: var(--text-primary, #FFFFFF);
    font-size: 1.08rem;
    line-height: 1.25;
}

.planner-inspector p {
    margin: 0;
    color: var(--text-secondary, #9CA5B0);
    font-size: 0.84rem;
    line-height: 1.45;
}

.planner-inspector__close {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-primary, #FFFFFF);
    cursor: pointer;
}

.planner-inspector__facts {
    display: grid;
    gap: 8px;
    margin-top: 16px;
}

.planner-inspector__fact {
    padding: 10px;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(255, 255, 255, 0.045);
}

.planner-inspector__fact span {
    display: block;
    color: var(--text-secondary, #9CA5B0);
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.planner-inspector__fact strong {
    display: block;
    margin-top: 4px;
    color: var(--text-primary, #FFFFFF);
    font-size: 0.86rem;
    line-height: 1.35;
}

.planner-inspector__link {
    display: inline-flex;
    margin-top: 14px;
    color: #bfdbfe;
    text-decoration: none;
    font-weight: 850;
    font-size: 0.84rem;
}

.planner-inspector__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
    margin-top: 16px;
}

.planner-inspector__actions button {
    min-height: 38px;
    border-radius: 12px;
    border: 1px solid rgba(88, 166, 255, 0.24);
    background: rgba(88, 166, 255, 0.10);
    color: #bfdbfe;
    font-weight: 850;
    cursor: pointer;
}

.planner-inspector__actions .planner-inspector__danger {
    border-color: rgba(239, 68, 68, 0.28);
    background: rgba(239, 68, 68, 0.10);
    color: #fecaca;
}

.planner-inspector__details {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.planner-inspector__details summary {
    cursor: pointer;
    color: #93c5fd;
    font-size: 0.78rem;
    font-weight: 850;
}

.planner-inspector__details ul {
    margin: 10px 0 0;
    padding-left: 18px;
    color: #cbd5e1;
    font-size: 0.8rem;
    line-height: 1.45;
}

@media (max-width: 640px) {
    .planner-inspector__sheet {
        top: auto;
        right: 8px;
        bottom: 8px;
        left: 8px;
        width: auto;
        max-height: 86vh;
    }

    .planner-inspector__actions {
        grid-template-columns: 1fr;
    }
}
`;
});

write('scripts/test_planner_item_inspector_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerItemInspector.js');
const moduleTest = read('src/services/plannerItemInspector.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerItemInspector',
  'formatDisplayDate',
  'normalizeCategory',
  'facts',
  'actionHints',
  'hasLink'
]) {
  assert(module.includes(token), \`plannerItemInspector.js missing token: \${token}\`);
}

for (const token of [
  'Planner item inspector certification',
  'normalizes item metadata for inspector display',
  'falls back safely for incomplete items',
  'returns null safely for missing item'
]) {
  assert(moduleTest.includes(token), \`plannerItemInspector.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'getPlannerItemInspector',
  'PlannerItemInspectorPanel',
  'data-planner-item-inspector',
  'metadata-actions',
  'inspectedPlannerItem',
  'inspectedPlannerDetail',
  'inspectPlannerItem',
  'closePlannerInspector',
  'exportInspectedPlannerItem',
  'removeInspectedPlannerItem',
  'planner-item-inspect-btn'
]) {
  assert(page.includes(token), \`MyPlannerPage.jsx missing inspector token: \${token}\`);
}

for (const token of [
  '.planner-inspector',
  '.planner-inspector__sheet',
  '.planner-inspector__facts',
  '.planner-inspector__actions',
  '.planner-item-inspect-btn'
]) {
  assert(css.includes(token), \`MyPlanner.css missing inspector CSS token: \${token}\`);
}

assert(
  packageJson.includes('"test:planner-item-inspector"'),
  'package.json must include test:planner-item-inspector'
);

assert(
  certGate.includes("['npm', ['run', 'test:planner-item-inspector']]"),
  'certification gate must run test:planner-item-inspector'
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
  checked: 'My Planner item inspector slice',
  guarantees: [
    'planner item inspector service exists',
    'planner item inspector panel is rendered',
    'item metadata and action hints are visible',
    'calendar export from inspector is available',
    'remove with undo from inspector is available',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner item inspector static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:planner-item-inspector'] = 'node scripts/test_planner_item_inspector_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:planner-item-inspector']]")) return source;

  return source.replace(
    "  ['npm', ['run', 'test:calendar-export-quality']]",
    "  ['npm', ['run', 'test:calendar-export-quality']],\n  ['npm', ['run', 'test:planner-item-inspector']]"
  );
});

console.log('\nSlice 29 planner item inspector patch complete.');
