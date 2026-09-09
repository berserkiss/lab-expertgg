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
export function useFetchList<T>(fetcher: () => Promise<T[]>) {
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

  // useFocusEffect requires its callback to return void|cleanup, not a
  // Promise (which reload() does, so callers can await it on refresh) -
  // wrap it so the promise itself isn't handed back to the framework.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { items, error, loading, reload };
}
