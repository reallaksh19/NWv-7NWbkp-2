import stringSimilarity from 'string-similarity';

export const DEFAULT_STORY_DEDUPE_OPTIONS = {
    similarityThreshold: 0.82,
    secondarySimilarityThreshold: 0.58,
    tokenOverlapThreshold: 0.5,
    strongTokenOverlapThreshold: 0.52,
    minimumSharedTokens: 3,
    strongSharedTokens: 4,
    maxFingerprintTokens: 8,
    ignoredTokens: [
        'a', 'an', 'and', 'are', 'at', 'be', 'between', 'by', 'for', 'from', 'how',
        'in', 'into', 'is', 'it', 'of', 'on', 'or', 'the', 'this', 'that', 'to',
        'was', 'were', 'with', 'who', 'why', 'will',
        'alert', 'analysis', 'breaking', 'coverage', 'details', 'exclusive', 'explainer',
        'headline', 'highlights', 'latest', 'live', 'news', 'photos', 'preview',
        'prediction', 'predictions', 'report', 'reports', 'story', 'today', 'todays',
        'update', 'updates', 'video', 'watch',
        'expected', 'likely', 'lineup', 'lineups', 'match', 'playing', 'win', 'winner',
        'winners', 'xis', 'xi'
    ]
};

function resolveDedupeOptions(options = {}) {
    if (typeof options === 'number') {
        return {
            ...DEFAULT_STORY_DEDUPE_OPTIONS,
            similarityThreshold: options
        };
    }

    return {
        ...DEFAULT_STORY_DEDUPE_OPTIONS,
        ...(options || {}),
        ignoredTokens: Array.isArray(options?.ignoredTokens) && options.ignoredTokens.length > 0
            ? options.ignoredTokens
            : DEFAULT_STORY_DEDUPE_OPTIONS.ignoredTokens
    };
}

function normalizeComparableText(text = '') {
    return String(text || '')
        .toLowerCase()
        .replace(/&amp;/g, ' and ')
        .replace(/['’]/g, '')
        .replace(/\b(v\/s|versus)\b/g, ' vs ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeComparableText(text, options) {
    const ignored = new Set((options?.ignoredTokens || []).map(token => String(token).toLowerCase()));

    return normalizeComparableText(text)
        .split(' ')
        .map(token => token.trim())
        .filter(Boolean)
        .filter(token => token === 'vs' || token.length > 1)
        .filter(token => !ignored.has(token))
        .filter(token => !/^20\d{2}$/.test(token));
}

function getItemTitle(item) {
    return String(item?.title || item?.headline || '').trim();
}

function getItemDescription(item) {
    return String(item?.description || item?.summary || item?.text || '').trim();
}

function getItemIdentity(item) {
    return String(item?.hiddenKey || item?.canonicalId || item?.id || item?.link || item?.url || '')
        .trim()
        .toLowerCase();
}

function getItemSourceList(item) {
    const nestedSources = Array.isArray(item?.allSources) ? item.allSources : [];
    const directSource = item?.source ? [item.source] : [];

    return [...new Set(
        [...nestedSources, ...directSource]
            .map(source => String(source || '').trim())
            .filter(Boolean)
    )];
}

function getStoryScore(item) {
    const score = Number(item?.impactScore ?? item?._forwardScore ?? item?.breakingScore ?? 0);
    return Number.isFinite(score) ? score : 0;
}

function getStoryTimestamp(item) {
    const candidates = [
        item?.publishedAt,
        item?.pubDate,
        item?.extractedDate,
        item?.planDate,
        item?.date,
        item?.releaseDate
    ];

    for (const candidate of candidates) {
        if (candidate == null) continue;

        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            return candidate;
        }

        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.getTime();
        }
    }

    return 0;
}

function buildFingerprint(tokens, options) {
    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length < Math.max(2, options.minimumSharedTokens - 1)) {
        return '';
    }

    return uniqueTokens
        .slice()
        .sort((a, b) => b.length - a.length || a.localeCompare(b))
        .slice(0, options.maxFingerprintTokens)
        .sort()
        .join('|');
}

function prepareStory(item, options) {
    const title = getItemTitle(item);
    const description = getItemDescription(item);
    let coreTokens = tokenizeComparableText(title, options);

    if (coreTokens.length < options.minimumSharedTokens && description) {
        const descriptionTokens = tokenizeComparableText(description, options)
            .slice(0, options.maxFingerprintTokens);
        coreTokens = [...coreTokens, ...descriptionTokens];
    }

    const uniqueTokens = [...new Set(coreTokens)];

    return {
        item,
        title,
        description,
        identity: getItemIdentity(item),
        coreTitle: coreTokens.join(' ').trim() || normalizeComparableText(title),
        tokenSet: new Set(uniqueTokens),
        fingerprint: buildFingerprint(coreTokens, options),
        sources: getItemSourceList(item),
        score: getStoryScore(item),
        timestamp: getStoryTimestamp(item)
    };
}

export function compareStorySimilarity(leftItem, rightItem, options = {}) {
    const config = resolveDedupeOptions(options);
    const left = prepareStory(leftItem, config);
    const right = prepareStory(rightItem, config);

    const sameIdentity = Boolean(left.identity) && left.identity === right.identity;
    const sameLink = Boolean(leftItem?.link && rightItem?.link) && leftItem.link === rightItem.link;

    const sharedTokens = [...left.tokenSet].filter(token => right.tokenSet.has(token));
    const sharedTokenCount = sharedTokens.length;
    const tokenOverlap = (left.tokenSet.size > 0 && right.tokenSet.size > 0)
        ? (2 * sharedTokenCount) / (left.tokenSet.size + right.tokenSet.size)
        : 0;
    const titleSimilarity = (left.coreTitle && right.coreTitle)
        ? stringSimilarity.compareTwoStrings(left.coreTitle, right.coreTitle)
        : 0;
    const fingerprintMatch = Boolean(left.fingerprint) && left.fingerprint === right.fingerprint;

    const strongTokenMatch = sharedTokenCount >= config.strongSharedTokens &&
        tokenOverlap >= config.strongTokenOverlapThreshold;
    const balancedMatch = sharedTokenCount >= config.minimumSharedTokens &&
        tokenOverlap >= config.tokenOverlapThreshold &&
        titleSimilarity >= config.secondarySimilarityThreshold;

    const isDuplicate = sameIdentity ||
        sameLink ||
        (fingerprintMatch && sharedTokenCount >= config.minimumSharedTokens) ||
        titleSimilarity >= config.similarityThreshold ||
        strongTokenMatch ||
        balancedMatch;

    let reason = 'none';
    if (sameIdentity || sameLink) reason = 'identity';
    else if (fingerprintMatch && sharedTokenCount >= config.minimumSharedTokens) reason = 'fingerprint';
    else if (titleSimilarity >= config.similarityThreshold) reason = 'title_similarity';
    else if (strongTokenMatch) reason = 'token_overlap';
    else if (balancedMatch) reason = 'hybrid_match';

    return {
        isDuplicate,
        reason,
        titleSimilarity,
        tokenOverlap,
        sharedTokenCount,
        sharedTokens
    };
}

export function isLikelyDuplicateStory(leftItem, rightItem, options = {}) {
    return compareStorySimilarity(leftItem, rightItem, options).isDuplicate;
}

/**
 * Cluster similar articles by cleaned-title similarity and token overlap.
 * Returns array of clusters, where each cluster contains related stories.
 */
export const clusterSimilarArticles = (articles, options = {}) => {
    if (!articles || articles.length === 0) return [];

    const config = resolveDedupeOptions(options);
    const clusters = [];

    for (const article of articles) {
        let matchedCluster = null;

        for (const cluster of clusters) {
            if (cluster.some(existing => isLikelyDuplicateStory(existing, article, config))) {
                matchedCluster = cluster;
                break;
            }
        }

        if (matchedCluster) {
            matchedCluster.push(article);
        } else {
            clusters.push([article]);
        }
    }

    return clusters;
};

function selectRepresentative(cluster) {
    return [...cluster].sort((left, right) => {
        const scoreDiff = getStoryScore(right) - getStoryScore(left);
        if (scoreDiff !== 0) return scoreDiff;

        const sourceDiff = getItemSourceList(right).length - getItemSourceList(left).length;
        if (sourceDiff !== 0) return sourceDiff;

        const timeDiff = getStoryTimestamp(right) - getStoryTimestamp(left);
        if (timeDiff !== 0) return timeDiff;

        return (getItemTitle(left).length || Infinity) - (getItemTitle(right).length || Infinity);
    })[0];
}

function pickBestDescription(cluster, representative) {
    const descriptions = cluster
        .map(item => String(item?.description || item?.summary || item?.text || '').trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length);

    return descriptions[0] || representative?.description || representative?.summary || representative?.text || '';
}

function getUnionSources(cluster) {
    return [...new Set(
        cluster.flatMap(item => getItemSourceList(item))
    )];
}

function getConsensusAdjustedScore(representative, sourceCount) {
    const representativeScore = getStoryScore(representative);
    const existingSourceCount = Math.max(1, representative?.sourceCount || getItemSourceList(representative).length || 1);
    const existingBoost = 1 + ((existingSourceCount - 1) * 0.1);
    const baseScore = representative?.clusterRepresentative
        ? representativeScore / existingBoost
        : representativeScore;
    const newBoost = 1 + ((Math.max(1, sourceCount) - 1) * 0.1);

    return baseScore * newBoost;
}

/**
 * Merge a cluster of articles into a single representative item.
 * Keeps the strongest article, aggregates source info, and applies
 * a consensus boost based on the total source union.
 */
export const mergeCluster = (cluster) => {
    if (!cluster || cluster.length === 0) return null;

    const representative = selectRepresentative(cluster);
    const sources = getUnionSources(cluster);
    const sourceCount = Math.max(1, sources.length);
    const description = pickBestDescription(cluster, representative);

    return {
        ...representative,
        description,
        summary: representative?.summary || description,
        sourceCount,
        allSources: sources,
        clusteredItems: cluster.length,
        impactScore: getConsensusAdjustedScore(representative, sourceCount),
        clusterRepresentative: true
    };
};

function mergePlanningCluster(cluster) {
    if (!cluster || cluster.length === 0) return null;

    const representative = selectRepresentative(cluster);
    const sources = getUnionSources(cluster);
    const description = pickBestDescription(cluster, representative);

    return {
        ...representative,
        description,
        sourceCount: Math.max(1, sources.length || representative?.sourceCount || 1),
        allSources: sources,
        clusteredItems: cluster.length
    };
}

function exactDeduplicate(items) {
    const seen = new Set();
    const exactDeduped = [];

    for (const item of items || []) {
        const exactKey = getItemIdentity(item) ||
            String(item?.link || item?.url || normalizeComparableText(getItemTitle(item))).trim().toLowerCase();

        if (!exactKey || seen.has(exactKey)) continue;
        seen.add(exactKey);
        exactDeduped.push(item);
    }

    return exactDeduped;
}

/**
 * Deduplicate articles by exact identity first, then cluster related headlines.
 */
export const deduplicateAndCluster = (articles, options = {}) => {
    const exactDeduped = exactDeduplicate(articles);

    return clusterSimilarArticles(exactDeduped, options)
        .map(mergeCluster)
        .filter(Boolean);
};

/**
 * Deduplicate planner/timeline items while preserving the best representative
 * for each event-like story cluster.
 */
export const deduplicatePlanningItems = (items, options = {}) => {
    const exactDeduped = exactDeduplicate(items);

    return clusterSimilarArticles(exactDeduped, options)
        .map(mergePlanningCluster)
        .filter(Boolean);
};
