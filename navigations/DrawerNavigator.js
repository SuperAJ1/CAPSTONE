import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';

import Dashboard from '../screens/Dashboard';
import Scanner from '../screens/Scanner';
import Inventory from '../screens/Inventory';
import CustomDrawer from '../components/CustomDrawer';

const Drawer = createDrawerNavigator();

export default function DrawerNavigator({ route }) {
  const { user } = route.params;
  const { role } = user;

  const scannerComponent = (props) => <Scanner {...props} userId={user.id} />;
  const dashboardComponent = (props) => <Dashboard {...props} user={user} />;
  const inventoryComponent = (props) => <Inventory {...props} user={user} />;

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} user={user} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerTitle: () => (
          <Image 
            source={require('../assets/logo3.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        ),
        headerStyle: {
          backgroundColor: '#37353E',
          height: 80,
          elevation: 0, // Remove shadow for a flat look
          shadowOpacity: 0,
        },
        headerTintColor: '#FFFFFF',
        headerLeft: () => (
          <TouchableOpacity onPress={() => navigation.toggleDrawer()} style={{ marginLeft: 15 }}>
            <Feather name="menu" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ),
        drawerActiveTintColor: '#FFFFFF', // White text for active item
        drawerActiveBackgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle white highlight for press effect
        drawerInactiveTintColor: '#FFFFFF', // Lighter gray for better visibility
        drawerLabelStyle: {
          marginLeft: -20, // Align text with icon
          fontSize: 16,
          fontWeight: '500',
        },
        drawerItemStyle: {
          borderRadius: 8,
          marginHorizontal: 12,
          marginVertical: 4,
        },
      })}
    >
      {role === 'admin' && (
        <>
          <Drawer.Screen
            name="Dashboard"
            component={dashboardComponent}
            options={{
              drawerIcon: ({ color, size }) => (
                <Feather name="home" color={color} size={size} />
              ),
            }}
          />
          <Drawer.Screen
            name="Inventory"
            component={inventoryComponent}
            options={{
              drawerIcon: ({ color, size }) => (
                <Feather name="box" color={color} size={size} />
              ),
            }}
          />
        </>
      )}

      <Drawer.Screen
        name="Scanner"
        component={scannerComponent}
        options={{
          drawerIcon: ({ color, size }) => (
            <Feather name="camera" color={color} size={size} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 250,
    height: 70,
  },
});