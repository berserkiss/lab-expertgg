import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BetCard from '../components/BetCard';
import ErrorState from '../components/ErrorState';
import ListFooter from '../components/ListFooter';
import { fetchMatchBets } from '../api/matches';
import { useFetchList } from '../hooks/useFetchList';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

export default function BookScreen({ route, navigation }: any) {
  const { matchId } = route.params;
  const { items, error, loadingMore, reload, loadMore } = useFetchList(pageUrl =>
    fetchMatchBets(matchId, pageUrl),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Book</Text>
      </View>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={b => String(b.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <BetCard item={item} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={<ListFooter loading={loadingMore} />}
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
