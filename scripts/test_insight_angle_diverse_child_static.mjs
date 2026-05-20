import { existsSync } from 'fs';
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(existsSync('src/insight/src/tree/angleDiverseChildSelection.ts'), 'Missing angleDiverseChildSelection.ts');
assert(existsSync('src/insight/src/tree/angleDiverseChildSelection.cert.test.ts'), 'Missing test');
console.log(JSON.stringify({ status: 'PASS', checked: 'insight-angle-diverse-child' }, null, 2));
console.log('PASS: Angle-diverse child selection static');
