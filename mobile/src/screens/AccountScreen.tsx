import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BalanceBadge from '../components/BalanceBadge';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function AccountScreen({ navigation }: any) {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
        <BalanceBadge />
      </View>

      <View style={styles.profile}>
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )}
        <Text style={styles.username}>{user?.username || user?.email}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <TouchableOpacity style={styles.editButton}>
        <Text style={styles.editButtonText}>Edit profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.getCoinsButton} onPress={() => navigation.navigate('GetCoins')}>
        <Text style={styles.getCoinsText}>Get coins</Text>
      </TouchableOpacity>

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
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  profile: { alignItems: 'center', marginVertical: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.card, marginBottom: 12 },
  username: { color: colors.text, fontSize: 18, fontWeight: '700' },
  email: { color: colors.textMuted, fontSize: 13 },
  editButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 20,
    marginHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  editButtonText: { color: colors.primary, fontWeight: '600' },
  getCoinsButton: {
    backgroundColor: colors.card,
    borderRadius: 20,
    marginHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  getCoinsText: { color: colors.text, fontWeight: '600' },
  logoutButton: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    marginHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  logoutText: { color: colors.text, fontWeight: '600' },
});
