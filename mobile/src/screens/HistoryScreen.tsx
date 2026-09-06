import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import BalanceBadge from '../components/BalanceBadge';
import { fetchHistory, VoteHistoryItem } from '../api/votes';
import { colors } from '../theme/colors';

const STATUS_LABEL: Record<string, string> = { win: 'Win', lose: 'Lose', active: 'Active' };
const STATUS_COLOR: Record<string, string> = { win: colors.win, lose: colors.lose, active: colors.active };

export default function HistoryScreen() {
  const [items, setItems] = useState<VoteHistoryItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory().then(setItems);
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <BalanceBadge />
      </View>
      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                <Text style={styles.statusText}>{STATUS_LABEL[item.status]}</Text>
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
              <Text style={[styles.amount, { color: STATUS_COLOR[item.status] }]}>
                {item.status === 'win' ? '+' : ''}
                {item.amount} gg
              </Text>
            </View>
          </View>
        )}
      />
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
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
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
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { color: colors.background, fontSize: 11, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 12 },
  teamName: { color: colors.text, fontWeight: '600' },
  amount: { fontWeight: '700' },
});
