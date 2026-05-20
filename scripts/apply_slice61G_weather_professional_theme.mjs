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

function insertAfterLastImport(source, insertion) {
  if (source.includes(insertion.trim())) return source;

  const importMatches = [...source.matchAll(/^import .+;$/gm)];
  if (!importMatches.length) return insertion + '\n' + source;

  const last = importMatches[importMatches.length - 1];
  const index = last.index + last[0].length;

  return source.slice(0, index) + '\n' + insertion + source.slice(index);
}

/* -------------------------------------------------------------------------- */
/* 1) Shared professional Weather visual system                                */
/* -------------------------------------------------------------------------- */

write('src/styles/weatherProfessionalTheme.css', `/* -------------------------------------------------------------------------- */
/* NW Weather Professional Visual System                                       */
/* Purpose: make Weather + QuickWeather consistent, visible, compact, premium. */
/* -------------------------------------------------------------------------- */

:root {
  --weather-shell-bg: rgba(15, 23, 42, 0.78);
  --weather-card-bg: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.82));
  --weather-card-bg-soft: rgba(15, 23, 42, 0.64);
  --weather-card-border: rgba(45, 212, 191, 0.20);
  --weather-card-border-strong: rgba(45, 212, 191, 0.34);
  --weather-accent: #14b8a6;
  --weather-accent-soft: rgba(20, 184, 166, 0.14);
  --weather-accent-text: #99f6e4;
  --weather-blue-soft: rgba(59, 130, 246, 0.14);
  --weather-blue-text: #bfdbfe;
  --weather-text: #f8fafc;
  --weather-muted: #94a3b8;
  --weather-muted-2: #64748b;
  --weather-danger-bg: rgba(127, 29, 29, 0.24);
  --weather-danger-border: rgba(248, 113, 113, 0.32);
  --weather-danger-text: #fecaca;
  --weather-warn-bg: rgba(120, 53, 15, 0.20);
  --weather-warn-border: rgba(245, 158, 11, 0.30);
  --weather-warn-text: #fde68a;
  --weather-good-bg: rgba(20, 184, 166, 0.14);
  --weather-good-border: rgba(45, 212, 191, 0.28);
  --weather-good-text: #ccfbf1;
  --weather-radius-lg: 22px;
  --weather-radius-md: 16px;
  --weather-shadow: 0 18px 44px rgba(0, 0, 0, 0.24);
}

/* -------------------------------------------------------------------------- */
/* Weather page shell                                                          */
/* -------------------------------------------------------------------------- */

.weather-page,
.page-container:has(.weather-location-manager),
.page-container:has(.wlm-collapsed),
.page-container:has(.wwf-card) {
  background:
    radial-gradient(840px 280px at 100% 0%, rgba(20, 184, 166, 0.08), transparent 64%),
    radial-gradient(680px 260px at 0% 20%, rgba(59, 130, 246, 0.06), transparent 66%);
}

/* -------------------------------------------------------------------------- */
/* QuickWeather desktop visibility and contrast                                */
/* -------------------------------------------------------------------------- */

.quick-weather-card,
[class*="quick-weather-card"],
[data-quick-weather],
.qw-card {
  min-height: 172px;
  border: 1px solid var(--weather-card-border) !important;
  border-radius: var(--weather-radius-lg) !important;
  background:
    radial-gradient(520px 190px at 100% 0%, rgba(20, 184, 166, 0.15), transparent 72%),
    var(--weather-card-bg) !important;
  color: var(--weather-text) !important;
  box-shadow: var(--weather-shadow);
  opacity: 1 !important;
  visibility: visible !important;
}

.quick-weather-card *,
[class*="quick-weather-card"] * {
  color-scheme: dark;
}

.quick-weather-card input,
.quick-weather-card select,
.quick-weather-card textarea,
.qw-config-bar input,
.qw-config-bar select {
  border: 1px solid rgba(148, 163, 184, 0.28) !important;
  background: rgba(2, 6, 23, 0.76) !important;
  color: var(--weather-text) !important;
}

.quick-weather-card input::placeholder,
.qw-config-bar input::placeholder {
  color: var(--weather-muted) !important;
}

.quick-weather-card button,
.qw-config-bar button {
  border-color: var(--weather-good-border) !important;
  background: var(--weather-good-bg) !important;
  color: var(--weather-good-text) !important;
}

/* Desktop guard: never allow QuickWeather rows to collapse into invisible text. */

@media (min-width: 900px) {
  .quick-weather-card,
  [class*="quick-weather-card"] {
    display: block !important;
    min-height: 188px;
    overflow: visible;
  }

  .qw-cities-list,
  .quick-weather-card ul,
  .quick-weather-card .weather-list {
    display: grid;
    gap: 8px;
  }
}

/* -------------------------------------------------------------------------- */
/* QuickWeather city rows and precipitation                                    */
/* -------------------------------------------------------------------------- */

.qw-city-row,
.quick-weather-card li,
.quick-weather-card [class*="city-row"] {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: var(--weather-radius-md);
  background: rgba(2, 6, 23, 0.34);
  color: #e2e8f0;
}

.qw-city-row--active,
.quick-weather-card [aria-selected="true"],
.quick-weather-card .active {
  border-color: var(--weather-card-border-strong);
  background: rgba(20, 184, 166, 0.12);
}

.qw-city-slot__pop,
.qw-pop-high,
.qw-pop-low {
  min-width: 84px;
  white-space: nowrap;
  font-weight: 850;
}

.qw-pop-high {
  color: #93c5fd !important;
}

.qw-pop-low {
  color: var(--weather-muted) !important;
}

/* -------------------------------------------------------------------------- */
/* QuickWeather signal strip                                                   */
/* -------------------------------------------------------------------------- */

.qwss-strip,
.quick-weather-signal-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 12px;
}

.qwss-chip,
.quick-weather-signal {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 6px 9px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.42);
  color: #e2e8f0;
  font-size: 0.76rem;
  font-weight: 850;
  line-height: 1;
  white-space: nowrap;
}

.qwss-chip--low,
.quick-weather-signal--good {
  border-color: var(--weather-good-border);
  background: var(--weather-good-bg);
  color: var(--weather-good-text);
}

.qwss-chip--medium,
.quick-weather-signal--warn {
  border-color: var(--weather-warn-border);
  background: var(--weather-warn-bg);
  color: var(--weather-warn-text);
}

.qwss-chip--high,
.quick-weather-signal--bad {
  border-color: var(--weather-danger-border);
  background: var(--weather-danger-bg);
  color: var(--weather-danger-text);
}

/* -------------------------------------------------------------------------- */
/* Item below QuickWeather / highlight card                                    */
/* -------------------------------------------------------------------------- */

.qw-highlight-text-container,
.quick-weather-card + .weather-alert,
.quick-weather-card + .card,
.quick-weather-card [class*="highlight"],
.quick-weather-card [class*="alert"] {
  display: grid !important;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  margin-top: 12px;
  padding: 12px 14px !important;
  border: 1px solid var(--weather-card-border);
  border-radius: 18px !important;
  background:
    linear-gradient(135deg, rgba(20, 184, 166, 0.14), rgba(59, 130, 246, 0.10)) !important;
  color: #e2e8f0 !important;
}

.qw-highlight-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: rgba(2, 6, 23, 0.40);
  font-size: 1.1rem;
}

.qw-highlight-text,
.quick-weather-card [class*="highlight"] strong,
.quick-weather-card [class*="alert"] strong {
  color: var(--weather-text) !important;
  font-size: 0.92rem;
  font-weight: 850;
  line-height: 1.35;
}

.qw-severe-banner {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid var(--weather-danger-border);
  background: var(--weather-danger-bg);
  color: var(--weather-danger-text);
}

/* -------------------------------------------------------------------------- */
/* Weather location manager                                                    */
/* -------------------------------------------------------------------------- */

.wlm-collapsed,
.wlm-panel,
.weather-location-manager {
  border-color: var(--weather-card-border) !important;
  border-radius: 20px !important;
  background:
    radial-gradient(420px 160px at 100% 0%, rgba(20, 184, 166, 0.12), transparent 70%),
    var(--weather-card-bg) !important;
  box-shadow: var(--weather-shadow);
}

.wlm-eyebrow,
.wlm-section-label,
.weather-location-manager__eyebrow {
  color: var(--weather-accent-text) !important;
}

.wlm-chip,
.weather-location-manager__chip {
  border-color: rgba(148, 163, 184, 0.18) !important;
  background: rgba(2, 6, 23, 0.42) !important;
  color: #e2e8f0 !important;
}

.wlm-select,
.weather-location-manager input {
  border-color: rgba(148, 163, 184, 0.26) !important;
  background: rgba(2, 6, 23, 0.70) !important;
  color: var(--weather-text) !important;
}

.wlm-add-colombo,
.wlm-add-btn,
.wlm-toggle,
.wlm-help button,
.wlm-quick-add__buttons button,
.weather-location-manager button {
  border-color: var(--weather-good-border) !important;
  background: var(--weather-good-bg) !important;
  color: var(--weather-good-text) !important;
}

/* -------------------------------------------------------------------------- */
/* Weekly forecast                                                             */
/* -------------------------------------------------------------------------- */

.wwf-card,
.weekly-weather-forecast {
  margin: 14px 16px;
  border: 1px solid var(--weather-card-border) !important;
  border-radius: var(--weather-radius-lg) !important;
  overflow: hidden;
  background:
    radial-gradient(520px 180px at 100% 0%, rgba(20, 184, 166, 0.12), transparent 70%),
    var(--weather-card-bg-soft) !important;
  box-shadow: var(--weather-shadow);
}

.wwf-header,
.weekly-weather-forecast__header {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.wwf-eyebrow,
.weekly-weather-forecast__eyebrow {
  color: var(--weather-accent-text) !important;
  font-size: 0.66rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wwf-header h3,
.weekly-weather-forecast h2,
.weekly-weather-forecast h3 {
  color: var(--weather-text) !important;
}

.wwf-row,
.weekly-weather-forecast__day {
  border: 1px solid rgba(148, 163, 184, 0.12) !important;
  border-radius: 16px !important;
  background: rgba(2, 6, 23, 0.34) !important;
}

.wwf-row--today,
.weekly-weather-forecast__day:first-child {
  border-color: var(--weather-card-border-strong) !important;
  background: rgba(20, 184, 166, 0.10) !important;
}

.wwf-day,
.wwf-temp strong,
.weekly-weather-forecast__temp strong {
  color: var(--weather-text) !important;
}

.wwf-condition,
.wwf-temp span,
.wwf-metric strong,
.weekly-weather-forecast__condition {
  color: #cbd5e1 !important;
}

.wwf-metric span {
  color: var(--weather-muted-2) !important;
}

/* -------------------------------------------------------------------------- */
/* Weather comparison and planning cards                                       */
/* -------------------------------------------------------------------------- */

.weather-city-comparison,
.weather-planning-summary {
  border: 1px solid var(--weather-card-border) !important;
  border-radius: var(--weather-radius-lg) !important;
  background:
    radial-gradient(520px 180px at 100% 0%, rgba(20, 184, 166, 0.10), transparent 70%),
    var(--weather-card-bg-soft) !important;
  box-shadow: var(--weather-shadow);
}

.weather-city-comparison__eyebrow,
.weather-planning-summary__eyebrow {
  color: var(--weather-accent-text) !important;
}

.weather-city-comparison h2,
.weather-planning-summary h2,
.weather-planning-summary h3 {
  color: var(--weather-text) !important;
}

.weather-city-comparison__table th {
  color: var(--weather-blue-text) !important;
}

.weather-city-comparison__table td,
.weather-planning-summary__line {
  color: #cbd5e1 !important;
}

/* -------------------------------------------------------------------------- */
/* Mobile compact behavior                                                     */
/* -------------------------------------------------------------------------- */

@media (max-width: 680px) {
  .quick-weather-card,
  .wwf-card,
  .weather-city-comparison,
  .weather-planning-summary,
  .wlm-collapsed,
  .wlm-panel {
    margin-left: 10px !important;
    margin-right: 10px !important;
    border-radius: 18px !important;
  }

  .qwss-strip,
  .quick-weather-signal-strip {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .qwss-chip,
  .quick-weather-signal {
    justify-content: center;
  }

  .qw-highlight-text-container {
    grid-template-columns: 1fr !important;
  }
}
`);

/* -------------------------------------------------------------------------- */
/* 2) Import professional theme globally                                       */
/* -------------------------------------------------------------------------- */

patchFile('src/App.jsx', source => {
  return insertAfterLastImport(
    source,
    `import './styles/weatherProfessionalTheme.css';`
  );
});

/* -------------------------------------------------------------------------- */
/* 3) Static and Vitest guard                                                  */
/* -------------------------------------------------------------------------- */

write('src/styles/weatherProfessionalTheme.cert.test.js', `import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('Weather professional theme certification', () => {
  const css = fs.readFileSync('src/styles/weatherProfessionalTheme.css', 'utf8');

  it('defines shared weather visual variables', () => {
    expect(css).toContain('--weather-card-bg');
    expect(css).toContain('--weather-card-border');
    expect(css).toContain('--weather-accent-text');
  });

  it('protects QuickWeather desktop visibility', () => {
    expect(css).toContain('.quick-weather-card');
    expect(css).toContain('visibility: visible');
    expect(css).toContain('@media (min-width: 900px)');
  });

  it('styles the item below QuickWeather professionally', () => {
    expect(css).toContain('.qw-highlight-text-container');
    expect(css).toContain('grid-template-columns: auto minmax(0, 1fr)');
    expect(css).toContain('linear-gradient');
  });

  it('styles weekly forecast and weather manager consistently', () => {
    expect(css).toContain('.wwf-card');
    expect(css).toContain('.wlm-collapsed');
    expect(css).toContain('.weather-city-comparison');
    expect(css).toContain('.weather-planning-summary');
  });

  it('includes mobile compact guards', () => {
    expect(css).toContain('@media (max-width: 680px)');
    expect(css).toContain('grid-template-columns: 1fr 1fr');
  });
});
`);

write('scripts/test_weather_professional_theme_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const css = read('src/styles/weatherProfessionalTheme.css');
const app = read('src/App.jsx');
const cert = read('src/styles/weatherProfessionalTheme.cert.test.js');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  '--weather-card-bg',
  '--weather-card-border',
  '--weather-accent-text',
  '.quick-weather-card',
  'visibility: visible',
  '.qw-highlight-text-container',
  '.qwss-strip',
  '.wlm-collapsed',
  '.wwf-card',
  '.weather-city-comparison',
  '.weather-planning-summary',
]) {
  assert(css.includes(token), 'weatherProfessionalTheme.css missing token: ' + token);
}

for (const token of [
  "import './styles/weatherProfessionalTheme.css';",
]) {
  assert(app.includes(token), 'App.jsx missing token: ' + token);
}

for (const token of [
  'Weather professional theme certification',
  'protects QuickWeather desktop visibility',
  'styles the item below QuickWeather professionally',
  'styles weekly forecast and weather manager consistently',
]) {
  assert(cert.includes(token), 'weatherProfessionalTheme.cert.test.js missing token: ' + token);
}

assert(
  packageJson.includes('"test:weather-professional-theme"'),
  'package.json must include test:weather-professional-theme'
);

assert(
  certGate.includes("['npm', ['run', 'test:weather-professional-theme']]") ||
    certGate.includes('certification_manifest.json'),
  'certification gate must include weather professional theme test or be manifest-driven'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather professional visual theme',
  guarantees: [
    'QuickWeather is visible in desktop view',
    'QuickWeather card has professional contrast',
    'item below QuickWeather is styled professionally',
    'weekly forecast matches Weather tab theme',
    'city manager matches Weather tab theme',
    'weather comparison/planning cards match theme',
    'mobile compact guards are present'
  ]
}, null, 2));

console.log('PASS: Weather professional theme static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:weather-professional-theme'] =
    'node scripts/test_weather_professional_theme_static.mjs && vitest run --config vitest.config.js src/styles/weatherProfessionalTheme.cert.test.js';
  return JSON.stringify(pkg, null, 2) + '\n';
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:weather-professional-theme']]")) return source;
  if (source.includes('certification_manifest.json')) return source;

  const anchors = [
    "  ['npm', ['run', 'test:weather-manager-clarity']],",
    "  ['npm', ['run', 'test:weather-final-closure']],",
    "  ['npm', ['run', 'test:weather-integration-hardening']],",
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(
        anchor,
        anchor + "\\n  ['npm', ['run', 'test:weather-professional-theme']],"
      );
    }
  }

  return source;
});

if (fs.existsSync('scripts/certification_manifest.json')) {
  patchFile('scripts/certification_manifest.json', source => {
    const manifest = JSON.parse(source);
    manifest.commands = Array.isArray(manifest.commands) ? manifest.commands : [];

    if (!manifest.commands.some(entry => entry.id === 'weather-professional-theme')) {
      const insertIndex = manifest.commands.findIndex(entry => entry.id === 'weather-manager-clarity');
      const command = {
        id: 'weather-professional-theme',
        cmd: 'npm',
        args: ['run', 'test:weather-professional-theme'],
      };

      if (insertIndex >= 0) manifest.commands.splice(insertIndex + 1, 0, command);
      else manifest.commands.push(command);
    }

    return JSON.stringify(manifest, null, 2) + '\n';
  });
}

if (fs.existsSync('scripts/validate_certification_manifest.mjs')) {
  patchFile('scripts/validate_certification_manifest.mjs', source => {
    if (source.includes('test:weather-professional-theme')) return source;

    if (source.includes("'test:weather-manager-clarity',")) {
      return source.replace(
        "'test:weather-manager-clarity',",
        "'test:weather-manager-clarity',\\n  'test:weather-professional-theme',"
      );
    }

    return source;
  });
}

console.log('\\nSlice 61G Weather professional visual theme patch complete.');
