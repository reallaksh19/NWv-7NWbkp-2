const fs = require('fs');

// Create the target src/insight/src structure
const base = 'src/insight/src';
fs.mkdirSync(`${base}/types`, { recursive: true });
fs.mkdirSync(`${base}/pipeline`, { recursive: true });
fs.mkdirSync(`${base}/dedup`, { recursive: true });
fs.mkdirSync(`${base}/cluster`, { recursive: true });
fs.mkdirSync(`${base}/ranking`, { recursive: true });
fs.mkdirSync(`${base}/tree`, { recursive: true });
fs.mkdirSync(`${base}/cache`, { recursive: true });

// Move files into their proper places
const moves = [
  { from: 'src/insight/index.ts', to: `${base}/types/index.ts` },
  { from: 'src/insight/pipeline.ts', to: `${base}/pipeline/pipeline.ts` },
  { from: 'src/insight/normalize.ts', to: `${base}/pipeline/normalize.ts` },
  { from: 'src/insight/dedup.ts', to: `${base}/dedup/dedup.ts` },
  { from: 'src/insight/cluster.ts', to: `${base}/cluster/cluster.ts` },
  { from: 'src/insight/ranking.ts', to: `${base}/ranking/ranking.ts` },
  { from: 'src/insight/treeBuilder.ts', to: `${base}/tree/treeBuilder.ts` },
  { from: 'src/insight/cacheManager.ts', to: `${base}/cache/cacheManager.ts` },
  { from: 'src/insight/mnt/user-data/outputs/insight/src/index.ts', to: `${base}/index.ts` }
];

moves.forEach(({ from, to }) => {
  if (fs.existsSync(from)) {
    fs.renameSync(from, to);
    console.log(`Moved ${from} to ${to}`);
  }
});
