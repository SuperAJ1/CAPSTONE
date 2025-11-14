import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

const illustrations = [
  {
    src: require('../assets/illustration1.png'),
    textEn: 'Easily manage your inventory and keep track of stock levels.',
    textTl: 'Madaling pamahalaan ang iyong inventory at subaybayan ang mga antas ng stock.',
  },
  {
    src: require('../assets/illustration2.png'),
    textEn: 'Monitor sales and analyze trends for smarter business decisions.',
    textTl: 'Subaybayan ang mga benta at suriin ang mga trend para sa mas matalinong desisyon sa negosyo.',
  },
];

export default function LandingPage() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const { language } = useLanguage();
  const t = translations[language];
  const isTablet = width > 768;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  // Slide image every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentImageIndex((prevIndex) => (prevIndex + 1) % illustrations.length);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [fadeAnim]);

  // Animate logo on mount
  useEffect(() => {
    Animated.spring(logoAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [logoAnim]);

  const styles = getStyles(isTablet, width);

  return (
    <LinearGradient
      colors={['#FBFBFB', '#E8F9FF', '#FBFBFB']} // Updated gradient colors
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.wrapper}>
          {/* Left Side */}
          <View style={styles.left}>
            <Animated.Image
              source={require('../assets/logo3.png')}
              style={[
                styles.logo,
                {
                  transform: [
                    {
                      scale: logoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Text style={styles.title}>
              {language === 'en' ? 'SIMS: Sales and Inventory System' : 'SIMS: Sales and Inventory System'}
            </Text>
            <Text style={styles.subtitle}>
              {language === 'en'
                ? 'Manage your sales and stock with ease. Track products, organize inventory, and simplify operations.'
                : 'Pamahalaan ang iyong mga benta at stock nang madali. Subaybayan ang mga produkto, ayusin ang inventory, at pasimplehin ang mga operasyon.'}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.buttonText}>{t.getStarted}</Text>
            </TouchableOpacity>
          </View>

          {/* Right Side */}
          <View style={styles.right}>
            <Animated.View style={[styles.illustrationContainer, { opacity: fadeAnim }]}>
              <Image
                source={illustrations[currentImageIndex].src}
                style={styles.image}
                resizeMode="contain"
              />
              <Text style={styles.illustrationText}>
                {language === 'en'
                  ? illustrations[currentImageIndex].textEn
                  : illustrations[currentImageIndex].textTl}
              </Text>
            </Animated.View>
          </View>
        </View>

        {/* Background Circles */}
        <View style={styles.circle1} />
        <View style={styles.circle2} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const getStyles = (isTablet, width) => StyleSheet.create({
  gradientBackground: { flex: 1 },
  container: { flex: 1 },
  wrapper: {
    flex: 1,
    flexDirection: isTablet ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isTablet ? 40 : 24,
  },
  left: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? 30 : 20,
  },
  logo: {
    width: isTablet ? 220 : 180,
    height: isTablet ? 220 : 180,
    marginBottom: 20,
    resizeMode: 'contain',
  },
  title: {
    fontSize: isTablet ? 36 : 28,
    fontWeight: 'bold',
    color: '#3A3A3A', // Darker text for better contrast
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: isTablet ? 18 : 16,
    color: '#555555', // Slightly darker gray
    marginBottom: 24,
    textAlign: 'center',
    maxWidth: 400,
  },
  button: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    paddingHorizontal: 34,
    borderRadius: 30,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: {
    color: '#FFFFFF', // White text for contrast
    fontWeight: 'bold',
    fontSize: isTablet ? 18 : 16,
  },
  right: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: isTablet ? 30 : 20,
  },
  illustrationContainer: {
    width: isTablet ? width * 0.4 : width * 0.7,
    alignItems: 'center',
    backgroundColor: '#E8F9FF', // Light blue background
    borderRadius: 16,
    padding: 16,
  },
  image: {
    width: '100%',
    height: isTablet ? width * 0.3 : width * 0.5,
    borderRadius: 8,
  },
  illustrationText: {
    color: '#3A3A3A', // Darker text
    fontSize: isTablet ? 16 : 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    maxWidth: isTablet ? width * 0.4 : width * 0.8,
  },
  circle1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(197,186,255,0.15)', // Lighter purple circle
  },
  circle2: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(196,217,255,0.20)', // Lighter blue circle
  },
});