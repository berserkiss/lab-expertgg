import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SwordsIcon from '../assets/swords.svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export default function Logo({ size = 32 }: { size?: number }) {
  const iconSize = size * 0.8;
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { fontSize: size }]}>e</Text>
      <SwordsIcon width={iconSize} height={iconSize} style={styles.icon} />
      <Text style={[styles.text, { fontSize: size }]}>pert</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, fontFamily: fonts.bold },
  icon: { marginHorizontal: -2 },
});
