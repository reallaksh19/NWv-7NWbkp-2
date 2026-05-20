import { createRequire } from 'module';
import { existsSync } from 'fs';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

assert(existsSync('src/services/insightQualityRca.js'), 'Missing insightQualityRca.js');
assert(existsSync('src/services/insightQualityRca.cert.test.js'), 'Missing insightQualityRca.cert.test.js');

const src = (await import('../src/services/insightQualityRca.js?t=' + Date.now()));
assert(typeof src.buildInsightQualityRca === 'function', 'buildInsightQualityRca must be exported');
assert(typeof src.buildInsightClusterRcaRow === 'function', 'buildInsightClusterRcaRow must be exported');
assert(typeof src.buildInsightImprovementPlan === 'function', 'buildInsightImprovementPlan must be exported');
assert(typeof src.buildInsightRcaMoreDiagnostics === 'function', 'buildInsightRcaMoreDiagnostics must be exported');

console.log(JSON.stringify({ status: 'PASS', checked: 'insight-rca-metrics' }, null, 2));
console.log('PASS: Insight RCA metrics static');
