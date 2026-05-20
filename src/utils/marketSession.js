const MARKET_TIME_ZONE = 'Asia/Kolkata';
const MARKET_OPEN_MINUTES = 9 * 60 + 15;
const MARKET_CLOSE_MINUTES = 15 * 60 + 30;

function getIstParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: MARKET_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        weekday: map.weekday,
        hour: Number(map.hour),
        minute: Number(map.minute)
    };
}

function buildIstDateKey(parts) {
    return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function normalizeHolidayList(tradingHolidays = []) {
    return new Set(
        tradingHolidays
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    );
}

export function getMarketSessionState({
    now = new Date(),
    lastUpdated = null,
    tradingHolidays = []
} = {}) {
    const parts = getIstParts(now);
    const currentMinutes = parts.hour * 60 + parts.minute;
    const isWeekend = parts.weekday === 'Sat' || parts.weekday === 'Sun';
    const holidaySet = normalizeHolidayList(tradingHolidays);
    const todayKey = buildIstDateKey(parts);
    const isHoliday = holidaySet.has(todayKey);

    const ageMs = lastUpdated ? Math.max(0, now.getTime() - lastUpdated) : Infinity;
    const ageMinutes = Number.isFinite(ageMs) ? Math.round(ageMs / 60000) : null;

    const ageLabel = ageMinutes === null
        ? '--'
        : ageMinutes < 60
            ? `${ageMinutes}m ago`
            : `${Math.round(ageMinutes / 60)}h ago`;

    if (isWeekend || isHoliday) {
        return {
            label: 'Closed',
            tone: 'muted',
            reason: isWeekend ? 'Weekend' : 'Holiday',
            isOpen: false,
            ageLabel,
            ageMinutes
        };
    }

    if (currentMinutes < MARKET_OPEN_MINUTES || currentMinutes > MARKET_CLOSE_MINUTES) {
        return {
            label: 'After Hours',
            tone: 'warning',
            reason: 'Outside NSE session',
            isOpen: false,
            ageLabel,
            ageMinutes
        };
    }

    if (!Number.isFinite(ageMs)) {
        return {
            label: 'Delayed',
            tone: 'warning',
            reason: 'No freshness timestamp',
            isOpen: true,
            ageLabel,
            ageMinutes
        };
    }

    if (ageMs <= 15 * 60 * 1000) {
        return {
            label: 'Live',
            tone: 'success',
            reason: 'Fresh market feed',
            isOpen: true,
            ageLabel,
            ageMinutes
        };
    }

    if (ageMs <= 4 * 60 * 60 * 1000) {
        return {
            label: 'Delayed',
            tone: 'warning',
            reason: 'Older than 15 minutes',
            isOpen: true,
            ageLabel,
            ageMinutes
        };
    }

    return {
        label: 'Expired',
        tone: 'danger',
        reason: 'Older than 4 hours',
        isOpen: true,
        ageLabel,
        ageMinutes
    };
}
