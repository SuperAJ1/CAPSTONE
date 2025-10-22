import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const initialUsers = [
  { id: '1', username: 'user1' },
  { id: '2', username: 'user2' },
  { id: '3', username: 'user3' },
];

export default function Users() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [users, setUsers] = useState(initialUsers);
  const { width } = useWindowDimensions();

  const createUser = () => {
    if (!username || !password || !confirmPassword) {
      alert('Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    const newUser = {
      id: (users.length + 1).toString(),
      username,
    };
    setUsers([...users, newUser]);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  const renderUserItem = ({ item }) => (
    <View style={styles.userItem}>
      <View style={styles.userIcon}></View>
      <View style={styles.userTextWrapper}>
        <Text style={styles.usernameText}>{item.username}</Text>
        <Text style={styles.userIdText}>ID: {item.id}</Text>
      </View>
      <View style={styles.userActionDot}></View>
    </View>
  );

  const isTablet = width > 768;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <View style={[styles.container]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { fontSize: width * 0.05 }]}>
              Manage Users Account
            </Text>
            <View style={styles.helpIconContainer}>
              <Text style={styles.helpIconText}>?</Text>
            </View>
          </View>

          <View style={[styles.content, { flexDirection: isTablet ? 'row' : 'column' }]}>
            {/* Left: Scrollable Form */}
            <View style={styles.createUserWrapper}>
              <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.createUserContainer}>
                  <Text style={[styles.sectionTitle, { fontSize: width * 0.04 }]}>
                    Create user
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#5a5a5a"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#5a5a5a"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#5a5a5a"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity style={styles.createButton} onPress={createUser}>
                    <Text style={[styles.createButtonText, { fontSize: width * 0.045 }]}>
                      Create
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>

            {/* Right: User List */}
            <View style={styles.userListContainer}>
              <Text style={[styles.sectionTitle, { fontSize: width * 0.04 }]}>
                User List
              </Text>
              <View style={styles.userListBox}>
                <FlatList
                  data={users}
                  keyExtractor={(item) => item.id}
                  renderItem={renderUserItem}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No users found</Text>
                  }
                  showsVerticalScrollIndicator={false}
                />
                <View style={styles.loadingBarContainer}>
                  <View style={styles.loadingBar}></View>
                  <View style={styles.loadingDot}></View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#2C2524',
  },
  helpIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2C2524',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2524',
  },
  content: {
    flex: 1,
    gap: 20,
  },
  createUserWrapper: {
    flex: 1,
    minWidth: 300,
  },
  createUserContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 10,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#2C2524',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#d3d3d3',
    borderRadius: 6,
    height: 44,
    marginBottom: 12,
    paddingHorizontal: 12,
    color: '#2C2524',
  },
  createButton: {
    backgroundColor: '#2C2524',
    height: 48,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  createButtonText: {
    fontWeight: '700',
    color: '#fff',
  },
  userListContainer: {
    flex: 1,
    minWidth: 300,
  },
  userListBox: {
    borderWidth: 1,
    borderColor: '#c8d0da',
    borderRadius: 10,
    backgroundColor: '#f9fbfe',
    padding: 12,
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#d6dde6',
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  userIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#7986a1',
    marginRight: 12,
  },
  userTextWrapper: {
    flex: 1,
  },
  usernameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C2524',
  },
  userIdText: {
    fontSize: 12,
    color: '#555',
  },
  userActionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7986a1',
  },
  emptyText: {
    color: '#a0a0a0',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  loadingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  loadingBar: {
    height: 8,
    width: '80%',
    backgroundColor: '#2f65f7',
    borderRadius: 12,
  },
  loadingDot: {
    width: 14,
    height: 14,
    backgroundColor: '#2f65f7',
    borderRadius: 7,
    marginLeft: 6,
  },
});
