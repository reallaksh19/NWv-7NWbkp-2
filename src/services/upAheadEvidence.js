const DEFAULT_SECTION_KEYS = [
  'movies',
  'events',
  'festivals',
  'alerts',
  'sports',
  'shopping',
  'civic',
  'weather_alerts',
  'airlines'
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function countItems(items) {
  return safeArray(items).filter(Boolean).length;
}

function getEnabledCategoryKeys(settings) {
  const categories = safeObject(settings?.upAhead?.categories);

  const enabled = Object.entries(categories)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);

  return enabled.length > 0 ? enabled : DEFAULT_SECTION_KEYS;
}

function getLocations(settings) {
  const locations = safeArray(settings?.upAhead?.locations)
    .map(location => String(location || '').trim())
    .filter(Boolean);

  return locations.length > 0 ? locations : ['Chennai'];
}

function getSectionCounts(data, sectionKeys) {
  const sections = safeObject(data?.sections);

  return sectionKeys.map(key => ({
    key,
    count: countItems(sections[key])
  }));
}

function getTimelineStats(data) {
  const timeline = safeArray(data?.timeline);
  const dayCount = timeline.length;
  const itemCount = timeline.reduce((sum, day) => sum + countItems(day?.items), 0);
  const populatedDayCount = timeline.filter(day => countItems(day?.items) > 0).length;

  return {
    dayCount,
    itemCount,
    populatedDayCount
  };
}

function getWeeklyPlanStats(data) {
  const weeklyPlan = safeArray(data?.weekly_plan);
  const dayCount = weeklyPlan.length;
  const itemCount = weeklyPlan.reduce((sum, day) => sum + countItems(day?.items), 0);
  const populatedDayCount = weeklyPlan.filter(day => countItems(day?.items) > 0).length;

  return {
    dayCount,
    itemCount,
    populatedDayCount
  };
}

function getSourceModeLabel(data) {
  const sourceMode = data?.sourceMode || 'unknown';

  if (sourceMode === 'snapshot') return 'Snapshot';
  if (sourceMode === 'cache') return 'Cached';
  if (sourceMode === 'live') return 'Live';
  if (sourceMode === 'merged') return 'Merged';
  if (sourceMode === 'degraded') return 'Limited';

  return String(sourceMode).replace(/^\w/, char => char.toUpperCase());
}

function getQualityStatus(score) {
  if (score >= 74) return 'strong';
  if (score >= 45) return 'partial';
  return 'thin';
}

function getQualityTitle(status) {
  if (status === 'strong') return 'Up Ahead coverage is strong';
  if (status === 'partial') return 'Up Ahead coverage is usable';
  return 'Up Ahead coverage is thin';
}

export function getUpAheadEvidence({ data, settings, visible = {} }) {
  const sectionKeys = getEnabledCategoryKeys(settings);
  const locations = getLocations(settings);
  const sectionCounts = getSectionCounts(data, sectionKeys);
  const timelineStats = getTimelineStats(data);
  const weeklyPlanStats = getWeeklyPlanStats(data);

  const coveredSections = sectionCounts.filter(section => section.count > 0);
  const missingSections = sectionCounts.filter(section => section.count === 0);

  const visibleOfferCount = countItems(visible.offerItems);
  const visibleAlertCount = countItems(visible.combinedAlerts);
  const visibleWeatherAlertCount = countItems(visible.weatherAlerts);
  const visibleMovieCount = countItems(visible.movieCards);
  const visibleFestivalCount = countItems(visible.festivalCards);

  const totalSectionItems = sectionCounts.reduce((sum, section) => sum + section.count, 0);
  const totalVisibleItems =
    totalSectionItems +
    timelineStats.itemCount +
    weeklyPlanStats.itemCount;

  const categoryCoverageRatio = coveredSections.length / Math.max(1, sectionKeys.length);
  const timelineCoverageRatio = timelineStats.dayCount > 0
    ? timelineStats.populatedDayCount / timelineStats.dayCount
    : 0;
  const planCoverageRatio = weeklyPlanStats.dayCount > 0
    ? weeklyPlanStats.populatedDayCount / weeklyPlanStats.dayCount
    : 0;

  const qualityScore = Math.round(
    Math.min(30, categoryCoverageRatio * 30) +
    Math.min(20, timelineCoverageRatio * 20) +
    Math.min(20, planCoverageRatio * 20) +
    Math.min(10, locations.length * 5) +
    Math.min(10, visibleOfferCount * 2) +
    Math.min(10, visibleAlertCount * 2)
  );

  const status = getQualityStatus(qualityScore);
  const notes = [];

  if (coveredSections.length === 0) {
    notes.push('No enabled category has visible items.');
  } else {
    notes.push(`${coveredSections.length}/${sectionKeys.length} enabled categories have visible items.`);
  }

  if (timelineStats.itemCount > 0) {
    notes.push(`${timelineStats.itemCount} timeline item(s) available.`);
  } else {
    notes.push('Timeline is empty.');
  }

  if (weeklyPlanStats.itemCount > 0) {
    notes.push(`${weeklyPlanStats.itemCount} suggested plan item(s) available.`);
  } else {
    notes.push('Suggested plan has no visible items.');
  }

  if (visibleWeatherAlertCount > 0) {
    notes.push(`${visibleWeatherAlertCount} weather alert(s) passed alert filtering.`);
  }

  if (visibleOfferCount > 0) {
    notes.push(`${visibleOfferCount} offer item(s) passed offer filtering.`);
  }

  if (missingSections.length > 0) {
    notes.push(`Missing: ${missingSections.slice(0, 5).map(section => section.key).join(', ')}${missingSections.length > 5 ? '…' : ''}.`);
  }

  return {
    status,
    title: getQualityTitle(status),
    qualityScore,
    sourceMode: data?.sourceMode || 'unknown',
    sourceModeLabel: getSourceModeLabel(data),
    locations,
    locationCount: locations.length,
    enabledCategories: sectionKeys,
    coveredCategories: coveredSections.map(section => section.key),
    missingCategories: missingSections.map(section => section.key),
    sectionCounts,
    totalSectionItems,
    totalVisibleItems,
    timelineStats,
    weeklyPlanStats,
    visibleOfferCount,
    visibleAlertCount,
    visibleWeatherAlertCount,
    visibleMovieCount,
    visibleFestivalCount,
    notes,
  };
}

export default getUpAheadEvidence;