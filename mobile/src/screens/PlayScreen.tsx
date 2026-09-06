import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import BalanceBadge from '../components/BalanceBadge';
import EmptyState from '../components/EmptyState';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { fetchMatches, Match } from '../api/matches';
import { formatCountdown } from '../utils/countdown';

const GAMES = [
  { slug: 'lol', label: 'League of Legends' },
  { slug: 'cs', label: 'Counter-Strike' },
];

const RANGES: { key: 'today' | 'tomorrow' | 'week'; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
];

export default function PlayScreen({ navigation }: any) {
  const [game, setGame] = useState('cs');
  const [range, setRange] = useState<'today' | 'tomorrow' | 'week'>('today');
  const [matches, setMatches] = useState<Match[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setMatches(await fetchMatches({ game, range }));
  }, [game, range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Play</Text>
        <BalanceBadge />
      </View>

      <View style={styles.tabsRow}>
        {GAMES.map(g => (
          <TouchableOpacity key={g.slug} onPress={() => setGame(g.slug)} style={styles.gameTab}>
            <Text style={[styles.gameTabText, game === g.slug && styles.gameTabTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.rangeRow}>
        {RANGES.map(r => (
          <TouchableOpacity
            key={r.key}
            onPress={() => setRange(r.key)}
            style={[styles.rangePill, range === r.key && styles.rangePillActive]}>
            <Text style={[styles.rangeText, range === r.key && styles.rangeTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {matches.length === 0 ? (
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
              <Text style={styles.countdown}>{formatCountdown(item.start_time)}</Text>
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
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  gameTab: { marginRight: 20 },
  gameTabText: { color: colors.textMuted, fontFamily: fonts.regular },
  gameTabTextActive: { color: colors.text, fontFamily: fonts.bold },
  rangeRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  rangePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: colors.card,
  },
  rangePillActive: { backgroundColor: colors.primary },
  rangeText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  rangeTextActive: { color: colors.text, fontFamily: fonts.semiBold },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
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
