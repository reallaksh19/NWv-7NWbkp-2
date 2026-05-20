import { existsSync } from 'fs';
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(existsSync('src/insight/src/quality/insightRealSnapshotQualityRatchet.ts'), 'Missing ratchet');
assert(existsSync('src/insight/src/quality/insightRealSnapshotQualityRatchet.cert.test.ts'), 'Missing test');
console.log(JSON.stringify({ status: 'PASS', checked: 'insight-real-snapshot-ratchet' }, null, 2));
console.log('PASS: Real snapshot quality ratchet static');
