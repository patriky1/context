import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import GameScreen from './screens/GameScreen';
import ResultScreen from './screens/ResultScreen';

const Stack = createStackNavigator();

function Navigation() {
  return (
    <NavigationContainer>
       <Stack.Navigator
        initialRouteName="Context"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Context" component={GameScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default Navigation;