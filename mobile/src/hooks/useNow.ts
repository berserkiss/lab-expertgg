import { useEffect, useState } from 'react';

/** Re-renders the calling component every `intervalMs`, returning the current
 * timestamp - for countdowns that need to actually tick instead of only
 * updating on the next unrelated re-render. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
