import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { makeTabStack } from './tabStack';
import AccountScreen from '../screens/AccountScreen';
import BookScreen from '../screens/BookScreen';
import HistoryScreen from '../screens/HistoryScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import PlayScreen from '../screens/PlayScreen';
import SwordsIcon from '../assets/nav/swords.svg';
import ListIcon from '../assets/nav/list.svg';
import TrophyIcon from '../assets/nav/trophy.svg';
import UserIcon from '../assets/nav/user.svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { typography } from '../theme/typography';

const Tab = createBottomTabNavigator();

const PlayStack = makeTabStack([['PlayHome', PlayScreen], ['Book', BookScreen]]);
const HistoryStack = makeTabStack([['HistoryHome', HistoryScreen]]);
const LeaderboardStack = makeTabStack([['LeaderboardHome', LeaderboardScreen]]);
const AccountStack = makeTabStack([['AccountHome', AccountScreen]]);

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
        tabBarLabel: ({ color, children }) => (
          <Text
            numberOfLines={1}
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
      <Tab.Screen name="History" component={HistoryStack} />
      <Tab.Screen name="Leaderboard" component={LeaderboardStack} options={{ title: 'Leaders' }} />
      <Tab.Screen name="Account" component={AccountStack} />
    </Tab.Navigator>
  );
}
