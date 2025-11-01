import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { useResponsive } from '../utils/responsive';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';

import { API_URL } from '../utils/config';

const { width } = Dimensions.get('window');
const basePadding = width * 0.04;

const fetchInventory = async () => {
  try {
    const response = await fetch(`${API_URL}/get_inventory.php`);
    const data = await response.json();
    
    // Handle the new response structure
    if (data.status === 'success') {
      return data.data;
    } else {
      console.error('Backend error:', data.message);
      return [];
    }
  } catch (e) {
    console.error('Fetch error:', e);
    return [];
  }
};

function getCategoryColors(category) {
  switch (category) {
    case 'Accessories': return '#C5BAFF';
    case 'Clothing': return '#8FD3FF';
    case 'Swimwear': return '#A0E7E5';
    case 'Footwear': return '#FFA3A3';
    case 'Bags': return '#B5EAD7';
    case 'Beach Gear': return '#FFE4B5';
    case 'Towels': return '#E6E6FA';
    case 'Beach Toys': return '#F0E68C';
    case 'Sunscreen': return '#FFB6C1';
    case 'Kitchen': return '#DDA0DD';
    case 'Other': return '#D3D3D3';
    default: return '#D3D3D3';
  }
}

export default function Dashboard() {
  const { isTablet } = useResponsive();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [scale, setScale] = useState(1);
  const scrollViewRef = useRef(null);
  const pinchStartScaleRef = useRef(1);
  const contentWidth = width / Math.max(scale, 0.7);

  useEffect(() => {
    fetchInventory().then((data) => {
      console.log('Dashboard received data:', data);
      setInventory(data);
      setLoading(false);
    });
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Zoom functions
  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.1, 2));
  };

  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.7));
  };

  const resetZoom = () => {
    setScale(1);
  };

  const totalProducts = inventory.length;
  const totalValue = inventory.reduce((sum, item) => {
    const price = parseFloat(item.price);
    const stock = parseInt(item.stock, 10);
    return (!isNaN(price) && !isNaN(stock) && stock > 0 && price >= 0 ? sum + price * stock : sum)
  }, 0);

  const lowStock = inventory.filter((item) => Number(item.stock) <= 5).length;
  const outOfStock = inventory.filter((item) => Number(item.stock) === 0).length;

  const categoryCounts = {};
  inventory.forEach((item) => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });

  const pieData = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, population]) => ({
      name,
      population,
      color: getCategoryColors(name),
      legendFontColor: '#3A3A3A',
      legendFontSize: 14,
    }));

  const recentlyAdded = [...inventory]
    .sort((a, b) => new Date(b.date_added) - new Date(a.date_added))
    .slice(0, 5);

  const topByValue = [...inventory]
    .sort((a, b) => Number(b.stock) * Number(b.price) - Number(a.stock) * Number(a.price))
    .slice(0, 5);

  return (
    <LinearGradient colors={['#FFFFFF', '#FFFFFF', '#FFFFFF']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Zoom Controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity onPress={zoomOut} style={styles.zoomButton}>
            <Feather name="zoom-out" size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={resetZoom} style={styles.zoomButton}>
            <Text style={styles.zoomButtonText}>100%</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={zoomIn} style={styles.zoomButton}>
            <Feather name="zoom-in" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <PinchGestureHandler
          onHandlerStateChange={(e) => {
            const { state, scale: gestureScale } = e.nativeEvent;
            if (state === State.BEGAN) {
              pinchStartScaleRef.current = scale;
            } else if (state === State.ACTIVE) {
              const next = Math.max(0.7, Math.min(2, pinchStartScaleRef.current * gestureScale));
              setScale(next);
            } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
              const next = Math.max(0.7, Math.min(2, scale));
              setScale(next);
              pinchStartScaleRef.current = next;
            }
          }}
          onGestureEvent={(e) => {
            const { scale: gestureScale } = e.nativeEvent;
            const next = Math.max(0.7, Math.min(2, pinchStartScaleRef.current * gestureScale));
            setScale(next);
          }}
        >
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollArea,
              { transform: [{ scale }] },
              { minHeight: '100%', width: contentWidth }
            ]}
            showsVerticalScrollIndicator={false}
          >
          {/* HEADER */}
          <View style={styles.headerContainer}>
            <View style={styles.titleContainer}>
              <Text style={styles.headerText}>Dashboard Overview</Text>
            </View>
          </View>

          <Text style={styles.welcome}>Welcome back!</Text>
          <Text style={styles.subtitle}>Here's what's happening with your inventory today</Text>
          <Text style={styles.datetime}>
            {now.toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}, {now.toLocaleTimeString()}
          </Text>

          <View style={[styles.summaryRow, isTablet && { justifyContent: 'space-between' }]}>
            <View style={styles.mergedCardContainer}>
              <LinearGradient colors={['#F5F7FA','#D3DAD9']} style={styles.mergedGradientCard}>
                <View style={styles.splitCard}>
                  <Feather name="box" size={28} color="#3A7BD5" style={styles.cardIcon} />
                  <Text style={styles.summaryLabel}>Total Products</Text>
                  <Text style={styles.summaryValue}>{totalProducts}</Text>
                  <Text style={styles.summarySub}>Active inventory items</Text>
                </View>
                <View style={styles.splitCard}>
                  <Feather name="dollar-sign" size={28} color="#00838F" style={styles.cardIcon} />
                  <Text style={styles.summaryLabel}>Total Inventory Value</Text>
                  <Text style={styles.summaryValue}>₱{totalValue.toFixed(2)}</Text>
                  <Text style={styles.summarySub}>Current stock value</Text>
                </View>
              </LinearGradient>
            </View>
            <View style={styles.mergedCardContainer}>
              <LinearGradient colors={['#F5F7FA','#D3DAD9']} style={styles.mergedGradientCard}>
                <View style={styles.splitCard}>
                  <Feather name="arrow-down-circle" size={28} color="#C62828" style={styles.cardIcon} />
                  <Text style={styles.summaryLabel}>Low Stock Items</Text>
                  <Text style={styles.summaryValue}>{lowStock}</Text>
                  <Text style={styles.summarySub}>Need restocking</Text>
                </View>
                <View style={styles.splitCard}>
                  <Feather name="x-circle" size={28} color="#6A1B9A" style={styles.cardIcon} />
                  <Text style={styles.summaryLabel}>Out of Stock</Text>
                  <Text style={styles.summaryValue}>{outOfStock}</Text>
                  <Text style={styles.summarySub}>Requires attention</Text>
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* Category Distribution */}
          <View style={[styles.fullWidthCard, styles.cardNoBorder, {backgroundColor: 'transparent'}]}>
            <LinearGradient colors={['#F5F7FA', '#D3DAD9']} style={[styles.gradientCard, {padding: basePadding}]}> 
              <View style={styles.listHeader}>
                <Text style={styles.cardTitle}>Category Distribution</Text>
              </View>
            {loading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="small" color="#C5BAFF" />
              </View>
            ) : pieData.length === 0 ? (
              <View style={styles.emptyChartContainer}>
                <Feather name="pie-chart" size={30} color="#E5E7EB" />
                <Text style={styles.emptyChartText}>No category data</Text>
              </View>
            ) : (
              <View style={[styles.chartContainer, { width: '100%' }]}>
                <PieChart
                  data={pieData}
                  width={contentWidth * 0.92}
                  height={180}
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(58, 58, 58, ${opacity})`,
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="0"
                  absolute
                  hasLegend
                  avoidFalseZero
                  style={{
                    marginVertical: -15,
                    marginLeft: 0,
                  }}
                />
              </View>
            )}
            </LinearGradient>
          </View>

          {/* Second row in a responsive row */}
          <View style={styles.rowWrap}>
          {/* Recently Added */}
          <View style={[styles.fullWidthCard, styles.cardNoBorder, styles.halfCard, {backgroundColor: 'transparent'}]}>
            <LinearGradient colors={['#F5F7FA', '#D3DAD9']} style={[styles.gradientCard, {padding: basePadding}]}> 
              <View style={[styles.listHeader, { marginBottom: 0 }]}>
                <Text style={styles.cardTitle}>Recently Added</Text>
              </View>
            {recentlyAdded.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.itemRow,
                  index === recentlyAdded.length - 1 && { marginBottom: 0 }
                ]}
              >
                <Feather name="box" size={16} color="#9CA3AF" style={styles.itemIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.itemMetaRow}>
                    <View style={[styles.categoryTag, { backgroundColor: getCategoryColors(item.category) + '20' }]}>
                      <Text style={[styles.categoryText, { color: getCategoryColors(item.category) }]}>
                        {item.category}
                      </Text>
                    </View>
                    <Text style={styles.itemStock}>{item.stock} in stock</Text>
                  </View>
                  <Text style={styles.itemPrice}>₱{item.price}</Text>
                  <Text style={styles.itemDate}>
                    Added on {new Date(item.date_added).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
            </LinearGradient>
          </View>

          {/* Highest Value Items */}
          <View style={[styles.fullWidthCard, styles.cardNoBorder, styles.halfCard, {backgroundColor: 'transparent'}]}>
            <LinearGradient colors={['#F5F7FA', '#D3DAD9']} style={[styles.gradientCard, {padding: basePadding}]}> 
              <View style={styles.listHeader}>
                <Text style={styles.cardTitle}>Highest Value Items</Text>
              </View>
            {topByValue.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.rank}>{index + 1}.</Text>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemValue}>₱{(item.price * item.stock).toFixed(2)}</Text>
              </View>
            ))}
            </LinearGradient>
          </View>
          </View>
          </ScrollView>
        </PinchGestureHandler>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  scrollArea: {
    padding: basePadding,
    paddingBottom: 40,
    transformOrigin: 'top left',
  },
  halfCard: {
    flexBasis: '49%',
    maxWidth: '49%',
  },
  welcome: {
    fontSize: width * 0.07,
    fontWeight: '700',
    color: '#3A3A3A',
    fontFamily: 'Poppins_700Bold',
    marginTop: 10,
  },
  subtitle: {
    fontSize: width * 0.045,
    color: '#555555',
    fontFamily: 'Poppins_400Regular',
    marginBottom: 5,
  },
  datetime: {
    fontSize: width * 0.04,
    color: '#777777',
    marginBottom: basePadding,
    fontFamily: 'Poppins_400Regular',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -basePadding * 0.25,
    justifyContent: 'space-between',
  },
  mergedCardContainer: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 16,
    marginBottom: basePadding * 0.5,
    minWidth: 0,
    overflow: 'hidden',
    marginHorizontal: basePadding * 0.25,
  },
  mergedGradientCard: {
    borderRadius: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    padding: basePadding,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  splitCard: {
    alignItems: 'center',
    flex: 1,
  },
  summaryCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 16,
    marginBottom: basePadding * 0.5,
    minWidth: 0,
    overflow: 'hidden',
    marginHorizontal: basePadding * 0.25,
    flexDirection: 'column',
  },
  gradientCard: {
    borderRadius: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    padding: basePadding,
    flex: 1,
  },
  cardIcon: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: width * 0.04,
    color: '#555555',
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: width * 0.065,
    fontWeight: 'bold',
    color: '#3A3A3A',
    fontFamily: 'Poppins_700Bold',
    marginVertical: 5,
  },
  summarySub: {
    fontSize: width * 0.035,
    color: '#777777',
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  fullWidthCard: {
    width: '100%',
    borderRadius: 16,
    marginBottom: basePadding,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  cardNoBorder: {
    borderWidth: 0,
    padding: 0,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: width * 0.05,
    fontWeight: '600',
    color: '#3A3A3A',
    fontFamily: 'Poppins_600SemiBold',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
    flexWrap: 'wrap',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  itemIcon: {
    marginRight: 8,
    marginTop: 4,
  },
  itemName: {
    fontWeight: '600',
    fontSize: width * 0.042,
    color: '#3A3A3A',
    fontFamily: 'Poppins_600SemiBold',
    flexShrink: 1,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
    flexWrap: 'wrap',
  },
  categoryTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  categoryText: {
    fontSize: width * 0.035,
    fontWeight: '500',
    fontFamily: 'Poppins_400Regular',
  },
  itemStock: {
    color: '#777777',
    fontSize: width * 0.035,
    fontFamily: 'Poppins_400Regular',
  },
  itemPrice: {
    color: '#3A3A3A',
    fontWeight: '600',
    fontSize: width * 0.035,
    fontFamily: 'Poppins_600SemiBold',
  },
  itemDate: {
    color: '#999999',
    fontSize: width * 0.035,
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
  },
  rank: {
    fontWeight: 'bold',
    color: '#C5BAFF',
    width: 20,
    fontSize: width * 0.042,
    fontFamily: 'Poppins_600SemiBold',
  },
  itemValue: {
    fontWeight: 'bold',
    color: '#3A3A3A',
    fontSize: width * 0.042,
    marginLeft: 8,
    fontFamily: 'Poppins_700Bold',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -15,
    marginBottom: -20,
  },
  chartLoadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -10,
  },
  emptyChartContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
    marginBottom: -10,
  },
  emptyChartText: {
    marginTop: 8,
    color: '#999999',
    fontSize: width * 0.04,
    fontFamily: 'Poppins_400Regular',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  titleContainer: {
    backgroundColor: '#000000',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    width: '85%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: width * 0.055,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
  },
  zoomControls: {
    position: 'absolute',
    right: 15,
    top: 15,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 20,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomButton: {
    padding: 8,
  },
  zoomButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});