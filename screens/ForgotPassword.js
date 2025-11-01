import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const navigation = useNavigation();

  const handleReset = async () => {
    if (!username || !question) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      const response = await fetch('http://192.168.1.206/rtw_backend/verify_question.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, question }),
      });

      const json = await response.json();

      if (json.status === 'success') {
        navigation.navigate('ResetPassword', { username }); // pass username to next screen
      } else {
        Alert.alert('Invalid Answer', json.message || 'Incorrect security answer.');
      }
    } catch (error) {
      console.error('Error verifying security question:', error);
      Alert.alert('Connection Error', 'Failed to connect to the server.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
              <Text style={styles.headerTitle}>Forgot Password</Text>
              <Text style={styles.headerSubtitle}>Answer your security question</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#aaa"
                value={username}
                onChangeText={setUsername}
              />

              <Text style={styles.label}>What is your favorite food?</Text>
              <TextInput
                style={styles.input}
                placeholder="Type your answer"
                placeholderTextColor="#aaa"
                value={question}
                onChangeText={setQuestion}
              />

              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>SUBMIT</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.backText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    backgroundColor: '#2C2524',
    paddingVertical: SCREEN_HEIGHT * 0.06,
    paddingHorizontal: SCREEN_WIDTH * 0.07,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerTitle: {
    fontSize: SCREEN_WIDTH * 0.07,
    color: '#fff',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#fff',
    marginTop: 5,
  },
  formContainer: {
    padding: SCREEN_WIDTH * 0.08,
  },
  label: {
    color: '#2C2524',
    fontSize: SCREEN_WIDTH * 0.035,
    marginBottom: 5,
    marginTop: 20,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#000',
  },
  resetButton: {
    backgroundColor: '#2C2524',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 30,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
  },
  backText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#888',
    fontSize: SCREEN_WIDTH * 0.035,
    textDecorationLine: 'underline',
  },
});
