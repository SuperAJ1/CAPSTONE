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

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'useInsertionEffect must not schedule updates',
]);

const { width, height } = Dimensions.get('window');
const isLandscape = width > height;

// IMPORTANT: Replace with your actual backend IP address.
// This is critical for your app to connect to your server.
const API_BASE_URL = 'http://192.168.0.89/rtw_backend';

const CameraComponent = ({ isActive, onBarcodeScanned, cameraType, scanned }) => {
  if (!isActive) {
    return (
      <View style={styles.cameraOffOverlay}>
        <Ionicons name="camera-off" size={32} color="#999" />
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

      let productToAdd = null;
      let productIdForCartMatching = null;

      // Attempt to parse data as JSON for QR codes with embedded product info
      try {
        const parsedData = JSON.parse(data);
        if (typeof parsedData === 'object' && parsedData !== null && parsedData.name && parsedData.price) {
          // Data is a product object directly from QR code
          productToAdd = {
            id: parsedData.id || data,
            name: parsedData.name,
            price: parseFloat(parsedData.price),
            category: parsedData.category || 'Uncategorized',
            stock: parseInt(parsedData.stock) || 0,
            qr_code_data: data
          };
          productIdForCartMatching = productToAdd.qr_code_data;
        }
      } catch (e) {
        // Data is not JSON, proceed to fetch from API
      }

      if (!productToAdd) {
        // If product wasn't parsed from QR JSON, fetch from API
        const response = await fetch(
          `${API_BASE_URL}/product_by_qr.php?qr_code=${encodeURIComponent(data)}`
        );
        const result = await response.json();

        if (result.status === 'success' && result.data) {
          productToAdd = result.data;
          productIdForCartMatching = productToAdd.id;
        } else {
          Alert.alert('Product Not Found', result.message || 'The scanned product is not in the database.');
          setIsLoading(false);
          setTimeout(() => setScanned(false), 1000);
          return;
        }
      }

      if (productToAdd && productIdForCartMatching) {
        // Add item to cart
        addScannedItem(productToAdd, productIdForCartMatching, 'scan');
      } else {
        Alert.alert('Error', 'Could not process scanned data or product information is incomplete.');
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
  const handleCompletePurchase = useCallback(async () => {
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
        total_amount: Number(total.toFixed(2)),
        global_discount: Number(globalDiscount) || 0,
        cash_tendered: Number(cashTendered) || 0,
        change: Number(change.toFixed(2)) || 0
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
      
      Alert.alert(
        'Purchase Complete',
        `Total: ₽${total.toFixed(2)}\nChange: ₽${change.toFixed(2)}`,
        [{ text: 'OK', onPress: clearCart }]
      );

    } catch (error) {
      console.error('Full purchase error:', error);
      Alert.alert(
        'Purchase Failed',
        error.message.includes('JSON')
          ? 'There was a problem with the server\'s response format. Please contact support.'
          : `Error: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [scannedItems, globalDiscount, cashTendered, total, clearCart, change, numericCashTendered, playBeep, fetchProducts, searchQuery]);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
      <View style={[styles.wrapper, isLandscape && styles.landscapeWrapper]}>
        {/* Left Panel - Scanner and Search */}
        <View style={[styles.leftPanel, isLandscape && styles.landscapeLeftPanel]}>
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

          {selectedProduct && (
            <View style={styles.selectedProductContainer}>
              <Text style={styles.selectedProductTitle}>SELECTED:</Text>
              <View style={styles.selectedProductRow}>
                <Text style={styles.selectedProductName} numberOfLines={1}>{selectedProduct.name}</Text>
                <Text style={styles.selectedProductPrice}>₽{selectedProduct.price.toFixed(2)}</Text>
              </View>
              <Text style={styles.selectedProductCategory}>{selectedProduct.category}</Text>
              <Text style={styles.selectedProductStock}>Stock: {selectedProduct.stock}</Text>
            </View>
          )}

          <View style={styles.qtyControls}>
            <Text style={styles.qtyLabel}>Qty:</Text>
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

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Items..."
              placeholderTextColor="#999"
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

          <View style={styles.itemsListContainer}>
            {isSearching ? (
              <ActivityIndicator size="small" color="#C5BAFF" />
            ) : (
              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.productItem}
                    onPress={() => setSelectedProduct(item)}
                  >
                    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.productCategory} numberOfLines={1}>{item.category}</Text>
                    <Text style={styles.productStockList}>Stock: {item.stock}</Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={clearCart}
            >
              <Ionicons name="close-circle" size={16} color="#fff" />
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, selectedProduct?.stock === 0 && { backgroundColor: '#cccccc' }]}
              onPress={() => {
                if (selectedProduct) {
                  // For manual add, use product.id from the selected product
                  addScannedItem(selectedProduct, selectedProduct.id, 'manual');
                } else {
                  Alert.alert('No Product Selected', 'Please scan or select a product first');
                }
              }}
              disabled={selectedProduct?.stock === 0}
            >
              <Ionicons name="add-circle" size={16} color="#fff" />
              <Text style={styles.buttonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Panel - Scanned Items and Totals */}
        <View style={[styles.rightPanel, isLandscape && styles.landscapeRightPanel]}>
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled={true}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cart Items ({scannedItems.length})</Text>
              {scannedItems.length > 0 ? (
                scannedItems.map((item) => (
                  <View key={item.id} style={styles.scannedItem}>
                    <View style={styles.scannedItemInfo}>
                      <Text style={styles.scannedItemName} numberOfLines={1}>{item.product.name}</Text>
                      <View style={styles.scannedItemDetails}>
                        <Text style={styles.scannedItemPrice}>
                          Qty: {item.qty} | Price: ₽{item.product.price.toFixed(2)}
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
                <Text style={styles.emptyCartText}>No items in cart</Text>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Qty:</Text>
                <Text style={styles.totalValue}>{totalQty}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal:</Text>
                <Text style={styles.totalValue}>₽{subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount (%):</Text>
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
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>₽{total.toFixed(2)}</Text>
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
                    return; // Prevent multiple decimal points
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

            <View style={styles.logoTitleContainer}>
              <Image
                source={require('../assets/logo3.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.logoTitle}>SIMS: Sales and Inventory</Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.finishButton,
              (isLoading || scannedItems.length === 0) && { backgroundColor: '#cccccc' }
            ]}
            onPress={handleCompletePurchase}
            disabled={isLoading || scannedItems.length === 0}
          >
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.finishButtonText}>Finish</Text>
          </TouchableOpacity>
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
    flexDirection: 'column',
  },
  landscapeWrapper: {
    flexDirection: 'row',
  },
  leftPanel: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  landscapeLeftPanel: {
    flex: 0.8,
  },
  rightPanel: {
    flex: 1.2,
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 0,
  },
  landscapeRightPanel: {
    flex: 1.2,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  scanHereContainer: {
    backgroundColor: '#000000',
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanHereText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
  },
  scannerBox: {
    height: 180,
    backgroundColor: '#d9dce1',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cameraView: {
    flex: 1,
  },
  cameraOffOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#d9dce1',
  },
  cameraOffText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cameraToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraToggleText: {
    marginRight: 8,
    fontSize: 14,
    color: '#3A3A3A',
  },
  flipCameraButton: {
    backgroundColor: 'transparent',
    padding: 6,
    borderRadius: 20,
  },
  selectedProductContainer: {
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BDBDBD',
  },
  selectedProductTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3A3A3A',
    marginBottom: 4,
  },
  selectedProductRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectedProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3A',
    flex: 1,
    marginRight: 8,
  },
  selectedProductPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3A3A3A',
  },
  selectedProductCategory: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  selectedProductStock: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  qtyLabel: {
    marginRight: 8,
    fontSize: 14,
    color: '#3A3A3A',
  },
  qtyButton: {
    backgroundColor: '#E8F9FF',
    padding: 6,
    borderRadius: 4,
  },
  qtyInput: {
    width: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 6,
    marginHorizontal: 6,
    textAlign: 'center',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#3A3A3A',
  },
  itemsListContainer: {
    flex: 1,
    maxHeight: 200,
    marginBottom: 12,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  productName: {
    flex: 1,
    color: '#3A3A3A',
    textAlign: 'left',
    fontSize: 12,
  },
  productCategory: {
    flex: 1,
    color: '#666',
    textAlign: 'center',
    fontSize: 12,
  },
  productStockList: {
    flex: 1,
    color: '#3A3A3A',
    textAlign: 'right',
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#B00020',
    padding: 10,
    borderRadius: 6,
    marginRight: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 6,
    marginLeft: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3A3A3A',
    marginBottom: 8,
  },
  scannedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  scannedItemInfo: {
    flex: 1,
  },
  scannedItemName: {
    fontWeight: 'bold',
    color: '#3A3A3A',
    fontSize: 12,
  },
  scannedItemDetails: {
    marginTop: 4,
  },
  scannedItemPrice: {
    color: '#666',
    fontSize: 11,
  },
  discountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  discountLabel: {
    fontSize: 11,
    color: '#666',
    marginRight: 4,
  },
  discountInput: {
    width: 36,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 4,
    fontSize: 11,
    textAlign: 'center',
  },
  discountPercent: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  scannedItemTotal: {
    fontWeight: 'bold',
    color: '#3A3A3A',
    marginHorizontal: 8,
    fontSize: 12,
  },
  removeButton: {
    padding: 4,
  },
  emptyCartText: {
    color: '#999',
    textAlign: 'center',
    paddingVertical: 12,
    fontSize: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    color: '#666',
    fontSize: 12,
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#3A3A3A',
    fontSize: 12,
  },
  cashLabel: {
    marginBottom: 6,
    color: '#666',
    fontSize: 12,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#f5f5f5',
    fontSize: 14,
  },
  changeText: {
    marginTop: 6,
    textAlign: 'right',
    color: '#3A3A3A',
    fontWeight: 'bold',
    fontSize: 12,
  },
  logoTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: 10,
  },
  logoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3A3A3A',
    marginTop: 10,
    textAlign: 'center',
  },
  finishButton: {
    backgroundColor: '#000000',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
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
    fontSize: 16,
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
});