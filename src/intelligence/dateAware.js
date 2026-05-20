import { extractDate, expandDateKeys } from '../utils/dateExtractor.js';

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function atStartOfDay(input) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(input, days) {
  const d = atStartOfDay(input);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(input) {
  return atStartOfDay(input).toISOString().slice(0, 10);
}

function safeDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : atStartOfDay(d);
}

function chooseReferenceDate({ asOfDate, publishDate } = {}) {
  return safeDate(asOfDate) || safeDate(publishDate) || atStartOfDay(new Date());
}

function inferYearForShortDate(day, month, refDate) {
  const candidate = new Date(refDate.getFullYear(), month - 1, day);
  candidate.setHours(0, 0, 0, 0);

  const threshold = addDays(refDate, -30);
  if (candidate < threshold) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }

  return candidate;
}

function parseShortNumericWithoutYear(text, refDate) {
  const match = String(text || '').match(/\b(\d{1,2})[/-](\d{1,2})(?![/-]\d{2,4})\b/);
  if (!match) return null;

  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a < 1 || a > 31 || b < 1 || b > 12) return null;

  const date = inferYearForShortDate(a, b, refDate);
  return {
    eventDate: date,
    eventDateEnd: null,
    dateConfidence: 'inferred',
    temporalType: 'single',
    matchedText: match[0],
    parser: 'short_numeric_without_year'
  };
}

function parseRelativeWeekWindow(text, refDate) {
  const lower = String(text || '').toLowerCase();

  if (/\bthis week\b/.test(lower)) {
    return {
      eventDate: atStartOfDay(refDate),
      eventDateEnd: addDays(refDate, 6 - refDate.getDay()),
      dateConfidence: 'tentative',
      temporalType: 'range',
      matchedText: 'this week',
      parser: 'relative_this_week'
    };
  }

  if (/\bnext week\b/.test(lower)) {
    const daysToNextMonday = ((8 - refDate.getDay()) % 7) || 7;
    const start = addDays(refDate, daysToNextMonday);
    return {
      eventDate: start,
      eventDateEnd: addDays(start, 6),
      dateConfidence: 'tentative',
      temporalType: 'range',
      matchedText: 'next week',
      parser: 'relative_next_week'
    };
  }

  if (/\bthis weekend\b/.test(lower) || /\bcoming weekend\b/.test(lower)) {
    const daysToSaturday = (6 - refDate.getDay() + 7) % 7;
    const start = addDays(refDate, daysToSaturday);
    return {
      eventDate: start,
      eventDateEnd: addDays(start, 1),
      dateConfidence: 'inferred',
      temporalType: 'range',
      matchedText: /\bcoming weekend\b/.test(lower) ? 'coming weekend' : 'this weekend',
      parser: 'relative_weekend'
    };
  }

  return null;
}

function parseEndsTodayTomorrow(text, refDate) {
  const lower = String(text || '').toLowerCase();

  if (/\b(?:ends?|expires?|valid till|valid until|last date|book by)\s+today\b/.test(lower)) {
    return {
      eventDate: atStartOfDay(refDate),
      eventDateEnd: atStartOfDay(refDate),
      dateConfidence: 'inferred',
      temporalType: 'deadline',
      matchedText: 'today',
      parser: 'deadline_today'
    };
  }

  if (/\b(?:ends?|expires?|valid till|valid until|last date|book by)\s+tomorrow\b/.test(lower)) {
    const next = addDays(refDate, 1);
    return {
      eventDate: atStartOfDay(refDate),
      eventDateEnd: next,
      dateConfidence: 'inferred',
      temporalType: 'deadline',
      matchedText: 'tomorrow',
      parser: 'deadline_tomorrow'
    };
  }

  return null;
}

function parseWeekdayDeadline(text, refDate) {
  const lower = String(text || '').toLowerCase();
  const deadlinePrefix = /\b(?:ends?|expires?|valid till|valid until|last date|book by|before)\b/;
  if (!deadlinePrefix.test(lower)) return null;

  for (let i = 0; i < DOW.length; i += 1) {
    const day = DOW[i];
    if (!new RegExp(`\\b${day}\\b`).test(lower)) continue;

    const diff = ((i - refDate.getDay()) + 7) % 7;
    const target = addDays(refDate, diff === 0 ? 7 : diff);
    return {
      eventDate: atStartOfDay(refDate),
      eventDateEnd: target,
      dateConfidence: 'tentative',
      temporalType: 'deadline',
      matchedText: day,
      parser: 'deadline_weekday'
    };
  }

  return null;
}

function parseWithLegacyExtractor(text, refDate) {
  const result = extractDate(text, refDate);
  if (!result?.start) return null;

  return {
    eventDate: atStartOfDay(result.start),
    eventDateEnd: result.end ? atStartOfDay(result.end) : null,
    dateConfidence: ['iso', 'numeric', 'named'].includes(result.type) ? 'exact' : 'inferred',
    temporalType: result.end ? 'range' : (result.type === 'deadline' ? 'deadline' : 'single'),
    matchedText: null,
    parser: `legacy_${result.type}`,
    legacyType: result.type
  };
}

function hasStrongTemporalSignal(text) {
  return /\b(today|tomorrow|tonight|week|weekend|friday|saturday|sunday|monday|tuesday|wednesday|thursday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ends?|expires?|valid|book by|deadline|last date)\b/i.test(String(text || ''));
}

export function analyzeDateText(text, options = {}) {
  const refDate = chooseReferenceDate(options);
  const candidateText = String(text || '').trim();
  const decisionTrace = [];

  if (!candidateText) {
    return {
      eventDate: null,
      eventDateEnd: null,
      dateConfidence: 'none',
      temporalType: 'none',
      routeHint: 'drop',
      dropReason: 'empty_text',
      matchedDateKeys: [],
      decisionTrace: ['empty_text']
    };
  }

  const parsers = [
    () => parseEndsTodayTomorrow(candidateText, refDate),
    () => parseWeekdayDeadline(candidateText, refDate),
    () => parseRelativeWeekWindow(candidateText, refDate),
    () => parseShortNumericWithoutYear(candidateText, refDate),
    () => parseWithLegacyExtractor(candidateText, refDate)
  ];

  for (const parser of parsers) {
    const result = parser();
    if (!result?.eventDate) continue;

    const dateKeys = expandDateKeys(
      {
        start: result.eventDate,
        end: result.eventDateEnd
      },
      options.maxExpandedDays || 14
    );

    decisionTrace.push(`matched:${result.parser}`);

    return {
      ...result,
      eventDateKey: formatDateKey(result.eventDate),
      eventDateEndKey: result.eventDateEnd ? formatDateKey(result.eventDateEnd) : null,
      matchedDateKeys: dateKeys,
      routeHint: result.dateConfidence === 'tentative' ? 'upahead_possible' : 'eligible',
      parsedDateEvidence: {
        parser: result.parser,
        matchedText: result.matchedText,
        legacyType: result.legacyType || null
      },
      dropReason: null,
      decisionTrace
    };
  }

  const weakSignal = hasStrongTemporalSignal(candidateText);
  return {
    eventDate: null,
    eventDateEnd: null,
    dateConfidence: weakSignal ? 'tentative' : 'none',
    temporalType: weakSignal ? 'weak_signal' : 'none',
    routeHint: weakSignal ? 'upahead_possible' : 'drop',
    dropReason: weakSignal ? 'missing_resolved_date' : 'no_temporal_signal',
    matchedDateKeys: [],
    decisionTrace: [...decisionTrace, weakSignal ? 'weak_temporal_signal' : 'no_temporal_signal']
  };
}

export function classifyPlannerWindow(dateAnalysis, options = {}) {
  const asOfDate = chooseReferenceDate(options);
  const plannerWindowDays = Number.isFinite(options.plannerWindowDays) ? options.plannerWindowDays : 7;
  const start = atStartOfDay(asOfDate);
  const end = addDays(start, plannerWindowDays - 1);

  if (!dateAnalysis?.eventDate) {
    return {
      windowStatus: 'missing_date',
      plannerEligible: false,
      upAheadEligible: dateAnalysis?.routeHint === 'upahead_possible'
    };
  }

  const eventDate = atStartOfDay(dateAnalysis.eventDate);
  if (eventDate < start) {
    return { windowStatus: 'before_window', plannerEligible: false, upAheadEligible: false };
  }
  if (eventDate > end) {
    return { windowStatus: 'after_window', plannerEligible: false, upAheadEligible: true };
  }

  return {
    windowStatus: 'inside_window',
    plannerEligible: dateAnalysis.dateConfidence !== 'tentative',
    upAheadEligible: true
  };
}
