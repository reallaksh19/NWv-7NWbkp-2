import fs from 'node:fs';
import crypto from 'node:crypto';

const NEWSDATA_DIR = 'public/newsdata';
const DIST_NEWSDATA_DIR = 'dist/newsdata';
const MANIFEST_PATH = `${DIST_NEWSDATA_DIR}/pages_data_manifest.json`;

function readJson(path, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function hashFile(path) {
  if (!fs.existsSync(path)) return '';

  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path))
    .digest('hex')
    .slice(0, 16);
}

function fileInfo(name) {
  const sourcePath = `${NEWSDATA_DIR}/${name}`;
  const distPath = `${DIST_NEWSDATA_DIR}/${name}`;

  return {
    name,
    sourceExists: fs.existsSync(sourcePath),
    distExists: fs.existsSync(distPath),
    sourceHash: hashFile(sourcePath),
    distHash: hashFile(distPath),
    matched: hashFile(sourcePath) === hashFile(distPath),
  };
}

function main() {
  if (!fs.existsSync(DIST_NEWSDATA_DIR)) {
    fs.mkdirSync(DIST_NEWSDATA_DIR, { recursive: true });
  }

  const insight = readJson(`${NEWSDATA_DIR}/insight_latest.json`, {});
  const sections = readJson(`${NEWSDATA_DIR}/sections_latest.json`, {});
  const prefetchManifest = readJson(`${NEWSDATA_DIR}/prefetch_commit_manifest.json`, {});
  const qualityReport = readJson(`${NEWSDATA_DIR}/insight_quality_report.json`, {});

  const files = [
    'insight_latest.json',
    'sections_latest.json',
    'source_health.json',
    'prefetch_commit_manifest.json',
    'insight_quality_report.json',
    'insight_quality_summary.md',
  ].map(fileInfo);

  const manifest = {
    schemaVersion: 1,
    manifestVersion: 'pages-data-publish-v1',
    generatedAt: new Date().toISOString(),
    insight: {
      schemaVersion: insight.schemaVersion || 0,
      collectorVersion: insight.collectorVersion || '',
      contentHash: insight.contentHash || '',
      storyCount: Array.isArray(insight.stories) ? insight.stories.length : 0,
      fetchedAt: insight.fetchedAt || 0,
    },
    sections: {
      schemaVersion: sections.schemaVersion || 0,
      contentHash: sections.contentHash || '',
    },
    quality: {
      status: qualityReport.status || '',
      storyCount: qualityReport.storyCount || 0,
      sourceGroupCount: qualityReport.sourceGroupCount || 0,
      angleHintCoverage: qualityReport.angleHintCoverage || 0,
    },
    prefetchCommit: {
      shouldCommit: Boolean(prefetchManifest.shouldCommit),
      diagnosticOnly: Boolean(prefetchManifest.diagnosticOnly),
      changedContentFiles: prefetchManifest.changedContentFiles || [],
    },
    files,
    allTrackedFilesMatched: files
      .filter(file => file.sourceExists)
      .every(file => file.distExists && file.matched),
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(JSON.stringify({
    status: manifest.allTrackedFilesMatched ? 'PASS' : 'WARN',
    manifestPath: MANIFEST_PATH,
    insightContentHash: manifest.insight.contentHash,
    allTrackedFilesMatched: manifest.allTrackedFilesMatched,
  }, null, 2));

  if (!manifest.files.find(file => file.name === 'insight_latest.json')?.distExists) {
    throw new Error('dist/newsdata/insight_latest.json missing after build');
  }
}

main();
