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
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { API_URL } from '../utils/config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_LANDSCAPE = SCREEN_WIDTH > SCREEN_HEIGHT;
const CARD_MAX_WIDTH = IS_LANDSCAPE ? Math.min(640, SCREEN_WIDTH * 0.55) : 620;
const BRAND_ROW_WIDTH = CARD_MAX_WIDTH;
const LOGO_SIZE = IS_LANDSCAPE ? Math.min(140, SCREEN_HEIGHT * 0.28) : SCREEN_WIDTH * 0.18;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
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
            toValue: SCREEN_HEIGHT,
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
      setUsernameError('Username is required');
      triggerShake(usernameShake);
      usernameRef.current && usernameRef.current.focus && usernameRef.current.focus();
      showNotify('Username is required');
      return;
    }
    if (!password) {
      setPasswordError('Password is required');
      triggerShake(passwordShake);
      passwordRef.current && passwordRef.current.focus && passwordRef.current.focus();
      showNotify('Password is required');
      return;
    }
    if (!username.trim() || !password) {
      Alert.alert('Error', 'Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    try {
      
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
        
        // Navigate based on user role
        if (user.role === 'user') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainApp', params: { initialRouteName: 'Scanner' } }],
          });
        } else if (user.role === 'admin') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainApp', params: { user: user } }],
          });
        } else {
          Alert.alert('Access Denied', 'Invalid user role. Please contact an administrator.');
        }
      } else {
        const msg = responseData.message === 'Account is inactive'
          ? 'Account is inactive'
          : (responseData.message || 'Invalid username or password');
        setUsernameError('Invalid username or password');
        setPasswordError('Invalid username or password');
        triggerShake(usernameShake);
        triggerShake(passwordShake);
        showNotify(msg);
      }
    } catch (error) {
      console.error('Login error:', error);
      const msg = error.message && error.message.includes('Failed to fetch')
        ? 'Network error. Check your connection.'
        : (error.message || 'Login failed. Please try again.');
      showNotify(msg);
    } finally {
      setIsLoading(false);
    }
  }, [username, password, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
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
                <Text style={styles.welcomeTitle}>Welcome Back</Text>
                <Text style={styles.welcomeSubtitle}>Enter your username to sign in to your account</Text>

                <Animated.View style={[styles.inputWrapper, usernameError && styles.inputError, { transform: [{ translateX: usernameShake }] }]}>
                  <TextInput
                    placeholder="Username"
                    placeholderTextColor="#6D6D6D"
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
                  <Ionicons name="person" size={20} color="#6D6D6D" />
                </Animated.View>

                <Animated.View style={[styles.inputWrapper, passwordError && styles.inputError, { transform: [{ translateX: passwordShake }] }]}>
                  <TextInput
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#6D6D6D"
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
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6D6D6D" />
                  </TouchableOpacity>
                </Animated.View>
                {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

                <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={styles.forgotPassword}>Forgot password?</Text>
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
                  {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Sign In</Text>}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA', // A slightly off-white background
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center', // Center content vertically
    paddingVertical: 20,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerWrapper: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    alignItems: 'center',
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center the logo and title
    gap: 16,
    marginBottom: 24,
  },
  brandingTextCol: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: SCREEN_WIDTH * 0.07, // Larger title
    fontWeight: 'bold',
    color: '#1A202C',
  },
  brandSubtitle: {
    color: '#4A5568',
    fontSize: SCREEN_WIDTH * 0.03,
    letterSpacing: 1.5, // More spacing
    fontWeight: '500',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    resizeMode: 'contain',
  },
  card: {
    width: '92%',
    maxWidth: CARD_MAX_WIDTH,
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D3DAD9',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  welcomeTitle: {
    fontSize: SCREEN_WIDTH * 0.065,
    textAlign: 'center',
    fontWeight: '700',
    color: '#37353E',
    marginTop: 4,
  },
  welcomeSubtitle: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 16,
  },
  label: {
    color: '#3A3A3A',
    fontSize: SCREEN_WIDTH * 0.035,
    marginBottom: 5,
    marginTop: 20,
    fontWeight: 'bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D3DAD9',
    marginTop: 10,
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: SCREEN_WIDTH * 0.03,
    marginTop: 6,
    marginLeft: 4,
  },
  input: {
    flex: 1,
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#2A2A2A',
  },
  forgotPassword: {
    textAlign: 'right',
    marginTop: 10,
    color: '#715A5A',
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#000000',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  disabledButton: {
    backgroundColor: '#44444E',
    opacity: 0.7,
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    fontWeight: '600',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
  },
  brandingContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    width: '92%',
    maxWidth: BRAND_ROW_WIDTH,
    alignSelf: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  brandingTextCol: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#37353E',
    marginTop: 10,
  },
  brandSubtitle: {
    color: '#44444E',
    fontSize: SCREEN_WIDTH * 0.035,
    letterSpacing: 1,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    resizeMode: 'contain',
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
    backgroundColor: '#E0E0E0',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  strengthBarActive: {
    backgroundColor: '#FFC107',
  },
});