const STORAGE_KEY = 'upAhead_ingestion_checkpoints';

function hash(value) {
  let h = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function canonicalizeLink(link) {
  try {
    const url = new URL(link);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return String(link || '').trim().toLowerCase();
  }
}

function itemCheckpointKey(item, feedUrl = '') {
  const guid = String(item?.guid || item?.id || '').trim();
  if (guid) return `${feedUrl}::guid::${guid}`;
  const link = canonicalizeLink(item?.link || item?.url || '');
  if (link) return `${feedUrl}::link::${hash(link)}`;
  const title = String(item?.title || '').trim().toLowerCase();
  const pubDate = String(item?.pubDate || item?.publishDate || item?.isoDate || '').trim();
  return `${feedUrl}::fallback::${hash(`${title}|${pubDate}`)}`;
}

function readLedger() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLedger(ledger) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // ignore storage errors
  }
}

export function getIngestionLedger() {
  return readLedger();
}

export function hasSeenFeedItem(feedUrl, item) {
  const ledger = readLedger();
  const key = itemCheckpointKey(item, feedUrl);
  return Boolean(ledger[key]);
}

export function markSeenFeedItems(feedUrl, items = []) {
  const ledger = readLedger();
  const now = new Date().toISOString();
  for (const item of items || []) {
    const key = itemCheckpointKey(item, feedUrl);
    ledger[key] = {
      firstSeenAt: ledger[key]?.firstSeenAt || now,
      lastSeenAt: now,
      feedUrl,
      guid: item?.guid || item?.id || null,
      canonicalLink: canonicalizeLink(item?.link || item?.url || ''),
      title: item?.title || null
    };
  }
  writeLedger(ledger);
  return ledger;
}

export function filterUnseenFeedItems(feedUrl, items = []) {
  const ledger = readLedger();
  return (items || []).filter(item => {
    const key = itemCheckpointKey(item, feedUrl);
    return !ledger[key];
  });
}

export function pruneIngestionLedger(maxAgeDays = 30) {
  const ledger = readLedger();
  const cutoff = Date.now() - (maxAgeDays * 86400000);
  const next = {};

  for (const [key, value] of Object.entries(ledger)) {
    const seenTs = new Date(value?.lastSeenAt || value?.firstSeenAt || 0).getTime();
    if (seenTs && seenTs >= cutoff) {
      next[key] = value;
    }
  }

  writeLedger(next);
  return next;
}

export function clearIngestionLedger() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
