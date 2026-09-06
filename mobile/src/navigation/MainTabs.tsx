import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import AccountStack from './AccountStack';
import PlayStack from './PlayStack';
import HistoryScreen from '../screens/HistoryScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

const Tab = createBottomTabNavigator();

// Placeholder glyphs - swap for the real nav icon SVGs once provided.
const ICONS: Record<string, string> = {
  Play: '⚔',
  History: '≡',
  Leaderboard: '🏆',
  Account: '👤',
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
        tabBarIcon: ({ color }) => <Text style={{ color }}>{ICONS[route.name]}</Text>,
      })}>
      <Tab.Screen name="Play" component={PlayStack} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Account" component={AccountStack} />
    </Tab.Navigator>
  );
}
