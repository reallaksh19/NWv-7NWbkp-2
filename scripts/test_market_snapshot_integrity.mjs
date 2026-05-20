// scripts/test_market_snapshot_integrity.mjs
import fs from 'fs';

const SNAPSHOT_PATH = 'public/data/market_snapshot.json';
const MAX_AGE_HOURS_FOR_SNAPSHOT = Number(process.env.MARKET_SNAPSHOT_MAX_AGE_HOURS || 48);

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseTs(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasNamedIndex(nameNeedle) {
  return snapshot.indices.some((item) =>
    String(item?.name || '').toUpperCase().includes(nameNeedle.toUpperCase())
  );
}

function assertNumericLike(value, label) {
  const text = String(value ?? '').replace(/,/g, '').replace(/[₹$%]/g, '').trim();
  const parsed = Number(text);
  assert(Number.isFinite(parsed), `${label} must be numeric-like, got ${value}`);
}

assert(snapshot && typeof snapshot === 'object', 'snapshot must be an object');
assert(snapshot.schemaVersion, 'schemaVersion missing');
assert(snapshot.generatedAt || snapshot.generated_at || snapshot.fetchedAt, 'generatedAt/generated_at/fetchedAt missing');

assert(Array.isArray(snapshot.indices), 'indices must be an array');
assert(snapshot.indices.length >= 3, 'indices must contain at least 3 entries');

assert(hasNamedIndex('NIFTY'), 'NIFTY index missing');
assert(
  hasNamedIndex('SENSEX') || hasNamedIndex('BANK'),
  'SENSEX or BANK NIFTY missing'
);

for (const [i, item] of snapshot.indices.entries()) {
  assert(item.name, `indices[${i}].name missing`);
  assert(item.value, `indices[${i}].value missing`);
  assertNumericLike(item.value, `indices[${i}].value`);
}

const ts = parseTs(snapshot.fetchedAt || snapshot.generatedAt || snapshot.generated_at);
assert(ts, 'freshness timestamp invalid');

const ageHours = (Date.now() - ts) / 36e5;
assert(
  ageHours <= MAX_AGE_HOURS_FOR_SNAPSHOT,
  `snapshot too stale: ${ageHours.toFixed(1)}h old; max allowed ${MAX_AGE_HOURS_FOR_SNAPSHOT}h`
);

assert(snapshot.sourceHealth && typeof snapshot.sourceHealth === 'object', 'sourceHealth missing');

const sections = {
  globalIndices: snapshot.globalIndices?.length || 0,
  gainers: snapshot.movers?.gainers?.length || 0,
  losers: snapshot.movers?.losers?.length || 0,
  sectorals: snapshot.sectorals?.length || 0,
  commodities: snapshot.commodities?.length || 0,
  currencies: snapshot.currencies?.length || 0,
  mutualFunds: snapshot.mutualFunds?.length || 0,
};

const warnings = [];

if (sections.globalIndices === 0) warnings.push('globalIndices section empty');
if (sections.commodities === 0) warnings.push('commodities section empty');
if (sections.currencies === 0) warnings.push('currencies section empty');
if (sections.sectorals === 0) warnings.push('sectorals section empty');
if (sections.mutualFunds === 0) warnings.push('mutualFunds section empty');

console.log(JSON.stringify({
  status: 'PASS',
  schemaVersion: snapshot.schemaVersion,
  generatedAt: snapshot.generatedAt || snapshot.generated_at,
  fetchedAt: snapshot.fetchedAt || null,
  ageHours: Number(ageHours.toFixed(2)),
  indices: snapshot.indices.length,
  sections,
  warnings
}, null, 2));

console.log('PASS: market snapshot integrity');
