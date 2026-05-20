function pad2(value) {
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
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
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

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        return String(value);
    }

    const parsed = toDate(value);
    return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function formatDateKeyForICS(dateKey) {
    return String(dateKey || '').replace(/-/g, '');
}

function addDaysToDateKey(dateKey, days) {
    const parsed = toDate(`${dateKey}T00:00:00Z`);
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

    const uid = `${hashString(uidSeed)}@nwv7.local`;
    const stamp = formatUTCDateTimeForICS(new Date()) || '19700101T000000Z';

    const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `SUMMARY:${escapeICSText(event.title)}`,
        `DESCRIPTION:${escapeICSText(event.description)}`
    ];

    if (event.location) {
        lines.push(`LOCATION:${escapeICSText(event.location)}`);
    }

    if (event.url) {
        lines.push(`URL:${escapeICSText(event.url)}`);
    }

    if (event.category) {
        lines.push(`CATEGORIES:${escapeICSText(event.category)}`);
    }

    if (event.date.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${formatDateKeyForICS(event.date.dateKey)}`);
        lines.push(`DTEND;VALUE=DATE:${formatDateKeyForICS(event.date.endDateKey)}`);
    } else {
        lines.push(`DTSTART:${formatUTCDateTimeForICS(event.date.start)}`);
        lines.push(`DTEND:${formatUTCDateTimeForICS(event.date.end)}`);
    }

    lines.push('END:VEVENT');

    return lines.join('\n');
}

export function buildCalendarFile(events, options = {}) {
    const eventList = Array.isArray(events) ? events : [events];
    const body = eventList.map(event => buildCalendarEvent(event)).join('\n');

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NWv7//Planner Calendar Export//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeICSText(options.calendarName || 'NWv7 Planner')}`,
        body,
        'END:VCALENDAR'
    ].join('\n');
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

    downloadICS(`${sanitizeFilename(event.title)}.ics`, content);
};

export const downloadCalendarEvents = (items, filename = 'nwv7_planner_selection.ics') => {
    const eventItems = Array.isArray(items) ? items : [];
    if (eventItems.length === 0) return false;

    const content = buildCalendarFile(eventItems, {
        calendarName: 'NWv7 Planner Selection'
    });

    const rawFilename = String(filename || 'nwv7_planner_selection.ics');
    const hasIcsExtension = rawFilename.toLowerCase().endsWith('.ics');
    const baseName = hasIcsExtension ? rawFilename.slice(0, -4) : rawFilename;
    const safeFilename = `${sanitizeFilename(baseName)}.ics`;

    downloadICS(safeFilename, content);
    return true;
};
