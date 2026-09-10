import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, variant === 'outline' ? styles.outline : styles.primary, style]}
      onPress={onPress}
      disabled={disabled}>
      {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.text}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { height: 50, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.primary },
  outline: { borderWidth: 1, borderColor: colors.primary },
  text: { color: colors.text, fontFamily: fonts.semiBold, fontSize: typography.body.fontSize },
});
