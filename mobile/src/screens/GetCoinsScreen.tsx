import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BalanceBadge from '../components/BalanceBadge';
import CoinsGlow from '../assets/coins-glow.svg';
import CoinsIcon from '../assets/coins.svg';
import FilmIcon from '../assets/film.svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

// Placeholder screen: there is no backend endpoint for this yet - the
// button below is intentionally inert (see code.md, out of scope for
// Simplified 2).
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
        <View style={styles.panel}>
          <Text style={styles.freeCoins}>Free Coins</Text>
          <View style={styles.illustration}>
            <CoinsGlow width={100} height={100} style={styles.glow} />
            <CoinsIcon width={100} height={100} />
          </View>
        </View>
        <TouchableOpacity style={styles.button}>
          <FilmIcon width={24} height={24} />
          <Text style={styles.buttonText}>Get coins</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { color: colors.text, fontSize: typography.h3.fontSize },
  title: { color: colors.text, fontSize: typography.h4.fontSize, fontFamily: fonts.bold },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  panel: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 32,
    marginBottom: 24,
  },
  freeCoins: { color: colors.text, fontSize: typography.h3.fontSize, fontFamily: fonts.bold, marginBottom: 24 },
  illustration: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
  },
  buttonText: { color: colors.text, fontFamily: fonts.semiBold },
});
