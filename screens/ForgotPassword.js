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

export default function ForgotPassword() {
  const { language } = useLanguage();
  const t = translations[language];
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const navigation = useNavigation();

  const handleReset = async () => {
    if (!username || !question) {
      Alert.alert(
        t.error,
        language === 'en' ? 'Please fill in all fields.' : 'Mangyaring punan ang lahat ng mga field.'
      );
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
        Alert.alert(
          language === 'en' ? 'Invalid Answer' : 'Hindi Wasto ang Sagot',
          json.message || (language === 'en' ? 'Incorrect security answer.' : 'Hindi wasto ang sagot sa seguridad.')
        );
      }
    } catch (error) {
      console.error('Error verifying security question:', error);
      Alert.alert(
        language === 'en' ? 'Connection Error' : 'Error sa Koneksyon',
        language === 'en' ? 'Failed to connect to the server.' : 'Nabigo ang koneksyon sa server.'
      );
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
              <Text style={styles.headerTitle}>{t.forgotPasswordTitle}</Text>
              <Text style={styles.headerSubtitle}>
                {language === 'en' ? 'Answer your security question' : 'Sagutin ang iyong security question'}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <Text style={styles.label}>{t.usernamePlaceholder}</Text>
              <TextInput
                style={styles.input}
                placeholder={language === 'en' ? 'Enter your username' : 'Ilagay ang iyong username'}
                placeholderTextColor="#aaa"
                value={username}
                onChangeText={setUsername}
              />

              <Text style={styles.label}>
                {language === 'en' ? 'What is your favorite food?' : 'Ano ang iyong paboritong pagkain?'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={language === 'en' ? 'Type your answer' : 'Ilagay ang iyong sagot'}
                placeholderTextColor="#aaa"
                value={question}
                onChangeText={setQuestion}
              />

              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>
                  {language === 'en' ? 'SUBMIT' : 'ISUMITE'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.backText}>{t.backToLogin}</Text>
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

