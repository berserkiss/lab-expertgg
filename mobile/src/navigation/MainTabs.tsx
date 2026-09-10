import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AccountStack from './AccountStack';
import PlayStack from './PlayStack';
import HistoryScreen from '../screens/HistoryScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import SwordsIcon from '../assets/nav/swords.svg';
import ListIcon from '../assets/nav/list.svg';
import TrophyIcon from '../assets/nav/trophy.svg';
import UserIcon from '../assets/nav/user.svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, React.FC<{ width: number; height: number; color: string }>> = {
  Play: SwordsIcon,
  History: ListIcon,
  Leaderboard: TrophyIcon,
  Account: UserIcon,
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.navIconActive,
        tabBarInactiveTintColor: colors.navIconInactive,
        // paddingHorizontal keeps the outer two tabs' labels (Play, Account)
        // off the very edge of the screen - on some real devices with
        // rounded display corners, edge-to-edge content there gets visually
        // clipped by the corner radius, which the emulator doesn't simulate.
        tabBarStyle: {
          backgroundColor: colors.navBackground,
          borderTopColor: colors.navBackground,
          paddingHorizontal: 4,
          paddingBottom: 10,
        },
        // "Leaderboard" is the longest label - fixing every label to a small
        // enough size to never truncate it makes the other three look
        // undersized next to the design. Instead render the full-size label
        // and let it shrink on its own, only as much as it needs to, only on
        // the tab(s) that don't have room at full size.
        tabBarLabel: ({ color, children }) => (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{ fontFamily: fonts.medium, fontSize: typography.small.fontSize, color }}>
            {children}
          </Text>
        ),
        tabBarIcon: ({ color }) => {
          const Icon = ICONS[route.name];
          return <Icon width={22} height={22} color={color} />;
        },
      })}>
      <Tab.Screen name="Play" component={PlayStack} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Account" component={AccountStack} />
    </Tab.Navigator>
  );
}
