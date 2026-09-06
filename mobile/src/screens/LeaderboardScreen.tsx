import React, { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import BalanceBadge from '../components/BalanceBadge';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { fetchLeaderboard, LeaderboardEntry } from '../api/votes';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<LeaderboardEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard().then(setItems);
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <BalanceBadge />
      </View>
      {items.length === 0 ? (
        <EmptyState label="No Leaders" />
      ) : (
        <View style={styles.card}>
          <FlatList
            data={items}
            keyExtractor={(_, i) => String(i)}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
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
        </View>
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
  card: {
    marginHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  divider: { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rank: { color: colors.textMuted, width: 20, fontFamily: fonts.semiBold },
  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 10 },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: colors.card,
  },
  username: { color: colors.text, flex: 1, fontFamily: fonts.semiBold },
  textMe: { color: colors.primary },
  balance: { color: colors.text, fontFamily: fonts.semiBold },
});
