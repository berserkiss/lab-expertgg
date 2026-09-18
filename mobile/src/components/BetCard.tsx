import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoteHistoryItem } from '../api/votes';
import TeamBox, { VS_COLUMN_WIDTH } from './TeamBox';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

const STATUS_LABEL: Record<string, string> = { win: 'Win', lose: 'Lose', active: 'Active', void: 'Void' };
// A voided bet neither won nor lost, so it takes the neutral outline
// rather than one of the three result colours.
const STATUS_COLOR: Record<string, string> = {
  win: colors.win,
  lose: colors.lose,
  active: colors.active,
  void: colors.teamButtonBorder,
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPlaced(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}`;
}

// A settled bet shows its signed result (+ won / - lost); one still running
// shows the stake at risk with no sign.
function formatAmount(amount: number, status: string) {
  const sign = status === 'win' ? '+ ' : status === 'lose' ? '- ' : '';
  return `${sign}${Math.abs(amount)} gg`;
}

export default function BetCard({ item }: { item: VoteHistoryItem }) {
  const statusColor = STATUS_COLOR[item.status];

  const backed = (teamId: number) => teamId === item.predicted_team.id;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.badge, { borderColor: statusColor }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{STATUS_LABEL[item.status]}</Text>
        </View>
        <Text style={styles.muted} numberOfLines={1} ellipsizeMode="tail">
          {item.match.tournament.game.name}: {item.match.tournament.name}
        </Text>
      </View>

      <View style={styles.teamsRow}>
        <TeamBox team={item.match.team_a} highlighted={backed(item.match.team_a.id)} />
        <View style={styles.vsColumn} />
        <TeamBox team={item.match.team_b} iconFirst highlighted={backed(item.match.team_b.id)} />
      </View>

      <View style={styles.row}>
        <Text style={styles.muted}>{formatPlaced(item.created_at)}</Text>
        <View style={styles.amountBadge}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {formatAmount(item.amount, item.status)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.navBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 3 },
  // The status badge is outlined in its own colour; the result badge is not -
  // it takes the neutral outline and carries the colour in its text only.
  amountBadge: {
    borderWidth: 1,
    borderColor: colors.teamButtonBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  badgeText: { fontSize: typography.small.fontSize, fontFamily: fonts.semiBold },
  muted: {
    color: colors.textGray,
    fontSize: typography.small.fontSize,
    fontFamily: fonts.regular,
    flexShrink: 1,
  },
  teamsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginVertical: 12 },
  // Stands in for Play's "VS" so both screens size their boxes the same.
  vsColumn: { width: VS_COLUMN_WIDTH },
});
