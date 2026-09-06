import React from 'react';
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
        tabBarStyle: { backgroundColor: colors.navBackground, borderTopColor: colors.navBackground },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
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
