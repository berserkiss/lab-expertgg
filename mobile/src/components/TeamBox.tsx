import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Team } from '../api/matches';
import SwordsIcon from '../assets/swords.svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

// Play and History draw the same match, so the box that carries a team is one
// component with one set of measurements. The middle column is a fixed width
// rather than whatever "VS" happens to measure, so the boxes land identically
// on History - which draws no VS - as they do on Play.
export const VS_COLUMN_WIDTH = 28;

type Props = {
  team: Team;
  iconFirst?: boolean;
  highlighted?: boolean;
  onPress?: () => void;
};

export default function TeamBox({ team, iconFirst = false, highlighted = false, onPress }: Props) {
  const icon = team.logo ? (
    <Image source={{ uri: team.logo }} style={styles.icon} />
  ) : (
    <SwordsIcon width={18} height={18} color={colors.text} />
  );

  const Container: any = onPress ? TouchableOpacity : View;

  return (
    <Container style={[styles.box, highlighted && styles.boxHighlighted]} onPress={onPress}>
      {iconFirst && icon}
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {team.name}
      </Text>
      {!iconFirst && icon}
    </Container>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.teamButtonBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.teamButtonBorder,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 56,
  },
  boxHighlighted: { borderColor: colors.primary },
  icon: { width: 18, height: 18, borderRadius: 9 },
  name: {
    color: colors.text,
    fontSize: typography.small.fontSize,
    fontFamily: fonts.regular,
    flexShrink: 1,
    textAlign: 'center',
  },
});
