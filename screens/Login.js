'use strict';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  PanResponder,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { API_URL } from '../utils/config';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

const getStyles = (width, height) => {
  const IS_LANDSCAPE = width > height;
  const CARD_MAX_WIDTH = IS_LANDSCAPE ? Math.min(500, width * 0.5) : Math.min(420, width * 0.9);
  const LOGO_SIZE = IS_LANDSCAPE ? Math.min(180, height * 0.3) : width * 0.30;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#F5F5F7', // iOS light gray background
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollViewContent: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      paddingTop: 10,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    container: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 0,
    },
    centerWrapper: {
      width: '100%',
      maxWidth: CARD_MAX_WIDTH,
      alignItems: 'center',
    },
    brandingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: -18,
      gap: 14,
    },
    brandingTextCol: {
      justifyContent: 'center',
    },
    brandTitle: {
      fontSize: Math.min(width * 0.12, 50),
      fontWeight: '700',
      color: '#1D1D1F',
      letterSpacing: -0.5,
    },
    brandSubtitle: {
      color: '#86868B',
      fontSize: Math.min(width * 0.048, 22),
      letterSpacing: 1.2,
      fontWeight: '500',
      marginTop: 2,
    },
    logo: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      resizeMode: 'contain',
    },
    card: {
      width: '100%',
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 8,
    },
    welcomeTitle: {
      fontSize: Math.min(width * 0.11, 46),
      textAlign: 'center',
      fontWeight: '700',
      color: '#1D1D1F',
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    welcomeSubtitle: {
      textAlign: 'center',
      color: '#86868B',
      fontSize: Math.min(width * 0.058, 24),
      marginBottom: 24,
      fontWeight: '400',
      letterSpacing: 0.1,
      lineHeight: 30,
    },
    label: {
      color: '#1D1D1F',
      fontSize: Math.min(width * 0.052, 20),
      marginBottom: 8,
      marginTop: 20,
      fontWeight: '600',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F5F5F7',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: '#E5E5E7',
      marginTop: 8,
      minHeight: 58,
    },
    inputError: {
      borderColor: '#FF3B30',
      backgroundColor: '#FFF5F5',
    },
    errorText: {
      color: '#FF3B30',
      fontSize: Math.min(width * 0.045, 18),
      marginTop: 6,
      marginLeft: 4,
      fontWeight: '500',
    },
    input: {
      flex: 1,
      fontSize: Math.min(width * 0.055, 22),
      color: '#1D1D1F',
      fontWeight: '400',
    },
    forgotPassword: {
      textAlign: 'right',
      marginTop: 16,
      color: '#007AFF',
      fontSize: Math.min(width * 0.048, 20),
      fontWeight: '500',
    },
    loginButton: {
      backgroundColor: '#000000',
      paddingVertical: 18,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 32,
      minHeight: 58,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    disabledButton: {
      backgroundColor: '#86868B',
      opacity: 0.6,
    },
    notify: {
      position: 'absolute',
      top: 8,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifyText: {
      backgroundColor: 'rgba(0,0,0,0.85)',
      color: '#FFFFFF',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 20,
      overflow: 'hidden',
      fontWeight: '600',
      fontSize: Math.min(width * 0.048, 20),
    },
    loginButtonText: {
      color: '#FFFFFF',
      fontSize: Math.min(width * 0.055, 22),
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    brandingContainer: {
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 10,
    },
    strengthMeter: {
      flexDirection: 'row',
      marginTop: 10,
      height: 4,
      width: '100%',
      justifyContent: 'space-between',
    },
    strengthBar: {
      flex: 1,
      height: 4,
      backgroundColor: '#E5E5E7',
      marginHorizontal: 2,
      borderRadius: 2,
    },
    strengthBarActive: {
      backgroundColor: '#FF9500',
    },
    // Forgot Password Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalOverlayTouchable: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    modalCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      padding: 36,
      width: '100%',
      maxWidth: Math.min(420, width * 0.88),
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.2,
      shadowRadius: 30,
      elevation: 15,
    },
    modalIconContainer: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: '#F5F5F7',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 28,
    },
    modalHeaderContainer: {
      alignItems: 'center',
      marginBottom: 24,
      width: '100%',
    },
    modalTitle: {
      fontSize: Math.min(width * 0.075, 32),
      fontWeight: '700',
      color: '#1D1D1F',
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    modalSubtitle: {
      fontSize: Math.min(width * 0.042, 18),
      color: '#86868B',
      fontWeight: '400',
      textAlign: 'center',
      letterSpacing: 0.15,
    },
    modalMessageText: {
      fontSize: Math.min(width * 0.040, 17),
      color: '#1D1D1F',
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 28,
      fontWeight: '400',
      letterSpacing: 0.1,
      paddingHorizontal: 4,
    },
    modalContactSection: {
      borderTopWidth: 1,
      borderTopColor: '#E5E5E7',
      paddingTop: 24,
      marginTop: 8,
      width: '100%',
      alignItems: 'center',
    },
    modalContactTitle: {
      fontSize: Math.min(width * 0.035, 14),
      color: '#86868B',
      fontWeight: '600',
      marginBottom: 20,
      textAlign: 'center',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    modalContactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      paddingVertical: 6,
      width: '100%',
    },
    modalContactText: {
      fontSize: Math.min(width * 0.040, 17),
      color: '#1D1D1F',
      fontWeight: '500',
      letterSpacing: 0.2,
      marginLeft: 12,
    },
    modalCloseButton: {
      backgroundColor: '#000000',
      paddingVertical: 16,
      paddingHorizontal: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 28,
      width: '100%',
      minHeight: 52,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    modalCloseButtonText: {
      color: '#FFFFFF',
      fontSize: Math.min(width * 0.042, 18),
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    languageButton: {
      position: 'absolute',
      top: 20,
      right: 20,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: '#E5E5E7',
      zIndex: 10,
    },
    languageButtonText: {
      fontSize: Math.min(width * 0.040, 16),
      fontWeight: '600',
      color: '#1D1D1F',
      marginLeft: 8,
    },
    languageModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    languageModalCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: Math.min(350, width * 0.85),
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
    languageModalTitle: {
      fontSize: Math.min(width * 0.065, 24),
      fontWeight: '700',
      color: '#1D1D1F',
      marginBottom: 24,
      textAlign: 'center',
    },
    languageOption: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: '#F5F5F7',
      borderWidth: 2,
      borderColor: '#E5E5E7',
    },
    languageOptionSelected: {
      backgroundColor: '#E3F2FD',
      borderColor: '#007AFF',
    },
    languageOptionText: {
      fontSize: Math.min(width * 0.050, 18),
      fontWeight: '600',
      color: '#1D1D1F',
    },
    languageOptionSubtext: {
      fontSize: Math.min(width * 0.038, 14),
      color: '#86868B',
      marginTop: 4,
    },
  });
}


export default function Login() {
  const { width, height } = useWindowDimensions();
  const styles = getStyles(width, height);
  const { language, changeLanguage } = useLanguage();
  const t = translations[language];
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isForgotPasswordModalVisible, setIsForgotPasswordModalVisible] = useState(false);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isLanguageConfirmModalVisible, setIsLanguageConfirmModalVisible] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState(null);
  const navigation = useNavigation();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const usernameShake = useRef(new Animated.Value(0)).current;
  const passwordShake = useRef(new Animated.Value(0)).current;
  const notifyAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  const [notifyMsg, setNotifyMsg] = useState('');

  const triggerShake = (anim) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const showNotify = (message) => {
    setNotifyMsg(message);
    Animated.sequence([
      Animated.timing(notifyAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(notifyAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  // Password strength calculation
  useEffect(() => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    setPasswordStrength(strength);
  }, [password]);

  // Swipe down to go back gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: Animated.event(
        [null, { dy: slideAnim }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120) {
          Animated.timing(slideAnim, {
            toValue: height,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            navigation.navigate('Landing');
            setTimeout(() => slideAnim.setValue(0), 500);
          });
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Enhanced login handler with better navigation handling
  const handleLogin = useCallback(async () => {
    // Focus guidance like the web demo: jump to first missing field
    if (!username.trim()) {
      setUsernameError(t.usernameRequired);
      triggerShake(usernameShake);
      usernameRef.current && usernameRef.current.focus && usernameRef.current.focus();
      showNotify(t.usernameRequired);
      return;
    }
    if (!password) {
      setPasswordError(t.passwordRequired);
      triggerShake(passwordShake);
      passwordRef.current && passwordRef.current.focus && passwordRef.current.focus();
      showNotify(t.passwordRequired);
      return;
    }
    if (!username.trim() || !password) {
      Alert.alert('Error', language === 'tl' ? 'Pakilagay ang username at password.' : 'Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    try {
      // Send plain password - server should use bcrypt.compare() to verify
      // bcrypt.compare() takes plain password and compares with stored hash
      console.log('Login attempt:', {
        username: username.trim(),
        passwordLength: password.length
      });
      
      const response = await fetch(`${API_URL}/login2.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password
        }),
      });

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('JSON parse error:', e);
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        throw new Error(responseData.message || `Server returned ${response.status}`);
      }

      // Log raw response for debugging and handle flexible shapes safely
      console.log('Login raw response:', responseText);

      if (responseData.status === 'success') {
        // Get user data from response
        const user = {
          id: responseData.id,
          username: responseData.username,
          role: responseData.role,
          created_at: responseData.created_at
        };

        console.log('Login success. User data:', user);
        
        // Navigate based on user role (restored logic)
        if (user.role === 'user') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Scanner2', params: { userId: user.id, user } }],
          });
        } else if (user.role === 'admin') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainApp', params: { user: user } }],
          });
        } else {
          Alert.alert(t.accessDenied, t.invalidRole);
        }
      } else {
        const msg = responseData.message === 'Account is inactive'
          ? t.accountInactive
          : (responseData.message || t.invalidCredentials);
        setUsernameError(t.invalidCredentials);
        triggerShake(usernameShake);
        triggerShake(passwordShake);
        showNotify(msg);
      }
    } catch (error) {
      console.error('Login error:', error);
      const msg = error.message && error.message.includes('Failed to fetch')
        ? t.networkError
        : (error.message || t.loginFailed);
      showNotify(msg);
    } finally {
      setIsLoading(false);
    }
  }, [username, password, navigation, language, t]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Language Selector Button */}
      <TouchableOpacity
        style={styles.languageButton}
        onPress={() => setIsLanguageModalVisible(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="language-outline" size={22} color="#1D1D1F" />
        <Text style={styles.languageButtonText}>{language === 'en' ? 'English' : 'Tagalog'}</Text>
        <Ionicons name="chevron-down-outline" size={18} color="#86868B" style={{ marginLeft: 6 }} />
      </TouchableOpacity>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.scrollViewContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]} {...panResponder.panHandlers}>
            <View style={styles.centerWrapper}>
              {/* Branding */}
              <View style={styles.brandingRow}>
                <Image source={require('../assets/logo3.png')} style={styles.logo} />
                <View style={styles.brandingTextCol}>
                  <Text style={styles.brandTitle}>SIMS</Text>
                  <Text style={styles.brandSubtitle}>SALES AND INVENTORY</Text>
                </View>
              </View>

              {/* Card */}
              <View style={styles.card}>
                <Text style={styles.welcomeTitle}>{t.welcomeTitle}</Text>
                <Text style={styles.welcomeSubtitle}>{t.welcomeSubtitle}</Text>

                <Animated.View style={[styles.inputWrapper, usernameError && styles.inputError, { transform: [{ translateX: usernameShake }], marginBottom: 12 }]}>
                  <TextInput
                    placeholder={t.usernamePlaceholder}
                    placeholderTextColor="#86868B"
                    style={styles.input}
                    value={username}
                    onChangeText={(t) => { setUsername(t); if (usernameError) setUsernameError(''); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    keyboardType="default"
                    ref={usernameRef}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current && passwordRef.current.focus && passwordRef.current.focus()}
                    onFocus={() => usernameError && setUsernameError('')}
                  />
                  <Ionicons name="person-outline" size={26} color="#86868B" />
                </Animated.View>
                {!!usernameError && <Text style={styles.errorText}>{usernameError}</Text>}

                <Animated.View style={[styles.inputWrapper, passwordError && styles.inputError, { transform: [{ translateX: passwordShake }] }]}>
                  <TextInput
                    placeholder={t.passwordPlaceholder}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#86868B"
                    style={styles.input}
                    value={password}
                    onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(''); }}
                    autoCapitalize="none"
                    ref={passwordRef}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                    onFocus={() => passwordError && setPasswordError('')}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={26} color="#86868B" />
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity onPress={() => setIsForgotPasswordModalVisible(true)}>
                  <Text style={styles.forgotPassword}>{t.forgotPassword}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginButton, isLoading && styles.disabledButton]}
                  onPress={() => {
                    // If username is empty, focus it first to mimic web demo behavior
                    if (!username.trim()) {
                      usernameRef.current && usernameRef.current.focus && usernameRef.current.focus();
                      return;
                    }
                    handleLogin();
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>{t.signIn}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
      {/* Inline toast-like notifier */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.notify,
          {
            opacity: notifyAnim,
            transform: [
              {
                translateY: notifyAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.notifyText}>{notifyMsg}</Text>
      </Animated.View>

      {/* Forgot Password Modal */}
      <Modal
        visible={isForgotPasswordModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsForgotPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setIsForgotPasswordModalVisible(false)}
          />
          <View style={styles.modalCard}>
            {/* Icon */}
            <View style={styles.modalIconContainer}>
              <Ionicons name="lock-closed-outline" size={44} color="#86868B" />
            </View>

            {/* Title */}
            <View style={styles.modalHeaderContainer}>
              <Text style={styles.modalTitle}>{t.forgotPasswordTitle}</Text>
              <Text style={styles.modalSubtitle}>{t.forgotPasswordSubtitle}</Text>
            </View>

            {/* Message */}
            <Text style={styles.modalMessageText}>
              {t.forgotPasswordMessage}
            </Text>

            {/* Contact Information */}
            <View style={styles.modalContactSection}>
              <Text style={styles.modalContactTitle}>{t.contactAdmin}</Text>
              
              <View style={styles.modalContactItem}>
                <Ionicons name="call-outline" size={22} color="#86868B" />
                <Text style={styles.modalContactText}>0912-345-6789</Text>
              </View>
              
              <View style={styles.modalContactItem}>
                <Ionicons name="mail-outline" size={22} color="#86868B" />
                <Text style={styles.modalContactText}>admin@rtw.com</Text>
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setIsForgotPasswordModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseButtonText}>{t.backToLogin}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={isLanguageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLanguageModalVisible(false)}
      >
        <View style={styles.languageModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsLanguageModalVisible(false)}
          />
          <View style={styles.languageModalCard}>
            <Text style={styles.languageModalTitle}>
              {language === 'en' ? 'Select Language' : 'Pumili ng Wika'}
            </Text>
            
            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'en' && styles.languageOptionSelected
              ]}
              onPress={() => {
                if (language !== 'en') {
                  setPendingLanguage('en');
                  setIsLanguageModalVisible(false);
                  setIsLanguageConfirmModalVisible(true);
                } else {
                  setIsLanguageModalVisible(false);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.languageOptionText}>English</Text>
                <Text style={styles.languageOptionSubtext}>Select English language</Text>
              </View>
              {language === 'en' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'tl' && styles.languageOptionSelected
              ]}
              onPress={() => {
                if (language !== 'tl') {
                  setPendingLanguage('tl');
                  setIsLanguageModalVisible(false);
                  setIsLanguageConfirmModalVisible(true);
                } else {
                  setIsLanguageModalVisible(false);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.languageOptionText}>Tagalog</Text>
                <Text style={styles.languageOptionSubtext}>Pumili ng wikang Tagalog</Text>
              </View>
              {language === 'tl' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Change Confirmation Modal */}
      <Modal
        visible={isLanguageConfirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsLanguageConfirmModalVisible(false);
          setPendingLanguage(null);
          setIsLanguageModalVisible(true);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              setIsLanguageConfirmModalVisible(false);
              setPendingLanguage(null);
              setIsLanguageModalVisible(true);
            }}
          />
          <View style={styles.modalCard}>
            {/* Icon */}
            <View style={styles.modalIconContainer}>
              <Ionicons name="language-outline" size={44} color="#007AFF" />
            </View>

            {/* Title */}
            <View style={styles.modalHeaderContainer}>
              <Text style={styles.modalTitle}>
                {language === 'en' ? 'Change Language?' : 'Palitan ang Wika?'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {language === 'en' 
                  ? `Switch to ${pendingLanguage === 'en' ? 'English' : 'Tagalog'}?`
                  : `Palitan sa ${pendingLanguage === 'en' ? 'English' : 'Tagalog'}?`}
              </Text>
            </View>

            {/* Message */}
            <Text style={styles.modalMessageText}>
              {language === 'en'
                ? 'Are you sure you want to change the language? The app will switch to the selected language.'
                : 'Sigurado ka bang gusto mong palitan ang wika? Ang app ay magpapalit sa napiling wika.'}
            </Text>

            {/* Action Buttons */}
            <View style={{ width: '100%', flexDirection: 'row', marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.modalCloseButton, { 
                  flex: 1, 
                  backgroundColor: '#F5F5F7',
                  marginTop: 0,
                  marginRight: 6,
                }]}
                onPress={() => {
                  setIsLanguageConfirmModalVisible(false);
                  setPendingLanguage(null);
                  setIsLanguageModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalCloseButtonText, { color: '#1D1D1F' }]}>
                  {t.cancel}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCloseButton, { 
                  flex: 1, 
                  marginTop: 0,
                  marginLeft: 6,
                }]}
                onPress={() => {
                  if (pendingLanguage) {
                    changeLanguage(pendingLanguage);
                    setIsLanguageConfirmModalVisible(false);
                    setPendingLanguage(null);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseButtonText}>
                  {language === 'en' ? 'Change' : 'Palitan'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
