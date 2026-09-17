import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Team } from '../api/matches';
import { VoteHistoryItem } from '../api/votes';
import SwordsIcon from '../assets/swords.svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

const STATUS_LABEL: Record<string, string> = { win: 'Win', lose: 'Lose', active: 'Active' };
const STATUS_COLOR: Record<string, string> = { win: colors.win, lose: colors.lose, active: colors.active };
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

  const renderTeam = (team: Team, iconFirst: boolean) => {
    const picked = team.id === item.predicted_team.id;
    const icon = team.logo ? (
      <Image source={{ uri: team.logo }} style={styles.teamIcon} />
    ) : (
      <SwordsIcon width={18} height={18} color={colors.text} />
    );
    return (
      <View style={[styles.teamBox, picked && styles.teamBoxPicked]}>
        {iconFirst && icon}
        <Text style={styles.teamName} numberOfLines={1} ellipsizeMode="tail">
          {team.name}
        </Text>
        {!iconFirst && icon}
      </View>
    );
  };

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
        {renderTeam(item.match.team_a, false)}
        {renderTeam(item.match.team_b, true)}
      </View>

      <View style={styles.row}>
        <Text style={styles.muted}>{formatPlaced(item.created_at)}</Text>
        <View style={[styles.badge, { borderColor: statusColor }]}>
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
    padding: 12,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 3 },
  badgeText: { fontSize: typography.small.fontSize, fontFamily: fonts.semiBold },
  muted: {
    color: colors.textGray,
    fontSize: typography.small.fontSize,
    fontFamily: fonts.regular,
    flexShrink: 1,
  },
  teamsRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  // Same outlined treatment as the Play screen's team buttons, with the blue
  // border marking the team this bet was placed on.
  teamBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.teamButtonBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.teamButtonBorder,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 48,
  },
  teamBoxPicked: { borderColor: colors.primary },
  teamIcon: { width: 18, height: 18, borderRadius: 9 },
  teamName: {
    color: colors.text,
    fontSize: typography.small.fontSize,
    fontFamily: fonts.regular,
    flexShrink: 1,
    textAlign: 'center',
  },
});
