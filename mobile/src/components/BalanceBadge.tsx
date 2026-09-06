import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export default function BalanceBadge() {
  const { user } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{user?.balance ?? 0} gg</Text>
      <View style={styles.coin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  text: { color: colors.text, marginRight: 6, fontFamily: fonts.semiBold },
  coin: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.coin },
});
