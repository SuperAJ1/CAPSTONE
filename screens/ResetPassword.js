// screens/ResetPassword.js

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
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ResetPassword() {
  const { language } = useLanguage();
  const t = translations[language];
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigation = useNavigation();

  const handleReset = () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert(
        t.error,
        language === 'en' ? 'Please fill in all fields.' : 'Mangyaring punan ang lahat ng mga field.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        t.error,
        language === 'en' ? 'Passwords do not match.' : 'Hindi magkatugma ang mga password.'
      );
      return;
    }

    // Backend request logic goes here
    Alert.alert(
      t.success,
      language === 'en' ? 'Password has been reset successfully.' : 'Matagumpay na na-reset ang password.'
    );
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <View style={styles.headerContainer}>
              <Text style={styles.headerTitle}>{t.resetPassword}</Text>
              <Text style={styles.headerSubtitle}>
                {language === 'en' ? 'Enter your new password' : 'Ilagay ang iyong bagong password'}
              </Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.label}>
                {language === 'en' ? 'New Password' : 'Bagong Password'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={language === 'en' ? 'Enter new password' : 'Ilagay ang bagong password'}
                placeholderTextColor="#aaa"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Text style={styles.label}>
                {language === 'en' ? 'Confirm Password' : 'Kumpirmahin ang Password'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={language === 'en' ? 'Confirm new password' : 'Kumpirmahin ang bagong password'}
                placeholderTextColor="#aaa"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>
                  {language === 'en' ? 'RESET PASSWORD' : 'I-RESET ANG PASSWORD'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.backText}>{t.back}</Text>
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
