import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BalanceBadge from '../components/BalanceBadge';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

// Placeholder screen: there is no backend endpoint for this yet.
export default function GetCoinsScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Get coins</Text>
        <BalanceBadge />
      </View>
      <View style={styles.body}>
        <Text style={styles.freeCoins}>Free Coins</Text>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Get coins</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { color: colors.text, fontSize: 20 },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.bold },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  freeCoins: { color: colors.text, fontSize: 20, fontFamily: fonts.bold, marginBottom: 24 },
  button: { backgroundColor: colors.primary, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: colors.text, fontFamily: fonts.semiBold },
});
