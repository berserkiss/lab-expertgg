import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

// Shown under a paginated list while the next page is on its way, so
// reaching the end reads as "more coming" rather than "that was all".
export default function ListFooter({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <View style={styles.footer}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingVertical: 16, alignItems: 'center' },
});
