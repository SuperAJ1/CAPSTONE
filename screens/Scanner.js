import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Picker } from '@react-native-picker/picker';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  Vibration,
  LogBox,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { API_URL as API_BASE_URL } from '../utils/config';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import base64 from 'base-64';
import DateTimePicker from '@react-native-community/datetimepicker';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'useInsertionEffect must not schedule updates',
]);

const CameraComponent = ({ isActive, onBarcodeScanned, cameraType, scanned, styles, language }) => {
  if (!isActive) {
    return (
      <View style={styles.cameraOffOverlay}>
        <Ionicons name="scan-outline" size={100} color="#999" />
        <Text style={styles.cameraOffText}>{language === 'en' ? 'Camera is OFF' : 'Naka-OFF ang Camera'}</Text>
      </View>
    );
  }

  return (
    <CameraView
      style={styles.cameraView}
      onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
      barcodeScannerSettings={{
        barcodeTypes: ['qr', 'ean13', 'upc_a', 'code128'],
      }}
      facing={cameraType}
      testID="camera-view"
    />
  );
};

export default function Scanner({ userId }) {
  const navigation = useNavigation();
  const { language } = useLanguage();
  const t = translations[language];
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const styles = getStyles(isLandscape, width, height);
  
  // Animated value for settings icon rotation
  const settingsRotateAnim = useRef(new Animated.Value(0)).current;
  const [showSettingsLabel, setShowSettingsLabel] = useState(false);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraType, setCameraType] = useState('front');
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [sound, setSound] = useState(null);
  const isSoundLoading = useRef(false);

  // Product state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Transaction state
  const [cashTendered, setCashTendered] = useState('');
  const [editableTotal, setEditableTotal] = useState('');
  const [isTotalFocused, setIsTotalFocused] = useState(false);
  const [focusedItemTotalId, setFocusedItemTotalId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const processedCartPayloads = useRef(new Set());
  // Track QR code signatures and their associated product IDs in the cart
  const qrCodeCartItems = useRef(new Map()); // Map<signature, Set<productId>>
  const [cashError, setCashError] = useState('');
  const [totalError, setTotalError] = useState('');
  const cashInputRef = useRef(null);
  const cashShake = useRef(new Animated.Value(0)).current;
  const notifyAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  const [notifyMsg, setNotifyMsg] = useState('');
  const loadingProgressAnim = useRef(new Animated.Value(0)).current;

  // Custom Alert Modal State
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info', // 'info', 'error', 'success', 'warning'
    onConfirm: null,
  });

  // Custom alert function to replace Alert.alert
  const showCustomAlert = useCallback((title, message, type = 'info', onConfirm = null) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      onConfirm: onConfirm || (() => setCustomAlert(prev => ({ ...prev, visible: false }))),
    });
  }, []);

  // Receipt Modal State
  const [isReceiptVisible, setIsReceiptVisible] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] = useState(false);
  const [isNegativeProfitModalVisible, setIsNegativeProfitModalVisible] = useState(false);
  const [negativeProfitAmount, setNegativeProfitAmount] = useState(0);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  
  // Previous Transactions Modal State
  const [isTransactionsModalVisible, setIsTransactionsModalVisible] = useState(false);
  const [previousTransactions, setPreviousTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState("");
  
  // Walkthrough State
  const [elementLayouts, setElementLayouts] = useState({});
  const walkthroughTargets = {
    search: useRef(null),
    scanner: useRef(null),
    cart: useRef(null),
    payment: useRef(null),
  };
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [isWalkthroughVisible, setIsWalkthroughVisible] = useState(false);
  
  const walkthroughSteps = [
    {
      titleEn: 'Search for Products',
      titleTl: 'Maghanap ng Produkto',
      descriptionEn: 'Use the search bar to find products by name or code.',
      descriptionTl: 'Gamitin ang search bar para maghanap ng produkto ayon sa pangalan o code.',
      target: 'search',
      direction: 'right',
      icon: 'search-outline',
    },
    {
      titleEn: 'Scan QR Code',
      titleTl: 'I-scan ang QR Code',
      descriptionEn: 'Alternatively, turn on the camera to scan product codes directly.',
      descriptionTl: 'Kung hindi, buksan ang camera para direktang i-scan ang product codes.',
      target: 'scanner',
      direction: 'left',
      icon: 'scan-outline',
    },
    {
      titleEn: 'Manage Your Cart',
      titleTl: 'Pamahalaan ang Iyong Cart',
      descriptionEn: 'View scanned items, adjust quantities, and apply discounts here.',
      descriptionTl: 'Tingnan ang mga na-scan na items, baguhin ang dami, at maglagay ng diskwento dito.',
      target: 'cart',
      direction: 'left',
      icon: 'cart-outline',
    },
    {
      titleEn: 'Finalize Transaction',
      titleTl: 'Tapusin ang Transaksyon',
      descriptionEn: "Enter the cash amount and press 'Complete Transaction' to finalize your purchase.",
      descriptionTl: "Ilagay ang halaga ng pera at pindutin ang 'Complete Transaction' para tapusin ang iyong purchase.",
      target: 'payment',
      direction: 'up',
      icon: 'card-outline',
    },
  ];

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

  // Helper function to safely parse JSON from responses that might contain HTML
  const parseJSONFromResponse = (responseText) => {
    try {
      // First, try to parse the entire response as JSON
      return JSON.parse(responseText);
    } catch (e) {
      // If that fails, try to find JSON within the response (might have HTML before/after)
      // Look for JSON object starting with {
      let jsonStartIndex = responseText.indexOf('{');
      if (jsonStartIndex === -1) {
        // Try looking for JSON array starting with [
        jsonStartIndex = responseText.indexOf('[');
      }
      
      if (jsonStartIndex === -1) {
        // Check if response looks like HTML
        if (responseText.trim().toLowerCase().startsWith('<!doctype') || 
            responseText.trim().toLowerCase().startsWith('<html')) {
          throw new Error('Server returned an HTML error page instead of JSON. Please check the server configuration.');
        }
        throw new Error('No valid JSON found in server response.');
      }
      
      // Extract JSON from the found position
      const jsonString = responseText.substring(jsonStartIndex);
      
      // Try to find the end of the JSON (find matching closing brace/bracket)
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;
      let jsonEndIndex = -1;
      
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (inString) continue;
        
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0 && bracketCount === 0) {
            jsonEndIndex = i + 1;
            break;
          }
        }
        if (char === '[') bracketCount++;
        if (char === ']') {
          bracketCount--;
          if (braceCount === 0 && bracketCount === 0) {
            jsonEndIndex = i + 1;
            break;
          }
        }
      }
      
      // If we found a valid end, use it; otherwise use the rest of the string
      const finalJsonString = jsonEndIndex > 0 
        ? jsonString.substring(0, jsonEndIndex)
        : jsonString;
      
      try {
        return JSON.parse(finalJsonString);
      } catch (parseError) {
        // If parsing still fails, provide a better error message
        if (responseText.trim().toLowerCase().startsWith('<!doctype') || 
            responseText.trim().toLowerCase().startsWith('<html')) {
          throw new Error('Server returned an HTML error page. The server may be experiencing issues. Please try again later.');
        }
        throw new Error('Server returned invalid JSON format. Please contact support if this issue persists.');
      }
    }
  };

  const fetchPreviousTransactions = useCallback(async () => {
    setIsTransactionsLoading(true);
    setTransactionsError("");
    try {
      console.log('Fetching previous transactions...');
      const response = await fetch(`${API_BASE_URL}/transactions.php?user_id=${userId ?? ''}`);
      console.log('Transactions response status:', response.status);
      const responseText = await response.text();
      console.log('Raw transactions response:', responseText);
      let data;
      try {
        data = parseJSONFromResponse(responseText);
      } catch (e) {
        console.error('JSON parse error:', e);
        setPreviousTransactions([]);
        setTransactionsError(e.message || 'Server returned invalid JSON');
        return;
      }
      if (data.status === 'success' && Array.isArray(data.data)) {
        setPreviousTransactions(data.data);
      } else {
        setPreviousTransactions([]);
        setTransactionsError(data.message || 'Failed to fetch transactions');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setPreviousTransactions([]);
      setTransactionsError('Failed to connect to server');
    } finally {
      setIsTransactionsLoading(false);
    }
  }, [API_BASE_URL, userId]);

  useEffect(() => {
    if (isTransactionsModalVisible) {
      fetchPreviousTransactions();
    }
  }, [isTransactionsModalVisible, fetchPreviousTransactions]);

  // Animate progress bar when loading
  useEffect(() => {
    if (isLoading) {
      // Reset animation
      loadingProgressAnim.setValue(0);
      // Create looping animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(loadingProgressAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(loadingProgressAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [isLoading, loadingProgressAnim]);

  const measureLayouts = () => {
    for (const key in walkthroughTargets) {
      const ref = walkthroughTargets[key];
      if (ref.current) {
        // Try measure method first (for View components)
        if (ref.current.measure) {
        ref.current.measure((x, y, width, height, pageX, pageY) => {
            setElementLayouts(prev => ({
              ...prev,
              [key]: { x: pageX, y: pageY, width, height },
            }));
          });
        } else {
          // Fallback: use getNode for ScrollView and other components
          const node = ref.current.getNode ? ref.current.getNode() : ref.current;
          if (node && node.measure) {
            node.measure((x, y, width, height, pageX, pageY) => {
          setElementLayouts(prev => ({
            ...prev,
            [key]: { x: pageX, y: pageY, width, height },
          }));
        });
          }
        }
      }
    }
  };

  const startWalkthrough = () => {
    setIsSettingsModalVisible(false);
    setWalkthroughStep(0);
    setIsWalkthroughVisible(true);
    // Use setTimeout to ensure elements are rendered before measuring
    setTimeout(() => {
      measureLayouts();
    }, 100);
  };

  const handleNextStep = () => {
    if (walkthroughStep < walkthroughSteps.length - 1) {
      setWalkthroughStep(walkthroughStep + 1);
      // Re-measure layouts when moving to next step
      setTimeout(() => {
        measureLayouts();
      }, 100);
    } else {
      setIsWalkthroughVisible(false);
    }
  };

  const handleSkipWalkthrough = () => {
    setIsWalkthroughVisible(false);
  };

  const handleSettings = () => {
    setIsSettingsModalVisible(true);
  };

  const handleSettingsPress = () => {
    Animated.sequence([
      Animated.timing(settingsRotateAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(settingsRotateAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();
    setShowSettingsLabel(true);
    setTimeout(() => setShowSettingsLabel(false), 1800);
    handleSettings();
  };

  const handleLogout = useCallback(() => {
    setIsLogoutModalVisible(false);
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
  }, [navigation]);

  // Load sound effect for scan success
  useEffect(() => {
    let soundObject = null;

    async function loadSound() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          interruptionModeIOS: 0,
          interruptionModeAndroid: 1,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/beep.mp3') // Make sure this path is correct
        );
        soundObject = sound;
        setSound(sound);
        console.log('Sound loaded successfully');
      } catch (error) {
        console.error('Failed to load sound', error);
      }
    }

    loadSound();

    return () => {
      if (soundObject) {
        console.log('Unloading sound');
        soundObject.unloadAsync();
      }
    };
  }, []);

  // Play beep sound with error handling
  const playBeep = async () => {
    try {
      let snd = sound;
      if (snd) {
        const status = await snd.getStatusAsync();
        if (!status.isLoaded) {
          if (isSoundLoading.current) return; // avoid concurrent loads
          isSoundLoading.current = true;
          try {
            await snd.loadAsync(require('../assets/beep.mp3'), {}, true);
          } finally {
            isSoundLoading.current = false;
          }
        }
        const refreshed = await snd.getStatusAsync();
        if (refreshed.isLoaded) {
          await snd.setPositionAsync(0);
          await snd.playAsync();
        }
      } else {
        if (isSoundLoading.current) return;
        isSoundLoading.current = true;
        try {
          // One-off sound instance that unloads after playback
          const { sound: created } = await Audio.Sound.createAsync(
            require('../assets/beep.mp3'),
            { shouldPlay: true }
          );
          created.setOnPlaybackStatusUpdate((st) => {
            if (st.isLoaded && st.didJustFinish) {
              created.unloadAsync().catch(() => {});
            }
          });
          // also keep reference for future quick plays
          setSound((prev) => prev ?? created);
        } finally {
          isSoundLoading.current = false;
        }
      }
    } catch (error) {
      console.error('Failed to play sound', error);
      Vibration.vibrate(100); // Fallback to vibration on error
    }
  };

  // Format time in 12-hour format with AM/PM (without seconds)
  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    // Handle different date formats
    let date;
    if (dateString instanceof Date) {
      date = dateString;
    } else if (typeof dateString === 'string') {
      // Try to parse the date string
      date = new Date(dateString);
      // If parsing fails, try to handle common formats
      if (isNaN(date.getTime())) {
        // Try MySQL datetime format: YYYY-MM-DD HH:MM:SS
        const mysqlMatch = dateString.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
        if (mysqlMatch) {
          const [, year, month, day, hour, minute, second] = mysqlMatch;
          date = new Date(year, month - 1, day, hour, minute, second);
        } else {
          return dateString; // Return original if we can't parse it
        }
      }
    } else {
      return '';
    }
    
    if (isNaN(date.getTime())) return dateString; // Return original if invalid date
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${month}/${day}/${year} ${displayHours}:${displayMinutes} ${ampm}`;
  };

  // Calculate totals
  const totalQty = scannedItems.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = scannedItems.reduce(
    (sum, item) => {
      // Use itemTotal if available, otherwise calculate from sellPrice * qty
      if (item.itemTotal !== undefined) {
        return sum + parseFloat(item.itemTotal);
      }
      const sellPrice = item.sellPrice !== undefined ? parseFloat(item.sellPrice) : parseFloat(item.product.price);
      return sum + (sellPrice * item.qty);
    },
    0
  );
  // Use editable total if set, otherwise use calculated subtotal
  const calculatedTotal = subtotal;
  const total = editableTotal !== '' && !isNaN(parseFloat(editableTotal)) 
    ? parseFloat(editableTotal) 
    : calculatedTotal;
  
  // Calculate total cost (sum of all item costs)
  const totalCost = scannedItems.reduce(
    (sum, item) => {
      const costPrice = parseFloat(item.product.cost_price || item.product.costPrice || 0);
      return sum + (costPrice * item.qty);
    },
    0
  );

  // Calculate total profit
  // If editableTotal is set and valid, use it to calculate profit (total - cost)
  // This properly accounts for additional charges when total > subtotal
  let totalProfit;
  if (editableTotal !== '' && !isNaN(parseFloat(editableTotal))) {
    // When total is edited (can be higher than subtotal), profit = edited total - total cost
    // This ensures profit includes additional charges when total > subtotal
    totalProfit = parseFloat(editableTotal) - totalCost;
  } else {
    // Calculate profit from individual items based on their itemTotal or sellPrice
    totalProfit = scannedItems.reduce(
      (sum, item) => {
        const costPrice = parseFloat(item.product.cost_price || item.product.costPrice || 0);
        // If itemTotal is set, calculate profit from total - (cost * qty), otherwise use sellPrice
        if (item.itemTotal !== undefined) {
          const itemTotal = parseFloat(item.itemTotal);
          const totalCost = costPrice * item.qty;
          const profit = itemTotal - totalCost;
          return sum + profit;
        }
        const sellPrice = item.sellPrice !== undefined ? parseFloat(item.sellPrice) : parseFloat(item.product.price);
        const profit = (sellPrice - costPrice) * item.qty;
        return sum + profit;
      },
      0
    );
  }
  const numericCashTendered = parseFloat(cashTendered || '0');
  const change = numericCashTendered - total;

  // Fetch products from backend for search functionality
  const fetchProducts = useCallback(async (searchTerm = '') => {
    try {
      setIsSearching(true);
      const response = await fetch(
        `${API_BASE_URL}/products.php?search=${encodeURIComponent(searchTerm)}`
      );
      const data = await response.json();

      if (data.status === 'success') {
        setFilteredProducts(data.data);
      } else {
        showCustomAlert(
          language === 'en' ? 'Error' : 'Error',
          data.message || (language === 'en' ? 'Failed to fetch products' : 'Nabigo ang pagkuha ng mga produkto'),
          'error'
        );
      }
    } catch (error) {
      showCustomAlert(
        language === 'en' ? 'Error' : 'Error',
        language === 'en' 
          ? 'Failed to connect to server. Please check your network and backend.'
          : 'Nabigo ang koneksyon sa server. Pakisuri ang iyong network at backend.',
        'error'
      );
      console.error('Fetch products error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Cart management functions
  const addScannedItem = useCallback((product, matchId, source = 'manual', quantityOverride) => {
    if (product.stock <= 0) {
      showCustomAlert(
        language === 'en' ? 'Out of Stock' : 'Walang Stock',
        language === 'en' 
          ? `${product.name} is currently out of stock.`
          : `Ang ${product.name} ay kasalukuyang walang stock.`,
        'warning'
      );
      return;
    }

    setScannedItems(prevItems => {
      // Find existing item using multiple matching strategies
      const existingItemIndex = prevItems.findIndex(item => {
        // Strategy 1: Match by database ID
        if (item.product.id === matchId) return true;
        
        // Strategy 2: Match by QR code data (for scanned items)
        if (item.product.qr_code_data && item.product.qr_code_data === matchId) return true;
        
        // Strategy 3: Match by product name and price (fallback)
        if (item.product.name === product.name && item.product.price === product.price) return true;
        
        return false;
      });

      let newScannedItems;
      const quantityToAdd = typeof quantityOverride === 'number' && quantityOverride > 0
        ? quantityOverride
        : (source === 'scan' ? 1 : qty);

      if (existingItemIndex > -1) {
        // Item already in cart, update quantity
        const existingItem = prevItems[existingItemIndex];
        const newQuantity = existingItem.qty + quantityToAdd;

        if (newQuantity > product.stock) {
          showCustomAlert(
            language === 'en' ? 'Stock Limit Exceeded' : 'Lumampas sa Limit ng Stock',
            language === 'en'
              ? `Cannot add ${quantityToAdd} more to cart. Only ${product.stock - existingItem.qty} of ${product.name} left in stock.`
              : `Hindi maaaring magdagdag ng ${quantityToAdd} pa sa cart. ${product.stock - existingItem.qty} na lang ng ${product.name} ang natitira sa stock.`,
            'warning'
          );
          return prevItems; // Don't update if stock is exceeded
        }

        newScannedItems = prevItems.map((item, index) =>
          index === existingItemIndex
            ? { ...item, qty: newQuantity }
            : item
        );
      } else {
        // New item, add to cart
        if (quantityToAdd > product.stock) {
          showCustomAlert(
            language === 'en' ? 'Stock Limit Exceeded' : 'Lumampas sa Limit ng Stock',
            language === 'en'
              ? `Cannot add ${quantityToAdd} of ${product.name}. Only ${product.stock} left in stock.`
              : `Hindi maaaring magdagdag ng ${quantityToAdd} ng ${product.name}. ${product.stock} na lang ang natitira sa stock.`,
            'warning'
          );
          return prevItems; // Don't add if stock is exceeded
        }

        newScannedItems = [...prevItems, {
          id: Date.now(), // Unique ID for THIS cart item instance
          product: { 
            ...product, 
            // Store the match ID for future reference
            cartMatchId: matchId 
          },
          qty: quantityToAdd,
          sellPrice: product.price // Default to original price, user can edit
        }];
      }

      // Play sound and vibrate on successful add/update
      playBeep();
      Vibration.vibrate(100);
      setSelectedProduct(null); // Clear selected product in UI
      setQty(1); // Reset quantity input to 1

      return newScannedItems;
    });
  }, [qty, playBeep]);

  const removeItem = useCallback((id) => {
    setScannedItems(prevItems => {
      const index = prevItems.findIndex(item => item.id === id);
      if (index === -1) return prevItems;
      const target = prevItems[index];
      const productId = target.product.id;
      
      let newItems;
      if (target.qty && target.qty > 1) {
        newItems = prevItems.map(item => item.id === id ? { ...item, qty: item.qty - 1 } : item);
      } else {
        newItems = prevItems.filter(item => item.id !== id);
      }
      
      // Check if any QR codes have all their items removed
      // Iterate through all QR code signatures
      for (const [sig, productIds] of qrCodeCartItems.current.entries()) {
        if (productIds.has(productId)) {
          // Check if this product ID is still in the cart
          const stillInCart = newItems.some(item => item.product.id === productId);
          if (!stillInCart) {
            // Remove this product ID from the QR code's tracked items
            productIds.delete(productId);
            
            // If all items from this QR code are removed, remove the QR code from tracking
            if (productIds.size === 0) {
              qrCodeCartItems.current.delete(sig);
              processedCartPayloads.current.delete(sig);
            }
          }
        }
      }
      
      return newItems;
    });
  }, []);

  const updateItemTotal = useCallback((id, totalText) => {
    const cleanedText = totalText.replace(/[^0-9.]/g, ''); // Allow only numbers and one decimal
    const total = parseFloat(cleanedText);

    if (!isNaN(total) && total >= 0) {
      setScannedItems(prevItems =>
        prevItems.map(item => {
          if (item.id === id) {
            const qty = item.qty || 1;
            const sellPrice = total / qty; // Calculate sell price from total
            return { ...item, sellPrice, itemTotal: total };
          }
          return item;
        })
      );
    } else if (cleanedText === '') {
      // Reset to original price if cleared
      setScannedItems(prevItems =>
        prevItems.map(item => {
          if (item.id === id) {
            return { ...item, sellPrice: item.product.price, itemTotal: undefined };
          }
          return item;
        })
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setScannedItems([]);
    setSelectedProduct(null);
    setCashTendered('');
    setEditableTotal('');
    setIsTotalFocused(false);
    setFocusedItemTotalId(null);
    setTotalError('');
    // Clear all QR code tracking when cart is cleared
    qrCodeCartItems.current.clear();
    processedCartPayloads.current.clear();
  }, []);

  // Barcode scanner handler
  const handleBarcodeScanned = useCallback(async ({ data }) => {
    if (scanned) return; // Prevent multiple scans for a short period

    console.log('Scanned data:', data);
    setScanned(true); // Set scanned to true to temporarily disable scanner

    try {
      setIsLoading(true);

      // Helper to extract barcode/QR code from scanned data
      const extractBarcode = (scannedData) => {
        if (!scannedData || typeof scannedData !== 'string') {
          return scannedData;
        }

        // Try to parse as JSON first (might be a JSON-encoded QR code)
        try {
          const parsed = JSON.parse(scannedData);
          // If it's a product object, extract the ID or qr_code_data
          if (parsed && typeof parsed === 'object') {
            // Check if it has an id field (product object)
            if (parsed.id) {
              // Return the ID as the barcode to look up
              return String(parsed.id);
            }
            // Check if it has qr_code_data field
            if (parsed.qr_code_data) {
              return String(parsed.qr_code_data);
            }
            // If it's a cart payload object, return null to handle separately
            const keys = Object.keys(parsed);
            if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
              return null; // This is a cart payload, handle separately
            }
          }
        } catch (_) {
          // Not JSON, continue with original data
        }

        return scannedData;
      };

      // 0) Try cart payload: URL data=base64 or raw base64 JSON -> { productId: qty, ... }
      const tryParseCartPayload = (text) => {
        let candidate = null;
        try {
          // Support absolute or relative URLs
          const url = new URL(text, 'https://dummy.local');
          const qp = url.searchParams.get('data');
          if (qp) candidate = qp;
        } catch (_) {
          // Not a URL; try to manually extract data= param from a query-like string
          if (typeof text === 'string' && text.includes('data=')) {
            const after = text.split('data=')[1] || '';
            candidate = after.split('&')[0];
          }
        }
        if (!candidate) candidate = text;
        try { candidate = decodeURIComponent(candidate); } catch (_) {}
        const normalized = candidate.replace(/-/g, '+').replace(/_/g, '/');
        let jsonStr;
        try { jsonStr = base64.decode(normalized); } catch (_) { return null; }
        try {
          const obj = JSON.parse(jsonStr);
          return obj && typeof obj === 'object' ? obj : null;
        } catch (_) { return null; }
      };

      // Try to parse as direct JSON first (for cart payloads)
      let cartMap = null;
      try {
        const directJson = JSON.parse(data);
        if (directJson && typeof directJson === 'object') {
          // Check if it's a cart payload (object with numeric keys)
          const keys = Object.keys(directJson);
          if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
            cartMap = directJson;
          }
        }
      } catch (_) {
        // Not direct JSON, try cart payload parsing
        cartMap = tryParseCartPayload(data);
      }

      if (cartMap) {
        // Create a stable signature for duplicate detection
        const sig = (() => {
          try {
            const entries = Object.entries(cartMap).map(([k, v]) => [String(k), Number(v) || 0]);
            entries.sort((a, b) => (a[0] > b[0] ? 1 : -1));
            return JSON.stringify(entries);
          } catch (_) { return JSON.stringify(cartMap); }
        })();
        
        // Check if items from this QR code are still in the cart
        const itemsFromThisQR = qrCodeCartItems.current.get(sig);
        if (itemsFromThisQR && itemsFromThisQR.size > 0) {
          // Check if any of these product IDs are still in the cart
          const stillInCart = scannedItems.some(item => {
            const productId = item.product.id;
            return itemsFromThisQR.has(productId);
          });
          
          if (stillInCart) {
            showCustomAlert(
              language === 'en' ? 'Already in Cart' : 'Nasa Cart Na',
              language === 'en'
                ? 'Items from this QR code are still in the cart. Remove them first before scanning again.'
                : 'Ang mga items mula sa QR code na ito ay nasa cart pa. Tanggalin muna ang mga ito bago mag-scan ulit.',
              'warning'
            );
            return;
          }
        }
        
        // Track which product IDs will be added from this QR code
        const productIdsToAdd = new Set();
        const addedItems = [];
        
        for (const [idKey, qtyVal] of Object.entries(cartMap)) {
          const qtyNum = parseInt(qtyVal, 10);
          if (!qtyNum || qtyNum < 1) continue;
          // Reuse product_by_qr with id fallback
          const resp = await fetch(`${API_BASE_URL}/product_by_qr.php?qr_code=${encodeURIComponent(idKey)}`);
          const resJson = await resp.json();
          if (resJson.status === 'success' && resJson.data) {
            const productId = resJson.data.id;
            productIdsToAdd.add(productId);
            addedItems.push({ product: resJson.data, productId, qty: qtyNum });
          }
        }
        
        // Only mark as processed if we successfully added items
        if (productIdsToAdd.size > 0) {
          qrCodeCartItems.current.set(sig, productIdsToAdd);
          processedCartPayloads.current.add(sig);
          
          // Add all items to cart
          for (const { product, productId, qty } of addedItems) {
            addScannedItem(product, productId, 'scan', qty);
          }
        }
        return;
      }

      // Extract the actual barcode/QR code from the scanned data
      const barcode = extractBarcode(data);
      if (!barcode) {
        showCustomAlert(
          language === 'en' ? 'Invalid Scan' : 'Hindi Wasto ang Scan',
          language === 'en'
            ? 'Could not extract barcode from scanned data.'
            : 'Hindi ma-extract ang barcode mula sa na-scan na data.',
          'error'
        );
        return;
      }

      // Always fetch from the backend to ensure the product is in the database
      const response = await fetch(
        `${API_BASE_URL}/product_by_qr.php?qr_code=${encodeURIComponent(barcode)}`
      );
      
      const responseText = await response.text();
      console.log('Raw scan response:', responseText);

      let result;
      try {
        result = parseJSONFromResponse(responseText);
      } catch (e) {
        throw new Error(e.message || 'Failed to parse server response.');
      }

      if (result.status === 'success' && result.data) {
        // Add item to cart
        addScannedItem(result.data, result.data.id, 'scan');
      } else {
        showCustomAlert(
          language === 'en' ? 'Product Not Found' : 'Hindi Nahanap ang Produkto',
          result.message || (language === 'en' 
            ? 'The scanned product is not in the database.'
            : 'Ang na-scan na produkto ay wala sa database.'),
          'error'
        );
      }
    } catch (error) {
      console.error('Scan processing error:', error);
      showCustomAlert(
        language === 'en' ? 'Error' : 'Error',
        language === 'en' ? 'Failed to verify product' : 'Nabigo ang pag-verify ng produkto',
        'error'
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => setScanned(false), 1000);
    }
  }, [scanned, addScannedItem]);

  // Purchase completion handler
  const executePurchase = useCallback(async (skipNegativeProfitCheck = false) => {
    if (scannedItems.length === 0) {
      showCustomAlert('Empty Cart', 'Please add items to the cart before completing.', 'warning');
      return;
    }

    if (cashTendered === '' || numericCashTendered <= 0) {
      setCashError(language === 'en' ? 'Enter cash amount' : 'Ilagay ang halaga ng pera');
      triggerShake(cashShake);
      cashInputRef.current && cashInputRef.current.focus && cashInputRef.current.focus();
      Vibration.vibrate(80);
      showNotify(language === 'en' ? 'Enter cash amount' : 'Ilagay ang halaga ng pera');
      return;
    }

    // Use editable total if set, otherwise use calculated total
    const finalTotal = editableTotal !== '' && !isNaN(parseFloat(editableTotal)) 
      ? parseFloat(editableTotal) 
      : total;
    
    if (numericCashTendered < finalTotal) {
      showCustomAlert(
        language === 'en' ? 'Insufficient Cash' : 'Kulang ang Pera',
        language === 'en'
          ? 'Cash tendered is less than the total amount.'
          : 'Ang perang ibinayad ay mas mababa kaysa sa kabuuang halaga.',
        'error'
      );
      return;
    }

    // Check for negative profit and show confirmation modal if needed
    // Recalculate totalProfit here to ensure we have the latest value
    if (!skipNegativeProfitCheck) {
      // Calculate total cost
      const currentTotalCost = scannedItems.reduce(
        (sum, item) => {
          const costPrice = parseFloat(item.product.cost_price || item.product.costPrice || 0);
          return sum + (costPrice * item.qty);
        },
        0
      );

      // Calculate current total profit
      let currentTotalProfit;
      if (editableTotal !== '' && !isNaN(parseFloat(editableTotal))) {
        // When total is edited (can be higher than subtotal), profit = edited total - total cost
        // This ensures profit includes additional charges when total > subtotal
        currentTotalProfit = parseFloat(editableTotal) - currentTotalCost;
      } else {
        // Calculate profit from individual items
        currentTotalProfit = scannedItems.reduce(
          (sum, item) => {
            const costPrice = parseFloat(item.product.cost_price || item.product.costPrice || 0);
            if (item.itemTotal !== undefined) {
              const itemTotal = parseFloat(item.itemTotal);
              const totalCost = costPrice * item.qty;
              const profit = itemTotal - totalCost;
              return sum + profit;
            }
            const sellPrice = item.sellPrice !== undefined ? parseFloat(item.sellPrice) : parseFloat(item.product.price);
            const profit = (sellPrice - costPrice) * item.qty;
            return sum + profit;
          },
          0
        );
      }

      if (currentTotalProfit < 0) {
        setNegativeProfitAmount(currentTotalProfit);
        setIsNegativeProfitModalVisible(true);
        return;
      }
    }

    setIsLoading(true);

    try {
      // Use editable total if set, otherwise use calculated total
      const finalTotalForPayload = editableTotal !== '' && !isNaN(parseFloat(editableTotal)) 
        ? parseFloat(editableTotal) 
        : total;
      
      const payload = {
        items: scannedItems.map(item => {
          if (!item.product || !item.product.id) {
            console.error('Error: Cart item missing valid product ID:', item);
            throw new Error('One or more cart items are missing a valid product ID. Cannot complete purchase.');
          }
          // Calculate sellPrice - if itemTotal is set, use it to calculate sellPrice, otherwise use sellPrice directly
          let sellPrice;
          if (item.itemTotal !== undefined && !isNaN(parseFloat(item.itemTotal)) && parseFloat(item.itemTotal) > 0) {
            // Calculate sellPrice from itemTotal
            sellPrice = parseFloat(item.itemTotal) / (item.qty || 1);
          } else {
            // Use sellPrice directly
            sellPrice = item.sellPrice !== undefined ? parseFloat(item.sellPrice) : parseFloat(item.product.price);
          }
          
          if (isNaN(sellPrice) || sellPrice <= 0 || !isFinite(sellPrice)) {
            sellPrice = parseFloat(item.product.price);
          }
          // Ensure it's a valid positive number
          sellPrice = Math.max(0, parseFloat(sellPrice.toFixed(2)));
          
          if (isNaN(sellPrice) || sellPrice <= 0 || !isFinite(sellPrice)) {
            throw new Error(`Invalid sell price for item: ${item.product.name}`);
          }
          
          // Ensure cost_price is valid and non-negative (can be 0)
          let costPrice = parseFloat(item.product.cost_price || item.product.costPrice || 0);
          if (isNaN(costPrice) || costPrice < 0 || !isFinite(costPrice)) {
            costPrice = 0;
          }
          // Ensure it's a valid non-negative number
          costPrice = Math.max(0, parseFloat(costPrice.toFixed(2)));
          
          // Ensure quantity is valid and positive
          let quantity = parseInt(item.qty, 10);
          if (isNaN(quantity) || quantity <= 0 || !isFinite(quantity)) {
            quantity = 1;
          }
          quantity = Math.max(1, parseInt(quantity, 10));
          
          return {
            product_id: String(item.product.id),
            quantity: quantity,
            price: sellPrice,  // Backend expects 'price', not 'sell_price'
            cost_price: costPrice
          };
        }),
        cash_tendered: (() => {
          let cash = parseFloat(cashTendered) || 0;
          if (isNaN(cash) || cash < 0 || !isFinite(cash)) {
            cash = 0;
          }
          cash = Math.round((cash + Number.EPSILON) * 100) / 100;
          cash = Number(cash.toFixed(2));
          if (isNaN(cash) || cash < 0 || !isFinite(cash)) {
            throw new Error('Invalid cash tendered amount');
          }
          return cash;
        })(),
        total_amount: (() => {
          let total = parseFloat(finalTotalForPayload);
          if (isNaN(total) || total < 0 || !isFinite(total)) {
            throw new Error('Invalid total amount');
          }
          total = Math.round((total + Number.EPSILON) * 100) / 100;
          total = Number(total.toFixed(2));
          if (isNaN(total) || total < 0 || !isFinite(total)) {
            throw new Error('Invalid total amount');
          }
          return total;
        })(),
        user_id: userId || 1, // Default to 1 if userId is not available
      };

      // Validate all items before sending
      payload.items.forEach((item, index) => {
        if (item.price <= 0 || isNaN(item.price) || !isFinite(item.price)) {
          throw new Error(`Item ${index + 1} has invalid price: ${item.price} (must be > 0)`);
        }
        if (item.cost_price < 0 || isNaN(item.cost_price) || !isFinite(item.cost_price)) {
          throw new Error(`Item ${index + 1} has invalid cost_price: ${item.cost_price} (must be >= 0)`);
        }
        if (item.quantity <= 0 || isNaN(item.quantity) || !isFinite(item.quantity)) {
          throw new Error(`Item ${index + 1} has invalid quantity: ${item.quantity} (must be > 0)`);
        }
      });

      // Calculate subtotal from items (backend will use this to validate)
      const calculatedSubtotal = payload.items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);

      // Total can now exceed subtotal (removed validation)

      // Final validation and logging
      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      console.log('Payload items validation:');
      payload.items.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, {
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          cost_price: item.cost_price,
          price_type: typeof item.price,
          cost_price_type: typeof item.cost_price,
          quantity_type: typeof item.quantity,
          price_isNaN: isNaN(item.price),
          cost_price_isNaN: isNaN(item.cost_price),
          quantity_isNaN: isNaN(item.quantity),
        });
      });

      const response = await fetch(`${API_BASE_URL}/complete_purchase.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let result;
      try {
        result = parseJSONFromResponse(responseText);
      } catch (e) {
        throw new Error(e.message || 'Failed to parse server response.');
      }

      if (!response.ok || result.status !== 'success') {
        // Backend validation errors (excluding subtotal validation as it's now allowed)
        throw new Error(result.message || 'Purchase failed on server side.');
      }

      await playBeep();
      
      // Refresh the product list to update stock levels
      await fetchProducts(searchQuery);
      
      // Use editable total if set, otherwise use calculated total
      const finalTotal = editableTotal !== '' && !isNaN(parseFloat(editableTotal)) 
        ? parseFloat(editableTotal) 
        : total;
      const finalChange = numericCashTendered - finalTotal;
      
      setReceiptDetails({
        items: [...scannedItems],
        total: finalTotal,
        change: finalChange,
        cashTendered: numericCashTendered,
        subtotal,
        totalProfit,
        editableTotal,
        calculatedTotal,
      });
      setIsReceiptVisible(true);

    } catch (error) {
      console.error('Full purchase error:', error);
      showCustomAlert(
        language === 'en' ? 'Purchase Failed' : 'Nabigo ang Pagbili',
        error.message.includes('JSON')
          ? (language === 'en'
              ? "There was a problem with the server's response format. Please contact support."
              : "May problema sa format ng response ng server. Pakikipag-ugnayan sa support.")
          : (language === 'en'
              ? `Error: ${error.message}`
              : `Error: ${error.message}`),
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [scannedItems, cashTendered, total, numericCashTendered, editableTotal, subtotal, totalProfit, userId, playBeep, fetchProducts, searchQuery, setIsReceiptVisible, setReceiptDetails, setIsLoading, showCustomAlert]);

  const handleCompletePurchase = useCallback(() => {
    if (scannedItems.length === 0) {
      showCustomAlert('Empty Cart', 'Please add items to the cart before completing.', 'warning');
      return;
    }
    setIsConfirmationModalVisible(true);
  }, [scannedItems, showCustomAlert]);

  // Initialize camera permissions and fetch initial product list
  useEffect(() => {
    async function getPermission() {
      const { granted } = await requestPermission();
      setIsPermissionGranted(granted);
    }

    if (!permission?.granted) {
      getPermission();
    } else {
      setIsPermissionGranted(permission.granted);
    }

    fetchProducts();
  }, [permission?.granted, fetchProducts]);

  // Removed auto-search while typing to prevent keyboard dismissal and instant queries

  // Render permission request screen if camera access isn't granted
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.permissionText}>
          {language === 'en' ? 'Requesting camera permission...' : 'Humihingi ng pahintulot sa camera...'}
        </Text>
      </View>
    );
  }

  if (!isPermissionGranted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          {language === 'en'
            ? 'We need your permission to access the camera for scanning.'
            : 'Kailangan namin ang iyong pahintulot upang ma-access ang camera para sa pag-scan.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>
            {language === 'en' ? 'Grant Permission' : 'Ibigay ang Pahintulot'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading modal
  const renderLoadingModal = () => {
    const progressWidth = loadingProgressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['20%', '90%'],
    });

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={isLoading}
        onRequestClose={() => {}}
      >
        <View style={styles.loadingModalOverlay}>
          <View style={styles.loadingModalContainer}>
            <View style={styles.loadingSpinnerContainer}>
              <ActivityIndicator size="large" color="#7C3AED" />
        </View>
            <Text style={styles.loadingModalTitle}>
              {language === 'en' ? 'Processing Transaction' : 'Pinoproseso ang Transaksyon'}
            </Text>
            <Text style={styles.loadingModalSubtitle}>
              {language === 'en' ? 'Please wait while we complete your purchase...' : 'Mangyaring maghintay habang kinukumpleto namin ang iyong pagbili...'}
            </Text>
            <View style={styles.loadingProgressBar}>
              <Animated.View 
                style={[
                  styles.loadingProgressFill,
                  { width: progressWidth }
                ]} 
              />
      </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Custom Alert Modal
  const renderCustomAlert = () => {
    const getIcon = () => {
      switch (customAlert.type) {
        case 'error':
          return <Ionicons name="close-circle" size={48} color="#EF4444" />;
        case 'success':
          return <Ionicons name="checkmark-circle" size={48} color="#10B981" />;
        case 'warning':
          return <Ionicons name="warning" size={48} color="#F59E0B" />;
        default:
          return <Ionicons name="information-circle" size={48} color="#3B82F6" />;
      }
    };

    const getButtonColor = () => {
      switch (customAlert.type) {
        case 'error':
          return '#EF4444';
        case 'success':
          return '#10B981';
        case 'warning':
          return '#F59E0B';
        default:
          return '#3B82F6';
      }
    };

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={customAlert.visible}
        onRequestClose={() => {}}
        presentationStyle="overFullScreen"
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.customAlertOverlay, { zIndex: 9999, elevation: 9999 }]}
          onPress={() => {}}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.customAlertContainer, { zIndex: 10000, elevation: 10000 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.customAlertIconContainer}>
              {getIcon()}
            </View>
            <Text style={styles.customAlertTitle}>{customAlert.title}</Text>
            <Text style={styles.customAlertMessage}>{customAlert.message}</Text>
            <TouchableOpacity
              style={[styles.customAlertButton, { backgroundColor: getButtonColor() }]}
              onPress={() => {
                if (customAlert.onConfirm) {
                  customAlert.onConfirm();
                }
                setCustomAlert(prev => ({ ...prev, visible: false }));
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.customAlertButtonText}>{language === 'en' ? 'OK' : 'OK'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderReceiptModal = () => {
    if (!isReceiptVisible || !receiptDetails) {
      return null;
    }


    const { items, total, change, cashTendered, subtotal, totalProfit, editableTotal, calculatedTotal } = receiptDetails;

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={isReceiptVisible}
        onRequestClose={() => {
          setIsReceiptVisible(false);
          clearCart();
        }}
      >
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.receiptHeader}>
                <Ionicons name="checkmark-circle" size={50} color="#4CAF50" />
                <Text style={styles.receiptTitle}>{t.transactionComplete}</Text>
                <Text style={styles.receiptDate}>
                  {formatTime(new Date().toISOString())}
                </Text>
              </View>

              <View style={styles.receiptSection}>
                <Text style={styles.receiptSectionTitle}>Summary</Text>
                {items.map(item => {
                  const originalPrice = parseFloat(item.product.price);
                  const sellPrice = item.sellPrice !== undefined ? parseFloat(item.sellPrice) : originalPrice;
                  const itemQty = item.qty;
                  const itemTotal = item.itemTotal !== undefined ? parseFloat(item.itemTotal) : (sellPrice * itemQty);
                  
                  // Calculate discount amount
                  const originalTotal = originalPrice * itemQty;
                  const discountAmount = originalTotal - itemTotal;
                  
                  return (
                  <View key={item.id} style={styles.receiptItem}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.receiptItemQty}>{itemQty}x</Text>
                    <Text style={styles.receiptItemName} numberOfLines={1}>{item.product.name}</Text>
                  </View>
                        {discountAmount > 0 && (
                          <Text style={{ fontSize: 12, color: '#28a745', marginLeft: 30, marginTop: 2 }}>
                            {t.discount}: -₱{discountAmount.toFixed(2)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.receiptItemTotal}>₱{itemTotal.toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.receiptSection}>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>{language === 'en' ? 'Subtotal' : 'Subtotal'}</Text>
                  <Text style={styles.receiptTotalValue}>₱{subtotal.toFixed(2)}</Text>
                </View>
                {(() => {
                  // Calculate original subtotal (before any discounts)
                  let originalSubtotal = 0;
                  let totalItemDiscount = 0;
                  
                  items.forEach(item => {
                    const originalPrice = parseFloat(item.product.price);
                    const itemQty = item.qty;
                    const itemSubtotal = originalPrice * itemQty;
                    originalSubtotal += itemSubtotal;
                    
                    // Calculate item discount
                    const sellPrice = item.sellPrice !== undefined ? parseFloat(item.sellPrice) : originalPrice;
                    const itemTotal = item.itemTotal !== undefined ? parseFloat(item.itemTotal) : (sellPrice * itemQty);
                    const itemDiscountAmount = itemSubtotal - itemTotal;
                    totalItemDiscount += itemDiscountAmount;
                  });
                  
                  // Calculate global discount or edited total difference
                  const calculatedSubtotalAfterItemDiscounts = originalSubtotal - totalItemDiscount;
                  const globalDiscountOrEditAmount = calculatedSubtotalAfterItemDiscounts - total;
                  
                  return (
                    <>
                      {totalItemDiscount > 0 && (
                        <View style={styles.receiptTotalRow}>
                          <Text style={styles.receiptTotalLabel}>{t.itemDiscounts}</Text>
                          <Text style={[styles.receiptTotalValue, { color: '#28a745' }]}>-₱{totalItemDiscount.toFixed(2)}</Text>
                        </View>
                      )}
                      {globalDiscountOrEditAmount > 0 && (
                        <View style={styles.receiptTotalRow}>
                          <Text style={styles.receiptTotalLabel}>
                            {editableTotal !== '' && !isNaN(parseFloat(editableTotal)) && parseFloat(editableTotal) !== calculatedTotal 
                              ? t.totalAdjustment
                              : t.globalDiscount}
                          </Text>
                          <Text style={[styles.receiptTotalValue, { color: '#28a745' }]}>-₱{globalDiscountOrEditAmount.toFixed(2)}</Text>
                        </View>
                      )}
                    </>
                  );
                })()}
                <View style={[styles.receiptTotalRow, styles.receiptGrandTotal]}>
                  <Text style={styles.receiptGrandTotalLabel}>{t.total}</Text>
                  <Text style={styles.receiptGrandTotalValue}>₱{total.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.receiptSection}>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>{language === 'en' ? 'Cash Tendered' : 'Perang Ibinayad'}</Text>
                  <Text style={styles.receiptTotalValue}>₱{cashTendered.toFixed(2)}</Text>
                </View>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>{language === 'en' ? 'Change Due' : 'Sukli'}</Text>
                  <Text style={styles.receiptTotalValue}>₱{change.toFixed(2)}</Text>
                </View>
              </View>

              <Text style={styles.receiptFooter}>{language === 'en' ? 'Thank you for your purchase!' : 'Salamat sa inyong pagbili!'}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.receiptCloseButton}
              onPress={() => {
                setIsReceiptVisible(false);
                clearCart();
              }}
            >
              <Text style={styles.receiptCloseButtonText}>{t.newTransaction}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderConfirmationModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isConfirmationModalVisible}
      onRequestClose={() => setIsConfirmationModalVisible(false)}
    >
      <View style={styles.logoutModalOverlay}>
        <View style={styles.logoutModalContainer}>
          <Ionicons name="help-circle-outline" size={48} color="#3498db" />
          <Text style={styles.logoutModalTitle}>{language === 'en' ? 'Confirm Action' : 'Kumpirmahin ang Aksyon'}</Text>
          <Text style={styles.logoutModalText}>
            {language === 'en' ? 'Are you done adding products?' : 'Tapos ka na ba sa pagdaragdag ng mga produkto?'}
          </Text>
          <View style={styles.logoutModalActions}>
            <TouchableOpacity
              style={[styles.logoutModalButton, styles.cancelLogoutButton]}
              onPress={() => setIsConfirmationModalVisible(false)}
            >
              <Text style={[styles.logoutModalButtonText, { color: '#4B5563' }]}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logoutModalButton, {backgroundColor: '#3498db'}]}
              onPress={() => {
                setIsConfirmationModalVisible(false);
                executePurchase(); // Don't skip - let it check for negative profit
              }}
            >
              <Text style={styles.logoutModalButtonText}>{language === 'en' ? 'Yes, Proceed' : 'Oo, Magpatuloy'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderNegativeProfitModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isNegativeProfitModalVisible}
      onRequestClose={() => setIsNegativeProfitModalVisible(false)}
    >
      <View style={styles.logoutModalOverlay}>
        <View style={styles.logoutModalContainer}>
          <Ionicons name="warning" size={48} color="#F59E0B" />
          <Text style={styles.logoutModalTitle}>{language === 'en' ? 'Negative Profit Warning' : 'Babala sa Negatibong Kita'}</Text>
          <Text style={styles.logoutModalText}>
            {language === 'en'
              ? `This transaction will result in a loss of ₱${Math.abs(negativeProfitAmount).toFixed(2)}.`
              : `Ang transaksyon na ito ay magreresulta sa pagkawala ng ₱${Math.abs(negativeProfitAmount).toFixed(2)}.`}
          </Text>
          <Text style={[styles.logoutModalText, { marginTop: 8, fontSize: 16, color: '#EF4444', fontWeight: '600' }]}>
            {language === 'en' ? 'Total Profit' : 'Kabuuang Kita'}: ₱{negativeProfitAmount.toFixed(2)}
          </Text>
          <Text style={[styles.logoutModalText, { marginTop: 12, fontSize: 15, color: '#6B7280' }]}>
            {language === 'en' ? 'Do you want to proceed with this transaction?' : 'Gusto mo bang magpatuloy sa transaksyon na ito?'}
          </Text>
          <View style={styles.logoutModalActions}>
            <TouchableOpacity
              style={[styles.logoutModalButton, styles.cancelLogoutButton]}
              onPress={() => {
                setIsNegativeProfitModalVisible(false);
                setNegativeProfitAmount(0);
              }}
            >
              <Text style={[styles.logoutModalButtonText, { color: '#4B5563' }]}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logoutModalButton, {backgroundColor: '#F59E0B'}]}
              onPress={() => {
                setIsNegativeProfitModalVisible(false);
                setNegativeProfitAmount(0);
                executePurchase(true); // Skip the negative profit check and proceed
              }}
            >
              <Text style={styles.logoutModalButtonText}>{language === 'en' ? 'Yes, Proceed' : 'Oo, Magpatuloy'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderSettingsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isSettingsModalVisible}
      onRequestClose={() => setIsSettingsModalVisible(false)}
    >
      <TouchableOpacity
        style={styles.settingsModalOverlay}
        activeOpacity={1}
        onPressOut={() => setIsSettingsModalVisible(false)}
      >
        <View style={styles.settingsModalContainer}>
          <View style={styles.settingsModalHeader}>
            <Text style={styles.settingsModalTitle}>{language === 'en' ? 'Settings' : 'Mga Setting'}</Text>
            <TouchableOpacity
              style={styles.settingsModalCloseButton}
              onPress={() => setIsSettingsModalVisible(false)}
            >
              <Ionicons name="close" size={28} color="#4B5563" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.settingsModalButton}
            onPress={startWalkthrough}
          >
            <Ionicons name="book-outline" size={24} color="#344054" />
            <View style={styles.settingsModalButtonTextBox}>
              <Text style={styles.settingsModalButtonText}>
                {language === 'en' ? 'User Guide' : 'Gabay ng User'}
              </Text>
              <Text style={styles.settingsModalButtonSubtitle}>
                {language === 'en' ? 'Learn how to use the app' : 'Matuto kung paano gamitin ang app'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingsModalButton, styles.settingsLogoutButton]}
            onPress={() => {
              setIsSettingsModalVisible(false);
              setIsLogoutModalVisible(true);
            }}
          >
            <Ionicons name="log-out-outline" size={24} color="#B91C1C" />
            <View style={styles.settingsModalButtonTextBox}>
              <Text style={[styles.settingsModalButtonText, { color: '#B91C1C' }]}>
                {language === 'en' ? 'Logout' : 'Mag-logout'}
              </Text>
              <Text style={[styles.settingsModalButtonSubtitle, { color: '#DC2626' }]}>
                {language === 'en' ? 'End your session' : 'Tapusin ang iyong session'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

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
          <Text style={styles.logoutModalTitle}>
            {language === 'en' ? 'Confirm Logout' : 'Kumpirmahin ang Logout'}
          </Text>
          <Text style={styles.logoutModalText}>
            {language === 'en' ? 'Are you sure you want to end your session?' : 'Sigurado ka bang gusto mong tapusin ang iyong session?'}
          </Text>
          <View style={styles.logoutModalActions}>
            <TouchableOpacity
              style={[styles.logoutModalButton, styles.cancelLogoutButton]}
              onPress={() => setIsLogoutModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={{color: '#333', fontWeight: '600', fontSize: 18}}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logoutModalButton, styles.confirmLogoutButton]}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Text style={{color: '#fff', fontWeight: '600', fontSize: 18}}>
                {language === 'en' ? 'Logout' : 'Mag-logout'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderWalkthroughModal = () => {
    if (!isWalkthroughVisible || Object.keys(elementLayouts).length === 0) return null;

    const currentStep = walkthroughSteps[walkthroughStep];
    const targetLayout = elementLayouts[currentStep.target];

    if (!targetLayout) return null;

    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const isLandscape = screenWidth > screenHeight;
    
    // Responsive modal sizing
    const baseModalWidth = Math.min(screenWidth * 0.85, 340);
    const modalWidth = isLandscape ? Math.min(screenWidth * 0.4, 320) : baseModalWidth;
    const modalMargin = 16;
    const arrowSize = 14;
    const minModalHeight = 200;
    const maxModalHeight = isLandscape ? 220 : 240;
    
    // Calculate dynamic height based on content
    const titleHeight = 60;
    const currentDescription = language === 'en' ? currentStep.descriptionEn : currentStep.descriptionTl;
    const descriptionHeight = currentDescription && currentDescription.length > 60 ? 80 : 60;
    const actionsHeight = 50;
    const iconHeight = 50;
    const padding = 40;
    const progressHeight = 30;
    const estimatedModalHeight = Math.max(
      minModalHeight,
      Math.min(
        maxModalHeight,
        titleHeight + descriptionHeight + actionsHeight + iconHeight + padding + progressHeight
      )
    );

    let modalTop, modalLeft, arrowStyles;
    const isHorizontalLayout = ['search', 'scanner', 'cart'].includes(currentStep.target);

    // Enhanced positioning logic
    if (isHorizontalLayout) {
      const spaceRight = screenWidth - (targetLayout.x + targetLayout.width);
      const spaceLeft = targetLayout.x;
      const spaceBelow = screenHeight - (targetLayout.y + targetLayout.height);
      const spaceAbove = targetLayout.y;
      
      // Try to position horizontally first
      if (spaceRight > modalWidth + modalMargin + arrowSize) {
        modalLeft = targetLayout.x + targetLayout.width + modalMargin;
        modalTop = targetLayout.y + (targetLayout.height / 2) - (estimatedModalHeight / 2);
        arrowStyles = { 
          left: -arrowSize, 
          borderRightWidth: arrowSize, 
          borderRightColor: '#fff',
          top: estimatedModalHeight / 2 - arrowSize
        };
      } else if (spaceLeft > modalWidth + modalMargin + arrowSize) {
        modalLeft = targetLayout.x - modalWidth - modalMargin;
        modalTop = targetLayout.y + (targetLayout.height / 2) - (estimatedModalHeight / 2);
        arrowStyles = { 
          right: -arrowSize, 
          borderLeftWidth: arrowSize, 
          borderLeftColor: '#fff',
          top: estimatedModalHeight / 2 - arrowSize
        };
      } else {
        // Position above or below
        if (spaceAbove > spaceBelow && spaceAbove > estimatedModalHeight + modalMargin) {
        modalTop = targetLayout.y - estimatedModalHeight - modalMargin;
          arrowStyles = { 
            bottom: -arrowSize, 
            borderTopWidth: arrowSize, 
            borderTopColor: '#fff',
            left: modalWidth / 2 - arrowSize
          };
        } else {
          modalTop = targetLayout.y + targetLayout.height + modalMargin;
          arrowStyles = { 
            top: -arrowSize, 
            borderBottomWidth: arrowSize, 
            borderBottomColor: '#fff',
            left: modalWidth / 2 - arrowSize
          };
        }
        modalLeft = targetLayout.x + (targetLayout.width / 2) - (modalWidth / 2);
      }
    } else {
      // Vertical positioning for payment section (prefer above since it's usually at bottom)
      const spaceBelow = screenHeight - (targetLayout.y + targetLayout.height);
      const spaceAbove = targetLayout.y;
      const minGap = 80; // Increased minimum gap to prevent overlap (was 60)
      const safeGap = 100; // Preferred gap for better visibility (was 80)
      const clearance = 40; // Minimum clearance from target (was 20)
      
      // Calculate modal bottom position to check for overlap
      const checkOverlap = (top) => {
        const modalBottom = top + estimatedModalHeight;
        // Ensure modal bottom is at least clearance px away from target top
        return modalBottom <= targetLayout.y - clearance;
      };
      
      // For payment section, prefer showing above if there's enough space
      if (spaceAbove >= estimatedModalHeight + safeGap) {
        // Position above with safe gap to prevent overlap
        modalTop = targetLayout.y - estimatedModalHeight - safeGap;
        // Double-check no overlap
        if (!checkOverlap(modalTop)) {
          modalTop = targetLayout.y - estimatedModalHeight - minGap;
        }
        arrowStyles = { 
          bottom: -arrowSize, 
          borderTopWidth: arrowSize, 
          borderTopColor: '#fff',
          left: modalWidth / 2 - arrowSize
        };
      } else if (spaceAbove >= estimatedModalHeight + minGap) {
        // Position above with minimum gap
        modalTop = targetLayout.y - estimatedModalHeight - minGap;
        // Ensure no overlap
        if (!checkOverlap(modalTop)) {
          modalTop = Math.max(modalMargin, targetLayout.y - estimatedModalHeight - 70);
        }
        arrowStyles = { 
          bottom: -arrowSize, 
          borderTopWidth: arrowSize, 
          borderTopColor: '#fff',
          left: modalWidth / 2 - arrowSize
        };
      } else if (spaceBelow >= estimatedModalHeight + minGap) {
        // Position below if not enough space above
        modalTop = targetLayout.y + targetLayout.height + minGap;
        arrowStyles = { 
          top: -arrowSize, 
          borderBottomWidth: arrowSize, 
          borderBottomColor: '#fff',
          left: modalWidth / 2 - arrowSize
        };
      } else {
        // If not enough space, try positioning to the side
        const spaceRight = screenWidth - (targetLayout.x + targetLayout.width);
        const spaceLeft = targetLayout.x;
        
        if (spaceRight > modalWidth + modalMargin + arrowSize + 30) {
          // Position to the right with extra margin
          modalLeft = targetLayout.x + targetLayout.width + modalMargin + 15;
          modalTop = targetLayout.y + (targetLayout.height / 2) - (estimatedModalHeight / 2);
          arrowStyles = { 
            left: -arrowSize, 
            borderRightWidth: arrowSize, 
            borderRightColor: '#fff',
            top: estimatedModalHeight / 2 - arrowSize
          };
        } else if (spaceLeft > modalWidth + modalMargin + arrowSize + 30) {
          // Position to the left with extra margin
          modalLeft = targetLayout.x - modalWidth - modalMargin - 15;
          modalTop = targetLayout.y + (targetLayout.height / 2) - (estimatedModalHeight / 2);
          arrowStyles = { 
            right: -arrowSize, 
            borderLeftWidth: arrowSize, 
            borderLeftColor: '#fff',
            top: estimatedModalHeight / 2 - arrowSize
          };
        } else {
          // Last resort: position above with maximum gap possible, ensure no overlap
          const maxPossibleGap = Math.max(60, spaceAbove - estimatedModalHeight - clearance);
          modalTop = Math.max(modalMargin, targetLayout.y - estimatedModalHeight - maxPossibleGap);
          // Final overlap check - ensure modal bottom is well clear of target
          const modalBottom = modalTop + estimatedModalHeight;
          if (modalBottom >= targetLayout.y - clearance) {
            // If still overlapping, push it higher
            modalTop = targetLayout.y - estimatedModalHeight - 70;
            // But don't go off screen
            if (modalTop < modalMargin) {
              modalTop = modalMargin;
            }
          }
          arrowStyles = { 
            bottom: -arrowSize, 
            borderTopWidth: arrowSize, 
            borderTopColor: '#fff',
            left: modalWidth / 2 - arrowSize
          };
        }
      }
      
      // Final validation: ensure modal doesn't overlap with target
      const modalBottom = modalTop + estimatedModalHeight;
      if (modalBottom > targetLayout.y - clearance) {
        // Force modal higher if it's still too close
        modalTop = Math.max(modalMargin, targetLayout.y - estimatedModalHeight - 70);
        // Re-check after adjustment
        const newModalBottom = modalTop + estimatedModalHeight;
        if (newModalBottom > targetLayout.y - clearance) {
          // If still too close, use even more gap
          modalTop = Math.max(modalMargin, targetLayout.y - estimatedModalHeight - 90);
        }
      }
      
      // Only set modalLeft if not already set (for side positioning)
      if (modalLeft === undefined) {
      modalLeft = targetLayout.x + (targetLayout.width / 2) - (modalWidth / 2);
      }
    }

    // Ensure modal stays within screen bounds
    if (modalLeft + modalWidth > screenWidth - modalMargin) {
      modalLeft = screenWidth - modalWidth - modalMargin;
      // Adjust arrow if modal was repositioned
      if (arrowStyles.left !== undefined && !arrowStyles.right) {
        arrowStyles.left = targetLayout.x + (targetLayout.width / 2) - modalLeft - arrowSize;
      }
    }
    if (modalLeft < modalMargin) {
      modalLeft = modalMargin;
      if (arrowStyles.left !== undefined && !arrowStyles.right) {
      arrowStyles.left = targetLayout.x + (targetLayout.width / 2) - modalLeft - arrowSize;
    }
    }
    if (modalTop < modalMargin) {
      modalTop = modalMargin;
    }
    if (modalTop + estimatedModalHeight > screenHeight - modalMargin) {
      modalTop = screenHeight - estimatedModalHeight - modalMargin;
    }

    // Progress indicator
    const progress = ((walkthroughStep + 1) / walkthroughSteps.length) * 100;

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={isWalkthroughVisible}
        onRequestClose={handleSkipWalkthrough}
      >
        <TouchableOpacity
          style={styles.walkthroughOverlay}
          activeOpacity={1}
          onPress={handleSkipWalkthrough}
        >
          <View
            style={[
              styles.walkthroughHighlight,
              {
                top: targetLayout.y - 4,
                left: targetLayout.x - 4,
                width: targetLayout.width + 8,
                height: targetLayout.height + 8,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.walkthroughContainer,
              {
                top: modalTop,
                left: modalLeft,
                width: modalWidth,
                minHeight: estimatedModalHeight
              },
            ]}
          >
            <View style={[styles.walkthroughArrow, arrowStyles]} />
            
            {/* Icon */}
            <View style={styles.walkthroughIconContainer}>
              <Ionicons 
                name={currentStep.icon || 'information-circle'} 
                size={48} 
                color="#7C3AED" 
              />
            </View>
            
            {/* Progress Indicator */}
            <View style={styles.walkthroughProgressContainer}>
              <View style={styles.walkthroughProgressBar}>
                <Animated.View 
                  style={[
                    styles.walkthroughProgressFill,
                    { width: `${progress}%` }
                  ]} 
                />
              </View>
              <Text style={styles.walkthroughProgressText}>
                {walkthroughStep + 1} of {walkthroughSteps.length}
              </Text>
            </View>
            
            {/* Title */}
            <Text style={styles.walkthroughTitle}>
              {language === 'en' ? currentStep.titleEn : currentStep.titleTl}
            </Text>
            
            {/* Description */}
            <Text style={styles.walkthroughDescription}>
              {language === 'en' ? currentStep.descriptionEn : currentStep.descriptionTl}
            </Text>
            
            {/* Actions */}
            <View style={styles.walkthroughActions}>
              <TouchableOpacity 
                style={styles.walkthroughSkipButton}
                onPress={handleSkipWalkthrough}
                activeOpacity={0.7}
              >
                <Text style={styles.walkthroughSkipText}>
                  {language === 'en' ? 'Skip' : 'Laktawan'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.walkthroughNextButton} 
                onPress={handleNextStep}
                activeOpacity={0.8}
              >
                <Text style={styles.walkthroughNextButtonText}>
                  {walkthroughStep === walkthroughSteps.length - 1
                    ? (language === 'en' ? 'Finish' : 'Tapos')
                    : (language === 'en' ? 'Next' : 'Susunod')}
                </Text>
                {walkthroughStep < walkthroughSteps.length - 1 && (
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // RenderTransactionsModal component
  function RenderTransactionsModal({ isVisible, onClose, previousTransactions, isLoading, error, filteredProducts, userId, onTransactionUpdated }) {
    const [selectedTx, setSelectedTx] = useState(null);
    const [editedItems, setEditedItems] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isSaveConfirmationVisible, setIsSaveConfirmationVisible] = useState(false);
    const [productPickerVisible, setProductPickerVisible] = useState(false);
    const [pickerItemIndex, setPickerItemIndex] = useState(null);
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [productPickerSearchQuery, setProductPickerSearchQuery] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [isAdditionalPaymentModalVisible, setIsAdditionalPaymentModalVisible] = useState(false);
    const [additionalPaymentAmount, setAdditionalPaymentAmount] = useState('');
    const [balanceDue, setBalanceDue] = useState(0);

    const groupEditedItems = (items) => {
      const grouped = {};
      items.forEach((item) => {
        let productId = item.inventory_id || item.id || item.product_id || item.productId;
        if (!productId && item.name && filteredProducts && filteredProducts.length > 0) {
          const foundProduct = filteredProducts.find(p => p.name === item.name);
          if (foundProduct) productId = foundProduct.id;
        }
        if (!productId) return;
        const productIdStr = productId.toString();
        if (!grouped[productIdStr]) {
          const price = item.price_each || item.price || item.Price || item.priceEach || 0;
          const discount = item.discount_percent || item.discount || item.Discount || item.discountPercent || 0;
          grouped[productIdStr] = { product_id: productIdStr, quantity: 0, price: Number(price), discount: Number(discount) };
        }
        grouped[productIdStr].quantity += (item.quantity || 1);
      });
      return Object.values(grouped);
    };

    const updateTransaction = useCallback(async (additionalPayment = 0) => {
      if (!selectedTx || !selectedTx.id) {
        showCustomAlert('Error', 'Transaction ID is missing', 'error');
        return;
      }
      setIsSaving(true);
      try {
        const itemsToGroup = editedItems.length > 0 ? editedItems : (selectedTx.items || []);
        if (itemsToGroup.length === 0) {
          showCustomAlert('Error', 'No items to update.', 'error');
          setIsSaving(false);
          return;
        }
        const groupedItems = groupEditedItems(itemsToGroup);
        if (groupedItems.length === 0) {
          showCustomAlert('Error', 'Failed to group items.', 'error');
          setIsSaving(false);
          return;
        }
        const payload = {
          transaction_id: selectedTx.id,
          items: groupedItems,
          global_discount: selectedTx.global_discount ?? selectedTx.globalDiscount ?? 0,
          cash_tendered: selectedTx.cash_tendered ?? selectedTx.cashTendered ?? 0,
          user_id: userId || 1,
        };
        
        // Add additional payment if provided
        if (additionalPayment > 0) {
          payload.additional_payment = additionalPayment;
        }
        
        const response = await fetch(`${API_BASE_URL}/update_transaction.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        const responseText = await response.text();
        let result;
        try {
          result = parseJSONFromResponse(responseText);
        } catch (e) {
          throw new Error(e.message || 'Failed to parse server response.');
        }
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || 'Update failed.');
        }
        
        // Check if additional payment is required
        const data = result.data || {};
        let balanceDueAmount = data.balance_due || 0;
        const requiresAdditionalPayment = data.requires_additional_payment || false;
        const totalAmount = data.total_amount || 0;
        const cashTendered = data.cash_tendered || 0;
        
        // Calculate balance_due if not provided but cash_tendered < total_amount
        if (balanceDueAmount === 0 && totalAmount > 0 && cashTendered > 0) {
          const calculatedBalance = totalAmount - cashTendered;
          if (calculatedBalance > 0) {
            balanceDueAmount = calculatedBalance;
            console.log('Calculated balance_due from total and cash_tendered:', balanceDueAmount);
          }
        }
        
        // Debug logging
        console.log('Update Transaction Response:', {
          balanceDueAmount,
          requiresAdditionalPayment,
          additionalPayment,
          totalAmount,
          cashTendered,
          changeDue: data.change_due,
          fullData: JSON.stringify(data, null, 2)
        });
        
        // Show modal if balance_due exists (even if requires_additional_payment flag is missing)
        if (balanceDueAmount > 0 && additionalPayment === 0) {
          // Show modal for additional payment
          console.log('Showing additional payment modal with balance:', balanceDueAmount);
          // Close edit modal first to avoid modal conflicts
          setIsEditModalVisible(false);
          setBalanceDue(balanceDueAmount);
          setIsAdditionalPaymentModalVisible(true);
          setIsSaving(false);
          return;
        }
        
        // Success - transaction updated
        const changeDue = data.change_due || 0;
        const message = changeDue > 0 
          ? `Transaction updated successfully.\n\nChange Due: ₱${changeDue.toFixed(2)}`
          : 'Transaction updated successfully.';
        
        // Close other modals first to ensure success alert appears on top
        setIsEditModalVisible(false);
        setIsAdditionalPaymentModalVisible(false);
        
        // Use setTimeout to ensure modals are closed before showing success alert
        setTimeout(() => {
          showCustomAlert('Success', message, 'success', () => {
            setSelectedTx(null);
            setEditedItems([]);
            setAdditionalPaymentAmount('');
            setBalanceDue(0);
            if (onTransactionUpdated) onTransactionUpdated();
          });
        }, 100);
      } catch (error) {
        // Check if error is about insufficient cash - show modal instead of alert
        const errorMessage = error.message || '';
        if (errorMessage.toLowerCase().includes('cash tendered') && 
            errorMessage.toLowerCase().includes('less than')) {
          
          // Try to calculate balance_due from the transaction
          if (selectedTx) {
            // Calculate new total from edited items
            const itemsToCalculate = editedItems.length > 0 ? editedItems : (selectedTx.items || []);
            let newSubtotal = 0;
            let totalItemDiscount = 0;
            
            itemsToCalculate.forEach(item => {
              const price = item.price_each || item.price || 0;
              const qty = item.quantity || 1;
              const discount = item.discount_percent || item.discount || 0;
              const itemSubtotal = price * qty;
              const itemDiscountAmount = itemSubtotal * (discount / 100);
              newSubtotal += itemSubtotal;
              totalItemDiscount += itemDiscountAmount;
            });
            
            const globalDiscount = selectedTx.global_discount ?? selectedTx.globalDiscount ?? 0;
            const globalDiscountAmount = newSubtotal * (globalDiscount / 100);
            const newTotal = newSubtotal - totalItemDiscount - globalDiscountAmount;
            const originalCash = selectedTx.cash_tendered ?? selectedTx.cashTendered ?? 0;
            const balanceDue = newTotal - originalCash;
            
            if (balanceDue > 0) {
              console.log('Calculated balance_due from error:', balanceDue);
              setIsEditModalVisible(false);
              setBalanceDue(balanceDue);
              setIsAdditionalPaymentModalVisible(true);
              setIsSaving(false);
              return;
            }
          }
        }
        
        // For other errors, show alert
        showCustomAlert('Update Failed', error.message, 'error');
      } finally {
        setIsSaving(false);
      }
    }, [selectedTx, editedItems, userId, onTransactionUpdated, filteredProducts, showCustomAlert]);

    useEffect(() => {
      if (selectedTx) {
        const items = Array.isArray(selectedTx.items) ? selectedTx.items : [];
        const flattened = [];
        items.forEach((item, idx) => {
          const productId = item.inventory_id || item.id || item.product_id || item.productId;
          if (!productId) {
            if (item.name && filteredProducts && filteredProducts.length > 0) {
              const foundProduct = filteredProducts.find(p => p.name === item.name);
              if (foundProduct) {
                const baseItem = {
                  ...item,
                  id: foundProduct.id,
                  product_id: foundProduct.id,
                  inventory_id: foundProduct.id,
                  name: item.name || foundProduct.name || '',
                  price_each: item.price_each || item.price || foundProduct.price || 0,
                  price: item.price || item.price_each || foundProduct.price || 0,
                  discount_percent: item.discount_percent || item.discount || 0,
                  discount: item.discount || item.discount_percent || 0,
                };
                for (let i = 0; i < (item.quantity || 1); i++) {
                  flattened.push({ ...baseItem, uniqueId: `${baseItem.id}-${idx}-${i}`, originalIdx: idx, splitIdx: i, quantity: 1 });
                }
                return;
              }
            }
            return;
          }
          const baseItem = {
            ...item,
            id: productId,
            product_id: productId,
            inventory_id: productId,
            name: item.name || item.product_name || '',
            price_each: item.price_each || item.price || 0,
            price: item.price || item.price_each || 0,
            discount_percent: item.discount_percent || item.discount || 0,
            discount: item.discount || item.discount_percent || 0,
          };
          for (let i = 0; i < (item.quantity || 1); i++) {
            flattened.push({ ...baseItem, uniqueId: `${baseItem.id}-${idx}-${i}`, originalIdx: idx, splitIdx: i, quantity: 1 });
          }
        });
        setEditedItems(flattened);
      } else {
        setEditedItems([]);
      }
    }, [selectedTx, filteredProducts]);

    const renderDetailsModal = () => {
      if (!selectedTx) return null;
      const items = editedItems.length > 0 ? editedItems : (Array.isArray(selectedTx.items) ? selectedTx.items : []);
      const total = selectedTx.total ?? 0;
      const cashTendered = selectedTx.cash_tendered ?? selectedTx.cashTendered ?? 0;
      const globalDiscount = selectedTx.globalDiscount ?? selectedTx.global_discount ?? 0;
      const subtotal = selectedTx.subtotal ?? selectedTx.Subtotal ?? 0;
      const date = selectedTx.date ?? selectedTx.Date;
      
      // Group items by product ID/name and sum quantities
      const groupItemsForDisplay = (itemsArray) => {
        const grouped = {};
        itemsArray.forEach((item) => {
          const productId = item.id || item.product_id || item.inventory_id || item.name;
          const productKey = productId?.toString() || item.name || 'unknown';
          
          if (!grouped[productKey]) {
            const price = item.price_each || item.price || 0;
            const discount = item.discount_percent || item.discount || 0;
            grouped[productKey] = {
              id: productId,
              name: item.name || item.product_name || '',
              price: price,
              quantity: 0,
              discount: discount,
            };
          }
          grouped[productKey].quantity += (item.quantity || 1);
        });
        return Object.values(grouped);
      };
      
      const groupedItems = groupItemsForDisplay(items);
      
      return (
        <>
        <Modal animationType="fade" transparent={true} visible={!!selectedTx} onRequestClose={() => setSelectedTx(null)}>
          <View style={styles.receiptModalOverlay}>
            <View style={styles.receiptModalContainer}>
              <TouchableOpacity style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }} onPress={() => setSelectedTx(null)}>
                <Ionicons name="close" size={28} color="#888" />
              </TouchableOpacity>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{alignItems: 'center', marginBottom: 12}}>
                  <Ionicons name="checkmark-circle" size={50} color="#7C3AED" />
                  <Text style={[modalStyles.title, {marginBottom: 2}]}>Transaction Details</Text>
                  <Text style={{fontSize: 18, color: '#37353E', fontWeight: '500', marginBottom: 8}}>{date ? formatTime(date) : ''}</Text>
                </View>
                <View style={styles.receiptSection}>
                  <Text style={styles.receiptSectionTitle}>Summary</Text>
                  {groupedItems.length > 0 ? groupedItems.map((item, idx) => {
                    const itemPrice = item.price || 0;
                    const itemQty = item.quantity || 1;
                    const itemDiscount = item.discount || 0;
                    const itemSubtotal = itemPrice * itemQty;
                    const itemDiscountAmount = itemSubtotal * (itemDiscount / 100);
                    const itemTotal = itemSubtotal - itemDiscountAmount;
                    return (
                      <View key={`${item.id || item.name}-${idx}`} style={styles.receiptItem}>
                        <View style={{flex: 1}}>
                          <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Text style={styles.receiptItemQty}>{itemQty}x</Text>
                            <Text style={styles.receiptItemName} numberOfLines={1}>{item.name}</Text>
                          </View>
                          {itemDiscount > 0 && (
                            <Text style={{fontSize: 14, color: '#888', marginLeft: 30, marginTop: 2}}>
                              Discount: {itemDiscount}% (-₱{itemDiscountAmount.toFixed(2)})
                            </Text>
                          )}
                        </View>
                        <Text style={styles.receiptItemTotal}>₱{itemTotal.toFixed(2)}</Text>
                      </View>
                    );
                  }) : <Text style={{color: '#888', fontSize: 17}}>No item details available.</Text>}
                </View>
                <View style={styles.receiptSection}>
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Subtotal</Text>
                    <Text style={styles.receiptTotalValue}>₱{subtotal !== undefined ? Number(subtotal).toFixed(2) : '-'}</Text>
                  </View>
                  {(() => {
                    let originalSubtotal = 0;
                    let totalItemDiscount = 0;
                    if (groupedItems.length > 0) {
                      groupedItems.forEach(item => {
                        const itemPrice = item.price || 0;
                        const itemQty = item.quantity || 1;
                        const itemDiscount = item.discount || 0;
                        const itemSubtotal = itemPrice * itemQty;
                        originalSubtotal += itemSubtotal;
                        totalItemDiscount += itemSubtotal * (itemDiscount / 100);
                      });
                    }
                    const baseSubtotal = originalSubtotal > 0 ? originalSubtotal : (subtotal || 0);
                    const globalDiscountAmount = baseSubtotal > 0 && globalDiscount > 0 ? baseSubtotal * (globalDiscount / 100) : 0;
                    return (
                      <>
                        {totalItemDiscount > 0 && (
                          <View style={styles.receiptTotalRow}>
                            <Text style={styles.receiptTotalLabel}>Item Discounts</Text>
                            <Text style={styles.receiptTotalValue}>-₱{totalItemDiscount.toFixed(2)}</Text>
                          </View>
                        )}
                        {globalDiscount > 0 && (
                          <View style={styles.receiptTotalRow}>
                            <Text style={styles.receiptTotalLabel}>Global Discount ({globalDiscount}%)</Text>
                            <Text style={styles.receiptTotalValue}>-₱{globalDiscountAmount.toFixed(2)}</Text>
                          </View>
                        )}
                      </>
                    );
                  })()}
                  <View style={[styles.receiptTotalRow, styles.receiptGrandTotal]}>
                    <Text style={[styles.totalLabel, {fontWeight: 'bold', fontSize: 18, color: '#1A202C'}]}>Total</Text>
                    <Text style={[styles.totalValue, {fontWeight: 'bold', fontSize: 20, color: '#1A202C'}]}>₱{total !== undefined ? Number(total).toFixed(2) : '-'}</Text>
                  </View>
                </View>
                <View style={styles.receiptSection}>
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Cash Tendered</Text>
                    <Text style={styles.receiptTotalValue}>₱{cashTendered !== undefined ? Number(cashTendered).toFixed(2) : '-'}</Text>
                  </View>
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Change Due</Text>
                    <Text style={styles.receiptTotalValue}>₱{Number(selectedTx.change_due ?? 0).toFixed(2)}</Text>
                  </View>
                </View>
                <Text style={styles.receiptFooter}>Thank you for your purchase!</Text>
              </ScrollView>
              <TouchableOpacity
                style={[modalStyles.closeButton, {marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18}]}
                onPress={() => setIsEditModalVisible(true)}
              >
                <Ionicons name="create-outline" size={20} color="#fff" style={{marginRight: 8}} />
                <Text style={[modalStyles.closeButtonText, {color: '#fff', fontWeight: '600'}]}>Edit</Text>
              </TouchableOpacity>
              <Modal animationType="slide" transparent={true} visible={isEditModalVisible} onRequestClose={() => setIsEditModalVisible(false)}>
                <View style={modalStyles.overlay}>
                  <View style={[modalStyles.container, {padding: 20, maxWidth: 350, alignSelf: 'center'}]}>
                    <Text style={[modalStyles.title, {marginBottom: 16}]}>Edit Purchased Item</Text>
                    <Text style={{marginBottom: 8}}>Purchased Items</Text>
                    {items.length > 0 ? (
                      <View style={{marginBottom: 16}}>
                        {items.map((item, idx) => (
                          <TouchableOpacity
                            key={item.uniqueId || `${item.id || idx}-${idx}`}
                            style={{borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 14, marginBottom: 10, backgroundColor: '#FAFAFA', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start'}}
                            onPress={() => {
                              setPickerItemIndex({itemIdx: idx, uniqueId: item.uniqueId, originalIdx: item.originalIdx, splitIdx: item.splitIdx});
                              setSelectedProductId(null);
                              setProductPickerVisible(true);
                            }}
                          >
                            <Text style={{fontSize: 18, fontWeight: 'bold', marginRight: 24}}>{item.name}</Text>
                            <Text style={{fontSize: 17, color: '#555'}}>Qty: 1</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : <Text style={{color: '#888'}}>No items to edit.</Text>}
                    <Modal animationType="slide" transparent={true} visible={productPickerVisible} onRequestClose={() => {
                      setProductPickerVisible(false);
                      setProductPickerSearchQuery('');
                      setSelectedProductId(null);
                    }}>
                      <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'}}>
                        <View style={{backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '90%', maxWidth: 400, maxHeight: '80%'}}>
                          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16}}>
                            <Text style={{fontSize: 24, fontWeight: 'bold', color: '#1A202C'}}>Select New Product</Text>
                            <TouchableOpacity onPress={() => {
                              setProductPickerVisible(false);
                              setProductPickerSearchQuery('');
                              setSelectedProductId(null);
                            }}>
                              <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                          </View>
                          
                          {/* Search Input */}
                          <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB'}}>
                            <Ionicons name="search" size={20} color="#9CA3AF" style={{marginRight: 8}} />
                            <TextInput
                              style={{flex: 1, paddingVertical: 12, fontSize: 18, color: '#1A202C'}}
                              placeholder="Search products..."
                              placeholderTextColor="#9CA3AF"
                              value={productPickerSearchQuery}
                              onChangeText={setProductPickerSearchQuery}
                              autoFocus={true}
                            />
                            {productPickerSearchQuery.length > 0 && (
                              <TouchableOpacity onPress={() => setProductPickerSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                              </TouchableOpacity>
                            )}
                          </View>

                          {/* Product List */}
                          <View style={{maxHeight: 300, marginBottom: 16}}>
                            {(() => {
                              const searchLower = productPickerSearchQuery.toLowerCase();
                              const filtered = Array.isArray(filteredProducts) 
                                ? filteredProducts.filter(product => 
                                    product.name?.toLowerCase().includes(searchLower) ||
                                    product.category?.toLowerCase().includes(searchLower)
                                  )
                                : [];
                              
                              if (filtered.length === 0) {
                                return (
                                  <View style={{padding: 20, alignItems: 'center'}}>
                                    <Ionicons name="search-outline" size={48} color="#9CA3AF" />
                                    <Text style={{color: '#9CA3AF', fontSize: 18, marginTop: 12}}>
                                      {productPickerSearchQuery ? 'No products found' : 'No products available'}
                                    </Text>
                                  </View>
                                );
                              }
                              
                              return (
                                <FlatList
                                  data={filtered}
                                  keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                                  renderItem={({ item }) => {
                                    const isSelected = selectedProductId === item.id;
                                    const stock = item.stock ?? 0;
                                    const isOutOfStock = stock <= 0;
                                    const isLowStock = stock > 0 && stock <= 10;
                                    
                                    // Stock status colors
                                    const stockColor = isOutOfStock ? '#EF4444' : isLowStock ? '#F59E0B' : '#10B981';
                                    const stockBgColor = isOutOfStock ? '#FEE2E2' : isLowStock ? '#FEF3C7' : '#D1FAE5';
                                    
                                    return (
                            <TouchableOpacity
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          padding: 14,
                                          marginBottom: 8,
                                          backgroundColor: isOutOfStock ? '#F9FAFB' : (isSelected ? '#F3F0FF' : '#FAFAFA'),
                                          borderRadius: 10,
                                          borderWidth: 1,
                                          borderColor: isOutOfStock ? '#E5E7EB' : (isSelected ? '#7C3AED' : '#E5E7EB'),
                                          opacity: isOutOfStock ? 0.6 : 1,
                                        }}
                                        onPress={() => {
                                          if (!isOutOfStock) {
                                            setSelectedProductId(item.id);
                                          }
                                        }}
                                        disabled={isOutOfStock}
                                      >
                                        <View style={{flex: 1}}>
                                          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
                                            <Text style={{
                                              fontSize: 18,
                                              fontWeight: '600',
                                              color: isOutOfStock ? '#9CA3AF' : '#1A202C',
                                              flex: 1,
                                            }}>
                                              {item.name}
                                            </Text>
                                            {isOutOfStock && (
                                              <View style={{
                                                backgroundColor: '#FEE2E2',
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderRadius: 4,
                                                marginLeft: 8,
                                              }}>
                                                <Text style={{fontSize: 13, fontWeight: '600', color: '#EF4444'}}>
                                                  OUT OF STOCK
                                                </Text>
                                              </View>
                                            )}
                                          </View>
                                          
                                          <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}>
                                            <Text style={{fontSize: 16, color: isOutOfStock ? '#9CA3AF' : '#6B7280', fontWeight: '500', marginRight: 8}}>
                                              ₱{parseFloat(item.price_each || item.price || 0).toFixed(2)}
                                            </Text>
                                            
                                            {/* Stock Badge */}
                                            <View style={{
                                              backgroundColor: stockBgColor,
                                              paddingHorizontal: 8,
                                              paddingVertical: 4,
                                              borderRadius: 4,
                                              flexDirection: 'row',
                                              alignItems: 'center',
                                              marginRight: 8,
                                            }}>
                                              <Ionicons 
                                                name={isOutOfStock ? 'close-circle' : isLowStock ? 'warning' : 'checkmark-circle'} 
                                                size={12} 
                                                color={stockColor}
                                                style={{marginRight: 4}}
                                              />
                                              <Text style={{
                                                fontSize: 14,
                                                fontWeight: '600',
                                                color: stockColor,
                                              }}>
                                                Stock: {stock}
                                              </Text>
                                            </View>
                                            
                                            {item.category && (
                                              <Text style={{
                                                fontSize: 12,
                                                color: '#9CA3AF',
                                                backgroundColor: '#F3F4F6',
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderRadius: 4,
                                              }}>
                                                {item.category}
                                              </Text>
                                            )}
                                          </View>
                                        </View>
                                        
                                        {!isOutOfStock && isSelected && (
                                          <Ionicons name="checkmark-circle" size={24} color="#7C3AED" style={{marginLeft: 8}} />
                                        )}
                                        {isOutOfStock && (
                                          <Ionicons name="close-circle" size={24} color="#D1D5DB" style={{marginLeft: 8}} />
                                        )}
                                      </TouchableOpacity>
                                    );
                                  }}
                                  showsVerticalScrollIndicator={true}
                                />
                              );
                            })()}
                          </View>

                          {/* Action Buttons */}
                          <View style={{flexDirection: 'row', justifyContent: 'flex-end', width: '100%'}}>
                            <TouchableOpacity
                              style={{
                                paddingVertical: 14,
                                paddingHorizontal: 24,
                                borderRadius: 10,
                                marginRight: 12,
                                backgroundColor: '#F3F4F6',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 100,
                              }}
                              onPress={() => {
                                setProductPickerVisible(false);
                                setProductPickerSearchQuery('');
                                setSelectedProductId(null);
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={{color: '#6B7280', fontWeight: '600', fontSize: 18}}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                backgroundColor: selectedProductId ? '#7C3AED' : '#D1D5DB',
                                borderRadius: 10,
                                paddingVertical: 14,
                                paddingHorizontal: 24,
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 100,
                                shadowColor: selectedProductId ? '#7C3AED' : 'transparent',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 4,
                                elevation: 3,
                              }}
                              disabled={!selectedProductId}
                              onPress={() => {
                                if (selectedProductId && pickerItemIndex !== null) {
                                  const searchLower = productPickerSearchQuery.toLowerCase();
                                  const filtered = Array.isArray(filteredProducts) 
                                    ? filteredProducts.filter(product => 
                                        product.name?.toLowerCase().includes(searchLower) ||
                                        product.category?.toLowerCase().includes(searchLower)
                                      )
                                    : [];
                                  const selectedProduct = filtered.find(p => p.id === selectedProductId);
                                  if (selectedProduct) {
                                    // Check if product is out of stock
                                    const stock = selectedProduct.stock ?? 0;
                                    if (stock <= 0) {
                                      showCustomAlert('Out of Stock', `${selectedProduct.name} is currently out of stock and cannot be selected.`, 'warning');
                                      return;
                                    }
                                    setEditedItems(prevItems => {
                                      const newItems = [...prevItems];
                                      const itemToUpdate = newItems[pickerItemIndex.itemIdx];
                                      if (itemToUpdate) {
                                        const priceValue = selectedProduct.price_each ?? selectedProduct.price ?? 0;
                                        newItems[pickerItemIndex.itemIdx] = {
                                          ...itemToUpdate,
                                          name: selectedProduct.name,
                                          id: selectedProduct.id,
                                          product_id: selectedProduct.id,
                                          inventory_id: selectedProduct.id,
                                          price_each: priceValue,
                                          price: priceValue,
                                        };
                                      }
                                      return newItems;
                                    });
                                  }
                                }
                                setProductPickerVisible(false);
                                setProductPickerSearchQuery('');
                                setSelectedProductId(null);
                                setPickerItemIndex(null);
                              }}
                            >
                              <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18}}>Select</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </Modal>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20}}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: isSaving ? '#9CA3AF' : '#111',
                          paddingVertical: 14,
                          paddingHorizontal: 20,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                          shadowColor: isSaving ? 'transparent' : '#111',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.2,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                        onPress={() => setIsSaveConfirmationVisible(true)}
                        disabled={isSaving}
                        activeOpacity={0.8}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={{color: '#fff', fontWeight: '600', fontSize: 18}}>Save</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: '#E5E7EB',
                          paddingVertical: 14,
                          paddingHorizontal: 20,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() => setIsEditModalVisible(false)}
                        disabled={isSaving}
                        activeOpacity={0.8}
                      >
                        <Text style={{color: '#333', fontWeight: '600', fontSize: 18}}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
              
              {/* Save Confirmation Modal */}
              <Modal
                animationType="fade"
                transparent={true}
                visible={isSaveConfirmationVisible}
                onRequestClose={() => setIsSaveConfirmationVisible(false)}
              >
                <View style={modalStyles.overlay}>
                  <View style={[modalStyles.container, {padding: 24, maxWidth: 340}]}>
                    <View style={{alignItems: 'center', marginBottom: 20}}>
                      <Ionicons name="help-circle" size={48} color="#3B82F6" />
                      <Text style={[modalStyles.title, {marginTop: 16, marginBottom: 8}]}>Confirm Save</Text>
                      <Text style={{fontSize: 18, color: '#667085', textAlign: 'center', lineHeight: 24}}>
                        Are you sure you want to save the changes to this transaction?
                      </Text>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: '#E5E7EB',
                          paddingVertical: 14,
                          paddingHorizontal: 20,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                        onPress={() => setIsSaveConfirmationVisible(false)}
                        disabled={isSaving}
                        activeOpacity={0.8}
                      >
                        <Text style={{color: '#333', fontWeight: '600', fontSize: 18}}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: isSaving ? '#9CA3AF' : '#3B82F6',
                          paddingVertical: 14,
                          paddingHorizontal: 20,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: isSaving ? 'transparent' : '#3B82F6',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.2,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                        onPress={() => {
                          setIsSaveConfirmationVisible(false);
                          updateTransaction();
                        }}
                        disabled={isSaving}
                        activeOpacity={0.8}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={{color: '#fff', fontWeight: '600', fontSize: 18}}>Confirm</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </View>
          </View>
        </Modal>
        
        {/* Additional Payment Modal */}
        <Modal 
          animationType="slide" 
          transparent={true} 
          visible={isAdditionalPaymentModalVisible} 
          onRequestClose={() => setIsAdditionalPaymentModalVisible(false)}
        >
          <View style={modalStyles.overlay}>
            <View style={[modalStyles.container, {padding: 24, maxWidth: 400, width: '90%'}]}>
              <View style={{alignItems: 'center', marginBottom: 20}}>
                <Ionicons name="alert-circle" size={50} color="#F59E0B" />
                <Text style={[modalStyles.title, {marginTop: 12, marginBottom: 8}]}>Additional Payment Required</Text>
                <Text style={{fontSize: 18, color: '#666', textAlign: 'center', marginBottom: 8}}>
                  The updated product price exceeds the previous cash tendered.
                </Text>
                <Text style={{fontSize: 20, color: '#7C3AED', fontWeight: 'bold', marginTop: 8}}>
                  Balance Due: ₱{balanceDue.toFixed(2)}
                </Text>
              </View>
              
              <View style={{marginBottom: 20}}>
                <Text style={{fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8}}>
                  Enter Additional Payment Amount:
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 18,
                    backgroundColor: '#F9FAFB',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#111'
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  value={additionalPaymentAmount}
                  onChangeText={(text) => {
                    // Allow only numbers and one decimal point
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    // Ensure only one decimal point
                    const parts = cleaned.split('.');
                    if (parts.length > 2) {
                      setAdditionalPaymentAmount(parts[0] + '.' + parts.slice(1).join(''));
                    } else {
                      setAdditionalPaymentAmount(cleaned);
                    }
                  }}
                  keyboardType="decimal-pad"
                  autoFocus={true}
                />
                {additionalPaymentAmount && parseFloat(additionalPaymentAmount) < balanceDue && (
                  <Text style={{fontSize: 14, color: '#EF4444', marginTop: 6}}>
                    Minimum payment: ₱{balanceDue.toFixed(2)}
                  </Text>
                )}
              </View>
              
              <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#E5E7EB',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                  onPress={() => {
                    setIsAdditionalPaymentModalVisible(false);
                    setAdditionalPaymentAmount('');
                    setBalanceDue(0);
                  }}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  <Text style={{color: '#333', fontWeight: '600', fontSize: 18}}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: isSaving || !additionalPaymentAmount || parseFloat(additionalPaymentAmount) < balanceDue ? '#9CA3AF' : '#7C3AED',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: (isSaving || !additionalPaymentAmount || parseFloat(additionalPaymentAmount) < balanceDue) ? 'transparent' : '#7C3AED',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                  onPress={() => {
                    const amount = parseFloat(additionalPaymentAmount);
                    if (!amount || amount < balanceDue) {
                      showCustomAlert('Invalid Amount', `Please enter at least ₱${balanceDue.toFixed(2)}`, 'warning');
                      return;
                    }
                    updateTransaction(amount);
                  }}
                  disabled={isSaving || !additionalPaymentAmount || parseFloat(additionalPaymentAmount) < balanceDue}
                  activeOpacity={0.8}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{color: '#fff', fontWeight: '600', fontSize: 18}}>Add Payment</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        </>
      );
    };

    // Helper function to parse date string to Date object
    const parseTransactionDate = (dateStr) => {
      if (!dateStr) return null;
      
      // If already a Date object, return it
      if (dateStr instanceof Date) {
        return isNaN(dateStr.getTime()) ? null : dateStr;
      }
      
      // If not a string, return null
      if (typeof dateStr !== 'string') {
        return null;
      }
      
      // Try multiple date formats
      // Format 1: MySQL datetime format "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM"
      const mysqlFormat = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
      if (mysqlFormat) {
        const [, year, month, day, hour = '0', minute = '0', second = '0'] = mysqlFormat;
        const date = new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1, // Month is 0-indexed
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        );
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Format 2: ISO format "YYYY-MM-DDTHH:MM:SS" or with timezone
      let date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Format 3: Try replacing space with T for ISO format
      date = new Date(dateStr.replace(' ', 'T'));
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Format 4: Try with timezone offset
      date = new Date(dateStr + 'Z');
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      return null;
    };
    
    const filteredTransactions = previousTransactions.filter(tx => {
      // If no filters are set, show all transactions
      if (!startDate && !endDate) return true;
      
      // Parse transaction date
      const txDate = parseTransactionDate(tx.date);
      if (!txDate) {
        console.warn('Could not parse transaction date:', tx.date, 'Transaction ID:', tx.id);
        return false; // Skip transactions with invalid dates
      }
      
      // Get date components (year, month, day) for comparison
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();
      const txDay = txDate.getDate();
      
      // Compare with start date
      if (startDate) {
        const start = new Date(startDate);
        // Reset time to beginning of day to ensure we include all transactions on that day
        start.setHours(0, 0, 0, 0);
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        const startDay = start.getDate();
        
        // Transaction date must be >= start date
        if (txYear < startYear) {
          return false;
        }
        if (txYear === startYear && txMonth < startMonth) {
          return false;
        }
        if (txYear === startYear && txMonth === startMonth && txDay < startDay) {
          return false;
        }
      }
      
      // Compare with end date
      if (endDate) {
        const end = new Date(endDate);
        // Reset time to end of day to ensure we include all transactions on that day
        end.setHours(23, 59, 59, 999);
        const endYear = end.getFullYear();
        const endMonth = end.getMonth();
        const endDay = end.getDate();
        
        // Transaction date must be <= end date
        if (txYear > endYear) {
          return false;
        }
        if (txYear === endYear && txMonth > endMonth) {
          return false;
        }
        if (txYear === endYear && txMonth === endMonth && txDay > endDay) {
          return false;
        }
      }
      
      return true;
    });

    const modalStyles = StyleSheet.create({
      overlay: { flex: 1, backgroundColor: 'rgba(55,53,62,0.55)', justifyContent: 'center', alignItems: 'center' },
      container: { backgroundColor: '#fff', borderRadius: 18, paddingVertical: 32, paddingHorizontal: 20, width: '88%', maxHeight: '75%', shadowColor: '#37353E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12, alignItems: 'center' },
      title: { fontSize: 28, fontWeight: 'bold', color: '#37353E', marginBottom: 18, textAlign: 'center', letterSpacing: 0.5 },
      filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, width: '100%' },
      filterButton: { flex: 1, marginHorizontal: 6, paddingVertical: 10, backgroundColor: '#F3F0FF', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
      filterText: { fontSize: 17, color: '#37353E', fontWeight: '500' },
      scrollView: { maxHeight: 320, width: '100%', marginBottom: 8 },
      transactionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F3F0FF' },
      transactionDate: { fontSize: 18, color: '#37353E', fontWeight: '500' },
      transactionAmount: { fontSize: 20, color: '#7C3AED', fontWeight: 'bold' },
      emptyText: { textAlign: 'center', color: '#888', fontSize: 18, marginVertical: 24 },
      errorText: { color: '#B00020', textAlign: 'center', fontSize: 18, marginVertical: 18 },
      closeButton: { marginTop: 22, alignSelf: 'center', backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 36, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 4 },
      closeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 20, letterSpacing: 0.5 },
    });

    return (
      <Modal animationType="fade" transparent={true} visible={isVisible} onRequestClose={onClose}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <Text style={modalStyles.title}>{t.transactions}</Text>
            <View style={modalStyles.filterRow}>
              <TouchableOpacity onPress={() => setShowStartPicker(true)} style={modalStyles.filterButton}>
                <Text style={modalStyles.filterText}>{language === 'en' ? 'Start Date' : 'Simula ng Petsa'}: {startDate ? startDate.toLocaleDateString() : (language === 'en' ? 'Select' : 'Pumili')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowEndPicker(true)} style={modalStyles.filterButton}>
                <Text style={modalStyles.filterText}>{language === 'en' ? 'End Date' : 'Wakas ng Petsa'}: {endDate ? endDate.toLocaleDateString() : (language === 'en' ? 'Select' : 'Pumili')}</Text>
              </TouchableOpacity>
            </View>
            {(startDate || endDate) && (
              <TouchableOpacity 
                onPress={() => {
                  setStartDate(null);
                  setEndDate(null);
                }}
                style={[modalStyles.filterButton, { marginTop: 8, backgroundColor: '#FF3B30' }]}
              >
                <Text style={[modalStyles.filterText, { color: '#fff' }]}>
                  {language === 'en' ? 'Clear Filter' : 'Linisin ang Filter'}
                </Text>
              </TouchableOpacity>
            )}
            {showStartPicker && (
              <DateTimePicker value={startDate || new Date()} mode="date" display="default" onChange={(event, date) => { setShowStartPicker(false); if (date) setStartDate(date); }} />
            )}
            {showEndPicker && (
              <DateTimePicker value={endDate || new Date()} mode="date" display="default" onChange={(event, date) => { setShowEndPicker(false); if (date) setEndDate(date); }} />
            )}
            {isLoading ? (
              <ActivityIndicator size="large" color="#7C3AED" style={{ marginVertical: 32 }} />
            ) : error ? (
              <Text style={modalStyles.errorText}>{error}</Text>
            ) : filteredTransactions.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 20 }}>
                <Text style={modalStyles.emptyText}>
                  {(startDate || endDate)
                    ? (language === 'en' 
                        ? 'No transactions found for the selected date range.' 
                        : 'Walang nahanap na transaksyon para sa napiling saklaw ng petsa.')
                    : t.noTransactions}
                </Text>
                {(startDate || endDate) && (
                  <Text style={[modalStyles.emptyText, { fontSize: 14, marginTop: 8, color: '#888' }]}>
                    {language === 'en'
                      ? `Start: ${startDate ? startDate.toLocaleDateString() : 'None'} | End: ${endDate ? endDate.toLocaleDateString() : 'None'}`
                      : `Simula: ${startDate ? startDate.toLocaleDateString() : 'Wala'} | Wakas: ${endDate ? endDate.toLocaleDateString() : 'Wala'}`}
                  </Text>
                )}
              </View>
            ) : (
              <ScrollView style={modalStyles.scrollView}>
                {filteredTransactions.map(tx => (
                  <TouchableOpacity key={tx.id} style={modalStyles.transactionRow} activeOpacity={0.7} onPress={() => setSelectedTx(tx)}>
                    <Text style={modalStyles.transactionDate}>Date: {tx.date ? formatTime(tx.date) : 'N/A'}</Text>
                    <Text style={modalStyles.transactionAmount}>₱{tx.total ? Number(tx.total).toFixed(2) : '0.00'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {renderDetailsModal()}
            <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}>
              <Text style={modalStyles.closeButtonText}>{t.close}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
      <View style={[styles.wrapper, isLandscape && styles.landscapeWrapper]}>
        {/* Left Panel - Scanner */}
        <View 
          style={[styles.leftPanel, isLandscape && styles.landscapeLeftPanel]}
        >
          <View style={styles.scanHereContainer}>
            <Text style={styles.scanHereText}>{language === 'en' ? 'SCAN HERE' : 'MAG-SCAN DITO'}</Text>
          </View>

          <View style={styles.scannerBox} ref={walkthroughTargets.scanner}>
            <CameraComponent
              isActive={isCameraActive}
              onBarcodeScanned={handleBarcodeScanned}
              cameraType={cameraType}
              scanned={scanned}
              styles={styles}
              language={language}
            />
          </View>

          <View style={styles.cameraControls}>
            <View style={styles.cameraToggle}>
              <Text style={styles.cameraToggleText}>{language === 'en' ? 'Camera' : 'Camera'}</Text>
              <Switch
                value={isCameraActive}
                onValueChange={setIsCameraActive}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={isCameraActive ? '#f5dd4b' : '#f4f3f4'}
              />
            </View>
            <TouchableOpacity
              style={styles.flipCameraButton}
              onPress={() => setCameraType(current => (current === 'back' ? 'front' : 'back'))}
            >
              <Ionicons name="camera-reverse" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.buttonsContainer}>
            <View style={styles.settingsContainer}>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={handleSettingsPress}
                accessibilityLabel="Settings"
                activeOpacity={0.7}
              >
                <Animated.View style={{
                  transform: [{
                    rotate: settingsRotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    })
                  }],
                }}>
                  <Ionicons name="settings-outline" size={28} color="#344054" />
                </Animated.View>
                {showSettingsLabel && (
                  <Animated.Text style={styles.settingsButtonText}>
                    {language === 'en' ? 'Settings' : 'Mga Setting'}
                  </Animated.Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.transactionsContainer} pointerEvents="box-none"> 
              <TouchableOpacity
                style={styles.transactionsButton}
                onPress={() => setIsTransactionsModalVisible(true)}
                accessibilityLabel="Previous Transactions"
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="list-outline" size={28} color="#7C3AED" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomContentContainer}>
            <View style={styles.logoContainer}>
              <Image source={require('../assets/logo3.png')} style={styles.logo} />
            </View>
          </View>
        </View>

        {/* Middle Panel - Cart and Totals */}
        <View 
          style={[styles.middlePanel, isLandscape && styles.landscapeMiddlePanel]}
        >
          <View ref={walkthroughTargets.cart} style={{ flex: 1 }}>
          <ScrollView 
            style={styles.itemsListContainer}
            contentContainerStyle={scannedItems.length === 0 ? styles.emptyCartScrollView : {}}
          >
            {scannedItems.length > 0 ? (
                scannedItems.map((item) => (
                  <View key={item.id} style={styles.scannedItem}>
                    <View style={styles.scannedItemInfo}>
                      <Text style={styles.scannedItemName} numberOfLines={1}>{item.product.name}</Text>
                      <View style={styles.scannedItemDetails}>
                        <Text style={styles.scannedItemPrice}>
                          {t.quantity}: {item.qty}
                          {(() => {
                            const originalPrice = parseFloat(item.product.price);
                            const sellPrice = item.sellPrice !== undefined ? parseFloat(item.sellPrice) : originalPrice;
                            const itemTotal = item.itemTotal !== undefined ? parseFloat(item.itemTotal) : (sellPrice * item.qty);
                            const originalTotal = originalPrice * item.qty;
                            const discountAmount = originalTotal - itemTotal;
                            return discountAmount > 0 ? ` | ${t.discount}: -₱${discountAmount.toFixed(2)}` : '';
                          })()}
                        </Text>
                        <View style={styles.discountInputContainer}>
                          <Text style={styles.discountLabel}>{language === 'en' ? 'Item Total' : 'Kabuuang presyo'}:</Text>
                          <TextInput
                            style={styles.discountInput}
                            value={focusedItemTotalId === item.id ? (item.itemTotal !== undefined ? String(item.itemTotal) : '') : String((item.itemTotal !== undefined ? item.itemTotal : (item.sellPrice !== undefined ? parseFloat(item.sellPrice) * item.qty : parseFloat(item.product.price) * item.qty)).toFixed(2))}
                            keyboardType="numeric"
                            onChangeText={(text) => updateItemTotal(item.id, text)}
                            onFocus={() => {
                              setFocusedItemTotalId(item.id);
                              // Temporarily clear to allow fresh typing
                              if (item.itemTotal !== undefined) {
                                setScannedItems(prevItems =>
                                  prevItems.map(prevItem =>
                                    prevItem.id === item.id ? { ...prevItem, itemTotal: undefined } : prevItem
                                  )
                                );
                              }
                            }}
                            onBlur={() => {
                              setFocusedItemTotalId(null);
                              // Restore to calculated total if empty or invalid
                              setScannedItems(prevItems =>
                                prevItems.map(prevItem => {
                                  if (prevItem.id === item.id) {
                                    const currentSellPrice = prevItem.sellPrice !== undefined ? parseFloat(prevItem.sellPrice) : parseFloat(prevItem.product.price);
                                    const calculatedTotal = currentSellPrice * prevItem.qty;
                                    if (prevItem.itemTotal === undefined || isNaN(parseFloat(prevItem.itemTotal)) || parseFloat(prevItem.itemTotal) < 0) {
                                      return { ...prevItem, itemTotal: undefined, sellPrice: prevItem.product.price };
                                    }
                                  }
                                  return prevItem;
                                })
                              );
                            }}
                            placeholder={String((parseFloat(item.product.price) * item.qty).toFixed(2))}
                          />
                        </View>
                        {(() => {
                          const sellPrice = item.sellPrice !== undefined ? parseFloat(item.sellPrice) : parseFloat(item.product.price);
                          const originalPrice = parseFloat(item.product.price);
                          const costPrice = parseFloat(item.product.cost_price || item.product.costPrice || 0);
                          const profit = (sellPrice - costPrice) * item.qty;
                          const discountPercent = item.sellPrice !== undefined && item.sellPrice !== originalPrice
                            ? ((originalPrice - sellPrice) / originalPrice) * 100
                            : 0;
                          return (
                            <View>
                              {discountPercent > 0 && (
                                <Text style={{ fontSize: 12, color: '#F59E0B', marginTop: 4, fontWeight: '600' }}>
                                  Discount: {discountPercent.toFixed(2)}%
                                </Text>
                              )}
                              <Text style={{ fontSize: 12, color: profit >= 0 ? '#4CAF50' : '#F44336', marginTop: 4 }}>
                                Profit: ₱{profit.toFixed(2)}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                    </View>
                    <Text style={styles.scannedItemTotal}>
                      ₱{(item.itemTotal !== undefined ? parseFloat(item.itemTotal) : ((item.sellPrice !== undefined ? parseFloat(item.sellPrice) : parseFloat(item.product.price)) * item.qty)).toFixed(2)}
                    </Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeItem(item.id)}
                    >
                      <Ionicons name="close" size={16} color="#B00020" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCartContainer}>
                  <Ionicons name="cart-outline" size={64} color="#e0e0e0" />
                  <Text style={styles.emptyCartText}>Your Cart is Empty</Text>
                </View>
              )}
          </ScrollView>
          </View>

          {/* Totals and Payment Section */}
          <View>
            <View>
              <View style={styles.section}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Items:</Text>
                  <Text style={styles.totalValue}>{totalQty}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal:</Text>
                  <Text style={styles.totalValue}>₱{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Profit:</Text>
                  <Text style={[styles.totalValue, { color: totalProfit >= 0 ? '#4CAF50' : '#F44336', fontWeight: '600' }]}>
                    ₱{totalProfit.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.totalRow, styles.grandTotal]}>
                  <Text style={[styles.totalLabel, {fontWeight: 'bold', fontSize: 18, color: '#1A202C'}]}>Total:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 0 }}>
                  <TextInput
                      style={[styles.discountInput, { 
                        fontWeight: 'bold', 
                        fontSize: 20, 
                        color: '#1A202C',
                        textAlign: 'right',
                        minWidth: 100,
                        borderWidth: editableTotal !== '' && editableTotal !== String(calculatedTotal.toFixed(2)) ? 1 : 0,
                        borderColor: '#4CAF50',
                        borderRadius: 4,
                        paddingHorizontal: 4
                      }]}
                      value={isTotalFocused ? editableTotal : (editableTotal !== '' ? editableTotal : String(total.toFixed(2)))}
                    keyboardType="numeric"
                    onChangeText={(text) => {
                      // Always replace the value, never append
                      const cleanedText = text.replace(/[^0-9.]/g, '');
                        if (cleanedText.split('.').length > 2) {
                          return;
                        }
                        setEditableTotal(cleanedText);
                        
                        // Clear error on input (total can now exceed subtotal)
                        if (cleanedText === '' || isNaN(parseFloat(cleanedText))) {
                          setTotalError('');
                        } else {
                          setTotalError('');
                        }
                      }}
                      onFocus={() => {
                        // Clear the field when user focuses so they can type fresh
                        setIsTotalFocused(true);
                        setEditableTotal('');
                      }}
                      onBlur={() => {
                        setIsTotalFocused(false);
                        const enteredValue = parseFloat(editableTotal);
                        // Reset to calculated total if empty or invalid (total can now exceed subtotal)
                        if (editableTotal === '' || isNaN(enteredValue) || enteredValue < 0) {
                          setEditableTotal('');
                          setTotalError('');
                        }
                      }}
                      placeholder={String(calculatedTotal.toFixed(2))}
                  />
                </View>
                </View>
                {totalError !== '' && (
                  <Text style={{ color: '#B00020', fontSize: 12, marginTop: 4, textAlign: 'right' }}>{totalError}</Text>
                )}
              </View>

              <View ref={walkthroughTargets.payment}>
                <View style={styles.section}>
                <Text style={styles.cashLabel}>{language === 'en' ? 'Cash Tendered' : 'Perang Ibinayad'}</Text>
                <Animated.View style={[{ transform: [{ translateX: cashShake }] }]}>
                  <TextInput
                    style={styles.cashInput}
                    placeholder={language === 'en' ? 'Enter cash amount' : 'Ilagay ang halaga ng pera'}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={cashTendered}
                    onChangeText={(text) => {
                      const cleanedText = text.replace(/[^0-9.]/g, '');
                      if (cleanedText.split('.').length > 2) {
                        return;
                      }
                      setCashTendered(cleanedText);
                      if (cashError) setCashError('');
                    }}
                    ref={cashInputRef}
                  />
                </Animated.View>
                {!!cashError && (
                  <Text style={{ color: '#B00020', fontSize: 12, marginTop: 4, textAlign: 'right' }}>{cashError}</Text>
                )}
                {cashTendered !== '' && (
                  <Text style={[
                    styles.changeText,
                    change < 0 && { color: '#B00020' }
                  ]}>
                    {language === 'en' ? 'Change' : 'Sukli'}: ₱{Math.abs(change).toFixed(2)}
                    {change < 0 && (language === 'en' ? ' (Insufficient)' : ' (Kulang)')}
                  </Text>
                )}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.finishButton,
                    (isLoading || scannedItems.length === 0) && { backgroundColor: '#A0AEC0', shadowColor: 'transparent' }
                  ]}
                  onPress={handleCompletePurchase}
                  disabled={isLoading || scannedItems.length === 0}
                >
                  <Ionicons name="checkmark-done" size={22} color="#fff" />
                  <Text style={styles.finishButtonText}>{t.checkout}</Text>
                </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Right Panel - Search, Results, and Add Item */}
        <View 
          style={[styles.rightPanel, isLandscape && styles.landscapeRightPanel]}
        >
          <View style={styles.searchAndControlsContainer}>
            <View style={styles.searchContainer} ref={walkthroughTargets.search}>
              <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={language === 'en' ? 'Search Products...' : 'Maghanap ng Produkto...'}
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  if (text.trim() === '') {
                    fetchProducts('');
                  }
                }}
                returnKeyType="search"
                onSubmitEditing={() => fetchProducts(searchQuery)}
                blurOnSubmit={true}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            {selectedProduct && (
              <View style={styles.selectedProductContainer}>
                <View style={styles.selectedProductHeader}>
                  <Ionicons name="pricetag-outline" size={18} color="#5E35B1" />
                  <Text style={styles.selectedProductTitle}>{language === 'en' ? 'Selected Item' : 'Napiling Item'}</Text>
                </View>
                <Text style={styles.selectedProductName} numberOfLines={2}>{selectedProduct.name}</Text>
                <View style={styles.selectedProductDetailsRow}>
                  <Text style={styles.selectedProductPrice}>₱{parseFloat(selectedProduct.price).toFixed(2)}</Text>
                  <Text style={styles.selectedProductStock}>{language === 'en' ? 'Stock' : 'Stock'}: {selectedProduct.stock}</Text>
                </View>
              </View>
            )}

            <View style={styles.qtyControls}>
              <Text style={styles.qtyLabel}>{t.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => setQty(prev => Math.max(1, prev - 1))}
              >
                <Ionicons name="remove" size={16} color="#333" />
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInput}
                value={String(qty)}
                keyboardType="numeric"
                onChangeText={(text) => {
                  const val = text.replace(/[^0-9]/g, '');
                  setQty(val === '' ? 1 : Math.max(1, parseInt(val, 10)));
                }}
              />
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => setQty(prev => prev + 1)}
              >
                <Ionicons name="add" size={16} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>{language === 'en' ? 'Search Results' : 'Mga Resulta'} ({filteredProducts.length})</Text>
          </View>
          <View style={styles.searchResultsContainer}>
            {isSearching ? (
            <ActivityIndicator size="small" color="#C5BAFF" />
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.productItem, selectedProduct?.id === item.id && {backgroundColor: '#E5E7EB', borderColor: '#D1D5DB', borderWidth: 1}]}
                  onPress={() => {
                    if (item.stock <= 0) {
                      showCustomAlert(
                        language === 'en' ? 'Out of Stock' : 'Walang Stock',
                        language === 'en' 
                          ? `${item.name} is currently out of stock and cannot be selected.`
                          : `Ang ${item.name} ay kasalukuyang walang stock at hindi maaaring piliin.`,
                        'warning'
                      );
                    } else {
                      setSelectedProduct(item);
                    }
                  }}
                >
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.productStockList}>{language === 'en' ? 'Stock' : 'Stock'}: {item.stock}</Text>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
            />
          )}
          </View>

          <View style={styles.rightActionButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setSelectedProduct(null)}
            >
              <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
              <Text style={[styles.buttonText, {color: '#DC2626'}]}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, {flex: 1}, !selectedProduct && { backgroundColor: '#A0AEC0' }, selectedProduct?.stock === 0 && { backgroundColor: '#A0AEC0' }]}
              onPress={() => {
                if (selectedProduct) {
                  addScannedItem(selectedProduct, selectedProduct.id, 'manual');
                } else {
                  showCustomAlert(
                    language === 'en' ? 'No Product Selected' : 'Walang Napiling Produkto',
                    language === 'en' ? 'Please scan or select a product first' : 'Mangyaring mag-scan o pumili ng produkto muna',
                    'info'
                  );
                }
              }}
              disabled={!selectedProduct || selectedProduct?.stock === 0}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.buttonText}>{t.addToCart}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {renderLoadingModal()}
      {/* Inline toast-like notifier */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 8,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: notifyAnim,
          transform: [{
            translateY: notifyAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] })
          }]
        }}
      >
        <Text style={{
          backgroundColor: 'rgba(0,0,0,0.85)',
          color: '#FFFFFF',
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 16,
          overflow: 'hidden',
          fontWeight: '600'
        }}>{notifyMsg}</Text>
      </Animated.View>
      </View>
      {renderCustomAlert()}
      {renderReceiptModal()}
      {renderConfirmationModal()}
      {renderNegativeProfitModal()}
      {renderSettingsModal()}
      {renderLogoutConfirmationModal()}
      {renderWalkthroughModal()}
      <RenderTransactionsModal
        isVisible={isTransactionsModalVisible}
        onClose={() => setIsTransactionsModalVisible(false)}
        previousTransactions={previousTransactions}
        isLoading={isTransactionsLoading}
        error={transactionsError}
        filteredProducts={filteredProducts}
        userId={userId}
        onTransactionUpdated={fetchPreviousTransactions}
      />
    </SafeAreaView>
  );
}

const getStyles = (isLandscape, width, height) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFBFB',
  },
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f0f2f5', // A slightly off-white background for the whole app
    padding: 8,
  },
  landscapeWrapper: {
    flexDirection: 'row',
  },
  leftPanel: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flex: 0.8, // Scanner panel
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  landscapeLeftPanel: {
    flex: 0.8,
  },
  middlePanel: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flex: 1.2, // Cart panel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  landscapeMiddlePanel: {
    flex: 1.2,
  },
  rightPanel: {
    flex: 1, // Search panel
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginLeft: 8,
    minHeight: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  landscapeRightPanel: {
    flex: 1,
  },
  searchAndControlsContainer: {
    paddingBottom: 12,
  },
  searchResultsContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  scanHereContainer: {
    backgroundColor: '#1A202C', // Darker, more modern shade
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanHereText: {
    color: '#fff',
    fontWeight: '700', // Bolder
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 1,
  },
  scannerBox: {
    width: '100%',
    aspectRatio: 1, // This makes the height equal to the width, creating a square
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#D1C4E9', // Softer purple
  },
  cameraView: {
    flex: 1,
  },
  cameraOffOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  cameraOffText: {
    marginTop: 8,
    fontSize: 18,
    color: '#667085',
  },
  cameraOffLogo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f7f7f9',
    borderRadius: 8,
    padding: 6,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  cameraToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraToggleText: {
    marginRight: 8,
    fontSize: 18,
    fontWeight: '500',
    color: '#344054',
  },
  flipCameraButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedProductContainer: {
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D1C4E9',
  },
  selectedProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedProductTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5E35B1',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  selectedProductName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  selectedProductDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedProductPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#5E35B1',
  },
  selectedProductStock: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f7f7f9',
    borderRadius: 8,
    padding: 8,
  },
  qtyLabel: {
    marginRight: 'auto',
    fontSize: 18,
    fontWeight: '500',
    color: '#344054',
  },
  qtyButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qtyInput: {
    width: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 8,
    marginHorizontal: 8,
    textAlign: 'center',
    fontSize: 18,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    color: '#344054',
  },
  itemsListContainer: {
    flex: 1,
    marginBottom: 12,
    backgroundColor: '#f7f7f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productName: {
    flex: 1,
    color: '#344054',
    fontWeight: '500',
    fontSize: 17,
  },
  productStockList: {
    color: '#667085',
    fontSize: 16,
  },
  rightActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    flex: 0.5,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  addButton: {
    backgroundColor: '#10B981', // A modern green
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 8,
  },
  finishButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
    marginLeft: 12,
  },
  finishButton: {
      flex: 1,
    backgroundColor: '#000000',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scannedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  scannedItemInfo: {
    flex: 1,
  },
  scannedItemName: {
    fontWeight: '600',
    color: '#344054',
    fontSize: 18,
  },
  scannedItemDetails: {
    marginTop: 6,
  },
  scannedItemPrice: {
    color: '#667085',
    fontSize: 16,
  },
  discountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  discountLabel: {
    fontSize: 16,
    color: '#667085',
    marginRight: 6,
  },
  discountInput: {
    width: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  discountPercent: {
    fontSize: 16,
    color: '#667085',
    marginLeft: 4,
  },
  scannedItemTotal: {
    fontWeight: 'bold',
    color: '#1A202C',
    marginHorizontal: 10,
    fontSize: 18,
  },
  removeButton: {
    padding: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
  },
  emptyCartScrollView: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCartText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 18,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    color: '#667085',
    fontSize: 17,
  },
  totalValue: {
    fontWeight: '600',
    color: '#344054',
    fontSize: 17,
  },
  cashLabel: {
    marginBottom: 8,
    color: '#667085',
    fontSize: 17,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 18,
  },
  changeText: {
    marginTop: 8,
    textAlign: 'right',
    color: '#344054',
    fontWeight: 'bold',
    fontSize: 17,
  },
  bottomContentContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
    opacity: 0.8,
  },

  // Logout Confirmation Modal
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalContainer: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutModalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  logoutModalText: {
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLogoutButton: {
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  confirmLogoutButton: {
    backgroundColor: '#D94848',
    marginLeft: 8,
  },
  logoutModalButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  // Walkthrough Modal Styles
  walkthroughOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  walkthroughHighlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderColor: '#7C3AED',
    borderWidth: 3,
    borderRadius: 16,
    borderStyle: 'solid',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  walkthroughContainer: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 15,
    minWidth: 280,
  },
  walkthroughArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderColor: 'transparent',
    borderStyle: 'solid',
    zIndex: 1,
  },
  walkthroughIconContainer: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  walkthroughProgressContainer: {
    width: '100%',
    marginBottom: 16,
    alignItems: 'center',
  },
  walkthroughProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  walkthroughProgressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
  walkthroughProgressText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  walkthroughTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  walkthroughDescription: {
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 20,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  walkthroughActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  walkthroughSkipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkthroughSkipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  walkthroughNextButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  walkthroughNextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  // Receipt Modal Styles
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  receiptHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
    marginBottom: 15,
  },
  receiptTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  receiptDate: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  receiptSection: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  receiptSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  receiptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  receiptItemQty: {
    fontSize: 17,
    color: '#888',
    marginRight: 10,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 17,
    color: '#333',
  },
  receiptItemTotal: {
    fontSize: 17,
    fontWeight: '500',
    color: '#333',
    marginLeft: 10,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 18,
    color: '#666',
  },
  receiptTotalValue: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  receiptGrandTotal: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  receiptGrandTotalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptGrandTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptFooter: {
    textAlign: 'center',
    fontSize: 16,
    color: '#888',
    marginTop: 10,
  },
  receiptCloseButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 15,
    marginTop: 20,
    alignItems: 'center',
  },
  receiptCloseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Logout Confirmation Modal
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalContainer: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutModalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  logoutModalText: {
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLogoutButton: {
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  confirmLogoutButton: {
    backgroundColor: '#D94848',
    marginLeft: 8,
  },
  logoutModalButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  // Walkthrough Modal Styles
  walkthroughOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  walkthroughHighlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderColor: '#7C3AED',
    borderWidth: 3,
    borderRadius: 16,
    borderStyle: 'solid',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  walkthroughContainer: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 15,
    minWidth: 280,
  },
  walkthroughArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderColor: 'transparent',
    borderStyle: 'solid',
    zIndex: 1,
  },
  walkthroughIconContainer: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  walkthroughProgressContainer: {
    width: '100%',
    marginBottom: 16,
    alignItems: 'center',
  },
  walkthroughProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  walkthroughProgressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
  walkthroughProgressText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  walkthroughTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  walkthroughDescription: {
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 20,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  walkthroughActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  walkthroughSkipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkthroughSkipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  walkthroughNextButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  walkthroughNextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  // Receipt Modal Styles
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  receiptHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
    marginBottom: 15,
  },
  receiptTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  receiptDate: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  receiptSection: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  receiptSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  receiptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  receiptItemQty: {
    fontSize: 17,
    color: '#888',
    marginRight: 10,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 17,
    color: '#333',
  },
  receiptItemTotal: {
    fontSize: 17,
    fontWeight: '500',
    color: '#333',
    marginLeft: 10,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 18,
    color: '#666',
  },
  receiptTotalValue: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  receiptGrandTotal: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  receiptGrandTotalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptGrandTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptFooter: {
    textAlign: 'center',
    fontSize: 16,
    color: '#888',
    marginTop: 10,
  },
  receiptCloseButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 15,
    marginTop: 20,
    alignItems: 'center',
  },
  receiptCloseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Logout Confirmation Modal
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalContainer: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutModalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  logoutModalText: {
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLogoutButton: {
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  confirmLogoutButton: {
    backgroundColor: '#D94848',
    marginLeft: 8,
  },
  logoutModalButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  // Walkthrough Modal Styles
  walkthroughOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  walkthroughHighlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderColor: '#7C3AED',
    borderWidth: 3,
    borderRadius: 16,
    borderStyle: 'solid',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  walkthroughContainer: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 15,
    minWidth: 280,
  },
  walkthroughArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderColor: 'transparent',
    borderStyle: 'solid',
    zIndex: 1,
  },
  walkthroughIconContainer: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  walkthroughProgressContainer: {
    width: '100%',
    marginBottom: 16,
    alignItems: 'center',
  },
  walkthroughProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  walkthroughProgressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
  walkthroughProgressText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  walkthroughTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  walkthroughDescription: {
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 20,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  walkthroughActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  walkthroughSkipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkthroughSkipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  walkthroughNextButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  walkthroughNextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  // Receipt Modal Styles
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  receiptHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
    marginBottom: 15,
  },
  receiptTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  receiptDate: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  receiptSection: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  receiptSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  receiptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  receiptItemQty: {
    fontSize: 17,
    color: '#888',
    marginRight: 10,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 17,
    color: '#333',
  },
  receiptItemTotal: {
    fontSize: 17,
    fontWeight: '500',
    color: '#333',
    marginLeft: 10,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 18,
    color: '#666',
  },
  receiptTotalValue: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  receiptGrandTotal: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  receiptGrandTotalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptGrandTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptFooter: {
    textAlign: 'center',
    fontSize: 16,
    color: '#888',
    marginTop: 10,
  },
  receiptCloseButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 15,
    marginTop: 20,
    alignItems: 'center',
  },
  receiptCloseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Logout Confirmation Modal
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalContainer: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutModalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  logoutModalText: {
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLogoutButton: {
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  confirmLogoutButton: {
    backgroundColor: '#D94848',
    marginLeft: 8,
  },
  logoutModalButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  // Walkthrough Modal Styles
  walkthroughOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  walkthroughHighlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderColor: '#7C3AED',
    borderWidth: 3,
    borderRadius: 16,
    borderStyle: 'solid',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  walkthroughContainer: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 15,
    minWidth: 280,
  },
  walkthroughArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderColor: 'transparent',
    borderStyle: 'solid',
    zIndex: 1,
  },
  walkthroughIconContainer: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  walkthroughProgressContainer: {
    width: '100%',
    marginBottom: 16,
    alignItems: 'center',
  },
  walkthroughProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  walkthroughProgressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
  walkthroughProgressText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  walkthroughTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  walkthroughDescription: {
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 20,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  walkthroughActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  walkthroughSkipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkthroughSkipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  walkthroughNextButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  walkthroughNextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  settingsContainer: {
    alignItems: 'center',
    marginBottom: 0,
    marginRight: 0,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingsButtonText: {
    color: '#344054',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 12,
  },
  transactionsContainer: {
    alignItems: 'center',
    marginBottom: 0,
    marginRight: 0,
    marginLeft: 'auto',
  },
  transactionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  transactionsButtonText: {
    color: '#7C3AED',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsModalContainer: {
    width: '90%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsModalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsModalCloseButton: {
    padding: 5,
  },
  settingsModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
    marginLeft: 8,
    position: 'relative',
    overflow: 'visible',
  },
  settingsModalButtonTextBox: {
    marginLeft: 12,
    flex: 1,
  },
  settingsModalButtonSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingsLogoutButton: {
    backgroundColor: '#FEE2E2',
    justifyContent: 'flex-start',
  },
  // Loading Modal Styles
  loadingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  loadingSpinnerContainer: {
    marginBottom: 24,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingModalSubtitle: {
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  loadingProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingProgressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  // Custom Alert Modal Styles
  customAlertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customAlertContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  customAlertIconContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAlertTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 12,
    textAlign: 'center',
  },
  customAlertMessage: {
    fontSize: 18,
    color: '#667085',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  customAlertButton: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customAlertButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});