import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BalanceBadge from '../components/BalanceBadge';
import { useAuth } from '../context/AuthContext';
import { fetchMatch, Match, placeVote, Team } from '../api/matches';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'];
const WIN_BONUS = 2;

export default function MatchVoteScreen({ route, navigation }: any) {
  const { matchId } = route.params;
  const { refreshUser } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [stake, setStake] = useState('10');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMatch(matchId).then(setMatch);
  }, [matchId]);

  if (!match) {
    return <SafeAreaView style={styles.container} edges={['top']} />;
  }

  const handleKeyPress = (key: string) => {
    setStake(prev => (prev === '0' ? key : prev + key).slice(0, 6));
  };

  const handleBackspace = () => setStake(prev => prev.slice(0, -1) || '0');

  const handleVote = async () => {
    if (!selectedTeam) {
      Alert.alert('Pick a team first');
      return;
    }
    const stakeNumber = parseInt(stake, 10) || 0;
    setSubmitting(true);
    try {
      await placeVote(match.id, selectedTeam.id, stakeNumber);
      await refreshUser();
      navigation.goBack();
    } catch (e: any) {
      const message = e?.response?.data?.stake?.[0] ?? e?.response?.data?.detail ?? 'Try again.';
      Alert.alert('Could not place vote', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Play</Text>
        <BalanceBadge />
      </View>

      <Text style={styles.tournament}>{match.tournament.name}</Text>

      <View style={styles.matchRow}>
        <TouchableOpacity
          style={[styles.teamButton, selectedTeam?.id === match.team_a.id && styles.teamButtonActive]}
          onPress={() => setSelectedTeam(match.team_a)}>
          <Text style={styles.teamButtonText}>{match.team_a.name}</Text>
        </TouchableOpacity>
        <Text style={styles.vs}>VS</Text>
        <TouchableOpacity
          style={[styles.teamButton, selectedTeam?.id === match.team_b.id && styles.teamButtonActive]}
          onPress={() => setSelectedTeam(match.team_b)}>
          <Text style={styles.teamButtonText}>{match.team_b.name}</Text>
        </TouchableOpacity>
      </View>

      {selectedTeam && <Text style={styles.winsText}>{selectedTeam.name} wins</Text>}

      <View style={styles.stakeRow}>
        <TouchableOpacity onPress={() => setStake(s => String(Math.max(0, parseInt(s || '0', 10) - 1)))}>
          <Text style={styles.stepper}>-</Text>
        </TouchableOpacity>
        <Text style={styles.stakeValue}>{stake}</Text>
        <TouchableOpacity onPress={() => setStake(s => String(parseInt(s || '0', 10) + 1))}>
          <Text style={styles.stepper}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBackspace} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>{'<x'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStake('0')} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keypad}>
        {KEYS.map(key => (
          <TouchableOpacity key={key} style={styles.key} onPress={() => handleKeyPress(key)}>
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.voteButton} onPress={handleVote} disabled={submitting}>
          <Text style={styles.voteButtonText}>Vote{'\n'}win {WIN_BONUS}gg + bonus</Text>
        </TouchableOpacity>
      </View>
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
  back: { color: colors.text, fontSize: 20 },
  title: { color: colors.text, fontSize: 24, fontFamily: fonts.bold },
  tournament: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 8, fontFamily: fonts.regular },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  teamButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    alignItems: 'center',
  },
  teamButtonActive: { borderColor: colors.primary },
  teamButtonText: { color: colors.text, fontFamily: fonts.semiBold },
  vs: { color: colors.textMuted, marginHorizontal: 8, fontFamily: fonts.regular },
  winsText: { color: colors.text, textAlign: 'center', marginBottom: 12, fontFamily: fonts.regular },
  stakeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  stepper: { color: colors.text, fontSize: 24, paddingHorizontal: 16, fontFamily: fonts.regular },
  stakeValue: { color: colors.text, fontSize: 20, fontFamily: fonts.bold, minWidth: 60, textAlign: 'center' },
  smallButton: { marginLeft: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, borderRadius: 8 },
  smallButtonText: { color: colors.text, fontFamily: fonts.regular },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 },
  key: { width: '25%', paddingVertical: 16, alignItems: 'center' },
  keyText: { color: colors.text, fontSize: 18, fontFamily: fonts.regular },
  voteButton: {
    width: '25%',
    backgroundColor: colors.coin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  voteButtonText: { color: colors.background, fontFamily: fonts.bold, fontSize: 11, textAlign: 'center' },
});
