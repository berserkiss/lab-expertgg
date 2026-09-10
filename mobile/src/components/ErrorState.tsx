import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

export default function ErrorState({
  message = 'Something went wrong. Check your connection.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  message: {
    color: colors.lose,
    fontFamily: fonts.regular,
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  buttonText: { color: colors.primary, fontFamily: fonts.semiBold },
});
