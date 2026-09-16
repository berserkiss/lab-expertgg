import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BookScreen from '../screens/BookScreen';
import PlayScreen from '../screens/PlayScreen';

const Stack = createNativeStackNavigator();

export default function PlayStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PlayHome" component={PlayScreen} />
      <Stack.Screen name="Book" component={BookScreen} />
    </Stack.Navigator>
  );
}
