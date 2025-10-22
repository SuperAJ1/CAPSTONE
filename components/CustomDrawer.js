import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { FontAwesome as Icon } from '@expo/vector-icons';

export default function CustomDrawer(props) {
  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.container}
    >
      {/* Logo/Header Section - Now with bigger logo */}
      <View style={styles.headerContainer}>
        <Image 
          source={require('../assets/logo3.png')} 
          style={styles.logo} 
        />
        <Text style={styles.brandTitle}>SIMS</Text>
        <Text style={styles.brandSubtitle}>SALES AND INVENTORY</Text>
      </View>

      {/* Main Drawer Items */}
      <View style={styles.drawerList}>
        <DrawerItemList 
          {...props} 
          activeTintColor="#000000"
          inactiveTintColor="#000000"
          activeBackgroundColor="#D3DAD9"
          labelStyle={styles.menuText}
          itemStyle={styles.menuItem}
        />
      </View>

      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => props.navigation.navigate('Login')}
        >
          <View style={styles.iconLabel}>
            <Icon name="sign-out" size={18} color="#FFFFFF" style={styles.icon} />
            <Text style={styles.logoutText}>LOGOUT</Text>
          </View>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFBFB',
  },
  headerContainer: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#C4D9FF',
    backgroundColor: '#E5E7EB',
  },
  logo: {
    width: 120,  // Increased from 80 to 120
    height: 120, // Increased from 80 to 120
    resizeMode: 'contain',
    marginBottom: 15, // Increased margin to balance larger logo
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 5, // Added small margin
  },
  brandSubtitle: {
    color: '#000000',
    fontSize: 14,
    letterSpacing: 1,
    marginTop: 5, // Added small margin
  },
  drawerList: {
    flex: 1,
    paddingTop: 15,
    backgroundColor: '#FBFBFB',
  },
  menuText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
  },
  menuItem: {
    borderRadius: 8,
    marginHorizontal: 10,
    marginVertical: 2,
  },
  logoutContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#C4D9FF',
    backgroundColor: '#FBFBFB',
  },
  logoutButton: {
    backgroundColor: '#000000',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});