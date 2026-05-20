import fs from 'fs';
import path from 'path';
import { runUpAheadBenchmark } from '../src/debug/benchmarkDebugRunner.js';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const input = readJson(path.resolve('benchmarks/upahead/planner_edgecases_input.json'));
const expected = readJson(path.resolve('benchmarks/upahead/planner_edgecases_expected.json'));

const report = runUpAheadBenchmark(input.items, expected, {
  asOfDate: '2024-11-26T00:00:00Z',
  plannerWindowDays: 7,
  mode: 'offline',
  selectedCities: ['Chennai', 'Muscat', 'Trichy']
});

console.log(JSON.stringify({
  counts: report.counts,
  plannerMetrics: report.metrics.planner,
  upAheadMetrics: report.metrics.upAhead,
  categoryMetrics: report.metrics.byCategory,
  topDropReasons: report.dropReport.slice(0, 10)
}, null, 2));

assert(report.metrics.planner.precision >= 0.85, `Planner precision below target: ${report.metrics.planner.precision}`);
assert(report.metrics.planner.recall >= 0.75, `Planner recall below target: ${report.metrics.planner.recall}`);
assert(report.metrics.planner.f1 >= 0.80, `Planner F1 below target: ${report.metrics.planner.f1}`);
assert(report.counts.deduped <= report.counts.canonical, 'Deduped count invalid');

console.log('\n✅ PASS: Up Ahead smoke benchmark');
