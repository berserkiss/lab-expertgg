import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

// Shared by every screen that fetches a list on focus (Play/History/
// Leaderboard) - re-fetches every time the screen comes into focus, tracks
// its own loading/error state, and exposes reload() for pull-to-refresh.
//
// fetcher is kept in a ref rather than a useCallback dependency, so callers
// can pass a fresh inline function on every render (e.g. `() =>
// fetchMatches({})`) without that alone re-triggering a fetch - only an
// actual screen focus does.
//
// Pass pollMs to also re-fetch on a timer while the screen stays focused,
// so match status/bet outcomes/leaderboard positions update on their own -
// no pull-to-refresh or navigating away and back needed to see fresh data.
export function useFetchList<T>(fetcher: () => Promise<T[]>, pollMs?: number) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => {
    setLoading(true);
    return fetcherRef
      .current()
      .then(data => {
        setItems(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Same reasoning as reload() above - a background poll tick shouldn't
  // flash the full-screen loading state on every refetch.
  const silentReload = useCallback(() => {
    return fetcherRef
      .current()
      .then(data => {
        setItems(data);
        setError(false);
      })
      .catch(() => {
        // A poll tick failing silently is fine - the next tick retries,
        // and pull-to-refresh/focus-reload already surface real errors.
      });
  }, []);

  // useFocusEffect requires its callback to return void|cleanup, not a
  // Promise (which reload() does, so callers can await it on refresh) -
  // wrap it so the promise itself isn't handed back to the framework.
  useFocusEffect(
    useCallback(() => {
      reload();
      if (!pollMs) return;
      const id = setInterval(silentReload, pollMs);
      return () => clearInterval(id);
    }, [reload, silentReload, pollMs]),
  );

  return { items, error, loading, reload };
}
