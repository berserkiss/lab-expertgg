import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SwordsIcon from '../assets/swords.svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export default function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <SwordsIcon width={96} height={96} color={colors.textMuted} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 20, marginTop: 20 },
});
