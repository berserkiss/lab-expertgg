import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
// Figma header row on Play/History/Leaderboard/Account/Get coins. Tapping it
// (the wallet icon includes the "+" badge) opens Get Coins, which lives
// under the Account tab's stack - useNavigation() (rather than a prop) is
// what lets this work from every tab, not just Account's own screens.
export default function BalanceBadge() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation<any>();

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(refreshUser, POLL_MS);
      return () => clearInterval(id);
    }, [refreshUser]),
  );

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('Account', { screen: 'GetCoins' })}>
      <Text style={styles.balance}>{user?.balance ?? 0} gg</Text>
      <WalletIcon width={25} height={24} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balance: { color: colors.text, fontFamily: fonts.semiBold, fontSize: typography.label.fontSize },
});
