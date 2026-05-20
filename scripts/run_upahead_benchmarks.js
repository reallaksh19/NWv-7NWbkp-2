import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runUpAheadBenchmark } from '../src/debug/benchmarkDebugRunner.js';
import { UPAHEAD_BENCHMARK_THRESHOLDS } from '../benchmarks/upahead/thresholds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read from the new organized path or fallback to original
const BENCHMARKS_DIR = path.join(__dirname, '../benchmarks');
const UPAHEAD_BENCHMARKS_DIR = path.join(__dirname, '../benchmarks/upahead');

function getInputs(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('_input.json') || f.includes('_input_'))
        .map(f => path.join(dir, f));
}

function runAll() {
    let inputFiles = [...getInputs(BENCHMARKS_DIR), ...getInputs(UPAHEAD_BENCHMARKS_DIR)];
    
    if (inputFiles.length === 0) {
        console.log('No benchmark input files found in benchmarks/ directory.');
        return;
    }

    let globalFailed = false;

    inputFiles.forEach(inputFilePath => {
        const inputFile = path.basename(inputFilePath);
        const dir = path.dirname(inputFilePath);
        
        console.log(`\n========================================`);
        console.log(`Running benchmark for: ${inputFile}`);
        console.log(`========================================`);

        const rawData = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

        let expectedData = {};
        const expectedFile = inputFile.replace('_input', '_expected').replace('_input_', '_expected_');
        const expectedFileLegacy = inputFile.replace('_input', '_expected_output').replace('_input_', '_expected_output_');

        if (fs.existsSync(path.join(dir, expectedFile))) {
             expectedData = JSON.parse(fs.readFileSync(path.join(dir, expectedFile), 'utf8'));
        } else if (fs.existsSync(path.join(dir, expectedFileLegacy))) {
             expectedData = JSON.parse(fs.readFileSync(path.join(dir, expectedFileLegacy), 'utf8'));
        } else if (fs.existsSync(path.join(dir, inputFile.replace(/_input.*\.json$/, '_expected_output.json')))) {
             expectedData = JSON.parse(fs.readFileSync(path.join(dir, inputFile.replace(/_input.*\.json$/, '_expected_output.json')), 'utf8'));
        }

        const mode = inputFile.includes('online') ? 'online' : 'offline';
        const startTime = Date.now();
        
        let inputItems = Array.isArray(rawData) ? rawData : (rawData.items || Object.values(rawData).flat() || []);
        if (!Array.isArray(inputItems)) {
            inputItems = [];
        }

        const report = runUpAheadBenchmark(inputItems, expectedData, {
            asOfDate: '2024-11-26T00:00:00Z',
            plannerWindowDays: 7,
            mode: mode,
            selectedCities: ['Chennai', 'Muscat', 'Trichy']
        });
        
        const executionMs = Date.now() - startTime;

        console.log('\n--- METRICS AND DIAGNOSTICS ---');
        console.log(JSON.stringify({
            counts: report.counts,
            plannerMetrics: report.metrics.planner,
            upAheadMetrics: report.metrics.upAhead,
            topDropReasons: report.dropReport.slice(0, 10),
            categoryMetrics: report.metrics.byCategory
        }, null, 2));

        console.log(`\n--- RUNTIME: ${executionMs}ms ---`);

        // Threshold checks
        const thresholds = UPAHEAD_BENCHMARK_THRESHOLDS[mode];
        if (thresholds) {
            const failedThresholds = [];
            const metrics = report.metrics;

            function assertMetric(name, actual, minValue, failures) {
                if (actual < minValue) {
                    failures.push(`${name}: expected >= ${minValue}, got ${actual}`);
                }
            }

            function assertMax(name, actual, maxValue, failures) {
                if (actual > maxValue) {
                    failures.push(`${name}: expected <= ${maxValue}, got ${actual}`);
                }
            }

            const isOnline = mode === 'online';
            if (metrics.planner) {
                if (thresholds.plannerPrecision) assertMetric(isOnline ? 'online.plannerPrecision' : 'offline.plannerPrecision', metrics.planner.precision, thresholds.plannerPrecision, failedThresholds);
                if (thresholds.plannerRecall) assertMetric(isOnline ? 'online.plannerRecall' : 'offline.plannerRecall', metrics.planner.recall, thresholds.plannerRecall, failedThresholds);
                if (thresholds.plannerF1) assertMetric(isOnline ? 'online.plannerF1' : 'offline.plannerF1', metrics.planner.f1, thresholds.plannerF1, failedThresholds);
            }
            if (metrics.upAhead) {
                if (thresholds.upAheadPrecision) assertMetric(isOnline ? 'online.upAheadPrecision' : 'offline.upAheadPrecision', metrics.upAhead.precision, thresholds.upAheadPrecision, failedThresholds);
                if (thresholds.upAheadRecall) assertMetric(isOnline ? 'online.upAheadRecall' : 'offline.upAheadRecall', metrics.upAhead.recall, thresholds.upAheadRecall, failedThresholds);
            }
            if (isOnline) {
                if (metrics.byCategory?.airlines && thresholds.airlinePrecision) {
                    assertMetric('online.airlinesPrecision', metrics.byCategory.airlines.precision, thresholds.airlinePrecision, failedThresholds);
                }
                if (metrics.byCategory?.shopping && thresholds.shoppingPrecision) {
                    assertMetric('online.shoppingPrecision', metrics.byCategory.shopping.precision, thresholds.shoppingPrecision, failedThresholds);
                }
            }
            if (thresholds.maxExecutionMs) {
                assertMax('executionTimeMs', executionMs, thresholds.maxExecutionMs, failedThresholds);
            }

            if (failedThresholds.length > 0) {
                console.error('\n❌ Benchmark threshold failures:\n' + failedThresholds.join('\n'));
                globalFailed = true;
            } else {
                console.log('\n✅ All thresholds passed.');
            }
        }
    });
    
    if (globalFailed) {
        process.exitCode = 1;
    }
}

runAll();
