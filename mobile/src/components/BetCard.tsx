import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoteHistoryItem } from '../api/votes';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

const STATUS_LABEL: Record<string, string> = { win: 'Win', lose: 'Lose', active: 'Active' };
const STATUS_COLOR: Record<string, string> = { win: colors.win, lose: colors.lose, active: colors.active };

export default function BetCard({ item }: { item: VoteHistoryItem }) {
  const statusColor = STATUS_COLOR[item.status];
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
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
        <Text style={[styles.amount, { color: statusColor }]}>
          {item.status === 'win' ? '+' : ''}
          {item.amount} gg
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  statusText: { color: colors.background, fontSize: 11, fontFamily: fonts.bold },
  muted: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular },
  teamName: { color: colors.text, fontFamily: fonts.semiBold },
  amount: { fontFamily: fonts.bold },
});
