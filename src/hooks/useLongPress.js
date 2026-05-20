import { useRef } from 'react';

export function useLongPress(onLongPress, delay = 450) {
  const timerRef = useRef(null);

  const start = () => {
    timerRef.current = setTimeout(onLongPress, delay);
  };

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear
  };
}