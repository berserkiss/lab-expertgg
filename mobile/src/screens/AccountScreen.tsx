import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export default function AccountScreen() {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: { color: colors.text, fontSize: 24, fontFamily: fonts.bold },
  logoutButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 20,
    marginHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 590,
  },
  logoutText: { color: colors.text, fontFamily: fonts.semiBold },
});
