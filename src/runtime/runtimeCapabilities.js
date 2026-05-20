// src/runtime/runtimeCapabilities.js
export function getRuntimeCapabilities() {
  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const isStaticHost = /github\.io$/i.test(hostname);
  const backendConfigured = !isStaticHost;

  return {
    isBrowser,
    isStaticHost,
    backendConfigured,
    canUseBackendApi: backendConfigured,
    preferSnapshots: isStaticHost,
    allowWideFeedFetch: !isStaticHost,
    weatherMode: isStaticHost ? 'cache-or-snapshot' : 'live',
    marketMode: isStaticHost ? 'snapshot-first' : 'live',
    upAheadMode: isStaticHost ? 'limited-live' : 'full-live',
    plannerSyncMode: isStaticHost ? 'local-only' : 'remote-capable',
    featureStatus: {
      settings: isStaticHost ? 'local-only' : 'remote-capable',
      planner: isStaticHost ? 'local-only' : 'remote-capable',
      weather: isStaticHost ? 'snapshot-or-cache' : 'live',
      market: isStaticHost ? 'snapshot-or-cache' : 'live',
      upAhead: isStaticHost ? 'limited-live' : 'full-live'
    },
    runtimeLabel: isStaticHost ? 'static-host' : 'full-runtime'
  };
}