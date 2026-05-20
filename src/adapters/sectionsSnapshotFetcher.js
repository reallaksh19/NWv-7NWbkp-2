const SECTION_SNAPSHOT_PATH = '/newsdata/sections_latest.json';
const SECTION_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

const SECTION_ALIASES = {
  chennai: 'tn',
  tamilnadu: 'tn',
  tamilNadu: 'tn',
  top: 'topStories',
  topstories: 'topStories',
};

let memorySnapshot = null;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function hash(value) {
  const text = String(value || '');
  let h = 0;
  for (let index = 0; index < text.length; index += 1) {
    h = (h << 5) - h + text.charCodeAt(index);
    h |= 0;
  }
  return String(h);
}

function normalizeSectionKey(section) {
  const key = String(section || '').trim();
  return SECTION_ALIASES[key] || SECTION_ALIASES[key.toLowerCase()] || key;
}

function isSupportedSectionsSnapshot(snapshot) {
  const schema = Number(snapshot?.schemaVersion || 0);
  return schema === 1 || schema === 2;
}

function sectionSnapshotAgeMs(snapshot) {
  return Math.max(0, Date.now() - Number(snapshot?.fetchedAt || 0));
}

function getSnapshotUrl() {
  const base = import.meta?.env?.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}${SECTION_SNAPSHOT_PATH}?v=${Date.now()}`;
}

function normalizePrefetchedSectionItem(item, requestedSection, sourceSection) {
  const title = safeText(item.title || item.headline, 'Untitled');
  const description = safeText(item.description || item.summary, '');
  const url = safeText(item.url || item.link || item.guid, '');
  const source = safeText(item.source || item.sourceGroup, 'Unknown');
  const publishedAt = Number(item.publishedAt || item.pubDate || item.date || Date.now());

  return {
    ...item,
    id: safeText(item.id || hash(url || title)),
    title,
    headline: title,
    description,
    summary: description,
    link: url,
    url,
    source,
    sourceGroup: safeText(item.sourceGroup || source, source),
    publishedAt,
    fetchedAt: Number(item.fetchedAt || Date.now()),
    time: new Date(publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    section: requestedSection,
    sourceSection,
    impactScore: Number(item.impactScore || 0),
    imageUrl: item.imageUrl || item.image || null,
    _prefetchedSection: true,
  };
}

export function getSectionsSnapshotRuntimeSummary(snapshot) {
  const sections = snapshot?.sections && typeof snapshot.sections === 'object'
    ? snapshot.sections
    : {};

  return {
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    supported: isSupportedSectionsSnapshot(snapshot),
    fetchedAt: Number(snapshot?.fetchedAt || 0),
    ageMs: sectionSnapshotAgeMs(snapshot),
    contentHash: snapshot?.contentHash || '',
    sectionCount: Object.keys(sections).length,
    totalStories: Object.values(sections).reduce((sum, items) => sum + safeArray(items).length, 0),
    hasSectionQuality: Boolean(snapshot?.sectionQuality),
    sectionQuality: snapshot?.sectionQuality || null,
  };
}

export async function loadSectionsSnapshot({ force = false } = {}) {
  if (!force && memorySnapshot && Date.now() - memorySnapshot.loadedAt < SECTION_SNAPSHOT_TTL_MS) {
    return memorySnapshot.snapshot;
  }

  const response = await fetch(getSnapshotUrl(), {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`sections snapshot fetch failed: HTTP ${response.status}`);
  }

  const snapshot = await response.json();

  if (!isSupportedSectionsSnapshot(snapshot)) {
    throw new Error(`unsupported sections snapshot schema: ${snapshot?.schemaVersion}`);
  }

  memorySnapshot = {
    loadedAt: Date.now(),
    snapshot,
  };

  return snapshot;
}

export function selectPrefetchedSectionItems(snapshot, section, limit = 10) {
  if (!isSupportedSectionsSnapshot(snapshot)) {
    return {
      items: [],
      sourceSection: normalizeSectionKey(section),
      quality: null,
      summary: getSectionsSnapshotRuntimeSummary(snapshot),
    };
  }

  const requestedSection = String(section || '');
  const sourceSection = normalizeSectionKey(section);
  const sectionItems = safeArray(snapshot?.sections?.[sourceSection]);

  const items = sectionItems
    .map(item => normalizePrefetchedSectionItem(item, requestedSection, sourceSection))
    .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0))
    .slice(0, Math.max(0, Number(limit || 0)));

  return {
    items,
    sourceSection,
    quality: snapshot?.sectionQuality?.[sourceSection] || null,
    summary: getSectionsSnapshotRuntimeSummary(snapshot),
  };
}

export async function fetchPrefetchedSectionNews(section, limit = 10) {
  const snapshot = await loadSectionsSnapshot();
  return selectPrefetchedSectionItems(snapshot, section, limit);
}

export function clearSectionsSnapshotCache() {
  memorySnapshot = null;
}

export default fetchPrefetchedSectionNews;
