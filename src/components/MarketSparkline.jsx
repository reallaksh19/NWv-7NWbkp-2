import React from 'react';

function normalizeSeries(series = []) {
    return series
        .map((point) => {
            if (typeof point === 'number') return point;
            if (typeof point === 'string') return Number(point);
            if (point && typeof point === 'object') {
                const value = point.close ?? point.value ?? point.price ?? point.y;
                return Number(value);
            }
            return NaN;
        })
        .filter((value) => Number.isFinite(value));
}

function buildPath(values, width = 100, height = 32, padding = 2) {
    if (values.length < 2) return '';

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    return values
        .map((value, index) => {
            const x = padding + (index / (values.length - 1)) * innerWidth;
            const y = padding + innerHeight - ((value - min) / range) * innerHeight;
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');
}

export default function MarketSparkline({ series, positive = true }) {
    const values = normalizeSeries(series);

    if (values.length < 2) {
        return null;
    }

    const path = buildPath(values);
    const lastPoint = values[values.length - 1];
    const firstPoint = values[0];
    const fillPath = `${path} L 98 30 L 2 30 Z`;
    const isUp = lastPoint >= firstPoint;
    const stroke = positive ? 'var(--accent-success)' : 'var(--accent-danger)';
    const area = positive ? 'rgba(63, 185, 80, 0.16)' : 'rgba(255, 71, 87, 0.16)';

    return (
        <svg
            className="market-sparkline"
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <path d={fillPath} fill={area} />
            <path d={path} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle
                cx="98"
                cy={isUp ? 6 : 26}
                r="1.8"
                fill={stroke}
                opacity="0.85"
            />
        </svg>
    );
}
