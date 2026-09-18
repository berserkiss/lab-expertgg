import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
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
// (the wallet icon includes the "+" badge) pushes Get coins onto whichever
// tab's stack is showing, so its back arrow returns here; useNavigation()
// (rather than a prop) is what lets this work from every tab.
export default function BalanceBadge() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation<any>();

  useFocusEffect(
    useCallback(() => {
      // A poll tick that fails is swallowed on purpose: the next tick
      // retries, and a session that has actually expired is handled
      // centrally by the client's auth-failure handler. Left unhandled it
      // surfaces as an "Uncaught (in promise)" red box on whatever screen
      // happens to be open whenever the backend blips or restarts.
      const id = setInterval(() => {
        refreshUser().catch(() => {});
      }, POLL_MS);
      return () => clearInterval(id);
    }, [refreshUser]),
  );

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('GetCoins')}>
      <Text style={styles.balance}>{user?.balance ?? 0} gg</Text>
      {/* The asset's own 35x34 - the frame draws it at full size. */}
      <WalletIcon width={35} height={34} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // The frame sets the bag almost against the number and sits the number on
  // the bag's bottom edge, rather than centring the two against each other.
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  balance: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.label.fontSize },
});
