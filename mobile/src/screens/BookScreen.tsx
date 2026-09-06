import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BalanceBadge from '../components/BalanceBadge';
import { fetchMatchBets } from '../api/matches';
import { VoteHistoryItem } from '../api/votes';
import { colors } from '../theme/colors';

export default function BookScreen({ route, navigation }: any) {
  const { matchId } = route.params;
  const [bets, setBets] = useState<VoteHistoryItem[]>([]);

  useEffect(() => {
    fetchMatchBets(matchId).then(setBets);
  }, [matchId]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Book</Text>
        <BalanceBadge />
      </View>
      <FlatList
        data={bets}
        keyExtractor={b => String(b.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Active</Text>
              </View>
              <Text style={styles.muted}>
                {item.match.tournament.game.name}: {item.match.tournament.name}
              </Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.teamName}>{item.match.team_a.name}</Text>
              <Text style={styles.teamName}>{item.match.team_b.name}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.muted}>{new Date(item.created_at).toLocaleString()}</Text>
              <Text style={styles.amount}>{item.amount} gg</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { color: colors.text, fontSize: 20 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  list: { paddingHorizontal: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  statusBadge: { backgroundColor: colors.active, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { color: colors.background, fontSize: 11, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 12 },
  teamName: { color: colors.text, fontWeight: '600' },
  amount: { color: colors.active, fontWeight: '700' },
});
