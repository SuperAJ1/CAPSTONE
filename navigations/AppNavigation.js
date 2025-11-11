// navigation/AppNavigation.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LandingPage from '../screens/LandingPage';
import LoginScreen from '../screens/Login';
import ForgotPassword from '../screens/ForgotPassword';
import ResetPassword from '../screens/ResetPassword';
import Scanner from '../screens/Scanner';
import Scanner2 from '../screens/Scanner2';
import TransactionsScreen from '../screens/TransactionsScreen';
import Dashboard from '../screens/Dashboard'; // Assuming this is your MainApp screen

import DrawerNavigator from './DrawerNavigator';


const Stack = createNativeStackNavigator();

export default function AppNavigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Landing">
        <Stack.Screen 
          name="Landing" 
          component={LandingPage} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="ForgotPassword" 
          component={ForgotPassword} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="ResetPassword" 
          component={ResetPassword} 
          options={{ headerShown: false }} 
        />
        {/* Add these screens for post-login navigation */}
        <Stack.Screen 
          name="Scanner2" 
          component={Scanner2} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="MainApp"
          component={DrawerNavigator} 
          options={{ headerShown: false }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
} 