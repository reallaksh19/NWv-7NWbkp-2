import React from 'react';
import { FaHome } from 'react-icons/fa';
import MarketTicker from './MarketTicker';
import { toggleDevMobileViewOverride, useMediaQuery } from '../hooks/useMediaQuery';

/**
 * Timeline Header
 * Displays the Current Segment info as the title.
 */
const TimelineHeader = ({ title, actions, loadingPhase }) => {
    // User requested to remove "Market Brief" text when ticker is present
    const showTitle = title !== 'Market Brief';
    const { isDevMobileView } = useMediaQuery();
    const isDevMode = import.meta.env.DEV;

    return (
        <header className="header timeline-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                {showTitle && (
                    <h1 className="header__title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                        <span>{title}</span>
                    </h1>
                )}
            </div>

            <MarketTicker loadingPhase={loadingPhase} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {actions}
            </div>
        </header>
    );
};

export default TimelineHeader;
