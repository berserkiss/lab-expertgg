import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { useFetchList } from '../hooks/useFetchList';
import { fetchLeaderboard, LeaderboardEntry } from '../api/votes';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

// The design calls for exactly 8 rows visible at once, with any further
// entries reachable by scrolling - so row height is derived from the
// measured list area instead of a fixed dp value. A fixed value only ever
// matches the one screen size it was tuned against; deriving it from the
// real, measured viewport makes "8 fit, the rest scroll" true on every
// device, not just the one used for testing.
//
// The list has NO top padding of its own (the header's own bottom padding
// already gives breathing room above row 1) so that row index and scroll
// offset stay in exact lockstep: row `i` always starts at content position
// `i * rowHeight`, with no separate constant to keep in sync at the edges.
const TARGET_VISIBLE_ROWS = 8;
const ROW_GAP = 10;
const AVATAR_SIZE = 32;
// Matches AccountScreen's logoutButton.marginBottom - that value was tuned
// to align with this list's last-row bottom edge, so the two tabs feel
// consistent when switching between them. Keep the two in sync.
const LIST_BOTTOM_PADDING = 33;
const MIN_ROW_PADDING = 4;
// Reasonable card height for the single frame before the list is measured -
// overwritten the instant onLayout fires.
const FALLBACK_ROW_HEIGHT = 84;

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { items, error, loading, reload } = useFetchList(fetchLeaderboard);
  const listRef = useRef<FlatList<LeaderboardEntry>>(null);
  const [listHeight, setListHeight] = useState(0);

  const myIndex = user ? items.findIndex(item => item.username === user.username) : -1;

  // The last row's own marginBottom (ROW_GAP) already counts toward the
  // trailing gap, so only the remainder needs to come from rowHeight's
  // budget - see contentContainerStyle below, which adds exactly that
  // remainder as paddingBottom.
  const usableHeight = Math.max(0, listHeight - LIST_BOTTOM_PADDING + ROW_GAP);
  const rowHeight = usableHeight > 0 ? usableHeight / TARGET_VISIBLE_ROWS : FALLBACK_ROW_HEIGHT;
  const rowPaddingVertical = Math.max(MIN_ROW_PADDING, (rowHeight - ROW_GAP - AVATAR_SIZE) / 2);

  // Jump straight to the logged-in user's row once the list loads, so a
  // player ranked far down doesn't have to scroll to find themselves -
  // same idea as Spotify Wrapped/Duolingo leaderboards.
  //
  // Depends on `items` (not `myIndex`) because useFetchList's useFocusEffect
  // re-fetches - and hands back a new `items` array - every time this screen
  // regains focus, remounting the FlatList in the process (it's swapped for
  // LoadingState while loading). myIndex is usually the same number across
  // those reloads, so an effect keyed on it wouldn't re-fire and the newly
  // remounted list would just sit at the top with no scroll applied.
  //
  // Scrolls to a row-aligned offset (a whole multiple of rowHeight) rather
  // than using scrollToIndex's viewPosition centering, which lands on
  // arbitrary pixel offsets and can leave a sliver of the row above the
  // target peeking out at the very top of the list.
  useEffect(() => {
    if (myIndex < 0 || listHeight === 0) return;
    const maxStartRow = Math.max(0, items.length - TARGET_VISIBLE_ROWS);
    const idealStartRow = myIndex - Math.floor((TARGET_VISIBLE_ROWS - 1) / 2);
    const startRow = Math.min(Math.max(idealStartRow, 0), maxStartRow);
    listRef.current?.scrollToOffset({ offset: startRow * rowHeight, animated: true });
  }, [items, myIndex, listHeight, rowHeight]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
      </View>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState label="No Leaders" />
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          onLayout={e => setListHeight(e.nativeEvent.layout.height)}
          renderItem={({ item, index }) => {
            const isMe = !!user && item.username === user.username;
            return (
              <View style={[styles.row, { paddingVertical: rowPaddingVertical, marginBottom: ROW_GAP }]}>
                <Text style={[styles.rank, isMe && styles.textMe]}>{index + 1}</Text>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )}
                <Text style={[styles.username, isMe && styles.textMe]}>{item.username}</Text>
                <Text style={styles.balance}>{item.balance} gg</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16 },
  title: { color: colors.text, fontSize: 24, fontFamily: fonts.bold },
  // No paddingTop - see the note above the constants. The last row already
  // carries its own ROW_GAP via marginBottom, so only the remainder is added
  // here to bring the total trailing gap up to LIST_BOTTOM_PADDING.
  list: { paddingHorizontal: 16, paddingBottom: LIST_BOTTOM_PADDING - ROW_GAP },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navBackground,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  rank: { color: colors.textMuted, width: 20, fontFamily: fonts.semiBold },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, marginRight: 12 },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginRight: 12,
    backgroundColor: colors.cardBorder,
  },
  username: { color: colors.text, flex: 1, fontFamily: fonts.semiBold },
  textMe: { color: colors.primary },
  balance: { color: colors.text, fontFamily: fonts.semiBold },
});
