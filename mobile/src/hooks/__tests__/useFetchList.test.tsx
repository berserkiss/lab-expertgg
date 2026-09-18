/**
 * The paging hook, and specifically the orderings that go wrong.
 *
 * Responses do not arrive in the order they were asked for. Both bugs this
 * file pins down were invisible in use - no duplicate key, no error, just a
 * list quietly showing the wrong rows - and both were fixed by reading the
 * code rather than by anything failing. That is what these are for.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useFetchList } from '../useFetchList';

// The hook refetches on screen focus. There is no navigator here, so focus
// is "mounted".
jest.mock('@react-navigation/native', () => {
  const react = require('react');
  return { useFocusEffect: (cb: any) => react.useEffect(cb, [cb]) };
});

type Page = { count: number; next: string | null; previous: string | null; results: number[] };

function page(results: number[], next: string | null = null): Page {
  return { count: 99, next, previous: null, results };
}

/**
 * A fetcher whose responses are resolved by hand, so a test can decide which
 * request lands first. `calls[i].resolve(page)` answers the i-th request.
 */
function deferredFetcher() {
  const calls: { url?: string; resolve: (p: Page) => void }[] = [];
  const fetcher = jest.fn((url?: string) => {
    return new Promise<Page>(resolve => {
      calls.push({ url, resolve });
    });
  });
  return { fetcher, calls };
}

type State = ReturnType<typeof useFetchList<number>>;

function mount(fetcher: (url?: string) => Promise<Page>, pollMs?: number) {
  const latest = { current: null as unknown as State };
  function Harness() {
    latest.current = useFetchList<number>(fetcher, pollMs);
    return null;
  }
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Harness />);
  });
  return { latest, unmount: () => ReactTestRenderer.act(() => tree.unmount()) };
}

// Lets queued promise callbacks run and React flush the state they set.
const settle = () => ReactTestRenderer.act(async () => {});

describe('useFetchList', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the first page, then appends the next', async () => {
    const { fetcher, calls } = deferredFetcher();
    const { latest } = mount(fetcher);

    calls[0].resolve(page([1, 2], 'page-2'));
    await settle();
    expect(latest.current.items).toEqual([1, 2]);

    ReactTestRenderer.act(() => latest.current.loadMore());
    expect(calls[1].url).toBe('page-2');
    calls[1].resolve(page([3, 4], 'page-3'));
    await settle();

    expect(latest.current.items).toEqual([1, 2, 3, 4]);
  });

  it('asks for the next page once however often the list hits its end', async () => {
    const { fetcher, calls } = deferredFetcher();
    const { latest } = mount(fetcher);
    calls[0].resolve(page([1, 2], 'page-2'));
    await settle();

    // FlatList fires onEndReached several times in a fast scroll.
    ReactTestRenderer.act(() => {
      latest.current.loadMore();
      latest.current.loadMore();
      latest.current.loadMore();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not let a poll that started earlier undo a page that arrived later', async () => {
    jest.useFakeTimers();
    const { fetcher, calls } = deferredFetcher();
    const { latest } = mount(fetcher, 15000);

    calls[0].resolve(page([1, 2], 'page-2'));
    await settle();

    // The tick starts while the user is still looking at page one, so the
    // "has the user paged further" flag is legitimately false here.
    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(15000);
    });
    expect(calls).toHaveLength(2);

    // Only then does the user reach the end, and page two comes back first.
    ReactTestRenderer.act(() => latest.current.loadMore());
    calls[2].resolve(page([3, 4], 'page-3'));
    await settle();
    expect(latest.current.items).toEqual([1, 2, 3, 4]);

    // The poll lands last, carrying page one. Applied, it would drop the
    // rows the user just scrolled to and set the cursor back to page two -
    // which the next scroll would then fetch again.
    calls[1].resolve(page([1, 2], 'page-2'));
    await settle();

    expect(latest.current.items).toEqual([1, 2, 3, 4]);
  });

  it('discards a page still in flight when the list is reloaded', async () => {
    const { fetcher, calls } = deferredFetcher();
    const { latest } = mount(fetcher);

    calls[0].resolve(page([1, 2], 'page-2'));
    await settle();

    ReactTestRenderer.act(() => latest.current.loadMore());
    expect(calls[1].url).toBe('page-2');

    // Pull to refresh while page two is on its way.
    ReactTestRenderer.act(() => {
      latest.current.reload();
    });
    calls[2].resolve(page([1, 2], 'page-2'));
    await settle();

    // The abandoned request answers afterwards. Appending it would leave the
    // list as page one followed by page two's successor with nothing in
    // between, and no duplicate key to give it away.
    calls[1].resolve(page([7, 8], 'page-3'));
    await settle();

    expect(latest.current.items).toEqual([1, 2]);
  });

  it('reports an error without emptying the list, and recovers on reload', async () => {
    const failing = jest
      .fn<Promise<Page>, [string?]>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([1, 2]));
    const { latest } = mount(failing);
    await settle();

    expect(latest.current.error).toBe(true);
    expect(latest.current.items).toEqual([]);

    await ReactTestRenderer.act(async () => {
      await latest.current.reload();
    });

    expect(latest.current.error).toBe(false);
    expect(latest.current.items).toEqual([1, 2]);
  });
});
