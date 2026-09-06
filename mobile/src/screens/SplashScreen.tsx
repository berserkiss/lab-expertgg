import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Logo from '../components/Logo';
import { colors } from '../theme/colors';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Logo size={40} />
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: { marginTop: 24 },
});
