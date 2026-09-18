import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GetCoinsScreen from '../screens/GetCoinsScreen';

const Stack = createNativeStackNavigator();

/**
 * Builds a tab's stack with Get coins already in it.
 *
 * Get coins is reachable from every tab, via the balance badge in each
 * screen's header. Putting it inside the tab you are already on is what
 * makes its back arrow return to the screen you tapped the badge on, and
 * what keeps the tab bar visible with the right tab still active - the
 * frame shows Get coins with Play active, not Account.
 */
export function makeTabStack(screens: Array<[string, React.ComponentType<any>]>) {
  return function TabStack() {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {screens.map(([name, component]) => (
          <Stack.Screen key={name} name={name} component={component} />
        ))}
        <Stack.Screen name="GetCoins" component={GetCoinsScreen} />
      </Stack.Navigator>
    );
  };
}
