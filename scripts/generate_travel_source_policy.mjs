import fs from 'fs';
import path from 'path';
import {
  buildAllTravelNewsSourcePolicies,
} from '../src/services/travelNewsQueries.js';

const outDir = path.join(process.cwd(), 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

const policies = buildAllTravelNewsSourcePolicies();

const index = {
  schemaVersion: 1,
  type: 'travel-source-policy-index-generated',
  generatedAt: new Date().toISOString(),
  policies,
};

fs.writeFileSync(
  path.join(outDir, 'travel-source-policy.generated.json'),
  JSON.stringify(index, null, 2) + '\n',
  'utf8'
);

for (const policy of policies) {
  fs.writeFileSync(
    path.join(outDir, `travel-source-policy-${policy.generatedFor.key}.json`),
    JSON.stringify(policy, null, 2) + '\n',
    'utf8'
  );
}

console.log(JSON.stringify({
  status: 'PASS',
  generated: policies.map(policy => policy.generatedFor.key),
}, null, 2));
