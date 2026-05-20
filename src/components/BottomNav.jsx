import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';

const ALL_NAV_ITEMS = [
  { path: '/', label: 'Main', icon: '🏠' },
  { path: '/insight', label: 'Insight', icon: '📊' },
  { path: '/up-ahead', label: 'Up Ahead', icon: '🗓️' },
  { path: '/my-planner', label: 'Planner', icon: '📌' },
  { path: '/markets', label: 'Market', icon: '📈' },
  { path: '/weather', label: 'Weather', icon: '☁️' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
  { path: '/newspaper', label: 'Newspaper', icon: '📰' },
  { path: '/tech-social', label: 'Buzz', icon: '🎭' },
  { path: '/following', label: 'Following', icon: '⭐' },
  { path: '/refresh', label: 'Refresh', icon: '🔄' },
  { path: '/more', label: 'More', icon: '⋯' }
];

function isActivePath(pathname, itemPath) {
  if (itemPath === '/') return pathname === '/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function BottomNav() {
  const {
    isWebView,
    layoutMode,
    layoutReason,
    layoutOverride,
    setLayoutModeOverride
  } = useMediaQuery();

  const location = useLocation();

  // Critical fix:
  // layoutMode is the resolved truth. isWebView alone is not enough because
  // the user can force desktop mode while viewport detection still reports mobile.
  const isDesktopNav = isWebView || layoutMode === 'desktop';

  const cycleLayoutMode = () => {
    if (layoutOverride === 'desktop') setLayoutModeOverride('auto');
    else setLayoutModeOverride('desktop');
  };

  return (
    <nav
      className={`bottom-nav ${isDesktopNav ? 'bottom-nav--desktop' : 'bottom-nav--mobile'}`}
      data-layout-mode={layoutMode}
      data-layout-reason={layoutReason}
      data-layout-override={layoutOverride || 'auto'}
      data-nav-item-count={ALL_NAV_ITEMS.length}
      aria-label={isDesktopNav ? 'Desktop navigation' : 'Mobile navigation'}
    >
      {isDesktopNav && (
        <div className="bottom-nav__brand" title={`Layout: ${layoutMode} (${layoutReason})`}>
          <span className="bottom-nav__brand-mark">NW</span>
          <span className="bottom-nav__brand-text">News Desk</span>
        </div>
      )}

      <div className="bottom-nav__items" role="list">
        {ALL_NAV_ITEMS.map((item) => {
          const isActive = isActivePath(location.pathname, item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`bottom-nav__item ${isActive ? 'active' : ''}`}
              title={item.label}
              aria-label={item.label}
              role="listitem"
            >
              <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
              <span className="bottom-nav__label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <button
        type="button"
        className="bottom-nav__layout-toggle"
        onClick={cycleLayoutMode}
        title={`Layout: ${layoutMode}. Click to ${layoutOverride === 'desktop' ? 'return to Auto' : 'force Desktop'}.`}
        aria-label={layoutOverride === 'desktop' ? 'Return layout to auto mode' : 'Force desktop layout'}
      >
        {layoutOverride === 'desktop' ? 'Auto' : 'Desktop'}
      </button>
    </nav>
  );
}

export default BottomNav;