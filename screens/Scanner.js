import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Switch,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  Vibration,
  LogBox,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { API_URL as API_BASE_URL } from '../utils/config';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'useInsertionEffect must not schedule updates',
]);

const { width, height } = Dimensions.get('window');
const isLandscape = width > height;

const CameraComponent = ({ isActive, onBarcodeScanned, cameraType, scanned }) => {
  if (!isActive) {
    return (
      <View style={styles.cameraOffOverlay}>
        <Ionicons name="scan-outline" size={100} color="#999" />
        <Text style={styles.cameraOffText}>Camera is OFF</Text>
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
    />
  );
};

export default function Scanner({ userId }) {
  const navigation = useNavigation();
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
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [cashTendered, setCashTendered] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const processedCartPayloads = useRef(new Set());
  const [cashError, setCashError] = useState('');
  const cashInputRef = useRef(null);
  const cashShake = useRef(new Animated.Value(0)).current;
  const notifyAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  const [notifyMsg, setNotifyMsg] = useState('');

  // Receipt Modal State
  const [isReceiptVisible, setIsReceiptVisible] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] = useState(false);

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

  // Calculate totals
  const totalQty = scannedItems.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = scannedItems.reduce(
    (sum, item) => sum + (parseFloat(item.product.price) * item.qty * (1 - (item.discount / 100))),
    0
  );
  const total = subtotal * (1 - (parseFloat(globalDiscount || 0) / 100));
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
        Alert.alert('Error', data.message || 'Failed to fetch products');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to server. Please check your network and backend.');
      console.error('Fetch products error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Cart management functions
  const addScannedItem = useCallback((product, matchId, source = 'manual', quantityOverride) => {
    if (product.stock <= 0) {
      Alert.alert('Out of Stock', `${product.name} is currently out of stock.`);
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
          Alert.alert(
            'Stock Limit Exceeded',
            `Cannot add ${quantityToAdd} more to cart. Only ${product.stock - existingItem.qty} of ${product.name} left in stock.`
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
          Alert.alert(
            'Stock Limit Exceeded',
            `Cannot add ${quantityToAdd} of ${product.name}. Only ${product.stock} left in stock.`
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
          discount: 0
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
      if (target.qty && target.qty > 1) {
        return prevItems.map(item => item.id === id ? { ...item, qty: item.qty - 1 } : item);
      }
      return prevItems.filter(item => item.id !== id);
    });
  }, []);

  const updateItemDiscount = useCallback((id, discountText) => {
    const cleanedText = discountText.replace(/[^0-9.]/g, ''); // Allow only numbers and one decimal
    const discount = parseFloat(cleanedText) || 0;

    if (discount >= 0 && discount <= 100) { // Validate discount percentage
      setScannedItems(prevItems =>
        prevItems.map(item =>
          item.id === id ? { ...item, discount } : item
        )
      );
    } else if (cleanedText === '') { // Allow clearing the input
      setScannedItems(prevItems =>
        prevItems.map(item =>
          item.id === id ? { ...item, discount: 0 } : item
        )
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setScannedItems([]);
    setSelectedProduct(null);
    setGlobalDiscount(0);
    setCashTendered('');
  }, []);

  // Barcode scanner handler
  const handleBarcodeScanned = useCallback(async ({ data }) => {
    if (scanned) return; // Prevent multiple scans for a short period

    console.log('Scanned data:', data);
    setScanned(true); // Set scanned to true to temporarily disable scanner

    try {
      setIsLoading(true);

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
        try { jsonStr = atob(normalized); } catch (_) { return null; }
        try {
          const obj = JSON.parse(jsonStr);
          return obj && typeof obj === 'object' ? obj : null;
        } catch (_) { return null; }
      };

      const cartMap = tryParseCartPayload(data);
      if (cartMap) {
        // Create a stable signature for duplicate detection
        const sig = (() => {
          try {
            const entries = Object.entries(cartMap).map(([k, v]) => [String(k), Number(v) || 0]);
            entries.sort((a, b) => (a[0] > b[0] ? 1 : -1));
            return JSON.stringify(entries);
          } catch (_) { return JSON.stringify(cartMap); }
        })();
        if (processedCartPayloads.current.has(sig)) {
          Alert.alert('Already Scanned', 'This QR cart has already been added.');
          return;
        }
        processedCartPayloads.current.add(sig);
        for (const [idKey, qtyVal] of Object.entries(cartMap)) {
          const qtyNum = parseInt(qtyVal, 10);
          if (!qtyNum || qtyNum < 1) continue;
          // Reuse product_by_qr with id fallback
          const resp = await fetch(`${API_BASE_URL}/product_by_qr.php?qr_code=${encodeURIComponent(idKey)}`);
          const resJson = await resp.json();
          if (resJson.status === 'success' && resJson.data) {
            addScannedItem(resJson.data, resJson.data.id, 'scan', qtyNum);
          }
        }
        return;
      }

      // Always fetch from the backend to ensure the product is in the database
      const response = await fetch(
        `${API_BASE_URL}/product_by_qr.php?qr_code=${encodeURIComponent(data)}`
      );
      
      const responseText = await response.text();
      console.log('Raw scan response:', responseText);

      let result;
      try {
        // The backend might return HTML warnings before the JSON.
        // Find the first '{' to locate the start of the JSON data.
        const jsonStartIndex = responseText.indexOf('{');
        if (jsonStartIndex === -1) {
          throw new Error('No JSON object found in the server response.');
        }
        const jsonString = responseText.substring(jsonStartIndex);
        result = JSON.parse(jsonString);
      } catch (e) {
        throw new Error(`Server returned invalid JSON. Response: ${responseText.substring(0, 200)}...`);
      }

      if (result.status === 'success' && result.data) {
        // Add item to cart
        addScannedItem(result.data, result.data.id, 'scan');
      } else {
        Alert.alert('Product Not Found', result.message || 'The scanned product is not in the database.');
      }
    } catch (error) {
      console.error('Scan processing error:', error);
      Alert.alert('Error', 'Failed to verify product');
    } finally {
      setIsLoading(false);
      setTimeout(() => setScanned(false), 1000);
    }
  }, [scanned, addScannedItem]);

  // Purchase completion handler
  const executePurchase = useCallback(async () => {
    if (scannedItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to the cart before completing.');
      return;
    }

    if (cashTendered === '' || numericCashTendered <= 0) {
      setCashError('Enter cash amount');
      triggerShake(cashShake);
      cashInputRef.current && cashInputRef.current.focus && cashInputRef.current.focus();
      Vibration.vibrate(80);
      showNotify('Enter cash amount');
      return;
    }

    if (numericCashTendered < total) {
      Alert.alert('Insufficient Cash', 'Cash tendered is less than the total amount.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        items: scannedItems.map(item => {
          if (!item.product || !item.product.id) {
            console.error('Error: Cart item missing valid product ID:', item);
            throw new Error('One or more cart items are missing a valid product ID. Cannot complete purchase.');
          }
          return {
            product_id: item.product.id.toString(),
            quantity: Number(item.qty),
            price: Number(item.product.price),
            discount: Number(item.discount) || 0
          };
        }),
        global_discount: Number(globalDiscount) || 0,
        cash_tendered: Number(cashTendered) || 0,
        user_id: userId || 1, // Default to 1 if userId is not available
        // The backend calculates total and change, so we do not send them.
      };

      console.log('Sending payload:', payload);

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
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Server returned invalid JSON. Response: ${responseText.substring(0, 200)}...`);
      }

      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Purchase failed on server side.');
      }

      await playBeep();
      
      // Refresh the product list to update stock levels
      await fetchProducts(searchQuery);
      
      setReceiptDetails({
        items: [...scannedItems],
        total,
        change,
        cashTendered: numericCashTendered,
        globalDiscount,
        subtotal,
      });
      setIsReceiptVisible(true);

    } catch (error) {
      console.error('Full purchase error:', error);
      Alert.alert(
        'Purchase Failed',
        error.message.includes('JSON')
          ? "There was a problem with the server's response format. Please contact support."
          : `Error: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [scannedItems, globalDiscount, cashTendered, total, clearCart, change, numericCashTendered, playBeep, fetchProducts, searchQuery]);

  const handleCompletePurchase = useCallback(() => {
    if (scannedItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to the cart before completing.');
      return;
    }
    setIsConfirmationModalVisible(true);
  }, [scannedItems]);

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
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!isPermissionGranted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          We need your permission to access the camera for scanning.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading modal
  const modal = (
    isLoading ? (
      <View pointerEvents="none" style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ActivityIndicator size="large" color="#C5BAFF" />
          <Text style={styles.modalText}>Processing...</Text>
        </View>
      </View>
    ) : null
  );

  const renderReceiptModal = () => {
    if (!isReceiptVisible || !receiptDetails) {
      return null;
    }


    const { items, total, change, cashTendered, globalDiscount, subtotal } = receiptDetails;

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
                <Text style={styles.receiptTitle}>Purchase Complete</Text>
                <Text style={styles.receiptDate}>
                  {new Date().toLocaleString()}
                </Text>
              </View>

              <View style={styles.receiptSection}>
                <Text style={styles.receiptSectionTitle}>Summary</Text>
                {items.map(item => (
                  <View key={item.id} style={styles.receiptItem}>
                    <Text style={styles.receiptItemQty}>{item.qty}x</Text>
                    <Text style={styles.receiptItemName} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={styles.receiptItemTotal}>₽{(item.product.price * item.qty * (1 - item.discount / 100)).toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.receiptSection}>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Subtotal</Text>
                  <Text style={styles.receiptTotalValue}>₽{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Discount</Text>
                  <Text style={styles.receiptTotalValue}>{globalDiscount > 0 ? `${globalDiscount}%` : 'N/A'}</Text>
                </View>
                <View style={[styles.receiptTotalRow, styles.receiptGrandTotal]}>
                  <Text style={styles.receiptGrandTotalLabel}>Total</Text>
                  <Text style={styles.receiptGrandTotalValue}>₽{total.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.receiptSection}>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Cash Tendered</Text>
                  <Text style={styles.receiptTotalValue}>₽{cashTendered.toFixed(2)}</Text>
                </View>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Change Due</Text>
                  <Text style={styles.receiptTotalValue}>₽{change.toFixed(2)}</Text>
                </View>
              </View>

              <Text style={styles.receiptFooter}>Thank you for your purchase!</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.receiptCloseButton}
              onPress={() => {
                setIsReceiptVisible(false);
                clearCart();
              }}
            >
              <Text style={styles.receiptCloseButtonText}>New Transaction</Text>
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
          <Text style={styles.logoutModalTitle}>Confirm Action</Text>
          <Text style={styles.logoutModalText}>
            Are you done adding products?
          </Text>
          <View style={styles.logoutModalActions}>
            <TouchableOpacity
              style={[styles.logoutModalButton, styles.cancelLogoutButton]}
              onPress={() => setIsConfirmationModalVisible(false)}
            >
              <Text style={[styles.logoutModalButtonText, { color: '#4B5563' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logoutModalButton, {backgroundColor: '#3498db'}]}
              onPress={() => {
                setIsConfirmationModalVisible(false);
                executePurchase();
              }}
            >
              <Text style={styles.logoutModalButtonText}>Yes, Proceed</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
      <View style={[styles.wrapper, isLandscape && styles.landscapeWrapper]}>
        {/* Left Panel - Scanner */}
        <View 
          style={[styles.leftPanel, isLandscape && styles.landscapeLeftPanel]}
        >
          <View style={styles.scanHereContainer}>
            <Text style={styles.scanHereText}>SCAN HERE</Text>
          </View>

          <View style={styles.scannerBox}>
            <CameraComponent
              isActive={isCameraActive}
              onBarcodeScanned={handleBarcodeScanned}
              cameraType={cameraType}
              scanned={scanned}
            />
          </View>

          <View style={styles.cameraControls}>
            <View style={styles.cameraToggle}>
              <Text style={styles.cameraToggleText}>Camera</Text>
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
                          Qty: {item.qty} | Price: ₽{parseFloat(item.product.price).toFixed(2)}
                        </Text>
                        <View style={styles.discountInputContainer}>
                          <Text style={styles.discountLabel}>Discount:</Text>
                          <TextInput
                            style={styles.discountInput}
                            value={String(item.discount)}
                            keyboardType="numeric"
                            onChangeText={(text) => updateItemDiscount(item.id, text)}
                            placeholder="0"
                          />
                          <Text style={styles.discountPercent}>%</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.scannedItemTotal}>₽{(item.product.price * item.qty * (1 - item.discount / 100)).toFixed(2)}</Text>
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
                  <Text style={styles.totalValue}>₽{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Global Discount:</Text>
                  <TextInput
                    style={styles.discountInput}
                    value={String(globalDiscount)}
                    keyboardType="numeric"
                    onChangeText={(text) => {
                      const cleanedText = text.replace(/[^0-9.]/g, '');
                      const discount = parseFloat(cleanedText) || 0;
                      if (discount >= 0 && discount <= 100) {
                        setGlobalDiscount(discount);
                      } else if (cleanedText === '') {
                        setGlobalDiscount(0);
                      }
                    }}
                    placeholder="0"
                  />
                </View>
                <View style={[styles.totalRow, styles.grandTotal]}>
                  <Text style={[styles.totalLabel, {fontWeight: 'bold', fontSize: 16, color: '#1A202C'}]}>Total:</Text>
                  <Text style={[styles.totalValue, {fontWeight: 'bold', fontSize: 18, color: '#1A202C'}]}>₽{total.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.cashLabel}>Cash Tendered</Text>
                <Animated.View style={[{ transform: [{ translateX: cashShake }] }]}>
                  <TextInput
                    style={styles.cashInput}
                    placeholder="Enter cash amount"
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
                    Change: ₽{Math.abs(change).toFixed(2)}
                    {change < 0 && ' (Insufficient)'}
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
                  <Text style={styles.finishButtonText}>Complete Transaction</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Right Panel - Search, Results, and Add Item */}
        <View 
          style={[styles.rightPanel, isLandscape && styles.landscapeRightPanel]}
        >
          <View style={styles.searchAndControlsContainer}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search Products..."
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
                  <Text style={styles.selectedProductTitle}>Selected Item</Text>
                </View>
                <Text style={styles.selectedProductName} numberOfLines={2}>{selectedProduct.name}</Text>
                <View style={styles.selectedProductDetailsRow}>
                  <Text style={styles.selectedProductPrice}>₽{parseFloat(selectedProduct.price).toFixed(2)}</Text>
                  <Text style={styles.selectedProductStock}>Stock: {selectedProduct.stock}</Text>
                </View>
              </View>
            )}

            <View style={styles.qtyControls}>
              <Text style={styles.qtyLabel}>Quantity</Text>
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

            <Text style={styles.sectionTitle}>Search Results ({filteredProducts.length})</Text>
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
                  onPress={() => setSelectedProduct(item)}
                >
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.productStockList}>Stock: {item.stock}</Text>
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
              <Text style={[styles.buttonText, {color: '#DC2626'}]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, {flex: 1}, !selectedProduct && { backgroundColor: '#A0AEC0' }, selectedProduct?.stock === 0 && { backgroundColor: '#A0AEC0' }]}
              onPress={() => {
                if (selectedProduct) {
                  addScannedItem(selectedProduct, selectedProduct.id, 'manual');
                } else {
                  Alert.alert('No Product Selected', 'Please scan or select a product first');
                }
              }}
              disabled={!selectedProduct || selectedProduct?.stock === 0}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.buttonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {modal}
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
      {renderReceiptModal()}
      {renderConfirmationModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 16,
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
  cameraToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraToggleText: {
    marginRight: 8,
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#5E35B1',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  selectedProductName: {
    fontSize: 18,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5E35B1',
  },
  selectedProductStock: {
    fontSize: 14,
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
    fontSize: 16,
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
    fontSize: 16,
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
    fontSize: 16,
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
    fontSize: 15,
  },
  productStockList: {
    color: '#667085',
    fontSize: 14,
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
    fontSize: 16,
    marginLeft: 8,
  },
  finishButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
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
    fontSize: 16,
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
    fontSize: 16,
  },
  scannedItemDetails: {
    marginTop: 6,
  },
  scannedItemPrice: {
    color: '#667085',
    fontSize: 14,
  },
  discountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  discountLabel: {
    fontSize: 14,
    color: '#667085',
    marginRight: 6,
  },
  discountInput: {
    width: 45,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  discountPercent: {
    fontSize: 14,
    color: '#667085',
    marginLeft: 4,
  },
  scannedItemTotal: {
    fontWeight: 'bold',
    color: '#1A202C',
    marginHorizontal: 10,
    fontSize: 16,
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
    fontSize: 15,
  },
  totalValue: {
    fontWeight: '600',
    color: '#344054',
    fontSize: 15,
  },
  cashLabel: {
    marginBottom: 8,
    color: '#667085',
    fontSize: 15,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  changeText: {
    marginTop: 8,
    textAlign: 'right',
    color: '#344054',
    fontWeight: 'bold',
    fontSize: 15,
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
    width: '100%',
    justifyContent: 'space-between',
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLogoutButton: {
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  confirmLogoutButton: {
    backgroundColor: '#D94848',
    marginLeft: 8,
  },
  logoutModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Walkthrough Modal Styles
  walkthroughOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  walkthroughHighlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderColor: '#fff',
    borderWidth: 3,
    borderRadius: 12,
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },
  walkthroughContainer: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  walkthroughArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderColor: 'transparent',
    borderStyle: 'solid',
  },
  walkthroughTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  walkthroughDescription: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    lineHeight: 24,
  },
  walkthroughActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walkthroughSkipText: {
    fontSize: 16,
    color: '#777',
  },
  walkthroughNextButton: {
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  walkthroughNextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  receiptDate: {
    fontSize: 14,
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
    fontSize: 18,
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
    fontSize: 15,
    color: '#888',
    marginRight: 10,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  receiptItemTotal: {
    fontSize: 15,
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
    fontSize: 16,
    color: '#666',
  },
  receiptTotalValue: {
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptGrandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptFooter: {
    textAlign: 'center',
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FBFBFB',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
    color: '#3A3A3A',
  },
  button: {
    backgroundColor: '#C5BAFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
  },
  modalText: {
    marginTop: 16,
    color: '#3A3A3A',
  },
  listContent: {
    flexGrow: 1,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  receiptDate: {
    fontSize: 14,
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
    fontSize: 18,
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
    fontSize: 15,
    color: '#888',
    marginRight: 10,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  receiptItemTotal: {
    fontSize: 15,
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
    fontSize: 16,
    color: '#666',
  },
  receiptTotalValue: {
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptGrandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptFooter: {
    textAlign: 'center',
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FBFBFB',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
    color: '#3A3A3A',
  },
  button: {
    backgroundColor: '#C5BAFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
  },
  modalText: {
    marginTop: 16,
    color: '#3A3A3A',
  },
  listContent: {
    flexGrow: 1,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  receiptDate: {
    fontSize: 14,
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
    fontSize: 18,
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
    fontSize: 15,
    color: '#888',
    marginRight: 10,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  receiptItemTotal: {
    fontSize: 15,
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
    fontSize: 16,
    color: '#666',
  },
  receiptTotalValue: {
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptGrandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptFooter: {
    textAlign: 'center',
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FBFBFB',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
    color: '#3A3A3A',
  },
  button: {
    backgroundColor: '#C5BAFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
  },
  modalText: {
    marginTop: 16,
    color: '#3A3A3A',
  },
  listContent: {
    flexGrow: 1,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  receiptDate: {
    fontSize: 14,
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
    fontSize: 18,
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
    fontSize: 15,
    color: '#888',
    marginRight: 10,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  receiptItemTotal: {
    fontSize: 15,
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
    fontSize: 16,
    color: '#666',
  },
  receiptTotalValue: {
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptGrandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptFooter: {
    textAlign: 'center',
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FBFBFB',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
    color: '#3A3A3A',
  },
  button: {
    backgroundColor: '#C5BAFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
  },
  modalText: {
    marginTop: 16,
    color: '#3A3A3A',
  },
  listContent: {
    flexGrow: 1,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  receiptDate: {
    fontSize: 14,
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
    fontSize: 18,
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
    fontSize: 15,
    color: '#888',
    marginRight: 10,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  receiptItemTotal: {
    fontSize: 15,
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
    fontSize: 16,
    color: '#666',
  },
  receiptTotalValue: {
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptGrandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  receiptFooter: {
    textAlign: 'center',
    fontSize: 14,
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
    fontSize: 16,
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
    width: '100%',
    justifyContent: 'space-between',
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLogoutButton: {
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  confirmLogoutButton: {
    backgroundColor: '#D94848',
    marginLeft: 8,
  },
  logoutModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Walkthrough Modal Styles
  walkthroughOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  walkthroughHighlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderColor: '#fff',
    borderWidth: 3,
    borderRadius: 12,
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },
  walkthroughContainer: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  walkthroughArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderColor: 'transparent',
    borderStyle: 'solid',
  },
  walkthroughTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  walkthroughDescription: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    lineHeight: 24,
  },
  walkthroughActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walkthroughSkipText: {
    fontSize: 16,
    color: '#777',
  },
  walkthroughNextButton: {
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  walkthroughNextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});