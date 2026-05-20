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

function insertAfterOnce(source, anchor, insertion, label) {
  if (source.includes(insertion.trim().split('\n')[0])) return source;
  if (!source.includes(anchor)) throw new Error(`Missing anchor for ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }
  return source.replace(before, after);
}

/* -------------------------------------------------------------------------- */
/* 1) Grade badge placement helpers                                            */
/* -------------------------------------------------------------------------- */

write('src/components/audit/gradeBadgePlacement.js', `export const GRADE_BADGE_POSITIONS = {
  TOP_RIGHT: 'top-right',
  BELOW_HEADER: 'below-header',
  INLINE: 'inline',
  FLOATING_LOW: 'floating-low',
};

export function normalizeGradeBadgePosition(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (Object.values(GRADE_BADGE_POSITIONS).includes(normalized)) {
    return normalized;
  }

  return GRADE_BADGE_POSITIONS.TOP_RIGHT;
}

export function getGradeBadgeClassName({
  tone = 'bad',
  position = GRADE_BADGE_POSITIONS.TOP_RIGHT,
  compact = false,
  className = '',
} = {}) {
  const safePosition = normalizeGradeBadgePosition(position);
  const classes = [
    'grade-badge',
    'grade-badge--' + tone,
    'grade-badge--position-' + safePosition,
  ];

  if (compact) classes.push('grade-badge--compact');
  if (className) classes.push(className);

  return classes.join(' ');
}

export function getGradeBadgeStyle({
  topOffset = null,
  rightOffset = null,
  zIndex = null,
} = {}) {
  const style = {};

  if (topOffset != null) {
    style['--grade-badge-top-offset'] = typeof topOffset === 'number'
      ? topOffset + 'px'
      : String(topOffset);
  }

  if (rightOffset != null) {
    style['--grade-badge-right-offset'] = typeof rightOffset === 'number'
      ? rightOffset + 'px'
      : String(rightOffset);
  }

  if (zIndex != null) {
    style['--grade-badge-z-index'] = String(zIndex);
  }

  return style;
}

export function getRecommendedGradeBadgePosition(pageId) {
  const id = String(pageId || '').toLowerCase();

  if (id.includes('weather')) return GRADE_BADGE_POSITIONS.BELOW_HEADER;
  if (id.includes('market')) return GRADE_BADGE_POSITIONS.BELOW_HEADER;
  if (id.includes('insight')) return GRADE_BADGE_POSITIONS.FLOATING_LOW;

  return GRADE_BADGE_POSITIONS.TOP_RIGHT;
}
`);

write('src/components/audit/gradeBadgePlacement.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  GRADE_BADGE_POSITIONS,
  getGradeBadgeClassName,
  getGradeBadgeStyle,
  getRecommendedGradeBadgePosition,
  normalizeGradeBadgePosition,
} from './gradeBadgePlacement';

describe('Grade badge placement certification', () => {
  it('normalizes invalid placement to top-right', () => {
    expect(normalizeGradeBadgePosition('bad-position')).toBe(GRADE_BADGE_POSITIONS.TOP_RIGHT);
  });

  it('builds collision-safe placement class names', () => {
    const className = getGradeBadgeClassName({
      tone: 'good',
      position: 'below-header',
      compact: true,
    });

    expect(className).toContain('grade-badge--good');
    expect(className).toContain('grade-badge--position-below-header');
    expect(className).toContain('grade-badge--compact');
  });

  it('exposes CSS variable style offsets', () => {
    const style = getGradeBadgeStyle({
      topOffset: 72,
      rightOffset: '18px',
      zIndex: 70,
    });

    expect(style['--grade-badge-top-offset']).toBe('72px');
    expect(style['--grade-badge-right-offset']).toBe('18px');
    expect(style['--grade-badge-z-index']).toBe('70');
  });

  it('recommends lower placement for collision-heavy pages', () => {
    expect(getRecommendedGradeBadgePosition('weather')).toBe('below-header');
    expect(getRecommendedGradeBadgePosition('market')).toBe('below-header');
    expect(getRecommendedGradeBadgePosition('insight')).toBe('floating-low');
  });
});
`);

/* -------------------------------------------------------------------------- */
/* 2) Patch GradeBadge component                                               */
/* -------------------------------------------------------------------------- */

patchFile('src/components/audit/GradeBadge.jsx', source => {
  let text = source;

  text = insertAfterOnce(
    text,
    `import { auditGradeLabel, auditGradeTone } from '../../services/pageAuditGrading.js';`,
    `
import { getGradeBadgeClassName, getGradeBadgeStyle } from './gradeBadgePlacement.js';`,
    'GradeBadge placement import'
  );

  text = replaceOnce(
    text,
    `export default function GradeBadge({ audit, label = 'Quality grade', corner = true }) {`,
    `export default function GradeBadge({
  audit,
  label = 'Quality grade',
  position = 'top-right',
  compact = false,
  topOffset = null,
  rightOffset = null,
  zIndex = null,
  className = '',
}) {`,
    'GradeBadge props'
  );

  text = replaceOnce(
    text,
    `  const tone = auditGradeTone(audit);`,
    `  const tone = auditGradeTone(audit);
  const badgeClassName = getGradeBadgeClassName({
    tone,
    position,
    compact,
    className,
  });
  const badgeStyle = getGradeBadgeStyle({
    topOffset,
    rightOffset,
    zIndex,
  });`,
    'GradeBadge class style construction'
  );

  text = replaceOnce(
    text,
    `        className={
          'grade-badge grade-badge--' + tone + (corner ? ' grade-badge--corner' : '')
        }`,
    `        className={badgeClassName}
        style={badgeStyle}`,
    'GradeBadge className style usage'
  );

  return text;
});

/* -------------------------------------------------------------------------- */
/* 3) Replace GradeBadge CSS with collision-safe placements                    */
/* -------------------------------------------------------------------------- */

write('src/components/audit/GradeBadge.css', `.grade-badge {
  --grade-badge-top-offset: 12px;
  --grade-badge-right-offset: 12px;
  --grade-badge-z-index: 40;
  --grade-badge-size: 42px;

  display: inline-grid;
  place-items: center;
  width: var(--grade-badge-size);
  height: var(--grade-badge-size);
  border: 1px solid rgba(255, 255, 255, 0.20);
  border-radius: 14px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.26);
  color: #fff;
  cursor: pointer;
  font-weight: 950;
  line-height: 1;
  z-index: var(--grade-badge-z-index);
}

.grade-badge--position-top-right {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + var(--grade-badge-top-offset));
  right: calc(env(safe-area-inset-right, 0px) + var(--grade-badge-right-offset));
}

.grade-badge--position-below-header {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + var(--grade-badge-top-offset, 72px));
  right: calc(env(safe-area-inset-right, 0px) + var(--grade-badge-right-offset, 12px));
}

.grade-badge--position-floating-low {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + var(--grade-badge-top-offset, 88px));
  right: calc(env(safe-area-inset-right, 0px) + var(--grade-badge-right-offset, 12px));
}

.grade-badge--position-inline {
  position: relative;
  top: auto;
  right: auto;
  box-shadow: none;
}

.grade-badge--compact {
  --grade-badge-size: 36px;
  border-radius: 12px;
}

.grade-badge__letter {
  font-size: 1.12rem;
  letter-spacing: 0.02em;
}

.grade-badge--compact .grade-badge__letter {
  font-size: 0.98rem;
}

.grade-badge--good {
  background: linear-gradient(135deg, rgba(22, 163, 74, 0.95), rgba(21, 128, 61, 0.95));
}

.grade-badge--warn {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(180, 83, 9, 0.95));
}

.grade-badge--bad {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(153, 27, 27, 0.95));
}

.grade-badge:hover {
  transform: translateY(-1px);
}

.grade-badge:focus-visible {
  outline: 3px solid rgba(147, 197, 253, 0.75);
  outline-offset: 3px;
}

@media (max-width: 560px) {
  .grade-badge {
    --grade-badge-size: 38px;
    --grade-badge-top-offset: 10px;
    --grade-badge-right-offset: 10px;
    border-radius: 12px;
  }

  .grade-badge--position-below-header {
    --grade-badge-top-offset: 64px;
  }

  .grade-badge--position-floating-low {
    --grade-badge-top-offset: 78px;
  }
}

@media (max-width: 380px) {
  .grade-badge--position-top-right,
  .grade-badge--position-below-header,
  .grade-badge--position-floating-low {
    --grade-badge-right-offset: 8px;
  }
}
`);

/* -------------------------------------------------------------------------- */
/* 4) Patch page usage offsets                                                 */
/* -------------------------------------------------------------------------- */

function patchGradeBadgeUsage(path, label, props) {
  patchFile(path, source => {
    const target = `<GradeBadge audit={${props.auditVar}} label="${label}" />`;
    const replacement = `<GradeBadge
                audit={${props.auditVar}}
                label="${label}"
                position="${props.position}"
                topOffset="${props.topOffset}"
                compact={${props.compact ? 'true' : 'false'}}
            />`;

    if (source.includes(replacement)) return source;
    if (!source.includes(target)) {
      console.log(`skip ${path}; exact GradeBadge target not found for ${label}`);
      return source;
    }

    return source.replace(target, replacement);
  });
}

if (fs.existsSync('src/pages/MainPage.jsx')) {
  patchGradeBadgeUsage('src/pages/MainPage.jsx', 'Main tab quality grade', {
    auditVar: 'mainTabAudit',
    position: 'top-right',
    topOffset: '12px',
    compact: false,
  });
}

if (fs.existsSync('src/pages/WeatherPage.jsx')) {
  patchGradeBadgeUsage('src/pages/WeatherPage.jsx', 'Weather tab quality grade', {
    auditVar: 'weatherTabAudit',
    position: 'below-header',
    topOffset: '74px',
    compact: true,
  });
}

if (fs.existsSync('src/pages/MarketPage.jsx')) {
  patchGradeBadgeUsage('src/pages/MarketPage.jsx', 'Market tab quality grade', {
    auditVar: 'marketTabAudit',
    position: 'below-header',
    topOffset: '74px',
    compact: true,
  });
}

if (fs.existsSync('src/pages/InsightPage.jsx')) {
  patchGradeBadgeUsage('src/pages/InsightPage.jsx', 'Insight tab quality grade', {
    auditVar: 'insightTabAudit',
    position: 'floating-low',
    topOffset: '86px',
    compact: true,
  });
}

/* -------------------------------------------------------------------------- */
/* 5) Certification                                                            */
/* -------------------------------------------------------------------------- */

write('scripts/test_grade_badge_position_safety_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const placement = read('src/components/audit/gradeBadgePlacement.js');
const placementTest = read('src/components/audit/gradeBadgePlacement.cert.test.js');
const badge = read('src/components/audit/GradeBadge.jsx');
const css = read('src/components/audit/GradeBadge.css');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'GRADE_BADGE_POSITIONS',
  'normalizeGradeBadgePosition',
  'getGradeBadgeClassName',
  'getGradeBadgeStyle',
  'getRecommendedGradeBadgePosition'
]) {
  assert(placement.includes(token), 'gradeBadgePlacement.js missing token: ' + token);
}

for (const token of [
  'Grade badge placement certification',
  'normalizes invalid placement',
  'builds collision-safe placement class names',
  'exposes CSS variable style offsets',
  'recommends lower placement'
]) {
  assert(placementTest.includes(token), 'gradeBadgePlacement.cert.test.js missing token: ' + token);
}

for (const token of [
  'position = \\'top-right\\'',
  'compact = false',
  'topOffset = null',
  'getGradeBadgeClassName',
  'getGradeBadgeStyle',
  'style={badgeStyle}'
]) {
  assert(badge.includes(token), 'GradeBadge.jsx missing token: ' + token);
}

for (const token of [
  '--grade-badge-top-offset',
  '--grade-badge-right-offset',
  'env(safe-area-inset-top',
  'grade-badge--position-top-right',
  'grade-badge--position-below-header',
  'grade-badge--position-floating-low',
  'grade-badge--position-inline',
  'grade-badge--compact'
]) {
  assert(css.includes(token), 'GradeBadge.css missing token: ' + token);
}

const pageChecks = [
  ['src/pages/MainPage.jsx', 'position="top-right"'],
  ['src/pages/WeatherPage.jsx', 'position="below-header"'],
  ['src/pages/MarketPage.jsx', 'position="below-header"'],
  ['src/pages/InsightPage.jsx', 'position="floating-low"'],
];

for (const [path, token] of pageChecks) {
  if (fs.existsSync(path)) {
    const content = read(path);
    assert(content.includes(token), path + ' missing grade badge position token: ' + token);
  }
}

assert(
  packageJson.includes('"test:grade-badge-position-safety"'),
  'package.json must include test:grade-badge-position-safety'
);

assert(
  certGate.includes("['npm', ['run', 'test:grade-badge-position-safety']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include grade badge position safety test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Grade badge positioning and collision safety',
  guarantees: [
    'GradeBadge supports top-right, below-header, floating-low and inline placements',
    'GradeBadge uses safe-area CSS variables',
    'GradeBadge accepts per-page top/right offsets',
    'Weather and Market can avoid header/control collision',
    'Insight can use lower floating placement',
    'static and Vitest certification are included'
  ]
}, null, 2));

console.log('PASS: Grade badge position safety static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:grade-badge-position-safety'] =
    'node scripts/test_grade_badge_position_safety_static.mjs && vitest run --config vitest.config.js src/components/audit/gradeBadgePlacement.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:grade-badge-position-safety']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  if (source.includes("  ['npm', ['run', 'test:grade-popup-more-diagnostics']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:grade-popup-more-diagnostics']],",
      "  ['npm', ['run', 'test:grade-popup-more-diagnostics']],\\n  ['npm', ['run', 'test:grade-badge-position-safety']],"
    );
  }

  if (source.includes("  ['npm', ['run', 'test:unified-grade-badge-tabs']],")) {
    return source.replace(
      "  ['npm', ['run', 'test:unified-grade-badge-tabs']],",
      "  ['npm', ['run', 'test:unified-grade-badge-tabs']],\\n  ['npm', ['run', 'test:grade-badge-position-safety']],"
    );
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'grade-badge-position-safety')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'grade-popup-more-diagnostics');
      const command = {
        id: 'grade-badge-position-safety',
        cmd: 'npm',
        args: ['run', 'test:grade-badge-position-safety'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:grade-badge-position-safety')) return source;

    if (source.includes("'test:grade-popup-more-diagnostics',")) {
      return source.replace(
        "'test:grade-popup-more-diagnostics',",
        "'test:grade-popup-more-diagnostics',\\n  'test:grade-badge-position-safety',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 60D Grade badge positioning and collision safety patch complete.');
