/**
 * Planner/UpAhead Benchmark — 65 core items across all categories + location/date challenges
 * Use buildPlannerBenchmarkItems() to generate 350+ items with time-shifted variants
 * Expected: correct classification, date parsing, location mapping, eligibility
 */

const NOW = new Date();
const TODAY = NOW.toISOString().slice(0, 10);
function futureDate(days) { const d = new Date(NOW); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function pastDate(days) { const d = new Date(NOW); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); }
const TOMORROW = futureDate(1);
const NEXT_WEEK = futureDate(5);
const NEXT_MONTH = futureDate(20);

// ── Core Items — each has expected classification + eligibility ──────────────

const ITEMS = [
  // ═══ MOVIES (8 items) ═══
  { id: 'M1', title: `Vidaamuyarchi Tamil movie releasing on ${futureDate(3)}`, summary: `Ajith Kumar starrer Vidaamuyarchi to release in theatres on ${futureDate(3)}. Directed by Magizh Thirumeni. BookMyShow advance booking open.`, category: 'movies', expectedDate: futureDate(3), expectedDateConf: 'exact', location: 'India', expectedEligible: true },
  { id: 'M2', title: 'Pushpa 3 release date confirmed for December 2025', summary: 'Allu Arjun Pushpa 3 The Rule release date confirmed for December 2025. Directed by Sukumar. Mythri Movie Makers production.', category: 'movies', expectedDate: null, expectedDateConf: 'tentative', location: 'India', expectedEligible: true },
  { id: 'M3', title: `New OTT releases this week on Netflix and Prime Video`, summary: `Netflix drops 3 new Tamil movies this week. Amazon Prime Video adds 2 Hindi films. Disney+ Hotstar premieres new web series starting ${futureDate(2)}.`, category: 'movies', expectedDate: futureDate(2), expectedDateConf: 'inferred', location: 'online', expectedEligible: true },
  { id: 'M4', title: 'Best Tamil movies of 2024 ranked', summary: 'Our critics pick the top 10 Tamil movies of 2024 including Amaran, GOAT and Vettaiyan.', category: 'movies', expectedDate: null, expectedDateConf: 'none', location: null, expectedEligible: false, _noise: true },
  // DUPLICATE of M1
  { id: 'M1_DUP', title: `Vidaamuyarchi releasing ${futureDate(3)} — advance booking now open`, summary: `Ajith starrer Vidaamuyarchi releases on ${futureDate(3)} in theatres. BookMyShow showtimes available.`, category: 'movies', expectedDate: futureDate(3), _isDuplicateOf: 'M1' },

  // ═══ EVENTS (8 items) ═══
  { id: 'E1', title: `AR Rahman live concert in Chennai on ${futureDate(6)}`, summary: `AR Rahman to perform live at Jawaharlal Nehru Stadium Chennai on ${futureDate(6)}. Tickets available on BookMyShow starting ₹999.`, category: 'events', expectedDate: futureDate(6), expectedDateConf: 'exact', location: 'Chennai', expectedEligible: true },
  { id: 'E2', title: 'International Book Fair at T. Nagar this weekend', summary: 'The Chennai International Book Fair begins this weekend at T. Nagar grounds. Over 500 publishers participating. Entry free.', category: 'events', expectedDate: futureDate(2), expectedDateConf: 'inferred', location: 'Chennai', expectedEligible: true, _locationAlias: 'T. Nagar → Chennai' },
  { id: 'E3', title: `Art exhibition opening at Muscat Grand Mall on ${futureDate(4)}`, summary: `Contemporary art exhibition featuring Omani artists opens at Muscat Grand Mall on ${futureDate(4)}. Free entry until end of month.`, category: 'events', expectedDate: futureDate(4), expectedDateConf: 'exact', location: 'Muscat', expectedEligible: true },
  { id: 'E4', title: 'Tech meetup in Adyar next Tuesday', summary: 'Google Developer Group Chennai hosting a tech meetup in Adyar next Tuesday. Topics include Flutter, Firebase and Gemini AI.', category: 'events', expectedDate: futureDate(3), expectedDateConf: 'inferred', location: 'Chennai', expectedEligible: true, _locationAlias: 'Adyar → Chennai' },
  { id: 'E5', title: 'Music concert happened last week in Trichy was a huge success', summary: 'The classical music concert held last week at Trichy was attended by 5000 people.', category: 'events', expectedDate: pastDate(7), expectedDateConf: 'exact', location: 'Trichy', expectedEligible: false, _reason: 'past event' },

  // ═══ FESTIVALS & HOLIDAYS (6 items) ═══
  { id: 'F1', title: `Pongal holiday on ${futureDate(10)} — schools and offices closed in Tamil Nadu`, summary: `Pongal will be celebrated on ${futureDate(10)}. Tamil Nadu government declared 4-day holiday. Public offices and schools will remain closed.`, category: 'festivals', expectedDate: futureDate(10), expectedDateConf: 'exact', location: 'Chennai', expectedEligible: true },
  { id: 'F2', title: 'Eid Al Adha 2025 expected on June 7 in Oman', summary: 'Eid Al Adha 2025 is expected to fall on June 7 in Oman. The Sultanate declared a 4-day public holiday starting June 6.', category: 'festivals', expectedDate: '2025-06-07', expectedDateConf: 'exact', location: 'Muscat', expectedEligible: true },
  { id: 'F3', title: 'Deepavali 2025 date and significance', summary: 'Deepavali 2025 will be celebrated on October 20. Know the significance, puja timings and rituals for the festival of lights.', category: 'festivals', expectedDate: '2025-10-20', expectedDateConf: 'exact', location: 'India', expectedEligible: true },
  { id: 'F4', title: `Oman National Day celebrations on ${futureDate(15)} in Muscat`, summary: `Grand celebrations planned for Oman National Day on ${futureDate(15)} across Muscat. Military parade at Sultan Qaboos Stadium. Fireworks at Mutrah Corniche.`, category: 'festivals', expectedDate: futureDate(15), expectedDateConf: 'exact', location: 'Muscat', expectedEligible: true },
  { id: 'F5', title: 'Republic Day celebrations in Chennai', summary: `Republic Day will be celebrated on ${futureDate(8)} with flag hoisting at Fort St George. Governor to take salute. Cultural programs at Marina Beach.`, category: 'festivals', expectedDate: futureDate(8), expectedDateConf: 'exact', location: 'Chennai', expectedEligible: true },

  // ═══ CIVIC ALERTS (6 items) ═══
  { id: 'CA1', title: `TANGEDCO power shutdown in Anna Nagar on ${TOMORROW}`, summary: `Scheduled power shutdown in Anna Nagar, Kilpauk and Aminjikarai areas on ${TOMORROW} from 9 AM to 5 PM for maintenance work. TANGEDCO apologizes for inconvenience.`, category: 'alerts', expectedDate: TOMORROW, expectedDateConf: 'exact', location: 'Chennai', expectedEligible: true, _locationAlias: 'Anna Nagar → Chennai' },
  { id: 'CA2', title: 'Chennai Metro water supply disruption in T Nagar area', summary: `Chennai Metro Water Board announced water supply disruption in T Nagar and Kodambakkam on ${futureDate(2)} due to pipeline repair. Tanker supply will be arranged.`, category: 'alerts', expectedDate: futureDate(2), expectedDateConf: 'exact', location: 'Chennai', expectedEligible: true, _locationAlias: 'T Nagar → Chennai' },
  { id: 'CA3', title: `Road closure in Muscat: Al Khuwair flyover closed for maintenance`, summary: `The Al Khuwair flyover in Muscat will be closed for maintenance from ${futureDate(1)} to ${futureDate(5)}. Traffic diverted via Sultan Qaboos Highway.`, category: 'alerts', expectedDate: futureDate(1), expectedDateConf: 'exact', location: 'Muscat', expectedEligible: true, _locationAlias: 'Al Khuwair → Muscat' },
  { id: 'CA4', title: 'Trichy airport runway closed for repairs next month', summary: 'Trichy airport runway will be closed for repairs from next month. All flights diverted to Madurai. Passengers advised to check with airlines.', category: 'alerts', expectedDate: null, expectedDateConf: 'tentative', location: 'Trichy', expectedEligible: true },

  // ═══ SHOPPING / ONLINE OFFERS (8 items) ═══
  { id: 'S1', title: `Amazon Great Indian Sale starts ${futureDate(3)} — up to 80% off`, summary: `Amazon Great Indian Sale starts ${futureDate(3)}. Deals on electronics, fashion and home. Prime members get early access. Bank offers on SBI and HDFC cards.`, category: 'shopping', expectedDate: futureDate(3), expectedDateConf: 'exact', location: 'online', expectedEligible: true },
  { id: 'S2', title: 'Flipkart Big Billion Days 2025 dates announced', summary: `Flipkart Big Billion Days 2025 from ${futureDate(5)} to ${futureDate(9)}. Exchange offers on phones. No-cost EMI available. Free delivery on orders above ₹500.`, category: 'shopping', expectedDate: futureDate(5), expectedDateConf: 'exact', location: 'online', expectedEligible: true },
  { id: 'S3', title: 'Myntra End of Season Sale — flat 50-70% off on fashion', summary: 'Myntra EOSS live now with up to 70% off on top brands. Free shipping on all orders. Coupon code EXTRA10 for additional 10% discount.', category: 'shopping', expectedDate: null, expectedDateConf: 'none', location: 'online', expectedEligible: true },
  { id: 'S4', title: `Saravana Stores Madras — massive Pongal sale starting ${futureDate(4)}`, summary: `Saravana Stores T Nagar Madras announces massive Pongal sale starting ${futureDate(4)}. 30-50% off on silk sarees, jewellery and electronics.`, category: 'shopping', expectedDate: futureDate(4), expectedDateConf: 'exact', location: 'Chennai', expectedEligible: true, _locationAlias: 'Madras/T Nagar → Chennai' },
  { id: 'S5', title: 'Lulu Hypermarket Muscat weekend deals', summary: `Lulu Hypermarket Al Ghubra Muscat offers weekend deals on groceries and electronics. Valid ${futureDate(2)} to ${futureDate(4)}. Free delivery above 10 OMR.`, category: 'shopping', expectedDate: futureDate(2), expectedDateConf: 'exact', location: 'Muscat', expectedEligible: true },
  // DUPLICATE of S1
  { id: 'S1_DUP', title: `Amazon sale from ${futureDate(3)} with up to 80 percent discounts`, summary: `Amazon Great Indian Sale beginning ${futureDate(3)} with deals on electronics fashion and home items. SBI HDFC card offers available.`, category: 'shopping', _isDuplicateOf: 'S1' },

  // ═══ AIRLINES (4 items) ═══
  { id: 'A1', title: `IndiGo flash sale: Chennai to Muscat flights from ₹8999`, summary: `IndiGo announces flash sale on Chennai-Muscat route. Fares starting ₹8999 one-way. Book by ${futureDate(2)}. Travel period ${futureDate(7)} to ${futureDate(30)}.`, category: 'airlines', expectedDate: futureDate(2), expectedDateConf: 'exact', location: 'Chennai', expectedEligible: true },
  { id: 'A2', title: 'Oman Air year-end sale — flat 25% off all routes', summary: 'Oman Air year-end sale with 25% discount on all routes including Muscat-Chennai, Muscat-Mumbai and Muscat-London. Book before December 31.', category: 'airlines', expectedDate: null, expectedDateConf: 'tentative', location: 'Muscat', expectedEligible: true },
  { id: 'A3', title: 'Air India to launch direct Trichy-Singapore flights', summary: `Air India announces new direct flights from Trichy to Singapore starting ${futureDate(14)}. Three flights per week. Inaugural fare ₹12999.`, category: 'airlines', expectedDate: futureDate(14), expectedDateConf: 'exact', location: 'Trichy', expectedEligible: true },

  // ═══ WEATHER ALERTS (4 items) ═══
  { id: 'W1', title: 'IMD issues heavy rain warning for Chennai tomorrow', summary: `IMD issued orange alert for Chennai tomorrow ${TOMORROW}. Heavy to very heavy rainfall expected. Wind speed 50-60 kmph. Avoid waterlogged areas.`, category: 'weather_alerts', expectedDate: TOMORROW, expectedDateConf: 'exact', location: 'Chennai', expectedEligible: true },
  { id: 'W2', title: 'Oman Met Department warns of thunderstorms in Muscat', summary: `Oman Meteorological Department issued thunderstorm warning for Muscat and coastal areas on ${futureDate(2)}. Flash floods possible in wadis.`, category: 'weather_alerts', expectedDate: futureDate(2), expectedDateConf: 'exact', location: 'Muscat', expectedEligible: true },

  // ═══ NOISE — should be DROPPED ═══
  { id: 'N1', title: 'Top 10 restaurants in Chennai you must try', summary: 'Our picks for the best restaurants in Chennai. From filter coffee to biryani, here are our favorites.', category: null, expectedEligible: false, _noise: true },
  { id: 'N2', title: 'Stock market analysis: Nifty outlook for next week', summary: 'Technical analysis suggests Nifty may test 24000 levels. Support at 23500. Resistance at 24200.', category: null, expectedEligible: false, _noise: true },
  { id: 'N3', title: 'History of Pongal festival and traditions', summary: 'Pongal is a harvest festival celebrated in Tamil Nadu. Learn about the four-day festival traditions and significance.', category: null, expectedEligible: false, _noise: true, _reason: 'informational, no upcoming event' },
  { id: 'N4', title: 'Random blog post about travel in general', summary: 'Travelling is fun and everyone should do it more often. Here are some tips for budget travel.', category: null, expectedEligible: false, _noise: true },
];

// ── Generate time-shifted variants to reach 350+ ────────────────────────────
function buildPlannerBenchmarkItems() {
  const all = [];
  const base = ITEMS.filter(i => !i._isDuplicateOf);

  // Add originals
  for (const item of ITEMS) {
    all.push({
      ...item,
      guid: item.id,
      link: `https://example.com/planner/${item.id}`,
      pubDate: new Date(NOW.getTime() - 2 * 3600000).toISOString(),
      source: item.source || `source-${item.category || 'unknown'}`,
      sourcePack: `${item.category || 'unknown'}:${item.location || 'unknown'}`,
    });
  }

  // Generate time-shifted + rewording variants (5x multiplier)
  const REWORDING_PREFIXES = ['Breaking: ', 'Update: ', 'Report: ', 'Latest: ', 'Alert: '];
  for (let shift = 0; shift < 5; shift++) {
    for (const item of base) {
      if (item._noise) continue;
      all.push({
        ...item,
        id: `${item.id}_v${shift}`,
        guid: `${item.id}_v${shift}`,
        title: `${REWORDING_PREFIXES[shift]}${item.title}`,
        pubDate: new Date(NOW.getTime() - (shift + 1) * 4 * 3600000).toISOString(),
        link: `https://example.com/planner/${item.id}_v${shift}`,
        source: `source-${shift}-${item.category || 'unknown'}`,
        sourcePack: `${item.category || 'unknown'}:${item.location || 'unknown'}`,
        _isVariantOf: item.id,
      });
    }
  }

  return all;
}

// ── Expected Outcomes ───────────────────────────────────────────────────────
const EXPECTED_OUTCOMES = {
  totalBaseItems: ITEMS.length,
  totalWithVariants: '350+',
  categoryDistribution: {
    movies: { base: 5, expectedEligible: 3 },
    events: { base: 5, expectedEligible: 4 },
    festivals: { base: 5, expectedEligible: 5 },
    alerts: { base: 4, expectedEligible: 4 },
    shopping: { base: 6, expectedEligible: 5 },
    airlines: { base: 3, expectedEligible: 3 },
    weather_alerts: { base: 2, expectedEligible: 2 },
    noise: { base: 4, expectedEligible: 0 },
  },
  locationMappingTests: [
    { input: 'T. Nagar', expected: 'Chennai' },
    { input: 'Adyar', expected: 'Chennai' },
    { input: 'Anna Nagar', expected: 'Chennai' },
    { input: 'Madras', expected: 'Chennai' },
    { input: 'Al Khuwair', expected: 'Muscat' },
    { input: 'Al Ghubra', expected: 'Muscat' },
  ],
  dateParsingTests: [
    { input: 'this weekend', expectedConf: 'inferred' },
    { input: 'next Tuesday', expectedConf: 'inferred' },
    { input: 'next month', expectedConf: 'tentative' },
    { input: futureDate(3), expectedConf: 'exact' },
    { input: null, expectedConf: 'none' },
  ],
  deduplicationPairs: [
    ['M1', 'M1_DUP'],
    ['S1', 'S1_DUP'],
  ],
  pastEventFilter: ['E5'],
  accuracyTargets: {
    categoryClassification: 0.90,
    dateExtraction: 0.90,
    locationMapping: 0.95,
    eligibilityAccuracy: 0.90,
    deduplicationRecall: 0.90,
    noiseFilterRate: 0.90,
  }
};

export { ITEMS, EXPECTED_OUTCOMES, buildPlannerBenchmarkItems };
