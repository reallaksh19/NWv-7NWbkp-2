const STOP_WORDS = new Set([
    'about', 'after', 'again', 'against', 'ahead', 'among', 'around', 'because',
    'before', 'being', 'between', 'could', 'during', 'every', 'first', 'from',
    'have', 'into', 'latest', 'more', 'news', 'over', 'said', 'says', 'their',
    'there', 'these', 'this', 'those', 'through', 'under', 'update', 'when',
    'where', 'which', 'while', 'with', 'would', 'will', 'your', 'they', 'were',
    'than', 'that', 'then', 'them', 'also', 'just', 'been', 'some', 'such',
    'what', 'into', 'amid', 'near', 'only', 'very', 'make', 'made', 'making'
]);

const KNOWN_PLACES = [
    'New York', 'London', 'Tokyo', 'Paris', 'Beijing', 'Sydney', 'Berlin',
    'Toronto', 'Chicago', 'Singapore', 'Dubai', 'Abu Dhabi', 'Riyadh',
    'India', 'Delhi', 'New Delhi', 'Mumbai', 'Bangalore', 'Bengaluru',
    'Kolkata', 'Hyderabad', 'Chennai', 'Trichy', 'Tiruchirappalli',
    'Tamil Nadu', 'Coimbatore', 'Madurai', 'Salem', 'Tirunelveli', 'Vellore',
    'Muscat', 'Oman', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain',
    'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal',
    'China', 'US', 'USA', 'United States', 'UK', 'United Kingdom', 'Russia',
    'Brazil', 'Australia', 'Canada', 'Japan', 'Germany', 'France', 'Italy',
    'Ukraine', 'Israel', 'Gaza', 'Europe', 'Asia', 'Middle East'
];

const KNOWN_ORGS = [
    'Apple', 'Google', 'Microsoft', 'Amazon', 'Facebook', 'Meta', 'Tesla',
    'Nvidia', 'Samsung', 'Intel', 'IBM', 'Oracle', 'Cisco', 'Sony', 'Toyota',
    'Honda', 'OpenAI', 'Anthropic', 'Commerce Ministry', 'Finance Ministry',
    'Supreme Court', 'High Court', 'RBI', 'SEBI', 'BCCI', 'ICC', 'FIFA',
    'UN', 'WHO', 'IMF', 'World Bank', 'Reserve Bank of India', 'Election Commission',
    'NASA', 'ISRO', 'NATO', 'OPEC'
];

const ORG_SUFFIX_RE = /\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4}\s+(?:Bank|Group|Corp|Corporation|Company|Ltd|Limited|Inc|PLC|LLC|Ministry|Department|Court|Agency|Authority|Commission|Board|Council|Institute|University|Airlines|Motors|Energy|Power|Police|Exchange|Bourse|Fund|Committee|Office))\b/g;

const PERSON_RE = /\b(?:Mr|Ms|Mrs|Dr|Prof|President|Prime Minister|Minister|CEO|CFO|Chairman|Governor|Justice)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;

const TITLE_CASE_PHRASE_RE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/g;

const SYMBOL_RE = /(?:\$|#)\b[A-Z]{2,8}\b|\b[A-Z]{2,6}\.(?:NS|BO|N|O)\b/g;

const PRODUCT_HINT_RE = /\b([A-Z][A-Za-z0-9-]*(?:\s+[A-Za-z0-9-]+){0,1}(?:\s+(?:AI|Pro|Max|Ultra|Cloud|Pay|Search|Phone|OS|App|GPT|Model|Chip|EV|SUV|Vaccine|Drug|Platform|Service|Suite|Engine|System|Mission|Rocket|Satellite)))\b/g;

const NEWS_VERBS = [
    'launch', 'launches', 'launched', 'unveil', 'unveils', 'unveiled',
    'announce', 'announces', 'announced', 'confirm', 'confirms', 'confirmed',
    'approve', 'approves', 'approved', 'reject', 'rejects', 'rejected',
    'warn', 'warns', 'warned', 'halt', 'halts', 'halted', 'suspend', 'suspends', 'suspended',
    'resume', 'resumes', 'resumed', 'delay', 'delays', 'delayed', 'postpone', 'postpones', 'postponed',
    'extend', 'extends', 'extended', 'expand', 'expands', 'expanded', 'cut', 'cuts',
    'raise', 'raises', 'raised', 'lower', 'lowers', 'lowered', 'increase', 'increases', 'increased',
    'decrease', 'decreases', 'decreased', 'rise', 'rises', 'rose', 'fall', 'falls', 'fell',
    'surge', 'surges', 'surged', 'drop', 'drops', 'dropped', 'tumble', 'tumbles', 'tumbled',
    'soar', 'soars', 'soared', 'crash', 'crashes', 'crashed',
    'acquire', 'acquires', 'acquired', 'merge', 'merges', 'merged', 'buy', 'buys', 'bought',
    'sell', 'sells', 'sold', 'invest', 'invests', 'invested', 'fund', 'funds', 'funded',
    'probe', 'probes', 'probed', 'investigate', 'investigates', 'investigated',
    'sue', 'sues', 'sued', 'fine', 'fines', 'fined', 'arrest', 'arrests', 'arrested',
    'charge', 'charges', 'charged', 'ban', 'bans', 'banned',
    'win', 'wins', 'won', 'lose', 'loses', 'lost', 'beat', 'beats', 'defeat', 'defeats', 'defeated',
    'criticise', 'criticises', 'criticised', 'criticize', 'criticizes', 'criticized',
    'praise', 'praises', 'praised', 'protest', 'protests', 'protested',
    'explain', 'explains', 'explained', 'review', 'reviews', 'reviewed', 'clarify', 'clarifies', 'clarified'
];

function unique(values) {
    return [...new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean))];
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesPhrase(text, phrase) {
    return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(text);
}

function normalizeSymbol(value) {
    return String(value || '').replace(/^[$#]/, '').trim().toUpperCase();
}

function getKnownPhraseMatches(text, phrases) {
    return phrases.filter(phrase => includesPhrase(text, phrase));
}

function extractTitleCasePhrases(text) {
    const phrases = [];
    for (const match of String(text || '').matchAll(TITLE_CASE_PHRASE_RE)) {
        const phrase = match[1].trim();

        if (
            phrase.length >= 4 &&
            !KNOWN_PLACES.includes(phrase) &&
            !KNOWN_ORGS.includes(phrase) &&
            !/^(The|This|That|After|Before|During|With|From|Into|Over|Under)\b/.test(phrase)
        ) {
            phrases.push(phrase);
        }
    }

    return phrases;
}

function extractOrgSuffixes(text) {
    return [...String(text || '').matchAll(ORG_SUFFIX_RE)].map(match => match[1].trim());
}

function extractPeople(text) {
    return [...String(text || '').matchAll(PERSON_RE)].map(match => match[1].trim());
}

function extractProducts(text) {
    return [...String(text || '').matchAll(PRODUCT_HINT_RE)].map(match => match[1].trim());
}

function extractSymbolsFromText(text) {
    return [...String(text || '').matchAll(SYMBOL_RE)].map(match => normalizeSymbol(match[0]));
}

export async function extractEntities(text) {
    const safeText = String(text || '');

    const places = getKnownPhraseMatches(safeText, KNOWN_PLACES);
    const knownOrgs = getKnownPhraseMatches(safeText, KNOWN_ORGS);
    const suffixOrgs = extractOrgSuffixes(safeText);
    const titleCasePhrases = extractTitleCasePhrases(safeText);
    const products = extractProducts(safeText);
    const people = extractPeople(safeText);
    const symbols = extractSymbolsFromText(safeText);

    const orgs = [
        ...knownOrgs,
        ...suffixOrgs,
        ...titleCasePhrases.filter(phrase => {
            if (places.includes(phrase)) return false;
            if (people.includes(phrase)) return false;
            if (products.includes(phrase)) return false;

            return /\b(Bank|Group|Ministry|Court|Agency|Authority|Commission|Board|Council|Company|Corp|Ltd|Limited|Inc|University|Exchange|Police|Office|Committee)\b/.test(phrase) ||
                phrase.split(/\s+/).length >= 2;
        })
    ];

    return {
        people: unique(people),
        orgs: unique(orgs),
        places: unique(places),
        products: unique(products),
        symbols: unique(symbols)
    };
}

export async function extractVerbs(text) {
    const lowerText = String(text || '').toLowerCase();
    const verbs = [];

    for (const verb of NEWS_VERBS) {
        const regex = new RegExp(`\\b${escapeRegExp(verb)}\\b`, 'i');
        if (regex.test(lowerText)) verbs.push(verb);
    }

    return unique(verbs.map(verb => verb.toLowerCase()));
}

export async function extractNumbers(text) {
    const numbers = [];
    const regex = /(?:₹|\$|€|£)?\d+(?:,\d+)*(?:\.\d+)?\s*(?:crore|lakh|million|billion|trillion|thousand|basis points|bps|hours?|days?|weeks?|months?|years?|M|B|K|%|percent|percentage points?|people|customers|users|shares|seats|votes|runs|wickets)?/gi;

    let match;
    while ((match = regex.exec(String(text || ''))) !== null) {
        numbers.push(match[0].trim());
    }

    return unique(numbers);
}

function tokenizeForKeywords(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map(token => token.replace(/^-+|-+$/g, ''))
        .filter(token => token.length >= 4)
        .filter(token => !STOP_WORDS.has(token))
        .filter(token => !/^\d+$/.test(token));
}

export async function extractKeywords(text) {
    const safeText = String(text || '');
    const tokens = tokenizeForKeywords(safeText);
    const entities = await extractEntities(safeText);

    const freq = new Map();

    for (const token of tokens) {
        freq.set(token, (freq.get(token) || 0) + 1);
    }

    const entityTokens = [
        ...entities.orgs,
        ...entities.places,
        ...entities.products,
        ...entities.symbols,
    ]
        .flatMap(value => String(value).toLowerCase().split(/\W+/))
        .filter(token => token.length >= 4)
        .filter(token => !STOP_WORDS.has(token));

    for (const token of entityTokens) {
        freq.set(token, (freq.get(token) || 0) + 2);
    }

    const actionTokens = await extractVerbs(safeText);
    for (const token of actionTokens) {
        freq.set(token, (freq.get(token) || 0) + 1.25);
    }

    return [...freq.entries()]
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
        .map(([token]) => token)
        .slice(0, 12);
}
