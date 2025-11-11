import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Animated } from 'react-native';
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

const AnimatedFeatherIcon = Animated.createAnimatedComponent(Feather);

// Custom animated tab icon
const TabBarIcon = ({ name, focused }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const color = focused ? '#FFFFFF' : '#9E9E9E';

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.2 : 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <AnimatedFeatherIcon
      name={name}
      size={24}
      color={color}
      style={{ transform: [{ scale }] }}
    />
  );
};

function DrawerNavigation({ initialRouteName }) {
  return (
    <Drawer.Navigator
      initialRouteName={initialRouteName || 'Dashboard'}
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={({ navigation }) => ({
        drawerActiveTintColor: '#FFFFFF',
        drawerActiveBackgroundColor: 'rgba(255, 255, 255, 0.1)',
        drawerInactiveTintColor: '#B0B0B0',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#37353E',
          height: 80,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 34,
          color: '#FFFFFF',
        },
        headerTintColor: '#FFFFFF',
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => navigation.toggleDrawer()}
            style={{ marginLeft: 20 }}
          >
            <Feather name="menu" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ),
        drawerStyle: {
          backgroundColor: '#FBFBFB',
        },
        drawerItemStyle: {
          borderRadius: 8,
          marginHorizontal: 15,
          marginVertical: 5,
        },
        drawerLabelStyle: {
          marginLeft: -10,
          fontSize: 16,
          fontWeight: '500',
        },
        // Add fade transition for screens
        cardStyleInterpolator: ({ current: { progress } }) => ({
          cardStyle: {
            opacity: progress,
          },
        }),
      })}
    >
      <Drawer.Screen 
        name="Dashboard" 
        component={Dashboard}
        options={{
          drawerIcon: ({ color }) => (
            <Feather name="home" size={20} color={color} />
          )
        }}
      />
      <Drawer.Screen 
        name="Scanner" 
        component={Scanner}
        options={{
          drawerIcon: ({ color }) => (
            <Feather name="camera" size={20} color={color} />
          )
        }}
      />
      <Drawer.Screen 
        name="Inventory" 
        component={Inventory}
        options={{
          drawerIcon: ({ color }) => (
            <Feather name="box" size={20} color={color} />
          )
        }}
      />
    </Drawer.Navigator>
  );
}

function TabNavigation({ initialRouteName }) {
  return (
    <Tab.Navigator
      initialRouteName={initialRouteName || 'Dashboard'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#37353E',
          height: 70,
          borderTopWidth: 0,
          elevation: 8,
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        tabBarItemStyle: {
          paddingVertical: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
        tabBarIcon: ({ focused }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = 'home';
          else if (route.name === 'Scanner') iconName = 'camera';
          else if (route.name === 'Inventory') iconName = 'box';
          return <TabBarIcon name={iconName} focused={focused} />;
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#9E9E9E',
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
  const { initialRouteName } = route.params || {};
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
      {isTablet ? <DrawerNavigation initialRouteName={initialRouteName} /> : (orientation === 'landscape' ? <DrawerNavigation initialRouteName={initialRouteName} /> : <TabNavigation initialRouteName={initialRouteName} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFBFB',
  },
});