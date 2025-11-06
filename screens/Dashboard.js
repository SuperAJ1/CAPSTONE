import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useResponsive } from '../utils/responsive';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withDelay, Easing, useDerivedValue, interpolate, Extrapolate } from 'react-native-reanimated';

import { API_URL } from '../utils/config';

const { width } = Dimensions.get('window');

// Animated component for summary cards with entrance animation
const AnimatedSummaryCard = ({ icon, label, value, subtext, color, gradientColors, index }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    const delay = index * 150;
    opacity.value = withDelay(delay, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <Animated.View style={[styles.summaryCardContainer, animatedStyle]}>
      <LinearGradient colors={gradientColors} style={styles.summaryCard}>
        <Feather name={icon} size={32} color={color} style={styles.cardIcon} />
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summarySub}>{subtext}</Text>
      </LinearGradient>
    </Animated.View>
  );
};

// Helper component for individual summary cards
const SummaryCard = ({ icon, label, value, subtext, color, gradientColors }) => (
  <View style={styles.summaryCardContainer}>
    <LinearGradient colors={gradientColors} style={styles.summaryCard}>
      <Feather name={icon} size={32} color={color} style={styles.cardIcon} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summarySub}>{subtext}</Text>
    </LinearGradient>
  </View>
);

const ShimmeringLoader = () => {
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    shimmer.value = withTiming(1, { duration: 1000 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmer.value,
      [-1, 1],
      [-width, width],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={styles.shimmerContainer}>
      <LinearGradient
        colors={['#E0E0E0', '#F0F0F0', '#E0E0E0']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} />
      </LinearGradient>
      <ActivityIndicator size="large" color="#4A90E2" />
      <Text style={styles.loadingText}>Loading Dashboard...</Text>
    </View>
  );
};

const fetchInventory = async () => {
  try {
    const response = await fetch(`${API_URL}/get_inventory.php`);
    // Check if the response is ok (status in the range 200-299)
    if (!response.ok) {
      // Throw an error with the status text, which can be more descriptive
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Handle the new response structure
    if (data.status === 'success') {
      return data.data;
    } else {
      // Throw an error with the backend message
      throw new Error(data.message || 'Backend returned an error status.');
    }
  } catch (e) {
    // Re-throw the error to be caught by the calling function's .catch block
    throw e;
  }
};

function getCategoryColors(category) {
  switch (category) {
    case 'Accessories': return { color: '#C5BAFF', gradient: '#E6E0FF' };
    case 'Clothing': return { color: '#8FD3FF', gradient: '#D4EDFF' };
    case 'TShir': return { color: '#8FD3FF', gradient: '#D4EDFF' }; // Assigning same as Clothing
    case 'toy': return { color: '#FFD6A5', gradient: '#FFEEDA' }; // New color for toys
    case 'Swimwear': return { color: '#A0E7E5', gradient: '#D9F7F6' };
    case 'Footwear': return { color: '#FFA3A3', gradient: '#FFD6D6' };
    case 'Bags': return { color: '#B5EAD7', gradient: '#E2F5EE' };
    default: return { color: '#D3D3D3', gradient: '#F0F0F0' };
  }
}

export default function Dashboard() {
  const { isTablet } = useResponsive();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Add error state
  const [refreshing, setRefreshing] = useState(false);
  const [focussedIndex, setFocussedIndex] = useState(-1);

  const animationProgress = useSharedValue(0);

  const loadData = useCallback(() => {
    setError(null); // Reset error on new load attempt
    return fetchInventory()
      .then((data) => {
        setInventory(data);
      })
      .catch((e) => {
        setError(e.message || 'An unexpected error occurred.');
        setInventory([]); // Clear inventory on error
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }, [loadData]);

  useEffect(() => {
    if (!loading) {
      animationProgress.value = withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) });
    }
  }, [loading]);

  const chartAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animationProgress.value,
      transform: [{ scale: interpolate(animationProgress.value, [0, 1], [0.9, 1]) }],
    };
  });

  const listAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animationProgress.value,
      transform: [{ translateY: interpolate(animationProgress.value, [0, 1], [50, 0]) }],
    };
  });

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
    .map(([name, count], index) => {
      const { color, gradient } = getCategoryColors(name);
      return {
        name: name,
        value: count,
        color: color,
        gradientCenterColor: gradient,
        focused: index === focussedIndex,
      };
    });

  const recentlyAdded = [...inventory]
    .sort((a, b) => new Date(b.date_added) - new Date(a.date_added))
    .slice(0, 5);

  const topByValue = [...inventory]
    .sort((a, b) => Number(b.stock) * Number(b.price) - Number(a.stock) * Number(a.price))
    .slice(0, 5);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
        <ShimmeringLoader />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Feather name="alert-circle" size={40} color="#D0021B" />
        <Text style={{ marginTop: 10, fontSize: 16, color: '#D0021B', textAlign: 'center' }}>
          Failed to load data. Please try again.
        </Text>
        <Text style={{ marginTop: 5, fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
          ({error})
        </Text>
        <TouchableOpacity onPress={loadData} style={{ marginTop: 20, backgroundColor: '#4A90E2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A90E2" />
        }
      >
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <Feather name="activity" size={26} color="#4A5568" />
          <Text style={styles.subtitle}>Here's what's happening with your inventory today.</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <AnimatedSummaryCard
            index={0}
            icon="box"
            label="Total Products"
            value={totalProducts}
            subtext="Active items"
            color="#3B82F6"
            gradientColors={['#EFF6FF', '#FFFFFF']}
          />
          <AnimatedSummaryCard
            index={1}
            icon="dollar-sign"
            label="Total Value"
            value={`₱${totalValue.toFixed(2)}`}
            subtext="Current stock value"
            color="#10B981"
            gradientColors={['#F0FDF4', '#FFFFFF']}
          />
          <AnimatedSummaryCard
            index={2}
            icon="trending-down"
            label="Low Stock"
            value={lowStock}
            subtext="Items to restock"
            color="#F59E0B"
            gradientColors={['#FFFBEB', '#FFFFFF']}
          />
          <AnimatedSummaryCard
            index={3}
            icon="x-circle"
            label="Out of Stock"
            value={outOfStock}
            subtext="Items unavailable"
            color="#D0021B"
            gradientColors={['#FEF2F2', '#FFFFFF']}
          />
        </View>

        {/* Category Distribution */}
        <Animated.View style={[chartAnimatedStyle]}>
          <LinearGradient colors={['#FFFFFF', '#F9FAFB']} style={styles.card}>
            <Text style={styles.cardTitle}>Category Distribution</Text>
            {pieData.length === 0 ? (
              <View style={styles.emptyChartContainer}>
                <Feather name="pie-chart" size={40} color="#E5E7EB" />
                <Text style={styles.emptyChartText}>No category data available</Text>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                <PieChart
                  data={pieData}
                  donut
                  showGradient
                  focusOnPress
                  onPress={(item, index) => {
                    setFocussedIndex(index === focussedIndex ? -1 : index);
                  }}
                  radius={width / 5}
                  innerRadius={width / 10}
                  extraRadiusForFocused={width / 30}
                  strokeWidth={1}
                  strokeColor="#FFFFFF"
                  centerLabelComponent={() => {
                    const focusedItem = pieData[focussedIndex];
                    const total = pieData.reduce((acc, i) => acc + i.value, 0);
                    const percentage = focusedItem ? ((focusedItem.value / total) * 100).toFixed(0) : '';

                    return (
                      <View style={styles.centerLabelContainer}>
                        {focussedIndex > -1 ? (
                          <>
                            <Text style={styles.centerLabelValue}>{`${percentage}%`}</Text>
                            <Text style={styles.centerLabelText}>{focusedItem.name}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.centerLabelValue}>{total}</Text>
                            <Text style={styles.centerLabelText}>Total Items</Text>
                          </>
                        )}
                      </View>
                    );
                  }}
                />
                <View style={styles.legendContainer}>
                  {pieData.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.legendItem}
                      onPress={() => setFocussedIndex(index === focussedIndex ? -1 : index)}
                    >
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendLabel}>{item.name} ({item.value})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Lists Row */}
        <Animated.View style={[listAnimatedStyle]}>
          <View style={styles.listRow}>
            {/* Recently Added */}
            <LinearGradient colors={['#FFFFFF', '#F9FAFB']} style={[styles.card, styles.listCard]}>
              <Text style={styles.cardTitle}>Recently Added</Text>
              {recentlyAdded.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemSub}>{item.stock} in stock · ₱{item.price}</Text>
                  </View>
                  <Text style={styles.itemDate}>
                    {new Date(item.date_added).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </LinearGradient>

            {/* Highest Value Items */}
            <LinearGradient colors={['#FFFFFF', '#F9FAFB']} style={[styles.card, styles.listCard]}>
              <Text style={styles.cardTitle}>Top Value Items</Text>
              {topByValue.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.rank}>{index + 1}.</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemValue}>₱{(item.price * item.stock).toFixed(2)}</Text>
                </View>
              ))}
            </LinearGradient>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollArea: {
    padding: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4A5568',
    marginLeft: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCardContainer: {
    width: '48%',
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#9CA3AF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardIcon: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1F2937',
    marginVertical: 4,
  },
  summarySub: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
  },
  emptyChartContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  emptyChartText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 18,
  },
  centerLabelContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabelValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  centerLabelText: {
    fontSize: 14,
    color: '#6B7280',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 24,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 12,
    padding: 4,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 16,
    color: '#374151',
  },
  listRow: {
    flexDirection: 'column',
    gap: 20,
  },
  listCard: {
    width: '100%',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#374151',
  },
  itemSub: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 2,
  },
  itemDate: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  rank: {
    fontWeight: 'bold',
    color: '#9CA3AF',
    width: 24,
    fontSize: 18,
  },
  itemValue: {
    fontWeight: 'bold',
    color: '#1F2937',
    fontSize: 18,
  },
});