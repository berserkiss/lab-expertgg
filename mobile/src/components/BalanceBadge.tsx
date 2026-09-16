import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import WalletIcon from '../assets/wallet.svg';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

// How often the balance refreshes on its own while a screen showing it is
// focused - a bet resolving (match finishes) shouldn't need a manual pull
// to reflect in the header.
const POLL_MS = 15000;

// Shown in every main-tab screen's header, next to the title - matches the
// Figma header row on Play/History/Leaderboard/Account/Get coins.
export default function BalanceBadge() {
  const { user, refreshUser } = useAuth();

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(refreshUser, POLL_MS);
      return () => clearInterval(id);
    }, [refreshUser]),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.balance}>{user?.balance ?? 0} gg</Text>
      <WalletIcon width={28} height={27} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balance: { color: colors.text, fontFamily: fonts.semiBold, fontSize: typography.label.fontSize },
});
