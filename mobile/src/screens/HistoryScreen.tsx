import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BetCard from '../components/BetCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useFetchList } from '../hooks/useFetchList';
import { fetchHistory } from '../api/votes';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export default function HistoryScreen() {
  const { items, error, loading, reload } = useFetchList(fetchHistory);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState label="No History" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <BetCard item={item} />}
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
  list: { paddingHorizontal: 16 },
});
