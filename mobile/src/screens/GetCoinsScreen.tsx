import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import BalanceBadge from '../components/BalanceBadge';
import ConfirmationModal from '../components/ConfirmationModal';
import BackArrowIcon from '../assets/back-arrow.svg';
import CoinsGlow from '../assets/coins-glow.svg';
import CoinsIcon from '../assets/coins.svg';
import FilmIcon from '../assets/film.svg';
import SparkRay from '../assets/spark-ray.svg';
import { useAuth } from '../context/AuthContext';
import { claimAdReward, fetchAdRewardStatus } from '../api/wallet';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

const SUCCESS_MODAL_MS = 2500;

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function GetCoinsScreen({ navigation }: any) {
  const { refreshUser } = useAuth();
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedReward, setClaimedReward] = useState<number | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const status = await fetchAdRewardStatus();
      setSecondsRemaining(status.available ? 0 : status.seconds_remaining);
    } catch {
      // Leave the button in its last known state - not worth a full error
      // screen for a secondary "free coins" feature.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus]),
  );

  // Local per-second countdown so the button re-enables on its own once the
  // cooldown lapses, without polling the server every second.
  useEffect(() => {
    if (!secondsRemaining || secondsRemaining <= 0) return;
    const id = setInterval(() => {
      setSecondsRemaining(prev => (prev && prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsRemaining]);

  const onGetCoins = async () => {
    setClaiming(true);
    try {
      const result = await claimAdReward();
      await refreshUser();
      setSecondsRemaining(null);
      await loadStatus();
      setClaimedReward(result.reward);
    } catch (e: any) {
      const remaining = e?.response?.data?.seconds_remaining;
      if (typeof remaining === 'number') setSecondsRemaining(remaining);
      Alert.alert('Not yet', e?.response?.data?.detail ?? 'Try again in a bit.');
    } finally {
      setClaiming(false);
    }
  };

  const onCooldown = !!secondsRemaining && secondsRemaining > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <BackArrowIcon width={12} height={21} />
        </TouchableOpacity>
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title}>Get coins</Text>
        </View>
        <BalanceBadge />
      </View>
      <View style={styles.body}>
        <View style={styles.panel}>
          <Text style={styles.freeCoins}>Free Coins</Text>
          <View style={styles.illustration}>
            <SparkRay width={160} height={94} style={styles.sparkA} />
            <SparkRay width={160} height={94} style={styles.sparkB} />
            <CoinsGlow width={180} height={180} style={styles.glow} />
            <CoinsIcon width={100} height={100} />
          </View>
          <TouchableOpacity
            style={[styles.button, onCooldown && styles.buttonDisabled]}
            onPress={onGetCoins}
            disabled={onCooldown || claiming}>
            {claiming ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <FilmIcon width={24} height={24} />
                <Text style={styles.buttonText}>
                  {onCooldown ? `Available in ${formatSeconds(secondsRemaining)}` : 'Get coins'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ConfirmationModal
        visible={claimedReward !== null}
        title="Success"
        message={claimedReward !== null ? `+${claimedReward} coins added to your balance!` : ''}
        onClose={() => setClaimedReward(null)}
        autoCloseMs={SUCCESS_MODAL_MS}
        accentColor={colors.coin}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { padding: 4 },
  // Absolutely centered on the header regardless of how wide the back
  // button or BalanceBadge (balance digits vary) end up - a plain flex
  // row with space-between would only center it between them, not on
  // the screen. It spans the full header width, so it has to be a View
  // with pointerEvents="none": on a Text that prop does nothing, and the
  // title then silently swallows every tap on the back arrow and badge
  // underneath it.
  titleWrap: { position: 'absolute', left: 0, right: 0 },
  title: {
    textAlign: 'center',
    color: colors.text,
    fontSize: typography.h4.fontSize,
    fontFamily: fonts.bold,
  },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  panel: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.navBackground,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  freeCoins: { color: colors.text, fontSize: typography.h3.fontSize, fontFamily: fonts.bold, marginBottom: 16 },
  illustration: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  sparkA: { position: 'absolute' },
  sparkB: { position: 'absolute', transform: [{ rotate: '90deg' }] },
  // Matches components/Button.tsx exactly (height/borderRadius/text style) -
  // this screen needs a leading icon, which the shared Button doesn't
  // support, otherwise this would just be <Button ... />.
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 24,
    alignSelf: 'stretch',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.text, fontFamily: fonts.semiBold, fontSize: typography.body.fontSize },
});
