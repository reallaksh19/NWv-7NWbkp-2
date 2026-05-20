import { useState, useCallback, useEffect } from 'react';

export function usePullToRefresh(onRefresh, threshold = 60) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
      }, 100);
    }
  }, [onRefresh]);

  useEffect(() => {
    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        setStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e) => {
      if (window.scrollY === 0 && startY > 0) {
        const y = e.touches[0].clientY;
        const dist = y - startY;
        if (dist > 0) {
          // Prevent scroll
          if (e.cancelable) e.preventDefault();
          setPullDistance(() => Math.min(dist * 0.5, threshold * 1.5));
        }
      }
    };

    const handleTouchEnd = () => {
      setPullDistance((prevPullDistance) => {
        if (prevPullDistance >= threshold && !refreshing) {
          triggerRefresh();
        }
        return 0;
      });
      setStartY(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, threshold, refreshing, triggerRefresh]);

  return { pullDistance, refreshing, triggerRefresh, setPullDistance };
}
