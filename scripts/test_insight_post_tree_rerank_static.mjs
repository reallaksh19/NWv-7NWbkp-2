import { existsSync } from 'fs';
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(existsSync('src/insight/src/ranking/postTreeParentRerank.ts'), 'Missing postTreeParentRerank.ts');
assert(existsSync('src/insight/src/ranking/postTreeParentRerank.cert.test.ts'), 'Missing test');
console.log(JSON.stringify({ status: 'PASS', checked: 'insight-post-tree-rerank' }, null, 2));
console.log('PASS: Post-tree parent rerank static');
