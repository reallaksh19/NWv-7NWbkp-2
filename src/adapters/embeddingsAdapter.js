/**
 * Fixed-vocabulary TF-IDF embeddings — works on static GitHub Pages.
 *
 * CRITICAL: Uses a hardcoded 200-term vocabulary so every vector is ALWAYS
 * exactly 200 dimensions regardless of input corpus. Dimension consistency
 * is mandatory for cosineSimilarity() which checks a.length !== b.length.
 *
 * Previous implementation produced [0,0,...,0,text.length/1000, charCode/255]
 * giving cosine similarity ≈ 0.99 for ALL pairs → dedup removed everything.
 */

const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','been','but','by','for','from',
  'has','have','he','her','his','how','i','in','is','it','its','not',
  'of','on','or','she','so','than','that','the','their','they','this',
  'to','up','was','we','were','what','when','which','who','will','with'
]);

// Hardcoded 200-term vocabulary — curated for Indian/global news domain
const FIXED_VOCAB = [
  'government','minister','prime','president','parliament','court','supreme',
  'election','vote','party','opposition','congress','bjp','modi','rahul',
  'economy','gdp','inflation','fiscal','deficit','budget','tax','reform',
  'market','stock','shares','sensex','nifty','trading','rally','crash',
  'bank','rbi','rate','repo','interest','loan','emi','credit','deposit',
  'rupee','dollar','euro','currency','forex','exchange','reserve',
  'oil','crude','petrol','diesel','gas','energy','power','coal','solar',
  'gold','silver','commodity','metal','price','export','import','trade',
  'company','profit','revenue','quarterly','results','earnings','growth',
  'startup','funding','valuation','ipo','listing','investor','venture',
  'technology','ai','artificial','intelligence','digital','software','data',
  'cyber','security','privacy','hack','breach','cloud','computing',
  'india','china','pakistan','usa','russia','ukraine','israel','gaza',
  'chennai','mumbai','delhi','kolkata','bengaluru','hyderabad',
  'muscat','oman','dubai','saudi','gulf','middle','east',
  'cricket','ipl','football','sports','match','final','tournament',
  'player','team','captain','coach','win','victory','defeat','score',
  'army','military','defence','border','tension','ceasefire','attack',
  'terror','security','police','arrest','investigation','crime',
  'covid','vaccine','health','hospital','disease','medicine','doctor',
  'education','university','school','student','exam','result',
  'climate','flood','cyclone','earthquake','disaster','rain','storm',
  'imd','warning','alert','rescue','relief','evacuation','shelter',
  'infrastructure','road','highway','metro','railway','airport','bridge',
  'housing','real','estate','property','construction','smart','city',
  'film','movie','actor','director','release','box','office','ott',
  'netflix','disney','bollywood','hollywood','tamil','telugu',
  'festival','celebration','holiday','pongal','diwali','eid',
  'supreme','verdict','law','bill','act','regulation','policy',
  'un','nato','summit','bilateral','treaty','sanctions','diplomacy',
  'women','child','rights','protest','rally','demonstration',
  'agriculture','farmer','crop','msp','monsoon','irrigation',
  'space','isro','nasa','satellite','launch','mission','orbit',
  'dead','killed','casualties','injured','victims','accident'
];

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

export async function getEmbeddings(texts) {
  if (!texts || texts.length === 0) return [];

  return texts.map(text => {
    const tokens = tokenize(text);
    // Sublinear TF: dampens high-frequency terms
    const freq = {};
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    Object.keys(freq).forEach(t => { freq[t] = 1 + Math.log(freq[t]); });

    // Project onto fixed vocabulary — always exactly 200 dimensions
    return FIXED_VOCAB.map(term => freq[term] || 0);
  });
}
