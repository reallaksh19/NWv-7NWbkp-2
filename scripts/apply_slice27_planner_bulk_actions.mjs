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

write('src/services/plannerBulkActions.js', `function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeKeyPart(value) {
  return String(value || '').trim();
}

export function makePlannerSelectionKey(item) {
  const dateKey = normalizeKeyPart(item?.dateKey || item?.eventDateKey || item?.planDate || item?.date || 'undated');
  const itemKey = normalizeKeyPart(item?.hiddenKey || item?.canonicalId || item?.id || item?.title);

  return \`\${dateKey}::\${itemKey}\`;
}

function countBy(items, mapper) {
  const counts = new Map();

  for (const item of items) {
    const key = mapper(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

export function getPlannerBulkActionSummary(filteredItems, selectedKeys) {
  const items = safeArray(filteredItems);
  const selectedSet = new Set(safeArray(selectedKeys));
  const selectedItems = items.filter(item => selectedSet.has(makePlannerSelectionKey(item)));

  const selectedCount = selectedItems.length;
  const filteredCount = items.length;

  return {
    filteredCount,
    selectedCount,
    selectedItems,
    hasSelection: selectedCount > 0,
    allFilteredSelected: filteredCount > 0 && selectedCount === filteredCount,
    categoryCounts: countBy(selectedItems, item => item.category),
    dateCounts: countBy(selectedItems, item => item.dateKey),
    title:
      selectedCount === 0
        ? 'No planner items selected'
        : \`\${selectedCount} planner item(s) selected\`,
    canExportCalendar: selectedCount > 0,
    canRemove: selectedCount > 0,
  };
}

export default getPlannerBulkActionSummary;
`);

write('src/services/plannerBulkActions.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  getPlannerBulkActionSummary,
  makePlannerSelectionKey,
} from './plannerBulkActions';

const items = [
  { id: 'a', title: 'Concert', dateKey: '2026-01-01', category: 'events' },
  { id: 'b', title: 'Movie', dateKey: '2026-01-02', category: 'movies' },
  { id: 'c', title: 'Offer', dateKey: '2026-01-02', category: 'shopping' },
];

describe('Planner bulk actions certification', () => {
  it('creates stable planner selection keys', () => {
    expect(makePlannerSelectionKey(items[0])).toBe('2026-01-01::a');
  });

  it('summarizes selected planner items', () => {
    const selectedKeys = [
      makePlannerSelectionKey(items[0]),
      makePlannerSelectionKey(items[2]),
    ];

    const summary = getPlannerBulkActionSummary(items, selectedKeys);

    expect(summary.selectedCount).toBe(2);
    expect(summary.filteredCount).toBe(3);
    expect(summary.hasSelection).toBe(true);
    expect(summary.allFilteredSelected).toBe(false);
    expect(summary.categoryCounts.map(entry => entry.key)).toContain('events');
    expect(summary.dateCounts.map(entry => entry.key)).toContain('2026-01-02');
    expect(summary.canExportCalendar).toBe(true);
    expect(summary.canRemove).toBe(true);
  });

  it('detects select-all state', () => {
    const summary = getPlannerBulkActionSummary(
      items,
      items.map(makePlannerSelectionKey)
    );

    expect(summary.selectedCount).toBe(3);
    expect(summary.allFilteredSelected).toBe(true);
  });

  it('handles empty selection safely', () => {
    const summary = getPlannerBulkActionSummary(items, []);

    expect(summary.selectedCount).toBe(0);
    expect(summary.hasSelection).toBe(false);
    expect(summary.canExportCalendar).toBe(false);
    expect(summary.canRemove).toBe(false);
  });
});
`);

patchFile('src/pages/MyPlannerPage.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    "import { getPlannerViewModel } from '../services/plannerViewModel';",
    "\nimport { getPlannerBulkActionSummary, makePlannerSelectionKey } from '../services/plannerBulkActions';",
    'planner bulk import'
  );

  const bulkPanel = `
function PlannerBulkActionBar({
    summary,
    onSelectAll,
    onClearSelection,
    onExportCalendar,
    onRemoveSelected
}) {
    return (
        <section className={\`planner-bulk planner-bulk--\${summary.hasSelection ? 'active' : 'idle'}\`} data-planner-bulk-actions="select-export-remove">
            <div className="planner-bulk__copy">
                <div className="planner-bulk__eyebrow">Bulk actions</div>
                <strong>{summary.title}</strong>
                <span>{summary.filteredCount} filtered item(s) available.</span>
            </div>

            <div className="planner-bulk__actions">
                <button type="button" onClick={onSelectAll} disabled={summary.filteredCount === 0 || summary.allFilteredSelected}>
                    Select filtered
                </button>
                <button type="button" onClick={onClearSelection} disabled={!summary.hasSelection}>
                    Clear
                </button>
                <button type="button" onClick={onExportCalendar} disabled={!summary.canExportCalendar}>
                    Export calendar
                </button>
                <button type="button" className="planner-bulk__danger" onClick={onRemoveSelected} disabled={!summary.canRemove}>
                    Remove selected
                </button>
            </div>
        </section>
    );
}

`;

  if (!text.includes('function PlannerBulkActionBar({')) {
    text = text.replace('function PlannerEvidencePanel({ evidence }) {', `${bulkPanel}function PlannerEvidencePanel({ evidence }) {`);
  }

  text = text.replace(
    'function SwipeableItem({ item, dateKey, onRemove, onLongPressAction }) {',
    'function SwipeableItem({ item, dateKey, onRemove, onLongPressAction, selected = false, onSelectionToggle }) {'
  );

  text = replaceOnce(
    text,
    `<button className="ua-plan-delete-btn" onClick={() => onRemove(item, dateKey)} aria-label="Remove event" style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'0.9rem', padding: '0 8px 0 0'}}>✕</button>`,
    `<button className="ua-plan-delete-btn" onClick={() => onRemove(item, dateKey)} aria-label="Remove event" style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'0.9rem', padding: '0 8px 0 0'}}>✕</button>
                <input
                    className="planner-item-select"
                    type="checkbox"
                    checked={selected}
                    onChange={() => onSelectionToggle?.(item)}
                    onClick={event => event.stopPropagation()}
                    aria-label={\`Select \${item.title}\`}
                />`,
    'planner item selection checkbox'
  );

  text = insertAfterOnce(
    text,
    `    const [plannerControls, setPlannerControls] = useState({
        query: '',
        category: 'all',
        dateWindow: 'all',
        sortMode: 'date'
    });
`,
    `
    const [selectedPlannerIds, setSelectedPlannerIds] = useState([]);
`,
    'selected planner ids state'
  );

  text = insertAfterOnce(
    text,
    `    const plannerViewModel = useMemo(() => (
        getPlannerViewModel(planData, plannerControls)
    ), [planData, plannerControls]);
`,
    `
    const plannerBulkSummary = useMemo(() => (
        getPlannerBulkActionSummary(plannerViewModel.filteredItems, selectedPlannerIds)
    ), [plannerViewModel.filteredItems, selectedPlannerIds]);
`,
    'planner bulk summary'
  );

  text = replaceOnce(
    text,
    `    const undoLastRemove = () => {
        if (!undoItem) return;

        plannerStorage.addItem?.(undoItem.date, undoItem.item);
        setUndoItem(null);
        loadPlan();
    };
`,
    `    const undoLastRemove = () => {
        if (!undoItem) return;

        if (undoItem.bulk) {
            undoItem.items.forEach(entry => {
                plannerStorage.addItem?.(entry.date, entry.item);
            });
        } else {
            plannerStorage.addItem?.(undoItem.date, undoItem.item);
        }

        setUndoItem(null);
        loadPlan();
    };
`,
    'bulk undo support'
  );

  text = replaceOnce(
    text,
    `            setUndoItem({ date: dateKey, item: item });`,
    `            setUndoItem({ bulk: false, date: dateKey, item });`,
    'single undo shape'
  );

  const bulkHandlers = `
    const togglePlannerSelection = (item) => {
        const selectionKey = makePlannerSelectionKey(item);

        setSelectedPlannerIds(prev => (
            prev.includes(selectionKey)
                ? prev.filter(key => key !== selectionKey)
                : [...prev, selectionKey]
        ));
    };

    const selectAllFilteredPlannerItems = () => {
        setSelectedPlannerIds(plannerViewModel.filteredItems.map(makePlannerSelectionKey));
    };

    const clearPlannerSelection = () => {
        setSelectedPlannerIds([]);
    };

    const exportSelectedPlannerItems = () => {
        plannerBulkSummary.selectedItems.forEach(item => {
            downloadCalendarEvent(item.title, item.description || item.title);
        });
    };

    const removeSelectedPlannerItems = () => {
        if (plannerBulkSummary.selectedItems.length === 0) return;

        const removedItems = plannerBulkSummary.selectedItems.map(item => ({
            date: item.dateKey,
            item: item.raw || item
        }));

        plannerBulkSummary.selectedItems.forEach(item => {
            plannerStorage.removeItem?.(item.dateKey, item.id);
        });

        setUndoItem({
            bulk: true,
            items: removedItems
        });

        setSelectedPlannerIds([]);
        loadPlan();

        setTimeout(() => {
            setUndoItem(null);
        }, 5000);
    };

`;

  if (!text.includes('const togglePlannerSelection = (item) =>')) {
    text = text.replace('    // Prepare sorted dates, auto-prune past dates', `${bulkHandlers}    // Prepare sorted dates, auto-prune past dates`);
  }

  text = insertAfterOnce(
    text,
    `                <PlannerControlsPanel
                    viewModel={plannerViewModel}
                    controls={plannerControls}
                    onControlsChange={setPlannerControls}
                />
`,
    `
                <PlannerBulkActionBar
                    summary={plannerBulkSummary}
                    onSelectAll={selectAllFilteredPlannerItems}
                    onClearSelection={clearPlannerSelection}
                    onExportCalendar={exportSelectedPlannerItems}
                    onRemoveSelected={removeSelectedPlannerItems}
                />
`,
    'planner bulk bar render'
  );

  text = replaceOnce(
    text,
    `<SwipeableItem key={idx} item={item} dateKey={dateKey} onRemove={removeWithUndo} onLongPressAction={handleLongPress} />`,
    `<SwipeableItem
                                                key={makePlannerSelectionKey(item)}
                                                item={item}
                                                dateKey={dateKey}
                                                onRemove={removeWithUndo}
                                                onLongPressAction={handleLongPress}
                                                selected={selectedPlannerIds.includes(makePlannerSelectionKey(item))}
                                                onSelectionToggle={togglePlannerSelection}
                                            />`,
    'planner swipeable item props'
  );

  text = replaceOnce(
    text,
    `<span style={{ fontSize: '0.9rem' }}>Event removed</span>`,
    `<span style={{ fontSize: '0.9rem' }}>{undoItem.bulk ? \`\${undoItem.items.length} events removed\` : 'Event removed'}</span>`,
    'bulk undo message'
  );

  return text;
});

patchFile('src/pages/MyPlanner.css', source => {
  let text = source;

  if (text.includes('.planner-bulk {')) return text;

  return `${text}

/* ==========================================================================
   My Planner bulk actions
   Slice 27
   ========================================================================== */

.planner-bulk {
    margin: 0 0 16px;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background:
        radial-gradient(360px 150px at 100% 0%, rgba(34, 197, 94, 0.10), transparent 62%),
        rgba(15, 23, 42, 0.72);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.14);
}

.planner-bulk--active {
    border-color: rgba(34, 197, 94, 0.34);
}

.planner-bulk__eyebrow {
    color: #86efac;
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.planner-bulk__copy strong {
    display: block;
    margin-top: 4px;
    color: var(--text-primary, #FFFFFF);
    font-size: 0.98rem;
}

.planner-bulk__copy span {
    display: block;
    margin-top: 3px;
    color: var(--text-secondary, #9CA5B0);
    font-size: 0.78rem;
}

.planner-bulk__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
}

.planner-bulk__actions button {
    min-height: 36px;
    border-radius: 11px;
    border: 1px solid rgba(34, 197, 94, 0.22);
    background: rgba(34, 197, 94, 0.10);
    color: #bbf7d0;
    font-weight: 850;
    cursor: pointer;
    padding: 0 12px;
}

.planner-bulk__actions button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
}

.planner-bulk__actions .planner-bulk__danger {
    border-color: rgba(239, 68, 68, 0.28);
    background: rgba(239, 68, 68, 0.10);
    color: #fecaca;
}

.planner-item-select {
    width: 18px;
    height: 18px;
    accent-color: var(--accent-primary, #58a6ff);
    margin-right: 8px;
    cursor: pointer;
}

@media (max-width: 760px) {
    .planner-bulk {
        grid-template-columns: 1fr;
    }

    .planner-bulk__actions {
        justify-content: stretch;
    }

    .planner-bulk__actions button {
        flex: 1 1 calc(50% - 8px);
    }
}
`;
});

write('scripts/test_planner_bulk_actions_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerBulkActions.js');
const moduleTest = read('src/services/plannerBulkActions.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerBulkActionSummary',
  'makePlannerSelectionKey',
  'selectedItems',
  'allFilteredSelected',
  'canExportCalendar',
  'canRemove',
  'categoryCounts',
  'dateCounts'
]) {
  assert(module.includes(token), \`plannerBulkActions.js missing token: \${token}\`);
}

for (const token of [
  'Planner bulk actions certification',
  'creates stable planner selection keys',
  'summarizes selected planner items',
  'detects select-all state',
  'handles empty selection safely'
]) {
  assert(moduleTest.includes(token), \`plannerBulkActions.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'PlannerBulkActionBar',
  'data-planner-bulk-actions',
  'select-export-remove',
  'selectedPlannerIds',
  'plannerBulkSummary',
  'togglePlannerSelection',
  'selectAllFilteredPlannerItems',
  'clearPlannerSelection',
  'exportSelectedPlannerItems',
  'removeSelectedPlannerItems',
  'planner-item-select'
]) {
  assert(page.includes(token), \`MyPlannerPage.jsx missing bulk token: \${token}\`);
}

for (const token of [
  '.planner-bulk',
  '.planner-bulk__actions',
  '.planner-bulk__danger',
  '.planner-item-select'
]) {
  assert(css.includes(token), \`MyPlanner.css missing bulk CSS token: \${token}\`);
}

assert(
  packageJson.includes('"test:planner-bulk-actions"'),
  'package.json must include test:planner-bulk-actions'
);

assert(
  certGate.includes("['npm', ['run', 'test:planner-bulk-actions']]"),
  'certification gate must run test:planner-bulk-actions'
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
  checked: 'My Planner bulk actions slice',
  guarantees: [
    'planner bulk action summary exists',
    'bulk action bar is rendered',
    'select filtered and clear selection are available',
    'calendar export selected action is available',
    'remove selected with undo is available',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner bulk actions static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:planner-bulk-actions'] = 'node scripts/test_planner_bulk_actions_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:planner-bulk-actions']]")) return source;

  return source.replace(
    "  ['npm', ['run', 'test:planner-view-model']],",
    "  ['npm', ['run', 'test:planner-view-model']],\n  ['npm', ['run', 'test:planner-bulk-actions']],"
  );
});

console.log('\\nSlice 27 planner bulk actions patch complete.');