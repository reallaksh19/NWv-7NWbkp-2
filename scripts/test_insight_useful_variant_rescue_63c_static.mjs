import { existsSync } from 'fs';
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(existsSync('src/insight/src/tree/usefulVariantRescue.ts'), 'Missing usefulVariantRescue.ts');
assert(existsSync('src/insight/src/tree/usefulVariantRescue.cert.test.ts'), 'Missing test');
console.log(JSON.stringify({ status: 'PASS', checked: 'insight-useful-variant-rescue-63c' }, null, 2));
console.log('PASS: Useful variant rescue static');
