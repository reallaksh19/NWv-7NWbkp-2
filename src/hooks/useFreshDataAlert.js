/**
 * useFreshDataAlert.js
 *
 * Detects planning-relevant changes between the currently-displayed UpAhead data
 * and newly-fetched data, and surfaces a non-intrusive popup only when something
 * actionable changed.
 *
 * "Planning-relevant" means:
 *   1. New alert(s) that weren't in the current view
 *   2. New event(s) starting within the next 3 days that weren't in the current view
 *   3. Currently-displayed offer(s) expiring within 24 h
 *
 * It deliberately does NOT trigger on generic news article updates.
 * Popup text: "🗓 Updates for your week · Review now"
 */

import { useCallback, useState } from 'react';

const DAY_MS = 86_400_000;

/**
 * Determine whether freshData contains anything worth surfacing as a popup.
 *
 * @param {object|null} currentData  The data currently rendered (sections shape)
 * @param {object|null} freshData    Newly-fetched data (same sections shape)
 * @returns {boolean}
 */
function hasPlanningRelevantUpdate(currentData, freshData) {
  if (!freshData) return false;

  // 1. New alerts
  const currentAlertIds = new Set((currentData?.alerts ?? []).map((a) => a.id));
  const newAlerts = (freshData.alerts ?? []).filter((a) => !currentAlertIds.has(a.id));

  // 2. New near-future events (within 3 days)
  const now = Date.now();
  const currentEventIds = new Set((currentData?.events ?? []).map((e) => e.id));
  const newNearEvents = (freshData.events ?? []).filter(
    (e) =>
      e.eventStartAt &&
      Number(e.eventStartAt) - now < 3 * DAY_MS &&
      Number(e.eventStartAt) > now &&
      !currentEventIds.has(e.id)
  );

  // 3. Expiring offers in currently-shown data
  const expiringOffers = (currentData?.shopping ?? []).filter(
    (o) => o.expiryAt && Number(o.expiryAt) < now + DAY_MS
  );

  return newAlerts.length > 0 || newNearEvents.length > 0 || expiringOffers.length > 0;
}

/**
 * Hook for managing the "fresh data available" popup.
 *
 * @param {object} options
 * @param {object|null} options.currentData  Currently displayed UpAhead sections data
 * @param {Function}    options.onFreshData  Callback to apply fresh data to state
 *
 * @returns {{
 *   freshPayload: object|null,
 *   notifyFresh:  (freshData: object) => void,
 *   acceptFresh:  () => void,
 *   dismissFresh: () => void,
 * }}
 */
export function useFreshDataAlert({ currentData, onFreshData }) {
  const [freshPayload, setFreshPayload] = useState(null);

  /**
   * Call this when new UpAhead data arrives in the background.
   * If it's planning-relevant, store it for the popup.
   * If it's not, apply it silently.
   */
  const notifyFresh = useCallback(
    (freshData) => {
      if (hasPlanningRelevantUpdate(currentData, freshData)) {
        setFreshPayload(freshData);
      } else {
        onFreshData(freshData);
      }
    },
    [currentData, onFreshData]
  );

  /** User tapped "Review now" — apply the pending data and dismiss. */
  const acceptFresh = useCallback(() => {
    if (freshPayload) onFreshData(freshPayload);
    setFreshPayload(null);
  }, [freshPayload, onFreshData]);

  /** User dismissed the popup — discard the pending data. */
  const dismissFresh = useCallback(() => {
    setFreshPayload(null);
  }, []);

  return { freshPayload, notifyFresh, acceptFresh, dismissFresh };
}

/**
 * Popup banner text constant.
 * Import this where the banner is rendered so the copy stays in sync.
 */
export const FRESH_DATA_POPUP_TEXT = '🗓 Updates for your week · Review now';
