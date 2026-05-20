/**
 * Calculates impact score based on:
 * 1. Geographic scale (global > national > regional > local)
 * 2. Population magnitude (millions > thousands > individuals)
 * 3. User-defined High Impact Keywords (New)
 */
export function calculateImpactScore(title, description, settings) {
    const text = `${title} ${description}`.toLowerCase();

    // 1. Scale Detection
    let scaleScore = 1.0;
    if (/\b(world|international|global|planet|earth|un|united nations)\b/.test(text)) {
        scaleScore = 1.5; // Global
    } else if (/\b(india|country|nation|nationwide|federal|central govt|modi|parliament)\b/.test(text)) {
        scaleScore = 1.3; // National
    } else if (/\b(state|tamil nadu|kerala|karnataka|region|district)\b/.test(text)) {
        scaleScore = 1.1; // Regional
    }

    // 2. Magnitude Detection (Population/Financial Impact)
    let magnitudeScore = 1.0;

    // Billions/Trillions
    if (/\b(billions?|trillions?)\b/.test(text)) {
        magnitudeScore = 1.5;
    }
    // Millions / Lakhs / Crores
    else if (/\b(millions?|lakhs?|crores?)\b/.test(text)) {
        magnitudeScore = 1.3;
    }
    // Thousands
    else if (/\b(thousands?|hundreds of thousands?)\b/.test(text)) {
        magnitudeScore = 1.1;
    }

    // 3. High Impact Keyword Detection (Settings Driven)
    let keywordMultiplier = 1.0;
    if (settings && settings.highImpactKeywords && Array.isArray(settings.highImpactKeywords)) {
        const hasMatch = settings.highImpactKeywords.some(keyword => {
            if (!keyword) return false;
            // Case-insensitive match, word boundary check recommended
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
            return regex.test(text);
        });

        if (hasMatch) {
            // Use configured boost or default to 2.5
            keywordMultiplier = settings.rankingWeights?.impact?.highImpactBoost || 2.5;
        }
    }

    // Combined multiplier (Base 1.0, max ~2.25 * keywordMultiplier)
    return scaleScore * magnitudeScore * keywordMultiplier;
}
