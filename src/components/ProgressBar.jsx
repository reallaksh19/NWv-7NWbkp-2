import React from 'react';

/**
 * Sleek, indeterminate progress bar (Apple/Instagram style)
 * Used for section-specific loading states
 */
const ProgressBar = ({ active = false, color = 'var(--accent-primary)', style = {} }) => {
    if (!active) return null;

    return (
        <div style={{
            position: 'relative',
            height: '2px',
            width: '100%',
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.1)',
            ...style
        }}>
            <div className="progress-bar-shim" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: '100%',
                background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                transform: 'translateX(-100%)',
                animation: 'shim-infinite 1.5s infinite linear'
            }} />
            <style>{`
                @keyframes shim-infinite {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default ProgressBar;
