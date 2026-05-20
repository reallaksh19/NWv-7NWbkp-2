/**
 * Insight Benchmark Runner — validates pipeline accuracy against known data
 * Usage: import and call runInsightBenchmark() from browser console or test page
 */
import { buildInsightBenchmarkArticles, EXPECTED_OUTCOMES, CLUSTERS } from './insightBenchmark.js';

export async function runInsightBenchmark(pipelineFn) {
  const articles = buildInsightBenchmarkArticles();
  console.log(`[InsightBench] Starting with ${articles.length} articles`);

  const results = { pass: 0, fail: 0, warnings: [], errors: [], details: {} };

  // ── Step 1: Run pipeline ──────────────────────────────────────────────
  let pipelineResult;
  try {
    // pipelineFn should accept articles and return { parents, storiesById }
    pipelineResult = await pipelineFn(articles);
  } catch (e) {
    results.errors.push(`Pipeline crashed: ${e.message}`);
    return results;
  }

  const parents = pipelineResult?.parents || [];
  const storiesById = pipelineResult?.storiesById || new Map();
  console.log(`[InsightBench] Pipeline returned ${parents.length} clusters, ${storiesById.size} stories`);

  // ── Step 2: Check cluster count ───────────────────────────────────────
  const expected = EXPECTED_OUTCOMES.expectedClusters;
  const tolerance = 2;
  if (Math.abs(parents.length - expected) <= tolerance) {
    results.pass++;
    results.details.clusterCount = `PASS: ${parents.length} clusters (expected ${expected} ±${tolerance})`;
  } else {
    results.fail++;
    results.details.clusterCount = `FAIL: ${parents.length} clusters (expected ${expected} ±${tolerance})`;
  }

  // ── Step 3: Check cluster purity ──────────────────────────────────────
  let correctAssignments = 0;
  let totalAssignments = 0;

  for (const parent of parents) {
    const storyIds = parent.clusterStoryIds || [];
    const clusterArticles = storyIds.map(id => {
      const story = storiesById.get(id);
      // Find original benchmark article by matching title
      if (!story) return null;
      const benchArticle = articles.find(a => a.title === story.title || a.id === story.id);
      return benchArticle;
    }).filter(Boolean);

    // Find majority expected cluster
    const clusterVotes = {};
    for (const art of clusterArticles) {
      const expected = art._expectedCluster || 'UNKNOWN';
      clusterVotes[expected] = (clusterVotes[expected] || 0) + 1;
    }

    const sortedVotes = Object.entries(clusterVotes).sort((a, b) => b[1] - a[1]);
    if (sortedVotes.length > 0) {
      const majorityCount = sortedVotes[0][1];
      correctAssignments += majorityCount;
      totalAssignments += clusterArticles.length;
    }
  }

  const purity = totalAssignments > 0 ? correctAssignments / totalAssignments : 0;
  const purityTarget = EXPECTED_OUTCOMES.accuracyTargets.clusterPurity;
  if (purity >= purityTarget) {
    results.pass++;
    results.details.purity = `PASS: ${(purity * 100).toFixed(1)}% purity (target ${purityTarget * 100}%)`;
  } else {
    results.fail++;
    results.details.purity = `FAIL: ${(purity * 100).toFixed(1)}% purity (target ${purityTarget * 100}%)`;
  }

  // ── Step 4: Check duplicate detection ─────────────────────────────────
  const dupChecks = EXPECTED_OUTCOMES.clusterChecks;
  let dupsFound = 0;
  let dupsExpected = 0;
  for (const [, check] of Object.entries(dupChecks)) {
    if (!check.duplicatePairs) continue;
    for (const [title1, title2] of check.duplicatePairs) {
      dupsExpected++;
      // Check if both titles ended up as the same story (merged) or in same cluster
      const story1 = [...storiesById.values()].find(s => s.title?.includes(title1.slice(0, 30)));
      const story2 = [...storiesById.values()].find(s => s.title?.includes(title2.slice(0, 30)));
      if (!story1 || !story2) {
        dupsFound++; // one was deduped (removed)
      } else {
        // Check if in same parent
        const parent1 = parents.find(p => p.clusterStoryIds.includes(story1.id));
        const parent2 = parents.find(p => p.clusterStoryIds.includes(story2.id));
        if (parent1 && parent2 && parent1.parentId === parent2.parentId) dupsFound++;
      }
    }
  }

  const dedupRecall = dupsExpected > 0 ? dupsFound / dupsExpected : 1;
  if (dedupRecall >= EXPECTED_OUTCOMES.accuracyTargets.deduplicationRecall) {
    results.pass++;
    results.details.dedup = `PASS: ${(dedupRecall * 100).toFixed(0)}% dedup recall`;
  } else {
    results.fail++;
    results.details.dedup = `FAIL: ${(dedupRecall * 100).toFixed(0)}% dedup recall`;
  }

  // ── Step 5: Check noise filtering ─────────────────────────────────────
  const noiseArticles = articles.filter(a => a._expectedCluster === 'NOISE');
  let noiseInClusters = 0;
  for (const noise of noiseArticles) {
    const inAnyCluster = parents.some(p =>
      p.clusterStoryIds.some(id => {
        const story = storiesById.get(id);
        return story && story.title === noise.title;
      })
    );
    if (inAnyCluster) noiseInClusters++;
  }
  const noiseFilterRate = noiseArticles.length > 0 ? 1 - (noiseInClusters / noiseArticles.length) : 1;
  if (noiseFilterRate >= EXPECTED_OUTCOMES.accuracyTargets.noiseFilterRate) {
    results.pass++;
    results.details.noise = `PASS: ${(noiseFilterRate * 100).toFixed(0)}% noise filtered`;
  } else {
    results.fail++;
    results.details.noise = `FAIL: ${(noiseFilterRate * 100).toFixed(0)}% noise filtered (${noiseInClusters}/${noiseArticles.length} leaked)`;
  }

  // ── Summary ───────────────────────────────────────────────────────────
  results.summary = `${results.pass}/${results.pass + results.fail} checks passed`;
  console.log(`[InsightBench] ${results.summary}`);
  console.table(results.details);
  return results;
}
