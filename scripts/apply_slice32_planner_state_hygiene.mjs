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

write('src/services/plannerStateHygiene.js', `import { makePlannerSelectionKey } from './plannerBulkActions';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeKey(value) {
  return String(value || '').trim();
}

export function reconcilePlannerSelection(filteredItems, selectedKeys) {
  const validKeys = new Set(safeArray(filteredItems).map(makePlannerSelectionKey));
  const before = safeArray(selectedKeys);
  const after = before.filter(key => validKeys.has(key));

  return {
    selectedKeys: after,
    removedCount: before.length - after.length,
    changed: before.length !== after.length,
    validCount: validKeys.size,
  };
}

export function makeInspectorKey(item, fallbackDateKey = 'undated') {
  if (!item) return '';

  const dateKey = normalizeKey(
    item.dateKey ||
    item.eventDateKey ||
    item.planDate ||
    item.date ||
    item.releaseDate ||
    fallbackDateKey ||
    'undated'
  );

  const itemKey = normalizeKey(
    item.hiddenKey ||
    item.canonicalId ||
    item.id ||
    item.title
  );

  return \`\${dateKey}::\${itemKey}\`;
}

export function isPlannerInspectorStillValid(inspectedPlannerItem, filteredItems) {
  if (!inspectedPlannerItem?.item) return false;

  const inspectedKey = makeInspectorKey(
    inspectedPlannerItem.item,
    inspectedPlannerItem.dateKey
  );

  return safeArray(filteredItems).some(item => makeInspectorKey(item, item.dateKey) === inspectedKey);
}

export function getPlannerStateHygiene({
  filteredItems = [],
  selectedKeys = [],
  inspectedPlannerItem = null,
} = {}) {
  const selection = reconcilePlannerSelection(filteredItems, selectedKeys);
  const inspectorValid = inspectedPlannerItem
    ? isPlannerInspectorStillValid(inspectedPlannerItem, filteredItems)
    : true;

  const status = selection.removedCount > 0 || !inspectorValid ? 'needs-cleanup' : 'clean';

  const notes = [];

  if (selection.removedCount > 0) {
    notes.push(\`\${selection.removedCount} stale selected item(s) should be cleared.\`);
  }

  if (!inspectorValid) {
    notes.push('Inspector item is no longer visible in the filtered planner view.');
  }

  if (notes.length === 0) {
    notes.push('Planner selection and inspector state are in sync with the filtered view.');
  }

  return {
    status,
    selection,
    inspectorValid,
    filteredCount: safeArray(filteredItems).length,
    selectedCount: safeArray(selectedKeys).length,
    cleanSelectedCount: selection.selectedKeys.length,
    notes,
  };
}

export default getPlannerStateHygiene;
`);

write('src/services/plannerStateHygiene.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  getPlannerStateHygiene,
  isPlannerInspectorStillValid,
  makeInspectorKey,
  reconcilePlannerSelection,
} from './plannerStateHygiene';
import { makePlannerSelectionKey } from './plannerBulkActions';

const filteredItems = [
  { id: 'a', title: 'Concert', dateKey: '2026-01-01', category: 'events' },
  { id: 'b', title: 'Movie', dateKey: '2026-01-02', category: 'movies' },
];

describe('Planner state hygiene certification', () => {
  it('removes stale selected IDs from the filtered view', () => {
    const validKey = makePlannerSelectionKey(filteredItems[0]);
    const result = reconcilePlannerSelection(filteredItems, [
      validKey,
      '2026-01-09::missing',
    ]);

    expect(result.changed).toBe(true);
    expect(result.removedCount).toBe(1);
    expect(result.selectedKeys).toEqual([validKey]);
  });

  it('detects valid and stale inspector items', () => {
    expect(makeInspectorKey(filteredItems[0])).toBe('2026-01-01::a');

    expect(isPlannerInspectorStillValid({
      item: filteredItems[0],
      dateKey: '2026-01-01',
    }, filteredItems)).toBe(true);

    expect(isPlannerInspectorStillValid({
      item: { id: 'missing', title: 'Missing', dateKey: '2026-01-09' },
      dateKey: '2026-01-09',
    }, filteredItems)).toBe(false);
  });

  it('reports clean hygiene state', () => {
    const validKey = makePlannerSelectionKey(filteredItems[0]);

    const hygiene = getPlannerStateHygiene({
      filteredItems,
      selectedKeys: [validKey],
      inspectedPlannerItem: {
        item: filteredItems[0],
        dateKey: '2026-01-01',
      },
    });

    expect(hygiene.status).toBe('clean');
    expect(hygiene.selection.removedCount).toBe(0);
    expect(hygiene.inspectorValid).toBe(true);
  });

  it('reports cleanup state for stale selection and inspector', () => {
    const hygiene = getPlannerStateHygiene({
      filteredItems,
      selectedKeys: ['2026-01-09::missing'],
      inspectedPlannerItem: {
        item: { id: 'missing', title: 'Missing', dateKey: '2026-01-09' },
        dateKey: '2026-01-09',
      },
    });

    expect(hygiene.status).toBe('needs-cleanup');
    expect(hygiene.selection.removedCount).toBe(1);
    expect(hygiene.inspectorValid).toBe(false);
  });
});
`);

patchFile('src/pages/MyPlannerPage.jsx', source => {
  let text = source;

  text = replaceOnce(
    text,
    "import React, { useState, useEffect, useMemo } from 'react';",
    "import React, { useState, useEffect, useMemo, useRef } from 'react';",
    'add useRef import'
  );

  text = insertAfterOnce(
    text,
    "import { getPlannerInteractionQuality } from '../services/plannerInteractionQuality';",
    "\nimport { getPlannerStateHygiene, reconcilePlannerSelection } from '../services/plannerStateHygiene';",
    'planner state hygiene import'
  );

  const hygienePanel = `
function PlannerStateHygienePanel({ hygiene }) {
    return (
        <section className={\`planner-state-hygiene planner-state-hygiene--\${hygiene.status}\`} data-planner-state-hygiene="selection-inspector-sync">
            <div className="planner-state-hygiene__header">
                <div>
                    <div className="planner-state-hygiene__eyebrow">State hygiene</div>
                    <h2>{hygiene.status === 'clean' ? 'Planner state is clean' : 'Planner state is being cleaned'}</h2>
                    <p>
                        {hygiene.cleanSelectedCount} active selection(s) · {hygiene.filteredCount} filtered item(s) · inspector {hygiene.inspectorValid ? 'valid' : 'stale'}.
                    </p>
                </div>
            </div>

            <ul className="planner-state-hygiene__notes">
                {hygiene.notes.map((note, index) => (
                    <li key={\`planner-state-hygiene-note-\${index}\`}>{note}</li>
                ))}
            </ul>
        </section>
    );
}

`;

  if (!text.includes('function PlannerStateHygienePanel({')) {
    text = text.replace('function PlannerInteractionQualityPanel({ quality }) {', `${hygienePanel}function PlannerInteractionQualityPanel({ quality }) {`);
  }

  text = replaceOnce(
    text,
    `function PlannerItemInspectorPanel({ detail, onClose, onExportCalendar, onRemove }) {
    if (!detail) return null;

    return (
        <aside
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
    `function PlannerItemInspectorPanel({ detail, onClose, onExportCalendar, onRemove, inspectorRef }) {
    if (!detail) return null;

    return (
        <aside
            ref={inspectorRef}
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
    'inspector ref prop'
  );

  text = insertAfterOnce(
    text,
    `    const [plannerAgendaCopyStatus, setPlannerAgendaCopyStatus] = useState('');
`,
    `    const plannerInspectorRef = useRef(null);
`,
    'planner inspector ref state'
  );

  text = insertAfterOnce(
    text,
    `    const plannerInteractionQuality = useMemo(() => (
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
    `
    const plannerStateHygiene = useMemo(() => (
        getPlannerStateHygiene({
            filteredItems: plannerViewModel.filteredItems,
            selectedKeys: selectedPlannerIds,
            inspectedPlannerItem
        })
    ), [plannerViewModel.filteredItems, selectedPlannerIds, inspectedPlannerItem]);
`,
    'planner state hygiene memo'
  );

  const hygieneEffects = `
    useEffect(() => {
        const reconciliation = reconcilePlannerSelection(plannerViewModel.filteredItems, selectedPlannerIds);

        if (reconciliation.changed) {
            setSelectedPlannerIds(reconciliation.selectedKeys);
        }
    }, [plannerViewModel.filteredItems, selectedPlannerIds]);

    useEffect(() => {
        if (!inspectedPlannerItem) return;

        if (!plannerStateHygiene.inspectorValid) {
            setInspectedPlannerItem(null);
        }
    }, [inspectedPlannerItem, plannerStateHygiene.inspectorValid]);

    useEffect(() => {
        if (inspectedPlannerDetail && plannerInspectorRef.current) {
            plannerInspectorRef.current.focus();
        }
    }, [inspectedPlannerDetail]);

`;

  if (!text.includes('reconcilePlannerSelection(plannerViewModel.filteredItems, selectedPlannerIds)')) {
    text = text.replace('    const removeWithUndo = (item, dateKey) => {', `${hygieneEffects}    const removeWithUndo = (item, dateKey) => {`);
  }

  text = insertAfterOnce(
    text,
    `                <PlannerInteractionQualityPanel quality={plannerInteractionQuality} />
`,
    `
                <PlannerStateHygienePanel hygiene={plannerStateHygiene} />
`,
    'planner state hygiene panel render'
  );

  text = replaceOnce(
    text,
    `                <PlannerItemInspectorPanel
                    detail={inspectedPlannerDetail}
                    onClose={closePlannerInspector}
                    onExportCalendar={exportInspectedPlannerItem}
                    onRemove={removeInspectedPlannerItem}
                />`,
    `                <PlannerItemInspectorPanel
                    detail={inspectedPlannerDetail}
                    onClose={closePlannerInspector}
                    onExportCalendar={exportInspectedPlannerItem}
                    onRemove={removeInspectedPlannerItem}
                    inspectorRef={plannerInspectorRef}
                />`,
    'pass inspector ref'
  );

  return text;
});

patchFile('src/pages/MyPlanner.css', source => {
  if (source.includes('.planner-state-hygiene {')) return source;

  return `${source}

/* ==========================================================================
   My Planner state hygiene
   Slice 32
   ========================================================================== */

.planner-state-hygiene {
    margin: 0 0 16px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background:
        radial-gradient(420px 180px at 100% 0%, rgba(132, 204, 22, 0.10), transparent 62%),
        rgba(15, 23, 42, 0.74);
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.16);
}

.planner-state-hygiene--clean {
    border-color: rgba(132, 204, 22, 0.34);
}

.planner-state-hygiene--needs-cleanup {
    border-color: rgba(245, 158, 11, 0.38);
}

.planner-state-hygiene__eyebrow {
    color: #bef264;
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.planner-state-hygiene h2 {
    margin: 4px 0;
    color: var(--text-primary, #FFFFFF);
    font-size: 1.08rem;
    line-height: 1.18;
}

.planner-state-hygiene p {
    margin: 0;
    color: var(--text-secondary, #9CA5B0);
    font-size: 0.84rem;
    line-height: 1.45;
}

.planner-state-hygiene__notes {
    margin: 12px 0 0;
    padding-left: 18px;
    color: #cbd5e1;
    font-size: 0.8rem;
    line-height: 1.45;
}

@media print {
    .planner-state-hygiene {
        display: none !important;
    }
}
`;
});

write('scripts/test_planner_state_hygiene_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const module = read('src/services/plannerStateHygiene.js');
const moduleTest = read('src/services/plannerStateHygiene.cert.test.js');
const page = read('src/pages/MyPlannerPage.jsx');
const css = read('src/pages/MyPlanner.css');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getPlannerStateHygiene',
  'reconcilePlannerSelection',
  'isPlannerInspectorStillValid',
  'makeInspectorKey',
  'needs-cleanup',
  'stale selected item'
]) {
  assert(module.includes(token), \`plannerStateHygiene.js missing token: \${token}\`);
}

for (const token of [
  'Planner state hygiene certification',
  'removes stale selected IDs',
  'detects valid and stale inspector items',
  'reports clean hygiene state',
  'reports cleanup state'
]) {
  assert(moduleTest.includes(token), \`plannerStateHygiene.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'useRef',
  'getPlannerStateHygiene',
  'reconcilePlannerSelection',
  'PlannerStateHygienePanel',
  'data-planner-state-hygiene',
  'selection-inspector-sync',
  'plannerInspectorRef',
  'plannerStateHygiene',
  'inspectorRef={plannerInspectorRef}',
  'plannerInspectorRef.current.focus()'
]) {
  assert(page.includes(token), \`MyPlannerPage.jsx missing state hygiene token: \${token}\`);
}

for (const token of [
  '.planner-state-hygiene',
  '.planner-state-hygiene--clean',
  '.planner-state-hygiene--needs-cleanup',
  '.planner-state-hygiene__notes'
]) {
  assert(css.includes(token), \`MyPlanner.css missing state hygiene CSS token: \${token}\`);
}

assert(
  packageJson.includes('"test:planner-state-hygiene"'),
  'package.json must include test:planner-state-hygiene'
);

assert(
  certGate.includes("['npm', ['run', 'test:planner-state-hygiene']]"),
  'certification gate must run test:planner-state-hygiene'
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
  checked: 'My Planner state hygiene slice',
  guarantees: [
    'planner state hygiene service exists',
    'stale selected IDs are reconciled',
    'stale inspector state is detected',
    'inspector receives focus when opened',
    'state hygiene panel is rendered',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: My Planner state hygiene static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:planner-state-hygiene'] = 'node scripts/test_planner_state_hygiene_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:planner-state-hygiene']]")) return source;

  return source.replace(
    "  ['npm', ['run', 'test:planner-interaction-quality']],",
    "  ['npm', ['run', 'test:planner-interaction-quality']],\n  ['npm', ['run', 'test:planner-state-hygiene']],"
  );
});

console.log('\nSlice 32 planner state hygiene patch complete.');
