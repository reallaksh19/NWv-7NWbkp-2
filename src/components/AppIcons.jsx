/* eslint-disable react-refresh/only-export-components */
import React from 'react';

// Common SVG attributes
const S = 24; // Default size

/**
 * AppIcons Collection
 * Centralized registry for non-weather-condition icons (UI, Market, etc.)
 */

export const MarketIcon = ({ type, size = S, className = '' }) => {
    let content;
    let color = 'currentColor';

    if (type === 'up') {
        color = '#10B981'; // Green-500
        content = <path d="M12 4l-8 8h16l-8-8z" />;
    } else if (type === 'down') {
        color = '#EF4444'; // Red-500
        content = <path d="M12 20l8-8H4l8 8z" />;
    } else {
        color = '#9CA3AF'; // Gray-400
        content = <rect x="4" y="11" width="16" height="2" />;
    }

    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill={color} className={className}>
            {content}
        </svg>
    );
};

export const RefreshIcon = ({ size = S, className = '', onClick }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
        <path d="M23 4v6h-6" />
        <path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

export const LocationIcon = ({ size = S, className = '' }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#EF4444" className={className}>
         <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
);

export const RainIntensityIcon = ({ size = S, className = '' }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
        <path d="M16 13v8" stroke="#3B82F6" />
        <path d="M12 15v6" stroke="#3B82F6" />
        <path d="M8 16v5" stroke="#3B82F6" />
    </svg>
);

export const WarningIcon = ({ size = S, className = '' }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#F59E0B" className={className}>
        <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
    </svg>
);

export const SevereWarningIcon = ({ size = S, className = '' }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#EF4444" className={className}>
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
);

export const HumidityIcon = ({ size = S, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={{ color: '#60a5fa', verticalAlign: 'middle' }}>
        <path d="M12,2 C12,2 7,7 7,10 C7,12.76 9.24,15 12,15 C14.76,15 17,12.76 17,10 C17,7 12,2 12,2 Z" opacity="0.9" />
        <path d="M6,12 C6,12 4,14 4,15.5 C4,16.6 4.9,17.5 6,17.5 C7.1,17.5 8,16.6 8,15.5 C8,14 6,12 6,12 Z" opacity="0.7" />
        <path d="M18,12 C18,12 16,14 16,15.5 C16,16.6 16.9,17.5 18,17.5 C19.1,17.5 20,16.6 20,15.5 C20,14 18,12 18,12 Z" opacity="0.7" />
    </svg>
);

export const WindIcon = ({ size = S, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ color: '#cbd5e1', verticalAlign: 'middle' }}>
        <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
    </svg>
);

export const UmbrellaIcon = ({ size = S, className = '', color = 'currentColor' }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} className={className}>
        <path d="M12 2C6.48 2 2 6.48 2 12h20c0-5.52-4.48-10-10-10z" opacity="1" />
        <path d="M11 12h2v7c0 1.1.9 2 2 2s2-.9 2-2h-2c0 .55-.45 1-1 1s-1-.45-1-1v-7z" opacity="0.8" />
    </svg>
);

export const CloudIcon = ({ size = S, className = '', color = 'currentColor' }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} className={className}>
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
    </svg>
);

// Map of legacy hardcoded emojis to components or IDs
export const getIconForType = (type) => {
    // This can be used if we need to map string types to these components dynamically
    switch (type) {
        case 'rain_intensity': return RainIntensityIcon;
        case 'warning': return WarningIcon;
        case 'severe': return SevereWarningIcon;
        case 'location': return LocationIcon;
        case 'refresh': return RefreshIcon;
        case 'humidity': return HumidityIcon;
        case 'wind': return WindIcon;
        default: return null;
    }
};
