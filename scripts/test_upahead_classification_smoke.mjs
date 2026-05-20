import fs from 'fs';
import { runUpAheadBenchmark } from '../src/debug/benchmarkDebugRunner.js';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const input = readJson('benchmarks/upahead/planner_edgecases_input.json').items;
const expected = readJson('benchmarks/upahead/planner_edgecases_expected.json');

const report = runUpAheadBenchmark(input, expected, {
  asOfDate: '2024-11-26T00:00:00Z',
  plannerWindowDays: 7,
  mode: 'offline',
  selectedCities: ['Chennai', 'Muscat', 'Trichy']
});

console.log(JSON.stringify({
  planner: report.metrics.planner,
  upAhead: report.metrics.upAhead,
  byCategory: report.metrics.byCategory
}, null, 2));

assert(report.metrics.planner.precision >= 0.85, 'Planner precision below target');
assert(report.metrics.planner.recall >= 0.75, 'Planner recall below target');
assert(report.metrics.planner.f1 >= 0.80, 'Planner F1 below target');

console.log('PASS: classification smoke');