import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SwordsIcon from '../assets/swords.svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

export default function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <SwordsIcon width={96} height={96} color={colors.textGray} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: {
    color: colors.textGray,
    fontFamily: fonts.regular,
    fontSize: typography.display.fontSize,
    letterSpacing: -0.24,
    marginTop: 20,
  },
});
