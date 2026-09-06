import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useNow } from '../hooks/useNow';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { fetchMatches, Match } from '../api/matches';
import { formatCountdown } from '../utils/countdown';

// Game/date filters are hidden for now (client-side only) - re-add the
// tabsRow/rangeRow UI once the design comes back for them.
export default function PlayScreen({ navigation }: any) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const now = useNow(1000);

  const load = useCallback(async () => {
    try {
      const data = await fetchMatches({});
      setMatches(data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Play</Text>
      </View>

      {error ? (
        <ErrorState onRetry={load} />
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
  title: { color: colors.text, fontSize: 24, fontFamily: fonts.bold },
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
  tournament: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular },
  bookBadge: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  bookBadgeText: { color: colors.text, fontSize: 11, fontFamily: fonts.semiBold },
  teamsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  teamName: { color: colors.text, fontSize: 15, fontFamily: fonts.semiBold, flex: 1 },
  teamNameRight: { textAlign: 'right' },
  vs: { color: colors.textMuted, marginHorizontal: 8, fontFamily: fonts.regular },
  countdown: { color: colors.textMuted, fontSize: 12, textAlign: 'center', fontFamily: fonts.regular },
});
