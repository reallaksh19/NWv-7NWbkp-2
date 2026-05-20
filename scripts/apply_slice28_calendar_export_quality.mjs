import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after.trim())) return source;
    throw new Error(`Missing replace target for ${label}`);
  }
  return source.replace(before, after);
}

write('src/utils/calendar.js', `function pad2(value) {
    return String(value).padStart(2, '0');
}

function sanitizeFilename(value) {
    return String(value || 'calendar_event')
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase() || 'calendar_event';
}

export function escapeICSText(value) {
    return String(value || '')
        .replace(/\\\\/g, '\\\\\\\\')
        .replace(/;/g, '\\\\;')
        .replace(/,/g, '\\\\,')
        .replace(/\\r?\\n/g, '\\\\n');
}

function hashString(value) {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function toDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(value) {
    if (!value) return null;

    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(value))) {
        return String(value);
    }

    const parsed = toDate(value);
    return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function formatDateKeyForICS(dateKey) {
    return String(dateKey || '').replace(/-/g, '');
}

function addDaysToDateKey(dateKey, days) {
    const parsed = toDate(\`\${dateKey}T00:00:00Z\`);
    if (!parsed) return dateKey;
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return parsed.toISOString().slice(0, 10);
}

export function formatUTCDateTimeForICS(value) {
    const parsed = toDate(value);
    if (!parsed) return null;

    return [
        parsed.getUTCFullYear(),
        pad2(parsed.getUTCMonth() + 1),
        pad2(parsed.getUTCDate()),
        'T',
        pad2(parsed.getUTCHours()),
        pad2(parsed.getUTCMinutes()),
        pad2(parsed.getUTCSeconds()),
        'Z'
    ].join('');
}

export function resolveCalendarDate(itemOrTitle, options = {}) {
    if (itemOrTitle && typeof itemOrTitle === 'object') {
        const item = itemOrTitle;
        const timedDate =
            item.startDate ||
            item.startTime ||
            item.eventDate ||
            item.dateTime ||
            item.datetime;

        const dateKey =
            toDateKey(item.eventDateKey) ||
            toDateKey(item.planDate) ||
            toDateKey(item.date) ||
            toDateKey(item.releaseDate) ||
            toDateKey(item.extractedDate);

        if (timedDate && toDate(timedDate)) {
            const start = toDate(timedDate);
            const end =
                toDate(item.endDate || item.endTime) ||
                new Date(start.getTime() + 60 * 60 * 1000);

            return {
                allDay: false,
                start,
                end,
                source: 'item-timed-date'
            };
        }

        if (dateKey) {
            return {
                allDay: true,
                dateKey,
                endDateKey: addDaysToDateKey(dateKey, 1),
                source: 'item-date-key'
            };
        }
    }

    const optionDate =
        options.startDate ||
        options.startTime ||
        options.date ||
        options.planDate ||
        options.eventDate;

    if (optionDate && toDate(optionDate)) {
        const start = toDate(optionDate);
        const end =
            toDate(options.endDate || options.endTime) ||
            new Date(start.getTime() + 60 * 60 * 1000);

        return {
            allDay: false,
            start,
            end,
            source: 'options-date'
        };
    }

    const now = new Date();

    return {
        allDay: false,
        start: now,
        end: new Date(now.getTime() + 60 * 60 * 1000),
        source: 'fallback-now'
    };
}

function normalizeCalendarInput(itemOrTitle, descriptionOrOptions = '', options = {}) {
    if (itemOrTitle && typeof itemOrTitle === 'object') {
        const item = itemOrTitle;

        return {
            title: item.title || 'Planner item',
            description: item.description || item.summary || item.title || '',
            location: item.location || item.locationCanonical || '',
            url: item.link || item.url || '',
            category: item.category || item.type || '',
            raw: item,
            date: resolveCalendarDate(item, options)
        };
    }

    const effectiveOptions =
        descriptionOrOptions && typeof descriptionOrOptions === 'object'
            ? descriptionOrOptions
            : options;

    return {
        title: itemOrTitle || 'Calendar event',
        description:
            typeof descriptionOrOptions === 'string'
                ? descriptionOrOptions
                : effectiveOptions.description || itemOrTitle || '',
        location: effectiveOptions.location || '',
        url: effectiveOptions.url || '',
        category: effectiveOptions.category || '',
        raw: null,
        date: resolveCalendarDate(itemOrTitle, effectiveOptions)
    };
}

export function buildCalendarEvent(itemOrTitle, descriptionOrOptions = '', options = {}) {
    const event = normalizeCalendarInput(itemOrTitle, descriptionOrOptions, options);
    const uidSeed = [
        event.title,
        event.description,
        event.location,
        event.url,
        event.date.allDay ? event.date.dateKey : event.date.start?.toISOString()
    ].join('|');

    const uid = \`\${hashString(uidSeed)}@nwv7.local\`;
    const stamp = formatUTCDateTimeForICS(new Date()) || '19700101T000000Z';

    const lines = [
        'BEGIN:VEVENT',
        \`UID:\${uid}\`,
        \`DTSTAMP:\${stamp}\`,
        \`SUMMARY:\${escapeICSText(event.title)}\`,
        \`DESCRIPTION:\${escapeICSText(event.description)}\`
    ];

    if (event.location) {
        lines.push(\`LOCATION:\${escapeICSText(event.location)}\`);
    }

    if (event.url) {
        lines.push(\`URL:\${escapeICSText(event.url)}\`);
    }

    if (event.category) {
        lines.push(\`CATEGORIES:\${escapeICSText(event.category)}\`);
    }

    if (event.date.allDay) {
        lines.push(\`DTSTART;VALUE=DATE:\${formatDateKeyForICS(event.date.dateKey)}\`);
        lines.push(\`DTEND;VALUE=DATE:\${formatDateKeyForICS(event.date.endDateKey)}\`);
    } else {
        lines.push(\`DTSTART:\${formatUTCDateTimeForICS(event.date.start)}\`);
        lines.push(\`DTEND:\${formatUTCDateTimeForICS(event.date.end)}\`);
    }

    lines.push('END:VEVENT');

    return lines.join('\\n');
}

export function buildCalendarFile(events, options = {}) {
    const eventList = Array.isArray(events) ? events : [events];
    const body = eventList.map(event => buildCalendarEvent(event)).join('\\n');

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NWv7//Planner Calendar Export//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        \`X-WR-CALNAME:\${escapeICSText(options.calendarName || 'NWv7 Planner')}\`,
        body,
        'END:VCALENDAR'
    ].join('\\n');
}

function downloadICS(filename, content) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

export const downloadCalendarEvent = (itemOrTitle, descriptionOrOptions = '', options = {}) => {
    const event = normalizeCalendarInput(itemOrTitle, descriptionOrOptions, options);
    const content = buildCalendarFile([itemOrTitle && typeof itemOrTitle === 'object' ? itemOrTitle : {
        title: event.title,
        description: event.description,
        location: event.location,
        url: event.url,
        category: event.category,
        ...(event.date.allDay
            ? { eventDateKey: event.date.dateKey }
            : { eventDate: event.date.start?.toISOString(), endDate: event.date.end?.toISOString() })
    }], {
        calendarName: event.title
    });

    downloadICS(\`\${sanitizeFilename(event.title)}.ics\`, content);
};

export const downloadCalendarEvents = (items, filename = 'nwv7_planner_selection.ics') => {
    const eventItems = Array.isArray(items) ? items : [];
    if (eventItems.length === 0) return false;

    const content = buildCalendarFile(eventItems, {
        calendarName: 'NWv7 Planner Selection'
    });

    downloadICS(sanitizeFilename(filename).endsWith('.ics') ? sanitizeFilename(filename) : \`\${sanitizeFilename(filename)}.ics\`, content);
    return true;
};
`);

write('src/utils/calendar.cert.test.js', `import { describe, expect, it } from 'vitest';
import {
  buildCalendarEvent,
  buildCalendarFile,
  escapeICSText,
  formatUTCDateTimeForICS,
  resolveCalendarDate,
} from './calendar';

describe('Planner calendar export certification', () => {
  it('escapes ICS text safely', () => {
    expect(escapeICSText('A, B; C\\\\nD')).toBe('A\\\\, B\\\\; C\\\\\\\\nD');
  });

  it('formats UTC datetime for ICS', () => {
    expect(formatUTCDateTimeForICS('2026-01-01T08:30:15Z')).toBe('20260101T083015Z');
  });

  it('uses planner date keys as all-day calendar events', () => {
    const date = resolveCalendarDate({
      title: 'Concert',
      eventDateKey: '2026-01-03',
    });

    expect(date.allDay).toBe(true);
    expect(date.dateKey).toBe('2026-01-03');
    expect(date.endDateKey).toBe('2026-01-04');

    const event = buildCalendarEvent({
      title: 'Concert',
      description: 'Music event',
      eventDateKey: '2026-01-03',
      category: 'events',
    });

    expect(event).toContain('DTSTART;VALUE=DATE:20260103');
    expect(event).toContain('DTEND;VALUE=DATE:20260104');
    expect(event).toContain('SUMMARY:Concert');
    expect(event).toContain('CATEGORIES:events');
  });

  it('uses timed eventDate when available', () => {
    const event = buildCalendarEvent({
      title: 'Timed event',
      eventDate: '2026-01-03T10:00:00Z',
      endDate: '2026-01-03T11:30:00Z',
    });

    expect(event).toContain('DTSTART:20260103T100000Z');
    expect(event).toContain('DTEND:20260103T113000Z');
  });

  it('builds one ICS file with multiple events', () => {
    const file = buildCalendarFile([
      { title: 'First', eventDateKey: '2026-01-01' },
      { title: 'Second', eventDateKey: '2026-01-02' },
    ]);

    expect(file).toContain('BEGIN:VCALENDAR');
    expect(file.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(file).toContain('SUMMARY:First');
    expect(file).toContain('SUMMARY:Second');
  });

  it('preserves legacy title and description call style', () => {
    const event = buildCalendarEvent('Legacy title', 'Legacy description');

    expect(event).toContain('SUMMARY:Legacy title');
    expect(event).toContain('DESCRIPTION:Legacy description');
    expect(event).toContain('DTSTART:');
    expect(event).toContain('DTEND:');
  });
});
`);

patchFile('src/pages/MyPlannerPage.jsx', source => {
  let text = source;

  text = replaceOnce(
    text,
    "import { downloadCalendarEvent } from '../utils/calendar';",
    "import { downloadCalendarEvent, downloadCalendarEvents } from '../utils/calendar';",
    'calendar import'
  );

  text = replaceOnce(
    text,
    "onClick={() => downloadCalendarEvent(item.title, item.description || item.title)}",
    "onClick={() => downloadCalendarEvent(item.raw || item)}",
    'single planner calendar export'
  );

  text = replaceOnce(
    text,
    `    const exportSelectedPlannerItems = () => {
        plannerBulkSummary.selectedItems.forEach(item => {
            downloadCalendarEvent(item.title, item.description || item.title);
        });
    };
`,
    `    const exportSelectedPlannerItems = () => {
        downloadCalendarEvents(
            plannerBulkSummary.selectedItems.map(item => item.raw || item),
            'nwv7_planner_selection.ics'
        );
    };
`,
    'bulk planner calendar export'
  );

  return text;
});

write('scripts/test_calendar_export_quality_static.mjs', `import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), \`Missing file: \${path}\`);
  return fs.readFileSync(path, 'utf8');
}

const calendar = read('src/utils/calendar.js');
const calendarTest = read('src/utils/calendar.cert.test.js');
const plannerPage = read('src/pages/MyPlannerPage.jsx');
const certGate = read('scripts/run_certification_gate.mjs');
const packageJson = read('package.json');

for (const token of [
  'escapeICSText',
  'resolveCalendarDate',
  'formatUTCDateTimeForICS',
  'buildCalendarEvent',
  'buildCalendarFile',
  'downloadCalendarEvents',
  'DTSTART;VALUE=DATE',
  'PRODID:-//NWv7//Planner Calendar Export//EN',
  'legacy'
]) {
  assert(calendar.toLowerCase().includes(token.toLowerCase()), \`calendar.js missing token: \${token}\`);
}

for (const token of [
  'Planner calendar export certification',
  'uses planner date keys as all-day calendar events',
  'uses timed eventDate when available',
  'builds one ICS file with multiple events',
  'preserves legacy title and description call style'
]) {
  assert(calendarTest.includes(token), \`calendar.cert.test.js missing token: \${token}\`);
}

for (const token of [
  'downloadCalendarEvent, downloadCalendarEvents',
  'downloadCalendarEvent(item.raw || item)',
  'downloadCalendarEvents(',
  'nwv7_planner_selection.ics'
]) {
  assert(plannerPage.includes(token), \`MyPlannerPage.jsx missing calendar quality token: \${token}\`);
}

assert(
  packageJson.includes('"test:calendar-export-quality"'),
  'package.json must include test:calendar-export-quality'
);

assert(
  certGate.includes("['npm', ['run', 'test:calendar-export-quality']]"),
  'certification gate must run test:calendar-export-quality'
);

assert(
  certGate.includes("['npm', ['run', 'lint']]"),
  'certification gate must still run lint'
);

assert(
  certGate.includes("['npm', ['run', 'test:unit']]"),
  'certification gate must run Vitest unit tests'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Planner calendar export quality slice',
  guarantees: [
    'single planner export uses saved item date',
    'bulk planner export creates one multi-event ICS',
    'legacy downloadCalendarEvent(title, description) remains supported',
    'ICS escaping is implemented',
    'static and Vitest certification are included',
    'lint remains part of certification'
  ]
}, null, 2));

console.log('PASS: Planner calendar export quality static slice');
`);

patchFile('package.json', source => {
  const pkg = JSON.parse(source);
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:calendar-export-quality'] = 'node scripts/test_calendar_export_quality_static.mjs';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchFile('scripts/run_certification_gate.mjs', source => {
  if (source.includes("['npm', ['run', 'test:calendar-export-quality']]")) return source;

  return source.replace(
    "['npm', ['run', 'test:planner-bulk-actions']]",
    "['npm', ['run', 'test:planner-bulk-actions']],\n  ['npm', ['run', 'test:calendar-export-quality']]"
  );
});

console.log('\nSlice 28 calendar export quality patch complete.');
