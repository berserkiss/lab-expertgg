import React, { useCallback, useState } from 'react';
import {
  Alert,
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

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'];
const WIN_BONUS = 2;
// How often the list (match status/has_active_bet) and balance refresh
// on their own while this screen is focused, no pull-to-refresh needed -
// PandaScore's free tier (60 req/min) has plenty of headroom for this.
const POLL_MS = 15000;

// Game/date filters are hidden for now (client-side only) - re-add the
// tabsRow/rangeRow UI once the design comes back for them.
export default function PlayScreen({ navigation }: any) {
  const { refreshUser } = useAuth();
  const fetchAllMatches = useCallback(() => fetchMatches({}), []);
  const { items: matches, error, loading, reload } = useFetchList(fetchAllMatches, POLL_MS);
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow(1000);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [stake, setStake] = useState('10');
  const [submitting, setSubmitting] = useState(false);

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
  };

  const collapse = () => {
    setExpandedId(null);
    setSelectedTeam(null);
    setStake('10');
  };

  const handleKeyPress = (key: string) => {
    setStake(prev => (prev === '0' ? key : prev + key).slice(0, 6));
  };

  const handleBackspace = () => setStake(prev => prev.slice(0, -1) || '0');

  const handleVote = async (match: Match) => {
    if (!selectedTeam) return;
    const stakeNumber = parseInt(stake, 10) || 0;
    setSubmitting(true);
    try {
      await placeVote(match.id, selectedTeam.id, stakeNumber);
      await Promise.all([refreshUser(), reload()]);
      collapse();
    } catch (e: any) {
      const message = e?.response?.data?.stake?.[0] ?? e?.response?.data?.detail ?? 'Try again.';
      Alert.alert('Could not place vote', message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderTeamIcon = (team: Team) =>
    team.logo ? (
      <Image source={{ uri: team.logo }} style={styles.teamIcon} />
    ) : (
      <SwordsIcon width={20} height={20} color={colors.textGray} />
    );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Play</Text>
        <BalanceBadge />
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
          renderItem={({ item }) => {
            const isExpanded = item.id === expandedId;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View>
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
                    <Text style={styles.teamName}>{item.team_a.name}</Text>
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
                    <Text style={styles.teamName}>{item.team_b.name}</Text>
                  </TouchableOpacity>
                </View>

                {isExpanded ? (
                  <>
                    {selectedTeam && <Text style={styles.winsText}>{selectedTeam.name} wins</Text>}

                    <View style={styles.stakeRow}>
                      <TouchableOpacity
                        onPress={() => setStake(s => String(Math.max(0, parseInt(s || '0', 10) - 1)))}>
                        <Text style={styles.stepper}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stakeValue}>{stake}</Text>
                      <TouchableOpacity onPress={() => setStake(s => String(parseInt(s || '0', 10) + 1))}>
                        <Text style={styles.stepper}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleBackspace} style={styles.smallButton}>
                        <Text style={styles.smallButtonText}>{'<x'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={collapse} style={styles.smallButton}>
                        <Text style={styles.smallButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.keypad}>
                      {KEYS.map(key => (
                        <TouchableOpacity key={key} style={styles.key} onPress={() => handleKeyPress(key)}>
                          <Text style={styles.keyText}>{key}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={styles.voteButton}
                        onPress={() => handleVote(item)}
                        disabled={submitting || !selectedTeam}>
                        <Text style={styles.voteButtonText}>Vote{'\n'}win {WIN_BONUS}gg + bonus</Text>
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tournament: { color: colors.textMuted, fontSize: typography.small.fontSize, fontFamily: fonts.regular, textAlign: 'center' },
  game: { color: colors.textMuted, fontSize: typography.tiny.fontSize, fontFamily: fonts.regular, textAlign: 'center' },
  bookBadge: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  bookBadgeText: { color: colors.text, fontSize: typography.tiny.fontSize, fontFamily: fonts.semiBold },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  teamButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  teamButtonActive: { borderColor: colors.primary },
  teamIcon: { width: 20, height: 20, borderRadius: 10 },
  teamName: { color: colors.text, fontSize: typography.bodySmall.fontSize, fontFamily: fonts.semiBold },
  vs: { color: colors.textMuted, fontFamily: fonts.regular },
  winsText: { color: colors.text, textAlign: 'center', marginBottom: 12, fontFamily: fonts.regular },
  stakeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  stepper: { color: colors.text, fontSize: typography.h2.fontSize, paddingHorizontal: 16, fontFamily: fonts.regular },
  stakeValue: {
    color: colors.text,
    fontSize: typography.h3.fontSize,
    fontFamily: fonts.bold,
    minWidth: 60,
    textAlign: 'center',
  },
  smallButton: { marginLeft: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.background, borderRadius: 8 },
  smallButtonText: { color: colors.text, fontFamily: fonts.regular },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  key: { width: '25%', paddingVertical: 16, alignItems: 'center' },
  keyText: { color: colors.text, fontSize: typography.h4.fontSize, fontFamily: fonts.regular },
  voteButton: {
    width: '25%',
    backgroundColor: colors.coin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  voteButtonText: { color: colors.background, fontFamily: fonts.bold, fontSize: typography.tiny.fontSize, textAlign: 'center' },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  countdown: { color: colors.textMuted, fontSize: typography.small.fontSize, textAlign: 'center', fontFamily: fonts.regular },
});
