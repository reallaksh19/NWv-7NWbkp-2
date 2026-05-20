export const DEFAULT_LOCATION_LIBRARY = Object.freeze({
  Chennai: {
    country: 'India',
    region: 'Tamil Nadu',
    aliases: [
      'chennai', 'madras', 'tnagar', 't nagar', 'thyagaraya nagar', 'adyar', 'velachery', 'tambaram',
      'porur', 'ambattur', 'annanagar', 'anna nagar', 'nungambakkam', 'mylapore', 'guindy',
      'tiruvallur', 'thiruvallur', 'chengalpattu', 'egmore', 'kodambakkam', 'omr', 'ecr'
    ]
  },
  Trichy: {
    country: 'India',
    region: 'Tamil Nadu',
    aliases: [
      'trichy', 'tiruchirappalli', 'trichinopoly', 'srirangam', 'thillai nagar', 'cantonment',
      'ponmalai', 'kk nagar trichy', 'woriur', 'woraiyur', 'samayapuram'
    ]
  },
  Muscat: {
    country: 'Oman',
    region: 'Muscat Governorate',
    aliases: [
      'muscat', 'muscat oman', 'al khuwair', 'alkhuwair', 'khuwair', 'qurum', 'ruwi', 'seeb',
      'mabela', 'maabela', 'bowshar', 'bousher', 'muttrah', 'matrah', 'al hail', 'ghubra', 'gubra'
    ]
  }
});

function uniqueNormalized(values) {
  const set = new Set();
  for (const value of values || []) {
    if (!value) continue;
    const normalized = String(value).trim();
    if (!normalized) continue;
    set.add(normalized);
  }
  return [...set];
}

export function topupLocationLibrary(baseLibrary = DEFAULT_LOCATION_LIBRARY, topupPack = {}) {
  const merged = JSON.parse(JSON.stringify(baseLibrary));

  for (const [city, payload] of Object.entries(topupPack || {})) {
    const existing = merged[city] || { aliases: [] };
    merged[city] = {
      ...existing,
      ...payload,
      aliases: uniqueNormalized([...(existing.aliases || []), ...(payload.aliases || [])])
    };
  }

  return merged;
}

export function buildLocationAliasIndex(library = DEFAULT_LOCATION_LIBRARY) {
  const index = new Map();

  for (const [city, payload] of Object.entries(library || {})) {
    const aliases = uniqueNormalized([city, ...(payload.aliases || [])]);
    for (const alias of aliases) {
      index.set(alias.toLowerCase(), city);
    }
  }

  return index;
}
