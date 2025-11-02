import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function CustomDrawer(props) {
  const { user, navigation } = props;
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

  // Fallback for user properties if they don't exist
  const userName = user?.name || 'ADMIN';
  const userRole = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';

  const handleLogout = () => {
    setIsLogoutModalVisible(false);
    // Reset navigation stack and go to Landing
    navigation.reset({
      index: 0,
      routes: [{ name: 'Landing' }],
    });
  };

  const renderLogoutConfirmationModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isLogoutModalVisible}
      onRequestClose={() => setIsLogoutModalVisible(false)}
    >
      <View style={styles.logoutModalOverlay}>
        <View style={styles.logoutModalContainer}>
          <Ionicons name="log-out-outline" size={48} color="#D94848" />
          <Text style={styles.logoutModalTitle}>Confirm Logout</Text>
          <Text style={styles.logoutModalText}>
            Are you sure you want to end your session?
          </Text>
          <View style={styles.logoutModalActions}>
            <TouchableOpacity
              style={[styles.logoutModalButton, styles.cancelLogoutButton]}
              onPress={() => setIsLogoutModalVisible(false)}
            >
              <Text style={[styles.logoutModalButtonText, { color: '#4B5563' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logoutModalButton, styles.confirmLogoutButton]}
              onPress={handleLogout}
            >
              <Text style={styles.logoutModalButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.container}
      >
        {/* Profile Section */}
        <View style={styles.profileContainer}>
          <View style={styles.avatar}>
            <Feather name="user" size={40} color="#E5E7EB" />
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userRole}>{userRole}</Text>
        </View>

        {/* Main Drawer Items */}
        <View style={styles.drawerList}>
          <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>

      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setIsLogoutModalVisible(true)}
        >
          <Feather name="log-out" size={22} color="#A1A1AA" style={styles.icon} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      {renderLogoutConfirmationModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2D2B33', // Slightly lighter than header for depth
  },
  profileContainer: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#4A4754',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A4754',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userRole: {
    color: '#A1A1AA',
    fontSize: 14,
    marginTop: 4,
  },
  drawerList: {
    flex: 1,
    paddingTop: 10,
  },
  logoutContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#4A4754',
    backgroundColor: '#2D2B33',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  icon: {
    marginRight: 15,
  },
  logoutText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '500',
  },
  // Logout Modal Styles
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalContainer: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  logoutModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  logoutModalText: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  cancelLogoutButton: {
    backgroundColor: '#E5E7EB',
  },
  confirmLogoutButton: {
    backgroundColor: '#EF4444',
  },
  logoutModalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});