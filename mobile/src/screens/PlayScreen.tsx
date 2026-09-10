import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useFetchList } from '../hooks/useFetchList';
import { useNow } from '../hooks/useNow';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';
import { fetchMatches } from '../api/matches';
import { formatCountdown } from '../utils/countdown';

// Game/date filters are hidden for now (client-side only) - re-add the
// tabsRow/rangeRow UI once the design comes back for them.
export default function PlayScreen({ navigation }: any) {
  const fetchAllMatches = useCallback(() => fetchMatches({}), []);
  const { items: matches, error, loading, reload } = useFetchList(fetchAllMatches);
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow(1000);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Play</Text>
      </View>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : matches.length === 0 ? (
        <EmptyState label="No Matches" />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={m => String(m.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('MatchVote', { matchId: item.id })}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.tournament}>{item.tournament.name}</Text>
                {item.has_active_bet && (
                  <TouchableOpacity
                    style={styles.bookBadge}
                    onPress={() => navigation.navigate('Book', { matchId: item.id })}>
                    <Text style={styles.bookBadgeText}>Book</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.teamsRow}>
                <Text style={styles.teamName}>{item.team_a.name}</Text>
                <Text style={styles.vs}>VS</Text>
                <Text style={[styles.teamName, styles.teamNameRight]}>{item.team_b.name}</Text>
              </View>
              <Text style={styles.countdown}>{formatCountdown(item.start_time, now)}</Text>
            </TouchableOpacity>
          )}
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
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tournament: { color: colors.textMuted, fontSize: typography.small.fontSize, fontFamily: fonts.regular },
  bookBadge: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  bookBadgeText: { color: colors.text, fontSize: typography.tiny.fontSize, fontFamily: fonts.semiBold },
  teamsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  teamName: { color: colors.text, fontSize: typography.bodySmall.fontSize, fontFamily: fonts.semiBold, flex: 1 },
  teamNameRight: { textAlign: 'right' },
  vs: { color: colors.textMuted, marginHorizontal: 8, fontFamily: fonts.regular },
  countdown: { color: colors.textMuted, fontSize: typography.small.fontSize, textAlign: 'center', fontFamily: fonts.regular },
});
