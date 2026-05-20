const SOURCE_OVERRIDES = [
    { match: /al jazeera/i, label: 'Al Jazeera' },
    { match: /the hollywood reporter/i, label: 'Hollywood' },
    { match: /hollywood reporter/i, label: 'Hollywood' },
    { match: /times of india|\btoi\b/i, label: 'TOI' },
    { match: /the hindu/i, label: 'Hindu' },
    { match: /india today/i, label: 'India Today' },
    { match: /oman observer/i, label: 'Observer' },
    { match: /moneycontrol/i, label: 'Moneycontrol' },
    { match: /reuters/i, label: 'Reuters' },
    { match: /bbc/i, label: 'BBC' },
    { match: /ndtv/i, label: 'NDTV' },
    { match: /variety/i, label: 'Variety' },
    { match: /deadline/i, label: 'Deadline' },
    { match: /behindwoods/i, label: 'Behindwoods' },
    { match: /filmibeat/i, label: 'Filmibeat' },
    { match: /hindustan times/i, label: 'HT' },
    { match: /the news minute/i, label: 'TNM' }
];

export function shortenSourceLabel(source) {
    if (!source) return 'Source';

    const cleaned = String(source)
        .replace(/\s*[-\u2013\u2014].*$/, '')
        .replace(/\s*-\s*breaking news.*$/i, '')
        .trim();

    for (const override of SOURCE_OVERRIDES) {
        if (override.match.test(cleaned)) {
            return override.label;
        }
    }

    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length <= 2) {
        return cleaned;
    }

    return words.slice(0, 2).join(' ');
}

export function getStoryUrl(item) {
    return item?.url || item?.link || item?.sourceUrl || item?.sourceLink || '';
}

export function buildStoryInfoText(item, { includeScoreBreakdown = false } = {}) {
    const storyUrl = getStoryUrl(item);
    const lines = [];

    if (item?.source) {
        lines.push(`Source: ${shortenSourceLabel(item.source)}`);
    }

    if (storyUrl) {
        lines.push(`Source Link: ${storyUrl}`);
    }

    if (item?.headline || item?.title) {
        lines.push(`Story: ${item.headline || item.title}`);
    }

    if (includeScoreBreakdown && item?._scoreBreakdown) {
        const b = item._scoreBreakdown;
        lines.push('');
        lines.push(`Ranking Score: ${Number(item.impactScore || 0).toFixed(2)}`);
        lines.push(`Freshness: ${Number(b.freshness || 0).toFixed(2)}`);
        lines.push(`Source Tier: ${Number(b.sourceScore || 0).toFixed(2)}`);
        lines.push(`Relevance Multiplier: ${Number(b.impact || 1).toFixed(2)}`);
        lines.push(`Live Boost: ${b.liveBoost || 1}`);
        lines.push(`Breaking Boost: ${b.breakingBoost || 1}`);
    }

    return lines.join('\n');
}
