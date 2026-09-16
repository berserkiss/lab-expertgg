import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BalanceBadge from '../components/BalanceBadge';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

export default function AccountScreen() {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
        <BalanceBadge />
      </View>

      <Button label="Log out" variant="outline" onPress={logout} style={styles.logoutButton} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: { color: colors.text, ...typography.h1, fontFamily: fonts.bold },
  logoutButton: {
    // Same 46dp side inset SignInScreen gets from its container's
    // paddingHorizontal, so the two buttons line up edge to edge.
    marginHorizontal: 46,
    // Matches the Leaderboard list's row gap (ROW_GAP in LeaderboardScreen)
    // so the two tabs feel aligned when switching between them, rather than
    // the button sitting flush at the screen edge.
    marginBottom: 16,
  },
});
