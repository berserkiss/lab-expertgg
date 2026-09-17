import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  autoCloseMs?: number;
  accentColor?: string;
};

export default function ConfirmationModal({
  visible,
  title,
  message,
  onClose,
  autoCloseMs,
  accentColor = colors.win,
}: Props) {
  useEffect(() => {
    if (!visible || !autoCloseMs) return;
    const id = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(id);
  }, [visible, autoCloseMs, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.card, { borderColor: accentColor }]}>
          <View style={[styles.badge, { backgroundColor: accentColor }]}>
            <Text style={styles.badgeCheck}>✓</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.navBackground,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgeCheck: { color: colors.background, fontSize: 24, fontFamily: fonts.bold },
  title: {
    color: colors.text,
    fontSize: typography.h4.fontSize,
    fontFamily: fonts.bold,
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.small.fontSize,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
});
