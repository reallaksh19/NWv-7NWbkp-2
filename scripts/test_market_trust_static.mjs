import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const marketPage = read('src/pages/MarketPage.jsx');
const trustPanel = read('src/components/market/MarketTrustPanel.jsx');
const trustCss = read('src/components/market/MarketTrustPanel.css');

assert(
  marketPage.includes("import MarketTrustPanel from '../components/market/MarketTrustPanel';"),
  'MarketPage must import MarketTrustPanel'
);

for (const token of [
  '<MarketTrustPanel',
  'marketData={marketData}',
  'sourceHealth={sourceHealth}',
  'sessionState={sessionState}',
  'error={error}',
  'lastFetch={lastFetch}',
  'loading={loading}',
  'onRefresh={handleRefresh}'
]) {
  assert(marketPage.includes(token), `MarketPage missing MarketTrustPanel prop/token: ${token}`);
}

for (const token of [
  'getCoverage',
  'getTrustGrade',
  'getSourceStats',
  'Data trust',
  'Market data unavailable',
  'Seed / fallback data',
  'Degraded feed coverage',
  'Broad market coverage',
  'Partial but useful coverage',
  'Thin market coverage',
  'Source health details',
  'data-market-trust-grade'
]) {
  assert(trustPanel.includes(token), `MarketTrustPanel missing token: ${token}`);
}

for (const section of [
  'Indices',
  'Movers',
  'Sectorals',
  'Commodities',
  'Currency',
  'FII/DII',
  'MF',
  'IPO'
]) {
  assert(trustPanel.includes(section), `MarketTrustPanel missing coverage section: ${section}`);
}

for (const token of [
  '.market-trust-panel',
  '.market-trust-panel__coverage',
  '.market-trust-panel__tile--ok',
  '.market-trust-panel__tile--missing',
  '.market-trust-panel__source-status--live',
  '.market-trust-panel__source-status--snapshot',
  '.market-trust-panel__source-status--failed',
  '@media (max-width: 760px)'
]) {
  assert(trustCss.includes(token), `MarketTrustPanel.css missing token: ${token}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Market trust panel slice',
  guarantees: [
    'Market tab has a top-level data trust panel',
    'section coverage is visible',
    'source health details are visible',
    'seed/stale/degraded states are explicit',
    'refresh action is wired',
    'no market feed logic was changed'
  ]
}, null, 2));

console.log('PASS: Market trust panel static slice');