import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BalanceBadge from '../components/BalanceBadge';
import ConfirmationModal from '../components/ConfirmationModal';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { useFetchList } from '../hooks/useFetchList';
import { useNow } from '../hooks/useNow';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';
import { fetchMatches, Match, placeVote, Team } from '../api/matches';
import { formatCountdown } from '../utils/countdown';
import ClockIcon from '../assets/clock.svg';
import SwordsIcon from '../assets/swords.svg';
import DeleteIcon from '../assets/delete.svg';

// Two rows of six, with "00" taking the width of two keys - matches the
// Figma pad, which the Vote button sits beside rather than inside.
const KEY_ROWS = [
  ['1', '2', '3', '4', '5', '6'],
  ['7', '8', '9', '0', '00'],
];
const WIN_BONUS = 2;
// How often the list (match status/has_active_bet) and balance refresh
// on their own while this screen is focused, no pull-to-refresh needed -
// PandaScore's free tier (60 req/min) has plenty of headroom for this.
const POLL_MS = 15000;
// How long the "Bet placed!" confirmation banner stays up before it
// auto-dismisses.
const CONFIRMATION_MS = 2500;

// Game/date filters are hidden for now (client-side only) - re-add the
// tabsRow/rangeRow UI once the design comes back for them.
export default function PlayScreen({ navigation }: any) {
  const { user, refreshUser } = useAuth();
  const fetchAllMatches = useCallback(() => fetchMatches({}), []);
  const { items: matches, error, loading, reload } = useFetchList(fetchAllMatches, POLL_MS);
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow(1000);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [stake, setStake] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ team: string; stake: number } | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([reload(), refreshUser()]);
    } finally {
      setRefreshing(false);
    }
  };

  const expand = (match: Match, team: Team) => {
    setExpandedId(match.id);
    setSelectedTeam(team);
    setStake('10');
    setSubmitError(null);
  };

  const collapse = () => {
    setExpandedId(null);
    setSelectedTeam(null);
    setStake('10');
    setSubmitError(null);
  };

  const handleKeyPress = (key: string) => {
    setStake(prev => (prev === '0' ? key : prev + key).slice(0, 6));
  };

  const handleBackspace = () => setStake(prev => prev.slice(0, -1) || '0');

  const stakeNumber = parseInt(stake, 10) || 0;
  const balance = user?.balance ?? 0;
  const validationError =
    stakeNumber <= 0
      ? 'Enter a stake amount'
      : stakeNumber > balance
        ? 'Not enough gg balance'
        : null;

  const handleVote = async (match: Match) => {
    if (!selectedTeam || validationError) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await placeVote(match.id, selectedTeam.id, stakeNumber);
      await Promise.all([refreshUser(), reload()]);
      setConfirmation({ team: selectedTeam.name, stake: stakeNumber });
      collapse();
    } catch (e: any) {
      const message = e?.response?.data?.stake?.[0] ?? e?.response?.data?.detail ?? 'Try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderTeamIcon = (team: Team) =>
    team.logo ? (
      <Image source={{ uri: team.logo }} style={styles.teamIcon} />
    ) : (
      <SwordsIcon width={18} height={18} color={colors.text} />
    );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Play</Text>
        <BalanceBadge />
      </View>

      <ConfirmationModal
        visible={!!confirmation}
        title="Bet placed!"
        message={confirmation ? `${confirmation.stake} gg on ${confirmation.team}` : ''}
        onClose={() => setConfirmation(null)}
        autoCloseMs={CONFIRMATION_MS}
      />

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
          renderItem={({ item }) => {
            const isExpanded = item.id === expandedId;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderTextWrap}>
                    <Text style={styles.tournament}>{item.tournament.name}</Text>
                    <Text style={styles.game}>{item.tournament.game.name}</Text>
                  </View>
                  {item.has_active_bet && !isExpanded && (
                    <TouchableOpacity
                      style={styles.bookBadge}
                      onPress={() => navigation.navigate('Book', { matchId: item.id })}>
                      <Text style={styles.bookBadgeText}>Book</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.teamsRow}>
                  <TouchableOpacity
                    style={[
                      styles.teamButton,
                      isExpanded && selectedTeam?.id === item.team_a.id && styles.teamButtonActive,
                    ]}
                    onPress={() => expand(item, item.team_a)}>
                    <Text style={styles.teamName} numberOfLines={1} ellipsizeMode="tail">
                      {item.team_a.name}
                    </Text>
                    {renderTeamIcon(item.team_a)}
                  </TouchableOpacity>
                  <Text style={styles.vs}>VS</Text>
                  <TouchableOpacity
                    style={[
                      styles.teamButton,
                      isExpanded && selectedTeam?.id === item.team_b.id && styles.teamButtonActive,
                    ]}
                    onPress={() => expand(item, item.team_b)}>
                    {renderTeamIcon(item.team_b)}
                    <Text style={styles.teamName} numberOfLines={1} ellipsizeMode="tail">
                      {item.team_b.name}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isExpanded ? (
                  <>
                    <View style={styles.divider} />
                    {selectedTeam && <Text style={styles.winsText}>{selectedTeam.name} wins</Text>}

                    <View style={styles.stakeRow}>
                      <View style={styles.stepperGroup}>
                        <TouchableOpacity
                          style={styles.stepperButton}
                          onPress={() => setStake(s => String(Math.max(0, parseInt(s || '0', 10) - 1)))}>
                          <Text style={styles.stepper}>−</Text>
                        </TouchableOpacity>
                        <View style={styles.stakeField}>
                          <Text style={styles.stakeValue}>{stake}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.stepperButton}
                          onPress={() => setStake(s => String(parseInt(s || '0', 10) + 1))}>
                          <Text style={styles.stepper}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={handleBackspace} style={styles.smallButton}>
                        <DeleteIcon width={20} height={20} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={collapse} style={styles.smallButton}>
                        <Text style={styles.smallButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>

                    {(validationError || submitError) && (
                      <Text style={styles.validationText}>{submitError ?? validationError}</Text>
                    )}

                    <View style={styles.keypadRow}>
                      <View style={styles.keypad}>
                        {KEY_ROWS.map((row, rowIndex) => (
                          <View key={rowIndex} style={styles.keyRow}>
                            {row.map(key => (
                              <TouchableOpacity
                                key={key}
                                style={[styles.key, key === '00' && styles.keyWide]}
                                onPress={() => handleKeyPress(key)}>
                                <Text style={styles.keyText}>{key}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ))}
                      </View>
                      <TouchableOpacity
                        style={[styles.voteButton, !!validationError && styles.voteButtonDisabled]}
                        onPress={() => handleVote(item)}
                        disabled={submitting || !selectedTeam || !!validationError}>
                        <Text style={styles.voteTitle}>Vote</Text>
                        <Text style={styles.voteSubtitle}>win {WIN_BONUS}gg + bonus</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}

                <View style={styles.countdownRow}>
                  <ClockIcon width={12} height={12} />
                  <Text style={styles.countdown}>{formatCountdown(item.start_time, now)}</Text>
                </View>
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
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  card: {
    backgroundColor: colors.navBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderTextWrap: { flex: 1 },
  tournament: { color: colors.textGray, fontSize: typography.small.fontSize, fontFamily: fonts.regular, textAlign: 'center' },
  game: { color: colors.textGray, fontSize: typography.tiny.fontSize, fontFamily: fonts.regular, textAlign: 'center' },
  bookBadge: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  bookBadgeText: { color: colors.text, fontSize: typography.small.fontSize, fontFamily: fonts.semiBold },
  teamsRow: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  teamButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.teamButtonBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.teamButtonBorder,
    paddingVertical: 8,
    paddingHorizontal: 6,
    minHeight: 44,
  },
  teamButtonActive: { borderColor: colors.primary },
  teamIcon: { width: 18, height: 18, borderRadius: 9 },
  teamName: { color: colors.text, fontSize: typography.small.fontSize, fontFamily: fonts.regular, flexShrink: 1, textAlign: 'center' },
  vs: { color: colors.textMuted, fontFamily: fonts.regular },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },
  winsText: {
    color: colors.text,
    fontSize: typography.small.fontSize,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: fonts.regular,
  },
  stakeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  stepperButton: { paddingHorizontal: 10, height: '100%', justifyContent: 'center' },
  stepper: { color: colors.text, fontSize: typography.h4.fontSize, fontFamily: fonts.regular },
  stakeField: {
    backgroundColor: colors.text,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
  },
  stakeValue: {
    color: colors.background,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
  smallButton: {
    height: 36,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { color: colors.text, fontFamily: fonts.regular, fontSize: typography.bodySmall.fontSize },
  validationText: {
    color: colors.lose,
    fontSize: typography.small.fontSize,
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginBottom: 8,
  },
  // Figma lays the pad out as two rows of six with the Vote button filling
  // the column to their right, not as a 4-wide grid with Vote as the last cell.
  keypadRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 8 },
  keypad: { flex: 1, gap: 6 },
  keyRow: { flexDirection: 'row', gap: 6 },
  key: {
    flex: 1,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: { flex: 2 },
  keyText: { color: colors.text, fontSize: typography.bodySmall.fontSize, fontFamily: fonts.regular },
  voteButton: {
    width: 88,
    paddingHorizontal: 6,
    paddingVertical: 8,
    backgroundColor: colors.coin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  voteButtonDisabled: { opacity: 0.4 },
  voteTitle: { color: colors.background, fontFamily: fonts.bold, fontSize: typography.bodySmall.fontSize },
  voteSubtitle: {
    color: colors.background,
    fontFamily: fonts.semiBold,
    fontSize: typography.tiny.fontSize,
    textAlign: 'center',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  countdown: { color: colors.textMuted, fontSize: typography.small.fontSize, textAlign: 'center', fontFamily: fonts.regular },
});
