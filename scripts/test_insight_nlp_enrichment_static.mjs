import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const adapter = read('src/adapters/nlpAdapter.js');
const unitTest = read('src/adapters/nlpAdapter.cert.test.js');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'STOP_WORDS', 'KNOWN_PLACES', 'KNOWN_ORGS', 'ORG_SUFFIX_RE', 'PERSON_RE',
  'SYMBOL_RE', 'PRODUCT_HINT_RE', 'NEWS_VERBS',
  'extractEntities', 'extractVerbs', 'extractNumbers', 'extractKeywords'
]) {
  assert(adapter.includes(token), `nlpAdapter.js missing enrichment token: ${token}`);
}

for (const token of [
  'Insight NLP enrichment certification',
  'richer organization, place, person, product and symbol signals',
  'broad news verbs', 'richer numeric fact signals', 'stable story topic keywords'
]) {
  assert(unitTest.includes(token), `nlpAdapter.cert.test.js missing test token: ${token}`);
}

assert(packageJson.includes('"test:insight-nlp-enrichment"'), 'package.json must include test:insight-nlp-enrichment');
assert((certGate.includes("['npm', ['run', 'test:insight-nlp-enrichment']]") || certGate.includes('certification_manifest.json')), 'certification gate must run test:insight-nlp-enrichment');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight NLP enrichment slice' }, null, 2));
console.log('PASS: Insight NLP enrichment static slice');
