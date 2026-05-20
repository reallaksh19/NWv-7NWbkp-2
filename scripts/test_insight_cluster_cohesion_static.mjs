import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const topic = read('src/insight/src/cluster/topicCohesion.ts');
const topicTest = read('src/insight/src/cluster/topicCohesion.cert.test.ts');
const clusterTest = read('src/insight/src/cluster/clusterCohesion.cert.test.ts');
const dedup = read('src/insight/src/dedup/dedup.ts');
const cluster = read('src/insight/src/cluster/cluster.ts');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'getStoryTopicTokens', 'topicTokenOverlap', 'hasSharedTopicSignature',
  'getTopicCohesionDiagnostics', 'sharedTokens'
]) {
  assert(topic.includes(token), `topicCohesion.ts missing token: ${token}`);
}

for (const token of [
  'Insight topic cohesion certification',
  'detects shared topic signature',
  'does not force unrelated topics together'
]) {
  assert(topicTest.includes(token), `topicCohesion.cert.test.ts missing token: ${token}`);
}

for (const token of [
  'Insight cluster cohesion certification',
  'same event cluster',
  'does not cluster unrelated same-day stories'
]) {
  assert(clusterTest.includes(token), `clusterCohesion.cert.test.ts missing token: ${token}`);
}

for (const token of [
  'topicTokenOverlap', 'hasSharedTopicSignature', '0.16 * topicSim', 'topic cohesion cluster override'
]) {
  assert(dedup.includes(token), `dedup.ts missing topic cohesion token: ${token}`);
}

for (const token of [
  'getTopicCohesionDiagnostics', 'clusterMatchDiagnostics', 'topicDiagnostics'
]) {
  assert(cluster.includes(token), `cluster.ts missing topic diagnostics token: ${token}`);
}

assert(packageJson.includes('"test:insight-cluster-cohesion"'), 'package.json must include test:insight-cluster-cohesion');
assert((certGate.includes("['npm', ['run', 'test:insight-cluster-cohesion']]") || certGate.includes('certification_manifest.json')), 'certification gate must run test:insight-cluster-cohesion');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight cluster cohesion slice' }, null, 2));
console.log('PASS: Insight cluster cohesion static slice');
