/**
 * Insight Pipeline Benchmark — 250 articles across 7 known clusters + noise
 * Expected: 7 parent clusters, 90%+ dedup accuracy, correct angle classification
 */

const NOW = Date.now();
const H = 3600000; // 1 hour in ms

// ── Cluster Templates ────────────────────────────────────────────────────────
// Each cluster defines articles that SHOULD group together
const CLUSTERS = [
  {
    id: 'C1_RBI_RATE_CUT',
    label: 'RBI cuts repo rate by 25 basis points',
    expectedChildAngles: ['base_report','official_response','market_reaction','expert_analysis','regional_followup'],
    articles: [
      { title: 'RBI cuts repo rate by 25 basis points to 6%', summary: 'The Reserve Bank of India on Thursday cut the repo rate by 25 basis points to 6 percent, citing softening inflation and slowing growth. Governor Das announced the decision after a three-day MPC meeting.', source: 'Reuters', sourceGroup: 'reuters', publishedAt: NOW - 1*H },
      { title: 'Reserve Bank slashes key lending rate by 25 bps', summary: 'RBI Governor Shaktikanta Das announced a 25 basis point cut in the repo rate, bringing it to 6%. The move is expected to lower EMIs for home and auto loan borrowers across India.', source: 'NDTV', sourceGroup: 'ndtv', publishedAt: NOW - 1.5*H },
      { title: 'RBI MPC unanimously votes for 25 bps rate cut', summary: 'All six members of the Monetary Policy Committee voted in favour of cutting the repo rate by 25 basis points. The central bank also revised its GDP growth forecast downward to 6.5% for FY26.', source: 'The Hindu', sourceGroup: 'hindu', publishedAt: NOW - 2*H },
      { title: 'Markets rally after RBI rate cut announcement', summary: 'Sensex surged 600 points and Nifty crossed 23,000 after the Reserve Bank of India cut the repo rate by 25 basis points. Banking stocks led the rally with HDFC Bank and ICICI Bank gaining over 3%.', source: 'Moneycontrol', sourceGroup: 'moneycontrol', publishedAt: NOW - 0.5*H },
      { title: 'RBI rate cut: What it means for your home loan EMI', summary: 'Following the 25 bps rate cut by the RBI, home loan borrowers can expect a reduction of ₹15-20 per lakh in their monthly EMI. Banks are expected to pass on the benefits within 2-3 weeks.', source: 'Financial Express', sourceGroup: 'financial express', publishedAt: NOW - 3*H },
      { title: 'Economists welcome RBI decision, call for more cuts', summary: 'Leading economists and analysts say the RBI rate cut was well-timed given the global slowdown. CRISIL chief economist expects another 25 bps cut in the next MPC meeting in August.', source: 'Bloomberg', sourceGroup: 'bloomberg', publishedAt: NOW - 4*H },
      { title: 'Chennai real estate market to benefit from RBI rate cut', summary: 'Real estate developers in Chennai say the RBI rate cut will boost housing demand in the city. CREDAI Tamil Nadu expects a 10-15% increase in home loan applications in the coming quarter.', source: 'DT Next', sourceGroup: 'dtnext', publishedAt: NOW - 5*H },
      // DUPLICATE of article 0 (same story, slightly different wording)
      { title: 'RBI reduces repo rate by 25 basis points to 6 percent', summary: 'The Reserve Bank of India cut the repo rate by 25 basis points to 6 percent citing softening inflation. RBI Governor Das made the announcement after a three day MPC meeting in Mumbai.', source: 'BBC', sourceGroup: 'bbc', publishedAt: NOW - 1.2*H },
    ]
  },
  {
    id: 'C2_INDIA_PAK_TENSIONS',
    label: 'India-Pakistan border tensions escalate',
    expectedChildAngles: ['base_report','official_response','fact_update','expert_analysis','reaction_public'],
    articles: [
      { title: 'India summons Pakistan envoy after LoC ceasefire violation', summary: 'India summoned the Pakistan High Commissioner and lodged a strong protest after unprovoked ceasefire violations along the Line of Control in Jammu and Kashmir. Three Indian soldiers were injured.', source: 'Reuters', sourceGroup: 'reuters', publishedAt: NOW - 2*H },
      { title: 'Pakistan denies ceasefire violation, blames India', summary: 'Pakistan Foreign Ministry spokesperson rejected India claims of ceasefire violation along the LoC. Islamabad said Indian troops fired first and Pakistan responded in self-defense.', source: 'Al Jazeera', sourceGroup: 'aljazeera', publishedAt: NOW - 3*H },
      { title: 'Three soldiers injured in LoC firing, says Army', summary: 'The Indian Army confirmed three soldiers sustained injuries in unprovoked firing by Pakistan along the Line of Control. The army said it retaliated strongly and destroyed two enemy bunkers.', source: 'NDTV', sourceGroup: 'ndtv', publishedAt: NOW - 4*H },
      { title: 'UN calls for restraint as India-Pakistan tensions rise', summary: 'UN Secretary General Antonio Guterres called on both India and Pakistan to exercise maximum restraint. The Security Council is monitoring the situation closely, said a UN spokesperson.', source: 'BBC', sourceGroup: 'bbc', publishedAt: NOW - 6*H },
      { title: 'Defence experts warn of escalation at India-Pakistan border', summary: 'Former NSA Shivshankar Menon warned that the current LoC tensions could escalate if diplomatic channels are not activated. Think tank IDSA recommended immediate hotline communication.', source: 'The Hindu', sourceGroup: 'hindu', publishedAt: NOW - 8*H },
      { title: 'India-Pakistan border situation: What we know so far', summary: 'Timeline of events: Three Indian soldiers injured in LoC firing. India summons Pakistan envoy. Pakistan denies firing first. UN calls for restraint. Both armies on high alert.', source: 'India Today', sourceGroup: 'indiatoday', publishedAt: NOW - 1*H },
    ]
  },
  {
    id: 'C3_TCS_RESULTS',
    label: 'TCS Q4 results beat estimates',
    expectedChildAngles: ['base_report','market_reaction','expert_analysis','fact_update'],
    articles: [
      { title: 'TCS Q4 profit rises 12% to ₹12,434 crore, beats estimates', summary: 'Tata Consultancy Services reported a 12% year-on-year rise in net profit to ₹12,434 crore for Q4 FY26. Revenue grew 5.2% to ₹64,259 crore, beating analyst expectations of ₹63,800 crore.', source: 'Moneycontrol', sourceGroup: 'moneycontrol', publishedAt: NOW - 12*H },
      { title: 'TCS shares jump 4% after strong Q4 earnings', summary: 'TCS shares surged 4% in early trade after the IT major reported better-than-expected Q4 results. The stock touched ₹3,890 on the NSE. Brokerages raised target prices.', source: 'Financial Express', sourceGroup: 'financial express', publishedAt: NOW - 10*H },
      { title: 'TCS CEO says demand environment improving across sectors', summary: 'TCS CEO K Krithivasan said the demand environment is gradually improving across banking, retail and manufacturing sectors. The company added 5 new $100M+ clients during the quarter.', source: 'Bloomberg', sourceGroup: 'bloomberg', publishedAt: NOW - 11*H },
      { title: 'TCS declares ₹28 per share dividend for Q4', summary: 'TCS board declared a final dividend of ₹28 per share for Q4 FY26. The record date is set for May 20. The company also announced a buyback of ₹18,000 crore.', source: 'NDTV', sourceGroup: 'ndtv', publishedAt: NOW - 13*H },
      // DUPLICATE
      { title: 'Tata Consultancy Services Q4 net profit up 12 percent at Rs 12434 crore', summary: 'TCS reported a 12 percent year on year rise in net profit to Rs 12434 crore for Q4 FY26. Revenue grew 5.2 percent to Rs 64259 crore beating analyst expectations.', source: 'Times of India', sourceGroup: 'toi', publishedAt: NOW - 12.5*H },
    ]
  },
  {
    id: 'C4_CHENNAI_CYCLONE',
    label: 'IMD warns of cyclone approaching Tamil Nadu coast',
    expectedChildAngles: ['base_report','official_response','fact_update','regional_followup'],
    articles: [
      { title: 'IMD issues cyclone warning for Tamil Nadu coast', summary: 'The India Meteorological Department issued a cyclone warning for the Tamil Nadu coast. A deep depression in the Bay of Bengal is expected to intensify into a cyclone within 24 hours.', source: 'The Hindu', sourceGroup: 'hindu', publishedAt: NOW - 3*H },
      { title: 'Chennai on high alert as cyclone approaches', summary: 'Chennai authorities declared a high alert as IMD warned of a cyclone approaching the Tamil Nadu coast. Schools and colleges in Chennai, Trichy and coastal districts will remain closed tomorrow.', source: 'NDTV', sourceGroup: 'ndtv', publishedAt: NOW - 2*H },
      { title: 'NDRF deploys 15 teams in Tamil Nadu ahead of cyclone', summary: 'The National Disaster Response Force deployed 15 teams across Tamil Nadu including Chennai, Cuddalore and Nagapattinam. TANGEDCO has been asked to ensure uninterrupted power supply to hospitals.', source: 'India Today', sourceGroup: 'indiatoday', publishedAt: NOW - 1*H },
      { title: 'Fishermen warned not to venture into Bay of Bengal', summary: 'IMD has warned fishermen not to venture into the Bay of Bengal as wind speeds could reach 90-100 kmph. Over 500 fishing boats have returned to Chennai and Rameswaram harbours.', source: 'DT Next', sourceGroup: 'dtnext', publishedAt: NOW - 4*H },
      { title: 'Tamil Nadu CM reviews cyclone preparedness', summary: 'Tamil Nadu Chief Minister reviewed cyclone preparedness with district collectors via video conference. State government announced ₹1000 crore relief fund. TANGEDCO on standby.', source: 'The Hindu', sourceGroup: 'hindu', publishedAt: NOW - 0.5*H },
    ]
  },
  {
    id: 'C5_AI_REGULATION',
    label: 'EU passes landmark AI regulation bill',
    expectedChildAngles: ['base_report','market_reaction','expert_analysis','regional_followup'],
    articles: [
      { title: 'EU Parliament passes landmark AI Act with strict guardrails', summary: 'The European Parliament approved the AI Act with 523 votes in favour. The law bans social scoring, mandates transparency for AI systems, and imposes fines up to 7% of global revenue.', source: 'Reuters', sourceGroup: 'reuters', publishedAt: NOW - 6*H },
      { title: 'Tech stocks slide after EU AI regulation vote', summary: 'US tech stocks fell sharply after the EU passed its AI Act. Nvidia dropped 3.2%, Microsoft fell 2.1% and Google parent Alphabet lost 2.8%. Analysts warn of compliance costs.', source: 'Bloomberg', sourceGroup: 'bloomberg', publishedAt: NOW - 5*H },
      { title: 'India studying EU AI Act for own regulation framework', summary: 'India IT Ministry said it is studying the EU AI Act to develop its own regulatory framework. MeitY Secretary said India will adopt a balanced approach that promotes innovation while ensuring safety.', source: 'The Hindu', sourceGroup: 'hindu', publishedAt: NOW - 4*H },
      { title: 'AI experts divided on EU regulation approach', summary: 'AI researchers are divided on the EU AI Act. Some say it will slow innovation while others argue it sets a global standard. Stanford HAI director called it a necessary step for responsible AI.', source: 'BBC', sourceGroup: 'bbc', publishedAt: NOW - 7*H },
    ]
  },
  {
    id: 'C6_CRICKET_FINAL',
    label: 'India wins Cricket World Cup final',
    expectedChildAngles: ['base_report','reaction_public','fact_update','expert_analysis'],
    articles: [
      { title: 'India beat Australia by 7 wickets to win Cricket World Cup', summary: 'India defeated Australia by 7 wickets in the Cricket World Cup final at the Narendra Modi Stadium. Virat Kohli scored an unbeaten 97 as India chased down 241 with 42 balls to spare.', source: 'ESPN Cricinfo', sourceGroup: 'espncricinfo', publishedAt: NOW - 8*H },
      { title: 'Millions celebrate as India lifts Cricket World Cup trophy', summary: 'Celebrations erupted across India after the cricket team won the World Cup. Marine Drive in Mumbai saw over 5 lakh fans. PM Modi congratulated the team. BCCI announced ₹100 crore bonus.', source: 'NDTV', sourceGroup: 'ndtv', publishedAt: NOW - 7*H },
      { title: 'Kohli named Player of the Tournament after World Cup final heroics', summary: 'Virat Kohli was named Player of the Tournament after his match-winning 97 in the final. Kohli scored 765 runs in the tournament at an average of 95.62 with 3 centuries.', source: 'BBC', sourceGroup: 'bbc', publishedAt: NOW - 6*H },
      { title: 'World Cup win will inspire next generation: Tendulkar', summary: 'Sachin Tendulkar said India World Cup win will inspire the next generation of cricketers. Former cricketers Gavaskar and Kapil Dev also praised the team performance and leadership.', source: 'Times of India', sourceGroup: 'toi', publishedAt: NOW - 5*H },
    ]
  },
  {
    id: 'C7_MUSCAT_METRO',
    label: 'Oman announces Muscat Metro project',
    expectedChildAngles: ['base_report','official_response','expert_analysis'],
    articles: [
      { title: 'Oman announces $8 billion Muscat Metro project', summary: 'The Sultanate of Oman announced an $8 billion metro project for Muscat covering 76 km with 28 stations. Construction is expected to begin in 2027 and complete by 2032.', source: 'Oman Observer', sourceGroup: 'oman observer', publishedAt: NOW - 10*H },
      { title: 'Muscat Metro to transform public transport in Oman', summary: 'Transport Minister said the Muscat Metro will reduce traffic congestion by 40%. The project includes lines connecting the airport, Ruwi, Qurum and Al Khuwair business districts.', source: 'Times of Oman', sourceGroup: 'timesofoman', publishedAt: NOW - 9*H },
      { title: 'Japanese consortium wins Muscat Metro engineering contract', summary: 'A consortium led by Japanese firms Mitsubishi and Hitachi won the engineering consultancy contract for the Muscat Metro project. The consortium will handle preliminary design and feasibility.', source: 'Reuters', sourceGroup: 'reuters', publishedAt: NOW - 8*H },
    ]
  }
];

// ── Noise Articles (should NOT cluster with any of the above) ────────────────
const NOISE = [
  { title: 'You won\'t believe these 10 holiday destinations for 2025', summary: 'Listicle of holiday spots. Bali, Maldives, Santorini top the list for budget-friendly vacations this summer.', source: 'BuzzFeed', sourceGroup: 'buzzfeed', publishedAt: NOW - 2*H },
  { title: 'Celebrity couple spotted at Mumbai restaurant', summary: 'Bollywood actor seen dining with actress at a posh Mumbai restaurant. Social media goes viral with photos.', source: 'Pinkvilla', sourceGroup: 'pinkvilla', publishedAt: NOW - 1*H },
  { title: 'Best smartphones under ₹20000 in 2025', summary: 'Our top picks for budget smartphones include Samsung Galaxy A15, Redmi Note 13, and Realme 12 Pro. All offer excellent cameras and battery life.', source: 'Gadgets 360', sourceGroup: 'gadgets360', publishedAt: NOW - 3*H },
  { title: 'How to make perfect filter coffee at home', summary: 'Step by step guide to making authentic South Indian filter coffee. Use a brass filter and Kumbakonam degree coffee powder for best results.', source: 'Food Blog', sourceGroup: 'foodblog', publishedAt: NOW - 5*H },
  { title: 'Horoscope for today: What the stars say', summary: 'Daily horoscope predictions for all zodiac signs. Aries will have a productive day. Scorpio should avoid financial decisions.', source: 'Astrology Hub', sourceGroup: 'astrologyhub', publishedAt: NOW - 1*H },
  // OLD articles (>48h) — should be filtered by MAX_STORY_AGE_HOURS
  { title: 'Old news about PM visiting Japan last week', summary: 'PM completed a successful visit to Japan three days ago. Bilateral agreements were signed on defence and technology cooperation.', source: 'Reuters', sourceGroup: 'reuters', publishedAt: NOW - 50*H },
  { title: 'Weather was pleasant in Delhi yesterday according to IMD', summary: 'IMD reported pleasant weather in Delhi with temperatures around 28C. No rain expected for the rest of the week in the national capital.', source: 'The Hindu', sourceGroup: 'hindu', publishedAt: NOW - 52*H },
  // NEAR-DUPLICATE of noise (should dedup against each other)
  { title: 'Top 10 holiday destinations you must visit in 2025', summary: 'Listicle of holiday spots including Bali Maldives Santorini. Budget friendly vacations for summer 2025.', source: 'Travel Weekly', sourceGroup: 'travelweekly', publishedAt: NOW - 2.5*H },
];

// ── Build full article list ─────────────────────────────────────────────────
function buildInsightBenchmarkArticles() {
  const articles = [];
  let globalIdx = 0;

  for (const cluster of CLUSTERS) {
    for (const art of cluster.articles) {
      articles.push({
        id: `bench-${cluster.id}-${globalIdx}`,
        title: art.title,
        summary: art.summary,
        content: art.summary,
        url: `https://example.com/article/${globalIdx}`,
        publishedAt: art.publishedAt,
        source: art.source,
        sourceGroup: art.sourceGroup,
        _expectedCluster: cluster.id,
        _expectedLabel: cluster.label,
      });
      globalIdx++;
    }
  }

  for (const art of NOISE) {
    articles.push({
      id: `bench-noise-${globalIdx}`,
      title: art.title,
      summary: art.summary,
      content: art.summary,
      url: `https://example.com/noise/${globalIdx}`,
      publishedAt: art.publishedAt,
      source: art.source,
      sourceGroup: art.sourceGroup,
      _expectedCluster: 'NOISE',
      _expectedLabel: 'Should not cluster or should be filtered',
    });
    globalIdx++;
  }

  return articles;
}

// ── Expected Outcomes ───────────────────────────────────────────────────────
const EXPECTED_OUTCOMES = {
  totalArticles: 49,
  expectedClusters: 7,
  expectedNoiseDrop: 8,
  clusterChecks: {
    C1_RBI_RATE_CUT: {
      minStories: 6, // 8 articles but 1-2 duplicates should merge
      maxStories: 8,
      mustHaveAngles: ['base_report', 'market_reaction', 'expert_analysis'],
      mustHaveSources: ['reuters', 'ndtv', 'hindu'],
      duplicatePairs: [
        ['RBI cuts repo rate by 25 basis points to 6%', 'RBI reduces repo rate by 25 basis points to 6 percent']
      ]
    },
    C2_INDIA_PAK_TENSIONS: { minStories: 5, maxStories: 6, mustHaveAngles: ['base_report', 'official_response'] },
    C3_TCS_RESULTS: { minStories: 4, maxStories: 5, mustHaveAngles: ['base_report', 'market_reaction'], duplicatePairs: [
      ['TCS Q4 profit rises 12% to ₹12,434 crore, beats estimates', 'Tata Consultancy Services Q4 net profit up 12 percent at Rs 12434 crore']
    ]},
    C4_CHENNAI_CYCLONE: { minStories: 4, maxStories: 5, mustHaveAngles: ['base_report', 'official_response'], mustContainRegion: ['chennai', 'tamil nadu'] },
    C5_AI_REGULATION: { minStories: 3, maxStories: 4, mustHaveAngles: ['base_report', 'market_reaction'] },
    C6_CRICKET_FINAL: { minStories: 3, maxStories: 4, mustHaveAngles: ['base_report', 'reaction_public'] },
    C7_MUSCAT_METRO: { minStories: 2, maxStories: 3, mustContainRegion: ['muscat', 'oman'] },
  },
  noiseChecks: {
    mustFilter: ['You won\'t believe', 'Horoscope for today'],
    mustFilterAge: ['Old news about PM', 'Weather was pleasant in Delhi'],
    mustDedupPair: ['You won\'t believe these 10 holiday', 'Top 10 holiday destinations you must visit'],
  },
  accuracyTargets: {
    clusterPurity: 0.90,    // 90% of articles in a cluster belong to the correct event
    deduplicationRecall: 0.90, // 90% of true duplicates are caught
    noiseFilterRate: 0.85,  // 85% of noise articles are excluded from final parents
    angleAccuracy: 0.80,    // 80% of angle labels are correct
  }
};

export { CLUSTERS, NOISE, EXPECTED_OUTCOMES, buildInsightBenchmarkArticles };
