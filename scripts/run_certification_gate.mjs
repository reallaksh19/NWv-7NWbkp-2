import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const manifestPath = new URL('./certification_manifest.json', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (!Array.isArray(manifest.commands) || manifest.commands.length === 0) {
  throw new Error('certification_manifest.json has no commands[]');
}

const commands = manifest.commands.map(entry => {
  if (!entry.id || !entry.cmd || !Array.isArray(entry.args)) {
    throw new Error(`Invalid certification manifest entry: ${JSON.stringify(entry)}`);
  }

  return [entry.id, entry.cmd, entry.args];
});

const results = [];

for (const [id, cmd, args] of commands) {
  const label = `${cmd} ${args.join(' ')}`;

  console.log(`\n\nCERTIFICATION STEP [${id}]: ${label}`);
  console.log('='.repeat(80));

  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const ok = result.status === 0;

  results.push({
    id,
    command: label,
    status: ok ? 'PASS' : 'FAIL',
    exitCode: result.status,
  });

  if (!ok) {
    console.error(`\nCERTIFICATION FAILED [${id}]: ${label}`);
    console.error(JSON.stringify({
      status: 'FAIL',
      failedStepId: id,
      failedCommand: label,
      manifestVersion: manifest.manifestVersion,
      results,
    }, null, 2));
    process.exit(result.status || 1);
  }
}

console.log('\n\nCERTIFICATION RESULT');
console.log('='.repeat(80));
console.log(JSON.stringify({
  status: 'PASS',
  checked: 'NWv-7 full certification gate',
  manifestVersion: manifest.manifestVersion,
  commandCount: commands.length,
  results,
}, null, 2));

console.log('PASS: Full certification gate');
