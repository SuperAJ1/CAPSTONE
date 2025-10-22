import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useResponsive } from '../utils/responsive';

// Import your screens
import Dashboard from '../screens/Dashboard';
import Scanner from '../screens/Scanner';
import Inventory from '../screens/Inventory';
import CustomDrawer from '../components/CustomDrawer';

const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

function DrawerNavigation() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={({ navigation }) => ({
        drawerActiveTintColor: '#000000',
        drawerActiveBackgroundColor: '#D3DAD9',
        drawerInactiveTintColor: '#000000',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#37353E',
          height: 80,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
          color: '#FFFFFF',
        },
        headerTintColor: '#FFFFFF',
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => navigation.toggleDrawer()}
            style={{ marginLeft: 15 }}
          >
            <Feather name="menu" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ),
        drawerStyle: {
          backgroundColor: '#C5BAFF',
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
        },
        drawerItemStyle: {
          borderRadius: 10,
          marginHorizontal: 10,
          marginVertical: 5,
        },
        drawerLabelStyle: {
          marginLeft: -10,
          fontSize: 16,
        },
      })}
    >
      <Drawer.Screen 
        name="Dashboard" 
        component={Dashboard}
        options={{
          drawerIcon: ({ color }) => (
            <Feather name="home" size={20} color="#000000" />
          )
        }}
      />
      <Drawer.Screen 
        name="Scanner" 
        component={Scanner}
        options={{
          drawerIcon: ({ color }) => (
            <Feather name="camera" size={20} color="#000000" />
          )
        }}
      />
      <Drawer.Screen 
        name="Inventory" 
        component={Inventory}
        options={{
          drawerIcon: ({ color }) => (
            <Feather name="box" size={20} color="#000000" />
          )
        }}
      />
    </Drawer.Navigator>
  );
}

function TabNavigation() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#37353E',
          borderTopWidth: 0,
          elevation: 0,
          height: 70,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          position: 'absolute',
          paddingBottom: 10,
        },
        tabBarItemStyle: {
          paddingVertical: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
          paddingBottom: 5,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = 'home';
          else if (route.name === 'Scanner') iconName = 'camera';
          else if (route.name === 'Inventory') iconName = 'box';
          return <Feather name={iconName} size={24} color="#000000" />;
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#000000',
        tabBarActiveBackgroundColor: '#D3DAD9',
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={Dashboard} 
        options={{ title: 'Dashboard' }} 
      />
      <Tab.Screen 
        name="Scanner" 
        component={Scanner} 
        options={{ title: 'Scanner' }} 
      />
      <Tab.Screen 
        name="Inventory" 
        component={Inventory} 
        options={{ title: 'Inventory' }} 
      />
    </Tab.Navigator>
  );
}

export default function ResponsiveNavigation({ route }) {
  const [orientation, setOrientation] = useState(
    Dimensions.get('window').width > Dimensions.get('window').height 
      ? 'landscape' 
      : 'portrait'
  );
  const { isTablet } = useResponsive();

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setOrientation(window.width > window.height ? 'landscape' : 'portrait');
    });

    return () => subscription?.remove();
  }, []);

  return (
    <View style={styles.container}>
      {isTablet ? <DrawerNavigation /> : (orientation === 'landscape' ? <DrawerNavigation /> : <TabNavigation />)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFBFB',
  },
});