import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BetCard from '../components/BetCard';
import ErrorState from '../components/ErrorState';
import { fetchMatchBets } from '../api/matches';
import { VoteHistoryItem } from '../api/votes';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

export default function BookScreen({ route, navigation }: any) {
  const { matchId } = route.params;
  const [bets, setBets] = useState<VoteHistoryItem[]>([]);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    fetchMatchBets(matchId)
      .then(setBets)
      .catch(() => setError(true));
  };

  useEffect(load, [matchId]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Book</Text>
      </View>
      {error ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={bets}
          keyExtractor={b => String(b.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <BetCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { color: colors.text, fontSize: typography.h3.fontSize },
  title: { color: colors.text, fontSize: typography.h4.fontSize, fontFamily: fonts.bold },
  list: { paddingHorizontal: 16 },
});
