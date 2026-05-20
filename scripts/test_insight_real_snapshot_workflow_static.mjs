import { existsSync } from 'fs';
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(existsSync('scripts/real_insight_quality_ratchet_core.mjs'), 'Missing ratchet core');
assert(existsSync('scripts/verify_real_insight_quality_report.mjs'), 'Missing verifier');
assert(existsSync('.github/workflows/insight-real-snapshot-quality.yml'), 'Missing workflow');

const core = await import('./real_insight_quality_ratchet_core.mjs');
assert(typeof core.loadRealInsightQualityReport === 'function', 'Missing loadRealInsightQualityReport');
assert(typeof core.runRatchetOnReport === 'function', 'Missing runRatchetOnReport');

const passing = core.runRatchetOnReport({ grade: 'A', parents: [{ weakTree: false, angles: ['base_report', 'official_response'] }] });
assert(passing.passed === true, 'Ratchet should pass for grade A');

const failing = core.runRatchetOnReport({ grade: 'D', parents: [] });
assert(failing.passed === false, 'Ratchet should fail for grade D');

console.log(JSON.stringify({ status: 'PASS', checked: 'insight-real-snapshot-workflow' }, null, 2));
console.log('PASS: Real snapshot workflow static');
