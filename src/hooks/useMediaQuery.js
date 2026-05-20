import { useState, useEffect, useSyncExternalStore } from 'react';

const DEV_MOBILE_VIEW_KEY = 'dailyEventAI_dev_mobile_view';
const DEV_MOBILE_VIEW_EVENT = 'daily-event-ai:dev-mobile-view-change';

const LAYOUT_OVERRIDE_KEY = 'nwv7_layout_mode';
const LAYOUT_OVERRIDE_EVENT = 'nwv7:layout-mode-change';

function isDevMode() {
  return import.meta.env.DEV;
}

function canUseWindow() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getViewportMetrics() {
  if (!canUseWindow()) {
    return {
      width: 0,
      height: 0,
      screenWidth: 0,
      visualWidth: 0,
      devicePixelRatio: 1,
      hasFinePointer: false,
      canHover: false,
      desktopLikeUA: false
    };
  }

  const width = Math.max(
    window.innerWidth || 0,
    document.documentElement?.clientWidth || 0,
    window.visualViewport?.width || 0
  );

  const height = Math.max(
    window.innerHeight || 0,
    document.documentElement?.clientHeight || 0,
    window.visualViewport?.height || 0
  );

  const screenWidth = Math.max(
    window.screen?.width || 0,
    window.screen?.availWidth || 0
  );

  const ua = window.navigator?.userAgent || '';
  const uaMobile = /Mobile|Android.*Mobile|iPhone|iPod/i.test(ua);

  return {
    width,
    height,
    screenWidth,
    visualWidth: window.visualViewport?.width || width,
    devicePixelRatio: window.devicePixelRatio || 1,
    hasFinePointer: window.matchMedia?.('(pointer: fine)').matches || false,
    canHover: window.matchMedia?.('(hover: hover)').matches || false,
    desktopLikeUA: !uaMobile
  };
}

function getDevMobileViewSnapshot() {
  if (!isDevMode() || !canUseWindow()) return false;
  return localStorage.getItem(DEV_MOBILE_VIEW_KEY) === '1';
}

export function isDevMobileViewForced() {
  return getDevMobileViewSnapshot();
}

function getLayoutOverrideSnapshot() {
  if (!canUseWindow()) return 'auto';

  const metrics = getViewportMetrics();
  const value = localStorage.getItem(LAYOUT_OVERRIDE_KEY);

  if (value !== 'desktop' && value !== 'mobile') return 'auto';

  /*
   * Critical fix:
   * If the app is opened on a real desktop-width browser, do not allow an old
   * persisted "mobile" override to trap the production site in mobile layout.
   */
  if (value === 'mobile' && metrics.width >= 1024 && !isDevMode()) {
    localStorage.removeItem(LAYOUT_OVERRIDE_KEY);
    return 'auto';
  }

  return value;
}

function subscribeDevMobileView(callback) {
  if (!isDevMode() || !canUseWindow()) return () => {};

  const handler = (event) => {
    if (event.type === 'storage' && event.key !== DEV_MOBILE_VIEW_KEY) return;
    callback();
  };

  window.addEventListener('storage', handler);
  window.addEventListener(DEV_MOBILE_VIEW_EVENT, handler);

  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(DEV_MOBILE_VIEW_EVENT, handler);
  };
}

function subscribeLayoutOverride(callback) {
  if (!canUseWindow()) return () => {};

  const handler = (event) => {
    if (event.type === 'storage' && event.key !== LAYOUT_OVERRIDE_KEY) return;
    callback();
  };

  window.addEventListener('storage', handler);
  window.addEventListener(LAYOUT_OVERRIDE_EVENT, handler);

  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(LAYOUT_OVERRIDE_EVENT, handler);
  };
}

export function setLayoutModeOverride(mode = 'auto') {
  if (!canUseWindow()) return 'auto';

  const normalized = mode === 'desktop' || mode === 'mobile' ? mode : 'auto';

  if (normalized === 'auto') {
    localStorage.removeItem(LAYOUT_OVERRIDE_KEY);
  } else {
    localStorage.setItem(LAYOUT_OVERRIDE_KEY, normalized);
  }

  window.dispatchEvent(new Event(LAYOUT_OVERRIDE_EVENT));
  return normalized;
}

export function setDevMobileViewOverride(enabled) {
  if (!isDevMode() || !canUseWindow()) return false;

  if (enabled) {
    localStorage.setItem(DEV_MOBILE_VIEW_KEY, '1');
  } else {
    localStorage.removeItem(DEV_MOBILE_VIEW_KEY);
  }

  window.dispatchEvent(new Event(DEV_MOBILE_VIEW_EVENT));
  return enabled;
}

export function toggleDevMobileViewOverride() {
  return setDevMobileViewOverride(!getDevMobileViewSnapshot());
}

export function resolveLayoutMode({ isDevMobileView = false, layoutOverride = 'auto' } = {}) {
  const metrics = getViewportMetrics();

  const widthDesktop = metrics.width >= 1024;
  const widthTablet = metrics.width >= 768 && metrics.width < 1024;
  const desktopCapable = metrics.desktopLikeUA || (metrics.hasFinePointer && metrics.canHover);

  if (layoutOverride === 'desktop') {
    return {
      ...metrics,
      isDesktop: true,
      isTablet: false,
      isWebView: true,
      layoutMode: 'desktop',
      reason: 'override-desktop'
    };
  }

  if (layoutOverride === 'mobile' || isDevMobileView) {
    /*
     * Keep mobile override only below desktop width. On a real desktop viewport,
     * production must be desktop.
     */
    if (!isDevMode() && widthDesktop) {
      return {
        ...metrics,
        isDesktop: true,
        isTablet: false,
        isWebView: true,
        layoutMode: 'desktop',
        reason: 'desktop-width-overrode-stale-mobile'
      };
    }

    return {
      ...metrics,
      isDesktop: false,
      isTablet: false,
      isWebView: false,
      layoutMode: 'mobile',
      reason: layoutOverride === 'mobile' ? 'override-mobile' : 'dev-mobile-override'
    };
  }

  const desktop = widthDesktop || (desktopCapable && metrics.width >= 900);
  const tablet = !desktop && (widthTablet || (desktopCapable && metrics.width >= 700));

  return {
    ...metrics,
    isDesktop: desktop,
    isTablet: tablet,
    isWebView: desktop,
    layoutMode: desktop ? 'desktop' : tablet ? 'tablet' : 'mobile',
    reason: desktop
      ? widthDesktop ? 'width-desktop' : 'desktop-capable'
      : tablet ? 'tablet-width' : 'mobile-width'
  };
}

export function useMediaQuery() {
  const initial = resolveLayoutMode();
  const [layoutState, setLayoutState] = useState(initial);

  const isDevMobileView = useSyncExternalStore(
    subscribeDevMobileView,
    getDevMobileViewSnapshot,
    getDevMobileViewSnapshot
  );

  const layoutOverride = useSyncExternalStore(
    subscribeLayoutOverride,
    getLayoutOverrideSnapshot,
    getLayoutOverrideSnapshot
  );

  useEffect(() => {
    const handleResize = () => {
      const next = resolveLayoutMode({ isDevMobileView, layoutOverride });
      setLayoutState(next);

      if (canUseWindow()) {
        document.documentElement.dataset.layoutMode = next.layoutMode;
        document.documentElement.dataset.layoutReason = next.reason;
        document.documentElement.dataset.viewportWidth = String(next.width);
      }

      console.log(
        `[Layout] width=${next.width}px mode=${next.layoutMode} reason=${next.reason}`
      );
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isDevMobileView, layoutOverride]);

  return {
    isDesktop: layoutState.isDesktop,
    isTablet: layoutState.isTablet,
    isWebView: layoutState.isWebView,
    screenWidth: layoutState.width,
    isDevMobileView,
    layoutMode: layoutState.layoutMode,
    layoutReason: layoutState.reason,
    layoutOverride,
    setLayoutModeOverride
  };
}
