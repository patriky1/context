import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import GameScreen from './screens/GameScreen';

const Stack = createStackNavigator();

function Navigation() {
  return (
    <NavigationContainer>
       <Stack.Navigator
        initialRouteName="Context"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Context" component={GameScreen} />
       
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default Navigation;