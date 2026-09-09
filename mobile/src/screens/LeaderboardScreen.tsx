import React from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { useFetchList } from '../hooks/useFetchList';
import { fetchLeaderboard } from '../api/votes';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { items, error, loading, reload } = useFetchList(fetchLeaderboard);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
      </View>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState label="No Leaders" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const isMe = !!user && item.username === user.username;
            return (
              <View style={styles.row}>
                <Text style={[styles.rank, isMe && styles.textMe]}>{index + 1}</Text>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )}
                <Text style={[styles.username, isMe && styles.textMe]}>{item.username}</Text>
                <Text style={styles.balance}>{item.balance} gg</Text>
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
  header: { padding: 16 },
  title: { color: colors.text, fontSize: 24, fontFamily: fonts.bold },
  list: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navBackground,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  rank: { color: colors.textMuted, width: 20, fontFamily: fonts.semiBold },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12 },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: colors.cardBorder,
  },
  username: { color: colors.text, flex: 1, fontFamily: fonts.semiBold },
  textMe: { color: colors.primary },
  balance: { color: colors.text, fontFamily: fonts.semiBold },
});
