import React, { useEffect, useRef } from 'react';
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

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { items, error, loading, reload } = useFetchList(fetchLeaderboard);
  const listRef = useRef<FlatList<LeaderboardEntry>>(null);

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
  useEffect(() => {
    if (myIndex < 0) return;
    listRef.current?.scrollToIndex({ index: myIndex, animated: true, viewPosition: 0.5 });
  }, [items, myIndex]);

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
          onScrollToIndexFailed={info => {
            // The list hasn't measured that far down yet on first render -
            // jump to the estimated offset, then retry the precise scroll.
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: false,
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
            }, 50);
          }}
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
  header: { padding: 16 },
  title: { color: colors.text, fontSize: 24, fontFamily: fonts.bold },
  list: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navBackground,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  rank: { color: colors.textMuted, width: 20, fontFamily: fonts.semiBold },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12 },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: colors.cardBorder,
  },
  username: { color: colors.text, flex: 1, fontFamily: fonts.semiBold },
  textMe: { color: colors.primary },
  balance: { color: colors.text, fontFamily: fonts.semiBold },
});
