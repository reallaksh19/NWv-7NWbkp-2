// Verifier — plain Node only, no TS imports
import { loadRealInsightQualityReport, runRatchetOnReport } from './real_insight_quality_ratchet_core.mjs';

const report = loadRealInsightQualityReport();

if (!report) {
  console.log(JSON.stringify({ status: 'SKIP', reason: 'No report file found — skipping ratchet in CI without real data' }, null, 2));
  process.exit(0);
}

const result = runRatchetOnReport(report);

console.log(JSON.stringify({ status: result.passed ? 'PASS' : 'FAIL', ...result }, null, 2));

if (!result.passed) {
  process.exit(1);
}
