import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Paginated } from '../api/client';

// Shared by every screen that fetches a list on focus (Play/History/
// Leaderboard) - re-fetches every time the screen comes into focus, tracks
// its own loading/error state, exposes reload() for pull-to-refresh, and
// loadMore() for the rest of the rows.
//
// The list is paginated server-side, so the first response is a page, not
// the list. Screens hand loadMore to FlatList's onEndReached; without it a
// list silently stops at PAGE_SIZE rows and looks complete.
//
// fetcher is kept in a ref rather than a useCallback dependency, so callers
// can pass a fresh inline function on every render (e.g. `pageUrl =>
// fetchMatches({}, pageUrl)`) without that alone re-triggering a fetch -
// only an actual screen focus does.
//
// Pass pollMs to also re-fetch on a timer while the screen stays focused,
// so match status/bet outcomes/leaderboard positions update on their own.
export function useFetchList<T>(
  fetcher: (pageUrl?: string) => Promise<Paginated<T>>,
  pollMs?: number,
) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const nextUrl = useRef<string | null>(null);
  // A ref, not the loadingMore state: FlatList fires onEndReached several
  // times in a fast scroll, and state set in one of those calls is not
  // visible to the next one in the same tick - both would fetch the same
  // page and append it twice.
  const fetchingMore = useRef(false);
  // Tracks whether the user has paged past the first screenful, so a poll
  // tick doesn't yank rows out from under them (see silentReload).
  const pagedFurther = useRef(false);
  // Every request records the generation it started in, and a response from
  // an older one is dropped. Responses do not arrive in the order they were
  // asked for: a poll tick that started before a loadMore can land after it
  // and overwrite the appended pages, and a pull-to-refresh during loadMore
  // would otherwise leave the list as page one followed by page four, with
  // two and three silently skipped. A flag checked only at call time cannot
  // see either, because both go wrong between the call and the resolution.
  const generation = useRef(0);

  const reload = useCallback(() => {
    // Starting a reload abandons everything in flight: the paging state is
    // reset here rather than in the .then, so a loadMore cannot be started
    // against the old cursor while the first page is on its way back.
    const gen = ++generation.current;
    nextUrl.current = null;
    pagedFurther.current = false;
    fetchingMore.current = false;
    setLoadingMore(false);
    setLoading(true);
    return fetcherRef
      .current()
      .then(page => {
        if (gen !== generation.current) return;
        setItems(page.results);
        nextUrl.current = page.next;
        setError(false);
      })
      .catch(() => {
        if (gen === generation.current) setError(true);
      })
      .finally(() => {
        if (gen === generation.current) setLoading(false);
      });
  }, []);

  const loadMore = useCallback(() => {
    const url = nextUrl.current;
    if (!url || fetchingMore.current) return;
    const gen = generation.current;
    fetchingMore.current = true;
    setLoadingMore(true);
    fetcherRef
      .current(url)
      .then(page => {
        if (gen !== generation.current) return;
        setItems(prev => [...prev, ...page.results]);
        nextUrl.current = page.next;
        pagedFurther.current = true;
      })
      .catch(() => {
        // The rows already on screen are still good; the next scroll to the
        // end retries.
      })
      .finally(() => {
        // A superseded request must not clear the flags a newer one set.
        if (gen !== generation.current) return;
        fetchingMore.current = false;
        setLoadingMore(false);
      });
  }, []);

  // Same reasoning as reload() above - a background poll tick shouldn't
  // flash the full-screen loading state on every refetch. It also refuses
  // to run once the user has loaded further pages, since replacing the list
  // with page one would throw away what they scrolled to.
  const silentReload = useCallback(() => {
    if (pagedFurther.current) return Promise.resolve();
    const gen = generation.current;
    return fetcherRef
      .current()
      .then(page => {
        // Re-checked on arrival, not only at call time: the user can reach
        // the end of the list and load page two while this tick is still in
        // flight, and applying page one then would drop those rows and set
        // the cursor back to page two, which the next scroll re-fetches.
        if (gen !== generation.current || pagedFurther.current) return;
        setItems(page.results);
        nextUrl.current = page.next;
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

  return { items, error, loading, loadingMore, reload, loadMore };
}
