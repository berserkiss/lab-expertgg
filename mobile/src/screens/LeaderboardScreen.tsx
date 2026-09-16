import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BalanceBadge from '../components/BalanceBadge';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { useFetchList } from '../hooks/useFetchList';
import { fetchLeaderboard, LeaderboardEntry } from '../api/votes';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

// Row size is fixed, matching the design - it does NOT shrink to force a
// specific row count onto every screen. On a short screen fewer rows are
// visible before you need to scroll; on a tall one, more are. That's normal
// list behavior, not a compromise - and it keeps every row's proportions
// (avatar-to-padding ratio, text size) identical to the design on any
// device, instead of the card being squeezed to hit an exact visible count.
const ROW_VERTICAL_PADDING = 20;
const AVATAR_SIZE = 32;
// Rankings shift as other players place/resolve bets - poll so this stays
// current without a manual refresh.
const POLL_MS = 15000;
const ROW_GAP = 16;
const ROW_HEIGHT = ROW_VERTICAL_PADDING * 2 + AVATAR_SIZE + ROW_GAP;

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { items, error, loading, reload } = useFetchList(fetchLeaderboard, POLL_MS);
  const listRef = useRef<FlatList<LeaderboardEntry>>(null);
  const [listHeight, setListHeight] = useState(0);

  const myIndex = user ? items.findIndex(item => item.username === user.username) : -1;

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
  // Scrolls to a row-aligned offset (a whole multiple of ROW_HEIGHT) rather
  // than using scrollToIndex's viewPosition centering, which lands on
  // arbitrary pixel offsets and can leave a sliver of the row above the
  // target peeking out at the very top of the list. visibleRows (how many
  // whole rows actually fit in the measured viewport) only affects where
  // this centers - the rows themselves are always ROW_HEIGHT.
  useEffect(() => {
    if (myIndex < 0 || listHeight === 0) return;
    const visibleRows = Math.max(1, Math.floor(listHeight / ROW_HEIGHT));
    const maxStartRow = Math.max(0, items.length - visibleRows);
    const idealStartRow = myIndex - Math.floor((visibleRows - 1) / 2);
    const startRow = Math.min(Math.max(idealStartRow, 0), maxStartRow);
    listRef.current?.scrollToOffset({ offset: startRow * ROW_HEIGHT, animated: true });
  }, [items, myIndex, listHeight]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <BalanceBadge />
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
              <View style={styles.row}>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: { color: colors.text, ...typography.h1, fontFamily: fonts.bold },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navBackground,
    borderRadius: 14,
    paddingVertical: ROW_VERTICAL_PADDING,
    paddingHorizontal: 16,
    marginBottom: ROW_GAP,
  },
  rank: { color: colors.text, width: 20, fontFamily: fonts.semiBold, fontSize: typography.label.fontSize },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, marginRight: 12 },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginRight: 12,
    backgroundColor: colors.cardBorder,
  },
  username: { color: colors.text, flex: 1, fontFamily: fonts.semiBold, fontSize: typography.label.fontSize },
  textMe: { color: colors.primary },
  balance: { color: colors.text, fontFamily: fonts.semiBold, fontSize: typography.label.fontSize },
});
