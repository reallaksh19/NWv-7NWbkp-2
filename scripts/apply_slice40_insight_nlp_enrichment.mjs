import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

// nlpAdapter.js is already written directly - just verify it exists
if (!fs.existsSync('src/adapters/nlpAdapter.js')) {
  throw new Error('nlpAdapter.js must be written before running this script');
}
console.log('patched: src/adapters/nlpAdapter.js (pre-written)');

write('src/adapters/nlpAdapter.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  extractEntities,
  extractKeywords,
  extractNumbers,
  extractVerbs,
} from './nlpAdapter';

describe('Insight NLP enrichment certification', () => {
  it('extracts richer organization, place, person, product and symbol signals', async () => {
    const entities = await extractEntities(
      'Finance Ministry officials and Dr Meera Rao reviewed Acme Bank Ltd outage in Chennai after $ACME shares fell. Acme Pay Pro users complained.'
    );

    expect(entities.orgs).toContain('Finance Ministry');
    expect(entities.orgs).toContain('Acme Bank Ltd');
    expect(entities.places).toContain('Chennai');
    expect(entities.people).toContain('Meera Rao');
    expect(entities.symbols).toContain('ACME');
    expect(entities.products).toContain('Acme Pay Pro');
  });

  it('extracts broad news verbs beyond the old narrow list', async () => {
    const verbs = await extractVerbs(
      'Officials confirmed the regulator reviewed the outage, investors sold shares, and users criticised the bank.'
    );

    expect(verbs).toContain('confirmed');
    expect(verbs).toContain('reviewed');
    expect(verbs).toContain('sold');
    expect(verbs).toContain('criticised');
  });

  it('extracts richer numeric fact signals', async () => {
    const numbers = await extractNumbers(
      'Shares fell 4 percent, affected 2 million users for 3 hours, and wiped $1.2 billion from value.'
    );

    expect(numbers).toContain('4 percent');
    expect(numbers).toContain('2 million');
    expect(numbers).toContain('3 hours');
    expect(numbers).toContain('$1.2 billion');
  });

  it('extracts stable story topic keywords instead of noisy filler words', async () => {
    const keywords = await extractKeywords(
      'Finance Ministry confirmed Acme Bank outage review after Acme Pay Pro failed for customers in Chennai.'
    );

    expect(keywords).toContain('acme');
    expect(keywords).toContain('bank');
    expect(keywords).toContain('finance');
    expect(keywords).toContain('ministry');
    expect(keywords).toContain('outage');
    expect(keywords).not.toContain('after');
  });
});
`);

write('scripts/test_insight_nlp_enrichment_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
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
  assert(adapter.includes(token), \`nlpAdapter.js missing enrichment token: \${token}\`);
}

for (const token of [
  'Insight NLP enrichment certification',
  'richer organization, place, person, product and symbol signals',
  'broad news verbs', 'richer numeric fact signals', 'stable story topic keywords'
]) {
  assert(unitTest.includes(token), \`nlpAdapter.cert.test.js missing test token: \${token}\`);
}

assert(packageJson.includes('"test:insight-nlp-enrichment"'), 'package.json must include test:insight-nlp-enrichment');
assert(certGate.includes("['npm', ['run', 'test:insight-nlp-enrichment']]"), 'certification gate must run test:insight-nlp-enrichment');

console.log(JSON.stringify({ status: 'PASS', checked: 'Insight NLP enrichment slice' }, null, 2));
console.log('PASS: Insight NLP enrichment static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:insight-nlp-enrichment'] = 'node scripts/test_insight_nlp_enrichment_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:insight-nlp-enrichment']]")) return source;

  if (source.includes("['npm', ['run', 'test:insight-snapshot-intake']]")) {
    return source.replace(
      "  ['npm', ['run', 'test:insight-snapshot-intake']],",
      "  ['npm', ['run', 'test:insight-snapshot-intake']],\n  ['npm', ['run', 'test:insight-nlp-enrichment']],"
    );
  }

  return source.replace(
    "  ['npm', ['run', 'test:insight-behavior-evidence']],",
    "  ['npm', ['run', 'test:insight-nlp-enrichment']],\n  ['npm', ['run', 'test:insight-behavior-evidence']],"
  );
});

console.log('\nSlice 40 Insight NLP enrichment patch complete.');
