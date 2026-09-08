import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import AuthBackground from '../components/AuthBackground';
import Logo from '../components/Logo';
import { colors } from '../theme/colors';

export default function SplashScreen() {
  return (
    <AuthBackground style={styles.container}>
      <Logo size={60} />
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: { marginTop: 24 },
});
