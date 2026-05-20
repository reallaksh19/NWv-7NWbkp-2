import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome } from 'react-icons/fa';
import MarketTicker from './MarketTicker';
import ThemeToggle from './ThemeToggle';
import { toggleDevMobileViewOverride, useMediaQuery } from '../hooks/useMediaQuery';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities';

export function DataStatePill({ mode, label }) {
    if (!mode) return null;
    return <span className={`data-pill data-pill--${mode}`}>{label}</span>;
}

/**
 * Header Component with optional back navigation
 */
function Header({ title, showBack = false, backTo = '/', actions, pills, activePill, onPillChange, compact = false, loadingPhase }) {
    const { isDesktop, isDevMobileView } = useMediaQuery();
    const isDevMode = import.meta.env.DEV;
    const runtime = getRuntimeCapabilities();

    // Icon Mapping helper
    const getPillIcon = (pillName) => {
        if (pillName.includes('Morning')) return '🌅';
        if (pillName.includes('Midday')) return '☀️';
        if (pillName.includes('Evening')) return '🌙';
        return pillName;
    };

    return (
        <header className={`header ${compact ? 'header--compact' : ''}`}>
            {/* Left Side: Back or Theme Toggle (PC Only) */}
            {showBack ? (
                <Link to={backTo} className="header__back">
                    <span>←</span>
                    <span>{title}</span>
                </Link>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isDesktop && <ThemeToggle />}
                    {isDevMode && (
                        <button
                            type="button"
                            className={`header__action-btn header__dev-toggle ${isDevMobileView ? 'header__dev-toggle--active' : ''}`}
                            onClick={toggleDevMobileViewOverride}
                            title={isDevMobileView ? 'Return to desktop view' : 'Force mobile view'}
                            aria-pressed={isDevMobileView}
                        >
                            <FaHome aria-hidden="true" />
                        </button>
                    )}
                    {runtime.isStaticHost && (
                        <span
                            className="runtime-badge runtime-badge--icon-only"
                            title="Static-host mode: snapshot/cache-first behavior is active."
                            aria-label="Static-host mode"
                        >
                            📦
                        </span>
                    )}
                    <h1 className="header__title">
                        {title}
                    </h1>
                </div>
            )}

            {!showBack && <MarketTicker loadingPhase={loadingPhase} />}

            {/* Contextual Pills (Classic Mode) */}
            {pills && (
                <div className="header__pills">
                    {pills.map((pill) => (
                        <button
                            key={pill}
                            className={`time-pill time-pill--matte ${activePill === pill ? 'time-pill--active' : ''}`}
                            onClick={() => onPillChange && onPillChange(pill)}
                            title={pill}
                        >
                            {getPillIcon(pill)}
                        </button>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {actions}
                {!showBack && (
                    <Link to="/more" className="header__action-btn" title="More Options">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </Link>
                )}
            </div>
        </header>
    );
}

export default Header;
