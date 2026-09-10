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
// The list has NO top or bottom padding of its own, and rowHeight is
// exactly listHeight/8 with no reserved slack - so 8 rows always fill the
// viewport exactly, at ANY scroll position, not just at the very top or
// very bottom of the list. Earlier versions reserved extra space in
// rowHeight's formula to leave a bigger gap after the true last row, but
// that reserved space then showed up as an unwanted sliver of the next
// row peeking in at any OTHER scroll position (e.g. landing on rank 1
// with more entries below) - a fixed rowHeight can't reserve trailing
// space only sometimes, so nothing is reserved, and AccountScreen's
// logoutButton.marginBottom is matched to ROW_GAP instead of a bigger
// value, to keep the two screens' bottom spacing consistent.
const TARGET_VISIBLE_ROWS = 8;
const ROW_GAP = 10;
const AVATAR_SIZE = 32;
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

  const rowHeight = listHeight > 0 ? listHeight / TARGET_VISIBLE_ROWS : FALLBACK_ROW_HEIGHT;
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
  // No top/bottom padding - see the note above the constants.
  list: { paddingHorizontal: 16 },
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
