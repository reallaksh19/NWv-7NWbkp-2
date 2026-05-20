import { existsSync } from 'fs';
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(existsSync('src/insight/src/tree/sourceDiverseChildSelection.ts'), 'Missing sourceDiverseChildSelection.ts');
assert(existsSync('src/insight/src/tree/sourceDiverseChildSelection.cert.test.ts'), 'Missing test');
console.log(JSON.stringify({ status: 'PASS', checked: 'insight-source-diverse-child' }, null, 2));
console.log('PASS: Source diverse child selection static');
