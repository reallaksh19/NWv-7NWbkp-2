import { existsSync } from 'fs';
function assert(cond, msg) { if (!cond) throw new Error(msg); }

assert(existsSync('src/services/insightQualityDashboard.js'), 'Missing insightQualityDashboard.js');
assert(existsSync('src/services/insightQualityDashboard.cert.test.js'), 'Missing test');
assert(existsSync('src/components/insight/InsightQualityDashboard.jsx'), 'Missing component');
assert(existsSync('src/components/insight/InsightQualityDashboard.css'), 'Missing CSS');

const mod = await import('../src/services/insightQualityDashboard.js');
assert(typeof mod.buildInsightQualityDashboardData === 'function', 'Missing buildInsightQualityDashboardData');
assert(typeof mod.getInsightQualityDashboardStatus === 'function', 'Missing getInsightQualityDashboardStatus');

const data = mod.buildInsightQualityDashboardData(null);
assert(data.status === 'NO_DATA', 'null rca must return NO_DATA');

console.log(JSON.stringify({ status: 'PASS', checked: 'insight-quality-dashboard' }, null, 2));
console.log('PASS: Insight quality dashboard static');
